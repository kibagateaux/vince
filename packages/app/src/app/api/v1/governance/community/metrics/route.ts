/**
 * GET /api/v1/governance/community/metrics
 * Gets community metrics from database
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../../../../lib/db';
import { sql } from 'drizzle-orm';
import { schema } from '@bangui/db';

export async function GET() {
  console.log('[API] GET /api/v1/governance/community/metrics');
  try {
    const db = getDb();

    // Get total unique depositors (all time)
    console.log('[API] Querying depositors and users...');
    const totalDepositors = await db
      .select({
        count: sql<number>`COUNT(DISTINCT user_id)::int`,
      })
      .from(schema.deposits)
      .where(sql`status = 'confirmed'`);

    // Get active depositors (deposited in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeDepositors = await db
      .select({
        count: sql<number>`COUNT(DISTINCT user_id)::int`,
      })
      .from(schema.deposits)
      .where(sql`status = 'confirmed' AND deposited_at >= ${thirtyDaysAgo.toISOString()}`);

    // Get new depositors in time periods
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // New users in last 24h
    const newLast24h = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(schema.users)
      .where(sql`created_at >= ${oneDayAgo.toISOString()}`);

    // New users in last 7d
    const newLast7d = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(schema.users)
      .where(sql`created_at >= ${sevenDaysAgo.toISOString()}`);

    // New users in last 30d
    const newLast30d = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(schema.users)
      .where(sql`created_at >= ${thirtyDaysAgo.toISOString()}`);

    // Calculate change percentages (compare to previous period)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const previousWeek = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(schema.users)
      .where(sql`created_at >= ${fourteenDaysAgo.toISOString()} AND created_at < ${sevenDaysAgo.toISOString()}`);

    const previousMonth = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(schema.users)
      .where(sql`created_at >= ${sixtyDaysAgo.toISOString()} AND created_at < ${thirtyDaysAgo.toISOString()}`);

    const prev7d = previousWeek[0]?.count || 1;
    const prev30d = previousMonth[0]?.count || 1;
    const curr7d = newLast7d[0]?.count || 0;
    const curr30d = newLast30d[0]?.count || 0;

    const metrics = {
      totalDepositors: {
        allTime: totalDepositors[0]?.count || 0,
        trend: 0,
      },
      currentActive: {
        count: activeDepositors[0]?.count || 0,
        changeThisWeek: curr7d,
      },
      newDepositors: {
        last24h: newLast24h[0]?.count || 0,
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
