-- Database functions with security fixes
-- These functions support the RAG chatbot application features

-- Function to check admin role with security fix
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = is_admin.user_id 
        AND user_roles.role = 'admin'
    );
$$;

-- Function to search knowledge base using vector similarity with security fix
CREATE OR REPLACE FUNCTION search_knowledge_base(
    query_embedding vector(384),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    content text,
    similarity float,
    document_title text,
    chunk_index integer,
    token_count integer
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
        d.title as document_title,
        kb.chunk_index,
        kb.token_count
    FROM knowledge_base kb
    INNER JOIN documents d ON kb.document_id = d.id
    WHERE d.user_id = (SELECT auth.uid())  -- Using subselect for performance
        AND d.status = 'completed'
        AND 1 - (kb.embedding <=> query_embedding) > match_threshold
    ORDER BY kb.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to match documents with security fix
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
  token_count integer
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
    d.title as document_title,
    kb.chunk_index,
    kb.token_count
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

-- Function to update conversation updated_at timestamp with security fix
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = NOW() 
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to update document status with security fix
CREATE OR REPLACE FUNCTION update_document_status(
  p_document_id UUID,
  p_status document_status,
  p_status_message TEXT DEFAULT NULL,
  p_chunk_count INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE documents
  SET 
    status = p_status,
    status_message = p_status_message,
    chunk_count = COALESCE(p_chunk_count, chunk_count),
    error_message = p_error_message,
    processing_started_at = CASE 
      WHEN p_status = 'processing' AND processing_started_at IS NULL 
      THEN NOW() 
      ELSE processing_started_at 
    END,
    processing_completed_at = CASE 
      WHEN p_status IN ('completed', 'failed', 'partial') 
      THEN NOW() 
      ELSE processing_completed_at 
    END,
    updated_at = NOW()
  WHERE id = p_document_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to get document processing stats with security fix
CREATE OR REPLACE FUNCTION get_document_processing_stats(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_documents BIGINT,
  pending_count BIGINT,
  queued_count BIGINT,
  processing_count BIGINT,
  completed_count BIGINT,
  failed_count BIGINT,
  avg_processing_time_seconds NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_documents,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'queued') as queued_count,
    COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    AVG(
      EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at))
    ) FILTER (
      WHERE processing_started_at IS NOT NULL 
      AND processing_completed_at IS NOT NULL
      AND status = 'completed'
    ) as avg_processing_time_seconds
  FROM documents
  WHERE user_id = COALESCE(p_user_id, (SELECT auth.uid()));  -- Using subselect for performance
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to get or create user state with security fix
CREATE OR REPLACE FUNCTION get_or_create_user_state(target_user_id UUID)
RETURNS user_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    user_state_record user_state;
BEGIN
    -- Try to get existing user state
    SELECT * INTO user_state_record
    FROM user_state
    WHERE user_id = target_user_id;
    
    -- If no user state exists, create one
    IF NOT FOUND THEN
        INSERT INTO user_state (user_id, trust_level, intent_patterns, emotional_state, attention_focus, interaction_style, preferences)
        VALUES (target_user_id, 0.5, '{}', '{}', '{}', '{}', '{}')
        RETURNING * INTO user_state_record;
    END IF;
    
    RETURN user_state_record;
END;
$$;

-- Function to update user state based on interaction with security fix
CREATE OR REPLACE FUNCTION update_user_state(
    target_user_id UUID,
    interaction_data JSONB
)
RETURNS user_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    current_state user_state;
    new_trust_level FLOAT;
    new_intent_patterns JSONB;
    new_emotional_state JSONB;
    new_attention_focus JSONB;
    new_interaction_style JSONB;
    new_preferences JSONB;
BEGIN
    -- Get current user state
    SELECT * INTO current_state FROM get_or_create_user_state(target_user_id);
    
    -- Extract interaction data
    new_trust_level := COALESCE((interaction_data->>'trust_delta')::FLOAT, 0);
    new_intent_patterns := COALESCE(interaction_data->'intent_patterns', current_state.intent_patterns);
    new_emotional_state := COALESCE(interaction_data->'emotional_state', current_state.emotional_state);
    new_attention_focus := COALESCE(interaction_data->'attention_focus', current_state.attention_focus);
    new_interaction_style := COALESCE(interaction_data->'interaction_style', current_state.interaction_style);
    new_preferences := COALESCE(interaction_data->'preferences', current_state.preferences);
    
    -- Update trust level with bounds checking
    new_trust_level := GREATEST(0, LEAST(1, current_state.trust_level + new_trust_level));
    
    -- Update user state
    UPDATE user_state
    SET 
        trust_level = new_trust_level,
        intent_patterns = new_intent_patterns,
        emotional_state = new_emotional_state,
        attention_focus = new_attention_focus,
        interaction_style = new_interaction_style,
        preferences = new_preferences,
        updated_at = NOW()
    WHERE user_id = target_user_id
    RETURNING * INTO current_state;
    
    RETURN current_state;
