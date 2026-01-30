/**
 * @module @bangui/agent/kincho-runtime
 * Kincho (金長) fund manager agent runtime
 * Handles allocation decisions with subagent consensus
 */

import OpenAI from 'openai';
import { kinchoCharacter } from './kincho-character.js';
import { analyzeFinancials } from './subagents/financial-analyzer.js';
import { assessRisk } from './subagents/risk-engine.js';
import { evaluateMetaCognition } from './subagents/meta-cognition.js';
import type {
  KinchoConfig,
  FundState,
  AllocationRequest,
  KinchoAllocationResponse,
  SubagentConsensus,
  AllocationItem,
  AllocationDecision,
  Address,
} from '@bangui/types';

/** Message in agent conversation history */
export interface AgentConversationMessage {
  role: 'vince' | 'kincho';
  content: string;
}

/** Context for generating Kincho response */
export interface KinchoResponseContext {
  /** Allocation request from Vince */
  request: AllocationRequest;
  /** Current fund state */
  fundState: FundState;
  /** Agent conversation history */
  messages: AgentConversationMessage[];
}

/** Kincho runtime configuration */
export interface KinchoRuntimeConfig {
  /** OpenRouter API key */
  apiKey: string;
  /** Model to use */
  model?: string;
  /** Max tokens for response */
  maxTokens?: number;
  /** Vault contract address - ONLY address Kincho can send transactions to */
  vaultAddress: Address;
  /** Kincho agent goals */
  goals?: string[];
  /** Kincho agent constraints */
  constraints?: string[];
}

/**
 * Default Kincho configuration
 */
const DEFAULT_KINCHO_CONFIG: KinchoConfig = {
  goals: [
    'Maximize donor impact while preserving fund health',
    'Honor donor intent in all allocation decisions',
    'Maintain prudent risk levels across the portfolio',
    'Ensure compliance with all regulatory requirements',
    'Provide transparent reasoning for all decisions',
  ],
  constraints: [
    'Never allocate more than 30% of fund to a single cause',
    'Maintain minimum 20% liquidity reserve for new donors',
    'Only approve transactions to the designated vault contract',
    'Require subagent consensus before approving ERC-4626 investments',
    'Recommend human review when confidence < 0.7',
  ],
  vaultAddress: '0x0000000000000000000000000000000000000000' as Address,
  riskParameters: {
    maxConcentration: 0.3,
    minLiquidityReserve: 0.2,
    maxSingleAllocation: 0.25,
  },
};

/**
 * Creates a Kincho runtime instance for allocation decisions
 */
