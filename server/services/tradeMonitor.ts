import { coindcxService } from './coindcx';
import { automationService } from './automationService';
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
          
          // Trigger automation for trade registration
          await automationService.triggerAutomations(savedTrade, 'trade_registered');
        }
      }
    } catch (error) {
      console.error('Error processing new trades:', error);
    }
  }

  /**
   * Trigger automation when trade status changes to completed
   */
  async triggerTradeCompleted(tradeId: string): Promise<void> {
    try {
      const trade = await storage.getTrade(tradeId);
      if (trade && trade.status === 'completed') {
        await automationService.triggerAutomations(trade, 'trade_completed');
      }
    } catch (error) {
      console.error(`Error triggering trade completed automation for ${tradeId}:`, error);
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
          
          // Trigger automation for trade registration
          await automationService.triggerAutomations(savedTrade, 'trade_registered');
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
