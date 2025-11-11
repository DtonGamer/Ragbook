import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthProvider";

export function useDocumentStatus() {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    // Subscribe to realtime updates for documents table
    const channel = supabase
      .channel('document-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Document status changed:', payload);
          
          // Invalidate documents query to refetch
          queryClient.invalidateQueries({ queryKey: ['documents'] });
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}
