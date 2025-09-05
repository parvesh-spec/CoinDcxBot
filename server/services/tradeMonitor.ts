import { coindcxService } from './coindcx';
import { telegramService } from './telegram';
import { storage } from '../storage';
import * as cron from 'node-cron';

export class TradeMonitorService {
  private isRunning = false;
  private cronJob: any = null;

  constructor() {
    this.startMonitoring();
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

  startMonitoring() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    // Check for new trades every 5 minutes (reduced frequency to avoid API spam)
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      await this.processNewTrades();
    });

    // Retry failed trades every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
      await this.retryFailedTrades();
    });

    console.log('Trade monitoring started');
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
      lastCheck: new Date().toISOString(),
    };
  }
}

export const tradeMonitor = new TradeMonitorService();
