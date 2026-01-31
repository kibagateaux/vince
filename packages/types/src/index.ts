/**
 * @module @bangui/types
 * Shared type definitions for Bangui DAF platform
 */

// ============================================================================
// Primitives & Branded Types
// ============================================================================

/** UUID branded type for type-safe ID handling */
export type UUID = string & { readonly __brand: 'UUID' };

/** Ethereum address branded type */
export type Address = `0x${string}`;

/** Transaction hash branded type */
export type TxHash = `0x${string}`;

/** BigInt string representation for serialization */
export type BigIntString = string & { readonly __brand: 'BigIntString' };

/** Unix timestamp in milliseconds */
export type Timestamp = number & { readonly __brand: 'Timestamp' };

// ============================================================================
// Enums
// ============================================================================

/** Supported blockchain networks */
export const Chain = {
  ETHEREUM: 'ethereum',
  POLYGON: 'polygon',
  ARBITRUM: 'arbitrum',
  BASE: 'base',
} as const;
export type Chain = (typeof Chain)[keyof typeof Chain];

/** User status in the system */
export const UserStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

/** Communication platforms */
export const Platform = {
  WEB: 'web',
  TELEGRAM: 'telegram',
  DISCORD: 'discord',
} as const;
export type Platform = (typeof Platform)[keyof typeof Platform];

/** Message sender types */
export const Sender = {
  USER: 'user',
  VINCE: 'vince',
  KINCHO: 'kincho',
  SYSTEM: 'system',
} as const;
export type Sender = (typeof Sender)[keyof typeof Sender];

/** Risk tolerance levels */
export const RiskTolerance = {
  CONSERVATIVE: 'conservative',
  MODERATE: 'moderate',
  AGGRESSIVE: 'aggressive',
} as const;
export type RiskTolerance = (typeof RiskTolerance)[keyof typeof RiskTolerance];

/** Deposit transaction status */
export const DepositStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
} as const;
export type DepositStatus = (typeof DepositStatus)[keyof typeof DepositStatus];

