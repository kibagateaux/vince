/**
 * @module @bangui/app/lib/db/queries/agent-conversations
 * Agent conversation queries for Kincho-Vince communication using Supabase
 */

import type { Db } from '../client';
import type {
  AgentConversationRow,
  AgentConversationInsert,
  AgentMessageRow,
  AgentMessageInsert,
  Sender,
  Json,
} from '../types';

/**
 * Creates an agent conversation for Kincho-Vince communication
 */
export const createAgentConversation = async (
  db: Db,
  allocationRequestId: string
): Promise<AgentConversationRow> => {
  const insert: AgentConversationInsert = {
    allocation_request_id: allocationRequestId,
  };

  const { data, error } = await db
    .from('agent_conversations')
    .insert(insert)
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create agent conversation');
  }

  return data;
};

/**
 * Gets agent conversation by allocation request ID
 */
export const getAgentConversationByRequest = async (
  db: Db,
  allocationRequestId: string
): Promise<(AgentConversationRow & { messages: AgentMessageRow[] }) | null> => {
  const { data, error } = await db
    .from('agent_conversations')
    .select(`
      *,
      messages:agent_messages(*)
    `)
    .eq('allocation_request_id', allocationRequestId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) return null;

  // Sort messages by sent_at
  return {
    ...data,
    messages: (data.messages ?? []).sort(
      (a: AgentMessageRow, b: AgentMessageRow) =>
        new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
    ),
  };
};

/**
 * Input for creating an agent message
 */
export interface CreateAgentMessageInput {
  readonly agentConversationId: string;
  readonly sender: 'vince' | 'kincho';
  readonly content: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Creates a message in an agent conversation
 */
export const createAgentMessage = async (
  db: Db,
  input: CreateAgentMessageInput
): Promise<AgentMessageRow> => {
  const insert: AgentMessageInsert = {
    agent_conversation_id: input.agentConversationId,
    sender: input.sender as Sender,
    content: input.content,
    metadata: (input.metadata ?? null) as Json,
  };

  const { data, error } = await db
    .from('agent_messages')
    .insert(insert)
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create agent message');
  }

  // Update agent conversation last_message_at
  const { error: updateError } = await db
    .from('agent_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', input.agentConversationId);

  if (updateError) {
    console.error('Failed to update agent conversation timestamp:', updateError);
  }

  return data;
};

/**
 * Gets all messages in an agent conversation
 */
export const getAgentMessages = async (
  db: Db,
  agentConversationId: string
): Promise<AgentMessageRow[]> => {
  const { data, error } = await db
    .from('agent_messages')
    .select('*')
    .eq('agent_conversation_id', agentConversationId)
    .order('sent_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
};

// ============================================================================
// Admin Queries
// ============================================================================

/**
 * Allocation request row with user info
 */
export interface AllocationRequestWithUser {
  readonly id: string;
  readonly user_id: string;
  readonly conversation_id: string | null;
  readonly amount: string;
  readonly vault_address: string | null;
  readonly status: string;
  readonly created_at: string;
  readonly user: {
    readonly id: string;
    readonly email: string | null;
  } | null;
}

/**
 * Agent conversation with request and messages for admin view
 */
export interface AgentConversationWithDetails {
  readonly id: string;
  readonly allocation_request_id: string;
  readonly started_at: string;
  readonly last_message_at: string;
  readonly messages: AgentMessageRow[];
  readonly allocation_request: AllocationRequestWithUser | null;
}

/**
 * Gets all agent conversations with allocation request details (for admin list)
 */
export const getAllAgentConversations = async (
  db: Db,
  options: { limit?: number; offset?: number } = {}
): Promise<AgentConversationWithDetails[]> => {
  const { limit = 50, offset = 0 } = options;

  const { data, error } = await db
    .from('agent_conversations')
    .select(`
      *,
      messages:agent_messages(*),
      allocation_request:allocation_requests(
        *,
        user:users(id, email)
      )
    `)
    .order('last_message_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return (data ?? []).map((conv) => ({
    ...conv,
    messages: (conv.messages ?? []).sort(
      (a: AgentMessageRow, b: AgentMessageRow) =>
        new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
    ),
  }));
};

/**
 * Gets agent conversation count (for pagination)
 */
export const getAgentConversationsCount = async (db: Db): Promise<number> => {
  const { count, error } = await db
    .from('agent_conversations')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw error;
  }

  return count ?? 0;
};

/**
 * Gets a single agent conversation with full details (for admin detail view)
 */
export const getAgentConversationById = async (
  db: Db,
  id: string
): Promise<AgentConversationWithDetails | null> => {
  const { data, error } = await db
    .from('agent_conversations')
    .select(`
      *,
      messages:agent_messages(*),
      allocation_request:allocation_requests(
        *,
        user:users(id, email)
      )
    `)
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) return null;

  return {
    ...data,
    messages: (data.messages ?? []).sort(
      (a: AgentMessageRow, b: AgentMessageRow) =>
        new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
    ),
  };
};

/**
 * Gets agent conversations for a specific user conversation (for the tab in user conversation detail)
 */
export const getAgentConversationsByUserConversation = async (
  db: Db,
  conversationId: string
): Promise<AgentConversationWithDetails[]> => {
  const { data, error } = await db
    .from('agent_conversations')
    .select(`
      *,
      messages:agent_messages(*),
      allocation_request:allocation_requests!inner(
        *,
        user:users(id, email)
      )
    `)
    .eq('allocation_request.conversation_id', conversationId)
    .order('started_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((conv) => ({
    ...conv,
    messages: (conv.messages ?? []).sort(
      (a: AgentMessageRow, b: AgentMessageRow) =>
        new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
    ),
  }));
};
