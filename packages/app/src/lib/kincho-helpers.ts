/**
 * Kincho agent helpers for allocation processing
 * Kincho communicates ONLY with Vince through agent conversations
 * Kincho has NO access to user messages
 */

import type { Db } from './db';
import {
  createAllocationRequest,
  getAllocationRequest,
  updateAllocationRequestStatus,
  createAllocationDecision,
  createAgentConversation,
  createAgentMessage,
  getAgentConversationByRequest,
  getAgentMessages,
} from './db';
import {
  createKinchoRuntime,
  runConsensusProcess,
  type KinchoRuntime,
  type AgentConversationMessage,
  type ConsensusResult,
  type ConsensusConfig,
} from '@bangui/agents';
import type {
  UUID,
  AllocationRequest,
  KinchoAllocationResponse,
  FundState,
  UserPreferences,
  VinceRecommendation,
  Address,
} from '@bangui/types';

/** Lazily initialized Kincho runtime */
let kinchoRuntime: KinchoRuntime | null = null;

/**
 * Gets or creates the Kincho runtime
 * CRITICAL: Kincho can ONLY transact with the vault address in env
 * Prefers Anthropic over OpenRouter if API key is available
 */
export const getKinchoRuntime = (): KinchoRuntime | null => {
  if (!kinchoRuntime && process.env.DAF_CONTRACT_ADDRESS) {
    // Prefer Anthropic if available, fall back to OpenRouter
    if (process.env.ANTHROPIC_API_KEY) {
      console.log('[Kincho] Using Anthropic provider');
      kinchoRuntime = createKinchoRuntime({
        apiKey: process.env.ANTHROPIC_API_KEY,
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        vaultAddress: process.env.DAF_CONTRACT_ADDRESS as Address,
      });
    } else if (process.env.OPENROUTER_API_KEY) {
      console.log('[Kincho] Using OpenRouter provider');
      kinchoRuntime = createKinchoRuntime({
        apiKey: process.env.OPENROUTER_API_KEY,
        provider: 'openrouter',
        model: process.env.OPENROUTER_MODEL,
        vaultAddress: process.env.DAF_CONTRACT_ADDRESS as Address,
      });
    }
  }
  return kinchoRuntime;
};

/**
 * Gets current fund state from protocol
 * In production, this would query the blockchain
 */
export const getFundState = async (): Promise<FundState> => {
  // TODO: Query actual fund state from protocol library
  // For now, return mock data
  return {
    totalAum: 1000000, // $1M AUM
    currentAllocation: {
      global_health: 0.25,
      education: 0.2,
      environment: 0.15,
      poverty_alleviation: 0.1,
      yield: 0.3, // Liquidity reserve
    },
    riskParameters: {
      currentHF: 8,
      minRedeemHF: 2,
      minReserveHF: 8,
    },
    liquidityAvailable: 300000, // $300K available
  };
};

/**
 * Creates an allocation request from Vince to Kincho
 */
export const submitAllocationRequest = async (
  db: Db,
  params: {
    depositId?: UUID;
    userId: UUID;
    conversationId?: UUID;
    amount: string;
    userPreferences: UserPreferences;
    vinceRecommendation: VinceRecommendation;
    /** ERC4626 vault address for Kincho to use in allocate() function */
    vaultAddress?: Address;
  }
): Promise<AllocationRequest> => {
  // Create the allocation request
  const request = await createAllocationRequest(db, {
    depositId: params.depositId,
    userId: params.userId,
    conversationId: params.conversationId,
    amount: params.amount,
    userPreferences: params.userPreferences as unknown as Record<string, unknown>,
    vinceRecommendation: params.vinceRecommendation as unknown as Record<string, unknown>,
    vaultAddress: params.vaultAddress,
  });

  // Create agent conversation for Kincho-Vince communication
  await createAgentConversation(db, request.id as UUID);

  return {
    id: request.id as UUID,
    depositId: request.deposit_id as UUID | null,
    userId: request.user_id as UUID,
    conversationId: request.conversation_id as UUID | null,
    amount: request.amount as string & { readonly __brand: 'BigIntString' },
    userPreferences: params.userPreferences,
    vinceRecommendation: params.vinceRecommendation,
    vaultAddress: (request.vault_address as Address) ?? null,
    status: 'pending',
    createdAt: new Date(request.created_at).getTime() as number & { readonly __brand: 'Timestamp' },
  };
};

/**
 * Process an allocation request with Kincho
 * This is where Kincho analyzes and decides on the allocation
 */
