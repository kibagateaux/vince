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
  type AllocationStatus,
} from './db';
import {
  createKinchoRuntime,
  type KinchoRuntime,
  type AgentConversationMessage,
} from '@bangui/agent';
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
 */
export const getKinchoRuntime = (): KinchoRuntime | null => {
  if (!kinchoRuntime && process.env.OPENROUTER_API_KEY && process.env.DAF_CONTRACT_ADDRESS) {
    kinchoRuntime = createKinchoRuntime({
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL,
      vaultAddress: process.env.DAF_CONTRACT_ADDRESS as Address,
    });
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
    depositId?: string;
    userId: string;
    conversationId?: string;
    amount: string;
    userPreferences: UserPreferences;
    vinceRecommendation: VinceRecommendation;
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
  });

  // Create agent conversation for Kincho-Vince communication
  await createAgentConversation(db, request.id);

  return {
    id: request.id as UUID,
    depositId: request.deposit_id as UUID | null,
    userId: request.user_id as UUID,
    conversationId: request.conversation_id as UUID | null,
    amount: request.amount as string & { readonly __brand: 'BigIntString' },
    userPreferences: params.userPreferences,
    vinceRecommendation: params.vinceRecommendation,
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
  requestId: string
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
  await updateAllocationRequestStatus(db, requestId, 'processing' as AllocationStatus);

  // Get agent conversation
  const agentConversation = await getAgentConversationByRequest(db, requestId);
  if (!agentConversation) {
    console.error('[Kincho] Agent conversation not found for request:', requestId);
    return null;
  }

  // Build allocation request object
  const request: AllocationRequest = {
    id: requestRecord.id as UUID,
    depositId: requestRecord.deposit_id as UUID | null,
    userId: requestRecord.user_id as UUID,
    conversationId: requestRecord.conversation_id as UUID | null,
    amount: requestRecord.amount as string & { readonly __brand: 'BigIntString' },
    userPreferences: requestRecord.user_preferences as unknown as UserPreferences,
    vinceRecommendation: requestRecord.vince_recommendation as unknown as VinceRecommendation,
    status: 'processing',
    createdAt: new Date(requestRecord.created_at).getTime() as number & { readonly __brand: 'Timestamp' },
  };

  // Get fund state
  const fundState = await getFundState();

  // Get existing agent messages (Kincho only sees agent messages, NOT user messages)
  const existingMessages = await getAgentMessages(db, agentConversation.id);
  const agentHistory: AgentConversationMessage[] = existingMessages.map((m) => ({
    role: m.sender as 'vince' | 'kincho',
    content: m.content,
  }));

  // Send Vince's request as an agent message
  await createAgentMessage(db, {
    agentConversationId: agentConversation.id,
    sender: 'vince',
    content: JSON.stringify({
      type: 'ALLOCATION_REQUEST',
      requestId: request.id,
      depositId: request.depositId,
      userId: request.userId,
      amount: request.amount,
      userPreferences: request.userPreferences,
      vinceRecommendation: request.vinceRecommendation,
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
    agentConversationId: agentConversation.id,
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
  await updateAllocationRequestStatus(db, requestId, decision.decision as AllocationStatus);

  return decision;
};

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
