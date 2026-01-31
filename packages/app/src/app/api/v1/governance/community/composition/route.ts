/**
 * GET /api/v1/governance/community/composition
 * Gets archetype and risk distribution data
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../../../lib/db';

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
    const db = getSupabase();

    // Get archetype scores
    console.log('[API] Querying archetype and risk stats...');
    const { data: archetypeScores, error: archetypeError } = await db
      .from('archetype_scores')
      .select('archetype, profile_id');

    if (archetypeError) {
      console.error('[API] Error querying archetype scores:', archetypeError);
      throw archetypeError;
    }

    // Count unique profiles per archetype
    const archetypeProfileMap = new Map<string, Set<string>>();
    (archetypeScores || []).forEach((a) => {
      if (!a.archetype) return;
      const existing = archetypeProfileMap.get(a.archetype) || new Set();
      if (a.profile_id) existing.add(a.profile_id);
      archetypeProfileMap.set(a.archetype, existing);
    });

    const archetypeStats = Array.from(archetypeProfileMap.entries()).map(([archetype, profiles]) => ({
      archetype,
      count: profiles.size,
    }));

    // Sort by count descending
    archetypeStats.sort((a, b) => b.count - a.count);

    const totalArchetypes = archetypeStats.reduce((sum, a) => sum + a.count, 0) || 1;

    const archetypes = archetypeStats.map((a) => ({
      archetype: a.archetype,
      label: ARCHETYPE_LABELS[a.archetype] || a.archetype,
      count: a.count,
      percentage: Math.round((a.count / totalArchetypes) * 100),
      color: ARCHETYPE_COLORS[a.archetype] || '#6B7280',
    }));

    // Get risk tolerance distribution
    const { data: profiles, error: profilesError } = await db
      .from('user_profiles')
      .select('risk_tolerance')
      .not('risk_tolerance', 'is', null);

    if (profilesError) {
      console.error('[API] Error querying user profiles:', profilesError);
      throw profilesError;
    }

    // Count by risk tolerance
    const riskCountMap = new Map<string, number>();
    (profiles || []).forEach((p) => {
      if (!p.risk_tolerance) return;
      const existing = riskCountMap.get(p.risk_tolerance) || 0;
      riskCountMap.set(p.risk_tolerance, existing + 1);
    });

    const riskStats = Array.from(riskCountMap.entries()).map(([riskTolerance, count]) => ({
      riskTolerance,
      count,
    }));

    // Sort by count descending
    riskStats.sort((a, b) => b.count - a.count);

    const totalRisk = riskStats.reduce((sum, r) => sum + r.count, 0) || 1;

    const riskProfiles = riskStats.map((r) => ({
      riskTolerance: r.riskTolerance,
      label: RISK_LABELS[r.riskTolerance] || r.riskTolerance,
      count: r.count,
      percentage: Math.round((r.count / totalRisk) * 100),
      color: RISK_COLORS[r.riskTolerance] || '#6B7280',
    }));

    // Ensure all risk types are represented
    const allRiskTypes = ['conservative', 'moderate', 'aggressive'];
    for (const rt of allRiskTypes) {
      if (!riskProfiles.find((r) => r.riskTolerance === rt)) {
        riskProfiles.push({
          riskTolerance: rt,
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
