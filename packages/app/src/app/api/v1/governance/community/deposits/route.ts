/**
 * GET /api/v1/governance/community/deposits
 * Gets deposit volume data for charts
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../../../../lib/db';
import { sql } from 'drizzle-orm';
import { schema } from '@bangui/db';

export async function GET(request: Request) {
  console.log('[API] GET /api/v1/governance/community/deposits');
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    console.log('[API] Deposit volume query params:', { days });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily deposit volume
    console.log('[API] Querying daily deposit volume...');
    const dailyVolume = await db
      .select({
        date: sql<string>`DATE(deposited_at)`,
        volume: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)`,
        count: sql<number>`COUNT(*)::int`,
        uniqueDepositors: sql<number>`COUNT(DISTINCT user_id)::int`,
      })
      .from(schema.deposits)
      .where(sql`status = 'confirmed' AND deposited_at >= ${startDate.toISOString()}`)
      .groupBy(sql`DATE(deposited_at)`)
      .orderBy(sql`DATE(deposited_at)`);

    // Fill in missing days with zero values
    const result: Array<{
      date: string;
      volume: number;
      count: number;
      uniqueDepositors: number;
      movingAvg7d: number;
    }> = [];

    const volumeMap = new Map(
      dailyVolume.map((d) => [d.date, {
        volume: parseFloat(d.volume),
        count: d.count,
        uniqueDepositors: d.uniqueDepositors,
      }])
    );

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayData = volumeMap.get(dateStr) || {
        volume: 0,
        count: 0,
        uniqueDepositors: 0,
      };

      result.push({
        date: dateStr!,
        volume: dayData.volume,
        count: dayData.count,
        uniqueDepositors: dayData.uniqueDepositors,
        movingAvg7d: 0, // Will calculate below
      });
    }

    // Calculate 7-day moving average
    for (let i = 0; i < result.length; i++) {
      const start = Math.max(0, i - 6);
      const window = result.slice(start, i + 1);
      const avg = window.reduce((sum, d) => sum + d.volume, 0) / window.length;
      result[i]!.movingAvg7d = avg;
    }

    // Calculate summary
    const summary = {
      total: result.reduce((sum, d) => sum + d.volume, 0),
      count: result.reduce((sum, d) => sum + d.count, 0),
      uniqueDepositors: new Set(
        dailyVolume.flatMap((d) => d.uniqueDepositors)
      ).size || dailyVolume.reduce((max, d) => Math.max(max, d.uniqueDepositors), 0),
    };

    console.log('[API] Deposit volume response:', { dataCount: result.length, summary });
    return NextResponse.json({
      data: result,
      summary,
    });
  } catch (error) {
    console.error('[API] Error fetching deposit volume:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deposit volume' },
      { status: 500 }
    );
  }
}
