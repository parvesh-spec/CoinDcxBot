import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { tradeMonitor } from "./services/tradeMonitor";
import { telegramService } from "./services/telegram";
import { coindcxService } from "./services/coindcx";
import { insertTelegramChannelSchema, insertMessageTemplateSchema, registerSchema, loginSchema } from "@shared/schema";

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

  app.post('/api/trades/:id/retry', isAuthenticated, async (req, res) => {
    try {
      const trade = await storage.getTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      // Reset status to pending to trigger retry
      await storage.updateTrade(trade.id, {
        status: 'pending',
        errorMessage: null,
      });

      res.json({ message: "Trade queued for retry" });
    } catch (error) {
      console.error("Error retrying trade:", error);
      res.status(500).json({ message: "Failed to retry trade" });
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

  const httpServer = createServer(app);
  return httpServer;
}
