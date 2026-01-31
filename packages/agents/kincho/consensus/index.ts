/**
 * @module @bangui/agents/kincho/consensus
 * Multi-round negotiation consensus orchestrator
 */

import type { AllocationRequest, FundState } from '@bangui/types';
import { storeMemory } from '../../shared/db/index.js';
import { runNegotiationRound } from './negotiation-round.js';
import { mergeModifications, resolveVoting, checkConvergence } from './voting.js';
import type {
  ConsensusConfig,
  ConsensusResult,
  NegotiationRound,
  NegotiationContext,
  AuditEntry,
  AllocationModification,
} from './types.js';
import { DEFAULT_CONSENSUS_CONFIG } from './types.js';

export * from './types.js';
export { runNegotiationRound } from './negotiation-round.js';
export { mergeModifications, resolveVoting, checkConvergence } from './voting.js';

/**
 * Run the full consensus process
 * Orchestrates multiple rounds of negotiation until consensus or max rounds
 */
export async function runConsensusProcess(
  request: AllocationRequest,
  fundState: FundState,
  config: Partial<ConsensusConfig> = {}
): Promise<ConsensusResult> {
  const fullConfig: ConsensusConfig = { ...DEFAULT_CONSENSUS_CONFIG, ...config };
  const rounds: NegotiationRound[] = [];
  const auditTrail: AuditEntry[] = [];
  let accumulatedModifications: AllocationModification[] = [];

  // Run negotiation rounds
  for (let i = 0; i < fullConfig.maxRounds; i++) {
    const context: NegotiationContext = {
      request,
      fundState,
      previousRound: rounds[rounds.length - 1],
      accumulatedModifications,
      config: fullConfig,
    };

    const { round, auditEntries } = await runNegotiationRound(context);
    rounds.push(round);
    auditTrail.push(...auditEntries);

    // Accumulate modifications
    if (round.mergedModifications) {
      accumulatedModifications = mergeModifications(rounds);
    }

    // Check for early termination conditions
    if (round.status === 'consensus_reached') {
      auditTrail.push({
        timestamp: Date.now(),
        eventType: 'consensus_reached',
        description: `Consensus reached in round ${round.roundNumber}`,
        data: { roundNumber: round.roundNumber },
      });
      break;
    }

    if (round.status === 'deadlock') {
      if (fullConfig.escalateOnDeadlock) {
        auditTrail.push({
          timestamp: Date.now(),
          eventType: 'escalation',
          description: `Deadlock in round ${round.roundNumber}, escalating to human review`,
          data: { roundNumber: round.roundNumber },
        });
      }
      break;
    }

    // Check for convergence between rounds (if not first round)
    if (rounds.length >= 2) {
      const { isConverging, convergenceScore } = checkConvergence(
        rounds[rounds.length - 2]!,
        round
      );

      if (isConverging && convergenceScore >= 0.9) {
        // Modifications have converged, treat as consensus
        round.status = 'consensus_reached';
        auditTrail.push({
          timestamp: Date.now(),
          eventType: 'consensus_reached',
          description: `Modifications converged (score: ${convergenceScore.toFixed(2)})`,
          data: { convergenceScore },
        });
        break;
      }
    }
  }

  // Resolve final voting
  const { decision, confidence, humanReviewRecommended } = resolveVoting(rounds, fullConfig);
  const finalModifications = mergeModifications(rounds);

  // Generate summary
  const summary = generateConsensusSummary(rounds, decision, confidence);

  // Store decision in memory for learning
  await storeDecisionMemory(request, rounds, decision, confidence);

  return {
    achieved: decision === 'approved' || decision === 'modified',
    decision,
    rounds,
    finalModifications: finalModifications.length > 0 ? finalModifications : undefined,
    auditTrail,
    confidence,
    humanReviewRecommended,
    summary,
  };
}

/**
 * Generate a human-readable summary of the consensus process
 */
function generateConsensusSummary(
  rounds: NegotiationRound[],
  decision: string,
  confidence: number
): string {
  const parts: string[] = [];

  parts.push(`Consensus process completed in ${rounds.length} round(s).`);
  parts.push(`Final decision: ${decision.toUpperCase()}`);
  parts.push(`Overall confidence: ${(confidence * 100).toFixed(0)}%`);

  // Summarize each round
  for (const round of rounds) {
    const votes = round.proposals
      .map((p) => `${p.subagentId.replace('_', ' ')}: ${p.vote}`)
      .join(', ');
    parts.push(`Round ${round.roundNumber}: ${votes} (${round.status})`);
  }

  // List key concerns
  const allConcerns = new Set<string>();
  for (const round of rounds) {
    for (const proposal of round.proposals) {
      for (const concern of proposal.concerns) {
        allConcerns.add(concern);
      }
    }
  }

  if (allConcerns.size > 0) {
    parts.push(`Key concerns: ${Array.from(allConcerns).join('; ')}`);
  }

  return parts.join(' ');
}

/**
 * Store the decision in agent memory for learning
 */
async function storeDecisionMemory(
  request: AllocationRequest,
  rounds: NegotiationRound[],
  decision: string,
  confidence: number
): Promise<void> {
  try {
    const lastRound = rounds[rounds.length - 1];
    const content = JSON.stringify({
      decision,
      confidence,
      roundCount: rounds.length,
      votes: lastRound?.proposals.map((p) => ({
        subagent: p.subagentId,
        vote: p.vote,
        confidence: p.confidence,
      })),
      concerns: lastRound?.proposals.flatMap((p) => p.concerns) ?? [],
      modificationsApplied: rounds.some((r) => (r.mergedModifications?.length ?? 0) > 0),
    });

    await storeMemory({
      agentId: 'kincho',
      userId: request.userId as string,
      allocationRequestId: request.id as string,
      content,
      memoryType: 'allocation_decision',
      importance: confidence,
      metadata: {
        decision,
        roundCount: rounds.length,
        amount: Number(request.amount),
      },
    });
  } catch {
    // Memory storage failure should not block consensus process
    console.warn('Failed to store consensus decision in memory');
  }
}
