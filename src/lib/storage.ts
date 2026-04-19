import { supabase } from "@/integrations/supabase/client";

export function publicUrl(bucket: "avatars", path: string | null | undefined) {
  if (!path) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Signed URL for private buckets (audio, covers). Falls back to null on error. */
export async function signedUrl(
  bucket: "audio" | "covers",
  path: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}