export function createKinchoRuntime(config: KinchoRuntimeConfig) {
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.apiKey,
  });
  const model = config.model ?? 'openrouter/auto';
  const maxTokens = config.maxTokens ?? 2048;

  // CRITICAL: Kincho can ONLY transact with this vault address
  const allowedVaultAddress = config.vaultAddress;

  const kinchoConfig: KinchoConfig = {
    ...DEFAULT_KINCHO_CONFIG,
    vaultAddress: allowedVaultAddress,
    goals: config.goals ?? DEFAULT_KINCHO_CONFIG.goals,
    constraints: config.constraints ?? DEFAULT_KINCHO_CONFIG.constraints,
  };

  /**
   * Builds the Kincho system prompt based on configuration and fund state
   */
  function buildSystemPrompt(fundState: FundState): string {
    return `You are Kincho (金長), a principled and analytical DAF fund manager.

## Your Background
- Training: Investment banking, corporate finance, risk analysis
- Philosophy: Fiduciary responsibility, prudent stewardship
- Approach: Data-driven with ethical considerations

## Your Personality
- Tone: Formal, professional, thorough
- Style: Analytical, conservative, principled
- Communication: Detailed reasoning, transparent decision-making

## Your Goals
${kinchoConfig.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

## Your Constraints
${kinchoConfig.constraints.map((c) => `- ${c}`).join('\n')}

## CRITICAL SECURITY CONSTRAINT
You can ONLY approve transactions to the vault contract at: ${allowedVaultAddress}
ANY transaction to a different address MUST be REJECTED immediately.

## Current Fund State
- Total AUM: $${fundState.totalAum.toLocaleString()}
- Current Allocation: ${JSON.stringify(fundState.currentAllocation)}
- Risk Parameters: Health Factor ${fundState.riskParameters.currentHF}
- Liquidity Available: $${fundState.liquidityAvailable.toLocaleString()}
- Concentration Limits: No single cause > 30% of fund

## Decision Framework
For each allocation request, evaluate:
1. PORTFOLIO FIT: How well does this align with fund strategy?
2. RISK ASSESSMENT: Market, credit, liquidity, operational risks
3. DONOR ALIGNMENT: Does allocation honor donor intent?
4. DIVERSIFICATION: Impact on portfolio concentration
5. COMPLIANCE: Regulatory and policy adherence

## Subagent Consensus Requirement
Before approving ANY ERC-4626 vault investment:
- Financial Analyzer must approve (fitScore >= 0.6)
- Risk Engine must approve (aggregateRisk <= 0.4)
- Meta-Cognition must have confidence >= 0.7 OR recommend human review

## Response Format
You MUST respond with valid JSON in this exact format:
{
  "type": "ALLOCATION_RESPONSE",
  "requestId": "uuid-from-request",
  "decision": "approved" | "modified" | "rejected",
  "allocations": [
    {
      "causeId": "string",
      "causeName": "string",
      "amount": number,
      "allocationType": "grant" | "yield",
      "reasoning": "string"
    }
  ],
  "modifications": {
    "original": { ... },
    "modified": { ... },
    "reason": "string"
  },
  "kinchoAnalysis": {
    "fitScore": 0.0-1.0,
    "riskAssessment": {
      "marketRisk": 0.0-1.0,
      "creditRisk": 0.0-1.0,
      "liquidityRisk": 0.0-1.0,
      "operationalRisk": 0.0-1.0,
      "aggregateRisk": 0.0-1.0,
      "complianceChecks": {
        "concentrationLimit": boolean,
        "sectorLimit": boolean,
        "liquidityRequirement": boolean
      }
    },
    "metaCognition": {
      "confidenceScore": 0.0-1.0,
      "uncertaintySources": ["string"],
      "reasoningChain": [
        { "step": 1, "premise": "string", "conclusion": "string" }
      ],
      "humanOverrideRecommended": boolean
    }
  }
}

## Meta-Cognition Protocol
Before finalizing any decision:
1. Explicitly state your confidence level
2. List sources of uncertainty
3. Consider what you might be missing
4. If confidence < 0.7, recommend human review`;
  }

  /**
   * Validates that a transaction target is the allowed vault
   */
  function validateTransactionTarget(targetAddress: Address): boolean {
    return targetAddress.toLowerCase() === allowedVaultAddress.toLowerCase();
  }

  /**
   * Gathers consensus from all subagents
   */
  async function gatherSubagentConsensus(
    request: AllocationRequest,
    fundState: FundState
  ): Promise<SubagentConsensus> {
    // Run all subagents in parallel
    const [financialResult, riskResult, metaResult] = await Promise.all([
      analyzeFinancials(request, fundState),
      assessRisk(request, fundState),
      evaluateMetaCognition(request, fundState),
    ]);

    // Determine consensus
    const hasConsensus =
      financialResult.approved &&
      riskResult.approved &&
      (metaResult.confidence >= 0.7 || metaResult.humanOverrideRecommended);

    let consensusDecision: AllocationDecision | null = null;
    if (hasConsensus) {
      if (financialResult.fitScore >= 0.8 && riskResult.riskAssessment.aggregateRisk <= 0.2) {
        consensusDecision = 'approved';
      } else if (financialResult.fitScore >= 0.6 && riskResult.riskAssessment.aggregateRisk <= 0.4) {
        consensusDecision = 'modified';
      } else {
        consensusDecision = 'rejected';
      }
    }

    return {
      financialAnalyzer: financialResult,
      riskEngine: riskResult,
      metaCognition: metaResult,
      hasConsensus,
      consensusDecision,
    };
  }

  /**
   * Generates allocation decision based on request and consensus
   */
  async function generateDecision(
    context: KinchoResponseContext
  ): Promise<KinchoAllocationResponse> {
    const { request, fundState, messages } = context;

    // First, gather subagent consensus
    const consensus = await gatherSubagentConsensus(request, fundState);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(fundState);

    // Add consensus information to the request
    const enrichedRequest = {
      ...request,
      subagentConsensus: consensus,
    };

    // Convert messages to OpenAI format
    const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === 'vince' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      })),
      {
        role: 'user',
        content: JSON.stringify(enrichedRequest),
      },
    ];

    const response = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: apiMessages,
      response_format: { type: 'json_object' },
    });

    const responseText = response.choices[0]?.message?.content ?? '{}';

    try {
      const parsed = JSON.parse(responseText) as KinchoAllocationResponse;

      // Validate the response
      if (!parsed.type || parsed.type !== 'ALLOCATION_RESPONSE') {
        throw new Error('Invalid response type');
      }

      // If no consensus from subagents, force human review
      if (!consensus.hasConsensus) {
        return {
          ...parsed,
          decision: 'rejected',
          kinchoAnalysis: {
            ...parsed.kinchoAnalysis,
            metaCognition: {
              ...parsed.kinchoAnalysis.metaCognition,
              humanOverrideRecommended: true,
              uncertaintySources: [
                ...parsed.kinchoAnalysis.metaCognition.uncertaintySources,
                'Subagent consensus not achieved - human review required',
              ],
            },
          },
        };
      }

      return parsed;
    } catch {
      // Return a safe rejection if parsing fails
      return {
        type: 'ALLOCATION_RESPONSE',
        requestId: request.id,
        decision: 'rejected',
        allocations: [],
        kinchoAnalysis: {
          fitScore: 0,
          riskAssessment: {
            marketRisk: 1,
            creditRisk: 1,
            liquidityRisk: 1,
            operationalRisk: 1,
            aggregateRisk: 1,
            complianceChecks: {
              concentrationLimit: false,
              sectorLimit: false,
              liquidityRequirement: false,
            },
          },
          metaCognition: {
            confidenceScore: 0,
            uncertaintySources: ['Failed to parse AI response'],
            reasoningChain: [
              {
                step: 1,
                premise: 'AI response parsing failed',
                conclusion: 'Cannot proceed with allocation',
              },
            ],
            humanOverrideRecommended: true,
          },
        },
      };
    }
  }

  /**
   * Validates an allocation response before execution
   */
  function validateAllocationResponse(
    response: KinchoAllocationResponse,
    fundState: FundState
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check total allocation doesn't exceed available liquidity
    const totalAllocation = response.allocations.reduce(
      (sum, a) => sum + a.amount,
      0
    );
    if (totalAllocation > fundState.liquidityAvailable) {
      errors.push(
        `Total allocation ($${totalAllocation}) exceeds available liquidity ($${fundState.liquidityAvailable})`
      );
    }

    // Check concentration limits
    for (const allocation of response.allocations) {
      const percentage = allocation.amount / fundState.totalAum;
      if (percentage > kinchoConfig.riskParameters.maxConcentration) {
        errors.push(
          `Allocation to ${allocation.causeName} exceeds concentration limit (${(percentage * 100).toFixed(1)}% > ${kinchoConfig.riskParameters.maxConcentration * 100}%)`
        );
      }
    }

    // Check liquidity reserve
    const remainingLiquidity = fundState.liquidityAvailable - totalAllocation;
    const requiredReserve =
      fundState.totalAum * kinchoConfig.riskParameters.minLiquidityReserve;
    if (remainingLiquidity < requiredReserve) {
      errors.push(
        `Allocation would breach minimum liquidity reserve requirement`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  return {
    generateDecision,
    validateAllocationResponse,
    validateTransactionTarget,
    gatherSubagentConsensus,
    buildSystemPrompt,
    config: kinchoConfig,
    character: kinchoCharacter,
  };
}

export type KinchoRuntime = ReturnType<typeof createKinchoRuntime>;
