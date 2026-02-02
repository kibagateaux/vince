/**
 * @module treasury-snapshot
 * Captures treasury state and saves to database
 * Should be called after successful deposits to track historical data
 */

import { createPublicClient, http, type PublicClient } from 'viem';
import { base, sepolia, baseSepolia } from 'viem/chains';
import type { Db } from './db/client';
import { createTreasurySnapshot } from './db/queries/treasury';
import type { Chain, Address } from '@bangui/types';

/** ABI for reading vault state */
const aiETHAbi = [
  {
    name: 'totalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'underlying',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getYieldEarned',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'reserveAssetPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

/** Chain to viem chain mapping */
const CHAIN_MAP: Record<string, typeof base | typeof sepolia | typeof baseSepolia> = {
  base: base,
  sepolia: sepolia,
  base_sepolia: baseSepolia,
};

/** Chain to RPC URL env var mapping */
const RPC_ENV_MAP: Record<string, string> = {
  base: 'BASE_RPC_URL',
  sepolia: 'NEXT_PUBLIC_DEFAULT_RPC_URL',
  base_sepolia: 'BASE_SEPOLIA_RPC_URL',
};

/**
 * Captures a treasury snapshot and saves to database
 * @param db - Supabase database client
 * @param vaultAddress - The vault contract address
 * @param chain - The chain the vault is on
 * @param depositorCount - Optional depositor count to include
 * @returns The created snapshot record
 */
export async function captureTreasurySnapshot(
  db: Db,
  vaultAddress: Address,
  chain: Chain | string,
  depositorCount?: number
) {
  console.log(`[TreasurySnapshot] Capturing snapshot for vault ${vaultAddress} on ${chain}`);

  const viemChain = CHAIN_MAP[chain];
  if (!viemChain) {
    console.warn(`[TreasurySnapshot] Unsupported chain ${chain}, skipping snapshot`);
    return null;
  }

  const rpcEnvVar = RPC_ENV_MAP[chain];
  const rpcUrl = process.env[rpcEnvVar] || process.env.NEXT_PUBLIC_DEFAULT_RPC_URL;
  if (!rpcUrl) {
    console.warn(`[TreasurySnapshot] No RPC URL for ${chain}, skipping snapshot`);
    return null;
  }

  const client = createPublicClient({
    chain: viemChain,
    transport: http(rpcUrl),
  });

  try {
    // Read vault state - use individual calls with error handling
    let totalAssets = 0n;
    let totalSupply = 0n;
    let yieldEarned = 0n;
    let assetPrice = 0n;

    try {
      totalAssets = await client.readContract({
        address: vaultAddress,
        abi: aiETHAbi,
        functionName: 'totalAssets',
      });
    } catch {
      // Try 'underlying' as fallback
      try {
        totalAssets = await client.readContract({
          address: vaultAddress,
          abi: aiETHAbi,
          functionName: 'underlying',
        });
      } catch {
        console.warn('[TreasurySnapshot] Could not read totalAssets or underlying');
      }
    }

    try {
      totalSupply = await client.readContract({
        address: vaultAddress,
        abi: aiETHAbi,
        functionName: 'totalSupply',
      });
    } catch {
      console.warn('[TreasurySnapshot] Could not read totalSupply');
    }

    try {
      yieldEarned = await client.readContract({
        address: vaultAddress,
        abi: aiETHAbi,
        functionName: 'getYieldEarned',
      });
    } catch {
      console.warn('[TreasurySnapshot] Could not read getYieldEarned');
    }

    try {
      assetPrice = await client.readContract({
        address: vaultAddress,
        abi: aiETHAbi,
        functionName: 'reserveAssetPrice',
      });
    } catch {
      console.warn('[TreasurySnapshot] Could not read reserveAssetPrice');
    }

    // Calculate USD values (assumes 18 decimals and 8 decimal price)
    const totalValueUsd = totalAssets > 0n && assetPrice > 0n
      ? Number(totalAssets * assetPrice / 10n ** 18n) / 1e8
      : 0;

    const yieldEarnedUsd = yieldEarned > 0n && assetPrice > 0n
      ? Number(yieldEarned * assetPrice / 10n ** 18n) / 1e8
      : 0;

    // Calculate simple APY estimate (would need historical data for accurate calculation)
    const apyEstimate = totalValueUsd > 0 ? (yieldEarnedUsd / totalValueUsd) * 365 * 100 : 0;

    // Get depositor count from database if not provided
    let finalDepositorCount = depositorCount;
    if (finalDepositorCount === undefined) {
      const { data: deposits } = await db
        .from('deposits')
        .select('user_id')
        .eq('vault_address', vaultAddress)
        .eq('status', 'confirmed');

      finalDepositorCount = new Set((deposits ?? []).map(d => d.user_id)).size;
    }

    // Create snapshot
    const snapshot = await createTreasurySnapshot(db, {
      vaultAddress,
      chain: chain as string,
      totalAssets: totalAssets.toString(),
      totalShares: totalSupply.toString(),
      assetPriceUsd: assetPrice > 0n ? (Number(assetPrice) / 1e8).toString() : undefined,
      totalValueUsd: totalValueUsd > 0 ? totalValueUsd.toString() : undefined,
      yieldEarned: yieldEarned.toString(),
      apyEstimate: apyEstimate > 0 ? apyEstimate.toFixed(2) : undefined,
      depositorCount: finalDepositorCount,
      metadata: {
        capturedAt: new Date().toISOString(),
        source: 'deposit_confirmation',
      },
    });

    console.log(`[TreasurySnapshot] Saved snapshot ${snapshot.id}:`, {
      totalAssets: totalAssets.toString(),
      totalSupply: totalSupply.toString(),
      totalValueUsd,
      yieldEarnedUsd,
      depositorCount: finalDepositorCount,
    });

    return snapshot;
  } catch (error) {
    console.error('[TreasurySnapshot] Error capturing snapshot:', error);
    return null;
  }
}

/**
 * Captures snapshots for all configured vaults
 * Can be used as a cron job or called manually
 */
export async function captureAllVaultSnapshots(db: Db) {
  const vaults = [
    { address: process.env.VAULT_ADDRESS_BASE as Address, chain: 'base' as const },
    { address: process.env.NEXT_PUBLIC_DAF_CONTRACT_SEPOLIA as Address, chain: 'sepolia' as const },
    { address: process.env.NEXT_PUBLIC_DAF_CONTRACT_BASE_SEPOLIA as Address, chain: 'base_sepolia' as const },
  ].filter(v => v.address && v.address !== '0x0000000000000000000000000000000000000000');

  console.log(`[TreasurySnapshot] Capturing snapshots for ${vaults.length} vaults`);

  const snapshots = [];
  for (const vault of vaults) {
    const snapshot = await captureTreasurySnapshot(db, vault.address, vault.chain);
    if (snapshot) {
      snapshots.push(snapshot);
    }
  }

  return snapshots;
}
