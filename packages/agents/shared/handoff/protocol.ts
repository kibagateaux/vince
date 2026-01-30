/**
 * @module @bangui/agents/shared/handoff/protocol
 * Bi-directional handoff protocol implementation
 * User sees ONLY Vince conversation; Admin sees EVERYTHING
 */

import { v4 as uuidv4 } from 'uuid';
import {
  createAgentMessage,
  getAgentConversationByRequest,
  createAgentConversation,
  storeMemory,
} from '@bangui/db';
import type { Db } from '@bangui/db';
import type {
  HandoffMessage,
  HandoffResult,
  HandoffConfig,
  HandoffPayload,
  HandoffAgent,
  HandoffType,
  HandoffPriority,
  ClarificationRequestPayload,
  ClarificationResponsePayload,
  AllocationResponsePayload,
} from './types.js';
import { DEFAULT_HANDOFF_CONFIG } from './types.js';

export { DEFAULT_HANDOFF_CONFIG } from './types.js';
export * from './types.js';

/**
 * Send a handoff message from one agent to another
 */
export async function sendHandoff(
  db: Db,
  params: {
    fromAgent: HandoffAgent;
    toAgent: HandoffAgent;
    type: HandoffType;
    payload: HandoffPayload;
    priority?: HandoffPriority;
    allocationRequestId?: string;
    conversationId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  },
  config: Partial<HandoffConfig> = {}
): Promise<HandoffResult> {
  const fullConfig = { ...DEFAULT_HANDOFF_CONFIG, ...config };

  const message: HandoffMessage = {
    id: uuidv4(),
    fromAgent: params.fromAgent,
    toAgent: params.toAgent,
    type: params.type,
    payload: params.payload,
    priority: params.priority ?? 'normal',
    allocationRequestId: params.allocationRequestId,
    conversationId: params.conversationId,
    userId: params.userId,
    timestamp: Date.now(),
    metadata: params.metadata,
  };

  try {
    // Store in agent conversation if we have an allocation request
    if (params.allocationRequestId) {
      await storeHandoffInAgentConversation(db, message);
    }

    // Store in memory for learning
    if (fullConfig.storeInMemory && params.userId) {
      await storeHandoffInMemory(message);
    }

    return {
      success: true,
      message,
    };
  } catch (error) {
    return {
      success: false,
      message,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle a clarification request from Kincho
 * Vince tries to answer from user profile/memory before asking user
 */
export async function handleClarificationRequest(
  db: Db,
  request: ClarificationRequestPayload,
  context: {
    userId: string;
    conversationId?: string;
    allocationRequestId?: string;
    userProfile?: {
      riskTolerance?: string;
      archetype?: string;
      knownPreferences?: string[];
    };
  }
): Promise<ClarificationResponsePayload> {
  // Try to answer from user profile first
  const inferredAnswer = tryInferAnswer(request, context.userProfile);

  if (inferredAnswer) {
    return {
      type: 'clarification_response',
      clarificationRequestId: request.question, // Use question as ID since requests don't have ID
      answer: inferredAnswer.answer,
      confidence: inferredAnswer.confidence,
      source: 'profile_inference',
    };
  }

  // If suggested answer exists and question isn't required, use it
  if (request.suggestedAnswer && !request.required) {
    return {
      type: 'clarification_response',
      clarificationRequestId: request.question,
      answer: request.suggestedAnswer,
      confidence: 0.5,
      source: 'default',
    };
  }

  // If required and can't infer, this would need to escalate to user
  // But we want to avoid this - return suggested answer with low confidence
  return {
    type: 'clarification_response',
    clarificationRequestId: request.question,
    answer: request.suggestedAnswer ?? 'Unable to determine - proceeding with default',
    confidence: 0.3,
    source: 'default',
  };
}

/**
 * Try to infer an answer from user profile
 */
function tryInferAnswer(
  request: ClarificationRequestPayload,
  userProfile?: {
    riskTolerance?: string;
    archetype?: string;
    knownPreferences?: string[];
  }
): { answer: string; confidence: number } | null {
  if (!userProfile) return null;

  // Risk-related questions
  if (request.affectsAspect === 'risk_level' && userProfile.riskTolerance) {
    return {
      answer: userProfile.riskTolerance,
      confidence: 0.85,
    };
  }

  // Check if question matches known preferences
  if (userProfile.knownPreferences) {
    const lowerQuestion = request.question.toLowerCase();
    for (const pref of userProfile.knownPreferences) {
      if (lowerQuestion.includes(pref.toLowerCase())) {
        return {
          answer: `User has indicated preference for: ${pref}`,
          confidence: 0.7,
        };
      }
    }
  }

  // Archetype-based inference
  if (userProfile.archetype && request.affectsAspect === 'cause_selection') {
    const archetypeHints: Record<string, string> = {
      impact_maximizer: 'Focus on measurable outcomes',
      community_builder: 'Prioritize local community impact',
      system_changer: 'Support systemic policy change',
      values_expresser: 'Align with personal values',
      legacy_creator: 'Build lasting institutional impact',
      opportunistic_giver: 'Balance across opportunities',
    };

    const hint = archetypeHints[userProfile.archetype];
    if (hint) {
      return {
        answer: hint,
        confidence: 0.65,
      };
    }
  }

  return null;
}

/**
 * Format Kincho's allocation response for user-facing display
 * This is what Vince shows to the user
 */
export function formatResponseForUser(
  response: AllocationResponsePayload
): string {
  return response.userFriendlyExplanation;
}

/**
 * Get full response with all details for admin view
 */
export function getFullResponseForAdmin(
  response: AllocationResponsePayload
): {
  userMessage: string;
  detailedReasoning: string;
  decision: string;
  confidence: number;
  allocations?: AllocationResponsePayload['allocations'];
  modifications?: AllocationResponsePayload['modifications'];
} {
  return {
    userMessage: response.userFriendlyExplanation,
    detailedReasoning: response.detailedReasoning,
    decision: response.decision,
    confidence: response.confidence,
    allocations: response.allocations,
    modifications: response.modifications,
  };
}

/**
 * Store handoff message in agent conversation (for audit trail)
 */
async function storeHandoffInAgentConversation(
  db: Db,
  message: HandoffMessage
): Promise<void> {
  if (!message.allocationRequestId) return;

  // Get or create agent conversation
  // Cast to UUID type as expected by the db functions
  const requestId = message.allocationRequestId as import('@bangui/types').UUID;
  const existingConversation = await getAgentConversationByRequest(db, requestId);

  let conversationId: string;
  if (existingConversation) {
    conversationId = existingConversation.id;
  } else {
    const newConversation = await createAgentConversation(db, requestId);
    conversationId = newConversation.id;
  }

  // Store as agent message
  await createAgentMessage(db, {
    agentConversationId: conversationId as import('@bangui/types').UUID,
    sender: message.fromAgent,
    content: JSON.stringify({
      type: message.type,
      payload: message.payload,
      priority: message.priority,
      timestamp: message.timestamp,
    }),
    metadata: message.metadata,
  });
}

/**
 * Store handoff in memory for learning
 */
async function storeHandoffInMemory(message: HandoffMessage): Promise<void> {
  try {
    const memoryType =
      message.type === 'clarification_request' || message.type === 'clarification_response'
        ? 'clarification'
        : message.type === 'escalation_request'
          ? 'escalation'
          : 'negotiation_history';

    await storeMemory({
      agentId: message.fromAgent,
      userId: message.userId,
      allocationRequestId: message.allocationRequestId,
      content: JSON.stringify({
        type: message.type,
        from: message.fromAgent,
        to: message.toAgent,
        summary: summarizeHandoff(message),
      }),
      memoryType,
      importance: message.priority === 'urgent' ? 0.9 : message.priority === 'high' ? 0.7 : 0.5,
      metadata: {
        handoffType: message.type,
        priority: message.priority,
      },
    });
  } catch {
    // Memory storage failure should not block handoff
    console.warn('Failed to store handoff in memory');
  }
}

/**
 * Summarize a handoff message for memory storage
 */
function summarizeHandoff(message: HandoffMessage): string {
  switch (message.type) {
    case 'allocation_request':
      return `${message.fromAgent} requested allocation decision`;
    case 'clarification_request':
      return `${message.fromAgent} asked for clarification: ${(message.payload as ClarificationRequestPayload).question}`;
    case 'clarification_response':
      return `${message.fromAgent} provided clarification`;
    case 'allocation_response':
      return `${message.fromAgent} decided: ${(message.payload as AllocationResponsePayload).decision}`;
    case 'escalation_request':
      return `${message.fromAgent} escalated for human review`;
    case 'context_update':
      return `${message.fromAgent} updated context`;
    default:
      return `${message.fromAgent} → ${message.toAgent}`;
  }
}

/**
 * Check if user escalation is needed
 * Returns true only if we absolutely cannot proceed without user input
 */
export function needsUserEscalation(
  clarificationRequest: ClarificationRequestPayload,
  attemptedResponses: number
): boolean {
  // Only escalate if:
  // 1. The clarification is required
  // 2. We've already tried responding with defaults
  // 3. We've exceeded max attempts
  return (
    clarificationRequest.required &&
    attemptedResponses >= 2
  );
}
