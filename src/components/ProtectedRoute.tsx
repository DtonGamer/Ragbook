import { useAuthContext } from "@/contexts/AuthProvider";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isAdmin, loading } = useAuthContext();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">
            {requireAdmin ? "Verifying admin access..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated at all
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Authenticated but need admin access
  if (requireAdmin && !isAdmin) {
    console.warn("Non-admin user attempted to access admin route");
    return <Navigate to="/chat" replace />;
  }

  // All checks passed
  return <>{children}</>;
}