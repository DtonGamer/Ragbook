-- RLS Policy Fix Migration
-- This script fixes the circular dependency issue in user_roles table and resolves 500 errors

-- Step 1: Temporarily disable RLS on user_roles table to prevent circular dependency issues
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop the existing is_admin function that's causing the parameter name conflict
DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- Step 3: Create the new is_admin function with proper SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_admin(input_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles 
    WHERE user_id = input_user_id 
    AND role = 'admin'
  );
$$;

-- Step 4: Grant proper permissions to the function
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

-- Step 5: Drop all existing policies that may reference the old function
DROP POLICY IF EXISTS "Users manage own conversations" ON conversations;
DROP POLICY IF EXISTS "System insert decision logs" ON decision_log;
DROP POLICY IF EXISTS "System manage decision logs" ON decision_log;
DROP POLICY IF EXISTS "Users view own decision logs" ON decision_log;
DROP POLICY IF EXISTS "Users manage own documents" ON documents;
DROP POLICY IF EXISTS "System insert knowledge base" ON knowledge_base;
DROP POLICY IF EXISTS "Users manage knowledge base via documents" ON knowledge_base;
DROP POLICY IF EXISTS "Users manage messages in own conversations" ON messages;
DROP POLICY IF EXISTS "Service role has full access" ON processing_queue;
DROP POLICY IF EXISTS "Users can manage own queue items" ON processing_queue;
DROP POLICY IF EXISTS "Service role can manage rate limits" ON rate_limits;
DROP POLICY IF EXISTS "Service role can manage security events" ON security_events;
DROP POLICY IF EXISTS "Service role can manage security logs" ON security_logs;
DROP POLICY IF EXISTS "Users manage own system memory" ON system_memory;
DROP POLICY IF EXISTS "Users manage own feedback" ON user_feedback;
DROP POLICY IF EXISTS "Admins manage user roles" ON user_roles;
DROP POLICY IF EXISTS "System insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Service role can manage all sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users manage own state" ON user_state;
DROP POLICY IF EXISTS "System insert subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users manage own subscription" ON user_subscriptions;

-- Step 6: Re-enable RLS on user_roles table now that function is updated
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Step 7: Create new policies for all tables with proper admin access patterns

-- CONVERSATIONS
CREATE POLICY "Users manage own conversations"
ON conversations FOR ALL
TO authenticated
USING ((auth.uid() = user_id) OR public.is_admin(auth.uid()))
WITH CHECK ((auth.uid() = user_id) OR public.is_admin(auth.uid()));

-- DECISION_LOG
CREATE POLICY "System insert decision logs"
ON decision_log FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "System manage decision logs"
ON decision_log FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users view own decision logs"
ON decision_log FOR SELECT
TO authenticated
USING ((auth.uid() = user_id) OR public.is_admin(auth.uid()));

-- DOCUMENTS
CREATE POLICY "Users manage own documents"
ON documents FOR ALL
TO authenticated
USING ((auth.uid() = user_id) OR public.is_admin(auth.uid()))
WITH CHECK ((auth.uid() = user_id) OR public.is_admin(auth.uid()));

-- KNOWLEDGE_BASE
CREATE POLICY "System insert knowledge base"
ON knowledge_base FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Users manage knowledge base via documents"
ON knowledge_base FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM documents d
    WHERE d.id = knowledge_base.document_id
    AND ((d.user_id = auth.uid()) OR public.is_admin(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM documents d
    WHERE d.id = knowledge_base.document_id
    AND ((d.user_id = auth.uid()) OR public.is_admin(auth.uid()))
  )
);

-- MESSAGES
CREATE POLICY "Users manage messages in own conversations"
ON messages FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM conversations c
    WHERE c.id = messages.conversation_id
    AND ((c.user_id = auth.uid()) OR public.is_admin(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM conversations c
    WHERE c.id = messages.conversation_id
    AND ((c.user_id = auth.uid()) OR public.is_admin(auth.uid()))
  )
);

-- PROCESSING_QUEUE
CREATE POLICY "Service role has full access"
ON processing_queue FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can manage own queue items"
ON processing_queue FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RATE_LIMITS
CREATE POLICY "Service role can manage rate limits"
ON rate_limits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- SECURITY_EVENTS
CREATE POLICY "Service role can manage security events"
ON security_events FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- SECURITY_LOGS
CREATE POLICY "Service role can manage security logs"
ON security_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- SYSTEM_MEMORY
CREATE POLICY "Users manage own system memory"
ON system_memory FOR ALL
TO authenticated
USING ((auth.uid() = user_id) OR public.is_admin(auth.uid()))
WITH CHECK ((auth.uid() = user_id) OR public.is_admin(auth.uid()));

-- USER_FEEDBACK
CREATE POLICY "Users manage own feedback"
ON user_feedback FOR ALL
TO authenticated
USING ((auth.uid() = user_id) OR public.is_admin(auth.uid()))
WITH CHECK ((auth.uid() = user_id) OR public.is_admin(auth.uid()));

-- USER_ROLES (Fixed to prevent circular dependency)
-- First, allow users to view their own roles without checking admin status
CREATE POLICY "Users can view own roles" 
ON user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow service role to manage user roles (for system inserts)
CREATE POLICY "Service role manage user roles"
ON user_roles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert their own roles (initial creation)
CREATE POLICY "Users can insert own roles"
ON user_roles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- USER_SESSIONS
CREATE POLICY "Service role can manage all sessions"
ON user_sessions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- USER_STATE
CREATE POLICY "Users manage own state"
ON user_state FOR ALL
TO authenticated
USING ((auth.uid() = user_id) OR public.is_admin(auth.uid()))
WITH CHECK ((auth.uid() = user_id) OR public.is_admin(auth.uid()));

-- USER_SUBSCRIPTIONS
CREATE POLICY "System insert subscriptions"
ON user_subscriptions FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Users manage own subscription"
ON user_subscriptions FOR ALL
TO authenticated
USING ((auth.uid() = user_id) OR public.is_admin(auth.uid()))
WITH CHECK ((auth.uid() = user_id) OR public.is_admin(auth.uid()));

-- Final verification queries to test the setup
-- These can be run after applying the migration to verify everything works

-- Test the is_admin function (replace 'your_user_id' with an actual user UUID to test)
-- SELECT public.is_admin('your_user_id');

-- Verify policies are in place
-- SELECT schemaname, tablename, policyname, roles, cmd 
-- FROM pg_policies 
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Check for any remaining permissive policies
-- SELECT schemaname, tablename, policyname, permissive 
-- FROM pg_policies 
-- WHERE permissive = 'PERMISSIVE'
-- AND schemaname = 'public';