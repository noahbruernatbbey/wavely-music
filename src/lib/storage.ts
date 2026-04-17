import { supabase } from "@/integrations/supabase/client";

export function publicUrl(bucket: "audio" | "covers", path: string | null | undefined) {
  if (!path) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
