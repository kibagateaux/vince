/**
 * GET /api/v1/governance/community/deposits
 * Gets deposit volume data for charts
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../../../lib/db';

export async function GET(request: Request) {
  console.log('[API] GET /api/v1/governance/community/deposits');
  try {
    const db = getSupabase();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    console.log('[API] Deposit volume query params:', { days });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get deposits in the time range
    console.log('[API] Querying daily deposit volume...');
    const { data: deposits, error } = await db
      .from('deposits')
      .select('amount, user_id, deposited_at')
      .eq('status', 'confirmed')
      .gte('deposited_at', startDate.toISOString());

    if (error) {
      console.error('[API] Error querying deposits:', error);
      throw error;
    }

    // Aggregate by date
    const dailyMap = new Map<string, { volume: number; count: number; userIds: Set<string> }>();

    (deposits || []).forEach((d) => {
      if (!d.deposited_at) return;
      const dateStr = new Date(d.deposited_at).toISOString().split('T')[0]!;
      const existing = dailyMap.get(dateStr) || { volume: 0, count: 0, userIds: new Set<string>() };
      existing.volume += parseFloat(d.amount || '0');
      existing.count += 1;
      if (d.user_id) existing.userIds.add(d.user_id);
      dailyMap.set(dateStr, existing);
    });

    // Fill in missing days with zero values
    const result: Array<{
      date: string;
      volume: number;
      count: number;
      uniqueDepositors: number;
      movingAvg7d: number;
    }> = [];

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0]!;

      const dayData = dailyMap.get(dateStr);

      result.push({
        date: dateStr,
        volume: dayData?.volume || 0,
        count: dayData?.count || 0,
        uniqueDepositors: dayData?.userIds?.size || 0,
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
    const allUserIds = new Set<string>();
    dailyMap.forEach((day) => {
      day.userIds.forEach((id) => allUserIds.add(id));
    });

    const summary = {
      total: result.reduce((sum, d) => sum + d.volume, 0),
      count: result.reduce((sum, d) => sum + d.count, 0),
      uniqueDepositors: allUserIds.size,
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
