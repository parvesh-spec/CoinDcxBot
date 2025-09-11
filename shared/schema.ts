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
  buttons: jsonb("buttons").default([]), // Inline keyboard buttons
  parseMode: varchar("parse_mode").default("HTML"), // HTML or Markdown
  imageUrl: text("image_url"), // Optional image URL from object storage
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
  safebookPrice: decimal("safebook_price", { precision: 20, scale: 8 }),
  targetStatus: jsonb("target_status").default({}), // Track which targets are hit: {t1: true, t2: false, t3: false, safebook: false, stop_loss: false}
  status: varchar("status").notNull().default('active'), // 'active', 'completed'
  completionReason: varchar("completion_reason"), // 'stop_loss_hit', 'target_1_hit', 'target_2_hit', 'target_3_hit', 'safe_book'
  notes: text("notes"), // User notes when marking as completed
  channelId: varchar("channel_id").references(() => telegramChannels.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Automation rules table
export const automations = pgTable("automations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  channelId: varchar("channel_id").notNull().references(() => telegramChannels.id),
  templateId: varchar("template_id").notNull().references(() => messageTemplates.id),
  triggerType: varchar("trigger_type").notNull(), // 'trade_registered', 'trade_completed'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sent messages tracking table
export const sentMessages = pgTable("sent_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  automationId: varchar("automation_id").notNull().references(() => automations.id),
  tradeId: varchar("trade_id").notNull().references(() => trades.id),
  telegramMessageId: varchar("telegram_message_id"), // Telegram's message ID
  channelId: varchar("channel_id").notNull(), // Telegram channel ID
  messageText: text("message_text"), // The actual message content sent
  status: varchar("status").notNull().default('pending'), // 'sent', 'failed', 'pending'
  errorMessage: text("error_message"), // Error details if failed
  sentAt: timestamp("sent_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
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

export const tradeRelations = relations(trades, ({ one, many }) => ({
  channel: one(telegramChannels, {
    fields: [trades.channelId],
    references: [telegramChannels.id],
  }),
  sentMessages: many(sentMessages),
}));

export const automationRelations = relations(automations, ({ one, many }) => ({
  channel: one(telegramChannels, {
    fields: [automations.channelId],
    references: [telegramChannels.id],
  }),
  template: one(messageTemplates, {
    fields: [automations.templateId],
    references: [messageTemplates.id],
  }),
  sentMessages: many(sentMessages),
}));

export const sentMessageRelations = relations(sentMessages, ({ one }) => ({
  automation: one(automations, {
    fields: [sentMessages.automationId],
    references: [automations.id],
  }),
  trade: one(trades, {
    fields: [sentMessages.tradeId],
    references: [trades.id],
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
}).extend({
  includeFields: z.any().optional(), // Make includeFields optional since UI no longer sends it
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(['active', 'completed']).optional(),
  completionReason: z.enum(['stop_loss_hit', 'target_1_hit', 'target_2_hit', 'target_3_hit', 'safe_book']).optional(),
});

export const completeTradeSchema = z.object({
  completionReason: z.enum(['stop_loss_hit', 'target_1_hit', 'target_2_hit', 'target_3_hit', 'safe_book'], {
    required_error: "Please select completion reason",
  }),
  safebookPrice: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  // Require safebook price when completion reason is safe_book
  if (data.completionReason === 'safe_book') {
    if (!data.safebookPrice || data.safebookPrice.trim() === '') {
      return false;
    }
    const price = parseFloat(data.safebookPrice);
    if (isNaN(price) || price <= 0) {
      return false;
    }
  }
  return true;
}, {
  message: "Safe book price is required and must be greater than 0 when completion reason is safe book",
  path: ['safebookPrice']
});

export const updateTradeSchema = createInsertSchema(trades).omit({
  id: true,
  tradeId: true,
  targetStatus: true,
  status: true,
  createdAt: true,
  updatedAt: true,
}).partial().extend({
  // Allow completion reason to be updated
  completionReason: z.enum(['stop_loss_hit', 'target_1_hit', 'target_2_hit', 'target_3_hit', 'safe_book']).optional(),
  safebookPrice: z.string().nullable().optional(),
}).refine((data) => {
  // Require safebook price when completion reason is safe_book
  if (data.completionReason === 'safe_book') {
    if (!data.safebookPrice || data.safebookPrice.trim() === '') {
      return false;
    }
    const price = parseFloat(data.safebookPrice);
    if (isNaN(price) || price <= 0) {
      return false;
    }
  }
  return true;
}, {
  message: "Safe book price is required and must be greater than 0 when completion reason is safe book",
  path: ['safebookPrice']
}); // Make all fields optional for partial updates

export const insertAutomationSchema = createInsertSchema(automations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  triggerType: z.enum(['trade_registered', 'trade_completed'], {
    required_error: "Please select trigger type",
  }),
});

export const insertSentMessageSchema = createInsertSchema(sentMessages).omit({
  id: true,
  createdAt: true,
}).extend({
  status: z.enum(['sent', 'failed', 'pending']).optional(),
});

// Image upload schemas
export const uploadUrlRequestSchema = z.object({
  // Upload URL requests don't require any body parameters
});

export const finalizeImageUploadSchema = z.object({
  imageURL: z.string()
    .url("Must be a valid URL")
    .refine((url) => {
      try {
        const parsedUrl = new URL(url);
        // Must be from Google Cloud Storage for our storage service
        return parsedUrl.hostname === 'storage.googleapis.com';
      } catch {
        return false;
      }
    }, "Image URL must be from authorized storage provider")
    .refine((url) => {
      try {
        const parsedUrl = new URL(url);
        const path = parsedUrl.pathname;
        // Must be in the uploads directory structure
        return path.includes('/uploads/') && !path.includes('../') && !path.includes('..\\');
      } catch {
        return false;
      }
    }, "Invalid image URL path - path traversal detected"),
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
export type CompleteTrade = z.infer<typeof completeTradeSchema>;
export type UpdateTrade = z.infer<typeof updateTradeSchema>;
export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type SentMessage = typeof sentMessages.$inferSelect;
export type InsertSentMessage = z.infer<typeof insertSentMessageSchema>;
export type UploadUrlRequest = z.infer<typeof uploadUrlRequestSchema>;
export type FinalizeImageUpload = z.infer<typeof finalizeImageUploadSchema>;
