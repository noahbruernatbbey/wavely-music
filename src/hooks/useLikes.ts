import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/** Per-user set of liked track ids, kept in memory for the session. */
export function useLikedIds() {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setIds(new Set()); setLoading(false); return; }
    const { data } = await supabase.from("likes").select("track_id").eq("user_id", user.id);
    setIds(new Set((data ?? []).map((r) => r.track_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = useCallback(async (trackId: string) => {
    if (!user) return;
    const has = ids.has(trackId);
    // Optimistic
    setIds((prev) => {
      const next = new Set(prev);
      has ? next.delete(trackId) : next.add(trackId);
      return next;
    });
    if (has) {
      await supabase.from("likes").delete().eq("user_id", user.id).eq("track_id", trackId);
    } else {
      await supabase.from("likes").insert({ user_id: user.id, track_id: trackId });
    }
  }, [ids, user]);

  return { ids, loading, toggle, refresh };
}
