/**
 * GET /api/v1/governance/community/composition
 * Gets archetype and risk distribution data
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../../../../lib/db';
import { sql, desc } from 'drizzle-orm';
import { schema } from '@bangui/db';

const ARCHETYPE_LABELS: Record<string, string> = {
  impact_maximizer: 'Impact Maximizer',
  community_builder: 'Community Builder',
  values_expresser: 'Values Expresser',
  system_changer: 'System Changer',
  legacy_creator: 'Legacy Creator',
  opportunistic_giver: 'Opportunistic',
};

const ARCHETYPE_COLORS: Record<string, string> = {
  impact_maximizer: '#3B82F6',
  community_builder: '#10B981',
  values_expresser: '#F59E0B',
  system_changer: '#8B5CF6',
  legacy_creator: '#EC4899',
  opportunistic_giver: '#6B7280',
};

const RISK_LABELS: Record<string, string> = {
  conservative: 'Conservative',
  moderate: 'Moderate',
  aggressive: 'Aggressive',
};

const RISK_COLORS: Record<string, string> = {
  conservative: '#10B981',
  moderate: '#F59E0B',
  aggressive: '#EF4444',
};

export async function GET() {
  console.log('[API] GET /api/v1/governance/community/composition');
  try {
    const db = getDb();

    // Get archetype distribution
    // For each user, get their highest-scoring archetype
    console.log('[API] Querying archetype and risk stats...');
    const archetypeStats = await db
      .select({
        archetype: schema.archetypeScores.archetype,
        count: sql<number>`COUNT(DISTINCT ${schema.archetypeScores.profileId})::int`,
      })
      .from(schema.archetypeScores)
      .groupBy(schema.archetypeScores.archetype)
      .orderBy(desc(sql`COUNT(DISTINCT ${schema.archetypeScores.profileId})`));

    const totalArchetypes = archetypeStats.reduce((sum, a) => sum + a.count, 0) || 1;

    const archetypes = archetypeStats.map((a) => ({
      archetype: a.archetype,
      label: ARCHETYPE_LABELS[a.archetype] || a.archetype,
      count: a.count,
      percentage: Math.round((a.count / totalArchetypes) * 100),
      color: ARCHETYPE_COLORS[a.archetype] || '#6B7280',
    }));

    // Get risk tolerance distribution
    const riskStats = await db
      .select({
        riskTolerance: schema.userProfiles.riskTolerance,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(schema.userProfiles)
      .where(sql`${schema.userProfiles.riskTolerance} IS NOT NULL`)
      .groupBy(schema.userProfiles.riskTolerance)
      .orderBy(desc(sql`COUNT(*)`));

    const totalRisk = riskStats.reduce((sum, r) => sum + r.count, 0) || 1;

    const riskProfiles = riskStats
      .filter((r) => r.riskTolerance)
      .map((r) => ({
        riskTolerance: r.riskTolerance!,
        label: RISK_LABELS[r.riskTolerance!] || r.riskTolerance,
        count: r.count,
        percentage: Math.round((r.count / totalRisk) * 100),
        color: RISK_COLORS[r.riskTolerance!] || '#6B7280',
      }));

    // Ensure all risk types are represented
    const allRiskTypes = ['conservative', 'moderate', 'aggressive'];
    for (const rt of allRiskTypes) {
      if (!riskProfiles.find((r) => r.riskTolerance === rt)) {
        riskProfiles.push({
          riskTolerance: rt as any,
          label: RISK_LABELS[rt] || rt,
          count: 0,
          percentage: 0,
          color: RISK_COLORS[rt] || '#6B7280',
        });
      }
    }

    // Sort risk profiles by the predefined order
    riskProfiles.sort((a, b) => allRiskTypes.indexOf(a.riskTolerance) - allRiskTypes.indexOf(b.riskTolerance));

    const response = {
      archetypes,
      riskProfiles,
      updatedAt: new Date().toISOString(),
    };
    console.log('[API] Community composition response:', JSON.stringify(response, null, 2));
    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Error fetching community composition:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community composition' },
      { status: 500 }
    );
  }
}
