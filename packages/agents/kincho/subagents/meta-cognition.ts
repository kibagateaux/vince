/**
 * @module @bangui/agent/subagents/meta-cognition
 * Meta-cognition subagent for Kincho
 * Evaluates confidence, uncertainty, and decision quality
 */

import type {
  AllocationRequest,
  FundState,
  ReasoningStep,
} from '@bangui/types';

/** Meta-cognition evaluation result */
export interface MetaCognitionResult {
  readonly confidence: number;
  readonly uncertaintySources: readonly string[];
  readonly reasoningChain: readonly ReasoningStep[];
  readonly humanOverrideRecommended: boolean;
}

/** Confidence thresholds */
const CONFIDENCE_THRESHOLDS = {
  high: 0.85,
  medium: 0.7,
  low: 0.5,
  minimum: 0.3,
};

/**
 * Evaluates data quality and completeness
 */
function evaluateDataQuality(
  request: AllocationRequest,
  fundState: FundState
): { score: number; uncertainties: string[] } {
  let score = 0.8; // Base score assuming good data
  const uncertainties: string[] = [];

  // Check user profile completeness
  if (!request.userPreferences.archetypeProfile) {
    score -= 0.15;
    uncertainties.push('Incomplete user archetype profile');
  }

  if (!request.userPreferences.moralVector) {
    score -= 0.1;
    uncertainties.push('Missing moral vector analysis');
  }

  // Check Vince recommendation quality
  if (!request.vinceRecommendation.psychProfile) {
    score -= 0.1;
    uncertainties.push('Limited psychopolitical analysis available');
  }

  if (request.vinceRecommendation.suggestedAllocations.length === 0) {
    score -= 0.3;
    uncertainties.push('No specific allocations suggested');
  }

  // Check reasoning quality
  const hasDetailedReasoning = request.vinceRecommendation.suggestedAllocations.every(
    (a) => a.reasoning && a.reasoning.length > 20
  );
  if (!hasDetailedReasoning) {
    score -= 0.05;
    uncertainties.push('Some allocations lack detailed reasoning');
  }

  // Check fund state quality
  if (fundState.totalAum === 0) {
    score -= 0.2;
    uncertainties.push('Fund state indicates zero AUM - possible data issue');
  }

  if (fundState.riskParameters.currentHF === 0) {
    score -= 0.1;
    uncertainties.push('Health factor data unavailable');
  }

  return {
    score: Math.max(0, score),
    uncertainties,
  };
}

/**
 * Evaluates decision complexity
 */
function evaluateComplexity(
  request: AllocationRequest
): { score: number; uncertainties: string[] } {
  let score = 0.9; // Base score for simple decisions
  const uncertainties: string[] = [];

  const numAllocations = request.vinceRecommendation.suggestedAllocations.length;

  // More allocations = more complexity = lower confidence
  if (numAllocations > 5) {
    score -= 0.2;
    uncertainties.push('Complex allocation with many targets');
  } else if (numAllocations > 3) {
    score -= 0.1;
    uncertainties.push('Moderately complex allocation');
  }

  // Large amounts require more scrutiny
  const amount = Number(request.amount);
  if (amount > 100000) {
    score -= 0.1;
    uncertainties.push('Large allocation amount requires additional verification');
  } else if (amount > 50000) {
    score -= 0.05;
  }

  // Mixed allocation types (grant + yield) add complexity
  const hasGrants = request.vinceRecommendation.suggestedAllocations.some(
    (a) => !a.causeId.includes('yield')
  );
  const hasYield = request.vinceRecommendation.suggestedAllocations.some(
    (a) => a.causeId.includes('yield')
  );
  if (hasGrants && hasYield) {
    score -= 0.05;
    uncertainties.push('Mixed grant and yield allocation');
  }

  return {
    score: Math.max(0, score),
    uncertainties,
  };
}

/**
 * Evaluates historical patterns and precedent
 */
function evaluatePrecedent(
  request: AllocationRequest,
  fundState: FundState
): { score: number; uncertainties: string[] } {
  let score = 0.7; // Base score - moderate precedent assumed
  const uncertainties: string[] = [];

  // Check if causes are already in portfolio (familiar territory)
  const existingCategories = Object.keys(fundState.currentAllocation);
  const newCategories = request.vinceRecommendation.suggestedAllocations.filter(
    (a) => {
      const category = a.causeId.split('-')[1] ?? 'other';
      return !existingCategories.includes(category);
    }
  );

  if (newCategories.length === 0) {
    score += 0.2; // All familiar categories
  } else if (newCategories.length === request.vinceRecommendation.suggestedAllocations.length) {
    score -= 0.15;
    uncertainties.push('All allocations to new cause categories - limited historical data');
  } else {
    uncertainties.push('Some allocations to new categories');
  }

  // First-time donor has less precedent
  if (!request.userPreferences.archetypeProfile?.confidence) {
    score -= 0.1;
    uncertainties.push('First-time donor - limited behavioral data');
  }

  return {
    score: Math.max(0, score),
    uncertainties,
  };
}

