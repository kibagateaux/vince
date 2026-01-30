/**
 * @module @bangui/agents/shared/memory
 * Memory module exports
 */

export {
  generateEmbedding,
  generateEmbeddings,
  EMBEDDING_DIMENSIONS,
} from './embedding.js';

export {
  searchMemories,
  rememberWithEmbedding,
  getRecentMemories,
  formatMemoriesForContext,
  type RetrievalOptions,
} from './retrieval.js';
