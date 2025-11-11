import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useAuthContext } from "@/contexts/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CreditCard, TrendingUp, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Subscription {
  id: string;
  email: string;
  plan: string;
  credits_remaining: number;
  credits_max: number;
  status: string;
  created_at: string;
  updated_at: string;
  subscription_end_date: string | null;
}

interface UserSubscription {
  id: string;
  user_id: string;
  plan: string;
  credits_remaining: number;
  credits_max: number;
  status: string;
  created_at: string;
  updated_at: string;
  subscription_end_date: string | null;
}

interface UserRole {
  user_id: string;
  email: string | null;
}



export default function AdminBilling() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuthContext();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [revenueStats, setRevenueStats] = useState({
    totalRevenue: 0,
    activeSubscriptions: 0,
    cancelledSubscriptions: 0,
    pendingPayments: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBillingData = async () => {
      try {
        // Fetch all user subscriptions
        const { data: subscriptionsData, error: subscriptionsError } = await supabase
          .from('user_subscriptions')
          .select(`
            id,
            user_id,
            plan,
            credits_remaining,
            credits_max,
            status,
            created_at,
            updated_at,
            subscription_end_date
          `)
          .order('created_at', { ascending: false });

        if (subscriptionsError) {
          console.error('Error fetching subscriptions:', subscriptionsError);
          toast.error('Failed to load billing data');
          return;
        }

        // Fetch user emails from user_roles table
        const userIds = (subscriptionsData || []).map(sub => sub.user_id);
        const { data: userRoles, error: userError } = await supabase
          .from('user_roles')
          .select('user_id, email')
          .in('user_id', userIds);

        if (userError) {
          console.error('Error fetching user emails:', userError);
        }

        // Create a map of user emails
        const userEmailMap = new Map(
          (userRoles || []).map(ur => [ur.user_id, ur.email])
        );

        // Fetch pricing plans to calculate revenue based on plan prices
        const { data: pricingPlans, error: pricingError } = await supabase
          .from('pricing_plans')
          .select('id, name, price_kobo');

        if (pricingError) {
          console.error('Error fetching pricing plans:', pricingError);
        }

        // Calculate revenue stats based on plan prices
        let totalRevenue = 0;
        let activeSubscriptions = 0;
        let cancelledSubscriptions = 0;
        let pendingPayments = 0;

        if (subscriptionsData && pricingPlans) {
          // Create a map of plan prices
          const planPriceMap = new Map(
            pricingPlans.map(plan => [plan.name.toLowerCase(), plan.price_kobo])
          );

          // Calculate total revenue from active paid subscriptions
          totalRevenue = subscriptionsData
            .filter(sub => (sub.status === 'active' || sub.status === 'trialing') && sub.plan !== 'free')
            .reduce((sum, sub) => {
              const price = planPriceMap.get(sub.plan.toLowerCase());
              return sum + (price || 0);
            }, 0);

          activeSubscriptions = subscriptionsData.filter(sub => sub.status === 'active').length;
          cancelledSubscriptions = subscriptionsData.filter(sub => sub.status === 'cancelled').length;
          pendingPayments = subscriptionsData.filter(sub => sub.status === 'pending').length;
        }

        if (subscriptionsData) {
          const formattedSubscriptions = (subscriptionsData as UserSubscription[]).map(sub => ({
            id: sub.id,
            email: userEmailMap.get(sub.user_id) || 'Unknown User',
            plan: sub.plan,
            credits_remaining: sub.credits_remaining,
            credits_max: sub.credits_max,
            status: sub.status,
            created_at: sub.created_at,
            updated_at: sub.updated_at,
            subscription_end_date: sub.subscription_end_date,
          }));

          setSubscriptions(formattedSubscriptions);
        }

        setRevenueStats({
          totalRevenue,
          activeSubscriptions,
          cancelledSubscriptions,
          pendingPayments
        });

      } catch (error) {
        console.error('Unexpected error fetching billing data:', error);
        toast.error('Failed to load billing data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBillingData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
      case 'canceled':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'trialing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
                onClick={() => navigate("/admin")}
                className="transition-smooth hover:scale-102 active:scale-98"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Admin
              </Button>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Billing Overview
              </h1>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-6 lg:py-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {/* Revenue Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-bold">₦{revenueStats.totalRevenue.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-primary/10">
                      <CreditCard className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Subscriptions</p>
                      <p className="text-2xl font-bold">{revenueStats.activeSubscriptions}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-green-100">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Cancelled Subscriptions</p>
                      <p className="text-2xl font-bold">{revenueStats.cancelledSubscriptions}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-100">
                      <TrendingDown className="w-6 h-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Pending Payments</p>
                      <p className="text-2xl font-bold">{revenueStats.pendingPayments}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-yellow-100">
                      <CreditCard className="w-6 h-6 text-yellow-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Subscriptions Table */}
            <Card>
              <CardHeader>
                <CardTitle>Subscriptions ({subscriptions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell className="font-medium">
                            {sub.email}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{sub.plan.toUpperCase()}</Badge>
                          </TableCell>
                          <TableCell>
                            {sub.credits_remaining} / {sub.credits_max}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(sub.status)}`}>
                              {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {formatDate(sub.created_at)}
                          </TableCell>
                          <TableCell>
                            {sub.subscription_end_date ? formatDate(sub.subscription_end_date) : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  );
}