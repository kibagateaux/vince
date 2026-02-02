/**
 * POST /api/v1/governance/treasury/snapshot
 * Captures a treasury snapshot for all configured vaults
 * Can be called by AI agents or scheduled jobs after successful deposits
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../../../../lib/db';
import { captureTreasurySnapshot, captureAllVaultSnapshots } from '../../../../../../lib/treasury-snapshot';
import type { Address, Chain } from '@bangui/types';

export async function POST(request: NextRequest) {
  console.log('[API] POST /api/v1/governance/treasury/snapshot');
  try {
    const db = getSupabase();
    const body = await request.json().catch(() => ({}));
    const { vaultAddress, chain } = body as { vaultAddress?: Address; chain?: Chain };

    let snapshots;

    if (vaultAddress && chain) {
      // Capture snapshot for specific vault
      console.log(`[API] Capturing snapshot for vault ${vaultAddress} on ${chain}`);
      const snapshot = await captureTreasurySnapshot(db, vaultAddress, chain);
      snapshots = snapshot ? [snapshot] : [];
    } else {
      // Capture snapshots for all configured vaults
      console.log('[API] Capturing snapshots for all vaults');
      snapshots = await captureAllVaultSnapshots(db);
    }

    console.log('[API] Treasury snapshot response:', { count: snapshots.length });
    return NextResponse.json({
      success: true,
      snapshots,
      message: `Captured ${snapshots.length} treasury snapshot(s)`,
    });
  } catch (error) {
    console.error('[API] Error capturing treasury snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to capture treasury snapshot' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/governance/treasury/snapshot
 * Returns the latest treasury snapshot for each vault
 */
export async function GET() {
  console.log('[API] GET /api/v1/governance/treasury/snapshot');
  try {
    const db = getSupabase();

    // Get the most recent snapshot for each vault
    const { data: snapshots, error } = await db
      .from('treasury_snapshots')
      .select('*')
      .order('snapshot_at', { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    // Deduplicate by vault address (keep only latest per vault)
    const vaultMap = new Map<string, typeof snapshots[0]>();
    for (const snapshot of snapshots ?? []) {
      if (!vaultMap.has(snapshot.vault_address)) {
        vaultMap.set(snapshot.vault_address, snapshot);
      }
    }

    const latestSnapshots = Array.from(vaultMap.values());

    console.log('[API] Latest snapshots response:', { count: latestSnapshots.length });
    return NextResponse.json({
      snapshots: latestSnapshots,
    });
  } catch (error) {
    console.error('[API] Error fetching latest snapshots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latest snapshots' },
      { status: 500 }
    );
  }
}
