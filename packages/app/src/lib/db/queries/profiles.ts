/**
 * @module @bangui/app/lib/db/queries/profiles
 * User profile-related database queries using Supabase
 */

import type { Db } from '../client';
import type {
  UserProfileRow,
  ArchetypeScoreRow,
  CauseAffinityRow,
  ArchetypeScoreInsert,
  CauseAffinityInsert,
  Archetype,
  Json,
} from '../types';

/**
 * Gets user profile by user ID with archetype scores and cause affinities
 */
export const getUserProfile = async (
  db: Db,
  userId: string
): Promise<(UserProfileRow & {
  archetypeScores: ArchetypeScoreRow[];
  causeAffinities: CauseAffinityRow[];
}) | null> => {
  const { data, error } = await db
    .from('user_profiles')
    .select(`
      *,
      archetypeScores:archetype_scores(*),
      causeAffinities:cause_affinities(*)
    `)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data as (UserProfileRow & {
    archetypeScores: ArchetypeScoreRow[];
    causeAffinities: CauseAffinityRow[];
  }) | null;
};

/**
 * Input for saving archetype scores
 */
export interface SaveArchetypeScoresInput {
  readonly profileId: string;
  readonly scores: ReadonlyArray<{
    readonly archetype: Archetype;
    readonly score: number;
    readonly confidence?: number;
  }>;
}

/**
 * Saves multiple archetype scores for a profile
 */
export const saveArchetypeScores = async (
  db: Db,
  input: SaveArchetypeScoresInput
): Promise<void> => {
  const inserts: ArchetypeScoreInsert[] = input.scores.map((s) => ({
    profile_id: input.profileId,
    archetype: s.archetype,
    score: String(s.score),
    confidence: s.confidence !== undefined ? String(s.confidence) : null,
  }));

  const { error } = await db
    .from('archetype_scores')
    .insert(inserts);

  if (error) {
    throw error;
  }
};

/**
 * Input for saving cause affinities
 */
export interface SaveCauseAffinitiesInput {
  readonly profileId: string;
  readonly affinities: ReadonlyArray<{
    readonly causeCategory: string;
    readonly affinityScore: number;
    readonly reasoning?: Record<string, unknown>;
  }>;
}

/**
 * Saves cause affinities for a profile
 */
export const saveCauseAffinities = async (
  db: Db,
  input: SaveCauseAffinitiesInput
): Promise<void> => {
  const inserts: CauseAffinityInsert[] = input.affinities.map((a) => ({
    profile_id: input.profileId,
    cause_category: a.causeCategory,
    affinity_score: String(a.affinityScore),
    reasoning: (a.reasoning ?? null) as Json | null,
  }));

  const { error } = await db
    .from('cause_affinities')
    .insert(inserts);

  if (error) {
    throw error;
  }
};
