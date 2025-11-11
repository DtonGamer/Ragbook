import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
}

export interface UseAuthReturn extends AuthState {
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  checkAdminStatus: () => Promise<void>;
}

// Session timeout configuration (30 minutes)
const SESSION_TIMEOUT_MS = 50 * 60 * 1000;
const REFRESH_THRESHOLD_MS = 10 * 60 * 1000; // Refresh 10 minutes before expiry

export const useAuth = (): UseAuthReturn => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    isAdmin: false,
  });

  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  // Check if session is expired
  const isSessionExpired = useCallback((session: Session | null): boolean => {
    if (!session) return true;
    
    const now = Date.now();
    const expiresAt = session.expires_at ? session.expires_at * 1000 : now + SESSION_TIMEOUT_MS;
    const timeSinceActivity = now - lastActivity;
    
    return timeSinceActivity > SESSION_TIMEOUT_MS || now >= expiresAt;
  }, [lastActivity]);

  // Refresh session if needed
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh failed:', error);
        if (error.message.includes('refresh_token_not_found') || 
            error.message.includes('invalid_grant')) {
          // Refresh token is invalid, clear state without calling signOut to avoid circular dependency
          setAuthState({
            user: null,
            session: null,
            loading: false,
            isAdmin: false,
          });
          setLastActivity(Date.now());
          toast.error('Session expired. Please sign in again.');
          return;
        }
        throw error;
      }

      if (session) {
        setAuthState(prev => ({ ...prev, session }));
        setLastActivity(Date.now());
        console.log('Session refreshed successfully');
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
      // Clear state without calling signOut to avoid circular dependency
      setAuthState({
        user: null,
        session: null,
        loading: false,
        isAdmin: false,
      });
      setLastActivity(Date.now());
      toast.error('Session expired. Please sign in again.');
    }
  }, []);

  // Check admin status
  const checkAdminStatus = useCallback(async (): Promise<void> => {
    if (!authState.user) {
      setAuthState(prev => ({ ...prev, isAdmin: false }));
      return;
    }

    try {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authState.user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        console.error('Error checking admin status:', error);
        setAuthState(prev => ({ ...prev, isAdmin: false }));
        return;
      }

      setAuthState(prev => ({ ...prev, isAdmin: !!roles }));
    } catch (error) {
      console.error('Failed to check admin status:', error);
      setAuthState(prev => ({ ...prev, isAdmin: false }));
    }
  }, [authState.user]);

  // Sign out function
  const signOut = useCallback(async (): Promise<void> => {
    try {
      // Clear timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
        setTimeoutId(null);
      }

      // Sign out from Supabase (local scope avoids 403 from global logout endpoint)
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        console.error('Sign out error:', error);
      }

      // Reset state
      setAuthState({
        user: null,
        session: null,
        loading: false,
        isAdmin: false,
      });
      setLastActivity(Date.now());
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  }, [timeoutId]);



  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          if (mounted) {
            setAuthState(prev => ({ ...prev, loading: false }));
          }
          return;
        }

        if (mounted) {
          setAuthState(prev => ({
            ...prev,
            user: session?.user || null,
            session,
            loading: false,
          }));
          setLastActivity(Date.now());
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        if (mounted) {
          setAuthState(prev => ({ ...prev, loading: false }));
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

       console.log('Auth state changed:', event, session?.user?.id, new Date().toISOString());
console.trace(); // This will show you the call stack
        
        // Handle sign out events properly
        if (event === 'SIGNED_OUT') {
          setAuthState({
            user: null,
            session: null,
            loading: false,
            isAdmin: false,
          });
          setLastActivity(Date.now());
          return;
        }
        
        setAuthState(prev => ({
          ...prev,
          user: session?.user || null,
          session,
        }));

        if (session) {
          setLastActivity(Date.now());
        } else {
          setAuthState(prev => ({ ...prev, isAdmin: false }));
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Set up session management when session changes
  useEffect(() => {
    if (!authState.session) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        setTimeoutId(null);
      }
      return;
    }

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set up session timeout
    const timeout = setTimeout(async () => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;
      const expiresAt = authState.session?.expires_at 
        ? authState.session.expires_at * 1000 
        : now + SESSION_TIMEOUT_MS;
      
      if (timeSinceActivity > SESSION_TIMEOUT_MS || now >= expiresAt) {
        console.log('Session expired due to inactivity');
        toast.error('Session expired due to inactivity. Please sign in again.');
        // Don't automatically sign out - let user explicitly sign out or refresh session
        // const { error } = await supabase.auth.signOut();
        // if (error) {
        //   console.error('Sign out error:', error);
        // }
      }
    }, SESSION_TIMEOUT_MS);

    setTimeoutId(timeout);

    // Set up automatic refresh
    const refreshInterval = setInterval(async () => {
      const now = Date.now();
      const expiresAt = authState.session?.expires_at 
        ? authState.session.expires_at * 1000 
        : now + SESSION_TIMEOUT_MS;
      const timeUntilExpiry = expiresAt - now;

      if (timeUntilExpiry <= REFRESH_THRESHOLD_MS) {
        await refreshSession();
      }
    }, 60000);

    return () => {
      clearTimeout(timeout);
      clearInterval(refreshInterval);
    };
  }, [authState.session, lastActivity, refreshSession]);

  // Check admin status when user changes
  useEffect(() => {
    if (authState.user) {
      checkAdminStatus();
    }
  }, [authState.user, checkAdminStatus]);

  // Set up activity tracking
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      updateActivity();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [updateActivity]);

  return {
    ...authState,
    signOut,
    refreshSession,
    checkAdminStatus,
  };
};