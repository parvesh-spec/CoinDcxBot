import {
  users,
  telegramChannels,
  messageTemplates,
  trades,
  type User,
  type InsertUser,
  type TelegramChannel,
  type InsertTelegramChannel,
  type MessageTemplate,
  type InsertMessageTemplate,
  type Trade,
  type InsertTrade,
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
  getTradeStats(): Promise<{
    total: number;
    posted: number;
    pending: number;
    failed: number;
  }>;
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
  async getTelegramChannels(): Promise<TelegramChannel[]> {
    return await db.select().from(telegramChannels).orderBy(desc(telegramChannels.createdAt));
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
    posted: number;
    pending: number;
    failed: number;
  }> {
    const [stats] = await db
      .select({
        total: sql<number>`count(*)`,
        posted: sql<number>`count(*) filter (where status = 'posted')`,
        pending: sql<number>`count(*) filter (where status = 'pending')`,
        failed: sql<number>`count(*) filter (where status = 'failed')`
      })
      .from(trades);

    return {
      total: stats.total || 0,
      posted: stats.posted || 0,
      pending: stats.pending || 0,
      failed: stats.failed || 0
    };
  }
}

export const storage = new DatabaseStorage();
