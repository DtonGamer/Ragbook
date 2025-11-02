-- Final review and optimization of RLS policies
-- Ensures all tables have properly optimized, non-redundant policies

-- Review and optimize conversations table policies
-- (These look properly configured already, but let's ensure proper structure)
DROP POLICY IF EXISTS "Users can view conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete conversations" ON conversations;

CREATE POLICY "Users manage own conversations" ON conversations
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ))
    WITH CHECK (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ));

-- Review and optimize documents table policies
DROP POLICY IF EXISTS "Users can view own documents" ON documents;
DROP POLICY IF EXISTS "Users can create own documents" ON documents;
DROP POLICY IF EXISTS "Users can update own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;

CREATE POLICY "Users manage own documents" ON documents
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ))
    WITH CHECK (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ));

-- Review and optimize knowledge_base table policies
DROP POLICY IF EXISTS "System can insert knowledge base entries" ON knowledge_base;
DROP POLICY IF EXISTS "Users and admins can view knowledge base" ON knowledge_base;
DROP POLICY IF EXISTS "Users and admins can delete knowledge base" ON knowledge_base;

CREATE POLICY "System insert knowledge base" ON knowledge_base
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY "Users manage knowledge base via documents" ON knowledge_base
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM documents d
        WHERE d.id = knowledge_base.document_id AND 
        (d.user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        ))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM documents d
        WHERE d.id = knowledge_base.document_id AND 
        (d.user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        ))
    ));

-- Review and optimize messages table policies
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can view messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their messages" ON messages;
DROP POLICY IF EXISTS "Users can update their messages" ON messages;

CREATE POLICY "Users manage messages in own conversations" ON messages
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = messages.conversation_id AND 
        (c.user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        ))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = messages.conversation_id AND 
        (c.user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        ))
    ));

-- Review and optimize decision_log table policies
DROP POLICY IF EXISTS "System can create decision logs" ON decision_log;
DROP POLICY IF EXISTS "Users and admins can view decisions" ON decision_log;

CREATE POLICY "System insert decision logs" ON decision_log
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY "Users view own decision logs" ON decision_log
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    ));

CREATE POLICY "System manage decision logs" ON decision_log
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Review and optimize system_memory table policies
DROP POLICY IF EXISTS "Users can insert their own system memory" ON system_memory;
DROP POLICY IF EXISTS "Users can view their own system memory" ON system_memory;
DROP POLICY IF EXISTS "Users can update their own system memory" ON system_memory;
DROP POLICY IF EXISTS "Users can delete their own system memory" ON system_memory;

CREATE POLICY "Users manage own system memory" ON system_memory
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    ))
    WITH CHECK (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    ));

-- Review and optimize user_feedback table policies
DROP POLICY IF EXISTS "Users can insert their own feedback" ON user_feedback;
DROP POLICY IF EXISTS "Users and admins can view feedback" ON user_feedback;
DROP POLICY IF EXISTS "Users can update their own feedback" ON user_feedback;

CREATE POLICY "Users manage own feedback" ON user_feedback
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    ))
    WITH CHECK (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    ));

-- Review and optimize user_roles table policies
DROP POLICY IF EXISTS "System can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;

CREATE POLICY "System insert user roles" ON user_roles
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY "Admins manage user roles" ON user_roles
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    ));

-- Review and optimize user_state table policies
DROP POLICY IF EXISTS "Users can insert their own state" ON user_state;
DROP POLICY IF EXISTS "Users and admins can view user state" ON user_state;
DROP POLICY IF EXISTS "Users can update their own state" ON user_state;

CREATE POLICY "Users manage own state" ON user_state
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    ))
    WITH CHECK (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    ));

-- Review and optimize user_subscriptions table policies
DROP POLICY IF EXISTS "System can insert subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users and admins can view subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users and admins can update subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Admins can delete subscriptions" ON user_subscriptions;

CREATE POLICY "System insert subscriptions" ON user_subscriptions
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY "Users manage own subscription" ON user_subscriptions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    ))
    WITH CHECK (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    ));

-- Grant appropriate permissions to roles for all tables
GRANT ALL ON conversations TO authenticated, service_role;
GRANT ALL ON documents TO authenticated, service_role;
GRANT ALL ON knowledge_base TO authenticated, service_role;
GRANT ALL ON messages TO authenticated, service_role;
GRANT ALL ON decision_log TO authenticated, service_role;
GRANT ALL ON system_memory TO authenticated, service_role;
GRANT ALL ON user_feedback TO authenticated, service_role;
GRANT ALL ON user_roles TO authenticated, service_role;
GRANT ALL ON user_state TO authenticated, service_role;
GRANT ALL ON user_subscriptions TO authenticated, service_role;
GRANT ALL ON security_events TO authenticated, service_role;
GRANT ALL ON security_logs TO authenticated, service_role;
GRANT ALL ON user_sessions TO authenticated, service_role;
GRANT ALL ON processing_queue TO authenticated, service_role;