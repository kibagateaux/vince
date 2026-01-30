/**
 * @module @bangui/agent/subagents/risk-engine
 * Risk assessment subagent for Kincho
 * Evaluates market, credit, liquidity, and operational risks
 */

import type {
  AllocationRequest,
  FundState,
  RiskAssessment,
} from '@bangui/types';

/** Risk assessment result */
export interface RiskAssessmentResult {
  readonly approved: boolean;
  readonly riskAssessment: RiskAssessment;
  readonly reasoning: string;
}

/** Risk thresholds */
const RISK_THRESHOLDS = {
  maxMarketRisk: 0.4,
  maxCreditRisk: 0.3,
  maxLiquidityRisk: 0.35,
  maxOperationalRisk: 0.25,
  maxAggregateRisk: 0.4,
  minHealthFactor: 2,
  maxConcentration: 0.3,
};

/**
 * Assesses market risk based on allocation characteristics
 */
function assessMarketRisk(
  request: AllocationRequest,
  fundState: FundState
): number {
  let marketRisk = 0.1; // Base risk

  const totalAmount = Number(request.amount);
  const aum = fundState.totalAum;

  // Large allocations relative to AUM increase market risk
  const allocationRatio = totalAmount / aum;
  if (allocationRatio > 0.2) {
    marketRisk += 0.2;
  } else if (allocationRatio > 0.1) {
    marketRisk += 0.1;
  }

  // Yield allocations have some market exposure
  const yieldAllocations = request.vinceRecommendation.suggestedAllocations.filter(
    (a) => a.causeId.includes('yield')
  );
  if (yieldAllocations.length > 0) {
    marketRisk += 0.1;
  }

  // DeFi/crypto exposure adds market risk
  const hasDeFiExposure = request.vinceRecommendation.suggestedAllocations.some(
    (a) => a.causeId.includes('defi') || a.causeId.includes('crypto')
  );
  if (hasDeFiExposure) {
    marketRisk += 0.15;
  }

  return Math.min(1, marketRisk);
}

/**
 * Assesses credit risk based on counterparty exposure
 */
function assessCreditRisk(
  request: AllocationRequest,
  fundState: FundState
): number {
  let creditRisk = 0.05; // Base risk

  // Multiple counterparties reduce credit risk
  const uniqueCauses = new Set(
    request.vinceRecommendation.suggestedAllocations.map((a) => a.causeId)
  );
  if (uniqueCauses.size === 1) {
    creditRisk += 0.15; // Single counterparty risk
  } else if (uniqueCauses.size <= 3) {
    creditRisk += 0.05;
  }

  // Large single allocations increase credit risk
  const maxSingleAllocation = Math.max(
    ...request.vinceRecommendation.suggestedAllocations.map((a) => a.amount)
  );
  const totalAmount = Number(request.amount);
  if (maxSingleAllocation / totalAmount > 0.7) {
    creditRisk += 0.1;
  }

  // Check if allocating to established vs new organizations
  // (Simplified: check if cause has "new" or "startup" in name)
  const hasNewOrgs = request.vinceRecommendation.suggestedAllocations.some(
    (a) =>
      a.causeName.toLowerCase().includes('new') ||
      a.causeName.toLowerCase().includes('startup')
  );
  if (hasNewOrgs) {
    creditRisk += 0.1;
  }

  return Math.min(1, creditRisk);
}

/**
 * Assesses liquidity risk based on fund state and allocation
 */
function assessLiquidityRisk(
  request: AllocationRequest,
  fundState: FundState
): number {
  let liquidityRisk = 0.05; // Base risk

  const totalAmount = Number(request.amount);
  const availableLiquidity = fundState.liquidityAvailable;

  // Check if allocation uses too much available liquidity
  const liquidityUsage = totalAmount / availableLiquidity;
  if (liquidityUsage > 0.8) {
    liquidityRisk += 0.3;
  } else if (liquidityUsage > 0.5) {
    liquidityRisk += 0.15;
  } else if (liquidityUsage > 0.3) {
    liquidityRisk += 0.05;
  }

  // Check health factor
  if (fundState.riskParameters.currentHF < RISK_THRESHOLDS.minHealthFactor) {
    liquidityRisk += 0.2;
  }

  // Grant allocations are less liquid than yield
  const grantAllocations = request.vinceRecommendation.suggestedAllocations.filter(
    (a) => !a.causeId.includes('yield')
  );
  const grantPercentage =
    grantAllocations.reduce((sum, a) => sum + a.amount, 0) / totalAmount;
  if (grantPercentage > 0.9) {
    liquidityRisk += 0.1; // All grants, no liquidity buffer
  }

  return Math.min(1, liquidityRisk);
}

