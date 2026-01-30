-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create search_memories RPC function (for vector similarity search)
-- This function is called by the Supabase client
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
    m.memory_type::varchar,
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
    AND (filter_memory_type IS NULL OR m.memory_type::varchar = filter_memory_type)
    AND (filter_min_importance IS NULL OR m.importance >= filter_min_importance)
    AND (m.expires_at IS NULL OR m.expires_at > now())
    AND (1 - (m.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;
