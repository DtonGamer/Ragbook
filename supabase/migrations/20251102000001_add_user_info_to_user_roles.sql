-- Add email and other information to the user_roles table
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS created_at_user TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS pro_credits_used INTEGER DEFAULT 0;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS pro_credits_max INTEGER DEFAULT 50;

-- Create or replace the function to handle new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Insert a 'user' role entry for the new user
  INSERT INTO user_roles (user_id, role, email, created_at_user)
  VALUES (NEW.id, 'user', NEW.email, NEW.created_at)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create the trigger on auth.users if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update the RLS policy for the user_roles table to allow admins to see all users
DROP POLICY IF EXISTS "Admins can view all user roles" ON user_roles;
CREATE POLICY "Admins can view all user roles" ON user_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur_admin
      WHERE ur_admin.user_id = (SELECT auth.uid())
      AND ur_admin.role = 'admin'
    )
  );

-- Add a policy to allow admins to update user roles
CREATE POLICY "Admins can update user roles" ON user_roles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur_admin
      WHERE ur_admin.user_id = (SELECT auth.uid())
      AND ur_admin.role = 'admin'
    )
  );