import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useSunoHistory, type HistoryEntry } from "@/hooks/useSunoHistory";
import { supabase } from "@/integrations/supabase/client";
import { generateSuno, getSunoStatus, saveSunoTrack, type SunoTrack } from "@/server/suno.functions";
import { toast } from "sonner";
import { Sparkles, Wand2, Loader2, Save, Music2, History, Trash2, Check, Play } from "lucide-react";

export const Route = createFileRoute("/create")({
  component: CreatePage,
  head: () => ({ meta: [{ title: "Create Music with AI — Wavely" }] }),
});

const STYLE_PRESETS = ["Pop", "Lo-fi Hip Hop", "Indie Rock", "Synthwave", "Acoustic", "Electronic", "Jazz", "Cinematic"];

function CreatePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const history = useSunoHistory(user?.id ?? null);
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
  const promptRef = useRef("");
  const styleRef = useRef("");
  const instrumentalRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const recordHistory = (id: string, status: string, sunoTracks: SunoTrack[]) => {
    const existing = history.entries.find((e) => e.taskId === id);
    history.upsert({
      taskId: id,
      prompt: promptRef.current,
      style: styleRef.current || null,
      instrumental: instrumentalRef.current,
      status,
      createdAt: existing?.createdAt ?? Date.now(),
      tracks: sunoTracks.map((t) => {
        const prevSaved = existing?.tracks.find((p) => p.sunoId === t.id)?.savedTrackId ?? null;
        return {
          sunoId: t.id,
          title: t.title,
          tags: t.tags,
          audioUrl: t.audioUrl,
          imageUrl: t.imageUrl,
          duration: t.duration,
          savedTrackId: prevSaved,
        };
      }),
    });
  };

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
      const done =
        r.status.status === "SUCCESS" ||
        playable >= 2 ||
        ["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "SENSITIVE_WORD_ERROR", "CALLBACK_EXCEPTION"].includes(r.status.status);
      if (done) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        stopped = true;
        setBusy(false);
        recordHistory(id, r.status.status, r.status.tracks);
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
    promptRef.current = prompt.trim();
    styleRef.current = style.trim();
    instrumentalRef.current = instrumental;
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

  const save = async (t: SunoTrack, fromTaskId?: string) => {
    if (!t.audioUrl) return toast.error("Track not finished yet");
    setSavingId(t.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Please sign in again");
      const r = await saveSunoTrack({
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
      const tid = fromTaskId ?? taskId;
      if (tid && r?.trackId) history.markTrackSaved(tid, t.id, r.trackId);
      toast.success("Saved to your library");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const replay = (entry: HistoryEntry) => {
    setPrompt(entry.prompt);
    setStyle(entry.style ?? "");
    setInstrumental(entry.instrumental);
    setTaskId(entry.taskId);
    setStatusText(entry.status);
    setTracks(
      entry.tracks.map((t) => ({
        id: t.sunoId,
        audioUrl: t.audioUrl,
        streamAudioUrl: null,
        imageUrl: t.imageUrl,
        title: t.title,
        tags: t.tags,
        duration: t.duration,
      })),
    );
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
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

        {history.entries.length > 0 && (
          <section className="mt-12">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-bold tracking-tight">Recent generations</h2>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {history.entries.length}
                </span>
              </div>
              <button
                onClick={() => {
                  if (confirm("Clear all history? This won't delete saved songs.")) history.clear();
                }}
                className="text-xs text-muted-foreground transition-colors hover:text-destructive"
              >
                Clear all
              </button>
            </div>

            <ul className="space-y-3">
              {history.entries.map((e) => {
                const savedCount = e.tracks.filter((t) => t.savedTrackId).length;
                const total = e.tracks.length;
                const failed = ["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "SENSITIVE_WORD_ERROR"].includes(e.status);
                return (
                  <li
                    key={e.taskId}
                    className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-muted-foreground">
                            {new Date(e.createdAt).toLocaleString()}
                          </span>
                          {e.style && (
                            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">{e.style}</span>
                          )}
                          {e.instrumental && (
                            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">Instrumental</span>
                          )}
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono ${
                              failed
                                ? "bg-destructive/15 text-destructive"
                                : e.status === "SUCCESS"
                                  ? "bg-primary/15 text-primary"
                                  : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {e.status}
                          </span>
                          {total > 0 && !failed && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                                savedCount === total
                                  ? "bg-primary/15 text-primary"
                                  : savedCount > 0
                                    ? "bg-secondary text-foreground"
                                    : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {savedCount === total && <Check className="h-3 w-3" />}
                              {savedCount}/{total} saved
                            </span>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-foreground">{e.prompt}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => replay(e)}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:border-primary hover:text-primary"
                          title="Load these tracks above"
                        >
                          <Play className="h-3 w-3" /> Open
                        </button>
                        <button
                          onClick={() => history.remove(e.taskId)}
                          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="Remove from history"
                          aria-label="Remove from history"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {e.tracks.length > 0 && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {e.tracks.map((t) => (
                          <div
                            key={t.sunoId}
                            className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-2"
                          >
                            {t.imageUrl ? (
                              <img
                                src={t.imageUrl}
                                alt=""
                                className="h-12 w-12 flex-shrink-0 rounded object-cover"
                              />
                            ) : (
                              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br from-primary/30 to-fuchsia-500/30">
                                <Music2 className="h-5 w-5 text-primary-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{t.title ?? "Untitled"}</div>
                              <div className="mt-0.5">
                                {t.savedTrackId ? (
                                  <Link
                                    to="/library"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  >
                                    <Check className="h-3 w-3" /> Saved · view in library
                                  </Link>
                                ) : t.audioUrl ? (
                                  <button
                                    onClick={() =>
                                      save(
                                        {
                                          id: t.sunoId,
                                          audioUrl: t.audioUrl,
                                          streamAudioUrl: null,
                                          imageUrl: t.imageUrl,
                                          title: t.title,
                                          tags: t.tags,
                                          duration: t.duration,
                                        },
                                        e.taskId,
                                      )
                                    }
                                    disabled={savingId === t.sunoId}
                                    className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                                  >
                                    {savingId === t.sunoId ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Save className="h-3 w-3" />
                                    )}
                                    Save to library
                                  </button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No audio available</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
