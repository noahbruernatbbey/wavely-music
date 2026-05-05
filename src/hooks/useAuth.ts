import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Honor "Remember me": if user opted out, purge persisted Supabase tokens on tab close.
    if (typeof window !== "undefined") {
      const remember = localStorage.getItem("wavely.rememberMe") !== "false";
      if (!remember) {
        const handler = () => {
          try {
            const keys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && (k.startsWith("sb-") || k.includes("supabase.auth.token"))) keys.push(k);
            }
            keys.forEach((k) => localStorage.removeItem(k));
          } catch { /* ignore */ }
        };
        window.addEventListener("pagehide", handler);
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}
