/**
 * @module @bangui/agents/shared/db
 * Supabase client for agent operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

/**
 * Gets the shared Supabase client instance
 */
export const getSupabaseServiceClient = (): SupabaseClient => {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
    }

    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabase;
};

export type Db = SupabaseClient;

/**
 * Stores a memory in the agent_memories table
 */
export const storeMemory = async (memory: {
  agentId: string;
  userId?: string;
  conversationId?: string;
  allocationRequestId?: string;
  content: string;
  memoryType: string;
  importance?: number;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string }> => {
  const db = getSupabaseServiceClient();

  const { data, error } = await db
    .from('agent_memories')
    .insert({
      agent_id: memory.agentId,
      user_id: memory.userId,
      conversation_id: memory.conversationId,
      allocation_request_id: memory.allocationRequestId,
      content: memory.content,
      memory_type: memory.memoryType,
      importance: memory.importance ?? 0.5,
      metadata: memory.metadata,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[storeMemory] Error:', error);
    throw error;
  }

  return { id: data.id };
};

/**
 * Retrieves similar memories using vector search
 */
export const retrieveSimilarMemories = async (
  agentId: string,
  _queryEmbedding: number[],
  options?: {
    limit?: number;
    threshold?: number;
    memoryTypes?: string[];
    userId?: string;
  }
): Promise<Array<{
  id: string;
  content: string;
  memoryType: string;
  importance: number;
  similarity: number;
  metadata?: Record<string, unknown>;
}>> => {
  const db = getSupabaseServiceClient();

  // For now, just return recent memories without vector search
  // Vector search requires pgvector extension and embeddings
  let query = db
    .from('agent_memories')
    .select('id, content, memory_type, importance, metadata')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 10);

  if (options?.memoryTypes && options.memoryTypes.length > 0) {
    query = query.in('memory_type', options.memoryTypes);
  }

  if (options?.userId) {
    query = query.eq('user_id', options.userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[retrieveSimilarMemories] Error:', error);
    return [];
  }

  return (data ?? []).map((m) => ({
    id: m.id,
    content: m.content,
    memoryType: m.memory_type,
    importance: Number(m.importance ?? 0.5),
    similarity: 1.0, // Placeholder since we're not doing vector search
    metadata: m.metadata as Record<string, unknown> | undefined,
  }));
};

/**
 * Gets memories by allocation request ID
 */
export const getMemoriesByAllocationRequest = async (
  allocationRequestId: string
): Promise<Array<{
  id: string;
  agentId: string;
  content: string;
  memoryType: string;
  importance: number;
  createdAt: Date;
}>> => {
  const db = getSupabaseServiceClient();

  const { data, error } = await db
    .from('agent_memories')
    .select('id, agent_id, content, memory_type, importance, created_at')
    .eq('allocation_request_id', allocationRequestId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[getMemoriesByAllocationRequest] Error:', error);
    return [];
  }

  return (data ?? []).map((m) => ({
    id: m.id,
    agentId: m.agent_id,
    content: m.content,
    memoryType: m.memory_type,
    importance: Number(m.importance ?? 0.5),
    createdAt: new Date(m.created_at),
  }));
};

/**
 * Creates an agent conversation for allocation processing
 */
export const createAgentConversation = async (
  db: Db,
  allocationRequestId: string
): Promise<{ id: string; allocationRequestId: string; startedAt: Date }> => {
  const { data, error } = await db
    .from('agent_conversations')
    .insert({ allocation_request_id: allocationRequestId })
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create agent conversation');
  }

  return {
    id: data.id,
    allocationRequestId: data.allocation_request_id,
    startedAt: new Date(data.started_at),
  };
};

/**
 * Creates an agent message
 */
export const createAgentMessage = async (
  db: Db,
  params: {
    agentConversationId: string;
    sender: string;
    content: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ id: string }> => {
  const { data, error } = await db
    .from('agent_messages')
    .insert({
      agent_conversation_id: params.agentConversationId,
      sender: params.sender,
      content: params.content,
      metadata: params.metadata,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create agent message');
  }

  return { id: data.id };
};

/**
 * Gets agent conversation by allocation request ID
 */
export const getAgentConversationByRequest = async (
  db: Db,
  allocationRequestId: string
): Promise<{ id: string; allocationRequestId: string; startedAt: Date } | null> => {
  const { data, error } = await db
    .from('agent_conversations')
    .select('*')
    .eq('allocation_request_id', allocationRequestId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    allocationRequestId: data.allocation_request_id,
    startedAt: new Date(data.started_at),
  };
};

/**
 * Gets agent messages for a conversation
 */
export const getAgentMessages = async (
  db: Db,
  agentConversationId: string
): Promise<Array<{
  id: string;
  sender: string;
  content: string;
  sentAt: Date;
  metadata?: Record<string, unknown>;
}>> => {
  const { data, error } = await db
    .from('agent_messages')
    .select('*')
    .eq('agent_conversation_id', agentConversationId)
    .order('sent_at', { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? []).map((m) => ({
    id: m.id,
    sender: m.sender,
    content: m.content,
    sentAt: new Date(m.sent_at),
    metadata: m.metadata as Record<string, unknown> | undefined,
  }));
};
