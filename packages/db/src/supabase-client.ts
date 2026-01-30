/**
 * @module @bangui/db/supabase-client
 * Supabase client factory for vector operations
 * Uses separate clients for anon (client-side) and service role (server-side)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey?: string;
  serviceRoleKey?: string;
}

/** Singleton instances */
let anonClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

/**
 * Creates or returns the Supabase anon client (client-side safe)
 * Use for operations that should respect RLS policies
 */
export function getSupabaseAnonClient(): SupabaseClient {
  if (!anonClient) {
    const url = process.env['SUPABASE_URL'];
    const anonKey = process.env['SUPABASE_ANON_KEY'];

    if (!url || !anonKey) {
      throw new Error(
        'Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables'
      );
    }

    anonClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
    });
  }

  return anonClient;
}

/**
 * Creates or returns the Supabase service role client (server-side only)
 * Bypasses RLS - use only in trusted server contexts
 */
export function getSupabaseServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const url = process.env['SUPABASE_URL'];
    const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

    if (!url || !serviceRoleKey) {
      throw new Error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
      );
    }

    serviceClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return serviceClient;
}

/**
 * Creates a custom Supabase client with provided config
 * Useful for testing or when env vars aren't available
 */
export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  const key = config.serviceRoleKey ?? config.anonKey;
  if (!key) {
    throw new Error('Either anonKey or serviceRoleKey must be provided');
  }

  return createClient(config.url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Reset singleton clients (for testing)
 */
export function resetSupabaseClients(): void {
  anonClient = null;
  serviceClient = null;
}
