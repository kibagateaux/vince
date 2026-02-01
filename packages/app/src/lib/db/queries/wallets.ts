/**
 * @module @bangui/app/lib/db/queries/wallets
 * Wallet-related database queries using Supabase
 */

import type { Db } from '../client';
import type { WalletRow, WalletInsert, Chain } from '../types';

/**
 * Gets a wallet by ID
 */
export const getWallet = async (
  db: Db,
  id: string
): Promise<WalletRow | null> => {
  const { data, error } = await db
    .from('wallets')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
};

/**
 * Finds or creates a wallet for a user
 */
export const findOrCreateWallet = async (
  db: Db,
  userId: string,
  address: string,
  chain: Chain
): Promise<WalletRow> => {
  const normalizedAddress = address.toLowerCase();

  // Try to find existing wallet
  const { data: existing, error: findError } = await db
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .eq('address', normalizedAddress)
    .single();

  if (findError && findError.code !== 'PGRST116') {
    throw findError;
  }

  if (existing) {
    return existing;
  }

  // Create new wallet
  const insert: WalletInsert = {
    user_id: userId,
    address: normalizedAddress,
    chain,
    is_primary: true,
  };

  const { data: wallet, error: insertError } = await db
    .from('wallets')
    .insert(insert)
    .select()
    .single();

  if (insertError || !wallet) {
    throw insertError ?? new Error('Failed to create wallet');
  }

  return wallet;
};
