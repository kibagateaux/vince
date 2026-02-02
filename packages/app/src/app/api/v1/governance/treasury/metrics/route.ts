/**
 * GET /api/v1/governance/treasury/metrics
 * Gets treasury metrics from vault contracts and database
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { base, sepolia, baseSepolia } from 'viem/chains';
import { getSupabase } from '../../../../../../lib/db';
import { aiETHAbi } from '../../../../../../lib/protocol';
import { VAULTS } from '../../../../../../lib/vaults';
import { getTokenDecimals } from '@bangui/types';

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

export async function GET() {
  console.log('[API] GET /api/v1/governance/treasury/metrics');
  try {
    const db = getSupabase();

    // Get deposit stats from database
    console.log('[API] Querying deposit stats...');
    const { data: confirmedDeposits, error: depositsError } = await db
      .from('deposits')
      .select('amount')
      .eq('status', 'confirmed');

    if (depositsError) {
      console.error('[API] Error querying deposits:', depositsError);
      throw depositsError;
    }

    // Deposits are stored in wei-like format (10^18 scale), normalize them
    const totalDbDepositsRaw = (confirmedDeposits || []).reduce(
      (sum, d) => sum + parseFloat(d.amount || '0'),
      0
    );
    // Normalize to human-readable units
    const totalDbDeposits = totalDbDepositsRaw / 1e18;
    const depositCount = confirmedDeposits?.length || 0;

    // Get the primary vault's token for price estimate
    const primaryVault = VAULTS.find(v => v.isPrimary && v.address !== '0x0000000000000000000000000000000000000000');
    const fallbackPrice = primaryVault?.reserveToken === 'WBTC' ? 100000 : primaryVault?.reserveToken === 'ETH' ? 3000 : 1;

    // Get 30-day deposit change
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentDepositsData } = await db
      .from('deposits')
      .select('amount')
      .eq('status', 'confirmed')
      .gte('deposited_at', thirtyDaysAgo.toISOString());

    const recentTotalRaw = (recentDepositsData || []).reduce(
      (sum, d) => sum + parseFloat(d.amount || '0'),
      0
    );
    const recentTotal = recentTotalRaw / 1e18;
    const olderTotal = totalDbDeposits - recentTotal;
    const change30d = olderTotal > 0 ? ((recentTotal / olderTotal) * 100) : 0;

    // Get active strategies count from allocation decisions
    const { data: approvedDecisions } = await db
      .from('allocation_decisions')
      .select('allocations')
      .eq('decision', 'approved');

    const uniqueCauseIds = new Set<string>();
    (approvedDecisions || []).forEach((d) => {
      const allocations = d.allocations as any[];
      if (allocations?.[0]?.causeId) {
        uniqueCauseIds.add(allocations[0].causeId);
      }
    });

    // Try to fetch onchain data from configured vaults
    let totalValueOnchain = 0n;
    let yieldEarned = 0n;
    let reservePrice = 0n;
    let activeVaultCount = 0;
    const activeAssets = new Set<string>();

    // Use the primary vault from earlier for on-chain data fetch
    if (primaryVault) {
      const viemChain = CHAIN_MAP[primaryVault.chain];
      const rpcEnvVar = RPC_ENV_MAP[primaryVault.chain];
      const rpcUrl = process.env[rpcEnvVar] || process.env.NEXT_PUBLIC_DEFAULT_RPC_URL;

      if (viemChain && rpcUrl) {
        try {
          const client = createPublicClient({
            chain: viemChain,
            transport: http(rpcUrl),
          });

          const [underlying, yield_, price] = await Promise.all([
            client.readContract({
              address: primaryVault.address,
              abi: aiETHAbi,
              functionName: 'underlying',
            }).catch(() => 0n),
            client.readContract({
              address: primaryVault.address,
              abi: aiETHAbi,
              functionName: 'getYieldEarned',
            }).catch(() => 0n),
            client.readContract({
              address: primaryVault.address,
              abi: aiETHAbi,
              functionName: 'reserveAssetPrice',
            }).catch(() => 0n),
          ]);

          totalValueOnchain = underlying as bigint;
          yieldEarned = yield_ as bigint;
          reservePrice = price as bigint;
          activeVaultCount = 1;
          activeAssets.add(primaryVault.reserveToken);
        } catch (err) {
          console.error('Failed to fetch onchain vault data:', err);
        }
      }
    }

    // Calculate USD values using correct decimals for the token
    const tokenDecimals = primaryVault ? getTokenDecimals(primaryVault.reserveToken) : 18;
    const divisor = BigInt(10 ** tokenDecimals);

    const totalValueUsd = totalValueOnchain > 0n && reservePrice > 0n
      ? Number(totalValueOnchain * reservePrice / divisor) / 1e8
      : totalDbDeposits * fallbackPrice;

    const yieldEarnedUsd = yieldEarned > 0n && reservePrice > 0n
      ? Number(yieldEarned * reservePrice / divisor) / 1e8
      : 0;

    // Calculate APY (simplified - would need historical data for accurate calculation)
    const currentAPY = totalValueUsd > 0 ? (yieldEarnedUsd / totalValueUsd) * 365 * 100 : 0;

    const metrics = {
      totalValue: {
        current: totalValueUsd,
        change30d: Math.round(change30d * 10) / 10,
        change7d: 0, // Would need 7-day historical data
      },
      currentAPY: {
        blended: Math.round(currentAPY * 10) / 10,
        change7d: 0,
      },
      lifetimeYield: {
        total: yieldEarnedUsd,
        inceptionDate: new Date('2024-01-15').toISOString(),
      },
      activeStrategies: {
        count: activeVaultCount || (uniqueCauseIds.size || 1),
        uniqueAssets: activeAssets.size || 1,
      },
    };

    console.log('[API] Treasury metrics response:', JSON.stringify(metrics, null, 2));
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('[API] Error fetching treasury metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch treasury metrics' },
      { status: 500 }
    );
  }
}
