import {
  users,
  telegramChannels,
  messageTemplates,
  trades,
  automations,
  sentMessages,
  type User,
  type InsertUser,
  type TelegramChannel,
  type InsertTelegramChannel,
  type MessageTemplate,
  type InsertMessageTemplate,
  type Trade,
  type InsertTrade,
  type CompleteTrade,
  type UpdateTrade,
  type UpdateSafebook,
  type UpdateTargetStatus,
  type TargetType,
  type TargetStatusV2,
  type Automation,
  type InsertAutomation,
  type SentMessage,
  type InsertSentMessage,
  normalizeTargetStatus,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or, ilike } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Telegram channel operations
  getTelegramChannels(): Promise<TelegramChannel[]>;
  getTelegramChannel(id: string): Promise<TelegramChannel | undefined>;
  createTelegramChannel(channel: InsertTelegramChannel): Promise<TelegramChannel>;
  updateTelegramChannel(id: string, channel: Partial<InsertTelegramChannel>): Promise<TelegramChannel | undefined>;
  deleteTelegramChannel(id: string): Promise<boolean>;

  // Message template operations
  getMessageTemplates(channelId?: string): Promise<MessageTemplate[]>;
  getMessageTemplate(id: string): Promise<MessageTemplate | undefined>;
  createMessageTemplate(template: InsertMessageTemplate): Promise<MessageTemplate>;
  updateMessageTemplate(id: string, template: Partial<InsertMessageTemplate>): Promise<MessageTemplate | undefined>;
  deleteMessageTemplate(id: string): Promise<boolean>;

  // Trade operations
  getTrades(filters?: {
    status?: string;
    channelId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ trades: Trade[]; total: number }>;
  getTrade(id: string): Promise<Trade | undefined>;
  getTradeByTradeId(tradeId: string): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: string, trade: UpdateTrade): Promise<Trade | undefined>;
  deleteTrade(id: string): Promise<boolean>;
  completeTrade(id: string, completion: CompleteTrade): Promise<Trade | undefined>;
  // New V2 target status method supporting all 5 target types with business logic
  updateTradeTargetStatusV2(id: string, targetUpdate: UpdateTargetStatus): Promise<{trade: Trade | undefined, autoCompleted: boolean}>;
  updateTradeSafebook(id: string, safebook: UpdateSafebook): Promise<Trade | undefined>;
  getTradeStats(): Promise<{
    total: number;
    active: number;
    completed: number;
  }>;
  // Legacy method - deprecated but kept for backward compatibility
  updateTradeTargetStatus(id: string, targetType: 't1' | 't2', hit: boolean): Promise<Trade | undefined>;

  // Automation operations
  getAutomations(): Promise<any[]>; // Returns automations with channel and template names
  getAutomation(id: string): Promise<Automation | undefined>;
  createAutomation(automation: InsertAutomation): Promise<Automation>;
  updateAutomation(id: string, automation: Partial<InsertAutomation>): Promise<Automation | undefined>;
  deleteAutomation(id: string): Promise<boolean>;

  // Sent message operations
  getSentMessages(filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]>; // Returns sent messages with automation and trade details
  logSentMessage(message: InsertSentMessage): Promise<SentMessage>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  // Telegram channel operations
  async getTelegramChannels(): Promise<any[]> {
    return await db
      .select({
        id: telegramChannels.id,
        name: telegramChannels.name,
        channelId: telegramChannels.channelId,
        description: telegramChannels.description,
        isActive: telegramChannels.isActive,
        templateId: telegramChannels.templateId,
        templateName: messageTemplates.name,
        createdAt: telegramChannels.createdAt,
        updatedAt: telegramChannels.updatedAt,
      })
      .from(telegramChannels)
      .leftJoin(messageTemplates, eq(telegramChannels.templateId, messageTemplates.id))
      .orderBy(desc(telegramChannels.createdAt));
  }

  async getTelegramChannel(id: string): Promise<TelegramChannel | undefined> {
    const [channel] = await db.select().from(telegramChannels).where(eq(telegramChannels.id, id));
    return channel;
  }

  async createTelegramChannel(channel: InsertTelegramChannel): Promise<TelegramChannel> {
    const [newChannel] = await db.insert(telegramChannels).values(channel).returning();
    return newChannel;
  }

  async updateTelegramChannel(id: string, channel: Partial<InsertTelegramChannel>): Promise<TelegramChannel | undefined> {
    const [updatedChannel] = await db
      .update(telegramChannels)
      .set({ ...channel, updatedAt: new Date() })
      .where(eq(telegramChannels.id, id))
      .returning();
    return updatedChannel;
  }

  async deleteTelegramChannel(id: string): Promise<boolean> {
    const result = await db.delete(telegramChannels).where(eq(telegramChannels.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Message template operations
  async getMessageTemplates(channelId?: string): Promise<MessageTemplate[]> {
    const query = db.select().from(messageTemplates);
    if (channelId) {
      return await query.where(eq(messageTemplates.channelId, channelId)).orderBy(desc(messageTemplates.createdAt));
    }
    return await query.orderBy(desc(messageTemplates.createdAt));
  }

  async getMessageTemplate(id: string): Promise<MessageTemplate | undefined> {
    const [template] = await db.select().from(messageTemplates).where(eq(messageTemplates.id, id));
    return template;
  }

  async createMessageTemplate(template: InsertMessageTemplate): Promise<MessageTemplate> {
    // Set default includeFields if not provided (since UI no longer sends it)
    const templateWithDefaults = {
      ...template,
      includeFields: template.includeFields || {} // Default empty object
    };
    
    const [newTemplate] = await db.insert(messageTemplates).values(templateWithDefaults).returning();
    return newTemplate;
  }

  async updateMessageTemplate(id: string, template: Partial<InsertMessageTemplate>): Promise<MessageTemplate | undefined> {
    const [updatedTemplate] = await db
      .update(messageTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(messageTemplates.id, id))
      .returning();
    return updatedTemplate;
  }

  async deleteMessageTemplate(id: string): Promise<boolean> {
    const result = await db.delete(messageTemplates).where(eq(messageTemplates.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Trade operations
  async getTrades(filters?: {
    status?: string;
    channelId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ trades: Trade[]; total: number }> {
    const { status, channelId, search, limit = 50, offset = 0 } = filters || {};

    let conditions = [];
    
    if (status && status !== 'all') {
      conditions.push(eq(trades.status, status));
    }
    
    if (channelId) {
      conditions.push(eq(trades.channelId, channelId));
    }
    
    if (search) {
      conditions.push(
        or(
          ilike(trades.pair, `%${search}%`),
          ilike(trades.tradeId, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [tradesResult, totalResult] = await Promise.all([
      db.select().from(trades)
        .where(whereClause)
        .orderBy(desc(trades.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(trades).where(whereClause)
    ]);

    // Helper function to calculate gain/loss percentage
    const calculateGainLoss = (trade: Trade): { percentage: number; isGain: boolean } => {
      if (!trade.price || !trade.leverage || !trade.completionReason || trade.status !== 'completed') {
        return { percentage: 0, isGain: true };
      }

      const entryPrice = Number(trade.price);
      const leverage = Number(trade.leverage);
      let exitPrice = entryPrice;

      // Determine exit price based on completion reason
      switch (trade.completionReason) {
        case 'stop_loss_hit':
          exitPrice = trade.stopLossTrigger ? Number(trade.stopLossTrigger) : entryPrice;
          break;
        case 'target_1_hit':
          exitPrice = trade.takeProfitTrigger ? Number(trade.takeProfitTrigger) : entryPrice;
          break;
        case 'target_2_hit':
          exitPrice = trade.takeProfit2 ? Number(trade.takeProfit2) : entryPrice;
          break;
        case 'target_3_hit':
          exitPrice = trade.takeProfit3 ? Number(trade.takeProfit3) : entryPrice;
          break;
        case 'safe_book':
          exitPrice = trade.safebookPrice ? Number(trade.safebookPrice) : entryPrice;
          break;
        default:
          return { percentage: 0, isGain: true };
      }

      // Calculate percentage change
      let percentageChange;
      if (trade.type === 'buy') {
        percentageChange = ((exitPrice - entryPrice) / entryPrice) * 100;
      } else {
        percentageChange = ((entryPrice - exitPrice) / entryPrice) * 100;
      }

      // Apply leverage
      const leveragedPercentage = percentageChange * leverage;
      const isGain = leveragedPercentage > 0;

      return {
        percentage: Math.abs(leveragedPercentage),
        isGain
      };
    };

    // Add gain/loss calculation to trades and normalize target status
    const tradesWithGainLoss = tradesResult.map(trade => ({
      ...trade,
      targetStatus: normalizeTargetStatus(trade.targetStatus), // Always normalize for backward compatibility
      gainLoss: calculateGainLoss(trade)
    }));

    return {
      trades: tradesWithGainLoss,
      total: totalResult[0]?.count || 0
    };
  }

  async getTrade(id: string): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(eq(trades.id, id));
    if (!trade) return undefined;
    
    // Always normalize target status to V2 format for backward compatibility
    return {
      ...trade,
      targetStatus: normalizeTargetStatus(trade.targetStatus)
    };
  }

  async getTradeByTradeId(tradeId: string): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(eq(trades.tradeId, tradeId));
    if (!trade) return undefined;
    
    // Always normalize target status to V2 format for backward compatibility
    return {
      ...trade,
      targetStatus: normalizeTargetStatus(trade.targetStatus)
    };
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [newTrade] = await db.insert(trades).values(trade).returning();
    return newTrade;
  }

  async updateTrade(id: string, trade: UpdateTrade): Promise<Trade | undefined> {
    // Clear safebook price if completion reason is not safe_book to avoid stale data
    const updateData = { ...trade };
    if (trade.completionReason && trade.completionReason !== 'safe_book') {
      updateData.safebookPrice = null;
    }
    
    const [updatedTrade] = await db
      .update(trades)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(trades.id, id))
      .returning();
    return updatedTrade;
  }

  async deleteTrade(id: string): Promise<boolean> {
    // First delete related sent messages to avoid foreign key constraint violation
    await db.delete(sentMessages).where(eq(sentMessages.tradeId, id));
    
    // Then delete the trade
    const result = await db.delete(trades).where(eq(trades.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getTradeStats(): Promise<{
    total: number;
    active: number;
    completed: number;
  }> {
    const [stats] = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where status = 'active')`,
        completed: sql<number>`count(*) filter (where status = 'completed')`
      })
      .from(trades);

    return {
      total: stats.total || 0,
      active: stats.active || 0,
      completed: stats.completed || 0
    };
  }

  async completeTrade(id: string, completion: CompleteTrade): Promise<Trade | undefined> {
    console.log(`🔄 Attempting to complete trade: ${id} with data:`, completion);
    
    // Get current trade to access targetStatus
    const currentTrade = await this.getTrade(id);
    if (!currentTrade) {
      console.log(`❌ Trade not found: ${id}`);
      return undefined;
    }

    if (currentTrade.status === 'completed') {
      console.log(`⚠️ Trade already completed: ${id}`);
      return currentTrade;
    }

    console.log(`📋 Current trade status: ${currentTrade.status}, targetStatus:`, currentTrade.targetStatus);

    // Use normalized target status instead of raw parsing
    const normalizedStatus = normalizeTargetStatus(currentTrade.targetStatus);

    // Auto-derive completion reason from existing hit targets
    // Priority order: T3 > T2 > T1 > SafeBook > StopLoss (highest to lowest)
    let autoCompletionReason = 'target_1_hit'; // default fallback
    
    if (normalizedStatus.target_3) {
      autoCompletionReason = 'target_3_hit';
    } else if (normalizedStatus.target_2) {
      autoCompletionReason = 'target_2_hit';
    } else if (normalizedStatus.target_1) {
      autoCompletionReason = 'target_1_hit';
    } else if (normalizedStatus.safebook) {
      autoCompletionReason = 'safe_book';
    } else if (normalizedStatus.stop_loss) {
      autoCompletionReason = 'stop_loss_hit';
    }

    console.log(`🎯 Auto-derived completion reason: ${autoCompletionReason} from normalized targetStatus:`, normalizedStatus);

    try {
      // Manual completion via "Mark as Complete" always completes the trade
      // and uses the highest priority hit target as completion reason
      const [updatedTrade] = await db
        .update(trades)
        .set({ 
          status: 'completed', // Always complete for manual completion
          completionReason: autoCompletionReason, // Use auto-derived reason
          safebookPrice: completion.safebookPrice || null,
          notes: completion.notes || null,
          targetStatus: normalizedStatus, // Keep normalized target status in V2 format
          updatedAt: new Date() 
        })
        .where(eq(trades.id, id))
        .returning();
      
      if (updatedTrade) {
        console.log(`✅ Trade completed successfully: ${updatedTrade.id}, status: ${updatedTrade.status}, reason: ${updatedTrade.completionReason}`);
      } else {
        console.log(`❌ Failed to update trade: ${id} - no rows returned`);
      }
      
      return updatedTrade;
    } catch (error) {
      console.error(`💥 Database error completing trade ${id}:`, error);
      throw error;
    }
  }

  // New V2 method with 5-field business logic
  async updateTradeTargetStatusV2(id: string, targetUpdate: UpdateTargetStatus): Promise<{trade: Trade | undefined, autoCompleted: boolean}> {
    console.log(`🎯 Updating target status for trade ${id}:`, targetUpdate);

    // Get current trade
    const currentTrade = await this.getTrade(id);
    if (!currentTrade) {
      return { trade: undefined, autoCompleted: false };
    }

    if (currentTrade.status === 'completed') {
      console.log(`⚠️ Cannot update completed trade: ${id}`);
      return { trade: currentTrade, autoCompleted: false };
    }

    // Normalize current target status using schema helper
    let targetStatus: TargetStatusV2 = normalizeTargetStatus(currentTrade.targetStatus);
    const { targetType, hit } = targetUpdate;

    console.log(`📋 Current normalized target status:`, targetStatus);

    // Business rules validation
    if (targetType === 'stop_loss') {
      // Stop loss can't be hit if safebook, T1, T2, or T3 are already hit
      if (targetStatus.safebook || targetStatus.target_1 || targetStatus.target_2 || targetStatus.target_3) {
        console.log(`❌ Stop loss blocked - higher targets already hit`);
        return { trade: currentTrade, autoCompleted: false };
      }
    }

    // Apply cascade rules based on target type
    if (hit) {
      switch (targetType) {
        case 'stop_loss':
          targetStatus.stop_loss = true;
          break;

        case 'safebook':
          // Safebook can't be set if any target (T1, T2, T3) is already hit
          if (targetStatus.target_1 || targetStatus.target_2 || targetStatus.target_3) {
            console.log(`❌ Safebook blocked - targets already hit:`, {t1: targetStatus.target_1, t2: targetStatus.target_2, t3: targetStatus.target_3});
            return { trade: currentTrade, autoCompleted: false };
          }
          targetStatus.safebook = true;
          // Safebook doesn't clear anything, just blocks stop loss
          break;

        case 'target_1':
          targetStatus.target_1 = true;
          // T1 invalidates safebook and blocks stop loss
          targetStatus.safebook = false;
          targetStatus.stop_loss = false;
          break;

        case 'target_2':
          targetStatus.target_2 = true;
          // T2 auto-enables T1, invalidates safebook, blocks stop loss  
          targetStatus.target_1 = true;
          targetStatus.safebook = false;
          targetStatus.stop_loss = false;
          break;

        case 'target_3':
          targetStatus.target_3 = true;
          // T3 doesn't change other targets - will auto-complete
          break;
      }
    } else {
      // If unsetting a target, just update that field
      targetStatus[targetType] = false;
    }

    console.log(`🔄 Updated target status:`, targetStatus);

    // Check if trade should auto-complete
    const shouldAutoComplete = hit && (targetType === 'stop_loss' || targetType === 'target_3');
    let completionReason: string | undefined;

    if (shouldAutoComplete) {
      completionReason = targetType === 'stop_loss' ? 'stop_loss_hit' : 'target_3_hit';
      console.log(`⚡ Auto-completing trade with reason: ${completionReason}`);
    }

    // Update the database
    const updateData: any = {
      targetStatus: targetStatus,
      updatedAt: new Date()
    };

    if (shouldAutoComplete) {
      updateData.status = 'completed';
      updateData.completionReason = completionReason;
    }

    const [updatedTrade] = await db
      .update(trades)
      .set(updateData)
      .where(eq(trades.id, id))
      .returning();

    console.log(`✅ Trade updated successfully. Auto-completed: ${shouldAutoComplete}`);

    return { trade: updatedTrade, autoCompleted: shouldAutoComplete };
  }

  // Legacy method - deprecated but kept for backward compatibility
  async updateTradeTargetStatus(id: string, targetType: 't1' | 't2', hit: boolean): Promise<Trade | undefined> {
    console.log(`⚠️ Using deprecated updateTradeTargetStatus, migrating to V2...`);
    
    // Map legacy types to new types
    const newTargetType: TargetType = targetType === 't1' ? 'target_1' : 'target_2';
    
    // Use the new V2 method
    const result = await this.updateTradeTargetStatusV2(id, { targetType: newTargetType, hit });
    return result.trade;
  }

  async updateTradeSafebook(id: string, safebook: UpdateSafebook): Promise<Trade | undefined> {
    console.log(`💰 Updating safebook for trade ${id} with price:`, safebook.price);

    // Get current trade
    const currentTrade = await this.getTrade(id);
    if (!currentTrade) {
      console.log(`❌ Trade not found: ${id}`);
      return undefined;
    }

    if (currentTrade.status === 'completed') {
      console.log(`⚠️ Cannot update safebook for completed trade: ${id}`);
      return currentTrade;
    }

    // Use normalized target status instead of raw parsing
    const normalizedStatus = normalizeTargetStatus(currentTrade.targetStatus);

    // Safebook can't be set if any target (T1, T2, T3) is already hit
    if (normalizedStatus.target_1 || normalizedStatus.target_2 || normalizedStatus.target_3) {
      console.log(`❌ Safebook blocked - targets already hit:`, {t1: normalizedStatus.target_1, t2: normalizedStatus.target_2, t3: normalizedStatus.target_3});
      return currentTrade;
    }

    // Mark safebook as hit - this blocks stop loss but doesn't clear anything else
    normalizedStatus.safebook = true;

    console.log(`📋 Updated safebook status:`, normalizedStatus);

    const [updatedTrade] = await db
      .update(trades)
      .set({ 
        targetStatus: normalizedStatus, // Use normalized V2 format
        safebookPrice: safebook.price, // Set the safebook price
        updatedAt: new Date() 
      })
      .where(eq(trades.id, id))
      .returning();
    
    if (updatedTrade) {
      console.log(`✅ Safebook updated successfully for trade: ${updatedTrade.id}`);
    }

    return updatedTrade;
  }

  // Automation operations
  async getAutomations(): Promise<any[]> {
    return await db
      .select({
        id: automations.id,
        name: automations.name,
        channelId: automations.channelId,
        templateId: automations.templateId,
        triggerType: automations.triggerType,
        automationType: automations.automationType,
        scheduledTime: automations.scheduledTime,
        scheduledDays: automations.scheduledDays,
        isActive: automations.isActive,
        createdAt: automations.createdAt,
        updatedAt: automations.updatedAt,
        channel: {
          name: telegramChannels.name,
        },
        template: {
          name: messageTemplates.name,
        },
      })
      .from(automations)
      .leftJoin(telegramChannels, eq(automations.channelId, telegramChannels.id))
      .leftJoin(messageTemplates, eq(automations.templateId, messageTemplates.id))
      .orderBy(desc(automations.createdAt));
  }

  async getAutomation(id: string): Promise<Automation | undefined> {
    const [automation] = await db.select().from(automations).where(eq(automations.id, id));
    return automation;
  }

  async createAutomation(automation: InsertAutomation): Promise<Automation> {
    const [newAutomation] = await db.insert(automations).values(automation).returning();
    return newAutomation;
  }

  async updateAutomation(id: string, automation: Partial<InsertAutomation>): Promise<Automation | undefined> {
    const [updatedAutomation] = await db
      .update(automations)
      .set({ ...automation, updatedAt: new Date() })
      .where(eq(automations.id, id))
      .returning();
    return updatedAutomation;
  }

  async deleteAutomation(id: string): Promise<boolean> {
    // First, delete related sent_messages to avoid foreign key constraint
    await db.delete(sentMessages).where(eq(sentMessages.automationId, id));
    
    // Then delete the automation
    const result = await db.delete(automations).where(eq(automations.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async toggleAutomationStatus(id: string, isActive: boolean): Promise<Automation | undefined> {
    const [updatedAutomation] = await db
      .update(automations)
      .set({ 
        isActive: isActive,
        updatedAt: new Date() 
      })
      .where(eq(automations.id, id))
      .returning();
    return updatedAutomation;
  }

  // Sent message operations
  async getSentMessages(filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const { status, limit = 100, offset = 0 } = filters || {};

    let conditions = [];
    
    if (status) {
      conditions.push(eq(sentMessages.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Helper function to calculate gain/loss percentage
    const calculateGainLoss = (trade: any): { percentage: number; isGain: boolean } => {
      if (!trade.price || !trade.leverage || !trade.completionReason) {
        return { percentage: 0, isGain: true };
      }

      const entryPrice = Number(trade.price);
      const leverage = Number(trade.leverage);
      let exitPrice = entryPrice;

      // Determine exit price based on completion reason
      switch (trade.completionReason) {
        case 'stop_loss_hit':
          exitPrice = trade.stopLossTrigger ? Number(trade.stopLossTrigger) : entryPrice;
          break;
        case 'target_1_hit':
          exitPrice = trade.takeProfitTrigger ? Number(trade.takeProfitTrigger) : entryPrice;
          break;
        case 'target_2_hit':
          exitPrice = trade.takeProfit2 ? Number(trade.takeProfit2) : entryPrice;
          break;
        case 'target_3_hit':
          exitPrice = trade.takeProfit3 ? Number(trade.takeProfit3) : entryPrice;
          break;
        default:
          return { percentage: 0, isGain: true };
      }

      // Calculate percentage change
      let percentageChange;
      if (trade.type === 'buy') {
        percentageChange = ((exitPrice - entryPrice) / entryPrice) * 100;
      } else {
        percentageChange = ((entryPrice - exitPrice) / entryPrice) * 100;
      }

      // Apply leverage
      const leveragedPercentage = percentageChange * leverage;
      const isGain = leveragedPercentage > 0;

      return {
        percentage: Math.abs(leveragedPercentage),
        isGain
      };
    };

    return await db
      .select({
        id: sentMessages.id,
        automationId: sentMessages.automationId,
        tradeId: sentMessages.tradeId,
        telegramMessageId: sentMessages.telegramMessageId,
        channelId: sentMessages.channelId,
        messageText: sentMessages.messageText,
        status: sentMessages.status,
        errorMessage: sentMessages.errorMessage,
        sentAt: sentMessages.sentAt,
        createdAt: sentMessages.createdAt,
        automation: {
          name: automations.name,
          triggerType: automations.triggerType,
        },
        trade: {
          pair: trades.pair,
          type: trades.type,
        },
        channel: {
          name: telegramChannels.name,
        },
      })
      .from(sentMessages)
      .leftJoin(automations, eq(sentMessages.automationId, automations.id))
      .leftJoin(trades, eq(sentMessages.tradeId, trades.id))
      .leftJoin(telegramChannels, eq(sentMessages.channelId, telegramChannels.channelId))
      .where(whereClause)
      .orderBy(desc(sentMessages.sentAt))
      .limit(limit)
      .offset(offset);
  }

  async logSentMessage(message: InsertSentMessage): Promise<SentMessage> {
    const [newMessage] = await db.insert(sentMessages).values(message).returning();
    return newMessage;
  }
}

export const storage = new DatabaseStorage();
