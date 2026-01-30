/**
 * @module @bangui/db/queries
 * Pure database query functions for all entities
 * @see {@link @bangui/types} for type definitions
 */

import { eq, and, desc, asc, inArray, sql } from 'drizzle-orm';
import type { Db } from './client.js';
import * as schema from './schema.js';
import type {
  UUID,
  Address,
  Platform,
  Sender,
  ConversationState,
  DepositStatus,
  Chain,
  Archetype,
  PaginationParams,
} from '@bangui/types';

// ============================================================================
// User Queries
// ============================================================================

/**
 * Finds a user by their ID
 * @param db - Database instance
 * @param id - User UUID
 * @returns User or null if not found
 */
export const findUserById = async (db: Db, id: UUID) =>
  db.query.users.findFirst({ where: eq(schema.users.id, id) });

/**
 * Finds a user by wallet address
 * @param db - Database instance
 * @param address - Ethereum wallet address
 * @returns User or null if not found
 */
export const findUserByWalletAddress = async (db: Db, address: Address) => {
  const wallet = await db.query.wallets.findFirst({
    where: eq(schema.wallets.address, address.toLowerCase()),
    with: { user: true },
  });
  return wallet?.user ?? null;
};

/**
 * Input for creating a new user
 */
export interface CreateUserInput {
  readonly email?: string;
  readonly telegramId?: string;
  readonly discordId?: string;
}

/**
 * Creates a new user with associated profile
 * @param db - Database instance
 * @param input - User creation input
 * @returns Created user with profile
 */
export const createUser = async (db: Db, input: CreateUserInput) =>
  db.transaction(async (tx) => {
    const [user] = await tx.insert(schema.users).values(input).returning();
    if (!user) throw new Error('Failed to create user');
    await tx.insert(schema.userProfiles).values({ userId: user.id });
    return user;
  });

/**
 * Updates user's last active timestamp
 * @param db - Database instance
 * @param id - User UUID
 */
export const touchUserActivity = async (db: Db, id: UUID) =>
  db
    .update(schema.users)
    .set({ lastActive: sql`NOW()` })
    .where(eq(schema.users.id, id));

// ============================================================================
// Conversation Queries
// ============================================================================

/**
 * Finds or creates a conversation for a user on a platform
 * @param db - Database instance
 * @param userId - User UUID
 * @param platform - Communication platform
 * @returns Existing or newly created conversation
 */
export const findOrCreateConversation = async (
  db: Db,
  userId: UUID,
  platform: Platform
) => {
  const existing = await db.query.conversations.findFirst({
    where: and(
      eq(schema.conversations.userId, userId),
      eq(schema.conversations.platform, platform)
    ),
  });
  if (existing) return existing;

  const [conversation] = await db
    .insert(schema.conversations)
    .values({ userId, platform })
    .returning();
  return conversation!;
};

/**
 * Updates conversation state
 * @param db - Database instance
 * @param id - Conversation UUID
 * @param state - New conversation state
 */
export const updateConversationState = async (
  db: Db,
  id: UUID,
  state: ConversationState
) =>
  db
    .update(schema.conversations)
    .set({ state, lastMessageAt: sql`NOW()` })
    .where(eq(schema.conversations.id, id));

/**
 * Gets conversation with current state
 * @param db - Database instance
 * @param id - Conversation UUID
 */
export const getConversation = async (db: Db, id: UUID) =>
  db.query.conversations.findFirst({ where: eq(schema.conversations.id, id) });

// ============================================================================
// Message Queries
// ============================================================================

/**
 * Input for creating a message
 */
