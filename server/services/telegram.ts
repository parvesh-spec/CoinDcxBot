import axios from 'axios';

interface TelegramMessage {
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
  disable_web_page_preview?: boolean;
  reply_to_message_id?: string;
  allow_sending_without_reply?: boolean;
  reply_markup?: {
    inline_keyboard: any[][];
  };
}

interface TelegramPhotoMessage {
  photo: string;
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown';
  reply_to_message_id?: string;
  allow_sending_without_reply?: boolean;
  reply_markup?: {
    inline_keyboard: any[][];
  };
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

  async sendMessage(channelId: string, message: TelegramMessage | TelegramPhotoMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Check if this is a photo message
    if ('photo' in message) {
      return this.sendPhoto(channelId, message);
    }
    
    // Handle regular text message
    return this.sendTextMessage(channelId, message);
  }

  private async sendTextMessage(channelId: string, message: TelegramMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.botToken) {
        throw new Error('Telegram Bot Token not configured');
      }

      const payload: any = {
        chat_id: channelId,
        text: message.text,
        parse_mode: message.parse_mode || 'HTML',
        disable_web_page_preview: message.disable_web_page_preview !== false,
      };

      // Add reply parameters if provided
      if (message.reply_to_message_id) {
        const messageId = parseInt(message.reply_to_message_id);
        if (Number.isInteger(messageId) && messageId > 0) {
          payload.reply_to_message_id = messageId;
        } else {
          console.warn(`Invalid reply_to_message_id: ${message.reply_to_message_id}`);
        }
      }
      if (message.allow_sending_without_reply !== undefined) {
        payload.allow_sending_without_reply = message.allow_sending_without_reply;
      }

      // Add inline keyboard if provided
      if (message.reply_markup) {
        payload.reply_markup = message.reply_markup;
      }

      const response = await axios.post<TelegramResponse>(`${this.baseUrl}/sendMessage`, payload);

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
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      
      // Extract Telegram error details if available
      if (axios.isAxiosError(error) && error.response?.data?.description) {
        return {
          success: false,
          error: error.response.data.description,
        };
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private async sendPhoto(channelId: string, message: TelegramPhotoMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.botToken) {
        throw new Error('Telegram Bot Token not configured');
      }

      const payload: any = {
        chat_id: channelId,
        photo: message.photo,
        parse_mode: message.parse_mode || 'HTML',
      };

      // Add reply parameters if provided
      if (message.reply_to_message_id) {
        const messageId = parseInt(message.reply_to_message_id);
        if (Number.isInteger(messageId) && messageId > 0) {
          payload.reply_to_message_id = messageId;
        } else {
          console.warn(`Invalid reply_to_message_id: ${message.reply_to_message_id}`);
        }
      }
      if (message.allow_sending_without_reply !== undefined) {
        payload.allow_sending_without_reply = message.allow_sending_without_reply;
      }

      // Add caption if provided
      if (message.caption) {
        payload.caption = message.caption;
      }

      // Add inline keyboard if provided
      if (message.reply_markup) {
        payload.reply_markup = message.reply_markup;
      }

      const response = await axios.post<TelegramResponse>(`${this.baseUrl}/sendPhoto`, payload);

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
      console.error('Error sending Telegram photo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send photo';
      
      // Extract Telegram error details if available
      if (axios.isAxiosError(error) && error.response?.data?.description) {
        return {
          success: false,
          error: error.response.data.description,
        };
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async validateBotToken(): Promise<boolean> {
    try {
      if (!this.botToken) {
        return false;
      }

      const response = await axios.get(`${this.baseUrl}/getMe`, {
        timeout: 5000, // 5 second timeout
      });
      return response.data.ok;
    } catch (error: any) {
      // Only log actual errors, not network timeouts/resets
      if (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
        console.log('📡 Telegram API temporarily unavailable (network issue)');
      } else if (error.response?.status === 401) {
        console.log('🔑 Telegram bot token invalid');
      } else {
        console.error('Telegram bot token validation failed:', error.message);
      }
      return false;
    }
  }

  // Helper function to format crypto prices (remove trailing zeros)
  private formatCryptoPriceForTelegram(price: string | number): string {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    
    if (isNaN(numPrice)) {
      return '₹0';
    }
    
    // Convert to string and remove trailing zeros
    let priceStr = numPrice.toString();
    
    // If it has decimal places, remove trailing zeros
    if (priceStr.includes('.')) {
      priceStr = priceStr.replace(/0+$/, '').replace(/\.$/, '');
    }
    
    return `₹${priceStr}`;
  }

  generateTradeMessage(trade: any, template: string, includeFields: any): string {
    let message = template;

    // Replace variables with actual trade data
    if (includeFields.pair) {
      message = message.replace(/{pair}/g, trade.pair);
    }
    
    if (includeFields.price) {
      const formattedPrice = this.formatCryptoPriceForTelegram(trade.price);
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
        const formattedStopLoss = this.formatCryptoPriceForTelegram(trade.stopLossTrigger);
        message = message.replace(/{stopLoss}/g, formattedStopLoss);
      } else {
        message = message.replace(/{stopLoss}/g, 'Not Set');
      }
    }
    
    if (includeFields.takeProfit1) {
      if (trade.takeProfitTrigger) {
        const formattedTP1 = this.formatCryptoPriceForTelegram(trade.takeProfitTrigger);
        message = message.replace(/{takeProfit1}/g, formattedTP1);
      } else {
        message = message.replace(/{takeProfit1}/g, 'Not Set');
      }
    }
    
    if (includeFields.takeProfit2) {
      if (trade.takeProfit2) {
        const formattedTP2 = this.formatCryptoPriceForTelegram(trade.takeProfit2);
        message = message.replace(/{takeProfit2}/g, formattedTP2);
      } else {
        message = message.replace(/{takeProfit2}/g, 'Not Set');
      }
    }
    
    if (includeFields.takeProfit3) {
      if (trade.takeProfit3) {
        const formattedTP3 = this.formatCryptoPriceForTelegram(trade.takeProfit3);
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
