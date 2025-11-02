-- Update the schema to ensure all functions, RLS policies and triggers are properly implemented
-- This migration makes sure our schema matches the security-enhanced version

-- Ensure the vector extension is available
CREATE EXTENSION IF NOT EXISTS "vector";

-- Make sure all our functions are updated with security fixes
-- (Recreating them in case they were created without security fixes)

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

-- Ensure all RLS policies are properly set
-- Enable RLS on all tables (in case it was disabled)
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them with security fixes
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Conversations policies
DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON conversations;

CREATE POLICY "Users can view their own conversations" ON conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON conversations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON conversations
    FOR DELETE USING (auth.uid() = user_id);

-- Messages policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can add messages to their conversations" ON messages;
DROP POLICY IF EXISTS "Users can delete messages from their conversations" ON messages;

CREATE POLICY "Users can view messages in their conversations" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = (SELECT auth.uid())  -- Using subselect for performance
        )
    );

CREATE POLICY "Users can add messages to their conversations" ON messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = (SELECT auth.uid())  -- Using subselect for performance
        )
    );

CREATE POLICY "Users can delete messages from their conversations" ON messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = (SELECT auth.uid())  -- Using subselect for performance
        )
    );

-- Documents policies
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can create own documents" ON documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;
DROP POLICY IF EXISTS "Admins can view all documents" ON documents;

CREATE POLICY "Users can view their own documents" ON documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own documents" ON documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" ON documents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" ON documents
    FOR DELETE USING (auth.uid() = user_id);

-- Admin policy for documents
CREATE POLICY "Admins can view all documents" ON documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = (SELECT auth.uid())  -- Using subselect for performance
            AND user_roles.role = 'admin'
        )
    );

-- Knowledge base policies
DROP POLICY IF EXISTS "Users can view their own knowledge base entries" ON knowledge_base;
DROP POLICY IF EXISTS "Users can delete their own knowledge base entries" ON knowledge_base;
DROP POLICY IF EXISTS "System can insert knowledge base entries" ON knowledge_base;
DROP POLICY IF EXISTS "Admins can view all knowledge base entries" ON knowledge_base;
DROP POLICY IF EXISTS "Admins can delete any knowledge base entries" ON knowledge_base;

CREATE POLICY "Users can view their own knowledge base entries" ON knowledge_base
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM documents
            WHERE documents.id = knowledge_base.document_id
            AND documents.user_id = (SELECT auth.uid())  -- Using subselect for performance
        )
    );

CREATE POLICY "Users can delete their own knowledge base entries" ON knowledge_base
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM documents
            WHERE documents.id = knowledge_base.document_id
            AND documents.user_id = (SELECT auth.uid())  -- Using subselect for performance
        )
    );

-- System can insert knowledge base entries
CREATE POLICY "System can insert knowledge base entries" ON knowledge_base
    FOR INSERT WITH CHECK (true);

-- Admin can view all knowledge base entries
CREATE POLICY "Admins can view all knowledge base entries" ON knowledge_base
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = (SELECT auth.uid())  -- Using subselect for performance
            AND user_roles.role = 'admin'
        )
    );

-- Admin can delete any knowledge base entries
CREATE POLICY "Admins can delete any knowledge base entries" ON knowledge_base
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = (SELECT auth.uid())  -- Using subselect for performance
            AND user_roles.role = 'admin'
        )
    );

-- Processing queue policies
DROP POLICY IF EXISTS "Users can view own queue items" ON processing_queue;
DROP POLICY IF EXISTS "Users can create own queue items" ON processing_queue;
DROP POLICY IF EXISTS "Service role has full access" ON processing_queue;

CREATE POLICY "Users can view own queue items" ON processing_queue
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own queue items" ON processing_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access" ON processing_queue
    FOR ALL USING ((SELECT auth.role()) = 'service_role');  -- Using subselect for performance

-- Security logs policies
DROP POLICY IF EXISTS "Users can view their own security logs" ON security_logs;
DROP POLICY IF EXISTS "Service role can manage all security logs" ON security_logs;

CREATE POLICY "Users can view their own security logs" ON security_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all security logs" ON security_logs
    FOR ALL USING ((SELECT auth.role()) = 'service_role');  -- Using subselect for performance

-- Security events policies
DROP POLICY IF EXISTS "Users can view their own security events" ON security_events;
DROP POLICY IF EXISTS "Service role can manage all security events" ON security_events;

