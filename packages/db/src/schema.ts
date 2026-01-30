/**
 * @module @bangui/db/schema
 * Drizzle ORM schema definitions for PostgreSQL
 * @see {@link @bangui/types} for corresponding TypeScript types
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// Enums
// ============================================================================

/** @see {@link @bangui/types#UserStatus} */
export const userStatusEnum = pgEnum('user_status', [
  'active',
  'inactive',
  'suspended',
]);

/** @see {@link @bangui/types#Platform} */
export const platformEnum = pgEnum('platform', ['web', 'telegram', 'discord']);

/** @see {@link @bangui/types#Sender} */
export const senderEnum = pgEnum('sender', ['user', 'vince', 'kincho', 'system']);

/** Allocation request status */
export const allocationStatusEnum = pgEnum('allocation_status', [
  'pending',
  'processing',
  'approved',
  'modified',
  'rejected',
]);

/** Allocation decision type */
export const allocationDecisionEnum = pgEnum('allocation_decision', [
  'approved',
  'modified',
  'rejected',
]);

/** @see {@link @bangui/types#RiskTolerance} */
export const riskToleranceEnum = pgEnum('risk_tolerance', [
  'conservative',
  'moderate',
  'aggressive',
]);

/** @see {@link @bangui/types#DepositStatus} */
export const depositStatusEnum = pgEnum('deposit_status', [
  'pending',
  'confirmed',
  'failed',
]);

/** @see {@link @bangui/types#Chain} */
export const chainEnum = pgEnum('chain', ['ethereum', 'polygon', 'arbitrum', 'base']);

/** @see {@link @bangui/types#Archetype} */
export const archetypeEnum = pgEnum('archetype', [
  'impact_maximizer',
  'community_builder',
  'system_changer',
  'values_expresser',
  'legacy_creator',
  'opportunistic_giver',
]);

/** @see {@link @bangui/types#ConversationState} */
export const conversationStateEnum = pgEnum('conversation_state', [
  'idle',
  'questionnaire_in_progress',
  'questionnaire_complete',
  'investment_suggestions',
  'deposit_intent',
  'deposit_pending',
  'deposit_confirmed',
]);

// ============================================================================
// Tables
// ============================================================================

/**
 * Users table - core user identity
 * @see {@link @bangui/types#User}
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }),
  telegramId: varchar('telegram_id', { length: 255 }),
  discordId: varchar('discord_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastActive: timestamp('last_active', { withTimezone: true })
    .notNull()
    .defaultNow(),
  status: userStatusEnum('status').notNull().default('active'),
});

/**
 * User profiles table - extended user data
 * @see {@link @bangui/types#UserProfile}
 */
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  demographics: jsonb('demographics'),
  locationData: jsonb('location_data'),
  socialProfiles: jsonb('social_profiles'),
  riskTolerance: riskToleranceEnum('risk_tolerance'),
  estimatedNetWorth: decimal('estimated_net_worth'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Questionnaire responses table - raw survey data
 * @see {@link @bangui/types#QuestionnaireResponse}
 */
export const questionnaireResponses = pgTable('questionnaire_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  questionId: varchar('question_id', { length: 50 }).notNull(),
  response: jsonb('response').notNull(),
  answeredAt: timestamp('answered_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  responseTimeMs: integer('response_time_ms'),
});

/**
 * Archetype scores table - analyzed personality types
 * @see {@link @bangui/types#ArchetypeScore}
 */
export const archetypeScores = pgTable('archetype_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => userProfiles.id, { onDelete: 'cascade' }),
  archetype: archetypeEnum('archetype').notNull(),
  score: decimal('score').notNull(),
  confidence: decimal('confidence'),
  calculatedAt: timestamp('calculated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Cause affinities table - user cause preferences
 * @see {@link @bangui/types#CauseAffinity}
 */
export const causeAffinities = pgTable('cause_affinities', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => userProfiles.id, { onDelete: 'cascade' }),
  causeCategory: varchar('cause_category', { length: 100 }).notNull(),
  affinityScore: decimal('affinity_score').notNull(),
  reasoning: jsonb('reasoning'),
});

/**
 * Wallets table - user blockchain wallets
 * @see {@link @bangui/types#Wallet}
 */
export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  address: varchar('address', { length: 42 }).notNull(),
  chain: chainEnum('chain').notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  onchainAnalysis: jsonb('onchain_analysis'),
});

/**
 * Deposits table - user deposit transactions
 * @see {@link @bangui/types#Deposit}
 */
export const deposits = pgTable('deposits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  walletId: uuid('wallet_id')
    .notNull()
    .references(() => wallets.id, { onDelete: 'cascade' }),
  txHash: varchar('tx_hash', { length: 66 }),
  amount: decimal('amount').notNull(),
  token: varchar('token', { length: 20 }).notNull(),
  depositedAt: timestamp('deposited_at', { withTimezone: true }),
  status: depositStatusEnum('status').notNull().default('pending'),
});