export interface CreateMessageInput {
  readonly conversationId: UUID;
  readonly sender: Sender;
  readonly content: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Creates a message and updates conversation timestamp
 * @param db - Database instance
 * @param input - Message creation input
 * @returns Created message
 */
export const createMessage = async (db: Db, input: CreateMessageInput) =>
  db.transaction(async (tx) => {
    const [message] = await tx.insert(schema.messages).values(input).returning();
    await tx
      .update(schema.conversations)
      .set({ lastMessageAt: sql`NOW()` })
      .where(eq(schema.conversations.id, input.conversationId));
    return message!;
  });

/**
 * Gets messages for a conversation with pagination
 * @param db - Database instance
 * @param conversationId - Conversation UUID
 * @param pagination - Pagination params
 * @returns Messages in chronological order
 */
export const getConversationMessages = async (
  db: Db,
  conversationId: UUID,
  pagination?: PaginationParams
) =>
  db.query.messages.findMany({
    where: eq(schema.messages.conversationId, conversationId),
    orderBy: asc(schema.messages.sentAt),
    limit: pagination?.limit,
    offset: pagination?.offset,
  });

// ============================================================================
// Questionnaire Queries
// ============================================================================

/**
 * Input for saving a questionnaire response
 */
export interface SaveResponseInput {
  readonly userId: UUID;
  readonly questionId: string;
  readonly response: unknown;
  readonly responseTimeMs?: number;
}

/**
 * Saves a questionnaire response
 * @param db - Database instance
 * @param input - Response input
 * @returns Created response
 */
export const saveQuestionnaireResponse = async (
  db: Db,
  input: SaveResponseInput
) => {
  const [response] = await db
    .insert(schema.questionnaireResponses)
    .values(input)
    .returning();
  return response!;
};

/**
 * Gets all questionnaire responses for a user
 * @param db - Database instance
 * @param userId - User UUID
 */
export const getQuestionnaireResponses = async (db: Db, userId: UUID) =>
  db.query.questionnaireResponses.findMany({
    where: eq(schema.questionnaireResponses.userId, userId),
    orderBy: asc(schema.questionnaireResponses.answeredAt),
  });

/**
 * Gets set of answered question IDs for a user
 * @param db - Database instance
 * @param userId - User UUID
 * @returns Set of question IDs that have been answered
 */
export const getQuestionnaireProgress = async (
  db: Db,
  userId: UUID
): Promise<Set<string>> => {
  const responses = await db.query.questionnaireResponses.findMany({
    where: eq(schema.questionnaireResponses.userId, userId),
    columns: { questionId: true },
  });
  return new Set(responses.map((r) => r.questionId));
};

// ============================================================================
// Profile Queries
// ============================================================================

/**
 * Gets user profile by user ID
 * @param db - Database instance
 * @param userId - User UUID
 */
export const getUserProfile = async (db: Db, userId: UUID) =>
  db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
    with: {
      archetypeScores: true,
      causeAffinities: true,
    },
  });

/**
 * Input for saving archetype scores
 */
export interface SaveArchetypeScoresInput {
  readonly profileId: UUID;
  readonly scores: ReadonlyArray<{
    readonly archetype: Archetype;
    readonly score: number;
    readonly confidence?: number;
  }>;
}

/**
 * Saves multiple archetype scores for a profile
 * @param db - Database instance
 * @param input - Archetype scores input
 */
export const saveArchetypeScores = async (
  db: Db,
  input: SaveArchetypeScoresInput
) =>
  db.insert(schema.archetypeScores).values(
    input.scores.map((s) => ({
      profileId: input.profileId,
      archetype: s.archetype,
      score: String(s.score),
      confidence: s.confidence ? String(s.confidence) : null,
    }))
  );

/**
 * Input for saving cause affinities
 */
export interface SaveCauseAffinitiesInput {
  readonly profileId: UUID;
  readonly affinities: ReadonlyArray<{
    readonly causeCategory: string;
    readonly affinityScore: number;
    readonly reasoning?: Record<string, unknown>;
  }>;
}

/**
 * Saves cause affinities for a profile
 * @param db - Database instance
 * @param input - Cause affinities input
 */
export const saveCauseAffinities = async (
  db: Db,
  input: SaveCauseAffinitiesInput
) =>
  db.insert(schema.causeAffinities).values(
    input.affinities.map((a) => ({
      profileId: input.profileId,
      causeCategory: a.causeCategory,
      affinityScore: String(a.affinityScore),
      reasoning: a.reasoning ?? null,
    }))
  );

// ============================================================================
// Story Queries
// ============================================================================

/**
 * Gets stories matching user's cause affinities
 * @param db - Database instance
 * @param causeCategories - Categories to match
 * @param limit - Max stories to return
 * @returns Stories sorted by relevance
 */
export const getStoriesByCauseCategories = async (
  db: Db,
  causeCategories: readonly string[],
  limit = 10
) =>
  db.query.stories.findMany({
    where: and(
      eq(schema.stories.active, true),
      inArray(schema.stories.causeCategory, [...causeCategories])
    ),
    limit,
    orderBy: desc(schema.stories.createdAt),
  });

/**
 * Gets all active stories
 * @param db - Database instance
 * @param limit - Max stories to return
 */
export const getActiveStories = async (db: Db, limit = 20) =>
  db.query.stories.findMany({
    where: eq(schema.stories.active, true),
    limit,
    orderBy: desc(schema.stories.createdAt),
  });

// ============================================================================
// Wallet Queries
// ============================================================================

/**
 * Finds or creates a wallet for a user
 * @param db - Database instance
 * @param userId - User UUID
 * @param address - Wallet address
 * @param chain - Blockchain network
 */