CREATE POLICY "Users can view their own security events" ON security_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all security events" ON security_events
    FOR ALL USING ((SELECT auth.role()) = 'service_role');  -- Using subselect for performance

-- Rate limits policies (service role only)
DROP POLICY IF EXISTS "Service role can manage rate limits" ON rate_limits;

CREATE POLICY "Service role can manage rate limits" ON rate_limits
    FOR ALL USING ((SELECT auth.role()) = 'service_role');  -- Using subselect for performance

-- User sessions policies
DROP POLICY IF EXISTS "Users can view their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Service role can manage all sessions" ON user_sessions;

CREATE POLICY "Users can view their own sessions" ON user_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON user_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all sessions" ON user_sessions
    FOR ALL USING ((SELECT auth.role()) = 'service_role');  -- Using subselect for performance

-- User state policies
DROP POLICY IF EXISTS "Users can view their own state" ON user_state;
DROP POLICY IF EXISTS "Users can update their own state" ON user_state;
DROP POLICY IF EXISTS "Users can insert their own state" ON user_state;

CREATE POLICY "Users can view their own state" ON user_state
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own state" ON user_state
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own state" ON user_state
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- System memory policies
DROP POLICY IF EXISTS "Users can view their own system memory" ON system_memory;
DROP POLICY IF EXISTS "Users can create their own system memory" ON system_memory;
DROP POLICY IF EXISTS "Users can update their own system memory" ON system_memory;
DROP POLICY IF EXISTS "Users can delete their own system memory" ON system_memory;

CREATE POLICY "Users can view their own system memory" ON system_memory
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own system memory" ON system_memory
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own system memory" ON system_memory
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own system memory" ON system_memory
    FOR DELETE USING (auth.uid() = user_id);

-- User feedback policies
DROP POLICY IF EXISTS "Users can view their own feedback" ON user_feedback;
DROP POLICY IF EXISTS "Users can create their own feedback" ON user_feedback;
DROP POLICY IF EXISTS "Users can update their own feedback" ON user_feedback;

CREATE POLICY "Users can view their own feedback" ON user_feedback
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own feedback" ON user_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback" ON user_feedback
    FOR UPDATE USING (auth.uid() = user_id);

-- Decision log policies
DROP POLICY IF EXISTS "Users can view their own decision logs" ON decision_log;
DROP POLICY IF EXISTS "System can create decision logs" ON decision_log;

CREATE POLICY "Users can view their own decision logs" ON decision_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create decision logs" ON decision_log
    FOR INSERT WITH CHECK (true);

-- User subscriptions policies
DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON user_subscriptions;

CREATE POLICY "Users can view own subscription" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" ON user_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all subscriptions" ON user_subscriptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = (SELECT auth.uid())  -- Using subselect for performance
            AND role = 'admin'
        )
    );

-- Ensure triggers are properly set
-- Drop and recreate the trigger for conversation updated_at
DROP TRIGGER IF EXISTS trigger_update_conversation_updated_at ON messages;
CREATE TRIGGER trigger_update_conversation_updated_at
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_updated_at();

-- Drop and recreate the processing queue trigger
DROP TRIGGER IF EXISTS processing_queue_updated_at ON processing_queue;
CREATE TRIGGER processing_queue_updated_at
    BEFORE UPDATE ON processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_processing_queue_updated_at();

-- Drop and recreate the user subscription trigger
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_subscription();

-- Ensure proper grants are in place
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge_base TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON processing_queue TO authenticated;
GRANT SELECT ON security_logs TO authenticated;
GRANT SELECT ON security_events TO authenticated;
GRANT SELECT ON user_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_state TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON system_memory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON decision_log TO authenticated;
GRANT SELECT, UPDATE ON user_subscriptions TO authenticated;

GRANT EXECUTE ON FUNCTION is_admin TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION search_knowledge_base TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_documents TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_document_status TO service_role;
GRANT EXECUTE ON FUNCTION get_document_processing_stats TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_or_create_user_state TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_user_state TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION log_decision TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_security_logs TO service_role;
GRANT EXECUTE ON FUNCTION get_user_activity_summary TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION detect_suspicious_ip_activity TO service_role;
GRANT EXECUTE ON FUNCTION create_user_subscription TO service_role;
GRANT EXECUTE ON FUNCTION decrement_credits TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_search_all_knowledge TO authenticated, service_role;