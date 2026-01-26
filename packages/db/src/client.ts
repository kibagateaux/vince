/**
 * @module @bangui/db/client
 * Database client initialization and connection management
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

/**
 * Database configuration options
 */
export interface DbConfig {
  /** PostgreSQL connection string */
  readonly connectionString: string;
  /** Maximum connections in pool */
  readonly maxConnections?: number;
}

/**
 * Creates a database client instance
 * @param config - Database configuration
 * @returns Drizzle ORM database instance
 * @example
 * ```ts
 * const db = createDb({ connectionString: process.env.DATABASE_URL });
 * const users = await db.select().from(schema.users);
 * ```
 */
export const createDb = (config: DbConfig) => {
  const client = postgres(config.connectionString, {
    max: config.maxConnections ?? 10,
  });
  return drizzle(client, { schema });
};

/** Database instance type */
export type Db = ReturnType<typeof createDb>;
