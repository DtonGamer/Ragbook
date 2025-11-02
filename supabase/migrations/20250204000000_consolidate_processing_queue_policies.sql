-- Consolidate multiple permissive policies on processing_queue table
-- This migration fixes the redundant policies identified by the Supabase linter

-- First, drop all existing policies on the processing_queue table
DROP POLICY IF EXISTS "Users can view own queue items" ON processing_queue;
DROP POLICY IF EXISTS "Users can create own queue items" ON processing_queue;
DROP POLICY IF EXISTS "Service role has full access" ON processing_queue;
DROP POLICY IF EXISTS "Service role and users can view queue" ON processing_queue;
DROP POLICY IF EXISTS "Users can create queue items" ON processing_queue;

-- Create consolidated, optimized policies for the processing_queue table

-- Policy for authenticated users: can view and create their own queue items
CREATE POLICY "Users can manage own queue items" ON processing_queue
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy for service role: full access to all queue items
CREATE POLICY "Service role has full access" ON processing_queue
    FOR ALL TO service_role
    USING (true);

-- Policy for anon role: can create and view their own queue items (if needed)
-- Note: This might be too permissive depending on your use case, so we'll only add if necessary
-- For now, only authenticated users and service role have access

-- Grant appropriate permissions to roles
GRANT SELECT, INSERT, UPDATE, DELETE ON processing_queue TO authenticated;
GRANT ALL ON processing_queue TO service_role;