/**
 * @module @bangui/agent/subagents/financial-analyzer
 * Financial analysis subagent for Kincho
 * Evaluates portfolio fit and expected returns
 */

import type {
  AllocationRequest,
  FundState,
  VinceRecommendation,
} from '@bangui/types';

/** Financial analysis result */
export interface FinancialAnalysisResult {
  readonly approved: boolean;
  readonly fitScore: number;
  readonly reasoning: string;
  readonly portfolioImpact: {
    readonly diversificationEffect: number;
    readonly expectedReturnImpact: number;
    readonly concentrationChange: number;
  };
}

/**
 * Cause category weights for diversification calculation
 * Aligned with cause categories from psycho-analyzer
 */
const CAUSE_CATEGORY_WEIGHTS: Record<string, number> = {
  // High-impact causes (weight >= 0.2 triggers bonus)
  global_health: 0.25,
  health: 0.25, // Alias for global_health
  education: 0.20,
  environment: 0.20,
  climate: 0.20, // Related to environment
  // Medium-impact causes
  poverty_alleviation: 0.15,
  economic_empowerment: 0.15, // From psycho-analyzer
  policy_advocacy: 0.15, // From psycho-analyzer
  // Lower-impact but valid causes
  local_community: 0.12, // From psycho-analyzer
  arts_culture: 0.10, // From psycho-analyzer
  animal_welfare: 0.10,
  general: 0.10, // Default allocation category
  other: 0.10,
  // Yield/reserve is not a "cause" but should be recognized
  yield: 0.05,
};

/**
 * Calculates portfolio fit score based on alignment with fund strategy
 */
function calculateFitScore(
  recommendation: VinceRecommendation,
  fundState: FundState
): number {
  let fitScore = 0.5; // Base score

  // Check diversification alignment
  const suggestedCategories = new Set(
    recommendation.suggestedAllocations.map((a) => a.causeId.split('-')[1] ?? 'other')
  );
  const currentCategories = Object.keys(fundState.currentAllocation);
  const newCategories = [...suggestedCategories].filter(
    (c) => !currentCategories.includes(c)
  );

  // Reward diversification into new categories
  fitScore += newCategories.length * 0.1;

  // Check if allocation aligns with high-impact causes
  const hasHighImpactCause = recommendation.suggestedAllocations.some(
    (a) => {
      const category = a.causeId.split('-')[1] ?? 'other';
      return CAUSE_CATEGORY_WEIGHTS[category] !== undefined &&
             CAUSE_CATEGORY_WEIGHTS[category] >= 0.2;
    }
  );
  if (hasHighImpactCause) {
    fitScore += 0.15;
  }

  // Check reasoning quality
  if (recommendation.reasoning && recommendation.reasoning.length > 50) {
    fitScore += 0.1;
  }

  // Penalize if recommendation suggests allocating to already concentrated areas
  // Exception: yield/reserve allocations are expected to be concentrated (liquidity requirement)
  for (const allocation of recommendation.suggestedAllocations) {
    const category = allocation.causeId.split('-')[1] ?? 'other';
    // Skip penalty for yield/reserve allocations - they're required for liquidity
    if (category === 'yield' || allocation.causeId.includes('yield') || allocation.causeId.includes('reserve')) {
      continue;
    }
    const currentConcentration = fundState.currentAllocation[category] ?? 0;
    if (currentConcentration > 0.25) {
      fitScore -= 0.1;
    }
  }

  // Cap at 0-1 range
  return Math.max(0, Math.min(1, fitScore));
}

/**
 * Calculates diversification effect of proposed allocation
 */
function calculateDiversificationEffect(
  recommendation: VinceRecommendation,
  fundState: FundState
): number {
  const currentCategories = Object.keys(fundState.currentAllocation).length;
  const suggestedCategories = new Set(
    recommendation.suggestedAllocations.map((a) => a.causeId.split('-')[1] ?? 'other')
  );
  const newCategories = [...suggestedCategories].filter(
    (c) => !(c in fundState.currentAllocation)
  );

  // More new categories = better diversification
  if (currentCategories === 0) {
    return suggestedCategories.size >= 2 ? 0.9 : 0.7;
  }

  return Math.min(1, 0.5 + newCategories.length * 0.2);
}