/** Questionnaire question types */
export const QuestionType = {
  OPEN_ENDED: 'open_ended',
  MULTIPLE_CHOICE: 'multiple_choice',
  SCALE: 'scale',
  SCALE_MATRIX: 'scale_matrix',
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

/** User archetypes from psychopolitical analysis */
export const Archetype = {
  IMPACT_MAXIMIZER: 'impact_maximizer',
  COMMUNITY_BUILDER: 'community_builder',
  SYSTEM_CHANGER: 'system_changer',
  VALUES_EXPRESSER: 'values_expresser',
  LEGACY_CREATOR: 'legacy_creator',
  OPPORTUNISTIC_GIVER: 'opportunistic_giver',
} as const;
export type Archetype = (typeof Archetype)[keyof typeof Archetype];

/** Conversation state machine states */
export const ConversationState = {
  IDLE: 'idle',
  QUESTIONNAIRE_IN_PROGRESS: 'questionnaire_in_progress',
  QUESTIONNAIRE_COMPLETE: 'questionnaire_complete',
  INVESTMENT_SUGGESTIONS: 'investment_suggestions',
  DEPOSIT_INTENT: 'deposit_intent',
  DEPOSIT_PENDING: 'deposit_pending',
  DEPOSIT_CONFIRMED: 'deposit_confirmed',
} as const;
export type ConversationState =
  (typeof ConversationState)[keyof typeof ConversationState];

// ============================================================================
// Database Entity Types
// ============================================================================

/** User entity */
export interface User {
  readonly id: UUID;
  readonly email: string | null;
  readonly telegramId: string | null;
  readonly discordId: string | null;
  readonly createdAt: Timestamp;
  readonly lastActive: Timestamp;
  readonly status: UserStatus;
}

/** Demographics data structure */
export interface Demographics {
  readonly ageRange?: string;
  readonly incomeBracket?: string;
  readonly occupation?: string;
}

/** User profile entity */
export interface UserProfile {
  readonly id: UUID;
  readonly userId: UUID;
  readonly demographics: Demographics | null;
  readonly locationData: Record<string, unknown> | null;
  readonly socialProfiles: Record<string, string> | null;
  readonly riskTolerance: RiskTolerance | null;
  readonly estimatedNetWorth: number | null;
  readonly updatedAt: Timestamp;
}

/** Questionnaire response entity */
export interface QuestionnaireResponse {
  readonly id: UUID;
  readonly userId: UUID;
  readonly questionId: string;
  readonly response: unknown;
  readonly answeredAt: Timestamp;
  readonly responseTimeMs: number | null;
}

/** Archetype score entity */
export interface ArchetypeScore {
  readonly id: UUID;
  readonly profileId: UUID;
  readonly archetype: Archetype;
  readonly score: number;
  readonly confidence: number | null;
  readonly calculatedAt: Timestamp;
}

/** Cause affinity entity */
export interface CauseAffinity {
  readonly id: UUID;
  readonly profileId: UUID;
  readonly causeCategory: string;
  readonly affinityScore: number;
  readonly reasoning: Record<string, unknown> | null;
}

/** Wallet entity */
export interface Wallet {
  readonly id: UUID;
  readonly userId: UUID;
  readonly address: Address;
  readonly chain: Chain;
  readonly isPrimary: boolean;
  readonly onchainAnalysis: Record<string, unknown> | null;
}

/** Deposit entity */
export interface Deposit {
  readonly id: UUID;
  readonly userId: UUID;
  readonly walletId: UUID;
  readonly txHash: TxHash | null;
  readonly amount: BigIntString;
  readonly token: string;
  readonly depositedAt: Timestamp | null;
  readonly status: DepositStatus;
}

/** Conversation entity */
export interface Conversation {
  readonly id: UUID;
  readonly userId: UUID;
  readonly platform: Platform;
  readonly platformThreadId: string | null;
  readonly state: ConversationState;
  readonly startedAt: Timestamp;
  readonly lastMessageAt: Timestamp;
}

/** Message entity */
export interface Message {
  readonly id: UUID;
  readonly conversationId: UUID;
  readonly sender: Sender;
  readonly content: string;
  readonly metadata: MessageMetadata | null;
  readonly sentAt: Timestamp;
}

/** Message metadata */
export interface MessageMetadata {
  readonly replyTo?: UUID;
  readonly questionId?: string;
  readonly actionType?: ActionType;
}

/** Story/investment opportunity entity */
export interface Story {
  readonly id: UUID;
  readonly title: string;
  readonly description: string | null;
  readonly causeCategory: string;
  readonly impactMetrics: ImpactMetrics | null;
  readonly minInvestment: BigIntString | null;
  readonly riskLevel: RiskTolerance | null;
  readonly createdAt: Timestamp;
  readonly active: boolean;
}

/** Impact metrics for stories */
export interface ImpactMetrics {
  readonly beneficiaries?: number;
  readonly roi?: number;
  readonly carbonOffset?: number;
  readonly [key: string]: unknown;
}

// ============================================================================
// API Types
// ============================================================================

/** Action types for agent responses */
export const ActionType = {
  QUESTIONNAIRE: 'questionnaire',
  DEPOSIT: 'deposit',
  CONFIRMATION: 'confirmation',
  SUGGESTION: 'suggestion',
} as const;
export type ActionType = (typeof ActionType)[keyof typeof ActionType];

/** WebSocket chat message from client */
export interface ChatMessage {
  readonly type: 'message';
  readonly conversationId: UUID;
  readonly content: string;
  readonly metadata?: {
    readonly platform: Platform;
    readonly replyTo?: UUID;
    readonly questionId?: string;
  };
}

/** Action prompt in agent response */
export interface ActionPrompt {
  readonly type: ActionType;
  readonly data: Record<string, unknown>;
}

/** WebSocket agent response to client */
export interface AgentResponse {
  readonly type: 'response';
  readonly conversationId: UUID;
  readonly agent: 'vince';
  readonly content: string;
  readonly actions?: readonly ActionPrompt[];
  readonly metadata?: {
    readonly confidence?: number;
    readonly reasoning?: string;
  };
}

/** Auth connect request */
export interface AuthConnectRequest {
  readonly platform: Platform;
  readonly walletAddress?: Address;
}

/** Auth connect response */
export interface AuthConnectResponse {
  readonly sessionId: string;
  readonly userId: UUID;
  readonly conversationId: UUID;
}

/** Questionnaire submit request */
export interface QuestionnaireSubmitRequest {
  readonly userId: UUID;
  readonly responses: readonly QuestionnaireResponseInput[];
}

/** Questionnaire response input */
export interface QuestionnaireResponseInput {
  readonly questionId: string;
  readonly response: unknown;
  readonly responseTimeMs?: number;
}

/** Deposit prepare request */
export interface DepositPrepareRequest {
  readonly userId: UUID;
  readonly amount: BigIntString;
  readonly token: string;
  readonly chain: Chain;
}

/** Unsigned transaction */
export interface UnsignedTransaction {
  readonly to: Address;
  readonly data: `0x${string}`;
  readonly value: BigIntString;
  readonly gasEstimate: BigIntString;
  readonly chainId: number;
}

/** Deposit prepare response */
export interface DepositPrepareResponse {
  readonly depositId: UUID;
  readonly transaction: UnsignedTransaction;
  readonly simulation: TransactionSimulation;
}

/** Transaction simulation result */
export interface TransactionSimulation {
  readonly success: boolean;
  readonly gasUsed: BigIntString;
  readonly warnings: readonly string[];
}

// ============================================================================
// Psychopolitical Analysis Types
// ============================================================================

/** Moral foundations vector (0-1 for each) */
export interface MoralVector {
  readonly care: number;
  readonly fairness: number;
  readonly loyalty: number;
  readonly authority: number;
  readonly sanctity: number;
  readonly liberty: number;
}

/** Archetype profile result */
export interface ArchetypeProfile {
  readonly primaryArchetype: Archetype;
  readonly secondaryTraits: readonly Archetype[];
  readonly confidence: number;
  readonly causeAlignment: Readonly<Record<string, number>>;
}

/** Cause affinity result */
export interface CauseAffinityResult {
  readonly causeId: string;
  readonly affinityScore: number;
  readonly reasoning: string;
}

/** Full psychopolitical analysis result */
export interface PsychopoliticalAnalysis {
  readonly userId: UUID;
  readonly archetypeProfile: ArchetypeProfile;
  readonly moralVector: MoralVector;
  readonly causeAffinities: readonly CauseAffinityResult[];
  readonly analyzedAt: Timestamp;
}

// ============================================================================
// Questionnaire Types
// ============================================================================

/** Questionnaire question definition */
export interface Question {
  readonly id: string;
  readonly sectionId: string;
  readonly text: string;
  readonly type: QuestionType;
  readonly options?: readonly string[];
  readonly range?: readonly [number, number];
  readonly anchors?: readonly [string, string];
  readonly analysisTags: readonly string[];
}

/** Questionnaire section definition */
export interface QuestionnaireSection {
  readonly id: string;
  readonly title: string;
  readonly questions: readonly Question[];
}

/** Full questionnaire definition */
export interface Questionnaire {
  readonly id: string;
  readonly version: string;
  readonly sections: readonly QuestionnaireSection[];
}

// ============================================================================
// Utility Types
// ============================================================================

/** Create input type (omit auto-generated fields) */
export type CreateInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

/** Update input type (partial, omit immutable fields) */
export type UpdateInput<T> = Partial<Omit<T, 'id' | 'createdAt'>>;

/** Pagination params */
export interface PaginationParams {
  readonly limit: number;
  readonly offset: number;
}

/** Paginated result */
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/** Result type for operations that can fail */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Async result type */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// ============================================================================
// Admin Dashboard Types
// ============================================================================

/** Conversation health status for dashboard */
export const ConversationHealth = {
  SUCCESS: 'success',
  FRUSTRATED: 'frustrated',
  STALLED: 'stalled',
  ACTIVE: 'active',
  ABANDONED: 'abandoned',
} as const;
export type ConversationHealth =
  (typeof ConversationHealth)[keyof typeof ConversationHealth];

/** Conversation summary for dashboard list */
export interface ConversationSummary {
  readonly id: UUID;
  readonly userId: UUID;
  readonly platform: Platform;
  readonly state: ConversationState;
  readonly health: ConversationHealth;
  readonly messageCount: number;
  readonly userMessageCount: number;
  readonly vinceMessageCount: number;
  readonly startedAt: Timestamp;
  readonly lastMessageAt: Timestamp;
  readonly durationMinutes: number;
  readonly hasDeposit: boolean;
  readonly latestMessage: string | null;
  readonly userWallet: Address | null;
}

/** Timeline message blob for visualization */
export interface TimelineBlob {
  readonly id: UUID;
  readonly sender: Sender;
  readonly sentAt: Timestamp;
  readonly contentPreview: string;
  readonly health: ConversationHealth;
}

/** Detailed conversation for admin view */
export interface ConversationDetail {
  readonly id: UUID;
  readonly userId: UUID;
  readonly userWallet: Address | null;
  readonly platform: Platform;
  readonly state: ConversationState;
  readonly health: ConversationHealth;
  readonly startedAt: Timestamp;
  readonly lastMessageAt: Timestamp;
  readonly messages: readonly Message[];
  readonly timeline: readonly TimelineBlob[];
  readonly hasDeposit: boolean;
  readonly depositAmount: BigIntString | null;
}

/** Admin message injection request */
export interface AdminMessageRequest {
  readonly conversationId: UUID;
  readonly content: string;
  readonly sender: 'vince' | 'system';
}

/** Dashboard statistics */
export interface DashboardStats {
  readonly totalConversations: number;
  readonly activeConversations: number;
  readonly successfulDeposits: number;
  readonly frustratedConversations: number;
  readonly stalledConversations: number;
  readonly averageDurationMinutes: number;
}

// ============================================================================
// Kincho Agent Types
// ============================================================================

/** Allocation request status */
export const AllocationStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  APPROVED: 'approved',
  MODIFIED: 'modified',
  REJECTED: 'rejected',
} as const;
export type AllocationStatus =
  (typeof AllocationStatus)[keyof typeof AllocationStatus];

