import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { tradeMonitor } from "./services/tradeMonitor";
import { telegramService } from "./services/telegram";
import { coindcxService } from "./services/coindcx";
import { automationService } from "./services/automationService";
import { insertTelegramChannelSchema, insertMessageTemplateSchema, registerSchema, loginSchema, completeTradeSchema, updateSafebookSchema, insertAutomationSchema, updateTradeSchema, User, uploadUrlRequestSchema, finalizeImageUploadSchema } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize time-based scheduler for simple automations
  automationService.initializeScheduler();
  
  // Auth middleware
  setupAuth(app);

  // Validation middleware for auth routes
  app.use('/api/register', (req, res, next) => {
    try {
      registerSchema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({ message: "Validation failed", errors: error });
    }
  });

  app.use('/api/login', (req, res, next) => {
    try {
      loginSchema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({ message: "Validation failed", errors: error });
    }
  });

  // Trade routes
  app.get('/api/trades', isAuthenticated, async (req, res) => {
    try {
      const { status, channelId, search, page = '1', limit = '50' } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const result = await storage.getTrades({
        status: status as string,
        channelId: channelId as string,
        search: search as string,
        limit: parseInt(limit as string),
        offset,
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  app.get('/api/trades/stats', isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getTradeStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching trade stats:", error);
      res.status(500).json({ message: "Failed to fetch trade statistics" });
    }
  });

  app.get('/api/trades/:id', isAuthenticated, async (req, res) => {
    try {
      const trade = await storage.getTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }
      res.json(trade);
    } catch (error) {
      console.error("Error fetching trade:", error);
      res.status(500).json({ message: "Failed to fetch trade" });
    }
  });

  app.patch('/api/trades/:id/complete', isAuthenticated, async (req, res) => {
    try {
      // Parse and validate request body first
      const completionData = completeTradeSchema.parse(req.body);
      
      const trade = await storage.getTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      if (trade.status !== 'active') {
        return res.status(400).json({ message: "Only active trades can be completed" });
      }

      const updatedTrade = await storage.completeTrade(trade.id, completionData);
      if (!updatedTrade) {
        return res.status(500).json({ message: "Failed to complete trade" });
      }
      
      // Manual completion should NOT trigger automations
      // Only target status updates should trigger automations
      
      res.json(updatedTrade);
    } catch (error) {
      console.error("Error completing trade:", error);
      
      // Handle Zod validation errors
      if (error && typeof error === 'object' && 'issues' in error) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.issues 
        });
      }
      
      res.status(500).json({ message: "Failed to complete trade" });
    }
  });

  // Endpoint to update target status (for all 5 target types) - V2 with 5-field support
  app.patch('/api/trades/:id/target-status', isAuthenticated, async (req, res) => {
    try {
      const { targetType, hit } = req.body;
      
      // Validate input - supports 4 target types (safebook has dedicated route with price)
      const validTargets = ['stop_loss', 'target_1', 'target_2', 'target_3'];
      if (!validTargets.includes(targetType)) {
        return res.status(400).json({ 
          message: `Invalid target type. Must be one of: ${validTargets.join(', ')}. Use /safebook endpoint for safebook updates.` 
        });
      }
      
      if (typeof hit !== 'boolean') {
        return res.status(400).json({ message: "Hit must be a boolean value" });
      }

      const trade = await storage.getTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      if (trade.status !== 'active') {
        return res.status(400).json({ message: "Only active trades can have target status updated" });
      }

      // For targets that auto-complete (stop_loss, target_3), trigger automation FIRST
      // while trade is still active, then complete the trade
      const autoCompletingTargets = ['stop_loss', 'target_3'];
      
      console.log(`🔍 Debug: targetType=${targetType}, hit=${hit}, isAutoCompleting=${autoCompletingTargets.includes(targetType)}`);
      
      if (hit && autoCompletingTargets.includes(targetType)) {
        console.log(`🚀 Pre-completion automation trigger for ${targetType}`);
        // Trigger automation FIRST while trade is still active
        await tradeMonitor.triggerTargetHit(trade.id, targetType);
      }

      // Use V2 method which handles business logic and auto-completion
      const result = await storage.updateTradeTargetStatusV2(trade.id, { targetType, hit });
      
      if (!result || !result.trade) {
        return res.status(500).json({ message: "Failed to update target status" });
      }

      const { trade: updatedTrade, autoCompleted } = result;
      
      // For non-auto-completing targets (safebook, target_1, target_2), trigger automation AFTER update
      if (hit && !autoCompletingTargets.includes(targetType)) {
        console.log(`🎯 Post-update automation trigger for ${targetType}`);
        await tradeMonitor.triggerTargetHit(updatedTrade.id, targetType);
      }
      
      // Return both trade and auto-completion status for frontend
      res.json({ 
        trade: updatedTrade,
        autoCompleted 
      });
    } catch (error) {
      console.error("Error updating target status:", error);
      res.status(500).json({ message: "Failed to update target status" });
    }
  });

  // Endpoint to update safebook status without completing the trade
  app.patch('/api/trades/:id/safebook', isAuthenticated, async (req, res) => {
    try {
      // Parse and validate request body
      const safebookData = updateSafebookSchema.parse(req.body);
      
      const trade = await storage.getTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      if (trade.status !== 'active') {
        return res.status(400).json({ message: "Only active trades can have safebook updated" });
      }

      const updatedTrade = await storage.updateTradeSafebook(trade.id, safebookData);
      if (!updatedTrade) {
        return res.status(500).json({ message: "Failed to update safebook" });
      }
      
      // Trigger automation for safebook hit
      await tradeMonitor.triggerSafebook(updatedTrade.id, safebookData.price);
      
      res.json(updatedTrade);
    } catch (error) {
      console.error("Error updating safebook:", error);
      
      // Handle Zod validation errors
      if (error && typeof error === 'object' && 'issues' in error) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.issues 
        });
      }
      
      res.status(500).json({ message: "Failed to update safebook" });
    }
  });

  // Edit trade endpoint
  app.put('/api/trades/:id', isAuthenticated, async (req, res) => {
    try {
      const tradeData = updateTradeSchema.parse(req.body);
      
      const trade = await storage.getTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      const updatedTrade = await storage.updateTrade(req.params.id, tradeData);
      if (!updatedTrade) {
        return res.status(500).json({ message: "Failed to update trade" });
      }
      
      res.json(updatedTrade);
    } catch (error) {
      console.error("Error updating trade:", error);
      
      // Handle Zod validation errors
      if (error && typeof error === 'object' && 'issues' in error) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.issues 
        });
      }
      
      res.status(500).json({ message: "Failed to update trade" });
    }
  });

  // Delete trade endpoint
  app.delete('/api/trades/:id', isAuthenticated, async (req, res) => {
    try {
      const trade = await storage.getTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      const success = await storage.deleteTrade(req.params.id);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete trade" });
      }
      
      res.json({ message: "Trade deleted successfully" });
    } catch (error) {
      console.error("Error deleting trade:", error);
      res.status(500).json({ message: "Failed to delete trade" });
    }
  });

  // Channel routes
  app.get('/api/channels', isAuthenticated, async (req, res) => {
    try {
      const channels = await storage.getTelegramChannels();
      res.json(channels);
    } catch (error) {
      console.error("Error fetching channels:", error);
      res.status(500).json({ message: "Failed to fetch channels" });
    }
  });

  app.post('/api/channels', isAuthenticated, async (req, res) => {
    try {
      const channelData = insertTelegramChannelSchema.parse(req.body);
      const channel = await storage.createTelegramChannel(channelData);
      res.status(201).json(channel);
    } catch (error) {
      console.error("Error creating channel:", error);
      res.status(400).json({ message: "Failed to create channel" });
    }
  });

  app.put('/api/channels/:id', isAuthenticated, async (req, res) => {
    try {
      const channelData = insertTelegramChannelSchema.partial().parse(req.body);
      const channel = await storage.updateTelegramChannel(req.params.id, channelData);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      res.json(channel);
    } catch (error) {
      console.error("Error updating channel:", error);
      res.status(400).json({ message: "Failed to update channel" });
    }
  });

  app.patch('/api/channels/:id', isAuthenticated, async (req, res) => {
    try {
      // Allow partial updates for specific fields like isActive, templateId
      const allowedFields = ['isActive', 'templateId', 'name', 'description'];
      const updateData: any = {};
      
      for (const [key, value] of Object.entries(req.body)) {
        if (allowedFields.includes(key)) {
          updateData[key] = value;
        }
      }

      const channel = await storage.updateTelegramChannel(req.params.id, updateData);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      res.json(channel);
    } catch (error) {
      console.error("Error updating channel:", error);
      res.status(400).json({ message: "Failed to update channel" });
    }
  });

  app.delete('/api/channels/:id', isAuthenticated, async (req, res) => {
    try {
      const success = await storage.deleteTelegramChannel(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Channel not found" });
      }
      res.json({ message: "Channel deleted successfully" });
    } catch (error) {
      console.error("Error deleting channel:", error);
      res.status(500).json({ message: "Failed to delete channel" });
    }
  });

  // Send test message to channel
  app.post('/api/channels/:id/test', isAuthenticated, async (req, res) => {
    try {
      const { message, templateId } = req.body;
      const channelId = req.params.id;
      
      // Get channel details
      const channels = await storage.getTelegramChannels();
      const channel = channels.find(c => c.id === channelId);
      
      if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
      }

      // Check if bot token is configured
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        return res.status(500).json({ message: 'Telegram bot token not configured' });
      }

      // If templateId is provided, use template with proper image and button handling
      if (templateId) {
        const templates = await storage.getMessageTemplates();
        const template = templates.find(t => t.id === templateId);
        
        if (!template) {
          return res.status(404).json({ message: 'Template not found' });
        }

        // Use telegramService for proper template handling
        
        // Create mock trade data for template testing
        const mockTrade = {
          id: 'test-trade-123',
          pair: 'BTC-USDT',
          price: '45,250.50',
          type: 'BUY',
          leverage: '10x',
          stopLoss: '42,000.00',
          takeProfit1: '47,000.00',
          takeProfit2: '48,500.00',
          takeProfit3: '50,000.00',
          safebookPrice: '46,000.00',
          timestamp: new Date().toLocaleString('en-GB', { 
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          profitLoss: '+2.5%',
          quantity: '0.1',
          tradeId: 'TXN-TEST-123'
        };

        // Process template with mock data
        let processedMessage = template.template;
        
        // Replace variables in template
        const variables = {
          pair: mockTrade.pair,
          price: mockTrade.price,
          type: mockTrade.type,
          leverage: mockTrade.leverage,
          stopLoss: mockTrade.stopLoss,
          takeProfit1: mockTrade.takeProfit1,
          takeProfit2: mockTrade.takeProfit2,
          takeProfit3: mockTrade.takeProfit3,
          safebookPrice: mockTrade.safebookPrice,
          timestamp: mockTrade.timestamp,
          profitLoss: mockTrade.profitLoss,
          quantity: mockTrade.quantity,
          tradeId: mockTrade.tradeId
        };

        for (const [key, value] of Object.entries(variables)) {
          const placeholder = `{${key}}`;
          processedMessage = processedMessage.replace(new RegExp(placeholder, 'g'), value || '');
        }

        // Prepare message for Telegram
        let telegramMessage: any = {
          text: processedMessage,
          parse_mode: template.parseMode || 'HTML'
        };

        // Handle image if present
        if (template.imageUrl && template.imageUrl.trim()) {
          let absoluteImageUrl: string | null = null;
          
          // Convert to absolute URL for Telegram
          const imageUrl = template.imageUrl.trim();
          
          // If already absolute URL, use it
          if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            absoluteImageUrl = imageUrl;
          } else {
            // Convert relative URL to absolute
            const candidates = [
              process.env.PUBLIC_BASE_URL,
              process.env.REPLIT_URL,
              process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null,
              process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : null
            ].filter(Boolean);
            
            for (const candidate of candidates) {
              try {
                const url = new URL(candidate as string);
                
                // Must be HTTPS for production reliability
                if (url.protocol === 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
                  absoluteImageUrl = new URL(imageUrl, candidate as string).href;
                  console.log(`🔄 Converting relative URL '${imageUrl}' to absolute: ${absoluteImageUrl}`);
                  break;
                }
              } catch (error) {
                console.log(`⚠️ Failed to use candidate URL '${candidate}':`, error);
                continue;
              }
            }
          }
          
          // Only proceed if we have a valid absolute URL
          if (absoluteImageUrl && processedMessage.length <= 1024) { // Telegram caption limit
            console.log(`📸 Attempting photo message with URL: ${absoluteImageUrl}`);
            telegramMessage = {
              photo: absoluteImageUrl,
              caption: processedMessage,
              parse_mode: template.parseMode || 'HTML'
            };
          } else {
            // Add image link to text message
            if (absoluteImageUrl) {
              telegramMessage.text += `\n\n📷 <a href="${absoluteImageUrl}">View Image</a>`;
              telegramMessage.disable_web_page_preview = false;
            } else {
              console.log(`⚠️ Could not convert image URL to absolute: ${template.imageUrl}`);
            }
          }
        }

        // Handle inline buttons if present
        if (template.buttons && Array.isArray(template.buttons) && template.buttons.length > 0) {
          const processedButtons = template.buttons.map((row: any[]) => {
            return row.map((button: any) => {
              let buttonText = button.text || '';
              let buttonUrl = button.url || '';
              
              // Replace variables in button text and URL
              for (const [key, value] of Object.entries(variables)) {
                const placeholder = `{${key}}`;
                buttonText = buttonText.replace(new RegExp(placeholder, 'g'), value || '');
                if (buttonUrl) {
                  buttonUrl = buttonUrl.replace(new RegExp(placeholder, 'g'), value || '');
                }
              }
              
              const renderedButton: any = { text: buttonText };
              if (button.url && buttonUrl) {
                renderedButton.url = buttonUrl;
              } else if (button.callback_data) {
                renderedButton.callback_data = button.callback_data;
              }
              
              return renderedButton;
            });
          });

          telegramMessage.reply_markup = {
            inline_keyboard: processedButtons
          };
        }

        // Send message using TelegramService
        const result = await telegramService.sendMessage(channel.channelId, telegramMessage);
        
        if (result.success) {
          console.log(`✅ Template test message sent successfully to channel ${channel.name} (${channel.channelId})`);
          res.json({ 
            success: true, 
            message: 'Template test message sent successfully',
            channelName: channel.name,
            channelId: channel.channelId,
            telegramMessageId: result.messageId,
            templateUsed: template.name
          });
        } else {
          console.error('Telegram message failed:', result.error);
          res.status(500).json({ 
            message: 'Failed to send template message to Telegram',
            error: result.error
          });
        }
      } else {
        // Fallback to simple text message
        const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const telegramResponse = await fetch(telegramApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: channel.channelId,
            text: message,
            parse_mode: 'HTML'
          }),
        });

        if (!telegramResponse.ok) {
          const errorData = await telegramResponse.json();
          console.error('Telegram API error:', errorData);
          return res.status(500).json({ 
            message: 'Failed to send message to Telegram',
            error: errorData.description || 'Unknown Telegram API error'
          });
        }

        const telegramData = await telegramResponse.json();
        console.log(`✅ Test message sent successfully to channel ${channel.name} (${channel.channelId})`);
        
        res.json({ 
          success: true, 
          message: 'Test message sent successfully',
          channelName: channel.name,
          channelId: channel.channelId,
          telegramMessageId: telegramData.result?.message_id
        });
      }
    } catch (error) {
      console.error('Error sending test message:', error);
      res.status(500).json({ message: 'Failed to send test message' });
    }
  });

  // Template routes
  app.get('/api/templates', isAuthenticated, async (req, res) => {
    try {
      const { channelId } = req.query;
      const templates = await storage.getMessageTemplates(channelId as string);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.post('/api/templates', isAuthenticated, async (req, res) => {
    try {
      const templateData = insertMessageTemplateSchema.parse(req.body);
      const template = await storage.createMessageTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(400).json({ message: "Failed to create template" });
    }
  });

  app.put('/api/templates/:id', isAuthenticated, async (req, res) => {
    try {
      // For updates, we need to parse without the refinement check since it's optional
      // The refinement is mainly for creation validation
      const templateData = req.body;
      const template = await storage.updateMessageTemplate(req.params.id, templateData);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error updating template:", error);
      res.status(400).json({ message: "Failed to update template" });
    }
  });

  app.patch('/api/templates/:id', isAuthenticated, async (req, res) => {
    try {
      const { isArchived } = req.body;
      if (typeof isArchived !== 'boolean') {
        return res.status(400).json({ message: "isArchived must be a boolean" });
      }
      
      const template = await storage.updateMessageTemplate(req.params.id, { isArchived });
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error archiving template:", error);
      res.status(500).json({ message: "Failed to archive template" });
    }
  });

  app.delete('/api/templates/:id', isAuthenticated, async (req, res) => {
    try {
      const success = await storage.deleteMessageTemplate(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  app.post('/api/templates/test', isAuthenticated, async (req, res) => {
    try {
      const { template, channelId, includeFields } = req.body;
      
      // Get channel info
      const channel = await storage.getTelegramChannel(channelId);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }

      // Generate test message with sample data
      const sampleTrade = {
        pair: 'BTC/INR',
        price: '2845672',
        type: 'buy',
        leverage: 50,
        createdAt: new Date(),
        profitLoss: '+₹5,234'
      };

      const message = telegramService.generateTradeMessage(sampleTrade, template, includeFields);
      
      // Send test message
      const result = await telegramService.sendMessage(channel.channelId, {
        text: `🧪 TEST MESSAGE 🧪\n\n${message}`,
        parse_mode: 'HTML',
      });

      if (result.success) {
        res.json({ message: "Test message sent successfully" });
      } else {
        res.status(400).json({ message: result.error });
      }
    } catch (error) {
      console.error("Error sending test message:", error);
      res.status(500).json({ message: "Failed to send test message" });
    }
  });

  // Image upload routes for templates
  app.post('/api/templates/images/upload-url', isAuthenticated, async (req, res) => {
    try {
      // Validate request body (even though empty, it ensures proper parsing)
      uploadUrlRequestSchema.parse(req.body);
      
      // Get authenticated user ID
      const user = req.user as User;
      if (!user || !user.id) {
        return res.status(401).json({ message: 'User authentication required' });
      }
      
      const objectStorageService = new ObjectStorageService();
      const { uploadURL, imageURL } = await objectStorageService.getTemplateImageUploadURL(user.id);
      
      // Return response matching what client expects: { uploadUrl, imageUrl }
      res.json({ 
        uploadUrl: uploadURL,
        imageUrl: imageURL 
      });
    } catch (error) {
      console.error('Error getting upload URL:', error);
      
      if (error && typeof error === 'object' && 'issues' in error) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: error.issues 
        });
      }
      
      if (error instanceof Error && error.message.includes('Invalid user ID')) {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ message: 'Failed to get upload URL' });
    }
  });

  app.post('/api/templates/images/finalize', isAuthenticated, async (req, res) => {
    try {
      // Validate request body with proper schema
      const { imageURL } = finalizeImageUploadSchema.parse(req.body);
      
      // Get authenticated user ID
      const user = req.user as User;
      if (!user || !user.id) {
        return res.status(401).json({ message: 'User authentication required' });
      }
      
      const objectStorageService = new ObjectStorageService();
      
      // Validate that the image URL belongs to this user's namespace
      if (!objectStorageService.validateUserTemplateImageURL(imageURL, user.id)) {
        return res.status(403).json({ 
          message: 'Access denied: Image URL does not belong to your namespace' 
        });
      }
      
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        imageURL,
        {
          owner: user.id,
          visibility: "public", // Template images are public for Telegram to access
        }
      );

      res.json({ objectPath });
    } catch (error) {
      console.error('Error finalizing image upload:', error);
      
      if (error && typeof error === 'object' && 'issues' in error) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: error.issues 
        });
      }
      
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      res.status(500).json({ message: 'Failed to finalize image upload' });
    }
  });

  app.get('/objects/:objectPath(*)', async (req, res) => {
    try {
      const objectPath = `/objects/${req.params.objectPath}`;
      
      // Validate object path format
      if (!objectPath || typeof objectPath !== 'string') {
        return res.status(400).json({ message: 'Invalid object path' });
      }
      
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      
      // For authenticated routes, check ACL permissions
      if (req.user) {
        const user = req.user as User;
        const canAccess = await objectStorageService.canAccessObjectEntity({
          userId: user.id,
          objectFile,
        });
        
        if (!canAccess) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }
      
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error('Error serving object:', error);
      
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: 'Object not found' });
      }
      
      return res.status(500).json({ message: 'Failed to serve object' });
    }
  });

  // Automation routes
  app.get('/api/automations', isAuthenticated, async (req, res) => {
    try {
      const automations = await storage.getAutomations();
      res.json(automations);
    } catch (error) {
      console.error("Error fetching automations:", error);
      res.status(500).json({ message: "Failed to fetch automations" });
    }
  });

  app.post('/api/automations', isAuthenticated, async (req, res) => {
    try {
      const automationData = insertAutomationSchema.parse(req.body);
      
      // Verify channel and template exist
      const channel = await storage.getTelegramChannel(automationData.channelId);
      const template = await storage.getMessageTemplate(automationData.templateId);
      
      if (!channel) {
        return res.status(400).json({ message: "Selected channel does not exist" });
      }
      
      if (!template) {
        return res.status(400).json({ message: "Selected template does not exist" });
      }
      
      if (!channel.isActive) {
        return res.status(400).json({ message: "Selected channel is not active" });
      }
      
      if (!template.isActive) {
        return res.status(400).json({ message: "Selected template is not active" });
      }
      
      const automation = await storage.createAutomation(automationData);
      res.status(201).json(automation);
    } catch (error) {
      console.error("Error creating automation:", error);
      
      // Handle Zod validation errors
      if (error && typeof error === 'object' && 'issues' in error) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.issues 
        });
      }
      
      res.status(500).json({ message: "Failed to create automation" });
    }
  });

  app.patch('/api/automations/:id', isAuthenticated, async (req, res) => {
    try {
      // For automation updates, use req.body directly since schema has refinement
      const updates = req.body;
      const automation = await storage.updateAutomation(req.params.id, updates);
      
      if (!automation) {
        return res.status(404).json({ message: "Automation not found" });
      }
      
      res.json(automation);
    } catch (error) {
      console.error("Error updating automation:", error);
      
      // Handle Zod validation errors
      if (error && typeof error === 'object' && 'issues' in error) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.issues 
        });
      }
      
      res.status(500).json({ message: "Failed to update automation" });
    }
  });

  app.delete('/api/automations/:id', isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteAutomation(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Automation not found" });
      }
      
      res.json({ message: "Automation deleted successfully" });
    } catch (error) {
      console.error("Error deleting automation:", error);
      res.status(500).json({ message: "Failed to delete automation" });
    }
  });

  // Toggle automation active/inactive status
  app.patch('/api/automations/:id/toggle', isAuthenticated, async (req, res) => {
    try {
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }
      
      const updatedAutomation = await storage.toggleAutomationStatus(req.params.id, isActive);
      
      if (!updatedAutomation) {
        return res.status(404).json({ message: "Automation not found" });
      }
      
      res.json(updatedAutomation);
    } catch (error) {
      console.error("Error toggling automation status:", error);
      res.status(500).json({ message: "Failed to toggle automation status" });
    }
  });

  // Sent messages routes
  app.get('/api/sent-messages', isAuthenticated, async (req, res) => {
    try {
      const { status, limit, offset } = req.query;
      
      // Safe integer parsing with defaults
      let parsedLimit = 100;
      let parsedOffset = 0;
      
      if (limit) {
        const limitNum = parseInt(limit as string);
        if (!isNaN(limitNum) && limitNum > 0 && limitNum <= 1000) {
          parsedLimit = limitNum;
        }
      }
      
      if (offset) {
        const offsetNum = parseInt(offset as string);
        if (!isNaN(offsetNum) && offsetNum >= 0) {
          parsedOffset = offsetNum;
        }
      }
      
      const messages = await storage.getSentMessages({
        status: status as string,
        limit: parsedLimit,
        offset: parsedOffset,
      });
      res.json(messages);
    } catch (error) {
      console.error("Error fetching sent messages:", error);
      res.status(500).json({ message: "Failed to fetch sent messages" });
    }
  });

  // System status routes
  app.get('/api/status', isAuthenticated, async (req, res) => {
    try {
      const monitorStatus = tradeMonitor.getStatus();
      const telegramValid = await telegramService.validateBotToken();
      const coindcxValid = await coindcxService.validateApiConnection();

      res.json({
        monitor: monitorStatus,
        telegram: { connected: telegramValid },
        coindcx: { connected: coindcxValid },
      });
    } catch (error) {
      console.error("Error fetching system status:", error);
      res.status(500).json({ message: "Failed to fetch system status" });
    }
  });

  app.post('/api/monitor/start', isAuthenticated, async (req, res) => {
    try {
      // Trade monitoring is always running in manual sync mode
      res.json({ message: "Trade monitoring already running" });
    } catch (error) {
      console.error("Error starting monitor:", error);
      res.status(500).json({ message: "Failed to start monitoring" });
    }
  });

  app.post('/api/monitor/stop', isAuthenticated, async (req, res) => {
    try {
      tradeMonitor.stopMonitoring();
      res.json({ message: "Trade monitoring stopped" });
    } catch (error) {
      console.error("Error stopping monitor:", error);
      res.status(500).json({ message: "Failed to stop monitoring" });
    }
  });

  // Manual sync endpoint - fetches trades from CoinDCX and saves to database
  app.post('/api/trades/sync', isAuthenticated, async (req, res) => {
    try {
      const result = await tradeMonitor.manualSync();
      res.json(result);
    } catch (error) {
      console.error("Error during manual sync:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : 'Manual sync failed' 
      });
    }
  });

  // Security headers middleware for embed routes  
  app.use('/embed/*', (req, res, next) => {
    // Allow embedding from any origin for embed routes only
    res.header('X-Frame-Options', 'ALLOWALL');
    res.header('Content-Security-Policy', "frame-ancestors *; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
    next();
  });

  // CORS middleware for public API endpoints
  app.use('/api/public/*', (req, res, next) => {
    // Allow all origins for public endpoints
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    res.header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300'); // Cache for 1 minute
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    next();
  });

  // Public routes (no authentication required)
  app.get('/api/public/trades/completed', async (req, res) => {
    try {
      const { limit = '50', offset = '0' } = req.query;
      
      // Safe integer parsing with defaults
      let parsedLimit = parseInt(limit as string);
      let parsedOffset = parseInt(offset as string);
      
      if (isNaN(parsedLimit) || parsedLimit <= 0 || parsedLimit > 100) {
        parsedLimit = 50;
      }
      
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        parsedOffset = 0;
      }
      
      // Fetch only completed trades for public display
      const result = await storage.getTrades({
        status: 'completed',
        limit: parsedLimit,
        offset: parsedOffset,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching public completed trades:", error);
      res.status(500).json({ message: "Failed to fetch completed trades" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
