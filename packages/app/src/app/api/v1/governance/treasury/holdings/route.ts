/**
 * GET /api/v1/governance/treasury/holdings
 * Gets historical treasury holdings from database snapshots
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabase, getAllTreasurySnapshots } from '../../../../../../lib/db';

export async function GET(request: Request) {
  console.log('[API] GET /api/v1/governance/treasury/holdings');
  try {
    const db = getSupabase();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '90');
    console.log('[API] Treasury holdings query params:', { days });

    // Try to get snapshots from database, fall back to deposits if any error
    let snapshots: Awaited<ReturnType<typeof getAllTreasurySnapshots>> = [];
    let useDepositsFallback = false;

    try {
      snapshots = await getAllTreasurySnapshots(db, days);
      console.log('[API] Found', snapshots.length, 'treasury snapshots');
    } catch (snapshotError: any) {
      // Any error with snapshots - fall back to deposits
      console.log('[API] Snapshot error, falling back to deposits:', {
        code: snapshotError?.code,
        message: snapshotError?.message,
      });
      useDepositsFallback = true;
    }

    // If we have no snapshots or encountered an error, fall back to generating from deposit data
    if (useDepositsFallback || snapshots.length === 0) {
      console.log('[API] Using deposit data fallback');
      return await generateFromDeposits(db, days);
    }

    // Group by date and aggregate across vaults
    const dateMap = new Map<string, {
      timestamp: Date;
      holdings: Array<{
        asset: string;
        strategy: string;
        amount: number;
        valueUSD: number;
        vaultAddress: string;
        chain: string;
      }>;
      totalValueUSD: number;
    }>();

    for (const snapshot of snapshots) {
      const dateStr = new Date(snapshot.snapshot_at).toISOString().split('T')[0]!;
      const existing = dateMap.get(dateStr) ?? {
        timestamp: new Date(snapshot.snapshot_at),
        holdings: [],
        totalValueUSD: 0,
      };

      const valueUsd = parseFloat(snapshot.total_value_usd ?? '0');
      const totalAssets = parseFloat(snapshot.total_assets ?? '0');

      existing.holdings.push({
        asset: 'ETH', // Could be derived from vault metadata
        strategy: `aiETH-${snapshot.chain}`,
        amount: totalAssets / 1e18, // Convert from wei
        valueUSD: valueUsd,
        vaultAddress: snapshot.vault_address,
        chain: snapshot.chain,
      });

      existing.totalValueUSD += valueUsd;
      dateMap.set(dateStr, existing);
    }

    // Convert to array and sort by date
    const result = Array.from(dateMap.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    console.log('[API] Treasury holdings response:', {
      snapshotCount: result.length,
      firstSnapshot: result[0],
      lastSnapshot: result[result.length - 1],
    });

    return NextResponse.json({ snapshots: result });
  } catch (error) {
    console.error('[API] Error fetching treasury holdings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch treasury holdings' },
      { status: 500 }
    );
  }
}

/**
 * Generate holdings from deposit data when no snapshots are available
 * This provides a fallback view based on cumulative deposits
 */
async function generateFromDeposits(db: ReturnType<typeof getSupabase>, days: number) {
  console.log('[API] generateFromDeposits called with days:', days);

  try {
    // Get all confirmed deposits - only select base columns that definitely exist
    const { data: deposits, error } = await db
      .from('deposits')
      .select('amount, token, deposited_at')
      .eq('status', 'confirmed')
      .order('deposited_at', { ascending: true });

    if (error) {
      console.log('[API] Error fetching deposits:', error);
      // Return empty data if deposits query fails
      return generateEmptySnapshots(days);
    }

    console.log('[API] Fetched deposits:', deposits?.length ?? 0);

    // Build cumulative totals by date
    const dateMap = new Map<string, number>();
    let runningTotal = 0;

    for (const deposit of deposits ?? []) {
      if (!deposit.deposited_at) continue;

      const amount = parseFloat(deposit.amount ?? '0');
      runningTotal += amount;

      const dateStr = new Date(deposit.deposited_at).toISOString().split('T')[0]!;
      dateMap.set(dateStr, runningTotal);
    }

    // Generate snapshots for each day in range
    const snapshots = [];
    let lastTotal = 0;

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0]!;

      const dayTotal = dateMap.get(dateStr);
      if (dayTotal !== undefined) {
        lastTotal = dayTotal;
      }

      snapshots.push({
        timestamp: date,
        holdings: [{
          asset: 'ETH',
          strategy: 'aiETH-vault',
          amount: lastTotal,
          valueUSD: lastTotal * 3000, // Approximate ETH price
          vaultAddress: 'default',
          chain: 'sepolia',
        }],
        totalValueUSD: lastTotal * 3000,
      });
    }

    console.log('[API] Generated holdings from deposits:', {
      snapshotCount: snapshots.length,
      latestTotal: lastTotal,
    });

    return NextResponse.json({ snapshots });
  } catch (err) {
    console.error('[API] Unexpected error in generateFromDeposits:', err);
    return generateEmptySnapshots(days);
  }
}

/**
 * Generate empty snapshots when no data is available
 */
function generateEmptySnapshots(days: number) {
  console.log('[API] Generating empty snapshots for', days, 'days');

  const snapshots = [];
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    snapshots.push({
      timestamp: date,
      holdings: [{
        asset: 'ETH',
        strategy: 'aiETH-vault',
        amount: 0,
        valueUSD: 0,
        vaultAddress: 'default',
        chain: 'sepolia',
      }],
      totalValueUSD: 0,
    });
  }

  return NextResponse.json({ snapshots });
}
