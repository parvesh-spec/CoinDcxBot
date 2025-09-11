import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { tradeMonitor } from "./services/tradeMonitor";
import { telegramService } from "./services/telegram";
import { coindcxService } from "./services/coindcx";
import { insertTelegramChannelSchema, insertMessageTemplateSchema, registerSchema, loginSchema, completeTradeSchema, insertAutomationSchema, updateTradeSchema, User, uploadUrlRequestSchema, finalizeImageUploadSchema } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

export async function registerRoutes(app: Express): Promise<Server> {
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
      
      // Trigger automation for trade completion
      await tradeMonitor.triggerTradeCompleted(updatedTrade.id);
      
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

  // Endpoint to update target status (for T1, T2) without completing the trade
  app.patch('/api/trades/:id/target-status', isAuthenticated, async (req, res) => {
    try {
      const { targetType, hit } = req.body;
      
      // Validate input
      if (!['t1', 't2'].includes(targetType)) {
        return res.status(400).json({ message: "Invalid target type. Must be t1 or t2" });
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

      const updatedTrade = await storage.updateTradeTargetStatus(trade.id, targetType, hit);
      if (!updatedTrade) {
        return res.status(500).json({ message: "Failed to update target status" });
      }
      
      res.json(updatedTrade);
    } catch (error) {
      console.error("Error updating target status:", error);
      res.status(500).json({ message: "Failed to update target status" });
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
      const { message } = req.body;
      const channelId = req.params.id;
      
      // Get channel details
      const channels = await storage.getTelegramChannels();
      const channel = channels.find(c => c.id === channelId);
      
      if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
      }

      // Send actual message to Telegram
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        return res.status(500).json({ message: 'Telegram bot token not configured' });
      }

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
      const templateData = insertMessageTemplateSchema.partial().parse(req.body);
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
      const updates = insertAutomationSchema.partial().parse(req.body);
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