export const findOrCreateWallet = async (
  db: Db,
  userId: UUID,
  address: Address,
  chain: Chain
) => {
  const normalizedAddress = address.toLowerCase();
  const existing = await db.query.wallets.findFirst({
    where: and(
      eq(schema.wallets.userId, userId),
      eq(schema.wallets.address, normalizedAddress)
    ),
  });
  if (existing) return existing;

  const [wallet] = await db
    .insert(schema.wallets)
    .values({ userId, address: normalizedAddress, chain, isPrimary: true })
    .returning();
  return wallet!;
};

// ============================================================================
// Deposit Queries
// ============================================================================

/**
 * Input for creating a deposit
 */
export interface CreateDepositInput {
  readonly userId: UUID;
  readonly walletId: UUID;
  readonly amount: string;
  readonly token: string;
}

/**
 * Creates a pending deposit record
 * @param db - Database instance
 * @param input - Deposit creation input
 * @returns Created deposit
 */
export const createDeposit = async (db: Db, input: CreateDepositInput) => {
  const [deposit] = await db
    .insert(schema.deposits)
    .values({ ...input, status: 'pending' })
    .returning();
  return deposit!;
};

/**
 * Updates deposit status and sets txHash/timestamp
 * @param db - Database instance
 * @param id - Deposit UUID
 * @param status - New status
 * @param txHash - Transaction hash (on confirm)
 */
export const updateDepositStatus = async (
  db: Db,
  id: UUID,
  status: DepositStatus,
  txHash?: string
) =>
  db
    .update(schema.deposits)
    .set({
      status,
      txHash: txHash ?? null,
      depositedAt: status === 'confirmed' ? sql`NOW()` : null,
    })
    .where(eq(schema.deposits.id, id));

/**
 * Gets deposit by ID
 * @param db - Database instance
 * @param id - Deposit UUID
 */
export const getDeposit = async (db: Db, id: UUID) =>
  db.query.deposits.findFirst({ where: eq(schema.deposits.id, id) });

// ============================================================================
// Admin Dashboard Queries
// ============================================================================

/**
 * Gets all conversations with their message count and latest message
 * @param db - Database instance
 * @param pagination - Pagination params
 * @returns Conversations ordered by lastMessageAt descending
 */
export const getAllConversations = async (
  db: Db,
  pagination?: PaginationParams
) =>
  db.query.conversations.findMany({
    orderBy: desc(schema.conversations.lastMessageAt),
    limit: pagination?.limit,
    offset: pagination?.offset,
    with: {
      user: true,
      messages: {
        orderBy: asc(schema.messages.sentAt),
      },
    },
  });

/**
 * Gets a single conversation with all messages for detailed view
 * @param db - Database instance
 * @param conversationId - Conversation UUID
 * @returns Conversation with user and all messages
 */
export const getConversationWithMessages = async (
  db: Db,
  conversationId: UUID
) =>
  db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
    with: {
      user: {
        with: {
          profile: true,
          deposits: true,
        },
      },
      messages: {
        orderBy: asc(schema.messages.sentAt),
      },
    },
  });

/**
 * Gets total count of conversations
 * @param db - Database instance
 * @returns Total conversation count
 */
export const getConversationsCount = async (db: Db) => {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.conversations);
  return result[0]?.count ?? 0;
};

// ============================================================================
// Allocation Queries (Kincho)
// ============================================================================

/**
 * Input for creating an allocation request
 */
export interface CreateAllocationRequestInput {
  readonly depositId?: UUID;
  readonly userId: UUID;
  readonly conversationId?: UUID;
  readonly amount: string;
  readonly userPreferences: Record<string, unknown>;
  readonly vinceRecommendation: Record<string, unknown>;
}

/**
 * Creates an allocation request from Vince to Kincho
 * @param db - Database instance
 * @param input - Allocation request input
 * @returns Created allocation request
 */
export const createAllocationRequest = async (
  db: Db,
  input: CreateAllocationRequestInput
) => {
  const [request] = await db
    .insert(schema.allocationRequests)
    .values({
      depositId: input.depositId ?? null,
      userId: input.userId,
      conversationId: input.conversationId ?? null,
      amount: input.amount,
      userPreferences: input.userPreferences,
      vinceRecommendation: input.vinceRecommendation,
      status: 'pending',
    })
    .returning();
  return request!;
};

/**
 * Gets allocation request by ID
 * @param db - Database instance
 * @param id - Request UUID
 */
export const getAllocationRequest = async (db: Db, id: UUID) =>
  db.query.allocationRequests.findFirst({
    where: eq(schema.allocationRequests.id, id),
    with: {
      user: true,
      deposit: true,
      decision: true,
    },
  });

