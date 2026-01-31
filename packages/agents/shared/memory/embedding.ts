/**
 * @module @bangui/agents/shared/memory/embedding
 * Embedding generation for vector memory
 * Uses Supabase Edge Functions with gte-small (free, 384 dimensions)
 */

import { getSupabaseServiceClient } from '../db/index.js';

/** Embedding dimensions for gte-small model */
export const EMBEDDING_DIMENSIONS = 384;

/**
 * Generate embeddings using Supabase Edge Functions
 * Falls back to a simple hash-based embedding for development
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Try Supabase Edge Function first
  try {
    const client = getSupabaseServiceClient();
    const { data, error } = await client.functions.invoke('embed-text', {
      body: { text },
    });

    if (!error && data?.embedding) {
      return data.embedding as number[];
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: Simple deterministic hash-based embedding for development
  // This is NOT semantically meaningful, just for testing the infrastructure
  return generateFallbackEmbedding(text);
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // TODO: Implement batch embedding via Edge Function
  return Promise.all(texts.map(generateEmbedding));
}

/**
 * Fallback embedding generator using deterministic hashing
 * Only for development - not semantically meaningful
 */
function generateFallbackEmbedding(text: string): number[] {
  const embedding = new Array(EMBEDDING_DIMENSIONS).fill(0) as number[];
  const normalizedText = text.toLowerCase().trim();

  // Simple hash-based approach
  for (let i = 0; i < normalizedText.length; i++) {
    const charCode = normalizedText.charCodeAt(i);
    const index = (i * 7 + charCode) % EMBEDDING_DIMENSIONS;
    embedding[index] = (embedding[index]! + Math.sin(charCode * (i + 1))) / 2;
  }

  // Normalize to unit vector
  const magnitude = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0)
  );
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = embedding[i]! / magnitude;
    }
  }

  return embedding;
}