/** Allocation decision type */
export const AllocationDecision = {
  APPROVED: 'approved',
  MODIFIED: 'modified',
  REJECTED: 'rejected',
} as const;
export type AllocationDecision =
  (typeof AllocationDecision)[keyof typeof AllocationDecision];

/** User preferences for allocation */
export interface UserPreferences {
  readonly causes: readonly string[];
  readonly riskTolerance: RiskTolerance;
  readonly archetypeProfile?: ArchetypeProfile;
  readonly moralVector?: MoralVector;
}

/** Vince's recommendation to Kincho */
export interface VinceRecommendation {
  readonly suggestedAllocations: readonly SuggestedAllocation[];
  readonly psychProfile: PsychopoliticalAnalysis | null;
  readonly walletAnalysis?: Record<string, unknown>;
  readonly reasoning: string;
}

/** Suggested allocation from Vince */
export interface SuggestedAllocation {
  readonly causeId: string;
  readonly causeName: string;
  readonly amount: number;
  readonly percentage: number;
  readonly reasoning: string;
}

/** Allocation request from Vince to Kincho */
export interface AllocationRequest {
  readonly id: UUID;
  readonly depositId: UUID | null;
  readonly userId: UUID;
  readonly conversationId: UUID | null;
  readonly amount: BigIntString;
  readonly userPreferences: UserPreferences;
  readonly vinceRecommendation: VinceRecommendation;
  readonly status: AllocationStatus;
  readonly createdAt: Timestamp;
}

