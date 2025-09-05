import { coindcxService } from './coindcx';
import { telegramService } from './telegram';
import { storage } from '../storage';
import * as cron from 'node-cron';

export class TradeMonitorService {
  private isRunning = false;
  private cronJob: any = null;

  constructor() {
    this.isRunning = true;
    console.log('Trade monitoring service initialized (manual sync mode)');
  }

  private async processNewTrades() {
    try {
      console.log('Checking for new trades...');
      
      const newTrades = await coindcxService.getRecentTrades(10);
      
      for (const coindcxTrade of newTrades) {
        // Check if trade already exists
        const existingTrade = await storage.getTradeByTradeId(coindcxTrade.id);
        
        if (!existingTrade) {
          // Transform and save new trade
          const tradeData = coindcxService.transformTradeData(coindcxTrade);
          const savedTrade = await storage.createTrade(tradeData);
          
          // Queue for posting to Telegram
          await this.postTradeToTelegram(savedTrade);
        }
      }
    } catch (error) {
      console.error('Error processing new trades:', error);
    }
  }

  private async postTradeToTelegram(trade: any) {
    try {
      // Get all active channels
      const channels = await storage.getTelegramChannels();
      const activeChannels = channels.filter(channel => channel.isActive);

      for (const channel of activeChannels) {
        // Get template for this channel
        const templates = await storage.getMessageTemplates(channel.id);
        const activeTemplate = templates.find(template => template.isActive);

        if (activeTemplate) {
          // Generate message using template
          const message = telegramService.generateTradeMessage(
            trade,
            activeTemplate.template,
            activeTemplate.includeFields
          );

          // Send to Telegram
          const result = await telegramService.sendMessage(channel.channelId, {
            text: message,
            parse_mode: 'HTML',
          });

          if (result.success) {
            // Update trade status
            await storage.updateTrade(trade.id, {
              status: 'posted',
              channelId: channel.id,
              messageId: result.messageId,
            });
            console.log(`Trade ${trade.tradeId} posted to channel ${channel.name}`);
          } else {
            // Update with error
            await storage.updateTrade(trade.id, {
              status: 'failed',
              channelId: channel.id,
              errorMessage: result.error,
              retryCount: (trade.retryCount || 0) + 1,
            });
            console.error(`Failed to post trade ${trade.tradeId} to channel ${channel.name}: ${result.error}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error posting trade ${trade.id} to Telegram:`, error);
      await storage.updateTrade(trade.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        retryCount: (trade.retryCount || 0) + 1,
      });
    }
  }

  async retryFailedTrades() {
    try {
      const { trades: failedTrades } = await storage.getTrades({
        status: 'failed',
        limit: 20,
      });

      for (const trade of failedTrades) {
        if ((trade.retryCount || 0) < 3) {
          await this.postTradeToTelegram(trade);
        }
      }
    } catch (error) {
      console.error('Error retrying failed trades:', error);
    }
  }

  // Manual sync method - no automatic cron jobs
  async manualSync(): Promise<{ success: boolean; message: string; newTrades?: number }> {
    try {
      console.log('Manual sync triggered...');
      
      const newTrades = await coindcxService.getRecentTrades(50); // Get more trades for manual sync
      console.log(`📋 Processing ${newTrades.length} positions from API...`);
      
      let processedCount = 0;
      let existingCount = 0;
      
      for (const coindcxTrade of newTrades) {
        // Skip empty positions (active_pos = 0)
        if (coindcxTrade.active_pos === 0 || coindcxTrade.active_pos === undefined) {
          console.log(`⏭️  Skipped empty position: ${coindcxTrade.pair}`);
          existingCount++;
          continue;
        }
        
        // Check if position already exists
        const existingTrade = await storage.getTradeByTradeId(coindcxTrade.id);
        
        if (!existingTrade) {
          console.log(`🆕 New position: ${coindcxTrade.pair} ${coindcxTrade.active_pos > 0 ? 'LONG' : 'SHORT'} ${coindcxTrade.active_pos}`);
          
          // Transform and save new position
          const tradeData = coindcxService.transformTradeData(coindcxTrade);
          const savedTrade = await storage.createTrade(tradeData);
          
          // Queue for posting to Telegram
          await this.postTradeToTelegram(savedTrade);
          processedCount++;
        } else {
          console.log(`✅ Existing position: ${coindcxTrade.pair}`);
          existingCount++;
        }
      }
      
      console.log(`🔄 Sync completed: ${processedCount} new, ${existingCount} existing positions`);
      
      return {
        success: true,
        message: `Sync completed successfully. ${processedCount} new trades found and processed.`,
        newTrades: processedCount
      };
    } catch (error) {
      console.error('Manual sync failed:', error);
      return {
        success: false,
        message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  stopMonitoring() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('Trade monitoring stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      mode: 'manual_sync',
      lastCheck: new Date().toISOString(),
    };
  }
}

export const tradeMonitor = new TradeMonitorService();
