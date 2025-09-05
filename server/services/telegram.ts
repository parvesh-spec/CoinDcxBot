import axios from 'axios';

interface TelegramMessage {
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
  disable_web_page_preview?: boolean;
}

interface TelegramResponse {
  ok: boolean;
  result?: {
    message_id: number;
  };
  description?: string;
}

export class TelegramService {
  private botToken: string;
  private baseUrl: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;

    if (!this.botToken) {
      console.warn('Telegram Bot Token not found. Please set TELEGRAM_BOT_TOKEN environment variable.');
    }
  }

  async sendMessage(channelId: string, message: TelegramMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.botToken) {
        throw new Error('Telegram Bot Token not configured');
      }

      const response = await axios.post<TelegramResponse>(`${this.baseUrl}/sendMessage`, {
        chat_id: channelId,
        text: message.text,
        parse_mode: message.parse_mode || 'HTML',
        disable_web_page_preview: message.disable_web_page_preview || true,
      });

      if (response.data.ok) {
        return {
          success: true,
          messageId: response.data.result?.message_id?.toString(),
        };
      } else {
        return {
          success: false,
          error: response.data.description || 'Unknown error',
        };
      }
    } catch (error) {
      console.error('Error sending Telegram message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
      };
    }
  }

  async validateBotToken(): Promise<boolean> {
    try {
      if (!this.botToken) {
        return false;
      }

      const response = await axios.get(`${this.baseUrl}/getMe`);
      return response.data.ok;
    } catch (error) {
      console.error('Telegram bot token validation failed:', error);
      return false;
    }
  }

  generateTradeMessage(trade: any, template: string, includeFields: any): string {
    let message = template;

    // Replace variables with actual trade data
    if (includeFields.pair) {
      message = message.replace(/{pair}/g, trade.pair);
    }
    
    if (includeFields.price) {
      const formattedPrice = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
      }).format(parseFloat(trade.price));
      message = message.replace(/{price}/g, formattedPrice);
    }
    
    if (includeFields.type) {
      message = message.replace(/{type}/g, trade.type.toUpperCase());
    }
    
    if (includeFields.leverage) {
      message = message.replace(/{leverage}/g, trade.leverage);
    }
    
    if (includeFields.stopLoss) {
      if (trade.stopLossTrigger) {
        const formattedStopLoss = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 2,
        }).format(parseFloat(trade.stopLossTrigger));
        message = message.replace(/{stopLoss}/g, formattedStopLoss);
      } else {
        message = message.replace(/{stopLoss}/g, 'Not Set');
      }
    }
    
    if (includeFields.takeProfit1) {
      if (trade.takeProfitTrigger) {
        const formattedTP1 = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 2,
        }).format(parseFloat(trade.takeProfitTrigger));
        message = message.replace(/{takeProfit1}/g, formattedTP1);
      } else {
        message = message.replace(/{takeProfit1}/g, 'Not Set');
      }
    }
    
    if (includeFields.takeProfit2) {
      if (trade.takeProfit2) {
        const formattedTP2 = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 2,
        }).format(parseFloat(trade.takeProfit2));
        message = message.replace(/{takeProfit2}/g, formattedTP2);
      } else {
        message = message.replace(/{takeProfit2}/g, 'Not Set');
      }
    }
    
    if (includeFields.takeProfit3) {
      if (trade.takeProfit3) {
        const formattedTP3 = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 2,
        }).format(parseFloat(trade.takeProfit3));
        message = message.replace(/{takeProfit3}/g, formattedTP3);
      } else {
        message = message.replace(/{takeProfit3}/g, 'Not Set');
      }
    }
    
    if (includeFields.timestamp) {
      const timestamp = new Date(trade.createdAt).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      message = message.replace(/{timestamp}/g, timestamp);
    }
    
    if (includeFields.profitLoss && trade.profitLoss) {
      message = message.replace(/{profit_loss}/g, trade.profitLoss);
    }

    return message;
  }
}

export const telegramService = new TelegramService();
