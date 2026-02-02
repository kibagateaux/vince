/**
 * @module @bangui/app/lib/db
 * Database module with Supabase client and queries
 */

// Re-export client
export { getSupabase, type Db } from './client';

// Re-export types
export * from './types';

// Re-export all query functions
export * from './queries/users';
export * from './queries/conversations';
export * from './queries/messages';
export * from './queries/questionnaire';
export * from './queries/profiles';
export * from './queries/stories';
export * from './queries/wallets';
export * from './queries/deposits';
export * from './queries/allocations';
export * from './queries/agent-conversations';
export * from './queries/treasury';