/** Individual allocation in Kincho's decision */
export interface AllocationItem {
  readonly causeId: string;
  readonly causeName: string;
  readonly amount: number;
  readonly allocationType: 'grant' | 'yield';
  readonly reasoning: string;
}

/** Risk assessment by Kincho */
export interface RiskAssessment {
  readonly marketRisk: number;
  readonly creditRisk: number;
  readonly liquidityRisk: number;
  readonly operationalRisk: number;
  readonly aggregateRisk: number;
  readonly complianceChecks: {
    readonly concentrationLimit: boolean;
    readonly sectorLimit: boolean;
    readonly liquidityRequirement: boolean;
  };
}

/** Meta-cognition analysis */
export interface MetaCognition {
  readonly confidenceScore: number;
  readonly uncertaintySources: readonly string[];
  readonly reasoningChain: readonly ReasoningStep[];
  readonly humanOverrideRecommended: boolean;
}

/** Reasoning step in meta-cognition */
export interface ReasoningStep {
  readonly step: number;
  readonly premise: string;
  readonly conclusion: string;
}

/** Full Kincho analysis */
export interface KinchoAnalysis {
  readonly fitScore: number;
  readonly riskAssessment: RiskAssessment;
  readonly metaCognition: MetaCognition;
}

/** Allocation decision from Kincho */
export interface AllocationDecisionRecord {
  readonly id: UUID;
  readonly requestId: UUID;
  readonly decision: AllocationDecision;
  readonly allocations: readonly AllocationItem[] | null;
  readonly kinchoAnalysis: KinchoAnalysis;
  readonly confidence: number;
  readonly reasoning: string;
  readonly humanOverrideRequired: boolean;
  readonly decidedAt: Timestamp;
}

