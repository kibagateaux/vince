/**
 * @module @bangui/db
 * Database package for Bangui DAF platform
 * @see {@link @bangui/types} for type definitions
 */

export { createDb, type Db, type DbConfig } from './client.js';
export * from './queries.js';
export * as schema from './schema.js';

// Supabase + Vector operations
export {
  getSupabaseAnonClient,
  getSupabaseServiceClient,
  createSupabaseClient,
  resetSupabaseClients,
  type SupabaseConfig,
} from './supabase-client.js';

export {
  storeMemory,
  searchSimilarMemories,
  getMemoriesByAllocationRequest,
  getAgentMemories,
  deleteExpiredMemories,
  updateMemoryImportance,
  type AgentMemory,
  type AgentMemoryType,
  type StoreMemoryInput,
  type MemorySearchFilters,
  type MemorySearchResult,
} from './vector-queries.js';
