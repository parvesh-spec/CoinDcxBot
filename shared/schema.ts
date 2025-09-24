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
  templateType: varchar("template_type").notNull().default('trade'), // 'simple' or 'trade'
  includeFields: jsonb("include_fields").notNull(),
  buttons: jsonb("buttons").default([]), // Inline keyboard buttons
  parseMode: varchar("parse_mode").default("HTML"), // HTML or Markdown
  imageUrl: text("image_url"), // Optional image URL from object storage
  isActive: boolean("is_active").default(true),
  isArchived: boolean("is_archived").default(false),
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
  exchangeExited: boolean("exchange_exited").default(false), // Track if position was exited on exchange
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
  automationType: varchar("automation_type").notNull(), // 'trade' or 'simple'
  triggerType: varchar("trigger_type").notNull(), // For trade: 'trade_registered', 'trade_completed', etc. For simple: 'scheduled'
  scheduledTime: varchar("scheduled_time"), // For simple automations: "09:00" (24h format, Kolkata timezone)
  scheduledDays: jsonb("scheduled_days").default(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']), // Days of week for simple automations
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sent messages tracking table
export const sentMessages = pgTable("sent_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  automationId: varchar("automation_id").notNull().references(() => automations.id),
  tradeId: varchar("trade_id").references(() => trades.id), // Nullable for simple message automations
  telegramMessageId: varchar("telegram_message_id"), // Telegram's message ID
  replyToMessageId: varchar("reply_to_message_id"), // Reply to this telegram message ID
  channelId: varchar("channel_id").notNull(), // Telegram channel ID
  messageText: text("message_text"), // The actual message content sent
  status: varchar("status").notNull().default('pending'), // 'sent', 'failed', 'pending'
  errorMessage: text("error_message"), // Error details if failed
  sentAt: timestamp("sent_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Copy Trading Users table
export const copyTradingUsers = pgTable("copy_trading_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // Display name for the user
  email: varchar("email").notNull().unique(), // Email address (mandatory)
  telegramId: varchar("telegram_id"), // Telegram user ID (optional)
  telegramUsername: varchar("telegram_username"), // @username for easy identification
  exchange: varchar("exchange").notNull().default('coindcx'), // 'coindcx', 'binance', 'delta' (future)
  apiKey: text("api_key").notNull(), // Encrypted API key
  apiSecret: text("api_secret").notNull(), // Encrypted API secret
  riskPerTrade: decimal("risk_per_trade", { precision: 5, scale: 2 }).notNull().default('2.00'), // Risk % per trade (e.g., 2.00%)
  tradeFund: decimal("trade_fund", { precision: 12, scale: 2 }).notNull().default('100.00'), // Fixed fund amount per trade in USDT (e.g., 100.00 USDT)
  maxTradesPerDay: integer("max_trades_per_day"), // Max trades per day (optional, e.g., 2 means only first 2 trades copied)
  isActive: boolean("is_active").default(true), // Enable/disable copy trading
  lowFund: boolean("low_fund").default(false), // True when futures wallet balance < trade fund
  futuresWalletBalance: decimal("futures_wallet_balance", { precision: 20, scale: 8 }).default('0.00'), // USDT balance from futures wallet
  notes: text("notes"), // Optional notes about the user
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Copy Trades table - tracks trades executed for copy trading users
export const copyTrades = pgTable("copy_trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalTradeId: varchar("original_trade_id").notNull().references(() => trades.id, { onDelete: "cascade" }), // Reference to original trade
  copyUserId: varchar("copy_user_id").notNull().references(() => copyTradingUsers.id), // Which copy user
  executedTradeId: varchar("executed_trade_id"), // Exchange trade ID after execution
  pair: varchar("pair").notNull(), // Trading pair (same as original)
  type: varchar("type").notNull(), // 'buy' or 'sell'
  originalPrice: decimal("original_price", { precision: 20, scale: 8 }).notNull(), // Original trade price
  executedPrice: decimal("executed_price", { precision: 20, scale: 8 }), // Actual executed price
  originalQuantity: decimal("original_quantity", { precision: 20, scale: 8 }).notNull(), // Original quantity
  executedQuantity: decimal("executed_quantity", { precision: 20, scale: 8 }), // Actual executed quantity (adjusted for risk)
  leverage: integer("leverage").notNull(), // Leverage used
  status: varchar("status").notNull().default('pending'), // 'pending', 'executed', 'failed', 'cancelled'
  executionTime: timestamp("execution_time"), // When trade was executed
  errorMessage: text("error_message"), // Error details if failed
  pnl: decimal("pnl", { precision: 20, scale: 8 }), // P&L if trade is closed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Copy Trading Applications table - tracks public applications before approval
export const copyTradingApplications = pgTable("copy_trading_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // Display name for the user
  email: varchar("email").notNull(), // Email address (mandatory)
  telegramId: varchar("telegram_id"), // Telegram user ID (optional)
  telegramUsername: varchar("telegram_username"), // @username for easy identification
  exchange: varchar("exchange").notNull().default('coindcx'), // 'coindcx', 'binance', 'delta' (future)
  apiKey: text("api_key").notNull(), // API key for verification
  apiSecret: text("api_secret").notNull(), // API secret for verification
  riskPerTrade: decimal("risk_per_trade", { precision: 5, scale: 2 }).notNull().default('2.00'), // Risk % per trade
  tradeFund: decimal("trade_fund", { precision: 12, scale: 2 }).notNull().default('100.00'), // Fixed fund amount per trade in USDT
  maxTradesPerDay: integer("max_trades_per_day"), // Max trades per day (optional)
  status: varchar("status").notNull().default('pending'), // 'pending', 'approved', 'rejected'
  adminNotes: text("admin_notes"), // Admin notes/comments during review
  rejectionReason: text("rejection_reason"), // Reason for rejection
  processedBy: varchar("processed_by"), // Admin user ID who processed
  processedAt: timestamp("processed_at"), // When it was processed
  notes: text("notes"), // User's additional notes
  credentialsVerified: boolean("credentials_verified").default(false), // Whether API credentials were verified
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// OTP Verification table - for email verification during application process
export const otpVerifications = pgTable("otp_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(), // Email address for which OTP is generated
  otp: varchar("otp", { length: 6 }).notNull(), // 6-digit OTP code
  purpose: varchar("purpose").notNull().default('application_submission'), // 'application_submission', 'password_reset', etc.
  attempts: integer("attempts").default(0), // Number of verification attempts
  maxAttempts: integer("max_attempts").default(3), // Maximum allowed attempts
  isVerified: boolean("is_verified").default(false), // Whether OTP has been verified
  expiresAt: timestamp("expires_at").notNull(), // When OTP expires (usually 10 minutes)
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

// Copy Trading Relations
export const copyTradingUserRelations = relations(copyTradingUsers, ({ many }) => ({
  copyTrades: many(copyTrades),
}));

export const copyTradeRelations = relations(copyTrades, ({ one }) => ({
  originalTrade: one(trades, {
    fields: [copyTrades.originalTradeId],
    references: [trades.id],
  }),
  copyUser: one(copyTradingUsers, {
    fields: [copyTrades.copyUserId],
    references: [copyTradingUsers.id],
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
  templateType: z.enum(['simple', 'trade'], {
    required_error: "Please select template type",
  }),
  includeFields: z.any().optional(), // Make includeFields optional since UI no longer sends it
}).refine((data) => {
  // For simple templates, check for variables and reject them
  if (data.templateType === 'simple') {
    const variablePattern = /{[a-zA-Z_][a-zA-Z0-9_]*}/g;
    const variables = data.template.match(variablePattern);
    if (variables && variables.length > 0) {
      return false;
    }
  }
  return true;
}, {
  message: "Simple message templates cannot contain variables like {pair}, {price}, etc. Use static text only.",
  path: ['template']
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(['active', 'completed']).optional(),
  completionReason: z.enum(['stop_loss_hit', 'target_1_hit', 'target_2_hit', 'target_3_hit', 'safe_book', 'manual_exit']).optional(),
});

export const completeTradeSchema = z.object({
  // completionReason is no longer required - auto-derived from targetStatus in backend
  safebookPrice: z.string().optional(),
  notes: z.string().optional(),
});

// Target Status Types - 5-field system
export type TargetStatusV2 = {
  stop_loss: boolean;
  safebook: boolean;
  target_1: boolean;
  target_2: boolean; 
  target_3: boolean;
};

// Legacy target status type for backward compatibility
export type TargetStatusLegacy = {
  stop_loss?: boolean;
  safebook?: boolean;
  t1?: boolean; // Legacy field
  t2?: boolean; // Legacy field  
  t3?: boolean; // Legacy field
  target_1?: boolean;
  target_2?: boolean;
  target_3?: boolean;
};

// Helper function to safely convert various boolean representations
function safeBooleanConvert(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  if (typeof value === 'number') return value !== 0;
  return Boolean(value);
}

// Zod schema for TargetStatusV2 validation
export const targetStatusV2Schema = z.object({
  stop_loss: z.boolean().default(false),
  safebook: z.boolean().default(false),
  target_1: z.boolean().default(false),
  target_2: z.boolean().default(false),
  target_3: z.boolean().default(false),
});

// Normalize legacy target status to new V2 format
export function normalizeTargetStatus(ts: any): TargetStatusV2 {
  const status = ts || {};
  return {
    stop_loss: safeBooleanConvert(status.stop_loss),
    safebook: safeBooleanConvert(status.safebook),
    target_1: safeBooleanConvert(status.target_1 || status.t1), // Map legacy t1 to target_1
    target_2: safeBooleanConvert(status.target_2 || status.t2), // Map legacy t2 to target_2  
    target_3: safeBooleanConvert(status.target_3 || status.t3), // Map legacy t3 to target_3
  };
}

// Target type enum for API validation (includes safebook)
export const targetTypeEnum = z.enum(['stop_loss', 'safebook', 'target_1', 'target_2', 'target_3']);
export type TargetType = z.infer<typeof targetTypeEnum>;

// Update target status schema
export const updateTargetStatusSchema = z.object({
  targetType: targetTypeEnum,
  hit: z.boolean().default(true),
});

export type UpdateTargetStatus = z.infer<typeof updateTargetStatusSchema>;

export const updateSafebookSchema = z.object({
  price: z.string()
    .min(1, "Safebook price is required")
    .refine((price) => {
      const num = parseFloat(price.trim());
      return !isNaN(num) && num > 0;
    }, "Price must be a valid number greater than 0")
});

export type UpdateSafebook = z.infer<typeof updateSafebookSchema>;

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
  automationType: z.enum(['trade', 'simple'], {
    required_error: "Please select automation type",
  }),
  triggerType: z.string().min(1, "Please select trigger type"),
  scheduledTime: z.string().optional(), // For simple automations - "09:00" format
  scheduledDays: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional(),
}).refine((data) => {
  // For simple automations, require scheduledTime
  if (data.automationType === 'simple') {
    if (!data.scheduledTime || !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(data.scheduledTime)) {
      return false;
    }
    if (data.triggerType !== 'scheduled') {
      return false;
    }
  }
  
  // For trade automations, validate triggerType is one of the trade types
  if (data.automationType === 'trade') {
    const validTradeTypes = ['trade_registered', 'stop_loss_hit', 'safe_book_hit', 'target_1_hit', 'target_2_hit', 'target_3_hit'];
    if (!validTradeTypes.includes(data.triggerType)) {
      return false;
    }
  }
  
  return true;
}, {
  message: "Invalid automation configuration. Simple automations require scheduled time in HH:MM format and triggerType must be 'scheduled'. Trade automations require valid trade trigger type.",
  path: ['scheduledTime']
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
    .min(1, "Image URL is required")
    .refine((url) => {
      // Accept relative /objects/ URLs from our own server
      if (url.startsWith('/objects/')) {
        // Must be in the templates/uploads directory structure
        return url.includes('/templates/') && 
               url.includes('/uploads/') && 
               !url.includes('../') && 
               !url.includes('..\\');
      }
      
      // Also accept legacy Google Cloud Storage URLs
      try {
        const parsedUrl = new URL(url);
        // Must be from Google Cloud Storage for our storage service
        if (parsedUrl.hostname !== 'storage.googleapis.com') {
          return false;
        }
        const path = parsedUrl.pathname;
        // Must be in the uploads directory structure
        return path.includes('/uploads/') && !path.includes('../') && !path.includes('..\\');
      } catch {
        return false;
      }
    }, "Invalid image URL - must be from authorized storage provider and in valid upload directory"),
});

// Copy Trading Schemas
export const insertCopyTradingUserSchema = createInsertSchema(copyTradingUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  email: z.string().email("Please enter a valid email address"),
  telegramId: z.string().optional(),
  riskPerTrade: z.coerce.number().min(5, "Risk per trade must be at least 5%").max(50, "Risk per trade cannot exceed 50%"),
  tradeFund: z.coerce.number().min(100, "Trade fund must be at least 100 USDT").max(100000, "Trade fund cannot exceed 100,000 USDT"),
  maxTradesPerDay: z.coerce.number().min(1, "Max trades per day must be at least 1").max(20, "Max trades per day cannot exceed 20").optional(),
});

export const insertCopyTradeSchema = createInsertSchema(copyTrades).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  executionTime: true,
});

// Copy Trading Application Schemas
export const insertCopyTradingApplicationSchema = createInsertSchema(copyTradingApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  adminNotes: true,
  rejectionReason: true,
  processedBy: true,
  processedAt: true,
  credentialsVerified: true,
}).extend({
  email: z.string().email("Please enter a valid email address"),
  telegramId: z.string().optional(),
  apiKey: z.string().min(1, "API Key is required"),
  apiSecret: z.string().min(1, "API Secret is required"),
  riskPerTrade: z.coerce.number().min(5, "Risk per trade must be at least 5%").max(50, "Risk per trade cannot exceed 50%"),
  tradeFund: z.coerce.number().min(100, "Trade fund must be at least 100 USDT").max(100000, "Trade fund cannot exceed 100,000 USDT"),
  maxTradesPerDay: z.coerce.number().min(1, "Max trades per day must be at least 1").max(20, "Max trades per day cannot exceed 20").optional(),
});

export const processApplicationSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  adminNotes: z.string().optional(),
  rejectionReason: z.string().optional(),
});

// OTP Verification Schemas
export const insertOtpVerificationSchema = createInsertSchema(otpVerifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  attempts: true,
  isVerified: true,
}).extend({
  email: z.string().email("Please enter a valid email address"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  purpose: z.string().default('application_submission'),
});

export const verifyOtpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  purpose: z.string().default('application_submission'),
});

export const sendOtpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  purpose: z.string().default('application_submission'),
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
export type CopyTradingUser = typeof copyTradingUsers.$inferSelect;
export type InsertCopyTradingUser = z.infer<typeof insertCopyTradingUserSchema>;
export type CopyTrade = typeof copyTrades.$inferSelect;
export type InsertCopyTrade = z.infer<typeof insertCopyTradeSchema>;
export type OtpVerification = typeof otpVerifications.$inferSelect;
export type InsertOtpVerification = z.infer<typeof insertOtpVerificationSchema>;
export type VerifyOtp = z.infer<typeof verifyOtpSchema>;
export type SendOtp = z.infer<typeof sendOtpSchema>;
