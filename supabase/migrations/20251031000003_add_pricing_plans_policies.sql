-- Add policies for pricing_plans table to allow public read access
-- Since pricing information is generally safe to be public, we allow read access without authentication

-- Enable RLS on pricing_plans table
ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access to pricing plans
CREATE POLICY "Allow read access to pricing plans for all users" ON pricing_plans
FOR SELECT TO authenticated, anon
USING (true);

-- Optional: If you want to restrict access to specific roles only, you can use this policy instead:
-- CREATE POLICY "Allow read access to pricing plans for all users" ON pricing_plans
-- FOR SELECT TO authenticated, anon
-- USING (auth.role() = 'authenticated');