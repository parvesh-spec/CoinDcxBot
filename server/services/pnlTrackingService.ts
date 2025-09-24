import { coindcxService } from './coindcx';
import { storage } from '../storage';
import { safeDecrypt } from '../utils/encryption';

interface PnLUpdateResult {
  success: number;
  errors: number;
  details: Array<{
    copyTradeId: string;
    success: boolean;
    pnl?: number;
    exitPrice?: number;
    error?: string;
  }>;
}

export class PnLTrackingService {
  /**
   * Update P&L for all executed copy trades
   */
  async updateAllCopyTradesPnL(): Promise<PnLUpdateResult> {
    const result: PnLUpdateResult = {
      success: 0,
      errors: 0,
      details: []
    };

    try {
      console.log('📊 Starting P&L update for all executed copy trades...');

      // Get all executed copy trades that don't have P&L data yet
      const { copyTrades } = await storage.getCopyTrades({
        status: 'executed',
        limit: 100
      });

      const executedTrades = copyTrades.filter(trade => 
        trade.executedTradeId && (!trade.pnl || !trade.exitPrice)
      );

      console.log(`📋 Found ${executedTrades.length} executed trades without P&L data`);

      for (const copyTrade of executedTrades) {
        try {
          await this.updateSingleCopyTradePnL(copyTrade.id, result);
        } catch (error) {
          console.error(`❌ Error updating P&L for copy trade ${copyTrade.id}:`, error);
          result.errors++;
          result.details.push({
            copyTradeId: copyTrade.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      console.log(`✅ P&L update completed: ${result.success} success, ${result.errors} errors`);
      return result;

    } catch (error) {
      console.error('❌ P&L update service failed:', error);
      result.errors++;
      return result;
    }
  }

  /**
   * Update P&L for a single copy trade
   */
  private async updateSingleCopyTradePnL(copyTradeId: string, result: PnLUpdateResult): Promise<void> {
    // Get the copy trade details
    const { copyTrades } = await storage.getCopyTrades({});
    const copyTrade = copyTrades.find(t => t.id === copyTradeId);
    
    if (!copyTrade || !copyTrade.executedTradeId) {
      throw new Error('Copy trade not found or missing executed trade ID');
    }

    // Get the copy trading user to access their API credentials
    const copyUser = await storage.getCopyTradingUser(copyTrade.copyUserId);
    if (!copyUser || !copyUser.apiKey || !copyUser.apiSecret) {
      throw new Error('Copy trading user not found or missing API credentials');
    }

    // Decrypt API credentials
    const apiKey = safeDecrypt(copyUser.apiKey);
    const apiSecret = safeDecrypt(copyUser.apiSecret);
    
    if (!apiKey || !apiSecret) {
      throw new Error('Failed to decrypt API credentials');
    }

    // Fetch transactions for this specific order
    console.log(`📡 Fetching transactions for copy trade ${copyTradeId}, order ID: ${copyTrade.executedTradeId}`);
    const transactions = await coindcxService.getFuturesTransactions(
      apiKey, 
      apiSecret, 
      copyTrade.executedTradeId
    );

    console.log(`📊 CoinDCX API Response for order ${copyTrade.executedTradeId}:`);
    console.log(`   - Total transactions found: ${transactions.length}`);
    console.log(`   - Raw transaction data:`, JSON.stringify(transactions, null, 2));

    if (transactions.length === 0) {
      console.log(`⚠️ No transactions found for copy trade ${copyTradeId} with order ID ${copyTrade.executedTradeId}`);
      return;
    }

    // Find the specific P&L for this executed trade ID
    console.log(`💰 P&L Calculation for copy trade ${copyTradeId}:`);
    console.log(`   - Processing ${transactions.length} transactions...`);
    console.log(`   - Looking for executed trade ID: ${copyTrade.executedTradeId}`);
    
    // Step 1: Find transaction with parent_id = executed_trade_id
    const mainTransaction = transactions.find(tx => tx.parent_id === copyTrade.executedTradeId);
    if (!mainTransaction) {
      console.log(`   - ❌ No transaction found with parent_id = ${copyTrade.executedTradeId}`);
      return;
    }
    
    console.log(`   - ✅ Found main transaction with position_id: ${mainTransaction.position_id}`);
    
    // Step 2: Find P&L transaction with same position_id but different parent_id
    const pnlTransaction = transactions.find(tx => 
      tx.position_id === mainTransaction.position_id && 
      tx.parent_id !== copyTrade.executedTradeId &&
      tx.amount !== 0 // P&L transactions have non-zero amount
    );
    
    if (!pnlTransaction) {
      console.log(`   - ❌ No P&L transaction found for position_id: ${mainTransaction.position_id}`);
      return;
    }
    
    const totalPnL = pnlTransaction.amount;
    console.log(`   - ✅ Found P&L transaction: parent_id = ${pnlTransaction.parent_id}, amount = ${totalPnL} USDT`);

    // Calculate exit price if we have the required data
    let exitPrice: number | undefined;
    
    console.log(`🎯 Exit Price Calculation for copy trade ${copyTradeId}:`);
    console.log(`   - Entry Price: ${copyTrade.executedPrice}`);
    console.log(`   - Executed Quantity: ${copyTrade.executedQuantity}`);
    console.log(`   - Trade Type: ${copyTrade.type}`);
    console.log(`   - Leverage: ${copyTrade.leverage}`);
    console.log(`   - Total P&L: ${totalPnL} USDT`);
    
    if (copyTrade.executedPrice && copyTrade.executedQuantity && totalPnL !== 0) {
      const entryPrice = parseFloat(copyTrade.executedPrice);
      const quantity = parseFloat(copyTrade.executedQuantity);
      const side = copyTrade.type.toLowerCase() as 'buy' | 'sell';
      const leverage = parseFloat(copyTrade.leverage.toString());
      
      console.log(`   - Parsed values: entryPrice=${entryPrice}, quantity=${quantity}, side=${side}, leverage=${leverage}`);
      
      exitPrice = coindcxService.calculateExitPrice(
        entryPrice,
        quantity,
        totalPnL,
        leverage,
        side
      );
      
      console.log(`   - Calculated Exit Price: ${exitPrice}`);
    } else {
      console.log(`   - Cannot calculate exit price: missing data or zero P&L`);
      console.log(`     - executedPrice: ${copyTrade.executedPrice || 'MISSING'}`);
      console.log(`     - executedQuantity: ${copyTrade.executedQuantity || 'MISSING'}`);
      console.log(`     - totalPnL: ${totalPnL} (${totalPnL === 0 ? 'ZERO' : 'OK'})`);
    }

    // Update the copy trade with P&L and exit price
    await storage.updateCopyTradePnL(copyTradeId, {
      pnl: totalPnL,
      exitPrice: exitPrice
    });

    console.log(`✅ Updated P&L for copy trade ${copyTradeId}: P&L=${totalPnL} USDT, Exit Price=${exitPrice || 'N/A'}`);

    result.success++;
    result.details.push({
      copyTradeId,
      success: true,
      pnl: totalPnL,
      exitPrice: exitPrice
    });
  }

  /**
   * Update P&L for a specific copy trade by ID
   */
  async updateCopyTradePnLById(copyTradeId: string): Promise<{ success: boolean; message: string; data?: any }> {
    const result: PnLUpdateResult = {
      success: 0,
      errors: 0,
      details: []
    };

    try {
      await this.updateSingleCopyTradePnL(copyTradeId, result);
      
      if (result.success > 0) {
        return {
          success: true,
          message: 'P&L updated successfully',
          data: result.details[0]
        };
      } else {
        return {
          success: false,
          message: 'Failed to update P&L',
          data: result.details[0]
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const pnlTrackingService = new PnLTrackingService();