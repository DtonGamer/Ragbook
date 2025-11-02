-- Create pricing plans table to store subscription plans and their features

-- Create pricing_plans table
CREATE TABLE IF NOT EXISTS pricing_plans (
  id TEXT PRIMARY KEY, -- e.g., 'free', 'pro'
  name TEXT NOT NULL,
  price_kobo INTEGER NOT NULL DEFAULT 0, -- price in kobo (smallest currency unit)
  currency TEXT NOT NULL DEFAULT 'NGN', -- currency code
  credits INTEGER NOT NULL DEFAULT 0,
  credits_frequency TEXT DEFAULT 'one-time', -- e.g., 'month', 'one-time'
  max_file_size TEXT NOT NULL DEFAULT '10 MB', -- e.g., '10 MB', '50 MB'
  processing_queue TEXT NOT NULL DEFAULT 'standard', -- e.g., 'standard', 'priority'
  features TEXT[] NOT NULL DEFAULT '{}', -- array of feature strings
  icon TEXT DEFAULT 'zap', -- e.g., 'zap', 'crown'
  recommended BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial pricing plans matching the current hardcoded config
INSERT INTO pricing_plans (id, name, price_kobo, currency, credits, credits_frequency, max_file_size, processing_queue, features, icon, recommended) 
VALUES 
  ('free', 'Free', 0, 'NGN', 50, 'one-time', '10 MB', 'standard', 
   ARRAY['Digital PDF processing', 'Standard processing queue', 'Community support'], 
   'zap', false),
  ('pro', 'Pro', 300000, 'NGN', 1000, 'month', '50 MB', 'priority', 
   ARRAY['Digital + Scanned PDF (OCR)', 'Priority processing queue', 'Advanced OCR (multi-language)', 'All future features included', 'Priority email support (24h)'], 
   'crown', true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to pricing_plans table
CREATE TRIGGER update_pricing_plans_updated_at 
    BEFORE UPDATE ON pricing_plans 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pricing_plans_recommended ON pricing_plans(recommended);
CREATE INDEX IF NOT EXISTS idx_pricing_plans_price ON pricing_plans(price_kobo);