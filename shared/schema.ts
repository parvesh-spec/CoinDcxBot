import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for simple auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(),
  password: varchar("password").notNull(),
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Message templates table (define first to avoid circular reference)
export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  channelId: varchar("channel_id"), // Nullable, no FK to avoid circular reference
  template: text("template").notNull(),
  includeFields: jsonb("include_fields").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Telegram channels table
export const telegramChannels = pgTable("telegram_channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  channelId: varchar("channel_id").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  templateId: varchar("template_id").references(() => messageTemplates.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Trades table
export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeId: varchar("trade_id").notNull().unique(),
  pair: varchar("pair").notNull(),
  type: varchar("type").notNull(), // 'buy' or 'sell'
  price: decimal("price", { precision: 20, scale: 8 }).notNull(),
  leverage: integer("leverage").notNull(),
  total: decimal("total", { precision: 20, scale: 8 }).notNull(),
  fee: decimal("fee", { precision: 20, scale: 8 }),
  takeProfitTrigger: decimal("take_profit_trigger", { precision: 20, scale: 8 }),
  takeProfit2: decimal("take_profit_2", { precision: 20, scale: 8 }),
  takeProfit3: decimal("take_profit_3", { precision: 20, scale: 8 }),
  stopLossTrigger: decimal("stop_loss_trigger", { precision: 20, scale: 8 }),
  status: varchar("status").notNull().default('pending'), // 'pending', 'posted', 'failed'
  channelId: varchar("channel_id").references(() => telegramChannels.id),
  messageId: varchar("message_id"), // Telegram message ID after posting
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations (no circular references)

// Relations
export const channelRelations = relations(telegramChannels, ({ many, one }) => ({
  templates: many(messageTemplates),
  trades: many(trades),
  defaultTemplate: one(messageTemplates, {
    fields: [telegramChannels.templateId],
    references: [messageTemplates.id],
  }),
}));

export const templateRelations = relations(messageTemplates, ({ one }) => ({
  channel: one(telegramChannels, {
    fields: [messageTemplates.channelId],
    references: [telegramChannels.id],
  }),
}));

export const tradeRelations = relations(trades, ({ one }) => ({
  channel: one(telegramChannels, {
    fields: [trades.channelId],
    references: [telegramChannels.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = insertUserSchema.extend({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const insertTelegramChannelSchema = createInsertSchema(telegramChannels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginSchema>;
export type RegisterUser = z.infer<typeof registerSchema>;
export type User = typeof users.$inferSelect;
export type TelegramChannel = typeof telegramChannels.$inferSelect;
export type InsertTelegramChannel = z.infer<typeof insertTelegramChannelSchema>;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;
export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
