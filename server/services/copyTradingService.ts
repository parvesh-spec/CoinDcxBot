import { DatabaseStorage } from '../storage';
import { CoinDCXService } from './coindcx';
import { decrypt, safeDecrypt } from '../utils/encryption';
import type { Trade, CopyTrade, CopyTradingUser } from '@shared/schema';

const storage = new DatabaseStorage();

export class CopyTradingService {
  private coindcxService: CoinDCXService;

  constructor() {
    this.coindcxService = new CoinDCXService();
  }

  /**
   * Process a new trade by creating copy trades for all active copy trading users
   */
  async processNewTradeForCopyTrading(originalTrade: Trade): Promise<{ 
    success: boolean; 
    message: string; 
    copyTrades?: CopyTrade[];
    errors?: string[];
  }> {
    try {
      console.log(`🔄 Processing copy trading for trade: ${originalTrade.pair} ${originalTrade.type}`);

      // Get all active copy trading users
      const activeUsers = await storage.getCopyTradingUsers();
      const activeCopyUsers = activeUsers.filter(user => user.isActive);

      if (activeCopyUsers.length === 0) {
        console.log('📭 No active copy trading users found');
        return {
          success: true,
          message: 'No active copy trading users to process',
          copyTrades: []
        };
      }

      console.log(`👥 Found ${activeCopyUsers.length} active copy trading users`);

      const copyTrades: CopyTrade[] = [];
      const errors: string[] = [];

      // Create copy trades for each active user
      for (const user of activeCopyUsers) {
        try {
          const copyTrade = await this.createCopyTradeForUser(originalTrade, user);
          copyTrades.push(copyTrade);
          console.log(`✅ Copy trade created for user: ${user.name} (${copyTrade.id})`);
        } catch (error) {
          const errorMsg = `Failed to create copy trade for user ${user.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // Execute copy trades asynchronously (fire and forget)
      this.executeCopyTradesAsync(copyTrades);

      return {
        success: true,
        message: `Created ${copyTrades.length} copy trades for ${activeCopyUsers.length} users`,
        copyTrades,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('Error processing copy trading:', error);
      return {
        success: false,
        message: `Copy trading processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Create a copy trade record for a specific user
   */
  private async createCopyTradeForUser(originalTrade: Trade, user: CopyTradingUser): Promise<CopyTrade> {
    // Calculate quantity based on user's risk percentage
    const adjustedQuantity = this.calculateAdjustedQuantity(
      originalTrade.total,
      user.riskPerTrade
    );

    const copyTradeData = {
      originalTradeId: originalTrade.id,
      copyUserId: user.id,
      executedTradeId: null,
      pair: originalTrade.pair,
      type: originalTrade.type,
      originalPrice: originalTrade.price,
      executedPrice: null,
      originalQuantity: originalTrade.total, // Store original quantity for reference
      executedQuantity: adjustedQuantity, // Adjusted quantity based on risk %
      leverage: originalTrade.leverage,
      status: 'pending',
      executionTime: null,
      errorMessage: null,
      pnl: null
    };

    return await storage.createCopyTrade(copyTradeData);
  }

  /**
   * Calculate adjusted quantity based on user's risk percentage
   */
  private calculateAdjustedQuantity(originalTotal: string, riskPercentage: string): string {
    try {
      const originalAmount = parseFloat(originalTotal);
      const riskPercent = parseFloat(riskPercentage);
      
      // Simple risk adjustment: scale the quantity based on risk percentage
      // This is a basic implementation - in production you might want more sophisticated position sizing
      const adjustedAmount = originalAmount * (riskPercent / 100);
      
      return adjustedAmount.toString();
    } catch (error) {
      console.warn('Error calculating adjusted quantity, using original:', error);
      return originalTotal; // Fallback to original quantity
    }
  }

  /**
   * Execute copy trades asynchronously
   */
  private async executeCopyTradesAsync(copyTrades: CopyTrade[]) {
    // Execute trades in parallel but don't await to avoid blocking the sync process
    Promise.all(
      copyTrades.map(copyTrade => this.executeCopyTrade(copyTrade))
    ).then(() => {
      console.log(`🏁 Finished executing ${copyTrades.length} copy trades`);
    }).catch((error) => {
      console.error('Error in copy trade execution batch:', error);
    });
  }

  /**
   * Execute a single copy trade
   */
  private async executeCopyTrade(copyTrade: CopyTrade): Promise<void> {
    try {
      console.log(`🚀 Executing copy trade: ${copyTrade.id} for pair ${copyTrade.pair}`);

      // Get the user's encrypted credentials
      const user = await storage.getCopyTradingUser(copyTrade.copyUserId);
      if (!user) {
        throw new Error('Copy trading user not found');
      }

      // Decrypt API credentials
      const apiKey = safeDecrypt(user.apiKey);
      const apiSecret = safeDecrypt(user.apiSecret);

      if (!apiKey || !apiSecret) {
        throw new Error('Failed to decrypt user API credentials');
      }

      // Create a temporary CoinDCX service instance with user's credentials
      const userCoindcxService = new CoinDCXService(apiKey, apiSecret);

      // For now, we'll mark as executed without actually placing trades
      // This is because implementing actual trade execution requires careful consideration of:
      // 1. Risk management
      // 2. Position sizing
      // 3. Market conditions
      // 4. Exchange-specific trade formats
      
      // In a production environment, you would:
      // 1. Validate market conditions
      // 2. Check user account balance
      // 3. Place the actual trade order
      // 4. Monitor execution
      // 5. Update copy trade with execution details

      // For this implementation, we'll simulate successful execution
      await this.simulateTradeExecution(copyTrade);

    } catch (error) {
      console.error(`❌ Failed to execute copy trade ${copyTrade.id}:`, error);
      
      // Update copy trade with error status
      await storage.updateCopyTradeStatus(
        copyTrade.id,
        'failed',
        `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Simulate trade execution (placeholder for actual trade execution logic)
   */
  private async simulateTradeExecution(copyTrade: CopyTrade): Promise<void> {
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Simulate execution with 90% success rate
    const isSuccessful = Math.random() > 0.1;

    if (isSuccessful) {
      // Simulate successful execution
      const executionPrice = this.simulateExecutionPrice(copyTrade.originalPrice);
      
      await storage.updateCopyTradeStatus(
        copyTrade.id,
        'executed',
        null
      );

      console.log(`✅ Copy trade ${copyTrade.id} executed successfully at ${executionPrice}`);
    } else {
      // Simulate execution failure
      const failureReasons = [
        'Insufficient balance',
        'Market volatility too high',
        'Order rejected by exchange',
        'API rate limit exceeded',
        'Network timeout'
      ];
      
      const randomReason = failureReasons[Math.floor(Math.random() * failureReasons.length)];
      
      await storage.updateCopyTradeStatus(
        copyTrade.id,
        'failed',
        `Simulated failure: ${randomReason}`
      );

      console.log(`❌ Copy trade ${copyTrade.id} failed: ${randomReason}`);
    }
  }

  /**
   * Simulate execution price with slight variation
   */
  private simulateExecutionPrice(originalPrice: string): string {
    try {
      const price = parseFloat(originalPrice);
      // Add small random variation (±0.1%)
      const variation = price * (Math.random() - 0.5) * 0.002;
      return (price + variation).toString();
    } catch (error) {
      return originalPrice;
    }
  }

  /**
   * Get copy trading statistics
   */
  async getCopyTradingStats(userId?: string): Promise<{
    totalTrades: number;
    executedTrades: number;
    failedTrades: number;
    pendingTrades: number;
    successRate: number;
  }> {
    try {
      const filters: any = {};
      if (userId) {
        filters.userId = userId;
      }

      const { copyTrades } = await storage.getCopyTrades(filters);
      
      const totalTrades = copyTrades.length;
      const executedTrades = copyTrades.filter(t => t.status === 'executed').length;
      const failedTrades = copyTrades.filter(t => t.status === 'failed').length;
      const pendingTrades = copyTrades.filter(t => t.status === 'pending').length;
      
      const successRate = totalTrades > 0 ? (executedTrades / totalTrades) * 100 : 0;

      return {
        totalTrades,
        executedTrades,
        failedTrades,
        pendingTrades,
        successRate
      };
    } catch (error) {
      console.error('Error getting copy trading stats:', error);
      return {
        totalTrades: 0,
        executedTrades: 0,
        failedTrades: 0,
        pendingTrades: 0,
        successRate: 0
      };
    }
  }
}

export const copyTradingService = new CopyTradingService();