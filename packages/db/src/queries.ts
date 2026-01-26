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

// Simple DB logging utility
const logDB = {
  debug: (msg: string, data?: unknown) => console.debug(`[DB] ${msg}`, data ?? ''),
  info: (msg: string, data?: unknown) => console.info(`[DB] ${msg}`, data ?? ''),
  error: (msg: string, data?: unknown) => console.error(`[DB] ${msg}`, data ?? ''),
};

// ============================================================================
// User Queries
// ============================================================================

/**
 * Finds a user by their ID
 * @param db - Database instance
 * @param id - User UUID
 * @returns User or null if not found
 */
export const findUserById = async (db: Db, id: UUID) => {
  logDB.debug('findUserById', { id });
  const result = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  logDB.debug('findUserById result', { found: !!result });
  return result;
};

/**
 * Finds a user by wallet address
 * @param db - Database instance
 * @param address - Ethereum wallet address
 * @returns User or null if not found
 */
export const findUserByWalletAddress = async (db: Db, address: Address) => {
  logDB.debug('findUserByWalletAddress', { address: address.substring(0, 10) + '...' });
  const wallet = await db.query.wallets.findFirst({
    where: eq(schema.wallets.address, address.toLowerCase()),
    with: { user: true },
  });
  logDB.debug('findUserByWalletAddress result', { found: !!wallet?.user });
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
export const createUser = async (db: Db, input: CreateUserInput) => {
  logDB.info('createUser', { hasEmail: !!input.email, hasTelegram: !!input.telegramId, hasDiscord: !!input.discordId });
  const user = await db.transaction(async (tx) => {
    const [newUser] = await tx.insert(schema.users).values(input).returning();
    if (!newUser) throw new Error('Failed to create user');
    logDB.debug('User created, creating profile', { userId: newUser.id });
    await tx.insert(schema.userProfiles).values({ userId: newUser.id });
    return newUser;
  });
  logDB.info('createUser complete', { userId: user.id });
  return user;
};

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
  logDB.debug('findOrCreateConversation', { userId, platform });
  const existing = await db.query.conversations.findFirst({
    where: and(
      eq(schema.conversations.userId, userId),
      eq(schema.conversations.platform, platform)
    ),
  });
  if (existing) {
    logDB.debug('Found existing conversation', { conversationId: existing.id, state: existing.state });
    return existing;
  }

  logDB.info('Creating new conversation', { userId, platform });
  const [conversation] = await db
    .insert(schema.conversations)
    .values({ userId, platform })
    .returning();
  logDB.info('Conversation created', { conversationId: conversation!.id });
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
) => {
  logDB.info('updateConversationState', { conversationId: id, newState: state });
  return db
    .update(schema.conversations)
    .set({ state, lastMessageAt: sql`NOW()` })
    .where(eq(schema.conversations.id, id));
};

/**
 * Gets conversation with current state
 * @param db - Database instance
 * @param id - Conversation UUID
 */
export const getConversation = async (db: Db, id: UUID) => {
  logDB.debug('getConversation', { conversationId: id });
  const conversation = await db.query.conversations.findFirst({ where: eq(schema.conversations.id, id) });
  logDB.debug('getConversation result', { found: !!conversation, state: conversation?.state });
  return conversation;
};

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
export const createMessage = async (db: Db, input: CreateMessageInput) => {
  logDB.debug('createMessage', {
    conversationId: input.conversationId,
    sender: input.sender,
    contentLength: input.content.length,
  });
  const message = await db.transaction(async (tx) => {
    const [newMessage] = await tx.insert(schema.messages).values(input).returning();
    await tx
      .update(schema.conversations)
      .set({ lastMessageAt: sql`NOW()` })
      .where(eq(schema.conversations.id, input.conversationId));
    return newMessage!;
  });
  logDB.debug('createMessage complete', { messageId: message.id });
  return message;
};

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
) => {
  logDB.debug('getConversationMessages', { conversationId, limit: pagination?.limit, offset: pagination?.offset });
  const messages = await db.query.messages.findMany({
    where: eq(schema.messages.conversationId, conversationId),
    orderBy: asc(schema.messages.sentAt),
    limit: pagination?.limit,
    offset: pagination?.offset,
  });
  logDB.debug('getConversationMessages result', { count: messages.length });
  return messages;
};

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
  logDB.info('saveQuestionnaireResponse', {
    userId: input.userId,
    questionId: input.questionId,
    responseTimeMs: input.responseTimeMs,
  });
  const [response] = await db
    .insert(schema.questionnaireResponses)
    .values(input)
    .returning();
  logDB.debug('saveQuestionnaireResponse complete', { responseId: response!.id });
  return response!;
};

/**
 * Gets all questionnaire responses for a user
 * @param db - Database instance
 * @param userId - User UUID
 */
export const getQuestionnaireResponses = async (db: Db, userId: UUID) => {
  logDB.debug('getQuestionnaireResponses', { userId });
  const responses = await db.query.questionnaireResponses.findMany({
    where: eq(schema.questionnaireResponses.userId, userId),
    orderBy: asc(schema.questionnaireResponses.answeredAt),
  });
  logDB.debug('getQuestionnaireResponses result', { count: responses.length, questionIds: responses.map(r => r.questionId) });
  return responses;
};

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
) => {
  logDB.debug('getStoriesByCauseCategories', { causeCategories, limit });
  const stories = await db.query.stories.findMany({
    where: and(
      eq(schema.stories.active, true),
      inArray(schema.stories.causeCategory, [...causeCategories])
    ),
    limit,
    orderBy: desc(schema.stories.createdAt),
  });
  logDB.debug('getStoriesByCauseCategories result', { count: stories.length, titles: stories.map(s => s.title) });
  return stories;
};

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
  logDB.info('createDeposit', {
    userId: input.userId,
    walletId: input.walletId,
    amount: input.amount,
    token: input.token,
  });
  const [deposit] = await db
    .insert(schema.deposits)
    .values({ ...input, status: 'pending' })
    .returning();
  logDB.info('createDeposit complete', { depositId: deposit!.id, status: 'pending' });
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
) => {
  logDB.info('updateDepositStatus', {
    depositId: id,
    newStatus: status,
    hasTxHash: !!txHash,
  });
  return db
    .update(schema.deposits)
    .set({
      status,
      txHash: txHash ?? null,
      depositedAt: status === 'confirmed' ? sql`NOW()` : null,
    })
    .where(eq(schema.deposits.id, id));
};

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
