import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const JAMENDO_BASE = "https://api.jamendo.com/v3.0";

function clientId() {
  const id = process.env.JAMENDO_CLIENT_ID;
  if (!id) throw new Error("JAMENDO_CLIENT_ID is not configured");
  return id;
}

export type JamendoTrack = {
  id: string;
  name: string;
  artist_name: string;
  album_name: string;
  duration: number;
  audio: string;
  audiodownload: string;
  image: string;
  shorturl: string;
};

export const searchJamendo = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      query: z.string().min(1).max(120),
      limit: z.number().int().min(1).max(20).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      client_id: clientId(),
      format: "json",
      limit: String(data.limit ?? 12),
      search: data.query,
      audioformat: "mp32",
      include: "musicinfo",
      groupby: "artist_id",
    });
    const res = await fetch(`${JAMENDO_BASE}/tracks/?${params.toString()}`);
    if (!res.ok) {
      return { results: [] as JamendoTrack[], error: `Jamendo error ${res.status}` };
    }
    const json = (await res.json()) as { results?: JamendoTrack[]; headers?: { status?: string; error_message?: string } };
    if (json.headers?.status && json.headers.status !== "success") {
      return { results: [] as JamendoTrack[], error: json.headers.error_message ?? "Jamendo request failed" };
    }
    return { results: json.results ?? [], error: null };
  });

export const importJamendoTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      jamendoId: z.string().min(1).max(40),
      title: z.string().min(1).max(150),
      artist: z.string().min(1).max(150),
      audioUrl: z.string().url(),
      coverUrl: z.string().url().optional().nullable(),
      durationSeconds: z.number().min(0).max(36000).optional().nullable(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const ts = Date.now();

    // Fetch audio
    const audioRes = await fetch(data.audioUrl);
    if (!audioRes.ok) throw new Error(`Failed to fetch audio (${audioRes.status})`);
    const audioBuf = await audioRes.arrayBuffer();
    if (audioBuf.byteLength > 50 * 1024 * 1024) throw new Error("Audio file exceeds 50MB");
    const audioPath = `${userId}/${ts}-jamendo-${data.jamendoId}.mp3`;
    const upAudio = await supabaseAdmin.storage.from("audio").upload(audioPath, audioBuf, {
      contentType: "audio/mpeg",
      upsert: false,
    });
    if (upAudio.error) throw new Error(`Audio upload failed: ${upAudio.error.message}`);

    // Fetch cover (optional)
    let coverPath: string | null = null;
    if (data.coverUrl) {
      try {
        const coverRes = await fetch(data.coverUrl);
        if (coverRes.ok) {
          const coverBuf = await coverRes.arrayBuffer();
          if (coverBuf.byteLength <= 5 * 1024 * 1024) {
            const ct = coverRes.headers.get("content-type") || "image/jpeg";
            const ext = ct.includes("png") ? "png" : "jpg";
            coverPath = `${userId}/${ts}-jamendo-${data.jamendoId}.${ext}`;
            const upCover = await supabaseAdmin.storage.from("covers").upload(coverPath, coverBuf, {
              contentType: ct,
              upsert: false,
            });
            if (upCover.error) coverPath = null;
          }
        }
      } catch {
        coverPath = null;
      }
    }

    // Insert track row
    const insert = await supabaseAdmin.from("tracks").insert({
      user_id: userId,
      title: data.title,
      artist: data.artist,
      audio_path: audioPath,
      cover_path: coverPath,
      duration_seconds: data.durationSeconds ?? null,
    }).select("id").single();
    if (insert.error) throw new Error(`DB insert failed: ${insert.error.message}`);

    return { trackId: insert.data.id, audioPath, coverPath };
  });
