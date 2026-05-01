import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

async function verifyAccessToken(accessToken: string): Promise<string> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Server auth not configured");
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Unauthorized: please sign in again");
  return data.user.id;
}

const SUNO_BASE = "https://api.sunoapi.org/api/v1";

function sunoKey() {
  const k = process.env.SUNO_API_KEY;
  if (!k) throw new Error("SUNO_API_KEY is not configured");
  return k;
}

function sunoHeaders() {
  return {
    "Authorization": `Bearer ${sunoKey()}`,
    "Content-Type": "application/json",
  };
}

export type SunoTrack = {
  id: string;
  audioUrl: string | null;
  streamAudioUrl: string | null;
  imageUrl: string | null;
  title: string | null;
  tags: string | null;
  duration: number | null;
};

export type SunoStatus = {
  taskId: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  tracks: SunoTrack[];
};

// Start a generation task
export const generateSuno = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      prompt: z.string().min(1).max(3000),
      title: z.string().min(1).max(150).optional(),
      style: z.string().min(1).max(200).optional(),
      instrumental: z.boolean().optional(),
      customMode: z.boolean().optional(),
      vocalGender: z.enum(["m", "f"]).optional(),
      model: z.enum(["V4", "V4_5", "V4_5PLUS", "V4_5ALL", "V5"]).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const body: Record<string, unknown> = {
      prompt: data.prompt,
      instrumental: data.instrumental ?? false,
      customMode: data.customMode ?? false,
      model: data.model ?? "V4_5",
      // callBackUrl is required by the API but we poll for status instead
      callBackUrl: "https://example.com/no-op",
    };
    if (data.customMode) {
      if (data.title) body.title = data.title;
      if (data.style) body.style = data.style;
    }
    if (data.vocalGender) body.vocalGender = data.vocalGender;

    const res = await fetch(`${SUNO_BASE}/generate`, {
      method: "POST",
      headers: sunoHeaders(),
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      code?: number;
      msg?: string;
      data?: { taskId?: string };
    };
    if (!res.ok || json.code !== 200 || !json.data?.taskId) {
      return { taskId: null as string | null, error: json.msg ?? `Suno error ${res.status}` };
    }
    return { taskId: json.data.taskId, error: null };
  });

// Poll task status
export const getSunoStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({ taskId: z.string().min(1).max(120) }).parse)
  .handler(async ({ data }): Promise<{ status: SunoStatus | null; error: string | null }> => {
    const res = await fetch(`${SUNO_BASE}/generate/record-info?taskId=${encodeURIComponent(data.taskId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${sunoKey()}` },
    });
    const json = (await res.json().catch(() => ({}))) as {
      code?: number;
      msg?: string;
      data?: {
        taskId?: string;
        status?: string;
        errorCode?: string | null;
        errorMessage?: string | null;
        response?: {
          sunoData?: Array<{
            id?: string;
            audioUrl?: string;
            streamAudioUrl?: string;
            imageUrl?: string;
            title?: string;
            tags?: string;
            duration?: number;
          }>;
        };
      };
    };
    if (!res.ok || json.code !== 200 || !json.data) {
      return { status: null, error: json.msg ?? `Suno error ${res.status}` };
    }
    const tracks: SunoTrack[] = (json.data.response?.sunoData ?? []).map((t) => ({
      id: t.id ?? "",
      audioUrl: t.audioUrl ?? null,
      streamAudioUrl: t.streamAudioUrl ?? null,
      imageUrl: t.imageUrl ?? null,
      title: t.title ?? null,
      tags: t.tags ?? null,
      duration: typeof t.duration === "number" ? t.duration : null,
    }));
    return {
      status: {
        taskId: json.data.taskId ?? data.taskId,
        status: json.data.status ?? "PENDING",
        errorCode: json.data.errorCode ?? null,
        errorMessage: json.data.errorMessage ?? null,
        tracks,
      },
      error: null,
    };
  });

// Save a generated track into the user's library
export const saveSunoTrack = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      accessToken: z.string().min(10),
      sunoId: z.string().min(1).max(120),
      audioUrl: z.string().url(),
      coverUrl: z.string().url().optional().nullable(),
      title: z.string().min(1).max(150),
      artist: z.string().min(1).max(150),
      durationSeconds: z.number().min(0).max(36000).optional().nullable(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const userId = await verifyAccessToken(data.accessToken);
    const ts = Date.now();

    const audioRes = await fetch(data.audioUrl);
    if (!audioRes.ok) throw new Error(`Failed to fetch audio (${audioRes.status})`);
    const audioBuf = await audioRes.arrayBuffer();
    if (audioBuf.byteLength > 50 * 1024 * 1024) throw new Error("Audio file exceeds 50MB");
    const audioPath = `${userId}/${ts}-suno-${data.sunoId}.mp3`;
    const upAudio = await supabaseAdmin.storage.from("audio").upload(audioPath, audioBuf, {
      contentType: "audio/mpeg",
      upsert: false,
    });
    if (upAudio.error) throw new Error(`Audio upload failed: ${upAudio.error.message}`);

    let coverPath: string | null = null;
    if (data.coverUrl) {
      try {
        const coverRes = await fetch(data.coverUrl);
        if (coverRes.ok) {
          const coverBuf = await coverRes.arrayBuffer();
          if (coverBuf.byteLength <= 5 * 1024 * 1024) {
            const ct = coverRes.headers.get("content-type") || "image/jpeg";
            const ext = ct.includes("png") ? "png" : "jpg";
            coverPath = `${userId}/${ts}-suno-${data.sunoId}.${ext}`;
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

    const insert = await supabaseAdmin.from("tracks").insert({
      user_id: userId,
      title: data.title,
      artist: data.artist,
      audio_path: audioPath,
      cover_path: coverPath,
      duration_seconds: data.durationSeconds ?? null,
    }).select("id").single();
    if (insert.error) throw new Error(`DB insert failed: ${insert.error.message}`);

    return { trackId: insert.data.id };
  });
