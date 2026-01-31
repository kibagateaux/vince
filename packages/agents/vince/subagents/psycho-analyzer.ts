/**
 * @module @bangui/agent/subagents/psycho-analyzer
 * Psychopolitical Analyzer - analyzes questionnaire responses to determine
 * user archetype, moral foundations, and cause affinities
 * @see {@link @bangui/types#PsychopoliticalAnalysis}
 */

import type {
  UUID,
  Timestamp,
  Archetype,
  MoralVector,
  ArchetypeProfile,
  CauseAffinityResult,
  PsychopoliticalAnalysis,
} from '@bangui/types';

/** Response input for analysis */
export interface ResponseInput {
  readonly questionId: string;
  readonly response: unknown;
}

// ============================================================================
// Constants
// ============================================================================

/** Mapping of response patterns to moral foundation weights */
const MORAL_WEIGHTS: Record<string, Partial<MoralVector>> = {
  'Care for the most vulnerable': { care: 0.9, fairness: 0.5 },
  'Fairness and equal opportunity for all': { fairness: 0.9, liberty: 0.6 },
  'Loyalty to community and tradition': { loyalty: 0.9, authority: 0.5 },
  'Individual freedom and autonomy': { liberty: 0.9, fairness: 0.4 },
  'Building lasting institutions': { authority: 0.7, sanctity: 0.6, loyalty: 0.5 },
  'Seeing direct impact on specific individuals': { care: 0.8 },
  'Supporting systemic or policy change': { fairness: 0.8, liberty: 0.6 },
  'Tax efficiency and financial planning': { authority: 0.4, liberty: 0.5 },
  'Aligning with my community or network': { loyalty: 0.9 },
  'Creating a lasting legacy': { sanctity: 0.7, authority: 0.6 },
};

/** Mapping of response patterns to archetype signals */
const ARCHETYPE_SIGNALS: Record<string, Partial<Record<Archetype, number>>> = {
  'Detailed metrics and data': { impact_maximizer: 0.9 },
  'Personal stories from beneficiaries': { community_builder: 0.7, values_expresser: 0.5 },
  'Reports on systemic progress': { system_changer: 0.8 },
  'Updates from community members': { community_builder: 0.9 },
  'Annual summaries and milestones': { legacy_creator: 0.7 },
  'Seeing direct impact on specific individuals': { community_builder: 0.6, values_expresser: 0.5 },
  'Supporting systemic or policy change': { system_changer: 0.9 },
  'Tax efficiency and financial planning': { impact_maximizer: 0.6 },
  'Aligning with my community or network': { community_builder: 0.8 },
  'Creating a lasting legacy': { legacy_creator: 0.9 },
  'Proven, lower-risk initiatives with steady impact': { legacy_creator: 0.5, community_builder: 0.4 },
  'Balanced mix of established and emerging opportunities': { impact_maximizer: 0.5 },
  'Higher-risk, higher-potential-impact ventures': { system_changer: 0.6, impact_maximizer: 0.5 },
};

/** Cause categories with keyword triggers */
const CAUSE_KEYWORDS: Record<string, readonly string[]> = {
  global_health: ['health', 'disease', 'medical', 'vaccine', 'hospital'],
  environment: ['climate', 'environment', 'water', 'nature', 'pollution', 'green'],
  education: ['education', 'school', 'learning', 'student', 'teach'],
  economic_empowerment: ['poverty', 'jobs', 'economic', 'income', 'microfinance'],
  policy_advocacy: ['policy', 'advocacy', 'reform', 'justice', 'systemic'],
  local_community: ['local', 'community', 'neighborhood', 'mutual aid'],
  arts_culture: ['art', 'culture', 'music', 'heritage', 'creative'],
  climate: ['climate', 'carbon', 'renewable', 'sustainable'],
};

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Normalizes a value to 0-1 range
 * @param value - Value to normalize
 * @param max - Maximum expected value
 */
const normalize = (value: number, max: number): number =>
  Math.min(1, Math.max(0, value / max));

/**
 * Extracts string response from response input
 * @param response - Raw response value
 */
const toStringResponse = (response: unknown): string =>
  typeof response === 'string' ? response : String(response ?? '');

/**
 * Calculates moral foundation vector from responses
 * @param responses - Questionnaire responses
 * @returns Normalized moral vector (0-1 for each dimension)
 */
export const calculateMoralVector = (
  responses: readonly ResponseInput[]
): MoralVector => {
  const accumulator: Record<keyof MoralVector, number> = {
    care: 0,
    fairness: 0,
    loyalty: 0,
    authority: 0,
    sanctity: 0,
    liberty: 0,
  };
  let matchCount = 0;

  for (const { response } of responses) {
    const str = toStringResponse(response);
    const weights = MORAL_WEIGHTS[str];
    if (weights) {
      matchCount++;
      for (const [key, value] of Object.entries(weights)) {
        accumulator[key as keyof MoralVector] += value;
      }
    }
  }

  const maxPossible = Math.max(1, matchCount);
  return {
    care: normalize(accumulator.care, maxPossible),
    fairness: normalize(accumulator.fairness, maxPossible),
    loyalty: normalize(accumulator.loyalty, maxPossible),
    authority: normalize(accumulator.authority, maxPossible),
    sanctity: normalize(accumulator.sanctity, maxPossible),
    liberty: normalize(accumulator.liberty, maxPossible),
  };
};

