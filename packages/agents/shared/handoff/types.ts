/**
 * @module @bangui/agents/shared/handoff/types
 * Types for bi-directional agent handoffs
 * Vince ↔ Kincho communication invisible to user
 */

import type { AllocationRequest, AllocationDecision, UUID } from '@bangui/types';

/** Agent identifiers for handoffs */
export type HandoffAgent = 'vince' | 'kincho';

/** Types of handoff messages */
export type HandoffType =
  | 'allocation_request'    // Vince → Kincho: Request allocation decision
  | 'clarification_request' // Kincho → Vince: Need more info
  | 'clarification_response'// Vince → Kincho: Answer to clarification
  | 'allocation_response'   // Kincho → Vince: Final decision
  | 'escalation_request'    // Either → Human: Need human review
  | 'context_update';       // Either → Either: Additional context

/** Priority levels for handoffs */
export type HandoffPriority = 'low' | 'normal' | 'high' | 'urgent';

/** Base handoff message structure */
export interface HandoffMessage {
  /** Unique message ID */
  id: string;
  /** Sending agent */
  fromAgent: HandoffAgent;
  /** Receiving agent */
  toAgent: HandoffAgent;
  /** Message type */
  type: HandoffType;
  /** Message payload */
  payload: HandoffPayload;
  /** Priority */
  priority: HandoffPriority;
  /** Related allocation request ID */
  allocationRequestId?: string;
  /** Related conversation ID (for context) */
  conversationId?: string;
  /** User ID (for memory lookup) */
  userId?: string;
  /** Timestamp */
  timestamp: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/** Union of all handoff payloads */
export type HandoffPayload =
  | AllocationRequestPayload
  | ClarificationRequestPayload
  | ClarificationResponsePayload
  | AllocationResponsePayload
  | EscalationRequestPayload
  | ContextUpdatePayload;

/** Vince → Kincho: Allocation request */
export interface AllocationRequestPayload {
  type: 'allocation_request';
  request: AllocationRequest;
  userContext: UserContext;
}

/** User context provided with allocation requests */
export interface UserContext {
  /** User's donor archetype */
  archetype?: string;
  /** User's risk tolerance */
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
  /** Recent conversation summary */
  conversationSummary?: string;
  /** Known user preferences */
  knownPreferences?: string[];
  /** Previous allocation history */
  previousAllocations?: Array<{
    causeCategory: string;
    amount: number;
    date: string;
  }>;
}

/** Kincho → Vince: Need clarification */
export interface ClarificationRequestPayload {
  type: 'clarification_request';
  /** The question needing clarification */
  question: string;
  /** Context for why clarification is needed */
  context: string;
  /** Kincho's best guess answer (Vince can confirm or correct) */
  suggestedAnswer?: string;
  /** Options if this is a multiple choice */
  options?: string[];
  /** Is this required or can Kincho proceed without it? */
  required: boolean;
  /** What aspect of the allocation this affects */
  affectsAspect: 'amount' | 'cause_selection' | 'risk_level' | 'timing' | 'other';
}

/** Vince → Kincho: Clarification answer */
export interface ClarificationResponsePayload {
  type: 'clarification_response';
  /** Reference to the clarification request */
  clarificationRequestId: string;
  /** The answer */
  answer: string;
  /** Confidence in the answer (from user profile/history) */
  confidence: number;
  /** Source of the answer */
  source: 'user_direct' | 'profile_inference' | 'conversation_context' | 'default';
}

/** Kincho → Vince: Allocation decision */
export interface AllocationResponsePayload {
  type: 'allocation_response';
  /** Request ID this responds to */
  requestId: UUID;
  /** The decision */
  decision: AllocationDecision;
  /** Final allocations (if approved/modified) */
  allocations?: Array<{
    causeId: string;
    causeName: string;
    amount: number;
    allocationType: 'grant' | 'yield';
    reasoning: string;
  }>;
  /** Modifications made (if any) */
  modifications?: Array<{
    original: { causeId: string; amount: number };
    modified: { causeId: string; amount: number };
    reason: string;
  }>;
  /** Human-friendly explanation for Vince to relay to user */
  userFriendlyExplanation: string;
  /** Detailed reasoning (for audit/admin) */
  detailedReasoning: string;
  /** Overall confidence */
  confidence: number;
}

/** Either → Human: Escalation request */
export interface EscalationRequestPayload {
  type: 'escalation_request';
  /** Why escalation is needed */
  reason: string;
  /** Severity */
  severity: 'review_recommended' | 'review_required' | 'blocking';
  /** What decision needs human input */
  decisionNeeded: string;
  /** Context for the human reviewer */
  context: string;
  /** Suggested action (if any) */
  suggestedAction?: string;
  /** Deadline for human response (if any) */
  deadline?: number;
}

/** Context update between agents */
export interface ContextUpdatePayload {
  type: 'context_update';
  /** What's being updated */
  updateType: 'user_preference' | 'market_condition' | 'risk_alert' | 'other';
  /** The update content */
  content: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

/** Result of sending a handoff */
export interface HandoffResult {
  /** Whether the handoff was successful */
  success: boolean;
  /** The sent message */
  message: HandoffMessage;
  /** Response (if synchronous) */
  response?: HandoffMessage;
  /** Error (if failed) */
  error?: string;
}

/** Configuration for handoff protocol */
export interface HandoffConfig {
  /** Timeout for waiting for response (ms) */
  responseTimeout: number;
  /** Maximum clarification rounds before escalation */
  maxClarificationRounds: number;
  /** Whether to store all handoffs in memory */
  storeInMemory: boolean;
}

/** Default handoff configuration */
export const DEFAULT_HANDOFF_CONFIG: HandoffConfig = {
  responseTimeout: 30000, // 30 seconds
  maxClarificationRounds: 3,
  storeInMemory: true,
};
