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

  // Fetch position transactions for P&L and exit price calculation
  async getPositionTransactions(positionIds: string | string[]): Promise<any[]> {
    try {
      const endpoint = '/exchange/v1/derivatives/futures/positions/transactions';
      const timestamp = Date.now();
      
      // Convert array to comma-separated string if needed
      const positionIdsStr = Array.isArray(positionIds) ? positionIds.join(',') : positionIds;
      
      const body = JSON.stringify({
        timestamp: timestamp,
        position_ids: positionIdsStr,
        stage: "all", // all OR default OR funding
        page: "1",
        size: "100"
      });
      
      const headers = this.getHeaders(body);
      
      console.log(`🔍 Fetching transactions for position(s): ${positionIdsStr}`);
      
      const response = await axios.post(`${this.config.baseUrl}${endpoint}`, body, {
        headers
      });

      if (response.status === 200 || response.status === 201) {
        const transactions = Array.isArray(response.data) ? response.data : [];
        console.log(`✅ Fetched ${transactions.length} transactions for position(s): ${positionIdsStr}`);
        return transactions;
      } else {
        console.log(`⚠️ No transactions found for position(s): ${positionIdsStr}`);
        return [];
      }
    } catch (error: any) {
      console.error(`❌ Error fetching transactions for position(s) ${positionIds}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        responseData: error.response?.data
      });
      return [];
    }
  }

  async validateApiConnection(): Promise<boolean> {
    try {
      const endpoint = '/exchange/v1/orders/active_orders';
      const timestamp = Date.now();
      const body = JSON.stringify({ timestamp });
      const headers = this.getHeaders(body);
      
      const response = await axios.post(`${this.config.baseUrl}${endpoint}`, body, {
        headers
      });
      
      return response.status === 200;
    } catch (error: any) {
      return false;
    }
  }

  async getFuturesWalletBalance(apiKey: string, apiSecret: string): Promise<{ success: boolean; balance: number; message: string }> {
    try {
      const endpoint = '/exchange/v1/derivatives/futures/balance';
      const timestamp = Date.now();
      const body = JSON.stringify({ timestamp });
      
      // Use provided credentials instead of instance credentials
      const signature = crypto.createHmac('sha256', apiSecret).update(body).digest('hex');
      const headers = {
        'X-AUTH-APIKEY': apiKey,
        'X-AUTH-SIGNATURE': signature,
        'Content-Type': 'application/json',
      };
      
      const response = await axios.post(`${this.config.baseUrl}${endpoint}`, body, {
        headers
      });

      if (response.status === 200 || response.status === 201) {
        // Handle array response format from CoinDCX
        const balanceData = Array.isArray(response.data) ? response.data : [response.data];
        
        // Find USDT balance
        const usdtBalance = balanceData.find((item: any) => 
          item.currency === 'USDT' || 
          item.currency_short_name === 'USDT' ||
          item.margin_currency_short_name === 'USDT'
        );
        
        if (usdtBalance) {
          const balance = parseFloat(usdtBalance.balance || usdtBalance.available_balance || '0');
          return { 
            success: true, 
            balance: balance,
            message: 'Balance fetched successfully'
          };
        } else {
          return { 
            success: false, 
            balance: 0,
            message: 'USDT balance not found in response'
          };
        }
      } else {
        return { 
          success: false, 
          balance: 0,
          message: `API returned status ${response.status}`
        };
      }
    } catch (error: any) {
      console.error('Error fetching futures wallet balance:', error.response?.data || error.message);
      return { 
        success: false, 
        balance: 0,
        message: error.response?.data?.message || error.message || 'Failed to fetch balance'
      };
    }
  }

  async validateCustomCredentials(apiKey: string, apiSecret: string): Promise<{ valid: boolean; message: string }> {
    try {
      const endpoint = '/exchange/v1/derivatives/futures/balance';
      const timestamp = Date.now();
      const body = JSON.stringify({ timestamp });
      
      const signature = crypto.createHmac('sha256', apiSecret).update(body).digest('hex');
      const headers = {
        'X-AUTH-APIKEY': apiKey,
        'X-AUTH-SIGNATURE': signature,
        'Content-Type': 'application/json',
      };
      
      const response = await axios.post(`${this.config.baseUrl}${endpoint}`, body, {
        headers
      });

      if (response.status === 200 || response.status === 201) {
        return { valid: true, message: 'API credentials are valid' };
      } else {
        return { valid: false, message: `API returned status ${response.status}` };
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        return { valid: false, message: 'Invalid API credentials' };
      } else if (error.response?.status === 403) {
        return { valid: false, message: 'API access forbidden - check permissions' };
      } else {
        return { valid: false, message: error.response?.data?.message || 'API validation failed' };
      }
    }
  }

  // Helper function to sanitize and validate futures order parameters
  private sanitizeOrderParams(params: any) {
    const {
      side,
      pair,
      price,
      total_quantity,
      leverage,
      stop_loss_price,
      take_profit_price
    } = params;

    // CoinDCX specific parameter sanitization
    const sanitized = {
      side: side?.toLowerCase(),
      pair: pair.startsWith('B-') ? pair : `B-${pair}`, // Add B- prefix for futures
      price: Math.round(parseFloat(price) * 100) / 100, // Round to 2 decimals
      total_quantity: Math.round(parseFloat(total_quantity) * 10) / 10, // Round to 0.1
      leverage: Math.min(Math.floor(parseFloat(leverage)), 5), // Cap at 5x and floor
      stop_loss_price: Math.round(parseFloat(stop_loss_price) * 100) / 100,
      take_profit_price: Math.round(parseFloat(take_profit_price) * 100) / 100,
    };

    console.log(`🔧 Parameter Sanitization for CoinDCX API Requirements:`);
    console.log(`   - Original Quantity: ${total_quantity} → Sanitized: ${sanitized.total_quantity} (rounded to 0.1)`);
    console.log(`   - Original Leverage: ${leverage}x → Sanitized: ${sanitized.leverage}x (capped at 5x)`);
    console.log(`   - Original Stop Loss: ${stop_loss_price} → Sanitized: ${sanitized.stop_loss_price} (2 decimals)`);
    console.log(`   - Original Take Profit: ${take_profit_price} → Sanitized: ${sanitized.take_profit_price} (2 decimals)`);

    return sanitized;
  }

  async createFuturesOrder(orderData: any): Promise<{ success: boolean; orderId: string | null; message: string; data?: any }> {
    try {
      console.log(`🎯 ===== COINDCX API SERVICE PARAMETERS =====`);
      console.log(`📥 Received Order Data from Copy Trading Service:`);
      console.log(`   - Side: ${orderData.side?.toUpperCase()}`);
      console.log(`   - Pair: ${orderData.pair}`);
      console.log(`   - Price: ${orderData.price} USDT`);
      console.log(`   - Total Quantity: ${orderData.total_quantity} coins`);
      console.log(`   - Leverage: ${orderData.leverage}x`);
      console.log(`   - Stop Loss: ${orderData.stop_loss_price} USDT`);
      console.log(`   - Take Profit: ${orderData.take_profit_price} USDT`);

      // Sanitize parameters for CoinDCX API requirements
      const sanitizedParams = this.sanitizeOrderParams(orderData);

      console.log(`💰 Price Verification:`);
      console.log(`   - Using Exact Original Trade Price: ${sanitizedParams.price} USDT`);

      const endpoint = '/exchange/v1/derivatives/futures/orders/create';
      const timestamp = Date.now();

      const orderBody = {
        side: sanitizedParams.side,
        pair: sanitizedParams.pair,
        order_type: "limit_order",
        price: sanitizedParams.price,
        total_quantity: sanitizedParams.total_quantity,
        leverage: sanitizedParams.leverage,
        stop_loss_price: sanitizedParams.stop_loss_price,
        take_profit_price: sanitizedParams.take_profit_price,
        notification: "email_notification",
        time_in_force: "good_till_cancel",
        hidden: false,
        post_only: false
      };

      const requestBody = {
        timestamp: timestamp,
        order: orderBody
      };

      console.log(`🚀 ===== FINAL API REQUEST TO COINDCX =====`);
      console.log(`📡 Endpoint: ${this.config.baseUrl}${endpoint}`);
      console.log(`🔐 API Key: ${this.config.apiKey.substring(0, 10)}...${this.config.apiKey.slice(-4)}`);
      console.log(`⏰ Timestamp: ${timestamp}`);
      console.log(`📋 Complete Request Body JSON:`);
      console.log(JSON.stringify(requestBody, null, 2));
      console.log(`📊 Request Summary:`);
      console.log(`   - Order Type: ${orderBody.order_type}`);
      console.log(`   - Trading Pair: ${orderBody.pair}`);
      console.log(`   - Direction: ${orderBody.side?.toUpperCase()}`);
      console.log(`   - Entry Price: ${orderBody.price} USDT`);
      console.log(`   - Quantity: ${orderBody.total_quantity} coins`);
      console.log(`   - Leverage: ${orderBody.leverage}x`);
      console.log(`   - Stop Loss: ${orderBody.stop_loss_price} USDT`);
      console.log(`   - Take Profit: ${orderBody.take_profit_price} USDT`);
      console.log(`   - Notification: ${orderBody.notification}`);
      console.log(`   - Time in Force: ${orderBody.time_in_force}`);
      console.log(`📝 Total Request Size: ${JSON.stringify(requestBody).length} bytes`);
      console.log(`=============================================`);

      const body = JSON.stringify(requestBody);
      const headers = this.getHeaders(body);

      console.log(`📤 Sending futures order to CoinDCX: ${sanitizedParams.side} ${orderData.pair}`);
      console.log(`📋 Request body:`, requestBody);

      const response = await axios.post(`${this.config.baseUrl}${endpoint}`, requestBody, {
        headers
      });

      if (response.status === 200 || response.status === 201) {
        // Handle both array and object response formats
        const responseData = Array.isArray(response.data) ? response.data[0] : response.data;
        const orderId = responseData?.id || responseData?.orderId || responseData?.order_id || null;
        
        if (!orderId || orderId === 'unknown') {
          console.log(`❌ Order placement failed: No valid order ID received from exchange`);
          
          return { 
            success: false, 
            orderId: null,
            message: `Order placement failed: No valid order ID received from exchange`,
            data: response.data
          };
        }
        
        console.log(`✅ Futures order created successfully: ${orderId}`);
        
        return { 
          success: true, 
          orderId: orderId,
          message: 'Order placed successfully',
          data: response.data
        };
      } else {
        return { 
          success: false, 
          orderId: null,
          message: `Order failed with status ${response.status}`,
          data: response.data
        };
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      console.error(`❌ Failed to create futures order:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: errorMessage,
        responseData: error.response?.data
      });
      
      return { 
        success: false, 
        orderId: null,
        message: errorMessage,
        data: error.response?.data
      };
    }
  }

  // Helper function for copy trading service
  async createFuturesOrderWithCustomCredentials(orderData: any, apiKey: string, apiSecret: string): Promise<{ success: boolean; orderId: string | null; message: string; data?: any }> {
    try {
      // Temporarily switch credentials
      const originalConfig = { ...this.config };
      this.config.apiKey = apiKey;
      this.config.apiSecret = apiSecret;
      
      const result = await this.createFuturesOrder(orderData);
      
      // Restore original credentials
      this.config = originalConfig;
      
      return result;
    } catch (error: any) {
      // Restore original credentials in case of error
      const originalConfig = { ...this.config };
      this.config = originalConfig;
      
      throw error;
    }
  }

  /**
   * Transform CoinDCX trade data to our Trade schema format
   */
  transformTradeData(coindcxTrade: any): any {
    // Determine trade type (buy/sell) based on active position
    let type = 'unknown';
    if (coindcxTrade.active_pos !== undefined) {
      type = (coindcxTrade.active_pos || 0) > 0 ? 'buy' : 'sell';
    }

    // Calculate total value (price * quantity)
    const price = parseFloat(coindcxTrade.price || 0);
    const quantity = Math.abs(parseFloat(coindcxTrade.active_pos || 0));
    const total = price * quantity;

    return {
      tradeId: coindcxTrade.id,
      pair: coindcxTrade.pair,
      type: type,
      price: price.toString(),
      leverage: parseInt(coindcxTrade.leverage || 1),
      total: total.toString(),
      fee: coindcxTrade.fee ? parseFloat(coindcxTrade.fee).toString() : null,
      takeProfitTrigger: null,
      takeProfit2: null,
      takeProfit3: null,
      stopLossTrigger: null,
      safebookPrice: null,
      targetStatus: {},
      status: 'active',
      completionReason: null,
      exchangeExited: false,
      notes: null,
      channelId: null
    };
  }
}

// Export singleton instance
export const coindcxService = new CoinDCXService();