export const processAllocationRequest = async (
  db: Db,
  requestId: UUID
): Promise<KinchoAllocationResponse | null> => {
  const runtime = getKinchoRuntime();
  if (!runtime) {
    console.error('[Kincho] Runtime not available - check OPENROUTER_API_KEY and DAF_CONTRACT_ADDRESS');
    return null;
  }

  // Get the allocation request
  const requestRecord = await getAllocationRequest(db, requestId);
  if (!requestRecord) {
    console.error('[Kincho] Allocation request not found:', requestId);
    return null;
  }

  // Update status to processing
  await updateAllocationRequestStatus(db, requestId, 'processing');

  // Get agent conversation
  const agentConversation = await getAgentConversationByRequest(db, requestId);
  if (!agentConversation) {
    console.error('[Kincho] Agent conversation not found for request:', requestId);
    return null;
  }

  // Build allocation request object
  // Use vault address from request, falling back to env var for backwards compatibility
  const vaultAddress = (requestRecord.vault_address as Address) ?? (process.env.DAF_CONTRACT_ADDRESS as Address) ?? null;
  const request: AllocationRequest = {
    id: requestRecord.id as UUID,
    depositId: requestRecord.deposit_id as UUID | null,
    userId: requestRecord.user_id as UUID,
    conversationId: requestRecord.conversation_id as UUID | null,
    amount: requestRecord.amount as string & { readonly __brand: 'BigIntString' },
    userPreferences: requestRecord.user_preferences as unknown as UserPreferences,
    vinceRecommendation: requestRecord.vince_recommendation as unknown as VinceRecommendation,
    vaultAddress,
    status: 'processing',
    createdAt: new Date(requestRecord.created_at).getTime() as number & { readonly __brand: 'Timestamp' },
  };

  // Get fund state
  const fundState = await getFundState();

  // Get existing agent messages (Kincho only sees agent messages, NOT user messages)
  const existingMessages = await getAgentMessages(db, agentConversation.id as UUID);
  const agentHistory: AgentConversationMessage[] = existingMessages.map((m) => ({
    role: m.sender as 'vince' | 'kincho',
    content: m.content,
  }));

  // Send Vince's request as an agent message
  await createAgentMessage(db, {
    agentConversationId: agentConversation.id as UUID,
    sender: 'vince',
    content: JSON.stringify({
      type: 'ALLOCATION_REQUEST',
      requestId: request.id,
      depositId: request.depositId,
      userId: request.userId,
      amount: request.amount,
      userPreferences: request.userPreferences,
      vinceRecommendation: request.vinceRecommendation,
      vaultAddress: request.vaultAddress,
    }),
    metadata: { type: 'allocation_request' },
  });

  // Generate Kincho's decision
  let decision = await runtime.generateDecision({
    request,
    fundState,
    messages: agentHistory,
  });

  // Validate the decision
  const validation = runtime.validateAllocationResponse(decision, fundState);
  if (!validation.valid) {
    console.warn('[Kincho] Decision validation failed:', validation.errors);
    // Create a new decision object with validation errors
    decision = {
      ...decision,
      decision: 'rejected',
      kinchoAnalysis: {
        ...decision.kinchoAnalysis,
        metaCognition: {
          ...decision.kinchoAnalysis.metaCognition,
          uncertaintySources: [
            ...decision.kinchoAnalysis.metaCognition.uncertaintySources,
            ...validation.errors.map((e) => `Validation error: ${e}`),
          ],
        },
      },
    };
  }

  // Save Kincho's response as an agent message
  await createAgentMessage(db, {
    agentConversationId: agentConversation.id as UUID,
    sender: 'kincho',
    content: JSON.stringify(decision),
    metadata: { type: 'allocation_response', decision: decision.decision },
  });

  // Save allocation decision to database
  await createAllocationDecision(db, {
    requestId,
    decision: decision.decision,
    allocations: decision.allocations as unknown as Record<string, unknown>[],
    kinchoAnalysis: decision.kinchoAnalysis as unknown as Record<string, unknown>,
    confidence: String(decision.kinchoAnalysis.metaCognition.confidenceScore),
    reasoning: decision.kinchoAnalysis.metaCognition.reasoningChain
      .map((s) => `${s.step}. ${s.premise} → ${s.conclusion}`)
      .join('\n'),
    humanOverrideRequired: decision.kinchoAnalysis.metaCognition.humanOverrideRecommended,
  });

  // Update request status based on decision
  await updateAllocationRequestStatus(db, requestId, decision.decision);

  return decision;
};

/**
 * Process an allocation request using the new multi-round consensus system
 * This provides sophisticated negotiation between subagents
 */
