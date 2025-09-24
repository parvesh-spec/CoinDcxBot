import axios from 'axios';
import crypto from 'crypto';

interface CoinDCXTrade {
  id: string;
  // Trade fields
  market?: string;
  side?: 'buy' | 'sell';
  price?: string;
  fee?: string;
  timestamp?: number;
  status?: string;
  // Futures position fields
  pair?: string;
  active_pos?: number;
  inactive_pos_buy?: number;
  inactive_pos_sell?: number;
  avg_price?: number;
  liquidation_price?: number;
  locked_margin?: number;
  leverage?: number;
  mark_price?: number;
  margin_type?: string;
  margin_currency_short_name?: string;
  take_profit_trigger?: number | null;
  stop_loss_trigger?: number | null;
  updated_at?: number;
}

interface CoinDCXConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
}

export class CoinDCXService {
  private config: CoinDCXConfig;

  constructor() {
    this.config = {
      apiKey: process.env.COINDCX_API_KEY || '',
      apiSecret: process.env.COINDCX_API_SECRET || '',
      baseUrl: process.env.COINDCX_BASE_URL || 'https://api.coindcx.com',
    };

    if (!this.config.apiKey || !this.config.apiSecret) {
      console.warn('CoinDCX API credentials not found. Please set COINDCX_API_KEY and COINDCX_API_SECRET environment variables.');
    }
  }

  private generateSignature(body: string): string {
    return crypto.createHmac('sha256', this.config.apiSecret).update(body).digest('hex');
  }

  private getHeaders(body: string) {
    const signature = this.generateSignature(body);
    
    return {
      'X-AUTH-APIKEY': this.config.apiKey,
      'X-AUTH-SIGNATURE': signature,
      'Content-Type': 'application/json',
    };
  }

