-- Add chunk context to knowledge_base table

-- Add a metadata column to store context information
ALTER TABLE knowledge_base 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Update the hybrid search function to return metadata
CREATE OR REPLACE FUNCTION hybrid_search_documents(
  query_text TEXT,
  query_embedding vector(384),
  p_user_id UUID,
  match_threshold FLOAT DEFAULT 0.65,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT,
  keyword_rank FLOAT,
  combined_score FLOAT,
  document_title TEXT,
  chunk_index INT,
  token_count INT,
  chunk_metadata JSONB  -- NEW: Add metadata field
) AS $$
BEGIN
  RETURN QUERY
  WITH vector_search AS (
    SELECT 
      kb.id,
      kb.document_id,
      kb.content,
      1 - (kb.embedding <=> query_embedding) as similarity,
      d.original_name as document_title,
      kb.chunk_index,
      kb.token_count,
      kb.metadata as chunk_metadata  -- NEW: Include metadata
    FROM knowledge_base kb
    JOIN documents d ON kb.document_id = d.id
    WHERE d.user_id = p_user_id
      AND 1 - (kb.embedding <=> query_embedding) >= match_threshold
    ORDER BY similarity DESC
    LIMIT match_count * 2  -- Get more for reranking
  ),
  keyword_search AS (
    SELECT 
      kb.id,
      kb.document_id,
      kb.content,
      ts_rank(kb.content_tsv, to_tsquery('english', query_text)) as keyword_rank,
      d.original_name as document_title,
      kb.chunk_index,
      kb.token_count,
      kb.metadata as chunk_metadata  -- NEW: Include metadata
    FROM knowledge_base kb
    JOIN documents d ON kb.document_id = d.id
    WHERE d.user_id = p_user_id
      AND kb.content_tsv @@ to_tsquery('english', query_text)
    ORDER BY keyword_rank DESC
    LIMIT match_count
  )
  SELECT 
    COALESCE(v.id, k.id) as id,
    COALESCE(v.document_id, k.document_id) as document_id,
    COALESCE(v.content, k.content) as content,
    COALESCE(v.similarity, 0.0) as similarity,
    COALESCE(k.keyword_rank, 0.0) as keyword_rank,
    -- Combined score: 70% vector, 30% keyword
    (COALESCE(v.similarity, 0.0) * 0.7 + COALESCE(k.keyword_rank, 0.0) * 0.3) as combined_score,
    COALESCE(v.document_title, k.document_title) as document_title,
    COALESCE(v.chunk_index, k.chunk_index) as chunk_index,
    COALESCE(v.token_count, k.token_count) as token_count,
    COALESCE(v.chunk_metadata, k.chunk_metadata) as chunk_metadata  -- NEW: Return metadata
  FROM vector_search v
  FULL OUTER JOIN keyword_search k ON v.id = k.id
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Update the existing match_documents function to return metadata as well
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  p_user_id uuid DEFAULT NULL,
  p_document_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  document_title text,
  chunk_index integer,
  token_count integer,
  chunk_metadata JSONB  -- NEW: Add metadata field
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.document_id,
    kb.content,
    1 - (kb.embedding <=> query_embedding) as similarity,
    d.original_name as document_title,
    kb.chunk_index,
    kb.token_count,
    kb.metadata as chunk_metadata  -- NEW: Include metadata
  FROM knowledge_base kb
  INNER JOIN documents d ON kb.document_id = d.id
  WHERE d.user_id = COALESCE(p_user_id, (SELECT auth.uid()))  -- Using subselect for performance
    AND d.status = 'completed'
    AND (p_document_ids IS NULL OR d.id = ANY(p_document_ids))
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;