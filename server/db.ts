import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool with proper timeouts and retry logic
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Connection timeout configuration for Neon Serverless
  connectionTimeoutMillis: 10000, // 10 seconds connection timeout
  idleTimeoutMillis: 300000,      // 5 minutes idle timeout
  maxUses: 7500,                  // Max uses per connection (Neon limit)
  max: 10                         // Max concurrent connections
});

export const db = drizzle({ client: pool, schema });