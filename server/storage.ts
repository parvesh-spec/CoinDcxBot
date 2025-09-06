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
  type Automation,
  type InsertAutomation,
  type SentMessage,
  type InsertSentMessage,
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
  updateTrade(id: string, trade: Partial<InsertTrade>): Promise<Trade | undefined>;
  completeTrade(id: string, completion: CompleteTrade): Promise<Trade | undefined>;
  getTradeStats(): Promise<{
    total: number;
    active: number;
    completed: number;
  }>;

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
    const [newTemplate] = await db.insert(messageTemplates).values(template).returning();
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

    return {
      trades: tradesResult,
      total: totalResult[0]?.count || 0
    };
  }

  async getTrade(id: string): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(eq(trades.id, id));
    return trade;
  }

  async getTradeByTradeId(tradeId: string): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(eq(trades.tradeId, tradeId));
    return trade;
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [newTrade] = await db.insert(trades).values(trade).returning();
    return newTrade;
  }

  async updateTrade(id: string, trade: Partial<InsertTrade>): Promise<Trade | undefined> {
    const [updatedTrade] = await db
      .update(trades)
      .set({ ...trade, updatedAt: new Date() })
      .where(eq(trades.id, id))
      .returning();
    return updatedTrade;
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
    const [updatedTrade] = await db
      .update(trades)
      .set({ 
        status: 'completed',
        completionReason: completion.completionReason,
        notes: completion.notes,
        updatedAt: new Date() 
      })
      .where(eq(trades.id, id))
      .returning();
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
    const result = await db.delete(automations).where(eq(automations.id, id));
    return (result.rowCount ?? 0) > 0;
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

    return await db
      .select({
        id: sentMessages.id,
        automationId: sentMessages.automationId,
        tradeId: sentMessages.tradeId,
        telegramMessageId: sentMessages.telegramMessageId,
        channelId: sentMessages.channelId,
        status: sentMessages.status,
        errorMessage: sentMessages.errorMessage,
        sentAt: sentMessages.sentAt,
        createdAt: sentMessages.createdAt,
        automation: {
          name: automations.name,
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
