/**
 * GET /api/v1/governance/treasury/metrics
 * Gets treasury metrics from vault contracts and database
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { mainnet, base } from 'viem/chains';
import { getDb } from '../../../../../../lib/db';
import {
  aiETHAbi,
  formatTokenAmount,
  formatUsdRaw,
  type VaultConfig,
} from '../../../../../../lib/protocol';
import { sql } from 'drizzle-orm';
import { schema } from '@bangui/db';

// Vault configurations - these should come from environment or config
const VAULTS: VaultConfig[] = [
  {
    name: 'AiETH Base',
    address: process.env.VAULT_ADDRESS_BASE as `0x${string}` || '0x0000000000000000000000000000000000000000',
    chainId: 8453,
    reserveToken: '0x4200000000000000000000000000000000000006' as `0x${string}`, // WETH on Base
    reserveSymbol: 'ETH',
    reserveDecimals: 18,
  },
];

export async function GET() {
  console.log('[API] GET /api/v1/governance/treasury/metrics');
  try {
    const db = getDb();

    // Get deposit stats from database
    console.log('[API] Querying deposit stats...');
    const depositStats = await db
      .select({
        totalDeposits: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)`,
        depositCount: sql<number>`COUNT(*)::int`,
      })
      .from(schema.deposits)
      .where(sql`status = 'confirmed'`);

    const totalDbDeposits = parseFloat(depositStats[0]?.totalDeposits || '0');

    // Get 30-day deposit change
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentDeposits = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)`,
      })
      .from(schema.deposits)
      .where(sql`status = 'confirmed' AND deposited_at >= ${thirtyDaysAgo.toISOString()}`);

    const recentTotal = parseFloat(recentDeposits[0]?.total || '0');
    const olderTotal = totalDbDeposits - recentTotal;
    const change30d = olderTotal > 0 ? ((recentTotal / olderTotal) * 100) : 0;

    // Get active strategies count from allocation decisions
    const activeStrategies = await db
      .select({
        count: sql<number>`COUNT(DISTINCT allocations->0->>'causeId')::int`,
      })
      .from(schema.allocationDecisions)
      .where(sql`decision = 'approved'`);

    // Try to fetch onchain data if vault is configured
    let totalValueOnchain = 0n;
    let yieldEarned = 0n;
    let reservePrice = 0n;

    const vaultAddress = VAULTS[0]?.address;
    if (vaultAddress && vaultAddress !== '0x0000000000000000000000000000000000000000') {
      try {
        const client = createPublicClient({
          chain: base,
          transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
        });

        const [underlying, yield_, price] = await Promise.all([
          client.readContract({
            address: vaultAddress,
            abi: aiETHAbi,
            functionName: 'underlying',
          }),
          client.readContract({
            address: vaultAddress,
            abi: aiETHAbi,
            functionName: 'getYieldEarned',
          }),
          client.readContract({
            address: vaultAddress,
            abi: aiETHAbi,
            functionName: 'reserveAssetPrice',
          }),
        ]);

        totalValueOnchain = underlying as bigint;
        yieldEarned = yield_ as bigint;
        reservePrice = price as bigint;
      } catch (err) {
        console.error('Failed to fetch onchain vault data:', err);
      }
    }

    // Calculate USD values
    const totalValueUsd = totalValueOnchain > 0n && reservePrice > 0n
      ? Number(totalValueOnchain * reservePrice / 10n ** 18n) / 1e8
      : totalDbDeposits;

    const yieldEarnedUsd = yieldEarned > 0n && reservePrice > 0n
      ? Number(yieldEarned * reservePrice / 10n ** 18n) / 1e8
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
        count: activeStrategies[0]?.count || 1,
        uniqueAssets: 1, // Currently only supporting ETH
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
