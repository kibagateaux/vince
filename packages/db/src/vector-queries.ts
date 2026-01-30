/**
 * @module @bangui/db/vector-queries
 * Vector memory operations using Supabase + pgvector
 */

import { getSupabaseServiceClient } from './supabase-client.js';

/** Memory types for agent learning */
export type AgentMemoryType =
  | 'allocation_decision'
  | 'user_preference'
  | 'risk_assessment'
  | 'negotiation_history'
  | 'clarification'
  | 'escalation';

/** Agent memory record */
export interface AgentMemory {
  id: string;
  agentId: 'vince' | 'kincho' | 'financial_analyzer' | 'risk_engine' | 'meta_cognition';
  userId?: string;
  conversationId?: string;
  allocationRequestId?: string;
  content: string;
  embedding?: number[];
  memoryType: AgentMemoryType;
  importance: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  expiresAt?: Date;
}

/** Input for storing a new memory */
export interface StoreMemoryInput {
  agentId: AgentMemory['agentId'];
  userId?: string;
  conversationId?: string;
  allocationRequestId?: string;
  content: string;
  embedding?: number[];
  memoryType: AgentMemoryType;
  importance?: number;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

/** Search filters for memory retrieval */
export interface MemorySearchFilters {
  agentId?: AgentMemory['agentId'];
  userId?: string;
  conversationId?: string;
  allocationRequestId?: string;
  memoryType?: AgentMemoryType;
  minImportance?: number;
}

/** Memory search result with similarity score */
export interface MemorySearchResult extends AgentMemory {
  similarity: number;
}

/**
 * Store a memory with optional embedding
 */
export async function storeMemory(input: StoreMemoryInput): Promise<AgentMemory> {
  const client = getSupabaseServiceClient();

  const { data, error } = await client
    .from('agent_memories')
    .insert({
      agent_id: input.agentId,
      user_id: input.userId,
      conversation_id: input.conversationId,
      allocation_request_id: input.allocationRequestId,
      content: input.content,
      embedding: input.embedding,
      memory_type: input.memoryType,
      importance: input.importance ?? 0.5,
      metadata: input.metadata,
      expires_at: input.expiresAt?.toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to store memory: ${error.message}`);
  }

  return mapToAgentMemory(data);
}

/**
 * Search for similar memories using vector similarity
 * Requires the embedding to be pre-computed
 */
export async function searchSimilarMemories(
  queryEmbedding: number[],
  options: {
    threshold?: number;
    limit?: number;
    filters?: MemorySearchFilters;
  } = {}
): Promise<MemorySearchResult[]> {
  const client = getSupabaseServiceClient();
  const { threshold = 0.7, limit = 10, filters = {} } = options;

  const { data, error } = await client.rpc('search_memories', {
    query_embedding: queryEmbedding,
    similarity_threshold: threshold,
    match_limit: limit,
    filter_agent_id: filters.agentId ?? null,
    filter_user_id: filters.userId ?? null,
    filter_conversation_id: filters.conversationId ?? null,
    filter_memory_type: filters.memoryType ?? null,
    filter_min_importance: filters.minImportance ?? null,
  });

  if (error) {
    throw new Error(`Failed to search memories: ${error.message}`);
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...mapToAgentMemory(row),
    similarity: row['similarity'] as number,
  }));
}

/**
 * Get memories by allocation request ID (for audit trail)
 */
export async function getMemoriesByAllocationRequest(
  allocationRequestId: string
): Promise<AgentMemory[]> {
  const client = getSupabaseServiceClient();

  const { data, error } = await client
    .from('agent_memories')
    .select()
    .eq('allocation_request_id', allocationRequestId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get memories: ${error.message}`);
  }

  return (data ?? []).map(mapToAgentMemory);
}

/**
 * Get memories for a specific agent in a conversation
 */
export async function getAgentMemories(
  agentId: AgentMemory['agentId'],
  options: {
    conversationId?: string;
    userId?: string;
    limit?: number;
  } = {}
): Promise<AgentMemory[]> {
  const client = getSupabaseServiceClient();
  const { limit = 50 } = options;

  let query = client
    .from('agent_memories')
    .select()
    .eq('agent_id', agentId);

  if (options.conversationId) {
    query = query.eq('conversation_id', options.conversationId);
  }
  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get agent memories: ${error.message}`);
  }

  return (data ?? []).map(mapToAgentMemory);
}

/**
 * Delete expired memories (cleanup job)
 */
export async function deleteExpiredMemories(): Promise<number> {
  const client = getSupabaseServiceClient();

  const { data, error } = await client
    .from('agent_memories')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .not('expires_at', 'is', null)
    .select('id');

  if (error) {
    throw new Error(`Failed to delete expired memories: ${error.message}`);
  }

  return data?.length ?? 0;
}

/**
 * Update memory importance (for reinforcement learning)
 */
export async function updateMemoryImportance(
  memoryId: string,
  importance: number
): Promise<void> {
  const client = getSupabaseServiceClient();

  const { error } = await client
    .from('agent_memories')
    .update({ importance })
    .eq('id', memoryId);

  if (error) {
    throw new Error(`Failed to update memory importance: ${error.message}`);
  }
}

/** Map database row to AgentMemory type */
function mapToAgentMemory(row: Record<string, unknown>): AgentMemory {
  return {
    id: row['id'] as string,
    agentId: row['agent_id'] as AgentMemory['agentId'],
    userId: row['user_id'] as string | undefined,
    conversationId: row['conversation_id'] as string | undefined,
    allocationRequestId: row['allocation_request_id'] as string | undefined,
    content: row['content'] as string,
    embedding: row['embedding'] as number[] | undefined,
    memoryType: row['memory_type'] as AgentMemoryType,
    importance: Number(row['importance']),
    metadata: row['metadata'] as Record<string, unknown> | undefined,
    createdAt: new Date(row['created_at'] as string),
    expiresAt: row['expires_at'] ? new Date(row['expires_at'] as string) : undefined,
  };
}