/**
 * Estimates expected return impact
 */
function calculateExpectedReturnImpact(
  recommendation: VinceRecommendation
): number {
  // Yield allocations have positive return impact
  const yieldAllocations = recommendation.suggestedAllocations.filter(
    (a) => a.causeId.includes('yield')
  );
  const yieldPercentage =
    yieldAllocations.reduce((sum, a) => sum + a.percentage, 0) / 100;

  // Grant allocations have social return but no financial return
  const grantPercentage = 1 - yieldPercentage;

  // Balance between yield (financial return) and grants (social return)
  // Optimal is around 20-30% yield for liquidity
  if (yieldPercentage >= 0.15 && yieldPercentage <= 0.35) {
    return 0.8;
  } else if (yieldPercentage > 0.35) {
    return 0.6; // Too conservative, missing social impact
  } else {
    return 0.5 + yieldPercentage; // Could use more liquidity reserve
  }
}

/**
 * Calculates concentration change
 */
function calculateConcentrationChange(
  recommendation: VinceRecommendation,
  fundState: FundState
): number {
  // Calculate HHI (Herfindahl-Hirschman Index) before and after
  const currentConcentrations = Object.values(fundState.currentAllocation);
  const currentHHI = currentConcentrations.reduce(
    (sum, c) => sum + c * c,
    0
  );

  // Simulate after allocation
  const newAllocations = { ...fundState.currentAllocation };
  const totalAllocation = recommendation.suggestedAllocations.reduce(
    (sum, a) => sum + a.amount,
    0
  );
  const newTotal = fundState.totalAum + totalAllocation;

  for (const allocation of recommendation.suggestedAllocations) {
    const category = allocation.causeId.split('-')[1] ?? 'other';
    const currentAmount =
      (newAllocations[category] ?? 0) * fundState.totalAum;
    newAllocations[category] = (currentAmount + allocation.amount) / newTotal;
  }

  const newHHI = Object.values(newAllocations).reduce(
    (sum, c) => sum + c * c,
    0
  );

  // Return change (negative means more diversified, which is good)
  return newHHI - currentHHI;
}

/**
 * Analyzes financial aspects of an allocation request
 */
export async function analyzeFinancials(
  request: AllocationRequest,
  fundState: FundState
): Promise<FinancialAnalysisResult> {
  const recommendation = request.vinceRecommendation;

  const fitScore = calculateFitScore(recommendation, fundState);
  const diversificationEffect = calculateDiversificationEffect(
    recommendation,
    fundState
  );
  const expectedReturnImpact = calculateExpectedReturnImpact(recommendation);
  const concentrationChange = calculateConcentrationChange(
    recommendation,
    fundState
  );

  // Approved if fit score is at least 0.6
  const approved = fitScore >= 0.6;

  // Build reasoning
  const reasoningParts: string[] = [];

  if (fitScore >= 0.8) {
    reasoningParts.push('Strong portfolio fit with fund strategy.');
  } else if (fitScore >= 0.6) {
    reasoningParts.push('Acceptable portfolio fit with minor concerns.');
  } else {
    reasoningParts.push('Poor portfolio fit - allocation may not align with fund strategy.');
  }

  if (diversificationEffect > 0.7) {
    reasoningParts.push('Allocation improves diversification.');
  } else if (concentrationChange > 0.05) {
    reasoningParts.push('Warning: Allocation increases portfolio concentration.');
  }

  if (expectedReturnImpact >= 0.7) {
    reasoningParts.push('Expected return impact is positive with adequate liquidity reserve.');
  }

  return {
    approved,
    fitScore,
    reasoning: reasoningParts.join(' '),
    portfolioImpact: {
      diversificationEffect,
      expectedReturnImpact,
      concentrationChange,
    },
  };
}
