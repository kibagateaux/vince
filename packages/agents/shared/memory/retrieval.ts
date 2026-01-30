/**
 * @module @bangui/agents/shared/memory/retrieval
 * Memory retrieval utilities for agents
 */

import {
  searchSimilarMemories,
  getAgentMemories,
  storeMemory,
  type AgentMemory,
  type AgentMemoryType,
  type MemorySearchResult,
  type StoreMemoryInput,
} from '@bangui/db';
import { generateEmbedding } from './embedding.js';

export interface RetrievalOptions {
  agentId?: AgentMemory['agentId'];
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

  return searchSimilarMemories(embedding, {
    threshold: options.threshold ?? 0.6,
    limit: options.limit ?? 10,
    filters: {
      agentId: options.agentId,
      userId: options.userId,
      conversationId: options.conversationId,
      memoryType: options.memoryType,
    },
  });
}

/**
 * Store a memory with auto-generated embedding
 */
export async function rememberWithEmbedding(
  input: StoreMemoryInput
): Promise<AgentMemory> {
  const embedding = await generateEmbedding(input.content);

  return storeMemory({
    ...input,
    embedding,
  });
}

/**
 * Get recent memories for an agent (without semantic search)
 */
export async function getRecentMemories(
  agentId: AgentMemory['agentId'],
  options: {
    userId?: string;
    conversationId?: string;
    limit?: number;
  } = {}
): Promise<AgentMemory[]> {
  return getAgentMemories(agentId, options);
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
