import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { generateSuno, getSunoStatus, saveSunoTrack, type SunoTrack } from "@/server/suno.functions";
import { toast } from "sonner";
import { Sparkles, Wand2, Loader2, Save, Music2 } from "lucide-react";

export const Route = createFileRoute("/create")({
  component: CreatePage,
  head: () => ({ meta: [{ title: "Create Music with AI — Wavely" }] }),
});

const STYLE_PRESETS = ["Pop", "Lo-fi Hip Hop", "Indie Rock", "Synthwave", "Acoustic", "Electronic", "Jazz", "Cinematic"];

function CreatePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [vocalGender, setVocalGender] = useState<"" | "m" | "f">("");
  const [model, setModel] = useState<"V4_5" | "V4_5PLUS" | "V5">("V4_5");

  const [taskId, setTaskId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>("");
  const [tracks, setTracks] = useState<SunoTrack[]>([]);
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let stopped = false;
    const tick = async () => {
      const r = await getSunoStatus({ data: { taskId: id } });
      if (r.error || !r.status) {
        setStatusText(r.error ?? "Failed to read status");
        return;
      }
      setStatusText(r.status.status);
      if (r.status.tracks.length > 0) {
        setTracks(r.status.tracks);
      }
      const playable = r.status.tracks.filter((t) => t.audioUrl).length;
      if (
        r.status.status === "SUCCESS" ||
        playable >= 2 ||
        ["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "SENSITIVE_WORD_ERROR", "CALLBACK_EXCEPTION"].includes(r.status.status)
      ) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        stopped = true;
        setBusy(false);
        if (r.status.errorMessage) toast.error(r.status.errorMessage);
        else if (r.status.status === "SUCCESS" || playable > 0) toast.success("Your song is ready!");
      }
    };
    void tick();
    pollRef.current = setInterval(() => {
      if (!stopped) void tick();
    }, 5000);
  };

  const submit = async () => {
    if (!prompt.trim()) return toast.error("Describe the song or paste lyrics");
    setBusy(true);
    setTracks([]);
    setTaskId(null);
    setStatusText("Submitting...");
    try {
      const customMode = Boolean(title.trim() && style.trim());
      const r = await generateSuno({
        data: {
          prompt: prompt.trim(),
          title: title.trim() || undefined,
          style: style.trim() || undefined,
          instrumental,
          customMode,
          vocalGender: vocalGender || undefined,
          model,
        },
      });
      if (r.error || !r.taskId) {
        setBusy(false);
        setStatusText("");
        return toast.error(r.error ?? "Could not start generation");
      }
      setTaskId(r.taskId);
      setStatusText("PENDING");
      startPolling(r.taskId);
    } catch (e) {
      setBusy(false);
      setStatusText("");
      toast.error(e instanceof Error ? e.message : "Generation failed");
    }
  };

  const save = async (t: SunoTrack) => {
    if (!t.audioUrl) return toast.error("Track not finished yet");
    setSavingId(t.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Please sign in again");
      await saveSunoTrack({
        data: {
          accessToken: token,
          sunoId: t.id,
          audioUrl: t.audioUrl,
          coverUrl: t.imageUrl,
          title: t.title || title || "Untitled",
          artist: "AI · Suno",
          durationSeconds: t.duration ?? null,
        },
      });
      toast.success("Saved to your library");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-fuchsia-500">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Create with AI</h1>
            <p className="text-sm text-muted-foreground">Generate full songs with vocals, powered by Suno.</p>
          </div>
        </div>

        <div className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {instrumental ? "Describe the music" : "Lyrics or song description"}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              maxLength={3000}
              placeholder={instrumental ? "A dreamy lo-fi beat with rainy night vibes..." : "Write your lyrics here, or describe the song you want..."}
              className="w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">{prompt.length} / 3000</div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Title (optional)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                placeholder="My new song"
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Style (optional)</label>
              <input
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                maxLength={200}
                placeholder="Pop, upbeat, female vocals"
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {STYLE_PRESETS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStyle(s)}
                    className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex items-center gap-2 rounded-md border border-border bg-input px-3 py-2 text-sm">
              <input type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)} />
              Instrumental only
            </label>
            <select
              value={vocalGender}
              onChange={(e) => setVocalGender(e.target.value as "" | "m" | "f")}
              disabled={instrumental}
              className="rounded-md border border-border bg-input px-3 py-2 text-sm outline-none disabled:opacity-50"
            >
              <option value="">Any vocal gender</option>
              <option value="f">Female vocals</option>
              <option value="m">Male vocals</option>
            </select>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as "V4_5" | "V4_5PLUS" | "V5")}
              className="rounded-md border border-border bg-input px-3 py-2 text-sm outline-none"
            >
              <option value="V4_5">Suno V4.5 (balanced)</option>
              <option value="V4_5PLUS">Suno V4.5 Plus (richer)</option>
              <option value="V5">Suno V5 (latest)</option>
            </select>
          </div>

          <button
            onClick={submit}
            disabled={busy || !prompt.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-50 sm:w-auto sm:px-10"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {busy ? "Generating..." : "Generate song"}
          </button>
        </div>

        {(busy || tracks.length > 0 || taskId) && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Music2 className="h-4 w-4" />
              {busy ? (
                <>Status: <span className="font-mono">{statusText || "..."}</span> — this can take 30–90s.</>
              ) : (
                <>Done. Status: <span className="font-mono">{statusText}</span></>
              )}
            </div>

            {tracks.length === 0 && busy && (
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-card" />
                ))}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {tracks.map((t) => (
                <div key={t.id} className="overflow-hidden rounded-xl border border-border bg-card">
                  {t.imageUrl ? (
                    <img src={t.imageUrl} alt={t.title ?? "Cover"} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-primary/30 to-fuchsia-500/30">
                      <Music2 className="h-10 w-10 text-primary-foreground" />
                    </div>
                  )}
                  <div className="space-y-2 p-3">
                    <div className="font-semibold leading-tight">{t.title ?? "Untitled"}</div>
                    <div className="text-xs text-muted-foreground">{t.tags ?? ""}</div>
                    {t.audioUrl ? (
                      <audio src={t.audioUrl} controls preload="none" className="h-9 w-full" />
                    ) : t.streamAudioUrl ? (
                      <audio src={t.streamAudioUrl} controls preload="none" className="h-9 w-full" />
                    ) : (
                      <div className="flex h-9 items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Rendering audio...
                      </div>
                    )}
                    <button
                      onClick={() => save(t)}
                      disabled={!t.audioUrl || savingId === t.id}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {savingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save to library
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
