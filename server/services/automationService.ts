import { storage } from '../storage';
import { telegramService } from './telegram';
import { Trade, Automation, TelegramChannel, MessageTemplate, InsertSentMessage } from '../../shared/schema';

export type AutomationTrigger = 'trade_registered' | 'trade_completed';

export class AutomationService {
  
  /**
   * Get validated public base URL for image hosting
   * @returns Valid HTTPS base URL or null if none available
   */
  private getPublicBaseUrl(): string | null {
    const candidates = [
      process.env.PUBLIC_BASE_URL,
      process.env.REPLIT_URL
    ].filter(Boolean);
    
    for (const candidate of candidates) {
      try {
        const url = new URL(candidate as string);
        
        // Must be HTTPS for production reliability
        if (url.protocol !== 'https:') {
          console.log(`⚠️ Skipping non-HTTPS URL: ${candidate}`);
          continue;
        }
        
        // Skip localhost/127.0.0.1 for production deployment
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          console.log(`⚠️ Skipping localhost URL: ${candidate}`);
          continue;
        }
        
        // Valid URL found
        console.log(`✅ Using validated base URL: ${candidate}`);
        return candidate as string;
        
      } catch (error) {
        console.log(`⚠️ Invalid URL candidate '${candidate}':`, error);
        continue;
      }
    }
    
