/**
 * @module @bangui/app/lib/db/queries/treasury
 * Treasury-related database queries using Supabase
 */

import type { Db } from '../client';
import type { TreasurySnapshotRow, TreasurySnapshotInsert, Json } from '../types';

/**
 * Input for creating a treasury snapshot
 */
export interface CreateTreasurySnapshotInput {
  readonly vaultAddress: string;
  readonly chain: string;
  readonly totalAssets: string;
  readonly totalShares: string;
  readonly assetPriceUsd?: string;
  readonly totalValueUsd?: string;
  readonly yieldEarned?: string;
  readonly apyEstimate?: string;
  readonly depositorCount?: number;
  readonly metadata?: Json;
}

/**
 * Creates a treasury snapshot record
 */
export const createTreasurySnapshot = async (
  db: Db,
  input: CreateTreasurySnapshotInput
): Promise<TreasurySnapshotRow> => {
  const insert: TreasurySnapshotInsert = {
    vault_address: input.vaultAddress,
    chain: input.chain,
    total_assets: input.totalAssets,
    total_shares: input.totalShares,
    asset_price_usd: input.assetPriceUsd ?? null,
    total_value_usd: input.totalValueUsd ?? null,
    yield_earned: input.yieldEarned ?? null,
    apy_estimate: input.apyEstimate ?? null,
    depositor_count: input.depositorCount ?? null,
    metadata: input.metadata ?? null,
  };

  const { data, error } = await db
    .from('treasury_snapshots')
    .insert(insert)
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create treasury snapshot');
  }

  return data;
};

/**
 * Gets treasury snapshots for a vault within a time range
 */
export const getTreasurySnapshots = async (
  db: Db,
  vaultAddress: string,
  days: number = 90
): Promise<TreasurySnapshotRow[]> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await db
    .from('treasury_snapshots')
    .select('*')
    .eq('vault_address', vaultAddress)
    .gte('snapshot_at', startDate.toISOString())
    .order('snapshot_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
};

/**
 * Gets the latest treasury snapshot for each vault
 */
export const getLatestTreasurySnapshots = async (
  db: Db
): Promise<TreasurySnapshotRow[]> => {
  // Get all distinct vault addresses
  const { data: vaults, error: vaultsError } = await db
    .from('treasury_snapshots')
    .select('vault_address')
    .order('snapshot_at', { ascending: false });

  if (vaultsError) {
    throw vaultsError;
  }

  const uniqueVaults = [...new Set((vaults ?? []).map(v => v.vault_address))];

  // Get latest snapshot for each vault
  const snapshots: TreasurySnapshotRow[] = [];
  for (const vaultAddress of uniqueVaults) {
    const { data, error } = await db
      .from('treasury_snapshots')
      .select('*')
      .eq('vault_address', vaultAddress)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      snapshots.push(data);
    }
  }

  return snapshots;
};

/**
 * Gets all treasury snapshots across all vaults for a time period
 */
export const getAllTreasurySnapshots = async (
  db: Db,
  days: number = 90
): Promise<TreasurySnapshotRow[]> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await db
    .from('treasury_snapshots')
    .select('*')
    .gte('snapshot_at', startDate.toISOString())
    .order('snapshot_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
};

/**
 * Gets deposit stats aggregated by vault
 */
export const getDepositStatsByVault = async (
  db: Db,
  vaultAddress?: string
): Promise<{ vaultAddress: string; totalDeposits: number; totalAmount: number; depositorCount: number }[]> => {
  let query = db
    .from('deposits')
    .select('vault_address, amount, user_id')
    .eq('status', 'confirmed')
    .not('vault_address', 'is', null);

  if (vaultAddress) {
    query = query.eq('vault_address', vaultAddress);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  // Aggregate by vault
  const vaultMap = new Map<string, { totalAmount: number; userIds: Set<string>; count: number }>();

  for (const deposit of data ?? []) {
    const vault = deposit.vault_address;
    if (!vault) continue;

    const existing = vaultMap.get(vault) ?? { totalAmount: 0, userIds: new Set(), count: 0 };
    existing.totalAmount += parseFloat(deposit.amount ?? '0');
    existing.userIds.add(deposit.user_id);
    existing.count += 1;
    vaultMap.set(vault, existing);
  }

  return Array.from(vaultMap.entries()).map(([vaultAddr, stats]) => ({
    vaultAddress: vaultAddr,
    totalDeposits: stats.count,
    totalAmount: stats.totalAmount,
    depositorCount: stats.userIds.size,
  }));
};