/**
 * Builds reasoning chain for the decision
 */
function buildReasoningChain(
  request: AllocationRequest,
  fundState: FundState
): ReasoningStep[] {
  const steps: ReasoningStep[] = [];
  let stepNum = 1;

  // Step 1: Analyze user preferences
  const primaryCauses = request.userPreferences.causes.slice(0, 3).join(', ');
  steps.push({
    step: stepNum++,
    premise: `User expressed interest in: ${primaryCauses || 'general philanthropy'}`,
    conclusion: `Allocations should prioritize ${primaryCauses || 'diversified impact'}`,
  });

  // Step 2: Evaluate risk tolerance
  steps.push({
    step: stepNum++,
    premise: `User risk tolerance: ${request.userPreferences.riskTolerance}`,
    conclusion:
      request.userPreferences.riskTolerance === 'aggressive'
        ? 'Can consider higher-risk/higher-impact allocations'
        : request.userPreferences.riskTolerance === 'conservative'
          ? 'Should prioritize established, low-risk allocations'
          : 'Balanced approach appropriate',
  });

  // Step 3: Check fund constraints
  const totalAmount = Number(request.amount);
  const liquidityUsage = totalAmount / fundState.liquidityAvailable;
  steps.push({
    step: stepNum++,
    premise: `Allocation uses ${(liquidityUsage * 100).toFixed(0)}% of available liquidity`,
    conclusion:
      liquidityUsage > 0.5
        ? 'May need to modify allocation to maintain liquidity reserve'
        : 'Allocation within liquidity constraints',
  });

  // Step 4: Evaluate Vince recommendation
  const vinceConfidence = request.vinceRecommendation.psychProfile?.archetypeProfile?.confidence ?? 0;
  steps.push({
    step: stepNum++,
    premise: `Vince analysis confidence: ${(vinceConfidence * 100).toFixed(0)}%`,
    conclusion:
      vinceConfidence > 0.7
        ? 'High-confidence recommendation from Vince'
        : vinceConfidence > 0.5
          ? 'Moderate-confidence recommendation - verify alignment'
          : 'Low-confidence recommendation - extra scrutiny required',
  });

  // Step 5: Final decision logic
  const numAllocations = request.vinceRecommendation.suggestedAllocations.length;
  steps.push({
    step: stepNum++,
    premise: `Proposed ${numAllocations} allocations totaling $${totalAmount.toLocaleString()}`,
    conclusion: 'Proceed with allocation analysis and subagent consensus check',
  });

  return steps;
}

/**
 * Evaluates meta-cognition aspects of an allocation request
 */
export async function evaluateMetaCognition(
  request: AllocationRequest,
  fundState: FundState
): Promise<MetaCognitionResult> {
  // Evaluate different aspects
  const dataQuality = evaluateDataQuality(request, fundState);
  const complexity = evaluateComplexity(request);
  const precedent = evaluatePrecedent(request, fundState);

  // Calculate weighted confidence score
  const confidence =
    dataQuality.score * 0.4 +
    complexity.score * 0.3 +
    precedent.score * 0.3;

  // Collect all uncertainty sources
  const uncertaintySources = [
    ...dataQuality.uncertainties,
    ...complexity.uncertainties,
    ...precedent.uncertainties,
  ];

  // Build reasoning chain
  const reasoningChain = buildReasoningChain(request, fundState);

  // Determine if human override is recommended
  const humanOverrideRecommended =
    confidence < CONFIDENCE_THRESHOLDS.medium ||
    uncertaintySources.length > 5 ||
    Number(request.amount) > 100000; // Large amounts always flagged

  // Add final uncertainty if low confidence
  if (confidence < CONFIDENCE_THRESHOLDS.low) {
    uncertaintySources.push(
      'Overall confidence below acceptable threshold - human review strongly recommended'
    );
  }

  return {
    confidence: Math.max(0, Math.min(1, confidence)),
    uncertaintySources,
    reasoningChain,
    humanOverrideRecommended,
  };
}
