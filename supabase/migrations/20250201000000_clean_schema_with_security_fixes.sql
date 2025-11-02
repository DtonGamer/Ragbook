-- Clean Supabase Schema with All Security Fixes
-- This is a consolidated schema file with all security and performance issues fixed
-- Incorporates all tables, functions, and RLS policies with proper security implementation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =============================================
-- USER MANAGEMENT TABLES
-- =============================================

-- User roles table for admin/user permissions
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- User subscriptions table for credits & payment system
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Plan details
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  
  -- Credits tracking
  credits_remaining INTEGER NOT NULL DEFAULT 50,
  credits_max INTEGER NOT NULL DEFAULT 50,
  
  -- Subscription timing
  last_refresh_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  subscription_end_date TIMESTAMP WITH TIME ZONE,
  
  -- Paystack integration
  paystack_subscription_id TEXT,
  paystack_customer_code TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CONVERSATION MANAGEMENT
-- =============================================

-- Conversations table to store chat sessions
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table to store individual chat messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- DOCUMENT STORAGE
-- =============================================

-- Create document_status enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
    CREATE TYPE document_status AS ENUM (
      'pending',      -- Uploaded, not yet queued
      'queued',       -- In Redis queue, waiting for worker
      'processing',   -- Worker is processing
      'completed',    -- Successfully processed
      'failed',       -- Processing failed
      'partial'       -- Some chunks processed, some failed
    );
  END IF;
END 
$$;

-- Documents table to track uploaded files
CREATE TABLE IF NOT EXISTS documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT, -- NEW: title field
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    status document_status DEFAULT 'pending'::document_status, -- NEW: status field
    chunk_count INTEGER DEFAULT 0,
    needs_ocr BOOLEAN DEFAULT FALSE,
    status_message TEXT,
    error_message TEXT,
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- VECTOR STORAGE (KNOWLEDGE BASE)
-- =============================================

-- Knowledge base table for storing document chunks with vector embeddings
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(384) NOT NULL,  -- 384 dimensions for HuggingFace embeddings
  chunk_index INTEGER NOT NULL,
  token_count INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PROCESSING QUEUE TABLE
-- =============================================

-- Processing queue table as fallback for Redis
CREATE TABLE IF NOT EXISTS processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- =============================================
-- SECURITY LOGGING TABLES
-- =============================================

-- Security logs table for general application logging
CREATE TABLE IF NOT EXISTS security_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    level INTEGER NOT NULL CHECK (level >= 0 AND level <= 4), -- 0=DEBUG, 1=INFO, 2=WARN, 3=ERROR, 4=CRITICAL
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    service VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    request_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    error_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Security events table for specific security incidents
CREATE TABLE IF NOT EXISTS security_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'AUTH_FAILURE', 
        'RATE_LIMIT_EXCEEDED', 
        'SUSPICIOUS_ACTIVITY', 
        'FILE_UPLOAD_BLOCKED', 
        'PROMPT_INJECTION_DETECTED'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Rate limiting table for distributed rate limiting (if needed)
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of the rate limit key
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(key_hash, window_start)
);

-- User session tracking table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_token VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    last_activity TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- SOVEREIGN-CENTERED SYSTEM TABLES
-- =============================================

