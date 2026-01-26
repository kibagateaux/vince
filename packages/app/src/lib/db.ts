/**
 * @module @bangui/app/lib/db
 * Shared database instance for API routes
 */

import { createDb, type Db } from '@bangui/db';

// Global database instance - reused across serverless function invocations
let db: Db | null = null;

/**
 * Gets the shared database instance
 * Creates one if it doesn't exist (singleton pattern for serverless)
 */
export const getDb = (): Db => {
  if (!db) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    db = createDb({
      connectionString: process.env.DATABASE_URL,
      maxConnections: 1, // Optimized for serverless
    });
  }
  return db;
};
