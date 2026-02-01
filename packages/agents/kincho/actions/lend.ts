/**
 * @module @bangui/agents/kincho/actions/lend
 * Lend action for Kincho agent - handles credit delegation to cities/projects
 */

import type { Address, BigIntString, FundState } from '@bangui/types';
import type { KinchoRuntime } from '../runtime.js';

/** Input for a lend action */
export interface LendActionInput {
  /** City/project address to receive credit delegation */
  city: Address;
  /** Amount to delegate (Aave market denominated) */
  amount: BigIntString;
  /** Reasoning for the lend decision */
  reasoning: string;
  /** Optional metadata for audit trail */
  metadata?: Record<string, unknown>;
}

/** Result of lend action validation */
export interface LendValidationResult {
  /** Whether the lend action is approved */
  approved: boolean;
  /** Decision type */
  decision: 'approved' | 'modified' | 'rejected';
  /** Fit score from financial analyzer (0-1) */
  fitScore: number;
  /** Aggregate risk score from risk engine (0-1, lower is better) */
  riskScore: number;
  /** Confidence score from meta-cognition (0-1) */
  confidenceScore: number;
  /** List of concerns from all subagents */
  concerns: string[];
  /** Whether human review is recommended */
  humanReviewRecommended: boolean;
  /** Suggested modifications if decision is 'modified' */
  modifications?: {
    suggestedAmount?: BigIntString;
    reason: string;
  };
}

/** Lend action execution result */
export interface LendActionResult {
  /** Whether the action was successful */
  success: boolean;
  /** Transaction hash if executed */
  txHash?: string;
  /** Validation result from consensus */
  validation: LendValidationResult;
  /** Error message if failed */
  error?: string;
}

/**
 * Thresholds for lend action approval
 */
export const LEND_THRESHOLDS = {
  /** Minimum fit score for approval */
  MIN_FIT_SCORE: 0.6,
  /** Maximum aggregate risk for approval */
  MAX_RISK_SCORE: 0.4,
  /** Minimum confidence for auto-approval */
  MIN_CONFIDENCE: 0.7,
  /** Maximum single lend as percentage of liquidity */
  MAX_LEND_PERCENTAGE: 0.25,
} as const;

/**
 * Validate a lend action using Kincho's consensus system
 *
 * @param runtime - Kincho runtime instance
 * @param input - Lend action input
 * @param fundState - Current fund state
 * @returns Validation result with approval decision
 */
export async function validateLendAction(
  runtime: KinchoRuntime,
  input: LendActionInput,
  fundState: FundState
): Promise<LendValidationResult> {
  // Create a minimal allocation request for consensus
  // Using 'as any' since we're creating a mock request for internal consensus only
  const amountNumber = Number(input.amount) / 1e18;
  // Get vault address from runtime config
  const vaultAddress = runtime.config.vaultAddress ?? null;
  const mockRequest = {
    id: crypto.randomUUID() as string & { readonly __brand: 'UUID' },
    depositId: null,
    userId: 'kincho-lend' as string & { readonly __brand: 'UUID' },
    conversationId: null,
    amount: input.amount,
    userPreferences: {
      causes: ['lending'] as readonly string[],
      riskTolerance: 'moderate' as const,
    },
    vinceRecommendation: {
      suggestedAllocations: [
        {
          causeId: input.city,
          causeName: `City ${input.city.slice(0, 8)}...`,
          amount: amountNumber,
          percentage: 100,
          reasoning: input.reasoning,
        },
      ],
      psychProfile: null,
      reasoning: input.reasoning,
    },
    vaultAddress,
    status: 'pending' as const,
    createdAt: Date.now() as number & { readonly __brand: 'Timestamp' },
  };

  // Gather subagent consensus
  const consensus = await runtime.gatherSubagentConsensus(mockRequest as any, fundState);

  // Collect concerns
  const concerns: string[] = [];

  if (!consensus.financialAnalyzer.approved) {
    concerns.push(`Financial: ${consensus.financialAnalyzer.reasoning || 'Not approved'}`);
  }

  if (!consensus.riskEngine.approved) {
    concerns.push(`Risk: Aggregate risk too high (${(consensus.riskEngine.riskAssessment.aggregateRisk * 100).toFixed(1)}%)`);
  }

  if (consensus.metaCognition.humanOverrideRecommended) {
    concerns.push('Meta-cognition recommends human review');
  }

  // Check amount against liquidity
  const maxAllowed = fundState.liquidityAvailable * LEND_THRESHOLDS.MAX_LEND_PERCENTAGE;
  if (amountNumber > maxAllowed) {
    concerns.push(`Amount exceeds ${LEND_THRESHOLDS.MAX_LEND_PERCENTAGE * 100}% of available liquidity`);
  }

  // Determine approval
  const fitScore = consensus.financialAnalyzer.fitScore;
  const riskScore = consensus.riskEngine.riskAssessment.aggregateRisk;
  const confidenceScore = consensus.metaCognition.confidence;

  const meetsThresholds =
    fitScore >= LEND_THRESHOLDS.MIN_FIT_SCORE &&
    riskScore <= LEND_THRESHOLDS.MAX_RISK_SCORE &&
    confidenceScore >= LEND_THRESHOLDS.MIN_CONFIDENCE;

  const approved = consensus.hasConsensus && meetsThresholds && amountNumber <= maxAllowed;

  // Determine decision type
  let decision: 'approved' | 'modified' | 'rejected';
  let modifications: LendValidationResult['modifications'];

  if (approved) {
    decision = 'approved';
  } else if (consensus.hasConsensus && amountNumber > maxAllowed) {
    // Suggest reduced amount
    decision = 'modified';
    const suggestedAmount = Math.floor(maxAllowed * 1e18);
    modifications = {
      suggestedAmount: String(suggestedAmount) as BigIntString,
      reason: `Amount reduced to ${LEND_THRESHOLDS.MAX_LEND_PERCENTAGE * 100}% of available liquidity`,
    };
  } else {
    decision = 'rejected';
  }

  return {
    approved,
    decision,
    fitScore,
    riskScore,
    confidenceScore,
    concerns,
    humanReviewRecommended: consensus.metaCognition.humanOverrideRecommended,
    modifications,
  };
}

/**
 * Create a lend action audit entry
 */
export function createLendAuditEntry(
  input: LendActionInput,
  validation: LendValidationResult,
  txHash?: string
): {
  timestamp: number;
  action: 'lend';
  city: Address;
  amount: string;
  reasoning: string;
  validation: LendValidationResult;
  txHash?: string;
} {
  return {
    timestamp: Date.now(),
    action: 'lend',
    city: input.city,
    amount: input.amount,
    reasoning: input.reasoning,
    validation,
    txHash,
  };
}
