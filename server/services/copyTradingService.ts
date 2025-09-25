import { DatabaseStorage } from '../storage';
import { CoinDCXService } from './coindcx';
import { decrypt, safeDecrypt } from '../utils/encryption';
import type { Trade, CopyTrade, CopyTradingUser } from '@shared/schema';

const storage = new DatabaseStorage();

export class CopyTradingService {
  private coindcxService: CoinDCXService;
  private isDryRun: boolean;
  private maxRetries: number;
  private retryDelay: number;
  private lastApiCall: Map<string, number> = new Map(); // Track last API call per user
  private minApiInterval: number = 2000; // Minimum 2 seconds between API calls per user

  constructor() {
    this.coindcxService = new CoinDCXService();
    // Dry-run mode for safe testing (set COPY_TRADING_DRY_RUN=true to enable)
    this.isDryRun = process.env.COPY_TRADING_DRY_RUN === 'true';
    this.maxRetries = parseInt(process.env.COPY_TRADING_MAX_RETRIES || '3');
    this.retryDelay = parseInt(process.env.COPY_TRADING_RETRY_DELAY || '1000'); // 1 second
    this.minApiInterval = parseInt(process.env.COPY_TRADING_API_INTERVAL || '2000'); // 2 seconds
    
    if (this.isDryRun) {
      console.log('🧪 Copy Trading Service initialized in DRY-RUN mode - no real trades will be executed');
    } else {
      console.log('🚀 Copy Trading Service initialized in LIVE mode - real trades will be executed');
    }
  }

