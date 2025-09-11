import { storage } from '../storage';
import { telegramService } from './telegram';
import { Trade, Automation, TelegramChannel, MessageTemplate, InsertSentMessage } from '../../shared/schema';

export type AutomationTrigger = 'trade_registered' | 'trade_completed';

export class AutomationService {
  
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
      
      // Prepare message options with buttons if available
      const messageOptions: any = {
        text: messageText,
        parse_mode: template.parseMode || 'HTML',
        disable_web_page_preview: true
      };

      // Add inline keyboard if template has buttons
      if (template.buttons && Array.isArray(template.buttons) && template.buttons.length > 0) {
        messageOptions.reply_markup = {
          inline_keyboard: this.renderButtons(template.buttons, trade)
        };
      }

      // Send message to Telegram with exception handling
      try {
        const result = await telegramService.sendMessage(channel.channelId, messageOptions);
        
        // Record the result in database (both success and failure)
        if (result.success && result.messageId) {
          await storage.logSentMessage({
            automationId: automation.id,
            tradeId: trade.id,
            channelId: channel.channelId,
            telegramMessageId: result.messageId,
            messageText: messageText,
            status: 'sent',
            sentAt: new Date()
          });
          
          console.log(`✅ Message sent successfully to ${channel.name} (Message ID: ${result.messageId})`);
        } else {
          // Log failed messages to database for debugging
          await storage.logSentMessage({
            automationId: automation.id,
            tradeId: trade.id,
            channelId: channel.channelId,
            messageText: messageText,
            status: 'failed',
            errorMessage: result.error || 'Unknown error',
            sentAt: new Date()
          });
          
          console.error(`❌ Failed to send message to ${channel.name}: ${result.error}`);
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