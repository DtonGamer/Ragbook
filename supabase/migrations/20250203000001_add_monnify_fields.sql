-- Add Monnify fields and remove Paystack fields from user_subscriptions table
-- First add the new Monnify columns
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS monnify_contract_code TEXT;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS monnify_customer_email TEXT;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS monnify_customer_name TEXT;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS monnify_transaction_reference TEXT;

-- Update RLS policies if needed for the new columns
-- No special handling needed as the new columns will be managed by the existing policies

-- Create indexes for the new Monnify columns for better query performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_monnify_contract_code ON user_subscriptions(monnify_contract_code);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_monnify_transaction_ref ON user_subscriptions(monnify_transaction_reference);

-- Remove the Paystack columns (keeping data migration in case we need to rollback)
-- COMMENT: We'll temporarily rename the Paystack columns to preserve any existing data
-- ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS paystack_subscription_id;
-- ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS paystack_customer_code;

-- Instead, we'll rename them with a _deprecated suffix for now to preserve data
ALTER TABLE user_subscriptions RENAME COLUMN paystack_subscription_id TO paystack_subscription_id_deprecated;
ALTER TABLE user_subscriptions RENAME COLUMN paystack_customer_code TO paystack_customer_code_deprecated;