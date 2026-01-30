-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Agent memories table for storing learned patterns and decisions
CREATE TABLE agent_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id varchar(50) NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  allocation_request_id uuid REFERENCES allocation_requests(id) ON DELETE SET NULL,
  content text NOT NULL,
  embedding vector(384),  -- gte-small dimensions (free via Supabase Edge Functions)
  memory_type varchar(50) NOT NULL,
  importance numeric DEFAULT 0.5,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Index for vector similarity search using IVFFlat
-- Lists = 100 is a good starting point for <100K records
CREATE INDEX agent_memories_embedding_idx ON agent_memories
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Indexes for common queries
CREATE INDEX agent_memories_agent_id_idx ON agent_memories(agent_id);
CREATE INDEX agent_memories_user_id_idx ON agent_memories(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX agent_memories_allocation_request_id_idx ON agent_memories(allocation_request_id) WHERE allocation_request_id IS NOT NULL;
CREATE INDEX agent_memories_memory_type_idx ON agent_memories(memory_type);
CREATE INDEX agent_memories_expires_at_idx ON agent_memories(expires_at) WHERE expires_at IS NOT NULL;

-- RPC function for vector similarity search with filtering
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding vector(384),
  similarity_threshold float DEFAULT 0.7,
  match_limit int DEFAULT 10,
  filter_agent_id varchar DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL,
  filter_conversation_id uuid DEFAULT NULL,
  filter_memory_type varchar DEFAULT NULL,
  filter_min_importance numeric DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  agent_id varchar,
  user_id uuid,
  conversation_id uuid,
  allocation_request_id uuid,
  content text,
  embedding vector(384),
  memory_type varchar,
  importance numeric,
  metadata jsonb,
  created_at timestamptz,
  expires_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.agent_id,
    m.user_id,
    m.conversation_id,
    m.allocation_request_id,
    m.content,
    m.embedding,
    m.memory_type,
    m.importance,
    m.metadata,
    m.created_at,
    m.expires_at,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM agent_memories m
  WHERE
    m.embedding IS NOT NULL
    AND (filter_agent_id IS NULL OR m.agent_id = filter_agent_id)
    AND (filter_user_id IS NULL OR m.user_id = filter_user_id)
    AND (filter_conversation_id IS NULL OR m.conversation_id = filter_conversation_id)
    AND (filter_memory_type IS NULL OR m.memory_type = filter_memory_type)
    AND (filter_min_importance IS NULL OR m.importance >= filter_min_importance)
    AND (m.expires_at IS NULL OR m.expires_at > now())
    AND (1 - (m.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;
