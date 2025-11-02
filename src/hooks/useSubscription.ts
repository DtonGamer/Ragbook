import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'free' | 'pro';
  credits_remaining: number;
  credits_max: number;
  last_refresh_date: string;
  subscription_end_date: string | null;
  paystack_subscription_id: string | null;
  paystack_customer_code: string | null;
  created_at: string;
  updated_at: string;
}

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: subscription, isLoading, error, refetch } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching subscription:', error);
        throw error;
      }

      return data as Subscription;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const isPro = subscription?.plan === 'pro';
  const creditsLeft = subscription?.credits_remaining || 0;
  const creditsMax = subscription?.credits_max || 50;
  const creditsPercentage = creditsMax > 0 ? (creditsLeft / creditsMax) * 100 : 0;

  const refreshSubscription = async () => {
    await refetch();
  };

  const invalidateSubscription = () => {
    queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] });
  };

  return {
    subscription,
    isLoading,
    error,
    isPro,
    creditsLeft,
    creditsMax,
    creditsPercentage,
    refreshSubscription,
    invalidateSubscription,
  };
}
