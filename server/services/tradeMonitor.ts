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
      console.log(`=== Trade Processing Summary ===`);
      console.log(`Total trades received from API: ${newTrades.length}`);
      
      if (newTrades.length > 0) {
        console.log('Sample trade data from API:');
        console.log(JSON.stringify(newTrades[0], null, 2));
      }
      
      let processedCount = 0;
      let existingCount = 0;
      
      for (const coindcxTrade of newTrades) {
        console.log(`Checking trade ID: ${coindcxTrade.id}`);
        
        // Check if trade already exists
        const existingTrade = await storage.getTradeByTradeId(coindcxTrade.id);
        
        if (!existingTrade) {
          console.log(`New trade found: ${coindcxTrade.id} - ${coindcxTrade.market} ${coindcxTrade.side} ${coindcxTrade.price}`);
          
          // Transform and save new trade
          const tradeData = coindcxService.transformTradeData(coindcxTrade);
          console.log('Transformed trade data:', JSON.stringify(tradeData, null, 2));
          
          const savedTrade = await storage.createTrade(tradeData);
          console.log(`Trade saved with ID: ${savedTrade.id}`);
          
          // Queue for posting to Telegram
          await this.postTradeToTelegram(savedTrade);
          processedCount++;
        } else {
          console.log(`Trade ${coindcxTrade.id} already exists in database`);
          existingCount++;
        }
      }
      
      console.log(`=== Sync Results ===`);
      console.log(`New trades processed: ${processedCount}`);
      console.log(`Existing trades skipped: ${existingCount}`);
      console.log(`Total trades checked: ${newTrades.length}`);
      console.log(`Manual sync completed: ${processedCount} new trades processed`);
      
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
