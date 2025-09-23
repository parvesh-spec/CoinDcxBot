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
      console.log(`💰 Fetching futures wallet balance for API key: ${apiKey.substring(0, 8)}...`);
      
      // Try the general balance endpoint first, which should include futures balances
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
        console.log(`✅ Futures wallet balance fetched successfully for API key: ${apiKey.substring(0, 8)}...`);
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
      console.error(`❌ Futures wallet balance fetch failed for API key: ${apiKey.substring(0, 8)}...`, {
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
      console.log(`🔐 Validating credentials for API key: ${apiKey.substring(0, 8)}...`);
      
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
        console.log(`✅ Credentials validated successfully for API key: ${apiKey.substring(0, 8)}...`);
        return { valid: true, message: 'Credentials verified successfully' };
      } else {
        console.log(`❌ Unexpected response status: ${response.status}`);
        return { valid: false, message: 'Invalid API response' };
      }
    } catch (error: any) {
      console.error(`❌ Credential validation failed for API key: ${apiKey.substring(0, 8)}...`, {
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
