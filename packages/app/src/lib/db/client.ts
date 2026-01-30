/**
 * @module @bangui/app/lib/db/client
 * Supabase client initialization and connection management
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Global Supabase instance - reused across serverless function invocations
let supabase: SupabaseClient | null = null;

/**
 * Gets the shared Supabase client instance
 * Creates one if it doesn't exist (singleton pattern for serverless)
 */
export const getSupabase = (): SupabaseClient => {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
    }

    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabase;
};

/** Re-export the Supabase client type for convenience */
export type Db = SupabaseClient;
