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

  async cancelAllOrdersForPosition(positionId: string): Promise<void> {
    try {
      console.log(`🗑️ CANCEL ORDERS: Fetching active orders for position ${positionId}`);
      
      // Step 1: Get all active orders for this position
      const activeOrders = await this.getActiveOrdersForPosition(positionId);
      
      if (activeOrders.length === 0) {
        console.log(`✅ CANCEL ORDERS: No active orders found for position ${positionId}`);
        return;
      }
      
      console.log(`📋 CANCEL ORDERS: Found ${activeOrders.length} active orders to cancel`);
      
      // Step 2: Cancel each order individually using correct endpoint
      for (const order of activeOrders) {
        await this.cancelSingleOrder(order.id);
      }
      
      console.log(`✅ CANCEL ORDERS: All orders cancelled for position ${positionId}`);
      
    } catch (error: any) {
      console.error(`❌ CANCEL ORDERS: Failed to cancel orders for position ${positionId}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        data: error.response?.data
      });
      
      // Don't throw error - continue with exit even if cancellation fails
      console.log(`⚠️ CANCEL ORDERS: Continuing with exit despite cancellation issue`);
    }
  }

  async getActiveOrdersForPosition(positionId: string): Promise<any[]> {
    try {
      console.log(`📋 GET ORDERS: Fetching active orders for position ${positionId}`);
      
      const endpoint = '/exchange/v1/derivatives/futures/orders';
      const timestamp = Date.now();
      const requestBody = {
        timestamp
      };
      
      const body = JSON.stringify(requestBody);
      const headers = this.getHeaders(body);
      
      const response = await axios.post(`${this.config.baseUrl}${endpoint}`, body, {
        headers
      });
      
      const allOrders = response.data?.data || [];
      
      // Filter orders for this specific position that are still active
      const positionOrders = allOrders.filter((order: any) => 
        (order.position_id === positionId || order.id?.includes(positionId)) &&
        ['open', 'init', 'partial_entry'].includes(order.status)
      );
      
      console.log(`📊 GET ORDERS: Found ${positionOrders.length} active orders for position ${positionId}`);
      
      return positionOrders;
      
    } catch (error: any) {
      console.error(`❌ GET ORDERS: Failed to fetch orders:`, error.response?.data || error.message);
      return []; // Return empty array on error
    }
  }

  async cancelSingleOrder(orderId: string): Promise<void> {
    try {
      console.log(`🗑️ CANCEL ORDER: Cancelling individual order ${orderId}`);
      
      const endpoint = `/exchange/v1/orders/cancel/${orderId}`;
      const timestamp = Date.now();
      const requestBody = {
        order_id: orderId,
        timestamp
      };
      
      const body = JSON.stringify(requestBody);
      const headers = this.getHeaders(body);
      
      const response = await axios.delete(`${this.config.baseUrl}${endpoint}`, {
        headers,
        data: body
      });
      
      console.log(`✅ CANCEL ORDER: Successfully cancelled order ${orderId}`);
      
    } catch (error: any) {
      console.error(`❌ CANCEL ORDER: Failed to cancel order ${orderId}:`, {
        status: error.response?.status,
        data: error.response?.data
      });
      // Continue with other orders even if one fails
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
          
          // Step 1: Cancel all open orders for this position first
          console.log(`🗑️ EXIT TRADE: Cancelling all open orders for position ${positionId}`);
          await this.cancelAllOrdersForPosition(positionId);
          
          // Step 2: Exit the position after orders are cancelled
          console.log(`🚪 EXIT TRADE: Proceeding to exit position ${positionId}`);
          
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