/** Kincho allocation response (sent to Vince) */
export interface KinchoAllocationResponse {
  readonly type: 'ALLOCATION_RESPONSE';
  readonly requestId: UUID;
  readonly decision: AllocationDecision;
  readonly allocations: readonly AllocationItem[];
  readonly modifications?: {
    readonly original: Record<string, unknown>;
    readonly modified: Record<string, unknown>;
    readonly reason: string;
  };
  readonly kinchoAnalysis: KinchoAnalysis;
}

/** Agent conversation for Kincho-Vince communication */
export interface AgentConversation {
  readonly id: UUID;
  readonly allocationRequestId: UUID;
  readonly startedAt: Timestamp;
  readonly lastMessageAt: Timestamp;
}

/** Agent message between Vince and Kincho */
export interface AgentMessage {
  readonly id: UUID;
  readonly agentConversationId: UUID;
  readonly sender: 'vince' | 'kincho';
  readonly content: string;
  readonly metadata?: Record<string, unknown>;
  readonly sentAt: Timestamp;
}

/** Kincho configuration */
export interface KinchoConfig {
  readonly goals: readonly string[];
  readonly constraints: readonly string[];
  readonly vaultAddress: Address;
  readonly riskParameters: {
    readonly maxConcentration: number;
    readonly minLiquidityReserve: number;
    readonly maxSingleAllocation: number;
  };
}

/** Fund state for Kincho decisions */
export interface FundState {
  readonly totalAum: number;
  readonly currentAllocation: Record<string, number>;
  readonly riskParameters: {
    readonly currentHF: number;
    readonly minRedeemHF: number;
    readonly minReserveHF: number;
  };
  readonly liquidityAvailable: number;
}

/** Subagent consensus result */
export interface SubagentConsensus {
  readonly financialAnalyzer: {
    readonly approved: boolean;
    readonly fitScore: number;
    readonly reasoning: string;
  };
  readonly riskEngine: {
    readonly approved: boolean;
    readonly riskAssessment: RiskAssessment;
    readonly reasoning: string;
  };
  readonly metaCognition: {
    readonly confidence: number;
    readonly uncertaintySources: readonly string[];
    readonly humanOverrideRecommended: boolean;
  };
  readonly hasConsensus: boolean;
  readonly consensusDecision: AllocationDecision | null;
}
