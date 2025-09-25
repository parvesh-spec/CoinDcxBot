import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { tradeMonitor } from "./services/tradeMonitor";
import { telegramService } from "./services/telegram";
import { coindcxService, CoinDCXService } from "./services/coindcx";
import { automationService } from "./services/automationService";
import { sendApplicationConfirmationEmail } from "./services/email";
import { insertTelegramChannelSchema, insertMessageTemplateSchema, registerSchema, loginSchema, completeTradeSchema, updateSafebookSchema, insertAutomationSchema, updateTradeSchema, insertTradeSchema, User, uploadUrlRequestSchema, finalizeImageUploadSchema, insertCopyTradingUserSchema, insertCopyTradingApplicationSchema, insertCopyTradeSchema, sendOtpSchema, verifyOtpSchema, sendUserAccessOtpSchema, verifyUserAccessOtpSchema } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { safeDecrypt } from "./utils/encryption";

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

  // Create new trade (manual or via API)
  app.post('/api/trades', isAuthenticated, async (req, res) => {
    try {
      // Parse and validate request body
      const tradeData = insertTradeSchema.parse(req.body);
      
      // If source is not provided, default to 'manual' for manual creation
      if (!tradeData.source) {
        tradeData.source = 'manual';
      }
      
      // If signalType is not provided and source is manual, set to 'manual'
      if (!tradeData.signalType && tradeData.source === 'manual') {
        tradeData.signalType = 'manual';
      }
      
      console.log(`📝 Creating new ${tradeData.source} trade:`, {
        pair: tradeData.pair,
        type: tradeData.type,
        leverage: tradeData.leverage,
        source: tradeData.source,
        signalType: tradeData.signalType
      });
      
      const newTrade = await storage.createTrade(tradeData);
      
      console.log(`✅ Trade created successfully: ${newTrade.id}`);
      res.status(201).json(newTrade);
      
    } catch (error) {
      console.error("Error creating trade:", error);
      
      // Handle Zod validation errors
      if (error && typeof error === 'object' && 'issues' in error) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.issues 
        });
      }
      
      res.status(500).json({ message: "Failed to create trade" });
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

  // Endpoint to reopen completed trades
  app.patch('/api/trades/:id/reopen', isAuthenticated, async (req, res) => {
    try {
      const trade = await storage.getTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      if (trade.status !== 'completed') {
        return res.status(400).json({ message: "Only completed trades can be reopened" });
      }

      console.log(`🔄 API: Reopening completed trade ${trade.tradeId} (${req.params.id})`);
      
      const reopenedTrade = await storage.reopenTrade(trade.id);
      if (!reopenedTrade) {
        return res.status(500).json({ message: "Failed to reopen trade" });
      }
      
      console.log(`✅ API: Trade reopened successfully: ${reopenedTrade.tradeId}, status: ${reopenedTrade.status}`);
      res.json(reopenedTrade);
    } catch (error) {
      console.error("Error reopening trade:", error);
      res.status(500).json({ message: "Failed to reopen trade" });
    }
  });

  // Endpoint to exit trade on exchange immediately at market price
  app.patch('/api/trades/:id/exit', isAuthenticated, async (req, res) => {
    try {
      const trade = await storage.getTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      if (trade.status !== 'active') {
        return res.status(400).json({ message: "Only active trades can be exited on exchange" });
      }

      console.log(`🚪 API: Starting exit for active trade ${trade.tradeId} (${req.params.id}) on CoinDCX exchange`);
      
      // Determine trade type based on pair format and trade characteristics
      // Futures typically have high leverage (>3x), specific naming patterns
      let tradeType: 'spot' | 'margin' | 'futures' = 'futures'; // Default assumption
      
      if (trade.leverage === 1) {
        tradeType = 'spot';
      } else if (trade.leverage > 1 && trade.leverage <= 5) {
        tradeType = 'margin';
      } else {
        tradeType = 'futures';
      }
      
      console.log(`🎯 API: Detected trade type: ${tradeType} (leverage: ${trade.leverage}x)`);
      
      // Call CoinDCX service to exit position on exchange
      const exitResult = await coindcxService.exitTrade(trade.tradeId, trade.pair, tradeType);
      
      if (!exitResult.success) {
        console.error(`❌ API: Failed to exit trade on exchange: ${exitResult.message}`);
        return res.status(400).json({ 
          message: `Failed to exit trade on exchange: ${exitResult.message}`,
          exchangeError: exitResult.data
        });
      }
      
      console.log(`✅ API: Trade exited successfully on exchange: ${trade.tradeId}`);
      
      // Exit trade only on exchange - keep database trade status unchanged (active)
      // Mark as exited on exchange and add note for record keeping
      const updatedTrade = await storage.markExchangeExited(trade.id, 
        `🚪 Position exited on exchange at market price: ${exitResult.message}`
      );
      
      console.log(`🏁 API: Trade exit completed - Exchange exited, Database remains active`);
      res.json({
        success: true,
        message: "Trade position successfully exited on exchange - trade remains active for tracking",
        trade: updatedTrade || trade,
        exchange: exitResult.data
      });
      
    } catch (error: any) {
      console.error("Error exiting trade:", error);
      
      // Handle specific error types with appropriate status codes
      if (error.message && error.message.includes('Spot trade exit not supported')) {
        return res.status(400).json({ 
          message: "Spot trade exits not supported - requires manual order placement",
          errorType: "unsupported_operation"
        });
      }
      
      // Generic server error for other cases
      res.status(500).json({ message: "Failed to exit trade" });
    }
  });

  // Endpoint to exit original trade AND all copy trades for a trade
  app.patch('/api/trades/:id/exit-for-all', isAuthenticated, async (req, res) => {
    try {
      const trade = await storage.getTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      if (trade.status !== 'active') {
        return res.status(400).json({ message: "Only active trades can be exited" });
      }

      console.log(`🚪 API: Starting EXIT FOR ALL for trade ${trade.tradeId} (${req.params.id})`);
      
      // Results tracking
      let originalExited = false;
      let copyTradesExited = 0;
      let copyTradesFailed = 0;
      const results = [];

      // Step 1: Exit original trade (same logic as regular exit)
      try {
        let tradeType: 'spot' | 'margin' | 'futures' = 'futures';
        
        if (trade.leverage === 1) {
          tradeType = 'spot';
        } else if (trade.leverage > 1 && trade.leverage <= 5) {
          tradeType = 'margin';
        } else {
          tradeType = 'futures';
        }
        
        console.log(`🎯 EXIT FOR ALL: Exiting original trade (${tradeType}, ${trade.leverage}x)`);
        
        const exitResult = await coindcxService.exitTrade(trade.tradeId, trade.pair, tradeType);
        
        if (exitResult.success) {
          originalExited = true;
          await storage.markExchangeExited(trade.id, 
            `🚪 Position exited via EXIT FOR ALL at market price: ${exitResult.message}`
          );
          console.log(`✅ EXIT FOR ALL: Original trade exited successfully`);
          results.push({ type: 'original', trade: trade.tradeId, status: 'success', message: exitResult.message });
        } else {
          console.error(`❌ EXIT FOR ALL: Failed to exit original trade: ${exitResult.message}`);
          results.push({ type: 'original', trade: trade.tradeId, status: 'failed', message: exitResult.message });
        }
      } catch (error: any) {
        console.error(`❌ EXIT FOR ALL: Error exiting original trade:`, error);
        results.push({ type: 'original', trade: trade.tradeId, status: 'failed', message: error.message });
      }

      // Step 2: Find and exit all executed copy trades for this original trade
      try {
        const copyTrades = await storage.getCopyTradesByOriginalId(trade.id);
        const executedCopyTrades = copyTrades.filter(ct => ct.status === 'executed' && ct.executedTradeId);
        
        console.log(`📊 EXIT FOR ALL: Found ${executedCopyTrades.length} executed copy trades to exit`);
        
        for (const copyTrade of executedCopyTrades) {
          // Get copy user credentials outside try block for catch scope access
          let copyUser: any = null;
          try {
            copyUser = await storage.getCopyTradingUser(copyTrade.copyUserId);
            if (!copyUser || !copyUser.apiKey || !copyUser.apiSecret) {
              copyTradesFailed++;
              results.push({ 
                type: 'copy', 
                trade: copyTrade.executedTradeId, 
                user: copyUser?.name || 'Unknown',
                status: 'failed', 
                message: 'Missing API credentials' 
              });
              continue;
            }

            // Decrypt credentials and create service instance for this user
            const decryptedKey = safeDecrypt(copyUser.apiKey);
            const decryptedSecret = safeDecrypt(copyUser.apiSecret);
            const userCoinDCXService = new CoinDCXService(decryptedKey, decryptedSecret);

            // Determine trade type for copy trade
            let copyTradeType: 'spot' | 'margin' | 'futures' = 'futures';
            
            if (copyTrade.leverage === '1') {
              copyTradeType = 'spot';
            } else if (parseFloat(copyTrade.leverage) > 1 && parseFloat(copyTrade.leverage) <= 5) {
              copyTradeType = 'margin';
            } else {
              copyTradeType = 'futures';
            }
            
            console.log(`🚪 EXIT FOR ALL: Exiting copy trade for ${copyUser.name} (${copyTradeType}, ${copyTrade.leverage}x)`);
            
            // Exit copy trade using user's credentials
            const copyExitResult = await userCoinDCXService.exitTrade(
              copyTrade.executedTradeId!,
              copyTrade.pair,
              copyTradeType
            );
            
            if (copyExitResult.success) {
              copyTradesExited++;
              // Update copy trade status
              await storage.updateCopyTradeStatus(copyTrade.id, 'exited', 
                `Exited via EXIT FOR ALL: ${copyExitResult.message}`
              );
              console.log(`✅ EXIT FOR ALL: Copy trade exited for ${copyUser.name}`);
              results.push({ 
                type: 'copy', 
                trade: copyTrade.executedTradeId, 
                user: copyUser.name,
                status: 'success', 
                message: copyExitResult.message 
              });
            } else {
              copyTradesFailed++;
              
              // Handle specific error cases with user-friendly messages
              let userFriendlyMessage = copyExitResult.message;
              if (copyExitResult.message?.includes('Position is not valid') || 
                  copyExitResult.message?.includes('not found') ||
                  copyExitResult.message?.includes('position already closed')) {
                userFriendlyMessage = 'Position already closed or expired';
                // Update copy trade status to reflect this
                await storage.updateCopyTradeStatus(copyTrade.id, 'already_closed', 
                  `Position already closed/expired during EXIT FOR ALL: ${copyExitResult.message}`
                );
              }
              
              console.error(`❌ EXIT FOR ALL: Failed to exit copy trade for ${copyUser.name}: ${copyExitResult.message}`);
              results.push({ 
                type: 'copy', 
                trade: copyTrade.executedTradeId, 
                user: copyUser.name,
                status: 'failed', 
                message: userFriendlyMessage 
              });
            }
          } catch (error: any) {
            copyTradesFailed++;
            console.error(`❌ EXIT FOR ALL: Error exiting copy trade:`, error);
            
            // Handle specific exception cases with user-friendly messages
            let userFriendlyMessage = error.message || 'Unknown error';
            if (error.response?.data?.message?.includes('Position is not valid') ||
                error.message?.includes('Position is not valid') ||
                error.message?.includes('not found')) {
              userFriendlyMessage = 'Position already closed or expired';
              // Update copy trade status to reflect this
              await storage.updateCopyTradeStatus(copyTrade.id, 'already_closed', 
                `Position already closed/expired during EXIT FOR ALL: ${error.message}`
              );
            }
            
            results.push({ 
              type: 'copy', 
              trade: copyTrade.executedTradeId || 'Unknown', 
              user: copyUser?.name || 'Unknown',
              status: 'failed', 
              message: userFriendlyMessage 
            });
          }
        }
      } catch (error: any) {
        console.error(`❌ EXIT FOR ALL: Error processing copy trades:`, error);
      }

      // Step 3: Return comprehensive results
      const totalCopyTrades = copyTradesExited + copyTradesFailed;
      const message = `Exit For All completed: Original ${originalExited ? 'SUCCESS' : 'FAILED'}, Copy Trades ${copyTradesExited}/${totalCopyTrades} exited`;
      
      console.log(`🏁 EXIT FOR ALL: ${message}`);
      
      res.json({
        success: true,
        message,
        originalExited,
        copyTradesExited,
        totalCopyTrades,
        copyTradesFailed,
        results
      });
      
    } catch (error: any) {
      console.error("Error in exit for all:", error);
      res.status(500).json({ message: "Failed to execute exit for all" });
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
      console.log(`🎯 TARGET-STATUS: Processing ${targetType} hit=${hit} for trade ${trade.id} (${trade.tradeId})`);
      
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
      
      console.log(`✅ TARGET-STATUS: Storage update complete. AutoCompleted=${autoCompleted}, CompletionReason=${updatedTrade.completionReason || 'N/A'}, Status=${updatedTrade.status}`);
      
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

  // Copy Trading User Management Routes
  app.get('/api/copy-trading/users', isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getCopyTradingUsers();
      
      // Fetch wallet balance for each user asynchronously and save to database
      const usersWithBalance = await Promise.all(
        users.map(async (user) => {
          try {
            // Decrypt API credentials with debugging
            const apiKey = safeDecrypt(user.apiKey);
            const apiSecret = safeDecrypt(user.apiSecret);
            
            // Credentials decrypted securely
            
            if (apiKey && apiSecret) {
              const walletResult = await coindcxService.getFuturesWalletBalance(apiKey, apiSecret);
              
              if (walletResult.success && walletResult.balance) {
                // Extract USDT balance from the wallet response
                const usdtWallet = walletResult.balance.find((wallet: any) => wallet.currency_short_name === 'USDT');
                const usdtBalance = usdtWallet ? parseFloat(usdtWallet.balance || '0') : 0;
                
                // Save wallet balance to database and update lowFund status
                try {
                  await storage.updateCopyTradingUserWalletBalance(user.id, usdtBalance);
                  console.log(`💾 Wallet balance saved for user ${user.name}: ${usdtBalance} USDT`);
                } catch (dbError) {
                  console.error(`❌ Failed to save wallet balance for user ${user.name}:`, dbError);
                }
              }
              
              return {
                ...user,
                walletBalance: walletResult.success ? walletResult.balance : null,
                walletError: walletResult.success ? null : walletResult.message,
                // Override with database values for UI display
                futuresWalletBalance: user.futuresWalletBalance || 0,
                displayBalance: user.futuresWalletBalance || 0
              };
            } else {
              return {
                ...user,
                walletBalance: null,
                walletError: 'Failed to decrypt credentials',
              };
            }
          } catch (error) {
            console.warn(`Failed to fetch wallet for user ${user.name}:`, error);
            return {
              ...user,
              walletBalance: null,
              walletError: 'Balance fetch failed',
            };
          }
        })
      );
      
      res.json(usersWithBalance);
    } catch (error) {
      console.error("Error fetching copy trading users:", error);
      res.status(500).json({ message: "Failed to fetch copy trading users" });
    }
  });

  app.post('/api/copy-trading/users', isAuthenticated, async (req, res) => {
    try {
      // Validate request body
      const userData = insertCopyTradingUserSchema.parse(req.body);
      
      console.log(`🔐 Verifying credentials for new copy trading user: ${userData.name}`);
      
      // Verify credentials with CoinDCX before saving
      const credentialCheck = await coindcxService.validateCustomCredentials(userData.apiKey, userData.apiSecret);
      
      if (!credentialCheck.valid) {
        console.log(`❌ Credential verification failed for user: ${userData.name}`);
        return res.status(400).json({ 
          message: "Credential verification failed", 
          error: credentialCheck.message 
        });
      }
      
      console.log(`✅ Credentials verified for user: ${userData.name}, creating account...`);
      
      // TODO: Encrypt API credentials before saving (future enhancement)
      const newUser = await storage.createCopyTradingUser(userData);
      
      console.log(`✅ Copy trading user created successfully: ${newUser.id}`);
      res.status(201).json(newUser);
    } catch (error: any) {
      console.error("Error creating copy trading user:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to create copy trading user" });
    }
  });

  app.patch('/api/copy-trading/users/:id', isAuthenticated, async (req, res) => {
    try {
      const userData = insertCopyTradingUserSchema.partial().parse(req.body);
      
      // If API credentials are being updated, verify them
      if (userData.apiKey && userData.apiSecret) {
        console.log(`🔐 Verifying updated credentials for copy trading user: ${req.params.id}`);
        
        const credentialCheck = await coindcxService.validateCustomCredentials(userData.apiKey, userData.apiSecret);
        
        if (!credentialCheck.valid) {
          console.log(`❌ Updated credential verification failed for user: ${req.params.id}`);
          return res.status(400).json({ 
            message: "Credential verification failed", 
            error: credentialCheck.message 
          });
        }
        
        console.log(`✅ Updated credentials verified for user: ${req.params.id}`);
      }
      
      const updatedUser = await storage.updateCopyTradingUser(req.params.id, userData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "Copy trading user not found" });
      }
      
      console.log(`✅ Copy trading user updated successfully: ${updatedUser.id}`);
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating copy trading user:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to update copy trading user" });
    }
  });

  app.patch('/api/copy-trading/users/:id/toggle', isAuthenticated, async (req, res) => {
    try {
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }
      
      const updatedUser = await storage.toggleCopyTradingUser(req.params.id, isActive);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "Copy trading user not found" });
      }
      
      console.log(`✅ Copy trading user ${isActive ? 'activated' : 'deactivated'}: ${updatedUser.id}`);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error toggling copy trading user:", error);
      res.status(500).json({ message: "Failed to toggle copy trading user status" });
    }
  });

  app.delete('/api/copy-trading/users/:id', isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteCopyTradingUser(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Copy trading user not found" });
      }
      
      console.log(`✅ Copy trading user deleted successfully: ${req.params.id}`);
      res.json({ message: "Copy trading user deleted successfully" });
    } catch (error) {
      console.error("Error deleting copy trading user:", error);
      res.status(500).json({ message: "Failed to delete copy trading user" });
    }
  });

  // Admin Copy Trading Application Routes (requires authentication)
  app.get('/api/copy-trading/applications', isAuthenticated, async (req, res) => {
    try {
      const { status, limit, offset } = req.query;
      
      const filters: any = {};
      if (status) filters.status = status as string;
      if (limit) filters.limit = parseInt(limit as string);
      if (offset) filters.offset = parseInt(offset as string);
      
      const result = await storage.getCopyTradingApplications(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching copy trading applications:", error);
      res.status(500).json({ message: "Failed to fetch copy trading applications" });
    }
  });

  app.patch('/api/copy-trading/applications/:id/approve', isAuthenticated, async (req, res) => {
    try {
      const { notes } = req.body;
      
      // Get application details first
      const application = await storage.getCopyTradingApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      // Update application status to approved
      const updatedApplication = await storage.updateCopyTradingApplicationStatus(
        req.params.id, 
        'approved', 
        notes
      );
      
      // Create copy trading user from approved application
      const userData = {
        name: application.name,
        email: application.email,
        telegramId: application.telegramId || '',
        telegramUsername: application.telegramUsername || '',
        exchange: application.exchange,
        apiKey: application.apiKey,
        apiSecret: application.apiSecret,
        riskPerTrade: parseFloat(application.riskPerTrade),
        tradeFund: parseFloat(application.tradeFund || '100'),
        maxTradesPerDay: application.maxTradesPerDay,
        isActive: true,
        notes: application.notes
      };
      
      const newUser = await storage.createCopyTradingUser(userData);
      
      console.log(`✅ Application approved and user created: ${newUser.id} for ${application.email}`);
      res.json({ 
        message: "Application approved and user created successfully",
        application: updatedApplication,
        user: newUser
      });
    } catch (error) {
      console.error("Error approving copy trading application:", error);
      res.status(500).json({ message: "Failed to approve application" });
    }
  });

  app.patch('/api/copy-trading/applications/:id/reject', isAuthenticated, async (req, res) => {
    try {
      const { notes } = req.body;
      
      const updatedApplication = await storage.updateCopyTradingApplicationStatus(
        req.params.id, 
        'rejected', 
        notes
      );
      
      if (!updatedApplication) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      console.log(`❌ Application rejected: ${req.params.id}`);
      res.json({ 
        message: "Application rejected successfully",
        application: updatedApplication
      });
    } catch (error) {
      console.error("Error rejecting copy trading application:", error);
      res.status(500).json({ message: "Failed to reject application" });
    }
  });

  // Public Copy Trading Application Routes  
  app.post('/api/public/verify-credentials', async (req, res) => {
    try {
      const { apiKey, apiSecret } = req.body;
      
      if (!apiKey || !apiSecret) {
        return res.status(400).json({ 
          valid: false, 
          message: 'API Key and API Secret are required' 
        });
      }

      console.log(`🔐 Public credential verification request for API key: ${apiKey.substring(0, 8)}...`);
      
      // Verify credentials using CoinDCX service
      const result = await coindcxService.validateCustomCredentials(apiKey, apiSecret);
      
      res.json(result);
    } catch (error: any) {
      console.error("Error in public credential verification:", error);
      res.status(500).json({ 
        valid: false,
        message: "Internal server error during verification" 
      });
    }
  });

  app.post('/api/public/copy-trading/applications', async (req, res) => {
    try {
      // Validate request body using Zod schema
      const applicationData = insertCopyTradingApplicationSchema.parse(req.body);
      
      console.log(`📝 New copy trading application received from: ${applicationData.email}`);
      
      // Check if email already exists in applications or users
      const existingApplication = await storage.getCopyTradingApplicationByEmail(applicationData.email);
      if (existingApplication) {
        return res.status(400).json({ 
          message: "An application with this email already exists" 
        });
      }

      const existingUser = await storage.getCopyTradingUserByEmail(applicationData.email);
      if (existingUser) {
        return res.status(400).json({ 
          message: "A user with this email already exists in our system" 
        });
      }

      // Verify credentials before saving application
      console.log(`🔐 Verifying credentials for application: ${applicationData.email}`);
      const credentialCheck = await coindcxService.validateCustomCredentials(applicationData.apiKey, applicationData.apiSecret);
      
      if (!credentialCheck.valid) {
        console.log(`❌ Credential verification failed for application: ${applicationData.email}`);
        return res.status(400).json({ 
          message: "Credential verification failed", 
          error: credentialCheck.message 
        });
      }

      console.log(`✅ Credentials verified for application: ${applicationData.email}`);
      
      // Create application with verified credentials flag
      const newApplication = await storage.createCopyTradingApplication({
        ...applicationData,
        credentialsVerified: true,
      });
      
      console.log(`✅ Copy trading application created successfully: ${newApplication.id}`);
      
      // Send confirmation email to applicant
      try {
        const emailSent = await sendApplicationConfirmationEmail(
          applicationData.email,
          {
            name: applicationData.name || 'Unknown',
            applicationId: newApplication.id!,
            exchange: applicationData.exchange || 'Unknown',
            submittedAt: new Date()
          }
        );
        
        if (emailSent) {
          console.log(`📧 Confirmation email sent to: ${applicationData.email}`);
        } else {
          console.log(`⚠️  Failed to send confirmation email to: ${applicationData.email}`);
        }
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
        // Don't fail the application submission if email fails
      }
      
      res.status(201).json({ 
        message: "Application submitted successfully",
        applicationId: newApplication.id,
        status: "pending"
      });
    } catch (error: any) {
      console.error("Error creating copy trading application:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  // Copy Trading Trades Management Routes
  app.get('/api/copy-trading/trades', isAuthenticated, async (req, res) => {
    try {
      const { userId, status, limit, offset } = req.query;
      
      const filters: any = {};
      if (userId) filters.userId = userId as string;
      if (status) filters.status = status as string;
      if (limit) filters.limit = parseInt(limit as string);
      if (offset) filters.offset = parseInt(offset as string);
      
      const result = await storage.getCopyTrades(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching copy trades:", error);
      res.status(500).json({ message: "Failed to fetch copy trades" });
    }
  });

  app.post('/api/copy-trading/trades', isAuthenticated, async (req, res) => {
    try {
      // Validate request body using Zod schema
      const copyTradeData = insertCopyTradeSchema.parse(req.body);
      
      const newCopyTrade = await storage.createCopyTrade(copyTradeData);
      
      console.log(`✅ Copy trade created successfully: ${newCopyTrade.id}`);
      res.status(201).json(newCopyTrade);
    } catch (error: any) {
      console.error("Error creating copy trade:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to create copy trade" });
    }
  });

  app.patch('/api/copy-trading/trades/:id', isAuthenticated, async (req, res) => {
    try {
      const { status, errorMessage } = req.body;
      
      const updatedCopyTrade = await storage.updateCopyTradeStatus(
        req.params.id, 
        status,
        errorMessage
      );
      
      if (!updatedCopyTrade) {
        return res.status(404).json({ message: "Copy trade not found" });
      }
      
      console.log(`✅ Copy trade status updated: ${req.params.id} -> ${status}`);
      res.json(updatedCopyTrade);
    } catch (error) {
      console.error("Error updating copy trade:", error);
      res.status(500).json({ message: "Failed to update copy trade status" });
    }
  });

  // TODO: Implement copy trade stats in future
  // app.get('/api/copy-trading/trades/stats', isAuthenticated, async (req, res) => {
  //   try {
  //     const { userId } = req.query;
  //     const stats = await storage.getCopyTradeStats(userId as string);
  //     res.json(stats);
  //   } catch (error) {
  //     console.error("Error fetching copy trade stats:", error);
  //     res.status(500).json({ message: "Failed to fetch copy trade statistics" });
  //   }
  // });

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
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    res.header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300'); // Cache for 1 minute
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    next();
  });

  // User Access routes (for end-users with email OTP authentication)
  app.post('/api/user-access/send-otp', async (req, res) => {
    try {
      const data = sendUserAccessOtpSchema.parse(req.body);
      const result = await storage.sendUserAccessOtp(data);
      res.json(result);
    } catch (error) {
      console.error("Error sending user access OTP:", error);
      if (error && typeof error === 'object' && 'issues' in error) {
        return res.status(400).json({ 
          success: false,
          message: "Validation failed", 
          errors: error 
        });
      }
      res.status(500).json({ 
        success: false,
        message: "Failed to send OTP. Please try again." 
      });
    }
  });

  app.post('/api/user-access/verify-otp', async (req, res) => {
    try {
      const data = verifyUserAccessOtpSchema.parse(req.body);
      const result = await storage.verifyUserAccessOtp(data);
      res.json(result);
    } catch (error) {
      console.error("Error verifying user access OTP:", error);
      if (error && typeof error === 'object' && 'issues' in error) {
        return res.status(400).json({ 
          success: false,
          message: "Validation failed", 
          errors: error 
        });
      }
      res.status(500).json({ 
        success: false,
        message: "Verification failed. Please try again." 
      });
    }
  });

  // Copy Trading User authenticated routes (for copy trading users after OTP verification)
  app.get('/api/user-access/trades/:email', async (req, res) => {
    try {
      const { email } = req.params;
      const { page = '1', limit = '20' } = req.query;
      
      // Verify copy trading user exists
      const copyTradingUser = await storage.getCopyTradingUserByEmail(email);
      if (!copyTradingUser) {
        return res.status(404).json({ 
          success: false,
          message: "Copy trading user not found" 
        });
      }

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Get copy trades for this specific user
      const result = await storage.getCopyTrades({
        userId: copyTradingUser.id,
        limit: parseInt(limit as string),
        offset,
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error("Error fetching user copy trades:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch trade history" 
      });
    }
  });

  app.get('/api/user-access/profile/:email', async (req, res) => {
    try {
      const { email } = req.params;
      
      const copyTradingUser = await storage.getCopyTradingUserByEmail(email);
      if (!copyTradingUser) {
        return res.status(404).json({ 
          success: false,
          message: "Copy trading user not found" 
        });
      }

      // Don't expose sensitive information (API keys, etc.)
      const safeProfile = {
        id: copyTradingUser.id,
        name: copyTradingUser.name,
        email: copyTradingUser.email,
        exchange: copyTradingUser.exchange,
        riskPerTrade: copyTradingUser.riskPerTrade,
        tradeFund: copyTradingUser.tradeFund,
        maxTradesPerDay: copyTradingUser.maxTradesPerDay,
        isActive: copyTradingUser.isActive,
        lowFund: copyTradingUser.lowFund,
        futuresWalletBalance: copyTradingUser.futuresWalletBalance,
        notes: copyTradingUser.notes,
        createdAt: copyTradingUser.createdAt,
      };

      res.json({
        success: true,
        profile: safeProfile
      });
    } catch (error) {
      console.error("Error fetching copy trading user profile:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch profile" 
      });
    }
  });

  // Public routes (no authentication required)
  
  // OTP Routes - Email verification for application process
  app.post('/api/public/otp/send', async (req, res) => {
    try {
      const otpData = sendOtpSchema.parse(req.body);
      
      const result = await storage.generateAndSendOTP(otpData);
      
      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          otpId: result.otpId
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      console.error("OTP generation error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to generate OTP. Please try again." 
      });
    }
  });

  app.post('/api/public/otp/verify', async (req, res) => {
    try {
      const verifyData = verifyOtpSchema.parse(req.body);
      
      const result = await storage.verifyOTP(verifyData);
      
      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          verified: result.verified
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to verify OTP. Please try again." 
      });
    }
  });

  // OTP Stats (Admin only)
  app.get('/api/otp/stats', isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getOTPStats();
      res.status(200).json(stats);
    } catch (error) {
      console.error("OTP stats error:", error);
      res.status(500).json({ message: "Failed to fetch OTP statistics" });
    }
  });

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