-- User state table for tracking individual user patterns and preferences
CREATE TABLE IF NOT EXISTS user_state (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    intent_patterns JSONB DEFAULT '{}',
    trust_level FLOAT DEFAULT 0.5 CHECK (trust_level >= 0 AND trust_level <= 1),
    emotional_state JSONB DEFAULT '{}',
    attention_focus JSONB DEFAULT '{}',
    interaction_style JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- System memory for persistent learning and adaptation
CREATE TABLE IF NOT EXISTS system_memory (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('preference', 'pattern', 'adaptation', 'feedback')),
    content JSONB NOT NULL,
    confidence FLOAT DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User feedback tracking for system improvement
CREATE TABLE IF NOT EXISTS user_feedback (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('helpful', 'not_helpful', 'suggest_alternative', 'confused', 'frustrated')),
    feedback_content TEXT,
    system_response_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Decision transparency log for audit trails
CREATE TABLE IF NOT EXISTS decision_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    decision_factors JSONB NOT NULL,
    confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
    alternatives JSONB DEFAULT '[]',
    reasoning TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Indexes for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Indexes for documents
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_user_status ON documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_needs_ocr ON documents(needs_ocr) WHERE needs_ocr = true;
CREATE INDEX IF NOT EXISTS idx_documents_processing_times ON documents(processing_started_at, processing_completed_at) 
WHERE processing_started_at IS NOT NULL AND processing_completed_at IS NOT NULL;

-- Indexes for knowledge base
CREATE INDEX IF NOT EXISTS idx_knowledge_base_document_id ON knowledge_base(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding ON knowledge_base 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Indexes for user subscriptions
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan ON user_subscriptions(plan);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expiry ON user_subscriptions(subscription_end_date) 
WHERE subscription_end_date IS NOT NULL;

-- Indexes for processing queue
CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_document_id ON processing_queue(document_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_user_id ON processing_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_created_at ON processing_queue(created_at);

-- Indexes for security logs
CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp ON security_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip_address ON security_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_logs_service ON security_logs(service);
CREATE INDEX IF NOT EXISTS idx_security_logs_level ON security_logs(level);

CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_hash ON rate_limits(key_hash);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);

-- Indexes for user state
CREATE INDEX IF NOT EXISTS idx_user_state_user_id ON user_state(user_id);
CREATE INDEX IF NOT EXISTS idx_user_state_updated_at ON user_state(updated_at DESC);

-- Indexes for system memory
CREATE INDEX IF NOT EXISTS idx_system_memory_user_id ON system_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_system_memory_type ON system_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_system_memory_confidence ON system_memory(confidence DESC);

-- Indexes for user feedback
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_message_id ON user_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON user_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON user_feedback(created_at DESC);

-- Indexes for decision log
CREATE INDEX IF NOT EXISTS idx_decision_log_user_id ON decision_log(user_id);
CREATE INDEX IF NOT EXISTS idx_decision_log_conversation_id ON decision_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_decision_log_created_at ON decision_log(created_at DESC);

-- =============================================
-- DATABASE FUNCTIONS WITH SECURITY FIXES
-- =============================================

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

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger to automatically update conversation timestamp when messages are added
CREATE TRIGGER trigger_update_conversation_updated_at
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_updated_at();

-- Trigger for processing queue updated at
CREATE TRIGGER processing_queue_updated_at
    BEFORE UPDATE ON processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_processing_queue_updated_at();

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
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

-- User roles policies
CREATE POLICY "Users can view their own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Conversations policies
CREATE POLICY "Users can view their own conversations" ON conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON conversations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON conversations
    FOR DELETE USING (auth.uid() = user_id);

-- Messages policies
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
CREATE POLICY "Users can view own queue items" ON processing_queue
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own queue items" ON processing_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access" ON processing_queue
    FOR ALL USING ((SELECT auth.role()) = 'service_role');  -- Using subselect for performance

-- Security logs policies
CREATE POLICY "Users can view their own security logs" ON security_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all security logs" ON security_logs
    FOR ALL USING ((SELECT auth.role()) = 'service_role');  -- Using subselect for performance

-- Security events policies
CREATE POLICY "Users can view their own security events" ON security_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all security events" ON security_events
    FOR ALL USING ((SELECT auth.role()) = 'service_role');  -- Using subselect for performance

-- Rate limits policies (service role only)
CREATE POLICY "Service role can manage rate limits" ON rate_limits
    FOR ALL USING ((SELECT auth.role()) = 'service_role');  -- Using subselect for performance

-- User sessions policies
CREATE POLICY "Users can view their own sessions" ON user_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON user_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all sessions" ON user_sessions
    FOR ALL USING ((SELECT auth.role()) = 'service_role');  -- Using subselect for performance

-- User state policies
CREATE POLICY "Users can view their own state" ON user_state
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own state" ON user_state
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own state" ON user_state
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- System memory policies
CREATE POLICY "Users can view their own system memory" ON system_memory
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own system memory" ON system_memory
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own system memory" ON system_memory
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own system memory" ON system_memory
    FOR DELETE USING (auth.uid() = user_id);

-- User feedback policies
CREATE POLICY "Users can view their own feedback" ON user_feedback
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own feedback" ON user_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback" ON user_feedback
    FOR UPDATE USING (auth.uid() = user_id);

-- Decision log policies
CREATE POLICY "Users can view their own decision logs" ON decision_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create decision logs" ON decision_log
    FOR INSERT WITH CHECK (true);

-- User subscriptions policies
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

-- =============================================
-- TRIGGERS FOR USER CREATION
-- =============================================

-- Create trigger for user signup
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_subscription();

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

-- Grant permissions to authenticated users
GRANT SELECT ON user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON conversations TO authenticated;
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
GRANT SELECT, INSERT ON decision_log TO authenticated;
GRANT SELECT, UPDATE ON user_subscriptions TO authenticated;

-- Grant permissions to service role
GRANT ALL ON user_roles TO service_role;
GRANT ALL ON conversations TO service_role;
GRANT ALL ON messages TO service_role;
GRANT ALL ON documents TO service_role;
GRANT ALL ON knowledge_base TO service_role;
GRANT ALL ON processing_queue TO service_role;
GRANT ALL ON security_logs TO service_role;
GRANT ALL ON security_events TO service_role;
GRANT ALL ON rate_limits TO service_role;
GRANT ALL ON user_sessions TO service_role;
GRANT ALL ON user_state TO service_role;
GRANT ALL ON system_memory TO service_role;
GRANT ALL ON user_feedback TO service_role;
GRANT ALL ON decision_log TO service_role;
GRANT ALL ON user_subscriptions TO service_role;

-- Grant function permissions
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

-- =============================================
-- ADDITIONAL SETUP: Enable Realtime
-- =============================================

-- Enable realtime for important tables
ALTER PUBLICATION supabase_realtime ADD TABLE documents;