export const processAllocationRequestWithConsensus = async (
  db: Db,
  requestId: UUID,
  consensusConfig?: Partial<ConsensusConfig>
): Promise<{ decision: KinchoAllocationResponse | null; consensus: ConsensusResult | null }> => {
  const runtime = getKinchoRuntime();
  if (!runtime) {
    console.error('[Kincho] Runtime not available - check OPENROUTER_API_KEY and DAF_CONTRACT_ADDRESS');
    return { decision: null, consensus: null };
  }

  // Get the allocation request
  const requestRecord = await getAllocationRequest(db, requestId);
  if (!requestRecord) {
    console.error('[Kincho] Allocation request not found:', requestId);
    return { decision: null, consensus: null };
  }

  // Update status to processing
  await updateAllocationRequestStatus(db, requestId, 'processing');

  // Get agent conversation
  const agentConversation = await getAgentConversationByRequest(db, requestId);
  if (!agentConversation) {
    console.error('[Kincho] Agent conversation not found for request:', requestId);
    return { decision: null, consensus: null };
  }

  // Build allocation request object
  // Use vault address from request, falling back to env var for backwards compatibility
  const vaultAddressFromRequest = (requestRecord.vault_address as Address) ?? (process.env.DAF_CONTRACT_ADDRESS as Address) ?? null;
  const request: AllocationRequest = {
    id: requestRecord.id as UUID,
    depositId: requestRecord.deposit_id as UUID | null,
    userId: requestRecord.user_id as UUID,
    conversationId: requestRecord.conversation_id as UUID | null,
    amount: requestRecord.amount as string & { readonly __brand: 'BigIntString' },
    userPreferences: requestRecord.user_preferences as unknown as UserPreferences,
    vinceRecommendation: requestRecord.vince_recommendation as unknown as VinceRecommendation,
    vaultAddress: vaultAddressFromRequest,
    status: 'processing',
    createdAt: new Date(requestRecord.created_at).getTime() as number & { readonly __brand: 'Timestamp' },
  };

  // Get fund state
  const fundState = await getFundState();

  // Send Vince's request as an agent message
  await createAgentMessage(db, {
    agentConversationId: agentConversation.id as UUID,
    sender: 'vince',
    content: JSON.stringify({
      type: 'ALLOCATION_REQUEST',
      requestId: request.id,
      depositId: request.depositId,
      userId: request.userId,
      amount: request.amount,
      userPreferences: request.userPreferences,
      vinceRecommendation: request.vinceRecommendation,
      vaultAddress: request.vaultAddress,
    }),
    metadata: { type: 'allocation_request' },
  });

  // Run the multi-round consensus process using vault address from request
  const consensusResult = await runConsensusProcess(request, fundState, {
    ...consensusConfig,
    vaultAddress: vaultAddressFromRequest,
  });

  // Record consensus deliberation as agent message
  await createAgentMessage(db, {
    agentConversationId: agentConversation.id as UUID,
    sender: 'kincho',
    content: JSON.stringify({
      type: 'CONSENSUS_DELIBERATION',
      rounds: consensusResult.rounds.length,
      decision: consensusResult.decision,
      achieved: consensusResult.achieved,
      confidence: consensusResult.confidence,
      auditTrail: consensusResult.auditTrail,
    }),
    metadata: {
      type: 'consensus_deliberation',
      decision: consensusResult.decision,
      roundCount: consensusResult.rounds.length,
    },
  });

  // Convert consensus result to KinchoAllocationResponse format
  const finalDecision = consensusResultToResponse(request, consensusResult, fundState);

  // Save allocation decision to database
  await createAllocationDecision(db, {
    requestId,
    decision: finalDecision.decision,
    allocations: finalDecision.allocations as unknown as Record<string, unknown>[],
    kinchoAnalysis: finalDecision.kinchoAnalysis as unknown as Record<string, unknown>,
    confidence: String(finalDecision.kinchoAnalysis.metaCognition.confidenceScore),
    reasoning: consensusResult.summary,
    humanOverrideRequired: consensusResult.humanReviewRecommended,
  });

  // Update request status based on decision
  const statusMap: Record<string, 'approved' | 'modified' | 'rejected'> = {
    approved: 'approved',
    modified: 'modified',
    rejected: 'rejected',
    escalated: 'rejected', // Treat escalated as rejected until human reviews
  };
  await updateAllocationRequestStatus(db, requestId, statusMap[consensusResult.decision] ?? 'rejected');

  return { decision: finalDecision, consensus: consensusResult };
};

/**
 * Convert ConsensusResult to KinchoAllocationResponse format for backwards compatibility
 */
