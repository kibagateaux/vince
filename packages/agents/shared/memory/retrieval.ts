/**
 * @module @bangui/agents/shared/memory/retrieval
 * Memory retrieval utilities for agents
 */

import { storeMemory, retrieveSimilarMemories } from '../db/index.js';
import { generateEmbedding } from './embedding.js';

export type AgentMemoryType =
  | 'allocation_decision'
  | 'user_preference'
  | 'risk_assessment'
  | 'negotiation_history'
  | 'clarification'
  | 'escalation';

export interface AgentMemory {
  id: string;
  agentId: string;
  userId?: string;
  conversationId?: string;
  allocationRequestId?: string;
  content: string;
  memoryType: AgentMemoryType;
  importance: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface MemorySearchResult extends AgentMemory {
  similarity: number;
}

export interface StoreMemoryInput {
  agentId: string;
  userId?: string;
  conversationId?: string;
  allocationRequestId?: string;
  content: string;
  memoryType: AgentMemoryType;
  importance?: number;
  metadata?: Record<string, unknown>;
}

export interface RetrievalOptions {
  agentId?: string;
  userId?: string;
  conversationId?: string;
  memoryType?: AgentMemoryType;
  limit?: number;
  threshold?: number;
}

/**
 * Search for relevant memories using semantic similarity
 */
export async function searchMemories(
  query: string,
  options: RetrievalOptions = {}
): Promise<MemorySearchResult[]> {
  const embedding = await generateEmbedding(query);

  if (!options.agentId) {
    return [];
  }

  const results = await retrieveSimilarMemories(options.agentId, embedding, {
    limit: options.limit ?? 10,
    threshold: options.threshold ?? 0.6,
    memoryTypes: options.memoryType ? [options.memoryType] : undefined,
    userId: options.userId,
  });

  return results.map((r) => ({
    id: r.id,
    agentId: options.agentId!,
    content: r.content,
    memoryType: r.memoryType as AgentMemoryType,
    importance: r.importance,
    similarity: r.similarity,
    metadata: r.metadata,
    createdAt: new Date(),
  }));
}

/**
 * Store a memory with auto-generated embedding
 */
export async function rememberWithEmbedding(
  input: StoreMemoryInput
): Promise<AgentMemory> {
  // For now, just store without embedding - vector search requires pgvector setup
  const result = await storeMemory({
    agentId: input.agentId,
    userId: input.userId,
    conversationId: input.conversationId,
    allocationRequestId: input.allocationRequestId,
    content: input.content,
    memoryType: input.memoryType,
    importance: input.importance,
    metadata: input.metadata,
  });

  return {
    id: result.id,
    agentId: input.agentId,
    userId: input.userId,
    conversationId: input.conversationId,
    allocationRequestId: input.allocationRequestId,
    content: input.content,
    memoryType: input.memoryType,
    importance: input.importance ?? 0.5,
    metadata: input.metadata,
    createdAt: new Date(),
  };
}

/**
 * Get recent memories for an agent (without semantic search)
 */
export async function getRecentMemories(
  agentId: string,
  options: {
    userId?: string;
    conversationId?: string;
    limit?: number;
  } = {}
): Promise<AgentMemory[]> {
  const results = await retrieveSimilarMemories(agentId, [], {
    limit: options.limit ?? 10,
    userId: options.userId,
  });

  return results.map((r) => ({
    id: r.id,
    agentId,
    content: r.content,
    memoryType: r.memoryType as AgentMemoryType,
    importance: r.importance,
    metadata: r.metadata,
    createdAt: new Date(),
  }));
}

/**
 * Build context from relevant memories for a prompt
 */
export function formatMemoriesForContext(memories: AgentMemory[]): string {
  if (memories.length === 0) {
    return '';
  }

  const formatted = memories
    .map((m, i) => `[Memory ${i + 1}] (${m.memoryType}): ${m.content}`)
    .join('\n');

  return `## Relevant Memories\n${formatted}\n`;
}
