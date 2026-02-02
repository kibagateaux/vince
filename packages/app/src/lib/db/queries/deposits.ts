/**
 * @module @bangui/app/lib/db/queries/deposits
 * Deposit-related database queries using Supabase
 */

import type { Db } from '../client';
import type { DepositRow, DepositInsert, DepositStatus } from '../types';

/**
 * Input for creating a deposit
 */
export interface CreateDepositInput {
  readonly userId: string;
  readonly walletId: string;
  readonly amount: string;
  readonly token: string;
  readonly tokenAddress?: string;
  readonly vaultAddress?: string;
  readonly chain?: string;
}

/**
 * Creates a pending deposit record
 */
export const createDeposit = async (
  db: Db,
  input: CreateDepositInput
): Promise<DepositRow> => {
  const insert: DepositInsert = {
    user_id: input.userId,
    wallet_id: input.walletId,
    amount: input.amount,
    token: input.token,
    token_address: input.tokenAddress ?? null,
    vault_address: input.vaultAddress ?? null,
    chain: input.chain ?? null,
    status: 'pending',
  };

  const { data, error } = await db
    .from('deposits')
    .insert(insert)
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create deposit');
  }

  return data;
};

/**
 * Options for updating deposit status
 */
export interface UpdateDepositOptions {
  readonly txHash?: string;
  readonly vaultAddress?: string;
  readonly tokenAddress?: string;
  readonly chain?: string;
}

/**
 * Updates deposit status and sets txHash/timestamp
 */
export const updateDepositStatus = async (
  db: Db,
  id: string,
  status: DepositStatus,
  options?: string | UpdateDepositOptions
): Promise<void> => {
  // Support both old string signature and new options object
  const opts: UpdateDepositOptions = typeof options === 'string'
    ? { txHash: options }
    : options ?? {};

  const update: Partial<DepositRow> = {
    status,
    tx_hash: opts.txHash ?? null,
    deposited_at: status === 'confirmed' ? new Date().toISOString() : null,
  };

  // Only include these fields if provided (don't overwrite with null)
  if (opts.vaultAddress) update.vault_address = opts.vaultAddress;
  if (opts.tokenAddress) update.token_address = opts.tokenAddress;
  if (opts.chain) update.chain = opts.chain;

  const { error } = await db
    .from('deposits')
    .update(update)
    .eq('id', id);

  if (error) {
    throw error;
  }
};

/**
 * Gets deposit by ID
 */
export const getDeposit = async (
  db: Db,
  id: string
): Promise<DepositRow | null> => {
  const { data, error } = await db
    .from('deposits')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
};