function consensusResultToResponse(
  request: AllocationRequest,
  consensus: ConsensusResult,
  fundState: FundState
): KinchoAllocationResponse {
  const lastRound = consensus.rounds[consensus.rounds.length - 1];
  const allocations = request.vinceRecommendation.suggestedAllocations.map((a) => {
    // Apply any modifications from consensus
    const modification = consensus.finalModifications?.find((m) => m.causeId === a.causeId);
    return {
      causeId: a.causeId,
      causeName: a.causeName,
      amount: modification?.proposedAmount ?? a.amount,
      allocationType: 'grant' as const,
      reasoning: modification?.reasoning ?? a.reasoning,
    };
  }).filter((a) => {
    // Remove rejected causes
    const rejected = consensus.finalModifications?.find(
      (m) => m.causeId === a.causeId && m.modificationType === 'reject_cause'
    );
    return !rejected;
  });

  // Collect concerns from all subagents
  const allConcerns = lastRound?.proposals.flatMap((p) => p.concerns) ?? [];

  return {
    type: 'ALLOCATION_RESPONSE',
    requestId: request.id,
    decision: consensus.decision === 'approved' ? 'approved' :
              consensus.decision === 'modified' ? 'modified' : 'rejected',
    allocations,
    modifications: consensus.finalModifications && consensus.finalModifications.length > 0
      ? {
          original: { allocations: request.vinceRecommendation.suggestedAllocations },
          modified: { allocations },
          reason: consensus.summary,
        }
      : undefined,
    kinchoAnalysis: {
      fitScore: lastRound?.proposals.find((p) => p.subagentId === 'financial_analyzer')?.confidence ?? 0.5,
      riskAssessment: {
        marketRisk: lastRound?.proposals.find((p) => p.subagentId === 'risk_engine')?.metrics?.['marketRisk'] as number ?? 0.3,
        creditRisk: 0.2,
        liquidityRisk: lastRound?.proposals.find((p) => p.subagentId === 'risk_engine')?.metrics?.['liquidityRisk'] as number ?? 0.2,
        operationalRisk: lastRound?.proposals.find((p) => p.subagentId === 'risk_engine')?.metrics?.['operationalRisk'] as number ?? 0.1,
        aggregateRisk: lastRound?.proposals.find((p) => p.subagentId === 'risk_engine')?.metrics?.['aggregateRisk'] as number ?? 0.3,
        complianceChecks: {
          concentrationLimit: true,
          sectorLimit: true,
          liquidityRequirement: true,
        },
      },
      metaCognition: {
        confidenceScore: consensus.confidence,
        uncertaintySources: allConcerns,
        reasoningChain: consensus.rounds.map((r, i) => ({
          step: i + 1,
          premise: `Round ${r.roundNumber}: ${r.proposals.map((p) => `${p.subagentId}=${p.vote}`).join(', ')}`,
          conclusion: r.summary ?? r.status,
        })),
        humanOverrideRecommended: consensus.humanReviewRecommended,
      },
    },
  };
}

/**
 * Formats Kincho's decision for Vince to relay to the user
 */
export const formatDecisionForUser = (
  decision: KinchoAllocationResponse
): string => {
  if (decision.decision === 'rejected') {
    return `I've reviewed your allocation request with our fund manager, Kincho. Unfortunately, the allocation couldn't be approved at this time.

Reason: ${decision.kinchoAnalysis.metaCognition.reasoningChain.slice(-1)[0]?.conclusion ?? 'Unable to process allocation'}

Would you like to discuss alternative options?`;
  }

  const totalAmount = decision.allocations.reduce((sum, a) => sum + a.amount, 0);
  const allocList = decision.allocations
    .map((a) => `- $${a.amount.toLocaleString()} to ${a.causeName} (${a.allocationType})`)
    .join('\n');

  const isModified = decision.decision === 'modified';
  const modificationNote = isModified && decision.modifications
    ? `\n\nNote: The allocation was adjusted from your original request. ${decision.modifications.reason}`
    : '';

  return `Great news! Your $${totalAmount.toLocaleString()} contribution has been allocated:

${allocList}${modificationNote}

Kincho, our fund manager, determined this allocation ${
    isModified ? 'best balances' : 'maximizes'
  } your impact while maintaining the diversification you prefer.

Confidence score: ${(decision.kinchoAnalysis.metaCognition.confidenceScore * 100).toFixed(0)}%`;
};

/**
 * Validates that a transaction target is allowed (vault only)
 */
export const validateTransactionTarget = (targetAddress: Address): boolean => {
  const runtime = getKinchoRuntime();
  if (!runtime) return false;
  return runtime.validateTransactionTarget(targetAddress);
};
