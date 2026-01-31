/**
 * @module @bangui/agents/kincho/consensus/negotiation-round
 * Individual negotiation round logic
 */

import { analyzeFinancials } from '../subagents/financial-analyzer.js';
import { assessRisk } from '../subagents/risk-engine.js';
import { evaluateMetaCognition } from '../subagents/meta-cognition.js';
import type {
  NegotiationContext,
  NegotiationRound,
  SubagentProposal,
  SubagentVote,
  AllocationModification,
  AuditEntry,
} from './types.js';

/**
 * Run a single negotiation round
 * Each subagent evaluates the request (potentially with modifications from previous rounds)
 */
export async function runNegotiationRound(
  context: NegotiationContext
): Promise<{ round: NegotiationRound; auditEntries: AuditEntry[] }> {
  const auditEntries: AuditEntry[] = [];
  const roundNumber = (context.previousRound?.roundNumber ?? 0) + 1;

  // Audit: Round start
  auditEntries.push({
    timestamp: Date.now(),
    eventType: 'round_start',
    description: `Starting negotiation round ${roundNumber}`,
    data: {
      hasModifications: context.accumulatedModifications.length > 0,
      modificationCount: context.accumulatedModifications.length,
    },
  });

  // Apply accumulated modifications to the request for this round
  const modifiedRequest = applyModificationsToRequest(
    context.request,
    context.accumulatedModifications
  );

  // Run all subagents in parallel
  const [financialResult, riskResult, metaResult] = await Promise.all([
    analyzeFinancials(modifiedRequest, context.fundState),
    assessRisk(modifiedRequest, context.fundState),
    evaluateMetaCognition(modifiedRequest, context.fundState),
  ]);

  // Convert subagent results to proposals
  const proposals: SubagentProposal[] = [
    convertFinancialToProposal(financialResult, context),
    convertRiskToProposal(riskResult, context),
    convertMetaToProposal(metaResult, context),
  ];

  // Audit: Proposals received
  for (const proposal of proposals) {
    auditEntries.push({
      timestamp: Date.now(),
      eventType: 'proposal_received',
      description: `${proposal.subagentId} voted ${proposal.vote} with confidence ${proposal.confidence.toFixed(2)}`,
      data: {
        subagentId: proposal.subagentId,
        vote: proposal.vote,
        confidence: proposal.confidence,
        concerns: proposal.concerns,
        hasModifications: (proposal.proposedModifications?.length ?? 0) > 0,
      },
    });
  }

  // Determine round status
  const status = determineRoundStatus(proposals, context.config.approvalThreshold);

  const round: NegotiationRound = {
    roundNumber,
    proposals,
    status,
    timestamp: Date.now(),
    summary: generateRoundSummary(proposals, status),
  };

  // If there are modifications to merge, do so
  if (status === 'active' || status === 'consensus_reached') {
    const modifications = proposals.flatMap((p) => p.proposedModifications ?? []);
    if (modifications.length > 0) {
      round.mergedModifications = mergeRoundModifications(modifications);
      auditEntries.push({
        timestamp: Date.now(),
        eventType: 'modification_merged',
        description: `Merged ${round.mergedModifications.length} modifications from this round`,
        data: { modifications: round.mergedModifications },
      });
    }
  }

  return { round, auditEntries };
}

/**
 * Apply accumulated modifications to create a modified request
 * Returns a mutable deep copy with modifications applied
 */
function applyModificationsToRequest(
  request: import('@bangui/types').AllocationRequest,
  modifications: AllocationModification[]
): import('@bangui/types').AllocationRequest {
  if (modifications.length === 0) {
    return request;
  }

  // Deep clone to get a mutable copy (JSON parse/stringify removes readonly)
  const modified = JSON.parse(JSON.stringify(request)) as {
    id: string;
    depositId: string | null;
    userId: string;
    conversationId: string | null;
    amount: string;
    userPreferences: unknown;
    vinceRecommendation: {
      suggestedAllocations: Array<{
        causeId: string;
        causeName: string;
        amount: number;
        percentage: number;
        reasoning: string;
      }>;
      psychProfile: unknown;
      walletAnalysis?: unknown;
      reasoning: string;
    };
    status: string;
    createdAt: string;
  };

  // Apply each modification
  for (const mod of modifications) {
    if (mod.modificationType === 'adjust_amount' && mod.proposedAmount !== undefined) {
      const allocation = modified.vinceRecommendation.suggestedAllocations.find(
        (a) => a.causeId === mod.causeId
      );
      if (allocation) {
        allocation.amount = mod.proposedAmount;
      }
    } else if (mod.modificationType === 'reject_cause') {
      const index = modified.vinceRecommendation.suggestedAllocations.findIndex(
        (a) => a.causeId === mod.causeId
      );
      if (index >= 0) {
        modified.vinceRecommendation.suggestedAllocations.splice(index, 1);
      }
    }
    // add_condition modifications are tracked but don't modify the request directly
  }

  return modified as unknown as import('@bangui/types').AllocationRequest;
}

