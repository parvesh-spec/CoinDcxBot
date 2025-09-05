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

  private generateSignature(method: string, endpoint: string, body: string = ''): string {
    const timestamp = Date.now();
    const message = timestamp + method + endpoint + body;
    return crypto.createHmac('sha256', this.config.apiSecret).update(message).digest('hex');
  }

  private getHeaders(method: string, endpoint: string, body: string = '') {
    const timestamp = Date.now();
    const signature = this.generateSignature(method, endpoint, body);
    
    return {
      'X-AUTH-APIKEY': this.config.apiKey,
      'X-AUTH-SIGNATURE': signature,
      'X-AUTH-TIMESTAMP': timestamp.toString(),
      'Content-Type': 'application/json',
    };
  }

  async getRecentTrades(limit: number = 50): Promise<CoinDCXTrade[]> {
    try {
      // Try old endpoint first (for older API keys)
      const endpoint = '/exchange/v1/orders/trade_history';
      const headers = this.getHeaders('GET', endpoint);
      
      const response = await axios.get(`${this.config.baseUrl}${endpoint}`, {
        headers,
        params: { limit }
      });

      // Handle different response formats
      if (response.data && Array.isArray(response.data)) {
        return response.data;
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        return response.data.data;
      } else {
        console.log('No trades found or unexpected response format:', response.data);
        return [];
      }
    } catch (error: any) {
      console.error('Error fetching CoinDCX trades:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        url: error.config?.url
      });
      
      // Don't throw error, just return empty array for now
      // This prevents the trade monitor from crashing
      return [];
    }
  }

  async getTradeDetails(tradeId: string): Promise<CoinDCXTrade | null> {
    try {
      const endpoint = `/exchange/v1/orders/trade/${tradeId}`;
      const headers = this.getHeaders('GET', endpoint);
      
      const response = await axios.get(`${this.config.baseUrl}${endpoint}`, {
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
      // Try old endpoint first (for older API keys) 
      const endpoint = '/exchange/v1/users/balances';
      const headers = this.getHeaders('GET', endpoint);
      
      const response = await axios.get(`${this.config.baseUrl}${endpoint}`, {
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
