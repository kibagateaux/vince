/**
 * GET /api/v1/stories/recommended/:userId
 * Gets stories recommended for user based on their profile
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabase,
  getActiveStories,
  getStoriesByCauseCategories,
  getUserProfile,
} from '../../../../../../lib/db';
import type { UUID } from '@bangui/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const db = getSupabase();
  const { userId } = await params;
  const limit = Number(request.nextUrl.searchParams.get('limit')) || 5;

  const profile = await getUserProfile(db, userId);
  if (!profile || profile.causeAffinities.length === 0) {
    // Return general recommendations if no profile
    const stories = await getActiveStories(db, limit);
    return NextResponse.json({ stories, personalized: false });
  }

  // Get top cause categories
  const topCauses = profile.causeAffinities
    .sort((a, b) => Number(b.affinity_score) - Number(a.affinity_score))
    .slice(0, 3)
    .map((a) => a.cause_category);

  const stories = await getStoriesByCauseCategories(db, topCauses, limit);

  return NextResponse.json({
    stories,
    personalized: true,
    matchedCauses: topCauses,
  });
}