END;
$$;

-- Function to log decision transparency with security fix
CREATE OR REPLACE FUNCTION log_decision(
    target_user_id UUID,
    target_conversation_id UUID,
    target_message_id UUID,
    decision_factors JSONB,
    confidence_score FLOAT DEFAULT NULL,
    alternatives JSONB DEFAULT '[]',
    reasoning TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    decision_id UUID;
BEGIN
    INSERT INTO decision_log (
        user_id,
        conversation_id,
        message_id,
        decision_factors,
        confidence_score,
        alternatives,
        reasoning
    )
    VALUES (
        target_user_id,
        target_conversation_id,
        target_message_id,
        decision_factors,
        confidence_score,
        alternatives,
        reasoning
    )
    RETURNING id INTO decision_id;
    
    RETURN decision_id;
END;
$$;

-- Function to cleanup old security logs with security fix
CREATE OR REPLACE FUNCTION cleanup_old_security_logs()
RETURNS void AS $$
BEGIN
    -- Delete logs older than 90 days
    DELETE FROM security_logs 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    -- Delete security events older than 1 year
    DELETE FROM security_events 
    WHERE timestamp < NOW() - INTERVAL '1 year';
    
    -- Delete expired rate limit entries
    DELETE FROM rate_limits 
    WHERE window_start < NOW() - INTERVAL '1 hour';
    
    -- Delete expired user sessions
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() OR last_activity < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to get user activity summary with security fix
CREATE OR REPLACE FUNCTION get_user_activity_summary(p_user_id UUID, p_days INTEGER DEFAULT 7)
RETURNS TABLE (
    total_requests BIGINT,
    failed_requests BIGINT,
    suspicious_events BIGINT,
    last_activity TIMESTAMPTZ,
    ip_addresses TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE level >= 3) as failed_requests,
        (SELECT COUNT(*) FROM security_events se WHERE se.user_id = p_user_id AND se.timestamp > NOW() - (p_days || ' days')::INTERVAL) as suspicious_events,
        MAX(sl.timestamp) as last_activity,
        ARRAY_AGG(DISTINCT sl.ip_address::TEXT) as ip_addresses
    FROM security_logs sl
    WHERE sl.user_id = p_user_id 
    AND sl.timestamp > NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to detect suspicious IP activity with security fix
CREATE OR REPLACE FUNCTION detect_suspicious_ip_activity(p_ip INET, p_hours INTEGER DEFAULT 1)
RETURNS TABLE (
    event_count BIGINT,
    unique_users BIGINT,
    event_types TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as event_count,
        COUNT(DISTINCT user_id) as unique_users,
        ARRAY_AGG(DISTINCT event_type) as event_types
    FROM security_events se
    WHERE se.ip_address = p_ip 
    AND se.timestamp > NOW() - (p_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to create user subscription with security fix
CREATE OR REPLACE FUNCTION create_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_subscriptions (user_id, plan, credits_remaining, credits_max)
  VALUES (NEW.id, 'free', 50, 50)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to decrement credits with security fix
CREATE OR REPLACE FUNCTION decrement_credits(p_user_id UUID)
RETURNS TABLE(success BOOLEAN, remaining_credits INTEGER) AS $$
DECLARE
  v_credits INTEGER;
  v_plan TEXT;
BEGIN
  -- Lock row for update
  SELECT credits_remaining, plan INTO v_credits, v_plan
  FROM user_subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Pro users have unlimited credits
  IF v_plan = 'pro' THEN
    RETURN QUERY SELECT TRUE, v_credits;
    RETURN;
  END IF;

  -- Free users must have credits
  IF v_credits <= 0 THEN
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  -- Decrement and return
  UPDATE user_subscriptions
  SET credits_remaining = credits_remaining - 1,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT TRUE, v_credits - 1;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to update processing queue timestamp with security fix
CREATE OR REPLACE FUNCTION update_processing_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function for admin search all knowledge with security fix
CREATE OR REPLACE FUNCTION public.admin_search_all_knowledge(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = (SELECT auth.uid())  -- Using subselect for performance
    AND user_roles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  RETURN QUERY
  SELECT
    kb.id,
    kb.document_id,
    kb.content,
    1 - (kb.embedding <=> query_embedding) AS similarity,
    d.user_id
  FROM knowledge_base kb
  INNER JOIN documents d ON kb.document_id = d.id
  WHERE 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;