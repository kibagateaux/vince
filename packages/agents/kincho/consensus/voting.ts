/**
 * @module @bangui/agents/kincho/consensus/voting
 * Voting and modification merging logic for consensus
 */

import type {
  NegotiationRound,
  SubagentProposal,
  AllocationModification,
  ConsensusDecision,
  ConsensusConfig,
} from './types.js';

/**
 * Merge modifications from multiple rounds
 * Later rounds' modifications take precedence
 */
export function mergeModifications(rounds: NegotiationRound[]): AllocationModification[] {
  const allModifications = rounds.flatMap((r) => r.mergedModifications ?? []);

  // Group by causeId, taking the latest modification for each
  const byCause = new Map<string, AllocationModification>();

  for (const mod of allModifications) {
    // Later modifications overwrite earlier ones
    byCause.set(mod.causeId, mod);
  }

  return Array.from(byCause.values());
}

/**
 * Resolve the final voting decision from all rounds
 */
export function resolveVoting(
  rounds: NegotiationRound[],
  config: ConsensusConfig
): {
  decision: ConsensusDecision;
  confidence: number;
  humanReviewRecommended: boolean;
} {
  const lastRound = rounds[rounds.length - 1];
  if (!lastRound) {
    return {
      decision: 'escalated',
      confidence: 0,
      humanReviewRecommended: true,
    };
  }

  // Check if we reached consensus
  if (lastRound.status === 'consensus_reached') {
    const hasModifications = rounds.some((r) => (r.mergedModifications?.length ?? 0) > 0);
    const avgConfidence = calculateAverageConfidence(lastRound.proposals);

    return {
      decision: hasModifications ? 'modified' : 'approved',
      confidence: avgConfidence,
      humanReviewRecommended: avgConfidence < config.minConfidence,
    };
  }

  // Check for deadlock
  if (lastRound.status === 'deadlock') {
    const rejectCount = lastRound.proposals.filter((p) => p.vote === 'reject').length;
    const avgConfidence = calculateAverageConfidence(lastRound.proposals);

    // If majority rejected, return rejected
    if (rejectCount / lastRound.proposals.length >= config.approvalThreshold) {
      return {
        decision: 'rejected',
        confidence: avgConfidence,
        humanReviewRecommended: true,
      };
    }

    // Otherwise escalate
    return {
      decision: config.escalateOnDeadlock ? 'escalated' : 'rejected',
      confidence: avgConfidence,
      humanReviewRecommended: true,
    };
  }

  // If we ran out of rounds but status is still 'active', escalate
  if (lastRound.status === 'active' && rounds.length >= config.maxRounds) {
    return {
      decision: config.escalateOnDeadlock ? 'escalated' : 'modified',
      confidence: calculateAverageConfidence(lastRound.proposals),
      humanReviewRecommended: true,
    };
  }

  // Default: escalate
  return {
    decision: 'escalated',
    confidence: 0,
    humanReviewRecommended: true,
  };
}

/**
 * Check if modifications are converging between rounds
 * Useful for deciding whether to continue negotiation
 */
export function checkConvergence(
  round1: NegotiationRound,
  round2: NegotiationRound
): {
  isConverging: boolean;
  convergenceScore: number;
} {
  const mods1 = round1.mergedModifications ?? [];
  const mods2 = round2.mergedModifications ?? [];

  // If no modifications, consider it converged
  if (mods1.length === 0 && mods2.length === 0) {
    return { isConverging: true, convergenceScore: 1.0 };
  }

  // If only one round has modifications, not converging
  if (mods1.length === 0 || mods2.length === 0) {
    return { isConverging: false, convergenceScore: 0.5 };
  }

  // Compare modifications for the same causes
  let matchCount = 0;
  let totalComparisons = 0;

  for (const mod1 of mods1) {
    const mod2 = mods2.find((m) => m.causeId === mod1.causeId);
    if (mod2) {
      totalComparisons++;

      // Check if modification type matches
      if (mod1.modificationType === mod2.modificationType) {
        // For amount adjustments, check if amounts are similar
        if (mod1.modificationType === 'adjust_amount' && mod2.modificationType === 'adjust_amount') {
          const amount1 = mod1.proposedAmount ?? mod1.originalAmount ?? 0;
          const amount2 = mod2.proposedAmount ?? mod2.originalAmount ?? 0;
          const diff = Math.abs(amount1 - amount2);
          const avg = (amount1 + amount2) / 2;

          // If within 10% of each other, consider it a match
          if (avg === 0 || diff / avg < 0.1) {
            matchCount++;
          }
        } else {
          matchCount++;
        }
      }
    }
  }

  if (totalComparisons === 0) {
    return { isConverging: false, convergenceScore: 0 };
  }

  const convergenceScore = matchCount / totalComparisons;
  return {
    isConverging: convergenceScore >= 0.8,
    convergenceScore,
  };
}

/**
 * Calculate the average confidence across proposals
 */
function calculateAverageConfidence(proposals: SubagentProposal[]): number {
  if (proposals.length === 0) return 0;
  const total = proposals.reduce((sum, p) => sum + p.confidence, 0);
  return total / proposals.length;
}

/**
 * Get the overall sentiment from proposals
 */
export function getOverallSentiment(
  proposals: SubagentProposal[]
): 'positive' | 'negative' | 'mixed' {
  const approveCount = proposals.filter((p) => p.vote === 'approve').length;
  const rejectCount = proposals.filter((p) => p.vote === 'reject').length;

  if (approveCount === proposals.length) return 'positive';
  if (rejectCount === proposals.length) return 'negative';
  if (approveCount > rejectCount) return 'positive';
  if (rejectCount > approveCount) return 'negative';
  return 'mixed';
}

/**
 * Collect all concerns from proposals
 */
export function collectConcerns(proposals: SubagentProposal[]): string[] {
  const concerns = new Set<string>();
  for (const proposal of proposals) {
    for (const concern of proposal.concerns) {
      concerns.add(concern);
    }
  }
  return Array.from(concerns);
}

/**
 * Calculate weighted vote based on confidence
 */
export function calculateWeightedVote(proposals: SubagentProposal[]): {
  approveWeight: number;
  rejectWeight: number;
  modifyWeight: number;
} {
  let approveWeight = 0;
  let rejectWeight = 0;
  let modifyWeight = 0;

  for (const proposal of proposals) {
    switch (proposal.vote) {
      case 'approve':
        approveWeight += proposal.confidence;
        break;
      case 'reject':
        rejectWeight += proposal.confidence;
        break;
      case 'modify':
        modifyWeight += proposal.confidence;
        break;
    }
  }

  return { approveWeight, rejectWeight, modifyWeight };
}