/**
 * Assesses operational risk
 */
function assessOperationalRisk(
  request: AllocationRequest,
  fundState: FundState
): number {
  let operationalRisk = 0.05; // Base risk

  // First-time users have higher operational risk
  const userPrefs = request.userPreferences;
  if (!userPrefs.archetypeProfile) {
    operationalRisk += 0.1; // Incomplete user profile
  }

  // Complex allocations increase operational risk
  if (request.vinceRecommendation.suggestedAllocations.length > 5) {
    operationalRisk += 0.1;
  }

  // Large allocations need more operational oversight
  const totalAmount = Number(request.amount);
  if (totalAmount > fundState.totalAum * 0.1) {
    operationalRisk += 0.05;
  }

  return Math.min(1, operationalRisk);
}

/**
 * Checks compliance with fund rules
 */
function checkCompliance(
  request: AllocationRequest,
  fundState: FundState
): RiskAssessment['complianceChecks'] {
  const totalAmount = Number(request.amount);
  const newTotal = fundState.totalAum + totalAmount;

  // Check concentration limit
  let concentrationLimit = true;
  for (const allocation of request.vinceRecommendation.suggestedAllocations) {
    const category = allocation.causeId.split('-')[1] ?? 'other';
    const currentAmount =
      (fundState.currentAllocation[category] ?? 0) * fundState.totalAum;
    const newConcentration = (currentAmount + allocation.amount) / newTotal;
    if (newConcentration > RISK_THRESHOLDS.maxConcentration) {
      concentrationLimit = false;
      break;
    }
  }

  // Check sector limit (similar to concentration but by sector)
  const sectorLimit = true; // Simplified: same as concentration for now

  // Check liquidity requirement (maintain 20% reserve)
  const remainingLiquidity = fundState.liquidityAvailable - totalAmount;
  const requiredReserve = newTotal * 0.2;
  const liquidityRequirement = remainingLiquidity >= requiredReserve;

  return {
    concentrationLimit,
    sectorLimit,
    liquidityRequirement,
  };
}

/**
 * Assesses all risks for an allocation request
 */
export async function assessRisk(
  request: AllocationRequest,
  fundState: FundState
): Promise<RiskAssessmentResult> {
  const marketRisk = assessMarketRisk(request, fundState);
  const creditRisk = assessCreditRisk(request, fundState);
  const liquidityRisk = assessLiquidityRisk(request, fundState);
  const operationalRisk = assessOperationalRisk(request, fundState);

  // Weighted aggregate risk
  const aggregateRisk =
    marketRisk * 0.3 +
    creditRisk * 0.25 +
    liquidityRisk * 0.3 +
    operationalRisk * 0.15;

  const complianceChecks = checkCompliance(request, fundState);

  // Approved if aggregate risk is acceptable and compliance checks pass
  const compliancePassed =
    complianceChecks.concentrationLimit &&
    complianceChecks.sectorLimit &&
    complianceChecks.liquidityRequirement;
  const approved =
    aggregateRisk <= RISK_THRESHOLDS.maxAggregateRisk && compliancePassed;

  // Build reasoning
  const reasoningParts: string[] = [];

  if (aggregateRisk <= 0.2) {
    reasoningParts.push('Low overall risk profile.');
  } else if (aggregateRisk <= 0.4) {
    reasoningParts.push('Moderate risk profile within acceptable limits.');
  } else {
    reasoningParts.push('Elevated risk profile - caution advised.');
  }

  if (marketRisk > RISK_THRESHOLDS.maxMarketRisk) {
    reasoningParts.push(`Market risk (${(marketRisk * 100).toFixed(0)}%) exceeds threshold.`);
  }
  if (creditRisk > RISK_THRESHOLDS.maxCreditRisk) {
    reasoningParts.push(`Credit risk (${(creditRisk * 100).toFixed(0)}%) exceeds threshold.`);
  }
  if (liquidityRisk > RISK_THRESHOLDS.maxLiquidityRisk) {
    reasoningParts.push(`Liquidity risk (${(liquidityRisk * 100).toFixed(0)}%) exceeds threshold.`);
  }

  if (!complianceChecks.concentrationLimit) {
    reasoningParts.push('Allocation would breach concentration limits.');
  }
  if (!complianceChecks.liquidityRequirement) {
    reasoningParts.push('Allocation would breach minimum liquidity reserve requirement.');
  }

  const riskAssessment: RiskAssessment = {
    marketRisk,
    creditRisk,
    liquidityRisk,
    operationalRisk,
    aggregateRisk,
    complianceChecks,
  };

  return {
    approved,
    riskAssessment,
    reasoning: reasoningParts.join(' '),
  };
}
