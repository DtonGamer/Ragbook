-- Triggers and Row Level Security (RLS) policies
-- These ensure data integrity and security for the RAG chatbot application

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