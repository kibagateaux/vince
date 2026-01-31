/**
 * GET /api/v1/governance/community/metrics
 * Gets community metrics from database
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../../../lib/db';

export async function GET() {
  console.log('[API] GET /api/v1/governance/community/metrics');
  try {
    const db = getSupabase();

    // Get total unique depositors (all time)
    console.log('[API] Querying depositors and users...');
    const { data: allDeposits } = await db
      .from('deposits')
      .select('user_id')
      .eq('status', 'confirmed');

    const totalDepositorIds = new Set((allDeposits || []).map((d) => d.user_id));
    const totalDepositorsCount = totalDepositorIds.size;

    // Get active depositors (deposited in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activeDeposits } = await db
      .from('deposits')
      .select('user_id')
      .eq('status', 'confirmed')
      .gte('deposited_at', thirtyDaysAgo.toISOString());

    const activeDepositorIds = new Set((activeDeposits || []).map((d) => d.user_id));
    const activeDepositorsCount = activeDepositorIds.size;

    // Get new depositors in time periods
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // New users in last 24h
    const { count: newLast24h } = await db
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo.toISOString());

    // New users in last 7d
    const { count: newLast7d } = await db
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    // New users in last 30d
    const { count: newLast30d } = await db
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Previous week (7-14 days ago)
    const { count: previousWeekCount } = await db
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', fourteenDaysAgo.toISOString())
      .lt('created_at', sevenDaysAgo.toISOString());

    // Previous month (30-60 days ago)
    const { count: previousMonthCount } = await db
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString());

    const prev7d = previousWeekCount || 1;
    const prev30d = previousMonthCount || 1;
    const curr7d = newLast7d || 0;
    const curr30d = newLast30d || 0;

    const metrics = {
      totalDepositors: {
        allTime: totalDepositorsCount,
        trend: 0,
      },
      currentActive: {
        count: activeDepositorsCount,
        changeThisWeek: curr7d,
      },
      newDepositors: {
        last24h: newLast24h || 0,
        last7d: curr7d,
        last30d: curr30d,
        percentChange7d: prev7d > 0 ? Math.round(((curr7d - prev7d) / prev7d) * 100 * 10) / 10 : 0,
        percentChange30d: prev30d > 0 ? Math.round(((curr30d - prev30d) / prev30d) * 100 * 10) / 10 : 0,
      },
    };

    console.log('[API] Community metrics response:', JSON.stringify(metrics, null, 2));
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('[API] Error fetching community metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community metrics' },
      { status: 500 }
    );
  }
}
