import {
  users,
  telegramChannels,
  messageTemplates,
  trades,
  automations,
  sentMessages,
  copyTradingUsers,
  copyTrades,
  copyTradingApplications,
  otpVerifications,
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
  type CopyTradingUser,
  type InsertCopyTradingUser,
  type CopyTrade,
  type InsertCopyTrade,
  type OtpVerification,
  type InsertOtpVerification,
  type VerifyOtp,
  type SendOtp,
  type SendUserAccessOtp,
  type VerifyUserAccessOtp,
  normalizeTargetStatus,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or, ilike } from "drizzle-orm";
import { encrypt, decrypt, safeDecrypt } from "./utils/encryption";

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
  reopenTrade(id: string): Promise<Trade | undefined>;
  manualExitTrade(id: string, notes: string): Promise<Trade | undefined>;
  markExchangeExited(id: string, note: string): Promise<Trade | undefined>;
  addTradeNote(id: string, note: string): Promise<Trade | undefined>;
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

  // Copy Trading operations
  getCopyTradingUsers(): Promise<CopyTradingUser[]>;
  getCopyTradingUser(id: string): Promise<CopyTradingUser | undefined>;
  createCopyTradingUser(user: InsertCopyTradingUser): Promise<CopyTradingUser>;
  updateCopyTradingUser(id: string, user: Partial<InsertCopyTradingUser>): Promise<CopyTradingUser | undefined>;
  toggleCopyTradingUser(id: string, isActive: boolean): Promise<CopyTradingUser | undefined>;
  deleteCopyTradingUser(id: string): Promise<boolean>;
  getActiveCopyTradingUsers(): Promise<CopyTradingUser[]>;
  getCopyTradingUserByEmail(email: string): Promise<CopyTradingUser | undefined>;
  
  // Copy Trading Application operations
  getCopyTradingApplications(filters?: { status?: string; limit?: number; offset?: number }): Promise<{ applications: any[]; total: number }>;
  getCopyTradingApplicationByEmail(email: string): Promise<any | undefined>;
  getCopyTradingApplication(id: string): Promise<any | undefined>;
  createCopyTradingApplication(application: any): Promise<any>;
  updateCopyTradingApplicationStatus(id: string, status: string, notes?: string): Promise<any | undefined>;
  
  // OTP Verification operations
  generateAndSendOTP(data: SendOtp): Promise<{ success: boolean; message: string; otpId?: string }>;
  verifyOTP(data: VerifyOtp): Promise<{ success: boolean; message: string; verified?: boolean }>;
  isEmailVerified(email: string, purpose?: string): Promise<boolean>;
  cleanupExpiredOTPs(): Promise<number>;
  getOTPStats(): Promise<{ total: number; active: number; expired: number; verified: number }>;

  // Copy Trading User Access operations (for user portal)
  sendUserAccessOtp(data: SendUserAccessOtp): Promise<{ success: boolean; message: string }>;
  verifyUserAccessOtp(data: VerifyUserAccessOtp): Promise<{ success: boolean; copyTradingUser?: CopyTradingUser; message: string }>;
  cleanupExpiredUserOtps(): Promise<number>;
  
  // Copy Trade operations
  getCopyTrades(filters?: {
    userId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ copyTrades: any[]; total: number }>;
  createCopyTrade(copyTrade: InsertCopyTrade): Promise<CopyTrade>;
  updateCopyTradeStatus(id: string, status: string, errorMessage?: string): Promise<CopyTrade | undefined>;
  updateCopyTradeExecution(id: string, executionDetails: {
    executedTradeId?: string;
    executedPrice?: number;
    executedQuantity?: number;
    leverage?: number;
  }): Promise<CopyTrade | undefined>;
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
    let conditions = [eq(messageTemplates.isArchived, false)];
    
    if (channelId) {
      conditions.push(eq(messageTemplates.channelId, channelId));
    }
    
    return await db.select()
      .from(messageTemplates)
      .where(and(...conditions))
      .orderBy(desc(messageTemplates.createdAt));
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
      if (trade.type.toLowerCase() === 'buy') {
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
    // Priority order: StopLoss > T3 > T2 > T1 > SafeBook (auto-completion triggers first)
    let autoCompletionReason = 'target_1_hit'; // default fallback
    
    if (normalizedStatus.stop_loss) {
      autoCompletionReason = 'stop_loss_hit';
    } else if (normalizedStatus.target_3) {
      autoCompletionReason = 'target_3_hit';
    } else if (normalizedStatus.target_2) {
      autoCompletionReason = 'target_2_hit';
    } else if (normalizedStatus.target_1) {
      autoCompletionReason = 'target_1_hit';
    } else if (normalizedStatus.safebook) {
      autoCompletionReason = 'safe_book';
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
          safebookPrice: completion.safebookPrice !== undefined ? completion.safebookPrice : currentTrade.safebookPrice,
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

  async manualExitTrade(id: string, notes: string): Promise<Trade | undefined> {
    console.log(`🚪 Manually exiting trade: ${id} with notes: ${notes}`);
    
    try {
      const [updatedTrade] = await db
        .update(trades)
        .set({ 
          status: 'completed',
          completionReason: 'manual_exit', // Specific reason for manual exits
          notes: notes,
          updatedAt: new Date() 
        })
        .where(eq(trades.id, id))
        .returning();
      
      if (updatedTrade) {
        console.log(`✅ Trade manually exited: ${updatedTrade.id}, reason: manual_exit`);
      }
      
      return updatedTrade;
    } catch (error) {
      console.error(`💥 Database error manually exiting trade ${id}:`, error);
      throw error;
    }
  }

  async markExchangeExited(id: string, note: string): Promise<Trade | undefined> {
    console.log(`🚪 Marking trade as exchange exited: ${id}`);
    
    try {
      // Get existing trade first to append to existing notes
      const existingTrade = await this.getTrade(id);
      if (!existingTrade) {
        console.log(`❌ Trade not found: ${id}`);
        return undefined;
      }
      
      // Append new note to existing notes with timestamp
      const timestamp = new Date().toISOString();
      const newNote = `[${timestamp}] ${note}`;
      const updatedNotes = existingTrade.notes 
        ? `${existingTrade.notes}\n${newNote}`
        : newNote;
      
      const [updatedTrade] = await db
        .update(trades)
        .set({ 
          exchangeExited: true, // Mark as exited on exchange
          notes: updatedNotes,
          updatedAt: new Date() 
        })
        .where(eq(trades.id, id))
        .returning();
      
      if (updatedTrade) {
        console.log(`✅ Trade marked as exchange exited: ${updatedTrade.id}`);
      }
      
      return updatedTrade;
    } catch (error) {
      console.error(`💥 Database error marking trade as exchange exited ${id}:`, error);
      throw error;
    }
  }

  async addTradeNote(id: string, note: string): Promise<Trade | undefined> {
    console.log(`📝 Adding note to trade: ${id}`);
    
    try {
      // Get existing trade first to append to existing notes
      const existingTrade = await this.getTrade(id);
      if (!existingTrade) {
        console.log(`❌ Trade not found: ${id}`);
        return undefined;
      }
      
      // Append new note to existing notes with timestamp
      const timestamp = new Date().toISOString();
      const newNote = `[${timestamp}] ${note}`;
      const updatedNotes = existingTrade.notes 
        ? `${existingTrade.notes}\n${newNote}`
        : newNote;
      
      const [updatedTrade] = await db
        .update(trades)
        .set({ 
          notes: updatedNotes,
          updatedAt: new Date() 
        })
        .where(eq(trades.id, id))
        .returning();
      
      if (updatedTrade) {
        console.log(`✅ Note added to trade: ${updatedTrade.id}`);
      }
      
      return updatedTrade;
    } catch (error) {
      console.error(`💥 Database error adding note to trade ${id}:`, error);
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

  async reopenTrade(id: string): Promise<Trade | undefined> {
    console.log(`🔄 Reopening completed trade: ${id}`);

    // Get current trade
    const currentTrade = await this.getTrade(id);
    if (!currentTrade) {
      console.log(`❌ Trade not found: ${id}`);
      return undefined;
    }

    if (currentTrade.status !== 'completed') {
      console.log(`⚠️ Trade is not completed, cannot reopen: ${id} (status: ${currentTrade.status})`);
      return currentTrade;
    }

    console.log(`📋 Reopening completed trade: ${currentTrade.tradeId}, completionReason: ${currentTrade.completionReason}`);

    try {
      // Reset trade to fresh active state
      const freshTargetStatus: TargetStatusV2 = {
        stop_loss: false,
        safebook: false,
        target_1: false,
        target_2: false,
        target_3: false
      };

      const [reopenedTrade] = await db
        .update(trades)
        .set({ 
          status: 'active', // Change back to active
          completionReason: null, // Clear completion reason
          targetStatus: freshTargetStatus, // Reset all targets to false
          safebookPrice: null, // Clear safebook price
          notes: null, // Clear notes
          updatedAt: new Date() 
        })
        .where(eq(trades.id, id))
        .returning();
      
      if (reopenedTrade) {
        console.log(`✅ Trade reopened successfully: ${reopenedTrade.id}, status: ${reopenedTrade.status}`);
        console.log(`🎯 Reset target status:`, reopenedTrade.targetStatus);
      } else {
        console.log(`❌ Failed to reopen trade: ${id} - no rows returned`);
      }
      
      return reopenedTrade;
    } catch (error) {
      console.error(`💥 Database error reopening trade ${id}:`, error);
      throw error;
    }
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
      if (trade.type.toLowerCase() === 'buy') {
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

  // Copy Trading User operations
  async getCopyTradingUsers(): Promise<CopyTradingUser[]> {
    const users = await db.select().from(copyTradingUsers).orderBy(desc(copyTradingUsers.createdAt));
    
    // Decrypt API credentials for display (for admin use only)
    return users.map(user => ({
      ...user,
      apiKey: safeDecrypt(user.apiKey),
      apiSecret: safeDecrypt(user.apiSecret)
    }));
  }

  async getCopyTradingUser(id: string): Promise<CopyTradingUser | undefined> {
    const [user] = await db.select().from(copyTradingUsers).where(eq(copyTradingUsers.id, id));
    return user;
  }

  async createCopyTradingUser(userData: InsertCopyTradingUser): Promise<CopyTradingUser> {
    // Convert number fields to strings for decimal columns and encrypt API credentials
    const dbData = {
      ...userData,
      riskPerTrade: userData.riskPerTrade.toString(),
      tradeFund: userData.tradeFund?.toString() || '100.00',
      maxTradesPerDay: userData.maxTradesPerDay || null,
      lowFund: false, // Default to false when creating new user
      futuresWalletBalance: '0.00', // Default to 0 when creating new user
      apiKey: encrypt(userData.apiKey),
      apiSecret: encrypt(userData.apiSecret),
    };
    const [user] = await db.insert(copyTradingUsers).values(dbData).returning();
    
    // Decrypt credentials for return value
    return {
      ...user,
      apiKey: safeDecrypt(user.apiKey),
      apiSecret: safeDecrypt(user.apiSecret)
    };
  }

  async updateCopyTradingUser(id: string, userData: Partial<InsertCopyTradingUser>): Promise<CopyTradingUser | undefined> {
    // Only include fields that are actually provided (not undefined)
    const dbData: any = { updatedAt: new Date() };
    
    // Handle each field individually to avoid overwriting with undefined values
    if (userData.name !== undefined) dbData.name = userData.name;
    if (userData.email !== undefined) dbData.email = userData.email;
    if (userData.telegramId !== undefined) dbData.telegramId = userData.telegramId;
    if (userData.telegramUsername !== undefined) dbData.telegramUsername = userData.telegramUsername;
    if (userData.exchange !== undefined) dbData.exchange = userData.exchange;
    if (userData.riskPerTrade !== undefined) dbData.riskPerTrade = userData.riskPerTrade.toString();
    if (userData.tradeFund !== undefined) dbData.tradeFund = userData.tradeFund.toString();
    if (userData.maxTradesPerDay !== undefined) dbData.maxTradesPerDay = userData.maxTradesPerDay || null;
    if (userData.isActive !== undefined) dbData.isActive = userData.isActive;
    if (userData.notes !== undefined) dbData.notes = userData.notes;
    
    // Handle API credentials - only update if both are provided
    if (userData.apiKey !== undefined && userData.apiSecret !== undefined) {
      dbData.apiKey = encrypt(userData.apiKey);
      dbData.apiSecret = encrypt(userData.apiSecret);
    }
    
    const [updatedUser] = await db
      .update(copyTradingUsers)
      .set(dbData)
      .where(eq(copyTradingUsers.id, id))
      .returning();
      
    // Decrypt credentials for return value
    if (updatedUser) {
      return {
        ...updatedUser,
        apiKey: safeDecrypt(updatedUser.apiKey),
        apiSecret: safeDecrypt(updatedUser.apiSecret)
      };
    }
    return updatedUser;
  }

  async toggleCopyTradingUser(id: string, isActive: boolean): Promise<CopyTradingUser | undefined> {
    const [updatedUser] = await db
      .update(copyTradingUsers)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(copyTradingUsers.id, id))
      .returning();
    return updatedUser;
  }

  async deleteCopyTradingUser(id: string): Promise<boolean> {
    const result = await db.delete(copyTradingUsers).where(eq(copyTradingUsers.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getActiveCopyTradingUsers(): Promise<CopyTradingUser[]> {
    return await db.select().from(copyTradingUsers).where(eq(copyTradingUsers.isActive, true));
  }

  async getCopyTradingUserByEmail(email: string): Promise<CopyTradingUser | undefined> {
    const [user] = await db.select().from(copyTradingUsers).where(eq(copyTradingUsers.email, email));
    return user;
  }

  async updateCopyTradingUserWalletBalance(id: string, walletBalance: number): Promise<CopyTradingUser | undefined> {
    // Get current user to check tradeFund for lowFund calculation
    const currentUser = await this.getCopyTradingUser(id);
    if (!currentUser) return undefined;

    const tradeFund = parseFloat(currentUser.tradeFund);
    const lowFund = walletBalance < tradeFund;

    const [updatedUser] = await db
      .update(copyTradingUsers)
      .set({ 
        futuresWalletBalance: walletBalance.toString(),
        lowFund: lowFund,
        updatedAt: new Date() 
      })
      .where(eq(copyTradingUsers.id, id))
      .returning();
    
    return updatedUser;
  }

  async updateCopyTradingUserLowFundStatus(id: string): Promise<CopyTradingUser | undefined> {
    // Get current user data
    const currentUser = await this.getCopyTradingUser(id);
    if (!currentUser) return undefined;

    const walletBalance = parseFloat(currentUser.futuresWalletBalance || '0');
    const tradeFund = parseFloat(currentUser.tradeFund);
    const lowFund = walletBalance < tradeFund;

    const [updatedUser] = await db
      .update(copyTradingUsers)
      .set({ 
        lowFund: lowFund,
        updatedAt: new Date() 
      })
      .where(eq(copyTradingUsers.id, id))
      .returning();
    
    return updatedUser;
  }

  // Copy Trading Application operations
  async getCopyTradingApplicationByEmail(email: string): Promise<any | undefined> {
    const [application] = await db.select().from(copyTradingApplications).where(eq(copyTradingApplications.email, email));
    
    if (!application) return undefined;
    
    // Decrypt API credentials
    return {
      ...application,
      apiKey: safeDecrypt(application.apiKey),
      apiSecret: safeDecrypt(application.apiSecret)
    };
  }

  async createCopyTradingApplication(applicationData: any): Promise<any> {
    // Convert number fields to strings for decimal columns and encrypt API credentials
    const dbData = {
      ...applicationData,
      riskPerTrade: applicationData.riskPerTrade.toString(),
      maxTradesPerDay: applicationData.maxTradesPerDay || null,
      apiKey: encrypt(applicationData.apiKey),
      apiSecret: encrypt(applicationData.apiSecret),
    };
    const [application] = await db.insert(copyTradingApplications).values(dbData).returning();
    
    // Decrypt credentials for return value
    return {
      ...application,
      apiKey: safeDecrypt(application.apiKey),
      apiSecret: safeDecrypt(application.apiSecret)
    };
  }

  async getCopyTradingApplications(filters?: { status?: string; limit?: number; offset?: number }): Promise<{ applications: any[]; total: number }> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    let whereClause = sql`1=1`;
    if (filters?.status) {
      whereClause = and(whereClause, eq(copyTradingApplications.status, filters.status))!;
    }

    const applications = await db
      .select()
      .from(copyTradingApplications)
      .where(whereClause)
      .orderBy(desc(copyTradingApplications.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(copyTradingApplications)
      .where(whereClause);

    // Decrypt API credentials for admin display
    const decryptedApplications = applications.map(app => ({
      ...app,
      apiKey: safeDecrypt(app.apiKey),
      apiSecret: safeDecrypt(app.apiSecret)
    }));

    return { applications: decryptedApplications, total: count };
  }

  async getCopyTradingApplication(id: string): Promise<any | undefined> {
    const [application] = await db.select().from(copyTradingApplications).where(eq(copyTradingApplications.id, id));
    
    if (!application) return undefined;
    
    // Decrypt API credentials
    return {
      ...application,
      apiKey: safeDecrypt(application.apiKey),
      apiSecret: safeDecrypt(application.apiSecret)
    };
  }

  async updateCopyTradingApplicationStatus(id: string, status: string, notes?: string): Promise<any | undefined> {
    const updateData: any = { 
      status, 
      updatedAt: new Date() 
    };
    
    if (notes) {
      updateData.adminNotes = notes;
    }

    const [updatedApplication] = await db
      .update(copyTradingApplications)
      .set(updateData)
      .where(eq(copyTradingApplications.id, id))
      .returning();
    
    return updatedApplication;
  }

  // Copy Trade operations
  async getCopyTrades(filters?: {
    userId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ copyTrades: any[]; total: number }> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    let whereClause = sql`1=1`;
    if (filters?.userId) {
      whereClause = and(whereClause, eq(copyTrades.copyUserId, filters.userId))!;
    }
    if (filters?.status) {
      whereClause = and(whereClause, eq(copyTrades.status, filters.status))!;
    }

    const copyTradesResult = await db
      .select({
        id: copyTrades.id,
        originalTradeId: copyTrades.originalTradeId,
        copyUserId: copyTrades.copyUserId,
        executedTradeId: copyTrades.executedTradeId,
        pair: copyTrades.pair,
        type: copyTrades.type,
        originalPrice: copyTrades.originalPrice,
        executedPrice: copyTrades.executedPrice,
        originalQuantity: copyTrades.originalQuantity,
        executedQuantity: copyTrades.executedQuantity,
        leverage: copyTrades.leverage,
        status: copyTrades.status,
        executionTime: copyTrades.executionTime,
        errorMessage: copyTrades.errorMessage,
        pnl: copyTrades.pnl,
        createdAt: copyTrades.createdAt,
        copyUser: {
          name: copyTradingUsers.name,
          telegramUsername: copyTradingUsers.telegramUsername,
        },
        originalTrade: {
          pair: trades.pair,
          type: trades.type,
          price: trades.price,
        },
      })
      .from(copyTrades)
      .leftJoin(copyTradingUsers, eq(copyTrades.copyUserId, copyTradingUsers.id))
      .leftJoin(trades, eq(copyTrades.originalTradeId, trades.id))
      .where(whereClause)
      .orderBy(desc(copyTrades.createdAt))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(copyTrades)
      .where(whereClause);

    return { copyTrades: copyTradesResult, total: total[0]?.count || 0 };
  }

  async createCopyTrade(copyTradeData: InsertCopyTrade): Promise<CopyTrade> {
    const [copyTrade] = await db.insert(copyTrades).values(copyTradeData).returning();
    return copyTrade;
  }

  async updateCopyTradeStatus(id: string, status: string, errorMessage?: string): Promise<CopyTrade | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }
    if (status === 'executed') {
      updateData.executionTime = new Date();
    }

    const [updatedTrade] = await db
      .update(copyTrades)
      .set(updateData)
      .where(eq(copyTrades.id, id))
      .returning();
    return updatedTrade;
  }

  async updateCopyTradeExecution(id: string, executionDetails: {
    executedTradeId?: string;
    executedPrice?: number;
    executedQuantity?: number;
    leverage?: number;
  }): Promise<CopyTrade | undefined> {
    const updateData: any = { 
      updatedAt: new Date(),
      status: 'executed',
      executionTime: new Date()
    };
    
    // Add execution details if provided
    if (executionDetails.executedTradeId) {
      updateData.executedTradeId = executionDetails.executedTradeId;
    }
    if (executionDetails.executedPrice) {
      updateData.executedPrice = executionDetails.executedPrice.toString();
    }
    if (executionDetails.executedQuantity) {
      updateData.executedQuantity = executionDetails.executedQuantity.toString();
    }
    if (executionDetails.leverage) {
      updateData.leverage = executionDetails.leverage;
    }

    const [updatedTrade] = await db
      .update(copyTrades)
      .set(updateData)
      .where(eq(copyTrades.id, id))
      .returning();
    return updatedTrade;
  }

  // OTP Verification operations
  async generateAndSendOTP(data: SendOtp): Promise<{ success: boolean; message: string; otpId?: string }> {
    const { generateAndSendOTP } = await import('./services/otp');
    return generateAndSendOTP(data);
  }

  async verifyOTP(data: VerifyOtp): Promise<{ success: boolean; message: string; verified?: boolean }> {
    const { verifyOTP } = await import('./services/otp');
    return verifyOTP(data);
  }

  async isEmailVerified(email: string, purpose: string = 'application_submission'): Promise<boolean> {
    const { isEmailVerified } = await import('./services/otp');
    return isEmailVerified(email, purpose);
  }

  async cleanupExpiredOTPs(): Promise<number> {
    const { cleanupExpiredOTPs } = await import('./services/otp');
    return cleanupExpiredOTPs();
  }

  async getOTPStats(): Promise<{ total: number; active: number; expired: number; verified: number }> {
    const { getOTPStats } = await import('./services/otp');
    return getOTPStats();
  }

  // Copy Trading User Access operations (for user portal)
  async sendUserAccessOtp(data: SendUserAccessOtp): Promise<{ success: boolean; message: string }> {
    try {
      // First check if email exists in copyTradingUsers
      const copyTradingUser = await this.getCopyTradingUserByEmail(data.email);
      if (!copyTradingUser) {
        return { 
          success: false, 
          message: 'You are not registered for copy trading. Please contact admin for registration.' 
        };
      }

      // Use existing OTP service with purpose "user_access"
      const result = await this.generateAndSendOTP({ 
        email: data.email, 
        purpose: 'user_access' 
      });
      return { success: result.success, message: result.message };
    } catch (error) {
      console.error('Error sending user access OTP:', error);
      return { success: false, message: 'Failed to send OTP. Please try again.' };
    }
  }

  async verifyUserAccessOtp(data: VerifyUserAccessOtp): Promise<{ success: boolean; copyTradingUser?: CopyTradingUser; message: string }> {
    try {
      // First check if email exists in copyTradingUsers
      const copyTradingUser = await this.getCopyTradingUserByEmail(data.email);
      if (!copyTradingUser) {
        return { 
          success: false, 
          message: 'You are not registered for copy trading. Please contact admin for registration.' 
        };
      }

      // Check if OTP is valid and not expired using existing otpVerifications table
      const [otpRecord] = await db
        .select()
        .from(otpVerifications)
        .where(
          and(
            eq(otpVerifications.email, data.email),
            eq(otpVerifications.otp, data.otp),
            eq(otpVerifications.purpose, 'user_access'),
            eq(otpVerifications.isVerified, false),
            sql`${otpVerifications.expiresAt} > NOW()`
          )
        )
        .orderBy(desc(otpVerifications.createdAt))
        .limit(1);

      if (!otpRecord) {
        return { success: false, message: 'Invalid or expired OTP. Please request a new one.' };
      }

      // Check attempts limit
      const attempts = otpRecord.attempts || 0;
      const maxAttempts = otpRecord.maxAttempts || 3;
      if (attempts >= maxAttempts) {
        return { success: false, message: 'Too many verification attempts. Please request a new OTP.' };
      }

      // Mark OTP as verified
      await db
        .update(otpVerifications)
        .set({ 
          isVerified: true, 
          attempts: attempts + 1,
          updatedAt: new Date()
        })
        .where(eq(otpVerifications.id, otpRecord.id));

      return { 
        success: true, 
        copyTradingUser, 
        message: 'Login successful!' 
      };
    } catch (error) {
      console.error('Error verifying user access OTP:', error);
      return { success: false, message: 'Verification failed. Please try again.' };
    }
  }

  async cleanupExpiredUserOtps(): Promise<number> {
    const result = await db
      .delete(otpVerifications)
      .where(
        and(
          eq(otpVerifications.purpose, 'user_access'),
          sql`${otpVerifications.expiresAt} < NOW()`
        )
      );
    return result.rowCount || 0;
  }
}

export const storage = new DatabaseStorage();
