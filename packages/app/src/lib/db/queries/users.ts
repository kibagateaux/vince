/**
 * @module @bangui/app/lib/db/queries/users
 * User-related database queries using Supabase
 */

import type { Db } from '../client';
import type { UserRow, UserInsert, UserProfileInsert } from '../types';

/**
 * Finds a user by their ID
 */
export const findUserById = async (db: Db, id: string): Promise<UserRow | null> => {
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data;
};

/**
 * Finds a user by wallet address
 */
export const findUserByWalletAddress = async (
  db: Db,
  address: string
): Promise<UserRow | null> => {
  const { data: wallet, error } = await db
    .from('wallets')
    .select('user_id, users(*)')
    .eq('address', address.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!wallet?.users) return null;
  return wallet.users as unknown as UserRow;
};

/**
 * Input for creating a new user
 */
export interface CreateUserInput {
  readonly email?: string;
  readonly telegramId?: string;
  readonly discordId?: string;
}

/**
 * Creates a new user with associated profile
 */
export const createUser = async (
  db: Db,
  input: CreateUserInput
): Promise<UserRow> => {
  // Create user
  const userInsert: UserInsert = {
    email: input.email ?? null,
    telegram_id: input.telegramId ?? null,
    discord_id: input.discordId ?? null,
  };

  const { data: user, error: userError } = await db
    .from('users')
    .insert(userInsert)
    .select()
    .single();

  if (userError || !user) {
    throw userError ?? new Error('Failed to create user');
  }

  // Create associated profile
  const profileInsert: UserProfileInsert = {
    user_id: user.id,
  };

  const { error: profileError } = await db
    .from('user_profiles')
    .insert(profileInsert);

  if (profileError) {
    throw profileError;
  }

  return user;
};

/**
 * Updates user's last active timestamp
 */
export const touchUserActivity = async (db: Db, id: string): Promise<void> => {
  const { error } = await db
    .from('users')
    .update({ last_active: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw error;
  }
};