/**
 * Convert financial analyzer result to a proposal
 */
function convertFinancialToProposal(
  result: import('../subagents/financial-analyzer.js').FinancialAnalysisResult,
  context: NegotiationContext
): SubagentProposal {
  let vote: SubagentVote;
  const modifications: AllocationModification[] = [];

  if (result.approved && result.fitScore >= 0.8) {
    vote = 'approve';
  } else if (result.approved && result.fitScore >= 0.6) {
    vote = 'modify';
    // Suggest proportional reduction if fit score is moderate
    const reductionFactor = result.fitScore;
    const allocations = context.request.vinceRecommendation.suggestedAllocations;
    for (const allocation of allocations) {
      if (result.fitScore < 0.75) {
        modifications.push({
          causeId: allocation.causeId,
          modificationType: 'adjust_amount',
          originalAmount: allocation.amount,
          proposedAmount: Math.round(allocation.amount * reductionFactor),
          reasoning: `Reduced allocation due to moderate fit score (${result.fitScore.toFixed(2)})`,
        });
      }
    }
  } else {
    vote = 'reject';
  }

  return {
    subagentId: 'financial_analyzer',
    vote,
    confidence: result.fitScore,
    proposedModifications: modifications.length > 0 ? modifications : undefined,
    reasoning: result.reasoning ?? `Fit score: ${result.fitScore.toFixed(2)}`,
    concerns: result.approved ? [] : ['Portfolio fit concerns'],
    metrics: {
      fitScore: result.fitScore,
    },
  };
}

/**
 * Convert risk engine result to a proposal
 */
function convertRiskToProposal(
  result: import('../subagents/risk-engine.js').RiskAssessmentResult,
  context: NegotiationContext
): SubagentProposal {
  let vote: SubagentVote;
  const modifications: AllocationModification[] = [];
  const concerns: string[] = [];

  const aggregateRisk = result.riskAssessment.aggregateRisk;

  if (result.approved && aggregateRisk <= 0.3) {
    vote = 'approve';
  } else if (aggregateRisk <= 0.5) {
    vote = 'modify';

    // Identify high-risk areas
    if (result.riskAssessment.marketRisk > 0.5) {
      concerns.push('Elevated market risk');
    }
    if (!result.riskAssessment.complianceChecks.concentrationLimit) {
      concerns.push('Concentration limit exceeded');
    }
    if (result.riskAssessment.liquidityRisk > 0.5) {
      concerns.push('Liquidity concerns');
    }

    // Suggest risk-based modifications
    const allocations = context.request.vinceRecommendation.suggestedAllocations;
    for (const allocation of allocations) {
      const riskAdjustedAmount = Math.round(allocation.amount * (1 - aggregateRisk * 0.5));
      if (riskAdjustedAmount < allocation.amount) {
        modifications.push({
          causeId: allocation.causeId,
          modificationType: 'adjust_amount',
          originalAmount: allocation.amount,
          proposedAmount: riskAdjustedAmount,
          reasoning: `Risk-adjusted reduction (aggregate risk: ${aggregateRisk.toFixed(2)})`,
        });
      }
    }
  } else {
    vote = 'reject';
    concerns.push(`Aggregate risk too high: ${aggregateRisk.toFixed(2)}`);
  }

  return {
    subagentId: 'risk_engine',
    vote,
    confidence: 1 - aggregateRisk,
    proposedModifications: modifications.length > 0 ? modifications : undefined,
    reasoning: result.reasoning ?? `Aggregate risk: ${aggregateRisk.toFixed(2)}`,
    concerns,
    metrics: {
      aggregateRisk,
      marketRisk: result.riskAssessment.marketRisk,
      liquidityRisk: result.riskAssessment.liquidityRisk,
      operationalRisk: result.riskAssessment.operationalRisk,
    },
  };
}

