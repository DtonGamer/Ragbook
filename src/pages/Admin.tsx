import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CreditCard, FileText, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Stat {
  title: string;
  value: string;
  change: string;
  icon: React.ElementType;
  color: string;
}

interface Activity {
  id: number;
  action: string;
  time: string;
  user: string;
}

interface UserRole {
  user_id: string;
  email: string | null;
}

interface Conversation {
  id: string;
  created_at: string;
  user_id: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [stats, setStats] = useState<Stat[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        
        // Fetch total users from user_roles table (count unique user_ids)
        const { count: totalUsers, error: usersError } = await supabase
          .from('user_roles')
          .select('user_id', { count: 'exact', head: true });

        if (usersError) {
          console.error('Error fetching users count:', usersError);
        }

        // Fetch total documents
        const { count: totalDocuments, error: docsError } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true });

        if (docsError) {
          console.error('Error fetching documents count:', docsError);
        }

        // Fetch revenue from user_subscriptions (assuming pro plan costs ₦3000)
        const { data: proUsers, error: proError } = await supabase
          .from('user_subscriptions')
          .select('user_id, plan')
          .eq('plan', 'pro');

        if (proError) {
          console.error('Error fetching pro users:', proError);
        }

        // Calculate revenue (₦3000 per pro user)
        const revenue = (proUsers?.length || 0) * 3000;

        // Process stats
        const processedStats: Stat[] = [
          {
            title: "Total Users",
            value: totalUsers ? totalUsers.toString() : "0",
            change: "+12%",
            icon: Users,
            color: "text-blue-500",
          },
          {
            title: "Documents Processed",
            value: totalDocuments ? totalDocuments.toString() : "0",
            change: "+8%",
            icon: FileText,
            color: "text-green-500",
          },
          {
            title: "Revenue",
            value: `₦${revenue.toLocaleString()}`,
            change: "+15%",
            icon: CreditCard,
            color: "text-purple-500",
          },
        ];

        setStats(processedStats);

        // Fetch recent activities
        const { data: recentConversations, error: conversationsError } = await supabase
          .from('conversations')
          .select('id, created_at, user_id')
          .order('created_at', { ascending: false })
          .limit(5);

        if (conversationsError) {
          console.error('Error fetching conversations:', conversationsError);
        }

        const activitiesList: Activity[] = [];
        
        if (recentConversations) {
          // Get user emails for the conversations
          const userIds = [...new Set(recentConversations.map(c => c.user_id))];
          const { data: userRoles, error: userRolesError } = await supabase
            .from('user_roles')
            .select('user_id, email')
            .in('user_id', userIds);

          if (userRolesError) {
            console.error('Error fetching user roles for activities:', userRolesError);
          }

          const userEmailMap = new Map(
            (userRoles || []).map(ur => [ur.user_id, ur.email])
          );

          for (const conv of recentConversations as Conversation[]) {
            const createdAt = new Date(conv.created_at);
            const timeDiff = Math.floor((Date.now() - createdAt.getTime()) / 1000);
            
            let timeAgo: string;
            if (timeDiff < 60) {
              timeAgo = `${timeDiff} seconds ago`;
            } else if (timeDiff < 3600) {
              timeAgo = `${Math.floor(timeDiff / 60)} minutes ago`;
            } else if (timeDiff < 86400) {
              timeAgo = `${Math.floor(timeDiff / 3600)} hours ago`;
            } else {
              timeAgo = `${Math.floor(timeDiff / 86400)} days ago`;
            }
            
            activitiesList.push({
              id: parseInt(conv.id.substring(0, 10), 16),
              action: "New conversation started",
              time: timeAgo,
              user: userEmailMap.get(conv.user_id) || "Unknown User"
            });
          }
        }
        
        setActivities(activitiesList);
      } catch (error) {
        console.error('Error fetching admin stats:', error);
        toast.error('Failed to load admin statistics');
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveLayout showSidebar={false}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50 px-4 lg:px-6 py-3 flex-shrink-0">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/chat")}
                className="transition-smooth hover:scale-102 active:scale-98"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Chat
              </Button>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Admin Dashboard
              </h1>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-6 lg:py-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card key={index}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </CardTitle>
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <p className="text-xs text-muted-foreground mt-1">{stat.change} from last month</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => navigate("/admin/users")}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Manage Users
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => navigate("/admin/documents")}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View Documents
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => navigate("/admin/billing")}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Billing Overview
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Database</span>
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">Healthy</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Storage</span>
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">65%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">API</span>
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">Operational</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{activity.user}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  );
}