    console.log(`❌ No valid public base URL found in environment variables`);
    return null;
  }
  
  /**
   * Convert relative image URLs to absolute URLs for Telegram API
   * @param imageUrl The image URL (relative or absolute)
   * @returns Absolute URL or null if conversion fails
   */
  private convertToAbsoluteUrl(imageUrl: string): string | null {
    try {
      // If already absolute URL, validate and return
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        try {
          const url = new URL(imageUrl);
          console.log(`🔗 Using absolute URL: ${imageUrl}`);
          return imageUrl;
        } catch (error) {
          console.error(`❌ Invalid absolute URL '${imageUrl}':`, error);
          return null;
        }
      }
      
      // Get validated base URL
      const baseUrl = this.getPublicBaseUrl();
      if (!baseUrl) {
        console.log(`⚠️ Cannot convert relative URL '${imageUrl}' - no valid base URL available`);
        return null;
      }
      
      // Use URL constructor for safe URL construction
      try {
        const absoluteUrl = new URL(imageUrl, baseUrl).href;
        console.log(`🔄 Converting relative URL '${imageUrl}' to absolute: ${absoluteUrl}`);
        return absoluteUrl;
      } catch (error) {
        console.error(`❌ Failed to construct URL from base '${baseUrl}' and path '${imageUrl}':`, error);
        return null;
      }
      
    } catch (error) {
      console.error(`❌ Failed to convert image URL '${imageUrl}' to absolute:`, error);
      return null;
    }
  }
  
  /**
   * Trigger automation for a trade event
   * @param trade The trade that triggered the automation
   * @param trigger The type of trigger (trade_registered/trade_completed)
   */
  async triggerAutomations(trade: Trade, trigger: AutomationTrigger): Promise<void> {
    try {
      console.log(`🤖 Checking automations for trigger: ${trigger}, trade: ${trade.tradeId}`);
      
      // Find all active automations for this trigger type
      const automations = await storage.getAutomations();
      const matchingAutomations = automations.filter(automation => 
        automation.isActive && 
        automation.triggerType === trigger
      );
      
      console.log(`📋 Found ${matchingAutomations.length} matching automations for ${trigger}`);
      
      if (matchingAutomations.length === 0) {
        console.log(`⚠️  No active automations found for trigger: ${trigger}`);
        return;
      }
      
      // Process each matching automation
      for (const automation of matchingAutomations) {
        await this.processAutomation(automation, trade, trigger);
      }
      
      console.log(`✅ All automations processed for trade ${trade.tradeId}`);
      
    } catch (error) {
      console.error(`❌ Error triggering automations for trade ${trade.tradeId}:`, error);
    }
  }
  
  /**
   * Process a single automation - send message to channel using template
   */
  private async processAutomation(automation: Automation, trade: Trade, trigger: AutomationTrigger): Promise<void> {
    try {
      // Get channel and template details
      const [channel, template] = await Promise.all([
        storage.getTelegramChannel(automation.channelId),
        storage.getMessageTemplate(automation.templateId)
      ]);
      
      if (!channel || !channel.isActive) {
        console.log(`⚠️  Channel not found or inactive for automation ${automation.id}`);
        return;
      }
      
      if (!template || !template.isActive) {
        console.log(`⚠️  Template not found or inactive for automation ${automation.id}`);
        return;
      }
      
      console.log(`📤 Processing automation: ${automation.name} -> Channel: ${channel.name}, Template: ${template.name}`);
      
      // Generate message from template with trade data
      const messageText = this.renderTemplate(template, trade);
      
      if (!messageText.trim()) {
        console.log(`⚠️  Empty message generated for automation ${automation.id}, skipping`);
        return;
      }
      
      // Prepare message options - determine if we should try photo or text first
      let shouldTryPhoto = false;
      let absoluteImageUrl: string | null = null;
      let photoMessageOptions: any = null;
      
      if (template.imageUrl && template.imageUrl.trim()) {
        // Convert relative URLs to absolute URLs for Telegram API
        absoluteImageUrl = this.convertToAbsoluteUrl(template.imageUrl.trim());
        
        // Check caption length limit (1024 chars for Telegram)
        const maxCaptionLength = 1024;
        const isMessageTooLong = messageText.length > maxCaptionLength;
        
        if (absoluteImageUrl && !isMessageTooLong) {
          shouldTryPhoto = true;
          photoMessageOptions = {
            photo: absoluteImageUrl,
            caption: messageText,
            parse_mode: template.parseMode || 'HTML'
          };
          
          // Add inline keyboard if template has buttons
          if (template.buttons && Array.isArray(template.buttons) && template.buttons.length > 0) {
            photoMessageOptions.reply_markup = {
              inline_keyboard: this.renderButtons(template.buttons, trade)
            };
          }
          
          console.log(`📸 Will attempt photo message with URL: ${absoluteImageUrl.substring(0, 60)}...`);
        } else {
          // Log why we can't send as photo
          if (!absoluteImageUrl) {
            console.log(`⚠️ Cannot send as photo - URL conversion failed for '${template.imageUrl}'`);
          }
          if (isMessageTooLong) {
            console.log(`⚠️ Cannot send as photo - caption too long (${messageText.length}/${maxCaptionLength} chars)`);
          }
        }
      }
      
      // Helper function to create text message with optional image link
      const createTextMessage = (includeImageLink: boolean = false): any => {
        let textContent = messageText;
        
        // Add image link if photo sending failed and we have a valid URL
        if (includeImageLink && absoluteImageUrl) {
          textContent += `\n\n📷 <a href="${absoluteImageUrl}">View Image</a>`;
        }
        
        const textOptions: any = {
          text: textContent,
          parse_mode: template.parseMode || 'HTML',
          disable_web_page_preview: !includeImageLink // Enable preview if we include image link
        };
        
        // Add inline keyboard if template has buttons
        if (template.buttons && Array.isArray(template.buttons) && template.buttons.length > 0) {
          textOptions.reply_markup = {
            inline_keyboard: this.renderButtons(template.buttons, trade)
          };
        }
        
        return textOptions;
      };

      // Send message to Telegram with runtime fallback handling
      let finalResult: any = null;
      let messageType = 'text';
      
      try {
        if (shouldTryPhoto && photoMessageOptions) {
          // First attempt: Send as photo message
          console.log(`📸 Attempting to send photo message to ${channel.name}`);
          const photoResult = await telegramService.sendMessage(channel.channelId, photoMessageOptions);
          
          if (photoResult.success && photoResult.messageId) {
            // Photo message succeeded
            finalResult = photoResult;
            messageType = 'photo';
            console.log(`✅ Photo message sent successfully to ${channel.name} (Message ID: ${photoResult.messageId})`);
            
          } else {
            // Photo message failed - immediate fallback to text with image link
            console.log(`⚠️ Photo message failed (${photoResult.error}), falling back to text message with image link`);
            
            const textOptions = createTextMessage(true); // Include image link
            const textResult = await telegramService.sendMessage(channel.channelId, textOptions);
            
            finalResult = textResult;
            messageType = 'text_fallback';
            
            if (textResult.success && textResult.messageId) {
              console.log(`✅ Fallback text message sent successfully to ${channel.name} (Message ID: ${textResult.messageId})`);
            } else {
              console.error(`❌ Both photo and text fallback failed for ${channel.name}: ${textResult.error}`);
            }
          }
        } else {
          // Send as regular text message (no photo attempted)
          console.log(`📝 Sending text message to ${channel.name}`);
          const textOptions = createTextMessage(false); // No image link needed
          const textResult = await telegramService.sendMessage(channel.channelId, textOptions);
          
          finalResult = textResult;
          messageType = 'text';
          
          if (textResult.success && textResult.messageId) {
            console.log(`✅ Text message sent successfully to ${channel.name} (Message ID: ${textResult.messageId})`);
          } else {
            console.error(`❌ Text message failed for ${channel.name}: ${textResult.error}`);
          }
        }
        
        // Record the final result in database
        if (finalResult && finalResult.success && finalResult.messageId) {
          await storage.logSentMessage({
            automationId: automation.id,
            tradeId: trade.id,
            channelId: channel.channelId,
            telegramMessageId: finalResult.messageId,
            messageText: messageText + (messageType === 'text_fallback' ? ' [sent with image link fallback]' : ''),
            status: 'sent',
            sentAt: new Date()
          });
        } else {
          // Log failed messages to database for debugging
          await storage.logSentMessage({
            automationId: automation.id,
            tradeId: trade.id,
            channelId: channel.channelId,
            messageText: messageText,
            status: 'failed',
            errorMessage: finalResult?.error || 'Unknown error',
            sentAt: new Date()
          });
        }
        
      } catch (error) {
        // Handle thrown exceptions (network errors, 429 rate limits, etc.)
        await storage.logSentMessage({
          automationId: automation.id,
          tradeId: trade.id,
          channelId: channel.channelId,
          messageText: messageText,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Network or API error',
          sentAt: new Date()
        });
        
        console.error(`❌ Exception sending message to ${channel.name}:`, error);
      }
      
    } catch (error) {
      console.error(`❌ Error processing automation ${automation.id}:`, error);
    }
  }
  
  /**
   * Render template with trade data - substitute variables like {pair}, {price}, etc.
   */
  private renderTemplate(template: MessageTemplate, trade: Trade): string {
    let messageText = template.template;
    
    // HTML escape function for user-provided content
    const htmlEscape = (text: string): string => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };
    
    // Define available variables and their values (with HTML escaping for all string content)
    const variables: Record<string, string> = {
      'pair': htmlEscape(trade.pair || ''),
      'type': htmlEscape(trade.type || ''),
      'price': trade.price ? `$${Number(trade.price).toFixed(4)}` : '',
      'total': trade.total ? Number(trade.total).toFixed(4) : '',
      'leverage': trade.leverage ? `${trade.leverage}x` : '',
      'status': htmlEscape(trade.status || ''),
      'tradeId': htmlEscape(trade.tradeId || ''),
      'timestamp': trade.createdAt ? new Date(trade.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
      'fee': trade.fee ? `$${Number(trade.fee).toFixed(4)}` : '$0.00',
      'stopLoss': trade.stopLossTrigger ? `$${Number(trade.stopLossTrigger).toFixed(4)}` : '',
      'takeProfit1': trade.takeProfitTrigger ? `$${Number(trade.takeProfitTrigger).toFixed(4)}` : '',
      'takeProfit2': trade.takeProfit2 ? `$${Number(trade.takeProfit2).toFixed(4)}` : '',
      'takeProfit3': trade.takeProfit3 ? `$${Number(trade.takeProfit3).toFixed(4)}` : '',
      'safebookPrice': trade.safebookPrice ? `$${Number(trade.safebookPrice).toFixed(4)}` : '',
      'notes': htmlEscape(trade.notes || '') // HTML escape user notes
    };
    
    // Filter variables based on template's includeFields setting
    if (template.includeFields && Array.isArray(template.includeFields) && template.includeFields.length > 0) {
      // Only include specified fields
      const filteredVariables: Record<string, string> = {};
      for (const field of template.includeFields as string[]) {
        if (variables[field] !== undefined) {
          filteredVariables[field] = variables[field];
        }
      }
      // Replace variables with filtered set
      for (const [key, value] of Object.entries(filteredVariables)) {
        const placeholder = `{${key}}`;
        messageText = messageText.replace(new RegExp(placeholder, 'g'), value);
      }
    } else {
      // Include all variables (default behavior)
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{${key}}`;
        messageText = messageText.replace(new RegExp(placeholder, 'g'), value);
      }
    }
    
    // Remove only known unreplaced placeholders to avoid artifacts
    const knownPlaceholders = Object.keys(variables).map(key => `{${key}}`);
    for (const placeholder of knownPlaceholders) {
      // Remove any remaining instances of known placeholders that weren't replaced
      messageText = messageText.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), '');
    }
    
    return messageText;
  }

  /**
   * Render inline keyboard buttons with variable substitution
   */
  private renderButtons(buttons: any[], trade: Trade): any[][] {
    const variables = this.getVariables(trade);
    
    return buttons.map((row: any[]) => {
      return row.map((button: any) => {
        let buttonText = button.text || '';
        let buttonUrl = button.url || '';
        let callbackData = button.callback_data || '';
        
        // Replace variables in button text
        for (const [key, value] of Object.entries(variables)) {
          const placeholder = `{${key}}`;
          buttonText = buttonText.replace(new RegExp(placeholder, 'g'), value);
          if (buttonUrl) {
            buttonUrl = buttonUrl.replace(new RegExp(placeholder, 'g'), value);
          }
          if (callbackData) {
            callbackData = callbackData.replace(new RegExp(placeholder, 'g'), value);
          }
        }
        
        const renderedButton: any = { text: buttonText };
        
        if (button.url) {
          renderedButton.url = buttonUrl;
        } else if (button.callback_data) {
          renderedButton.callback_data = callbackData;
        }
        
        return renderedButton;
      });
    });
  }

  /**
   * Get variables for substitution (shared by template and buttons)
   */
  private getVariables(trade: Trade): Record<string, string> {
    const htmlEscape = (text: string): string => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };
    
    return {
      'pair': htmlEscape(trade.pair || ''),
      'type': htmlEscape(trade.type || ''),
      'price': trade.price ? `$${Number(trade.price).toFixed(4)}` : '',
      'total': trade.total ? Number(trade.total).toFixed(4) : '',
      'leverage': trade.leverage ? `${trade.leverage}x` : '',
      'status': htmlEscape(trade.status || ''),
      'tradeId': htmlEscape(trade.tradeId || ''),
      'timestamp': trade.createdAt ? new Date(trade.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
      'fee': trade.fee ? `$${Number(trade.fee).toFixed(4)}` : '$0.00',
      'stopLoss': trade.stopLossTrigger ? `$${Number(trade.stopLossTrigger).toFixed(4)}` : '',
      'takeProfit1': trade.takeProfitTrigger ? `$${Number(trade.takeProfitTrigger).toFixed(4)}` : '',
      'takeProfit2': trade.takeProfit2 ? `$${Number(trade.takeProfit2).toFixed(4)}` : '',
      'takeProfit3': trade.takeProfit3 ? `$${Number(trade.takeProfit3).toFixed(4)}` : '',
      'safebookPrice': trade.safebookPrice ? `$${Number(trade.safebookPrice).toFixed(4)}` : '',
      'notes': htmlEscape(trade.notes || '')
    };
  }
}

export const automationService = new AutomationService();