import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Search, User } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface UserData {
  id: string;
  email: string;
  createdAt: string;
  plan: 'free' | 'pro';
  creditsUsed: number;
  creditsMax: number;
  role: string;
}

interface UserRole {
  user_id: string;
  role: string;
  email: string | null;
  created_at_user: string | null;
}

interface UserSubscription {
  user_id: string;
  plan: string;
  credits_remaining: number;
  credits_max: number;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // Fetch all users from user_roles table with their subscription info
        const { data: userRolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role, email, created_at_user');

        if (rolesError) {
          console.error('Error fetching user roles:', rolesError);
          toast.error('Failed to load users');
          return;
        }

        if (!userRolesData) {
          setUsers([]);
          return;
        }

        // Fetch subscription data for all users
        const { data: subscriptionsData, error: subsError } = await supabase
          .from('user_subscriptions')
          .select('user_id, plan, credits_remaining, credits_max');

        if (subsError) {
          console.error('Error fetching subscriptions:', subsError);
        }

        // Create a map of user subscriptions
        const subscriptionsMap = new Map(
          (subscriptionsData || []).map(sub => [sub.user_id, sub])
        );

        // Combine the data
        const formattedUsers: UserData[] = userRolesData.map(userRole => {
          const subscription: UserSubscription | undefined = subscriptionsMap.get(userRole.user_id);
          const creditsMax = subscription?.credits_max || 50;
          const creditsRemaining = subscription?.credits_remaining || 50;
          
          return {
            id: userRole.user_id,
            email: userRole.email || 'Unknown',
            createdAt: userRole.created_at_user || new Date().toISOString(),
            plan: (subscription?.plan || 'free') as 'free' | 'pro',
            creditsUsed: creditsMax - creditsRemaining,
            creditsMax: creditsMax,
            role: userRole.role,
          };
        });

        setUsers(formattedUsers);
      } catch (error) {
        console.error('Unexpected error fetching users:', error);
        toast.error('Failed to load users');
      } finally {
        setIsLoading(false);
      }
    };

    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ResponsiveLayout showSidebar={false}>
      <div className="h-full flex flex-col">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50 px-4 lg:px-6 py-3 flex-shrink-0">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin")}
                className="transition-smooth hover:scale-102 active:scale-98"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Admin
              </Button>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                User Management
              </h1>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-6 lg:py-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Users ({filteredUsers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            {user.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            user.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            user.plan === 'pro' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-muted rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full" 
                                style={{ width: `${(user.creditsUsed / user.creditsMax) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {user.creditsMax - user.creditsUsed}/{user.creditsMax}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  );
}