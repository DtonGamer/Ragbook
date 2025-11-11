import { createContext, useContext } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { UseAuthReturn } from '@/hooks/useAuth';

const AuthContext = createContext<UseAuthReturn | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const auth = useAuth(); // Only ONE instance of the useAuth hook
  
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};