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
      // Get all active channels with their templates
      const channels = await storage.getTelegramChannels();
      const activeChannels = channels.filter((channel: any) => channel.isActive && channel.templateId);

      console.log(`Found ${activeChannels.length} active channels with templates for trade ${trade.tradeId}`);

      for (const channel of activeChannels) {
        try {
          // Get the template directly using channel's templateId
          const template = await storage.getMessageTemplate(channel.templateId);

          if (template && template.isActive) {
            // Generate message using template
            const message = telegramService.generateTradeMessage(
              trade,
              template.template,
              template.includeFields
            );

            // Send to Telegram
            const result = await telegramService.sendMessage(channel.channelId, {
              text: message,
              parse_mode: 'HTML',
            });

            if (result.success) {
              console.log(`✅ Trade ${trade.tradeId} posted to channel ${channel.name}`);
            } else {
              console.error(`❌ Failed to post trade ${trade.tradeId} to channel ${channel.name}: ${result.error}`);
            }
          } else {
            console.log(`⚠️  Channel ${channel.name} has no active template, skipping`);
          }
        } catch (channelError) {
          console.error(`Error processing channel ${channel.name}:`, channelError);
        }
      }

      console.log(`✅ Trade ${trade.tradeId} posted to all channels successfully`);
      
    } catch (error) {
      console.error(`Error posting trade ${trade.id} to Telegram:`, error);
      // Note: With new system, we don't update status to 'failed' for posting errors
      // The trade remains 'active' and will be available for manual completion
    }
  }

  // No longer needed - trades stay 'active' until manually completed

  // Manual sync method - no automatic cron jobs
  async manualSync(): Promise<{ success: boolean; message: string; newTrades?: number }> {
    try {
      console.log('Manual sync triggered...');
      
      const newTrades = await coindcxService.getRecentTrades(50); // Get more trades for manual sync
      console.log(`📋 Processing ${newTrades.length} positions from API...`);
      
      let processedCount = 0;
      let existingCount = 0;
      
      for (const coindcxTrade of newTrades) {
        // Create unique identifier with position ID + updated timestamp
        const uniqueTradeId = `${coindcxTrade.id}_${coindcxTrade.updated_at}`;
        
        // Check if this specific position state already exists
        const existingTrade = await storage.getTradeByTradeId(uniqueTradeId);
        
        if (!existingTrade) {
          // Transform data first to check type
          const tradeData = coindcxService.transformTradeData(coindcxTrade);
          
          // Skip if type is unknown
          if (tradeData.type === 'unknown') {
            console.log(`⏭️  Skipped unknown type: ${coindcxTrade.pair} (cannot determine buy/sell)`);
            existingCount++;
            continue;
          }
          
          const positionType = (coindcxTrade.active_pos || 0) > 0 ? 'LONG' : 'SHORT';
          console.log(`🆕 New position: ${coindcxTrade.pair} ${positionType} ${coindcxTrade.leverage}x (${uniqueTradeId})`);
          
          // Save new position with unique ID
          tradeData.tradeId = uniqueTradeId; // Use unique ID
          const savedTrade = await storage.createTrade(tradeData);
          
          // Queue for posting to Telegram
          await this.postTradeToTelegram(savedTrade);
          processedCount++;
        } else {
          console.log(`✅ Existing position: ${coindcxTrade.pair} (${uniqueTradeId})`);
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