  /**
   * Rate limiting: Wait if needed before making API call for specific user
   */
  private async waitForRateLimit(userId: string): Promise<void> {
    const lastCall = this.lastApiCall.get(userId) || 0;
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;
    
    if (timeSinceLastCall < this.minApiInterval) {
      const waitTime = this.minApiInterval - timeSinceLastCall;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms for user ${userId}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastApiCall.set(userId, Date.now());
  }

  /**
   * Retry mechanism with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    context: string,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      console.error(`❌ ${context} failed (attempt ${attempt}/${this.maxRetries}):`, error.message);
      
      // Check if error is retryable
      const isRetryable = this.isRetryableError(error);
      
      if (!isRetryable || attempt >= this.maxRetries) {
        console.error(`💥 ${context} permanently failed after ${attempt} attempts`);
        throw error;
      }
      
      // Calculate exponential backoff delay
      const delay = this.retryDelay * Math.pow(2, attempt - 1);
      console.log(`🔄 ${context} retrying in ${delay}ms (attempt ${attempt + 1}/${this.maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retryWithBackoff(operation, context, attempt + 1);
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors are retryable
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') {
      return true;
    }
    
    // Rate limit errors are retryable
    if (error.response?.status === 429) {
      return true;
    }
    
    // Server errors (5xx) are retryable
    if (error.response?.status >= 500 && error.response?.status < 600) {
      return true;
    }
    
    // Authentication errors (401, 403) are NOT retryable
    if (error.response?.status === 401 || error.response?.status === 403) {
      return false;
    }
    
    // Bad requests (400) are usually NOT retryable unless specific cases
    if (error.response?.status === 400) {
      const errorMessage = error.response?.data?.message?.toLowerCase() || '';
      // Some specific 400 errors that might be retryable
      if (errorMessage.includes('timeout') || errorMessage.includes('temporary')) {
        return true;
      }
      return false;
    }
    
    // Default: assume non-HTTP errors are retryable
    return true;
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
      stopLossPrice: originalTrade.stopLossTrigger || null, // Exact stop loss from original trade
      takeProfitPrice: originalTrade.takeProfitTrigger || null, // Exact take profit from original trade
      leverage: originalTrade.leverage.toString(),
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

      // Check if user has sufficient funds before executing trade
      if (user.lowFund) {
        const errorMsg = `Trade blocked: User ${user.name} has insufficient funds (wallet balance < ${user.tradeFund} USDT)`;
        console.log(`⚠️ ${errorMsg}`);
        
        // Update copy trade status to failed with error message
        await storage.updateCopyTradeStatus(copyTrade.id, 'failed', errorMsg);
        return;
      }

      // Decrypt API credentials
      const apiKey = safeDecrypt(user.apiKey);
      const apiSecret = safeDecrypt(user.apiSecret);

      if (!apiKey || !apiSecret) {
        throw new Error('Failed to decrypt user API credentials');
      }

      // Create a temporary CoinDCX service instance with user's credentials
      const userCoindcxService = new CoinDCXService();
      // TODO: Set custom credentials for user-specific API calls

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

      // Execute real trade using trade fund and mathematical formulas
      await this.executeRealTrade(copyTrade, user, apiKey, apiSecret);

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
        undefined
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
   * Execute real trade on CoinDCX exchange using user's trade fund and API credentials
   * Includes dry-run mode, rate limiting, and retry mechanisms
   */
  private async executeRealTrade(
    copyTrade: CopyTrade, 
    user: any, 
    apiKey: string, 
    apiSecret: string
  ): Promise<void> {
    try {
      const tradeContext = `${copyTrade.pair} ${copyTrade.type} for user ${user.name}`;
      console.log(`🚀 Executing ${this.isDryRun ? 'DRY-RUN' : 'REAL'} trade: ${tradeContext}`);
      
      // Get original trade data for calculations
      const originalTrade = await storage.getTrade(copyTrade.originalTradeId);
      if (!originalTrade) {
        throw new Error('Original trade not found');
      }
      
      // Use tradeFund from user settings instead of wallet balance
      const tradeFund = parseFloat(user.tradeFund); // e.g., 100 USDT
      const entryPrice = parseFloat(copyTrade.originalPrice);
      const stopLossPrice = originalTrade.stopLossTrigger ? parseFloat(originalTrade.stopLossTrigger) : null;
      const takeProfitPrice = originalTrade.takeProfitTrigger ? parseFloat(originalTrade.takeProfitTrigger) : null;
      
      console.log(`\n🔍 ===== COPY TRADE PARAMETERS VERIFICATION =====`);
      console.log(`📊 Original Trade Data:`);
      console.log(`   - Trade ID: ${copyTrade.originalTradeId}`);
      console.log(`   - Pair: ${copyTrade.pair}`);
      console.log(`   - Side: ${copyTrade.type}`);
      console.log(`   - Original Price: ${copyTrade.originalPrice} USDT`);
      console.log(`   - Original Leverage: ${copyTrade.leverage}x`);
      
      console.log(`👤 User Settings:`);
      console.log(`   - User Name: ${user.name}`);
      console.log(`   - Trade Fund: ${tradeFund} USDT`);
      console.log(`   - Risk Per Trade: ${user.riskPerTrade}%`);
      console.log(`   - Wallet Balance: ${user.walletBalance} USDT`);
      
      console.log(`💰 Price Points:`);
      console.log(`   - Entry Price: ${entryPrice} USDT`);
      console.log(`   - Stop Loss: ${stopLossPrice || 'Not set'} USDT`);
      console.log(`   - Take Profit: ${takeProfitPrice || 'Not set'} USDT`);
      
      // NEW APPROACH: Calculate quantity FIRST, then leverage
      let calculatedQuantity = 0;
      let calculatedLeverage = 1;
      
      if (stopLossPrice) {
        // Step 1: Calculate quantity using NEW formula
        calculatedQuantity = this.coindcxService.calculateQuantity(
          tradeFund,        // Trade Fund from user settings
          user.riskPerTrade, // Risk percentage from user settings
          entryPrice,       // Original trade entry price
          stopLossPrice     // Original trade stop loss
        );
        
        // Step 2: Calculate leverage using NEW formula
        calculatedLeverage = this.coindcxService.calculateLeverage(
          calculatedQuantity, // Quantity calculated above
          entryPrice,         // Original trade entry price
          tradeFund           // Trade Fund from user settings
        );
      } else {
        // Fallback: Use original trade values if no stop loss
        calculatedLeverage = parseFloat(copyTrade.leverage);
        calculatedQuantity = (tradeFund * calculatedLeverage) / entryPrice; // Simple fallback
        console.log(`⚠️ No stop loss found, using fallback calculation with original leverage: ${calculatedLeverage}x`);
      }
      
      console.log(`🧮 NEW CALCULATION RESULTS:`);
      console.log(`   - Input Trade Fund: ${tradeFund} USDT`);
      console.log(`   - Input Risk Percent: ${user.riskPerTrade}%`);
      console.log(`   - Input Entry Price: ${entryPrice} USDT`);
      console.log(`   - Input Stop Loss: ${stopLossPrice || 'Not set'} USDT`);
      console.log(`   - ✅ STEP 1 - Calculated Quantity: ${calculatedQuantity} coins`);
      console.log(`   - ✅ STEP 2 - Calculated Leverage: ${calculatedLeverage}x`);
      
      // Round quantity based on trading pair requirements
      const originalQuantity = calculatedQuantity;
      calculatedQuantity = this.roundQuantityForPair(copyTrade.pair, calculatedQuantity);
      console.log(`   - 🔄 Rounded Quantity: ${originalQuantity} → ${calculatedQuantity} coins`);
      
      console.log(`   - Notional Value: ${(calculatedQuantity * entryPrice).toFixed(2)} USDT`);
      console.log(`   - Required Margin: ${((calculatedQuantity * entryPrice) / calculatedLeverage).toFixed(2)} USDT`);
      
      // Validate order parameters
      const validation = this.coindcxService.validateOrderParameters(
        copyTrade.pair,
        calculatedQuantity,
        entryPrice
      );
      
      if (!validation.valid) {
        throw new Error(`Order validation failed: ${validation.message}`);
      }
      
      // Prepare order data for CoinDCX API
      const orderData = {
        side: copyTrade.type.toLowerCase() as 'buy' | 'sell',
        pair: copyTrade.pair,
        price: entryPrice, // Use exact original trade price
        total_quantity: calculatedQuantity,
        leverage: calculatedLeverage,
        ...(stopLossPrice && { stop_loss_price: stopLossPrice }),
        ...(takeProfitPrice && { take_profit_price: takeProfitPrice })
      };
      
      console.log(`\n📤 FINAL ORDER DATA TO COINDCX API:`);
      console.log(`   - Side: ${orderData.side.toUpperCase()}`);
      console.log(`   - Pair: ${orderData.pair}`);
      console.log(`   - Price: ${orderData.price} USDT`);
      console.log(`   - Total Quantity: ${orderData.total_quantity} coins`);
      console.log(`   - Leverage: ${orderData.leverage}x`);
      if (orderData.stop_loss_price) {
        console.log(`   - Stop Loss Price: ${orderData.stop_loss_price} USDT`);
      }
      if (orderData.take_profit_price) {
        console.log(`   - Take Profit Price: ${orderData.take_profit_price} USDT`);
      }
      console.log(`========================================\n`);
      
      // Handle dry-run vs real execution
      if (this.isDryRun) {
        console.log(`🧪 DRY-RUN: Would place order:`, orderData);
        
        // Simulate execution for dry-run
        await this.simulateDryRunExecution(copyTrade, calculatedQuantity, calculatedLeverage, entryPrice);
        return;
      }
      
      console.log(`📤 Placing REAL order on CoinDCX:`, orderData);
      
      // Pre-order balance verification to catch insufficient funds early
      const requiredMargin = (calculatedQuantity * entryPrice) / calculatedLeverage; // Basic margin calculation
      console.log(`💰 Pre-order check: Required margin ≈ ${requiredMargin.toFixed(2)} USDT, Wallet balance: ${user.walletBalance} USDT`);
      
      if (user.walletBalance < requiredMargin * 1.1) { // 10% buffer for fees
        const insufficientMsg = `💰 Insufficient Funds: Required margin ≈ ${requiredMargin.toFixed(2)} USDT (+ fees), but wallet balance is only ${user.walletBalance} USDT. Please add more funds to your futures wallet.`;
        console.log(`⚠️ ${insufficientMsg}`);
        
        // Update copy trade status with detailed insufficient funds message
        await storage.updateCopyTradeStatus(copyTrade.id, 'failed', insufficientMsg);
        return;
      }
      
      // Apply rate limiting for this user
      await this.waitForRateLimit(user.id);
      
      // Execute the trade with retry mechanism
      const orderResult = await this.retryWithBackoff(
        async () => {
          return await this.coindcxService.createFuturesOrder(
            apiKey,
            apiSecret,
            orderData
          );
        },
        `CoinDCX order creation for ${tradeContext}`
      );
      
      if (orderResult.success && orderResult.orderId && orderResult.orderId !== 'unknown') {
        // Update copy trade with execution details
        await storage.updateCopyTradeExecution(copyTrade.id, {
          executedTradeId: orderResult.orderId,
          executedPrice: entryPrice, // Market order will execute near this price
          executedQuantity: calculatedQuantity,
          leverage: calculatedLeverage
        });
        
        console.log(`✅ Copy trade ${copyTrade.id} executed successfully! Order ID: ${orderResult.orderId}`);
      } else {
        const errorMsg = `Order execution failed: ${orderResult.message || 'Unknown error'}`;
        console.log(`❌ ${errorMsg}`);
        
        throw new Error(errorMsg);
      }
      
    } catch (error) {
      console.error(`❌ Trade execution failed for ${copyTrade.id}:`, error);
      
      // Classify error for better handling
      const errorMessage = this.classifyError(error);
      
      // Update copy trade with failure status
      await storage.updateCopyTradeStatus(
        copyTrade.id,
        'failed',
        `Execution failed: ${errorMessage}`
      );
      
      throw error; // Re-throw to be caught by caller
    }
  }

  /**
   * Simulate dry-run execution for testing purposes
   */
  private async simulateDryRunExecution(
    copyTrade: CopyTrade,
    quantity: number,
    leverage: number,
    price: number
  ): Promise<void> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // Simulate 95% success rate for dry-run
    const isSuccessful = Math.random() > 0.05;
    
    if (isSuccessful) {
      const mockOrderId = `DRY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await storage.updateCopyTradeExecution(copyTrade.id, {
        executedTradeId: mockOrderId,
        executedPrice: price,
        executedQuantity: quantity,
        leverage: leverage
      });
      
      console.log(`🧪 DRY-RUN: Copy trade ${copyTrade.id} simulated successfully! Mock Order ID: ${mockOrderId}`);
    } else {
      const mockFailureReasons = [
        'Simulated network timeout',
        'Simulated rate limit',
        'Simulated insufficient balance',
        'Simulated exchange maintenance'
      ];
      const randomReason = mockFailureReasons[Math.floor(Math.random() * mockFailureReasons.length)];
      
      await storage.updateCopyTradeStatus(copyTrade.id, 'failed', `DRY-RUN failure: ${randomReason}`);
      console.log(`🧪 DRY-RUN: Copy trade ${copyTrade.id} simulated failure: ${randomReason}`);
    }
  }

  /**
   * Classify error for better user understanding with enhanced insufficient fund handling
   */
  private classifyError(error: any): string {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 401:
          return 'Invalid API credentials';
        case 403:
          return 'API access forbidden - check trading permissions';
        case 400:
          // Enhanced handling for 400 errors with specific fund-related messages
          const message = data?.message || 'Invalid parameters';
          
          if (message.toLowerCase().includes('insufficient fund')) {
            return `💰 Insufficient Funds: Your futures wallet doesn't have enough balance for this trade. Current balance may be lower than required margin.`;
          } else if (message.toLowerCase().includes('quantity')) {
            return `📊 Quantity Error: ${message}. Our system automatically adjusts quantity precision.`;
          } else if (message.toLowerCase().includes('price')) {
            return `💵 Price Error: ${message}. Market conditions may have changed.`;
          } else if (message.toLowerCase().includes('leverage')) {
            return `⚡ Leverage Error: ${message}. Maximum allowed leverage may be lower for this pair.`;
          } else {
            return `Bad request: ${message}`;
          }
        case 429:
          return 'Rate limit exceeded - please wait before retrying';
        case 500:
        case 502:
        case 503:
        case 504:
          return 'Exchange server error - temporary issue';
        default:
          return `HTTP ${status}: ${data?.message || error.message}`;
      }
    } else if (error.code) {
      switch (error.code) {
        case 'ENOTFOUND':
          return 'Network connection failed - DNS resolution error';
        case 'ECONNREFUSED':
          return 'Connection refused - exchange may be down';
        case 'ECONNABORTED':
          return 'Request timeout - slow network or exchange response';
        default:
          return `Network error: ${error.code}`;
      }
    }
    
    return error instanceof Error ? error.message : 'Unknown error';
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

  /**
   * Round quantity based on trading pair requirements
   */
  private roundQuantityForPair(pair: string, quantity: number): number {
    // Define pairs that require whole numbers (no decimal places)
    const wholeNumberPairs = [
      'AVAX_USDT', 'HIPPO_USDT', 'BNB_USDT', 'SOL_USDT', 'ADA_USDT',
      'DOT_USDT', 'MATIC_USDT', 'LINK_USDT', 'UNI_USDT', 'ICP_USDT',
      'ATOM_USDT', 'VET_USDT', 'FIL_USDT', 'TRX_USDT', 'ETC_USDT'
    ];

    // Define pairs that allow specific decimal places
    const decimalPairs: { [key: string]: number } = {
      'BTC_USDT': 6,     // 6 decimal places
      'ETH_USDT': 5,     // 5 decimal places
      'XRP_USDT': 2,     // 2 decimal places
      'LTC_USDT': 4,     // 4 decimal places
      'BCH_USDT': 4,     // 4 decimal places
    };

    console.log(`🔄 Rounding quantity for pair ${pair}: ${quantity}`);

    // Check if pair requires whole numbers
    if (wholeNumberPairs.includes(pair)) {
      const rounded = Math.round(quantity);
      console.log(`   → Whole number required: ${quantity} → ${rounded}`);
      return rounded;
    }

    // Check if pair has specific decimal precision
    if (decimalPairs[pair] !== undefined) {
      const decimals = decimalPairs[pair];
      const rounded = parseFloat(quantity.toFixed(decimals));
      console.log(`   → ${decimals} decimal places: ${quantity} → ${rounded}`);
      return rounded;
    }

    // Default: round to 8 decimal places (most crypto precision)
    const rounded = parseFloat(quantity.toFixed(8));
    console.log(`   → Default 8 decimals: ${quantity} → ${rounded}`);
    return rounded;
  }
}

export const copyTradingService = new CopyTradingService();