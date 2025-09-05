import axios from 'axios';
import crypto from 'crypto';

interface CoinDCXTrade {
  id: string;
  market: string;
  side: 'buy' | 'sell';
  price: string;
  quantity: string;
  fee: string;
  timestamp: number;
  status: string;
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
      const endpoint = '/exchange/v1/users/me/orders/trades';
      const timestamp = Date.now();
      const body = JSON.stringify({ timestamp, limit });
      const headers = this.getHeaders(body);
      
      // Log request details
      console.log('=== CoinDCX API Request ===');
      console.log('UPDATED ENDPOINT - Now using correct user trades endpoint');
      console.log('URL:', `${this.config.baseUrl}${endpoint}`);
      console.log('Request Body:', body);
      console.log('Headers:', {
        ...headers,
        'X-AUTH-SIGNATURE': '[HIDDEN]' // Don't log the actual signature for security
      });
      
      const response = await axios.post(`${this.config.baseUrl}${endpoint}`, body, {
        headers
      });

      // Log complete response details
      console.log('=== CoinDCX API Response ===');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Response Headers:', response.headers);
      console.log('Raw Response Data:', JSON.stringify(response.data, null, 2));
      console.log('Response Data Type:', typeof response.data);
      console.log('Is Array:', Array.isArray(response.data));
      
      if (response.data && response.data.data) {
        console.log('Nested Data Type:', typeof response.data.data);
        console.log('Is Nested Array:', Array.isArray(response.data.data));
      }

      // Handle different response formats
      if (response.data && Array.isArray(response.data)) {
        console.log(`Found ${response.data.length} trades in direct array format`);
        return response.data;
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        console.log(`Found ${response.data.data.length} trades in nested data format`);
        return response.data.data;
      } else {
        console.log('No trades found or unexpected response format. Full response structure:');
        console.log(JSON.stringify(response.data, null, 2));
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
      
      // Show detailed error for debugging
      console.log('API Credentials being used:');
      console.log('- API Key:', this.config.apiKey);
      console.log('- Endpoint:', `${this.config.baseUrl}/exchange/v1/orders/trade_history`);
      
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

  transformTradeData(coindcxTrade: CoinDCXTrade) {
    return {
      tradeId: coindcxTrade.id,
      pair: coindcxTrade.market,
      type: coindcxTrade.side,
      price: coindcxTrade.price,
      quantity: coindcxTrade.quantity,
      total: (parseFloat(coindcxTrade.price) * parseFloat(coindcxTrade.quantity)).toString(),
      fee: coindcxTrade.fee,
      status: 'pending' as const,
    };
  }
}

export const coindcxService = new CoinDCXService();
