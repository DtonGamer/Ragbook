-- Create the complete schema for the RAG chatbot application
-- This includes all tables, functions, indexes, RLS policies, and triggers

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