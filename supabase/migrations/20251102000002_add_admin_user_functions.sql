-- Create functions to get user information for admin purposes

-- Function to get user emails for admin dashboard
CREATE OR REPLACE FUNCTION public.get_user_email(user_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- Check if user is an admin
    IF NOT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = (SELECT auth.uid())
        AND user_roles.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;

    -- Get user email
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = user_id_param;

    RETURN user_email;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_email TO authenticated;