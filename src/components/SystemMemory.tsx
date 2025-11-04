import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

// ✅ SHOW ONLY LAST ACTIVE TIME
export function SystemMemory({ userId }) {
  const [lastActive, setLastActive] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchLastActive = async () => {
      const { data } = await supabase
        .from('user_state')
        .select('last_active_at')
        .eq('user_id', userId)
        .single();
      setLastActive(data?.last_active_at);
    };
    fetchLastActive();
  }, [userId]);
  
  return (
    <div className="text-xs text-muted-foreground">
      Last active: {lastActive ? new Date(lastActive).toLocaleString() : 'N/A'}
    </div>
  );
}
