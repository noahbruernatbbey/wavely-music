import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Resolves a signed URL for a private storage object. Re-signs when path changes. */
export function useSignedUrl(
  bucket: "audio" | "covers",
  path: string | null | undefined,
  expiresIn = 3600,
) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    supabase.storage.from(bucket).createSignedUrl(path, expiresIn).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [bucket, path, expiresIn]);

  return url;
}
