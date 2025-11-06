-- Simplify user_state table and remove decision system
-- This removes trust_level, intent_patterns, preferences, and other columns from user_state
-- and removes the decision_log table entirely

-- Remove columns from user_state table
ALTER TABLE user_state 
DROP COLUMN IF EXISTS trust_level,
DROP COLUMN IF EXISTS intent_patterns,
DROP COLUMN IF EXISTS emotional_state,
DROP COLUMN IF EXISTS attention_focus,
DROP COLUMN IF EXISTS interaction_style,
DROP COLUMN IF EXISTS preferences;

-- Set up updated_at to default to current timestamp
ALTER TABLE user_state 
ALTER COLUMN updated_at SET DEFAULT NOW();

-- Add last_active_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_state' AND column_name = 'last_active_at') THEN
        ALTER TABLE user_state ADD COLUMN last_active_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END
$$;

-- Remove decision_log table entirely
DROP TABLE IF EXISTS decision_log CASCADE;

-- Remove unused RPC functions
DROP FUNCTION IF EXISTS should_yield_control(UUID);
DROP FUNCTION IF EXISTS log_decision(UUID, UUID, UUID, JSONB, DECIMAL, TEXT[], TEXT);
DROP FUNCTION IF EXISTS update_user_state(UUID, JSONB);
DROP FUNCTION IF EXISTS get_or_create_user_state(UUID);

-- Update the user_state table to have a simpler structure
-- The table will now only have user_id, last_active_at, created_at, and updated_at