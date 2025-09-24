import { storage } from '../storage';
import { telegramService } from './telegram';
import { Trade, Automation, TelegramChannel, MessageTemplate, InsertSentMessage } from '../../shared/schema';
import * as cron from 'node-cron';
import { pnlTrackingService } from './pnlTrackingService';

export type AutomationTrigger = 
  | 'trade_registered' 
  | 'stop_loss_hit'
  | 'safebook_hit'   // V2: Consistent naming with storage layer
  | 'target_1_hit'
  | 'target_2_hit'
  | 'target_3_hit';

export class AutomationService {
  private cronTask?: any; // Store cron task for management
  private walletBalanceCron?: any; // Store wallet balance cron task
  private pnlTrackingCron?: any; // Store P&L tracking cron task
  
  /**
   * Get validated public base URL for image hosting
   * @returns Valid HTTPS base URL or null if none available
   */
  private getPublicBaseUrl(): string | null {
    const candidates = [
      process.env.PUBLIC_BASE_URL,
      process.env.REPLIT_URL,
      // Custom domain for deployed apps
      'https://trade.campusforwisdom.com',
      // Development domain (only available in dev mode)
      process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null,
      process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : null
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
   * Find original trade registration message ID for reply functionality
   * @param tradeId The trade ID to find the original message for
   * @param channelId The specific channel ID to match (prevents channel mismatch)
   * @returns Telegram message ID to reply to, or null if not found
   */
  private async getOriginalTradeMessageId(tradeId: string, channelId: string): Promise<string | null> {
    try {
      console.log(`🔍 Looking for original trade registration message for trade ${tradeId} in channel ${channelId}`);
      
      // Find sent messages for this trade in this specific channel
      const sentMessages = await storage.getSentMessages();
      
      // Filter by tradeId, channelId, and successful status
      let candidateMessages = sentMessages.filter(msg => 
        msg.tradeId === tradeId && 
        msg.channelId === channelId &&
        msg.status === 'sent' && 
        msg.telegramMessageId
      );
      
      console.log(`📋 Found ${candidateMessages.length} candidate messages for trade ${tradeId} in channel ${channelId}`);
      
      if (candidateMessages.length === 0) {
        console.log(`⚠️ No sent messages found for trade ${tradeId} in channel ${channelId}`);
        return null;
      }
      
      // Try to find trade_registered message first (with fallback logic)
      let originalMessage = null;
      
      // Method 1: Try to find message with trade_registered automation (if hydrated)
      const tradeRegisteredMessage = candidateMessages.find(msg => 
        msg.automation?.triggerType === 'trade_registered'
      );
      
      if (tradeRegisteredMessage) {
        originalMessage = tradeRegisteredMessage;
        console.log(`✅ Found trade_registered message via automation relation: ${originalMessage.telegramMessageId}`);
      } else {
        console.log(`⚠️ No trade_registered message found via automation relation, using fallback logic`);
        
        // Method 2: Fallback - pick the earliest message by sentAt timestamp
        // Sort by sentAt ascending to get the first (earliest) message sent for this trade
        candidateMessages.sort((a, b) => {
          const dateA = new Date(a.sentAt || 0).getTime();
          const dateB = new Date(b.sentAt || 0).getTime();
          return dateA - dateB;
        });
        
        originalMessage = candidateMessages[0];
        console.log(`✅ Using earliest message as fallback: ${originalMessage.telegramMessageId} (sent at ${originalMessage.sentAt})`);
      }
      
      return originalMessage?.telegramMessageId || null;
      
    } catch (error) {
      console.error(`❌ Error finding original trade message for ${tradeId} in channel ${channelId}:`, error);
      return null;
    }
  }

  /**
   * Comprehensive reply error detection for all Telegram variants
   * @param error The error message from Telegram API
   * @returns True if this is a reply-related error
   */
  private isReplyError(error?: string): boolean {
    if (!error) return false;
    
    const replyErrorPatterns = [
      // Direct text matches (case-insensitive)
      'replied message not found',
      'reply message not found',
      'message to reply not found',
      'REPLY_MESSAGE_NOT_FOUND',
      'MESSAGE_ID_INVALID',
      'Bad Request: reply message not found',
      'Bad Request: message to reply not found',
      // HTTP 400 status with reply context
      'Bad Request: invalid message ID',
      'Bad Request: REPLY_MESSAGE_NOT_FOUND',
      // Numeric error codes
      '400: Bad Request',
      // Additional Telegram error variants
      'invalid message id to reply',
      'replied message is deleted',
      'message_id_invalid',
      'reply_message_not_found'
    ];
    
    const errorLower = error.toLowerCase();
    return replyErrorPatterns.some(pattern => 
      errorLower.includes(pattern.toLowerCase())
    );
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
      
      // Check if this is a reply-type trigger (target hits, stop loss, safebook)
      const isReplyTrigger = ['stop_loss_hit', 'safebook_hit', 'target_1_hit', 'target_2_hit', 'target_3_hit'].includes(trigger);
      let originalMessageId: string | null = null;
      
      if (isReplyTrigger) {
        // For reply triggers, try to find the original trade registration message
        originalMessageId = await this.getOriginalTradeMessageId(trade.id, channel.channelId);
        
        if (originalMessageId) {
          console.log(`💬 Will reply to original message ID: ${originalMessageId}`);
        } else {
          console.log(`⚠️ Cannot find original trade registration message for ${trade.tradeId} in channel ${channel.name}`);
          console.log(`📤 Will send as new message instead of reply to ensure notification is not missed`);
        }
      }
      
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
          
          // Add reply functionality for target/stop loss triggers
          if (isReplyTrigger && originalMessageId) {
            photoMessageOptions.reply_to_message_id = originalMessageId;
            photoMessageOptions.allow_sending_without_reply = true; // Better resilience
          }
          
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
        
        // Add reply functionality for target/stop loss triggers
        if (isReplyTrigger && originalMessageId) {
          textOptions.reply_to_message_id = originalMessageId;
          textOptions.allow_sending_without_reply = true; // Better resilience
        }
        
        // Add inline keyboard if template has buttons
        if (template.buttons && Array.isArray(template.buttons) && template.buttons.length > 0) {
          textOptions.reply_markup = {
            inline_keyboard: this.renderButtons(template.buttons, trade)
          };
        }
        
        return textOptions;
      };

      // Send message to Telegram with runtime fallback handling and reply resilience
      let finalResult: any = null;
      let messageType = 'text';
      let wasReplyAttempted = false;
      
      try {
        if (shouldTryPhoto && photoMessageOptions) {
          // First attempt: Send as photo message
          console.log(`📸 Attempting to send photo message to ${channel.name}`);
          wasReplyAttempted = !!(isReplyTrigger && originalMessageId && photoMessageOptions.reply_to_message_id);
          
          const photoResult = await telegramService.sendMessage(channel.channelId, photoMessageOptions);
          
          if (photoResult.success && photoResult.messageId) {
            // Photo message succeeded
            finalResult = photoResult;
            messageType = 'photo';
            console.log(`✅ Photo message sent successfully to ${channel.name} (Message ID: ${photoResult.messageId})`);
            
          } else {
            // Photo message failed - check if it's a reply failure
            const isReplyFailure = wasReplyAttempted && this.isReplyError(photoResult.error);
            
            if (isReplyFailure) {
              console.log(`⚠️ Photo reply failed (${photoResult.error}), retrying without reply`);
              
              // Remove reply and try again
              const photoOptionsNoReply = { ...photoMessageOptions };
              delete photoOptionsNoReply.reply_to_message_id;
              
              const photoRetryResult = await telegramService.sendMessage(channel.channelId, photoOptionsNoReply);
              
              if (photoRetryResult.success && photoRetryResult.messageId) {
                finalResult = photoRetryResult;
                messageType = 'photo_no_reply';
                console.log(`✅ Photo message sent successfully without reply to ${channel.name} (Message ID: ${photoRetryResult.messageId})`);
              } else {
                // Still failed, fall back to text
                console.log(`⚠️ Photo retry failed (${photoRetryResult.error}), falling back to text message`);
                const textOptions = createTextMessage(true); // Include image link
                delete textOptions.reply_to_message_id; // Don't attempt reply again
                
                const textResult = await telegramService.sendMessage(channel.channelId, textOptions);
                finalResult = textResult;
                messageType = 'text_fallback_no_reply';
                
                if (textResult.success && textResult.messageId) {
                  console.log(`✅ Fallback text message sent successfully to ${channel.name} (Message ID: ${textResult.messageId})`);
                } else {
                  console.error(`❌ All photo fallbacks failed for ${channel.name}: ${textResult.error}`);
                }
              }
            } else {
              // Non-reply failure - immediate fallback to text with image link
              console.log(`⚠️ Photo message failed (${photoResult.error}), falling back to text message with image link`);
              
              const textOptions = createTextMessage(true); // Include image link
              const textResult = await telegramService.sendMessage(channel.channelId, textOptions);
              
              if (textResult.success && textResult.messageId) {
                finalResult = textResult;
                messageType = 'text_fallback';
                console.log(`✅ Fallback text message sent successfully to ${channel.name} (Message ID: ${textResult.messageId})`);
              } else {
                // CRITICAL FIX: Check if text fallback failed due to reply error
                const wasTextReplyAttempted = !!(isReplyTrigger && originalMessageId && textOptions.reply_to_message_id);
                const isTextReplyFailure = wasTextReplyAttempted && this.isReplyError(textResult.error);
                
                if (isTextReplyFailure) {
                  console.log(`⚠️ Text fallback reply failed (${textResult.error}), retrying without reply`);
                  
                  // Remove reply and try text message again
                  const textOptionsNoReply = createTextMessage(true); // Include image link
                  delete textOptionsNoReply.reply_to_message_id;
                  delete textOptionsNoReply.allow_sending_without_reply;
                  
                  const textRetryResult = await telegramService.sendMessage(channel.channelId, textOptionsNoReply);
                  
                  if (textRetryResult.success && textRetryResult.messageId) {
                    finalResult = textRetryResult;
                    messageType = 'text_fallback_no_reply';
                    console.log(`✅ Text fallback sent successfully without reply to ${channel.name} (Message ID: ${textRetryResult.messageId})`);
                  } else {
                    finalResult = textRetryResult;
                    console.error(`❌ All fallbacks failed for ${channel.name}: ${textRetryResult.error}`);
                  }
                } else {
                  // Non-reply text failure
                  finalResult = textResult;
                  console.error(`❌ Both photo and text fallback failed for ${channel.name}: ${textResult.error}`);
                }
              }
            }
          }
        } else {
          // Send as regular text message (no photo attempted)
          console.log(`📝 Sending text message to ${channel.name}`);
          wasReplyAttempted = !!(isReplyTrigger && originalMessageId);
          
          const textOptions = createTextMessage(false); // No image link needed
          const textResult = await telegramService.sendMessage(channel.channelId, textOptions);
          
          if (textResult.success && textResult.messageId) {
            finalResult = textResult;
            messageType = 'text';
            console.log(`✅ Text message sent successfully to ${channel.name} (Message ID: ${textResult.messageId})`);
          } else {
            // Check if it's a reply failure
            const isReplyFailure = wasReplyAttempted && this.isReplyError(textResult.error);
            
            if (isReplyFailure) {
              console.log(`⚠️ Text reply failed (${textResult.error}), retrying without reply`);
              
              // Remove reply and try again
              const textOptionsNoReply = createTextMessage(false);
              delete textOptionsNoReply.reply_to_message_id;
              
              const textRetryResult = await telegramService.sendMessage(channel.channelId, textOptionsNoReply);
              
              if (textRetryResult.success && textRetryResult.messageId) {
                finalResult = textRetryResult;
                messageType = 'text_no_reply';
                console.log(`✅ Text message sent successfully without reply to ${channel.name} (Message ID: ${textRetryResult.messageId})`);
              } else {
                finalResult = textRetryResult;
                console.error(`❌ Text retry also failed for ${channel.name}: ${textRetryResult.error}`);
              }
            } else {
              finalResult = textResult;
              console.error(`❌ Text message failed for ${channel.name}: ${textResult.error}`);
            }
          }
        }
        
        // Record the final result in database
        if (finalResult && finalResult.success && finalResult.messageId) {
          await storage.logSentMessage({
            automationId: automation.id,
            tradeId: trade.id,
            channelId: channel.channelId,
            telegramMessageId: finalResult.messageId,
            replyToMessageId: isReplyTrigger ? originalMessageId : undefined,
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
            replyToMessageId: isReplyTrigger ? originalMessageId : undefined,
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
          replyToMessageId: isReplyTrigger ? originalMessageId : undefined,
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

  /**
   * Initialize time-based scheduler for simple automations
   */
  initializeScheduler() {
    try {
      // Stop existing task if any
      if (this.cronTask) {
        this.cronTask.stop();
        console.log('🔄 Stopping existing cron task');
      }

      // Run every minute to check for scheduled automations
      this.cronTask = cron.schedule('* * * * *', async () => {
        const kolkataTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
        console.log(`⏰ Cron tick at ${kolkataTime} - checking scheduled automations`);
        
        try {
          await this.executeScheduledAutomations();
        } catch (error) {
          console.error('❌ Error executing scheduled automations:', error);
        }
      }, {
        timezone: 'Asia/Kolkata'
      });

      // Explicitly start the task
      this.cronTask.start();
      
      console.log('🕒 Time-based scheduler initialized and started (Kolkata timezone)');

      // Add a separate 60-second cron job for wallet balance updates
      this.walletBalanceCron = cron.schedule('* * * * *', async () => {
        try {
          await this.updateAllWalletBalances();
        } catch (error) {
          console.error('❌ Error in automatic wallet balance update:', error);
        }
      }, {
        timezone: 'Asia/Kolkata'
      });

      // Start the wallet balance update cron
      this.walletBalanceCron.start();
      console.log('💰 60-second wallet balance auto-update initialized and started');

      // Add P&L tracking cron job - runs every 5 minutes
      this.pnlTrackingCron = cron.schedule('*/5 * * * *', async () => {
        try {
          console.log('📊 Starting scheduled P&L update...');
          const result = await pnlTrackingService.updateAllCopyTradesPnL();
          console.log(`✅ Scheduled P&L update completed: ${result.success} success, ${result.errors} errors`);
        } catch (error) {
          console.error('❌ Error in automatic P&L update:', error);
        }
      }, {
        timezone: 'Asia/Kolkata'
      });

      // Start the P&L tracking cron
      this.pnlTrackingCron.start();
      console.log('📊 5-minute P&L tracking auto-update initialized and started');
      
    } catch (error) {
      console.error('❌ Error initializing scheduler:', error);
    }
  }

  /**
   * Execute scheduled simple message automations
   */
  private async executeScheduledAutomations() {
    console.log('▶ executeScheduledAutomations() starting');
    try {
      // Get current time and day in Kolkata timezone
      const now = new Date();
      // Convert current UTC time to match database format (UTC)
      const kolkataTime = now.toTimeString().slice(0, 5); // UTC HH:MM format
      const kolkataDay = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long'
      }).format(now).toLowerCase();

      // Get all active simple automations that should trigger at this time
      const automations = await storage.getAutomations();
      
      const scheduledAutomations = automations.filter(automation => {
        const isMatch = automation.isActive && 
          automation.automationType === 'simple' &&
          automation.triggerType === 'scheduled' &&
          automation.scheduledTime === kolkataTime &&
          automation.scheduledDays?.includes(kolkataDay);
          
        
        return isMatch;
      });

      if (scheduledAutomations.length > 0) {
        console.log(`⏰ Found ${scheduledAutomations.length} scheduled automation(s) for ${kolkataTime} on ${kolkataDay}`);
      }

      // Execute each scheduled automation
      for (const automation of scheduledAutomations) {
        try {
          await this.executeSimpleAutomation(automation);
        } catch (error) {
          console.error(`❌ Error executing automation ${automation.name}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error in executeScheduledAutomations:', error);
    }
  }

  /**
   * Execute a simple message automation (no trade data)
   */
  private async executeSimpleAutomation(automation: Automation) {
    try {
      console.log(`🤖 Executing simple automation: ${automation.name}`);

      // Get the template and channel
      const template = await storage.getMessageTemplate(automation.templateId);
      const channel = await storage.getTelegramChannel(automation.channelId);

      if (!template) {
        console.error(`❌ Template not found for automation ${automation.name}`);
        return;
      }

      if (!channel) {
        console.error(`❌ Channel not found for automation ${automation.name}`);
        return;
      }

      // For simple templates, no variable substitution needed - use template as-is
      const messageText = template.template;

      // Process inline buttons (no variable substitution for simple templates)
      const processedButtons = this.processSimpleButtons((template.buttons as any[][]) || []);

      // Convert image URL if present
      const imageUrl = template.imageUrl ? this.convertToAbsoluteUrl(template.imageUrl || '') : undefined;

      // Send message to Telegram
      const telegramMessage = {
        text: messageText,
        parse_mode: template.parseMode as 'HTML' | 'Markdown',
        reply_markup: processedButtons.length > 0 ? { inline_keyboard: processedButtons } : undefined
      };
      
      const telegramResult = imageUrl 
        ? await telegramService.sendMessage(channel.channelId, { ...telegramMessage, photo: imageUrl })
        : await telegramService.sendMessage(channel.channelId, telegramMessage);

      // Track sent message
      const sentMessageData: InsertSentMessage = {
        automationId: automation.id,
        tradeId: null, // No trade for simple automations
        telegramMessageId: telegramResult?.messageId?.toString(),
        channelId: channel.channelId,
        messageText: messageText,
        status: 'sent',
        sentAt: new Date(),
      };

      await storage.logSentMessage(sentMessageData);

      console.log(`✅ Simple automation executed successfully: ${automation.name}`);
    } catch (error) {
      console.error(`❌ Error executing simple automation ${automation.name}:`, error);
      
      // Track failed message
      try {
        const sentMessageData: InsertSentMessage = {
          automationId: automation.id,
          tradeId: null,
          telegramMessageId: null,
          channelId: automation.channelId,
          messageText: null,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          sentAt: new Date(),
        };

        await storage.logSentMessage(sentMessageData);
      } catch (trackingError) {
        console.error('❌ Error tracking failed simple automation:', trackingError);
      }
    }
  }

  /**
   * Process inline buttons for simple templates (no variable substitution)
   */
  private processSimpleButtons(buttons: any[][]): any[][] {
    if (!buttons || !Array.isArray(buttons) || buttons.length === 0) {
      return [];
    }

    return buttons.map(row => {
      if (!Array.isArray(row)) return [];
      
      return row.map(button => {
        if (!button || typeof button !== 'object') return null;
        
        const buttonText = button.text || '';
        const buttonUrl = button.url || '';
        const callbackData = button.callback_data || '';
        
        const renderedButton: any = { text: buttonText };
        
        if (button.url) {
          renderedButton.url = buttonUrl;
        } else if (button.callback_data) {
          renderedButton.callback_data = callbackData;
        }
        
        return renderedButton;
      }).filter(Boolean);
    }).filter(row => row.length > 0);
  }

  /**
   * Update wallet balances for all copy trading users automatically
   */
  async updateAllWalletBalances(): Promise<void> {
    try {
      console.log('💰 Starting automatic wallet balance update for all users...');
      
      // Get all copy trading users
      const users = await storage.getCopyTradingUsers();
      
      if (users.length === 0) {
        console.log('ℹ️ No copy trading users found for wallet balance update');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      // Process each user's wallet balance
      await Promise.allSettled(
        users.map(async (user) => {
          try {
            // Import coindcx and encryption services
            const { CoinDCXService } = await import('./coindcx');
            const { safeDecrypt } = await import('../utils/encryption');
            
            // Decrypt API credentials
            const apiKey = safeDecrypt(user.apiKey);
            const apiSecret = safeDecrypt(user.apiSecret);
            
            if (!apiKey || !apiSecret) {
              console.warn(`⚠️ Failed to decrypt credentials for user ${user.name}`);
              errorCount++;
              return;
            }

            // Create CoinDCX service instance
            const coindcxService = new CoinDCXService();
            const walletResult = await coindcxService.getFuturesWalletBalance(apiKey, apiSecret);
            
            if (walletResult.success && walletResult.balance) {
              // Extract USDT balance
              const usdtWallet = walletResult.balance.find((wallet: any) => wallet.currency_short_name === 'USDT');
              const usdtBalance = usdtWallet ? parseFloat(usdtWallet.balance || '0') : 0;
              
              // Update wallet balance in database
              await storage.updateCopyTradingUserWalletBalance(user.id, usdtBalance);
              console.log(`✅ Updated wallet balance for ${user.name}: ${usdtBalance} USDT`);
              successCount++;
            } else {
              console.warn(`⚠️ Failed to fetch wallet balance for ${user.name}: ${walletResult.message}`);
              errorCount++;
            }
          } catch (error) {
            console.error(`❌ Error updating wallet balance for user ${user.name}:`, error);
            errorCount++;
          }
        })
      );

      console.log(`💰 Wallet balance update completed: ${successCount} success, ${errorCount} errors`);
    } catch (error) {
      console.error('❌ Error in automatic wallet balance update:', error);
    }
  }
}

export const automationService = new AutomationService();