/**
 * Convert meta-cognition result to a proposal
 */
function convertMetaToProposal(
  result: import('../subagents/meta-cognition.js').MetaCognitionResult,
  _context: NegotiationContext
): SubagentProposal {
  let vote: SubagentVote;
  const concerns: string[] = [...result.uncertaintySources];

  if (result.confidence >= 0.8 && !result.humanOverrideRecommended) {
    vote = 'approve';
  } else if (result.confidence >= 0.6) {
    vote = 'modify';
    if (result.humanOverrideRecommended) {
      concerns.push('Human review recommended');
    }
  } else {
    vote = 'reject';
    concerns.push('Confidence too low for automated decision');
  }

  return {
    subagentId: 'meta_cognition',
    vote,
    confidence: result.confidence,
    reasoning: result.reasoningChain
      .map((r) => `${r.premise} → ${r.conclusion}`)
      .join('; ') || `Confidence: ${result.confidence.toFixed(2)}`,
    concerns,
    metrics: {
      confidence: result.confidence,
    },
  };
}

/**
 * Determine the status of a round based on proposals
 */
function determineRoundStatus(
  proposals: SubagentProposal[],
  approvalThreshold: number
): import('./types.js').NegotiationStatus {
  const approveCount = proposals.filter((p) => p.vote === 'approve').length;
  const rejectCount = proposals.filter((p) => p.vote === 'reject').length;
  const modifyCount = proposals.filter((p) => p.vote === 'modify').length;

  const approvalRatio = approveCount / proposals.length;
  const rejectRatio = rejectCount / proposals.length;

  // Unanimous approval
  if (approveCount === proposals.length) {
    return 'consensus_reached';
  }

  // Majority approval (including those who want modifications)
  if (approvalRatio >= approvalThreshold) {
    return 'consensus_reached';
  }

  // Majority rejection
  if (rejectRatio >= approvalThreshold) {
    return 'deadlock';
  }

  // Mixed votes with modifications - continue negotiation
  if (modifyCount > 0) {
    return 'active';
  }

  // No clear consensus
  return 'deadlock';
}

/**
 * Merge modifications from a single round
 */
function mergeRoundModifications(
  modifications: AllocationModification[]
): AllocationModification[] {
  // Group modifications by causeId
  const byCause = new Map<string, AllocationModification[]>();

  for (const mod of modifications) {
    const existing = byCause.get(mod.causeId) ?? [];
    existing.push(mod);
    byCause.set(mod.causeId, existing);
  }

  const merged: AllocationModification[] = [];

  for (const [causeId, mods] of byCause) {
    // If any subagent wants to reject the cause, reject it
    const rejectMod = mods.find((m) => m.modificationType === 'reject_cause');
    if (rejectMod) {
      merged.push(rejectMod);
      continue;
    }

    // For amount adjustments, take the most conservative (lowest) proposed amount
    const amountMods = mods.filter(
      (m) => m.modificationType === 'adjust_amount' && m.proposedAmount !== undefined
    );
    if (amountMods.length > 0) {
      const minAmount = Math.min(...amountMods.map((m) => m.proposedAmount!));
      const reasonings = amountMods.map((m) => m.reasoning);
      merged.push({
        causeId,
        modificationType: 'adjust_amount',
        originalAmount: amountMods[0]?.originalAmount,
        proposedAmount: minAmount,
        reasoning: `Merged: ${reasonings.join('; ')}`,
      });
    }

    // Collect all conditions
    const conditionMods = mods.filter((m) => m.modificationType === 'add_condition');
    for (const condMod of conditionMods) {
      merged.push(condMod);
    }
  }

  return merged;
}

/**
 * Generate a summary of the round
 */
function generateRoundSummary(
  proposals: SubagentProposal[],
  status: import('./types.js').NegotiationStatus
): string {
  const votes = proposals.map((p) => `${p.subagentId}: ${p.vote}`).join(', ');

  switch (status) {
    case 'consensus_reached':
      return `Consensus reached. Votes: ${votes}`;
    case 'deadlock':
      return `Deadlock - no consensus possible. Votes: ${votes}`;
    case 'escalated':
      return `Escalated for human review. Votes: ${votes}`;
    case 'active':
      return `Negotiation continues with modifications. Votes: ${votes}`;
  }
}