/**
 * Conversations table - chat session tracking
 * @see {@link @bangui/types#Conversation}
 */
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  platform: platformEnum('platform').notNull(),
  platformThreadId: varchar('platform_thread_id', { length: 255 }),
  state: conversationStateEnum('state').notNull().default('idle'),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Messages table - individual chat messages
 * @see {@link @bangui/types#Message}
 */
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  sender: senderEnum('sender').notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Stories table - investment opportunities
 * @see {@link @bangui/types#Story}
 */
export const stories = pgTable('stories', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  causeCategory: varchar('cause_category', { length: 100 }).notNull(),
  impactMetrics: jsonb('impact_metrics'),
  minInvestment: decimal('min_investment'),
  riskLevel: riskToleranceEnum('risk_level'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  active: boolean('active').notNull().default(true),
});

/**
 * Allocation requests table - Vince → Kincho allocation requests
 * @see {@link @bangui/types#AllocationRequest}
 */
export const allocationRequests = pgTable('allocation_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  depositId: uuid('deposit_id').references(() => deposits.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  amount: decimal('amount').notNull(),
  userPreferences: jsonb('user_preferences').notNull(),
  vinceRecommendation: jsonb('vince_recommendation').notNull(),
  status: allocationStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Allocation decisions table - Kincho responses to allocation requests
 * @see {@link @bangui/types#AllocationDecision}
 */
export const allocationDecisions = pgTable('allocation_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id')
    .notNull()
    .references(() => allocationRequests.id, { onDelete: 'cascade' })
    .unique(),
  decision: allocationDecisionEnum('decision').notNull(),
  allocations: jsonb('allocations'),
  kinchoAnalysis: jsonb('kincho_analysis').notNull(),
  confidence: decimal('confidence').notNull(),
  reasoning: text('reasoning').notNull(),
  humanOverrideRequired: boolean('human_override_required')
    .notNull()
    .default(false),
  decidedAt: timestamp('decided_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Agent conversations table - Kincho-Vince conversation tracking
 * Separate from user conversations to isolate agent communication
 */
export const agentConversations = pgTable('agent_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  allocationRequestId: uuid('allocation_request_id')
    .notNull()
    .references(() => allocationRequests.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Agent messages table - Messages between Vince and Kincho
 * Kincho has NO access to user messages, only agent messages
 */
export const agentMessages = pgTable('agent_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentConversationId: uuid('agent_conversation_id')
    .notNull()
    .references(() => agentConversations.id, { onDelete: 'cascade' }),
  sender: senderEnum('sender').notNull(), // 'vince' or 'kincho'
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Memory type enum for agent learning */
export const memoryTypeEnum = pgEnum('memory_type', [
  'allocation_decision',
  'user_preference',
  'risk_assessment',
  'negotiation_history',
  'clarification',
  'escalation',
]);

/**
 * Agent memories table - Vector memory for agent learning
 * Used for storing allocation decisions, user preferences, and negotiation patterns
 * Note: embedding is stored via Supabase/pgvector (not in Drizzle schema)
 */
export const agentMemories = pgTable('agent_memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: varchar('agent_id', { length: 50 }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').references(() => conversations.id, {
    onDelete: 'set null',
  }),
  allocationRequestId: uuid('allocation_request_id').references(
    () => allocationRequests.id,
    { onDelete: 'set null' }
  ),
  content: text('content').notNull(),
  // Note: embedding vector(384) is managed via raw SQL migration for pgvector
  memoryType: memoryTypeEnum('memory_type').notNull(),
  importance: decimal('importance').default('0.5'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

// ============================================================================
// Relations
// ============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  questionnaireResponses: many(questionnaireResponses),
  wallets: many(wallets),
  deposits: many(deposits),
  conversations: many(conversations),
}));

export const userProfilesRelations = relations(userProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
  archetypeScores: many(archetypeScores),
  causeAffinities: many(causeAffinities),
}));

export const questionnaireResponsesRelations = relations(
  questionnaireResponses,
  ({ one }) => ({
    user: one(users, {
      fields: [questionnaireResponses.userId],
      references: [users.id],
    }),
  })
);

export const archetypeScoresRelations = relations(archetypeScores, ({ one }) => ({
  profile: one(userProfiles, {
    fields: [archetypeScores.profileId],
    references: [userProfiles.id],
  }),
}));

export const causeAffinitiesRelations = relations(causeAffinities, ({ one }) => ({
  profile: one(userProfiles, {
    fields: [causeAffinities.profileId],
    references: [userProfiles.id],
  }),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  deposits: many(deposits),
}));

export const depositsRelations = relations(deposits, ({ one }) => ({
  user: one(users, {
    fields: [deposits.userId],
    references: [users.id],
  }),
  wallet: one(wallets, {
    fields: [deposits.walletId],
    references: [wallets.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const allocationRequestsRelations = relations(
  allocationRequests,
  ({ one, many }) => ({
    user: one(users, {
      fields: [allocationRequests.userId],
      references: [users.id],
    }),
    deposit: one(deposits, {
      fields: [allocationRequests.depositId],
      references: [deposits.id],
    }),
    conversation: one(conversations, {
      fields: [allocationRequests.conversationId],
      references: [conversations.id],
    }),
    decision: one(allocationDecisions, {
      fields: [allocationRequests.id],
      references: [allocationDecisions.requestId],
    }),
    agentConversations: many(agentConversations),
  })
);

export const allocationDecisionsRelations = relations(
  allocationDecisions,
  ({ one }) => ({
    request: one(allocationRequests, {
      fields: [allocationDecisions.requestId],
      references: [allocationRequests.id],
    }),
  })
);

export const agentConversationsRelations = relations(
  agentConversations,
  ({ one, many }) => ({
    allocationRequest: one(allocationRequests, {
      fields: [agentConversations.allocationRequestId],
      references: [allocationRequests.id],
    }),
    messages: many(agentMessages),
  })
);

export const agentMessagesRelations = relations(agentMessages, ({ one }) => ({
  agentConversation: one(agentConversations, {
    fields: [agentMessages.agentConversationId],
    references: [agentConversations.id],
  }),
}));

export const agentMemoriesRelations = relations(agentMemories, ({ one }) => ({
  user: one(users, {
    fields: [agentMemories.userId],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [agentMemories.conversationId],
    references: [conversations.id],
  }),
  allocationRequest: one(allocationRequests, {
    fields: [agentMemories.allocationRequestId],
    references: [allocationRequests.id],
  }),
}));