  async getRecentTrades(limit: number = 50): Promise<CoinDCXTrade[]> {
    try {
      const endpoint = '/exchange/v1/derivatives/futures/positions';
      const timestamp = Date.now();
      const body = JSON.stringify({ 
        timestamp: timestamp,
        page: 1,
        size: limit,
        status: 'open'
      });
      const headers = this.getHeaders(body);
      
      const response = await axios.post(`${this.config.baseUrl}${endpoint}`, body, {
        headers
      });

      // Handle different response formats
      if (response.data && Array.isArray(response.data)) {
        console.log(`✅ CoinDCX API: Found ${response.data.length} positions`);
        return response.data;
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        console.log(`✅ CoinDCX API: Found ${response.data.data.length} positions`);
        return response.data.data;
      } else {
        console.log('⚠️ CoinDCX API: No positions found or unexpected response format');
        return [];
      }
    } catch (error: any) {
      console.error('Error fetching CoinDCX trades:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        url: error.config?.url,
        responseData: error.response?.data
      });
      
      // Show debugging info without exposing secrets
      console.log('API Connection Details:');
      console.log('- API Key Status:', this.config.apiKey ? 'Present' : 'Missing');
      console.log('- Endpoint:', `${this.config.baseUrl}/exchange/v1/derivatives/futures/positions`);
      
      // Don't throw error, just return empty array for now
      // This prevents the trade monitor from crashing
      return [];
    }
  }

  async getTradeDetails(tradeId: string): Promise<CoinDCXTrade | null> {
    try {
      const endpoint = `/exchange/v1/orders/status`;
      const timestamp = Date.now();
      const body = JSON.stringify({ timestamp, id: tradeId });
      const headers = this.getHeaders(body);
      
      const response = await axios.post(`${this.config.baseUrl}${endpoint}`, body, {
        headers
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching trade ${tradeId}:`, error);
      return null;
    }
  }

  async validateApiConnection(): Promise<boolean> {
    try {
      const endpoint = '/exchange/v1/users/balances';
      const timestamp = Date.now();
      const body = JSON.stringify({ timestamp });
      const headers = this.getHeaders(body);
      
      const response = await axios.post(`${this.config.baseUrl}${endpoint}`, body, {
        headers
      });

      return response.status === 200;
    } catch (error: any) {
      console.error('CoinDCX API connection validation failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        endpoint: '/exchange/v1/users/balances'
      });
      return false;
    }
  }

  // Method to validate custom API credentials for copy trading users
  // Get futures wallet balance with custom credentials
  async getFuturesWalletBalance(apiKey: string, apiSecret: string): Promise<{ success: boolean; balance?: any; message: string }> {
    try {
      // Removed API key logging for production security
      
      // Use the actual futures wallet endpoint as per CoinDCX documentation - GET request with body
      const endpoint = '/exchange/v1/derivatives/futures/wallets';
      const timestamp = Date.now();
      const body = JSON.stringify({ timestamp });
      
      // Generate signature for GET request - sign the JSON body
      const signature = crypto.createHmac('sha256', apiSecret).update(body).digest('hex');
      
      const headers = {
        'X-AUTH-APIKEY': apiKey,
        'X-AUTH-SIGNATURE': signature,
        'Content-Type': 'application/json',
      };
      
      const response = await axios.get(`${this.config.baseUrl}${endpoint}`, {
        headers,
        data: body, // Send body with GET request (CoinDCX requirement)
        timeout: 10000, // 10 second timeout
      });

      if (response.status === 200) {
        console.log(`✅ Futures wallet balance fetched successfully`);
        return { 
          success: true, 
          balance: response.data,
          message: 'Balance fetched successfully' 
        };
      } else {
        console.log(`❌ Unexpected response status: ${response.status}`);
        return { 
          success: false, 
          message: 'Failed to fetch balance' 
        };
      }
    } catch (error: any) {
      console.error(`❌ Futures wallet balance fetch failed`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        responseData: error.response?.data
      });
      
      // Provide specific error messages
      if (error.response?.status === 401) {
        return { success: false, message: 'Invalid API credentials' };
      } else if (error.response?.status === 403) {
        return { success: false, message: 'API access forbidden' };
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return { success: false, message: 'Connection failed' };
      } else if (error.code === 'ECONNABORTED') {
        return { success: false, message: 'Connection timeout' };
      } else {
        return { success: false, message: `Balance fetch failed: ${error.message}` };
      }
    }
  }

  async validateCustomCredentials(apiKey: string, apiSecret: string): Promise<{ valid: boolean; message: string }> {
    try {
      // Removed API key logging for production security
      
      const endpoint = '/exchange/v1/users/balances';
      const timestamp = Date.now();
      const body = JSON.stringify({ timestamp });
      
      // Generate signature with custom secret
      const signature = crypto.createHmac('sha256', apiSecret).update(body).digest('hex');
      
      const headers = {
        'X-AUTH-APIKEY': apiKey,
        'X-AUTH-SIGNATURE': signature,
        'Content-Type': 'application/json',
      };
      
      const response = await axios.post(`${this.config.baseUrl}${endpoint}`, body, {
        headers,
        timeout: 10000, // 10 second timeout
      });

      if (response.status === 200) {
        console.log(`✅ Credentials validated successfully`);
        return { valid: true, message: 'Credentials verified successfully' };
      } else {
        console.log(`❌ Unexpected response status: ${response.status}`);
        return { valid: false, message: 'Invalid API response' };
      }
    } catch (error: any) {
      console.error(`❌ Credential validation failed`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        responseData: error.response?.data
      });
      
      // Provide specific error messages based on response
      if (error.response?.status === 401) {
        return { valid: false, message: 'Invalid API key or secret. Please check your CoinDCX credentials.' };
      } else if (error.response?.status === 403) {
        return { valid: false, message: 'API access forbidden. Please ensure your API key has trading permissions.' };
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return { valid: false, message: 'Unable to connect to CoinDCX API. Please check your internet connection.' };
      } else if (error.code === 'ECONNABORTED') {
        return { valid: false, message: 'Connection timeout. Please try again.' };
      } else {
        return { valid: false, message: `Verification failed: ${error.message}` };
      }
    }
  }

  async exitTrade(tradeId: string, pair: string, tradeType: 'spot' | 'margin' | 'futures' = 'futures'): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log(`🚪 EXIT TRADE: Starting exit for ${pair} (${tradeType}) - Trade ID: ${tradeId}`);
      
      let endpoint: string;
      let requestBody: any;
      const timestamp = Date.now();
      
      // Determine the correct endpoint and parameters based on trade type
      switch (tradeType) {
        case 'futures':
          // Extract position ID from tradeId (format: positionId_timestamp)
          const positionId = tradeId.split('_')[0]; // Get position ID before underscore
          console.log(`🔍 EXIT TRADE: Using saved position ID: ${positionId} for ${pair}`);
          
          // Correct CoinDCX Futures exit endpoint - requires actual position ID from database
          endpoint = '/exchange/v1/derivatives/futures/positions/exit';
          requestBody = {
            id: positionId, // Using position ID from our database
            timestamp
          };
          break;
        
        case 'margin':
          // CoinDCX Margin exit endpoint - may need similar position-based approach
          endpoint = '/exchange/v1/margin/exit';
          requestBody = {
            timestamp,
            market: pair
          };
          break;
        
        case 'spot':
          // For spot trades, we can't exit automatically without knowing current holdings
          // This is a limitation - spot trades require manual intervention
          throw new Error('Spot trade exit not supported - requires manual order placement with specific quantity and side');
          break;
        
        default:
          throw new Error(`Unsupported trade type: ${tradeType}`);
      }
      
      const body = JSON.stringify(requestBody);
      const headers = this.getHeaders(body);
      
      console.log(`📤 EXIT TRADE: Sending ${tradeType} exit request to ${endpoint}`);
      console.log(`📋 EXIT TRADE: Request body:`, requestBody);
      
      const response = await axios.post(`${this.config.baseUrl}${endpoint}`, body, {
        headers
      });
      
      console.log(`✅ EXIT TRADE: Successfully exited ${pair} at market price`);
      console.log(`📊 EXIT TRADE: Response:`, response.data);
      
      return {
        success: true,
        message: `Trade ${pair} successfully exited at market price`,
        data: response.data
      };
      
    } catch (error: any) {
      console.error(`❌ EXIT TRADE: Failed to exit ${pair}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        responseData: error.response?.data,
        endpoint: error.config?.url
      });
      
      let errorMessage = 'Failed to exit trade on exchange';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed - check API credentials';
      } else if (error.response?.status === 400) {
        errorMessage = 'Invalid request - trade may not exist or already closed';
      } else if (error.response?.status === 429) {
        errorMessage = 'Rate limit exceeded - please try again later';
      }
      
      return {
        success: false,
        message: errorMessage,
        data: error.response?.data
      };
    }
  }

  // Mathematical helper functions for copy trading calculations
  
  /**
   * Calculate leverage based on risk percentage and price difference
   * Formula: leverage = (risk% / 100) * entry_price / (entry_price - stop_loss)
   */
  calculateLeverage(riskPercentage: number, entryPrice: number, stopLossPrice: number): number {
    try {
      // Validate inputs
      if (riskPercentage <= 0 || riskPercentage > 100) {
        throw new Error(`Invalid risk percentage: ${riskPercentage}. Must be between 0 and 100.`);
      }
      
      if (entryPrice <= 0) {
        throw new Error(`Invalid entry price: ${entryPrice}. Must be greater than 0.`);
      }
      
      if (stopLossPrice <= 0) {
        throw new Error(`Invalid stop loss price: ${stopLossPrice}. Must be greater than 0.`);
      }
      
      const priceDifference = Math.abs(entryPrice - stopLossPrice);
      
      if (priceDifference === 0) {
        throw new Error('Entry price and stop loss cannot be the same');
      }
      
      // Calculate leverage using the provided formula
      const leverage = (riskPercentage / 100) * (entryPrice / priceDifference);
      
      // Clamp leverage to safe ranges (1x to 50x max)
      const clampedLeverage = Math.max(1, Math.min(50, leverage));
      
      // Round to 2 decimal places for precision
      const finalLeverage = Math.round(clampedLeverage * 100) / 100;
      
      console.log(`📊 Leverage calculation: ${riskPercentage}% risk, entry: ${entryPrice}, SL: ${stopLossPrice} → ${finalLeverage}x`);
      
      return finalLeverage;
    } catch (error) {
      console.error('❌ Leverage calculation failed:', error);
      // Return safe default leverage if calculation fails
      return 1;
    }
  }
  
  /**
   * Calculate quantity based on fixed trade fund, leverage, and entry price
   * Formula: quantity = (trade_fund × leverage) ÷ entry_price
   * No safety margin - use exact calculated quantity
   */
  calculateQuantity(tradeFund: number, leverage: number, entryPrice: number): number {
    try {
      // Validate inputs
      if (tradeFund <= 0) {
        throw new Error(`Invalid trade fund: ${tradeFund}. Must be greater than 0.`);
      }
      
      if (leverage <= 0) {
        throw new Error(`Invalid leverage: ${leverage}. Must be greater than 0.`);
      }
      
      if (entryPrice <= 0) {
        throw new Error(`Invalid entry price: ${entryPrice}. Must be greater than 0.`);
      }
      
      // Calculate quantity using the provided formula
      const quantity = (tradeFund * leverage) / entryPrice;
      
      // Round to appropriate decimal places (6 decimal places for crypto)
      const finalQuantity = Math.round(quantity * 1000000) / 1000000;
      
      console.log(`💰 Quantity calculation: tradeFund: ${tradeFund} USDT, leverage: ${leverage}x, price: ${entryPrice} → ${finalQuantity} (exact quantity)`);
      
      return finalQuantity;
    } catch (error) {
      console.error('❌ Quantity calculation failed:', error);
      // Return 0 if calculation fails to prevent invalid orders
      return 0;
    }
  }
  
  /**
   * Validate minimum order requirements
   */
  validateOrderParameters(pair: string, quantity: number, price: number): { valid: boolean; message: string } {
    try {
      // Basic validation
      if (quantity <= 0) {
        return { valid: false, message: 'Quantity must be greater than 0' };
      }
      
      if (price <= 0) {
        return { valid: false, message: 'Price must be greater than 0' };
      }
      
      // Calculate notional value (quantity * price)
      const notionalValue = quantity * price;
      
      // Minimum notional value for most pairs is around 5 USDT
      const minNotional = 5;
      
      if (notionalValue < minNotional) {
        return { 
          valid: false, 
          message: `Order notional value ${notionalValue.toFixed(2)} USDT is below minimum ${minNotional} USDT` 
        };
      }
      
      // Check for very small quantities (exchange precision limits)
      if (quantity < 0.000001) {
        return { 
          valid: false, 
          message: `Quantity ${quantity} is too small (minimum 0.000001)` 
        };
      }
      
      console.log(`✅ Order validation passed: ${pair} qty:${quantity} notional:${notionalValue.toFixed(2)} USDT`);
      
      return { valid: true, message: 'Order parameters validated successfully' };
    } catch (error) {
      console.error('❌ Order validation failed:', error);
      return { valid: false, message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  // Create futures order with custom credentials for copy trading
  async createFuturesOrder(
    apiKey: string, 
    apiSecret: string, 
    orderData: {
      side: 'buy' | 'sell';
      pair: string;
      total_quantity: number;
      leverage: number;
      price: number;  // Add original trade price
      stop_loss_price?: number;
      take_profit_price?: number;
    }
  ): Promise<{ success: boolean; orderId?: string; message: string; data?: any }> {
    try {
      console.log(`🚀 Creating futures order: ${orderData.side.toUpperCase()} ${orderData.pair} qty:${orderData.total_quantity} leverage:${orderData.leverage}x`);
      
      const endpoint = '/exchange/v1/derivatives/futures/orders/create';
      const timestamp = Date.now();
      
      // Sanitize parameters for CoinDCX API requirements - VERY conservative
      const sanitizedQuantity = Math.round(orderData.total_quantity * 100) / 100; // 2 decimal precision like sample
      const sanitizedLeverage = Math.min(orderData.leverage, 5); // Cap leverage at 5x like working sample
      const sanitizedStopLoss = orderData.stop_loss_price ? Math.round(orderData.stop_loss_price * 100) / 100 : undefined; // 2 decimal precision
      const sanitizedTakeProfit = orderData.take_profit_price ? Math.round(orderData.take_profit_price * 100) / 100 : undefined; // 2 decimal precision
      
      console.log(`🔧 Sanitized params: qty:${sanitizedQuantity} leverage:${sanitizedLeverage}x SL:${sanitizedStopLoss} TP:${sanitizedTakeProfit}`);
      
      // Use EXACT original trade price - no calculation needed
      const originalPrice = orderData.price;
      
      console.log(`💰 USING ORIGINAL PRICE (No calculation):`);
      console.log(`   Original Trade Price: ${originalPrice}`);
      console.log(`   Stop Loss Price: ${orderData.stop_loss_price}`);
      console.log(`   Take Profit Price: ${orderData.take_profit_price}`);
      
      // Build request body exactly as per OFFICIAL CoinDCX API documentation
      const requestBody = {
        timestamp: timestamp,
        order: {
          side: orderData.side,
          pair: `B-${orderData.pair}`, // Futures requires B- prefix for pair field
          order_type: "limit_order", // Official docs: "market_order" OR "limit_order"
          price: originalPrice, // Use exact original trade price
          total_quantity: sanitizedQuantity,
          leverage: sanitizedLeverage,
          notification: "email_notification", // Official docs enum
          time_in_force: "good_till_cancel", // Official docs enum
          hidden: false, // Official docs boolean
          post_only: false // Official docs boolean
        }
      };
      
      console.log(`🚀 FINAL REQUEST BODY TO COINDCX:`);
      console.log(JSON.stringify(requestBody, null, 2));
      console.log(`📡 API Endpoint: ${this.config.baseUrl}${endpoint}`);
      console.log(`🔐 Using API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length-4)}`);
      console.log(`📝 Request Body Size: ${JSON.stringify(requestBody).length} bytes`);
      
      const body = JSON.stringify(requestBody);
      
      // Generate signature with user's secret
      const signature = crypto.createHmac('sha256', apiSecret).update(body).digest('hex');
      
      const headers = {
        'X-AUTH-APIKEY': apiKey,
        'X-AUTH-SIGNATURE': signature,
        'Content-Type': 'application/json',
      };
      
      console.log(`📤 Sending futures order to CoinDCX: ${orderData.side} ${orderData.pair}`);
      console.log(`📋 Request body:`, JSON.stringify(requestBody, null, 2));
      
      const response = await axios.post(`${this.config.baseUrl}${endpoint}`, body, {
        headers,
        timeout: 15000, // 15 second timeout for order placement
      });

      if (response.status === 200 || response.status === 201) {
        const orderId = response.data?.id || response.data?.orderId || 'unknown';
        console.log(`✅ Futures order created successfully: ${orderId}`);
        
        return { 
          success: true, 
          orderId: orderId,
          message: 'Order placed successfully',
          data: response.data
        };
      } else {
        console.log(`❌ Unexpected response status: ${response.status}`);
        return { 
          success: false, 
          message: `Unexpected response: ${response.status}` 
        };
      }
    } catch (error: any) {
      console.error(`❌ Futures order creation failed:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        responseData: error.response?.data,
        endpoint: error.config?.url
      });
      
      // Classify error types for better handling
      if (error.response?.status === 401) {
        return { success: false, message: 'Invalid API credentials' };
      } else if (error.response?.status === 403) {
        return { success: false, message: 'API access forbidden - check trading permissions' };
      } else if (error.response?.status === 400) {
        const apiMessage = error.response?.data?.message || 'Invalid order parameters';
        return { success: false, message: `Bad request: ${apiMessage}` };
      } else if (error.response?.status === 429) {
        return { success: false, message: 'Rate limit exceeded - retrying...' };
      } else if (error.code === 'ECONNABORTED') {
        return { success: false, message: 'Order timeout - connection failed' };
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return { success: false, message: 'Connection failed' };
      } else {
        const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
        return { success: false, message: `Order failed: ${errorMsg}` };
      }
    }
  }

  transformTradeData(coindcxTrade: CoinDCXTrade) {
    // Handle futures positions data format
    let pair = coindcxTrade.pair || coindcxTrade.market || 'UNKNOWN';
    
    // Remove B- prefix if it exists
    if (pair.startsWith('B-')) {
      pair = pair.substring(2);
    }
    const price = coindcxTrade.avg_price?.toString() || coindcxTrade.price || '0';
    const leverage = coindcxTrade.leverage || 1;
    const side = (coindcxTrade.active_pos || 0) > 0 ? 'buy' : ((coindcxTrade.active_pos || 0) < 0 ? 'sell' : coindcxTrade.side || 'unknown');
    const positionSize = Math.abs(coindcxTrade.active_pos || 0);
    
    // Only log important transform details
    if (positionSize > 0) {
      console.log(`📊 Transform: ${pair} ${side.toUpperCase()} ${leverage}x @ $${price}`);
    }
    
    // Calculate additional take profit levels
    let takeProfit2 = null;
    let takeProfit3 = null;
    
    if (coindcxTrade.take_profit_trigger && coindcxTrade.avg_price) {
      const avgPrice = coindcxTrade.avg_price;
      const takeProfit1 = coindcxTrade.take_profit_trigger;
      const difference = takeProfit1 - avgPrice;
      
      takeProfit2 = takeProfit1 + difference;
      takeProfit3 = takeProfit1 + (2 * difference);
    }

    return {
      tradeId: coindcxTrade.id,
      pair: pair as string,
      type: side === 'buy' ? 'BUY' : side === 'sell' ? 'SELL' : side,
      price: price,
      leverage: leverage,
      total: (parseFloat(price) * positionSize).toString(),
      fee: coindcxTrade.fee || '0',
      takeProfitTrigger: coindcxTrade.take_profit_trigger?.toString() || null,
      takeProfit2: takeProfit2?.toString() || null,
      takeProfit3: takeProfit3?.toString() || null,
      stopLossTrigger: coindcxTrade.stop_loss_trigger?.toString() || null,
      status: 'active' as const,
    };
  }
}

export const coindcxService = new CoinDCXService();