/**
 * Infers primary archetype from responses and moral vector
 * @param responses - Questionnaire responses
 * @param moralVector - Calculated moral vector
 * @returns Archetype profile with primary type and confidence
 */
export const inferArchetype = (
  responses: readonly ResponseInput[],
  moralVector: MoralVector
): ArchetypeProfile => {
  const scores: Record<Archetype, number> = {
    impact_maximizer: 0,
    community_builder: 0,
    system_changer: 0,
    values_expresser: 0,
    legacy_creator: 0,
    opportunistic_giver: 0,
  };

  // Score from direct response signals
  for (const { response } of responses) {
    const str = toStringResponse(response);
    const signals = ARCHETYPE_SIGNALS[str];
    if (signals) {
      for (const [archetype, weight] of Object.entries(signals)) {
        scores[archetype as Archetype] += weight;
      }
    }
  }

  // Adjust based on moral vector
  scores.impact_maximizer += moralVector.fairness * 0.3 + moralVector.liberty * 0.2;
  scores.community_builder += moralVector.loyalty * 0.4 + moralVector.care * 0.3;
  scores.system_changer += moralVector.fairness * 0.4 + moralVector.liberty * 0.3;
  scores.values_expresser += moralVector.sanctity * 0.3 + moralVector.care * 0.3;
  scores.legacy_creator += moralVector.authority * 0.3 + moralVector.sanctity * 0.3;
  scores.opportunistic_giver += moralVector.care * 0.2;

  // Sort and pick top
  const sorted = Object.entries(scores)
    .sort(([, a], [, b]) => b - a) as [Archetype, number][];

  const [primary, score] = sorted[0]!;
  const secondaryTraits = sorted
    .slice(1, 3)
    .filter(([, s]) => s > score * 0.5)
    .map(([a]) => a);

  const maxScore = Math.max(...Object.values(scores));
  const confidence = normalize(score, maxScore + 1);

  // Build cause alignment from archetype
  const causeAlignment: Record<string, number> = {};
  if (primary === 'impact_maximizer') {
    causeAlignment.global_health = 0.8;
    causeAlignment.education = 0.7;
  } else if (primary === 'community_builder') {
    causeAlignment.local_community = 0.9;
    causeAlignment.arts_culture = 0.6;
  } else if (primary === 'system_changer') {
    causeAlignment.policy_advocacy = 0.9;
    causeAlignment.climate = 0.7;
  } else if (primary === 'legacy_creator') {
    causeAlignment.education = 0.8;
    causeAlignment.arts_culture = 0.7;
  }

  return {
    primaryArchetype: primary,
    secondaryTraits,
    confidence,
    causeAlignment,
  };
};

/**
 * Infers cause affinities from open-ended responses
 * @param responses - Questionnaire responses
 * @returns Sorted cause affinities with reasoning
 */
export const inferCauseAffinities = (
  responses: readonly ResponseInput[]
): readonly CauseAffinityResult[] => {
  const scores: Record<string, { score: number; matches: string[] }> = {};

  // Initialize all causes
  for (const causeId of Object.keys(CAUSE_KEYWORDS)) {
    scores[causeId] = { score: 0, matches: [] };
  }

  // Scan responses for keyword matches
  for (const { response } of responses) {
    const text = toStringResponse(response).toLowerCase();
    for (const [causeId, keywords] of Object.entries(CAUSE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          scores[causeId]!.score += 0.3;
          if (!scores[causeId]!.matches.includes(keyword)) {
            scores[causeId]!.matches.push(keyword);
          }
        }
      }
    }
  }

  // Convert to sorted array
  return Object.entries(scores)
    .map(([causeId, { score, matches }]) => ({
      causeId,
      affinityScore: Math.min(1, score),
      reasoning:
        matches.length > 0
          ? `Mentioned: ${matches.join(', ')}`
          : 'No direct mentions, baseline affinity',
    }))
    .filter((a) => a.affinityScore > 0 || Math.random() > 0.5) // Keep some baseline
    .sort((a, b) => b.affinityScore - a.affinityScore);
};

/**
 * Performs complete psychopolitical analysis
 * @param userId - User UUID
 * @param responses - All questionnaire responses
 * @returns Complete analysis result
 */
export const analyzeResponses = (
  userId: UUID,
  responses: readonly ResponseInput[]
): PsychopoliticalAnalysis => {
  const moralVector = calculateMoralVector(responses);
  const archetypeProfile = inferArchetype(responses, moralVector);
  const causeAffinities = inferCauseAffinities(responses);

  return {
    userId,
    archetypeProfile,
    moralVector,
    causeAffinities,
    analyzedAt: Date.now() as Timestamp,
  };
};