/**
 * Gets pending allocation requests for Kincho to process
 * @param db - Database instance
 * @param limit - Max requests to return
 */
export const getPendingAllocationRequests = async (db: Db, limit = 10) =>
  db.query.allocationRequests.findMany({
    where: eq(schema.allocationRequests.status, 'pending'),
    orderBy: asc(schema.allocationRequests.createdAt),
    limit,
    with: {
      user: true,
      deposit: true,
    },
  });

/**
 * Updates allocation request status
 * @param db - Database instance
 * @param id - Request UUID
 * @param status - New status
 */
export const updateAllocationRequestStatus = async (
  db: Db,
  id: UUID,
  status: 'pending' | 'processing' | 'approved' | 'modified' | 'rejected'
) =>
  db
    .update(schema.allocationRequests)
    .set({ status })
    .where(eq(schema.allocationRequests.id, id));

/**
 * Input for creating an allocation decision
 */
export interface CreateAllocationDecisionInput {
  readonly requestId: UUID;
  readonly decision: 'approved' | 'modified' | 'rejected';
  readonly allocations?: Record<string, unknown>[];
  readonly kinchoAnalysis: Record<string, unknown>;
  readonly confidence: string;
  readonly reasoning: string;
  readonly humanOverrideRequired?: boolean;
}

/**
 * Creates an allocation decision from Kincho
 * @param db - Database instance
 * @param input - Decision input
 * @returns Created decision
 */
export const createAllocationDecision = async (
  db: Db,
  input: CreateAllocationDecisionInput
) =>
  db.transaction(async (tx) => {
    const [decision] = await tx
      .insert(schema.allocationDecisions)
      .values({
        requestId: input.requestId,
        decision: input.decision,
        allocations: input.allocations ?? null,
        kinchoAnalysis: input.kinchoAnalysis,
        confidence: input.confidence,
        reasoning: input.reasoning,
        humanOverrideRequired: input.humanOverrideRequired ?? false,
      })
      .returning();

    // Update request status to match decision
    await tx
      .update(schema.allocationRequests)
      .set({ status: input.decision })
      .where(eq(schema.allocationRequests.id, input.requestId));

    return decision!;
  });

/**
 * Gets allocation decision by request ID
 * @param db - Database instance
 * @param requestId - Request UUID
 */
export const getAllocationDecision = async (db: Db, requestId: UUID) =>
  db.query.allocationDecisions.findFirst({
    where: eq(schema.allocationDecisions.requestId, requestId),
  });

// ============================================================================
// Agent Conversation Queries (Kincho-Vince Communication)
// ============================================================================

/**
 * Creates an agent conversation for Kincho-Vince communication
 * @param db - Database instance
 * @param allocationRequestId - Associated allocation request
 */
export const createAgentConversation = async (
  db: Db,
  allocationRequestId: UUID
) => {
  const [conversation] = await db
    .insert(schema.agentConversations)
    .values({ allocationRequestId })
    .returning();
  return conversation!;
};

/**
 * Gets agent conversation by allocation request ID
 * @param db - Database instance
 * @param allocationRequestId - Allocation request UUID
 */
export const getAgentConversationByRequest = async (
  db: Db,
  allocationRequestId: UUID
) =>
  db.query.agentConversations.findFirst({
    where: eq(schema.agentConversations.allocationRequestId, allocationRequestId),
    with: {
      messages: {
        orderBy: asc(schema.agentMessages.sentAt),
      },
    },
  });

/**
 * Input for creating an agent message
 */
export interface CreateAgentMessageInput {
  readonly agentConversationId: UUID;
  readonly sender: 'vince' | 'kincho';
  readonly content: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Creates a message in an agent conversation
 * @param db - Database instance
 * @param input - Message input
 */
export const createAgentMessage = async (
  db: Db,
  input: CreateAgentMessageInput
) =>
  db.transaction(async (tx) => {
    const [message] = await tx
      .insert(schema.agentMessages)
      .values(input)
      .returning();

    await tx
      .update(schema.agentConversations)
      .set({ lastMessageAt: sql`NOW()` })
      .where(eq(schema.agentConversations.id, input.agentConversationId));

    return message!;
  });

/**
 * Gets all messages in an agent conversation
 * @param db - Database instance
 * @param agentConversationId - Agent conversation UUID
 */
export const getAgentMessages = async (db: Db, agentConversationId: UUID) =>
  db.query.agentMessages.findMany({
    where: eq(schema.agentMessages.agentConversationId, agentConversationId),
    orderBy: asc(schema.agentMessages.sentAt),
  });
