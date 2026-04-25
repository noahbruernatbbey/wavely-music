import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { browseJamendo, importJamendoTrack, type JamendoTrack } from "@/server/jamendo.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Sparkles, Download, Loader2, Flame } from "lucide-react";

export const Route = createFileRoute("/discover")({
  component: DiscoverPage,
  head: () => ({ meta: [
    { title: "Discover — Wavely" },
    { name: "description", content: "Browse and import free music from Jamendo by genre." },
  ] }),
});

const TAGS: { id: string; label: string; gradient: string }[] = [
  { id: "trending", label: "Trending Now", gradient: "from-pink-500 to-rose-700" },
  { id: "rock", label: "Rock", gradient: "from-red-600 to-orange-500" },
  { id: "pop", label: "Pop", gradient: "from-fuchsia-500 to-purple-700" },
  { id: "electronic", label: "Electronic", gradient: "from-cyan-400 to-blue-700" },
  { id: "hiphop", label: "Hip-Hop", gradient: "from-amber-500 to-yellow-700" },
  { id: "jazz", label: "Jazz", gradient: "from-emerald-500 to-teal-800" },
  { id: "classical", label: "Classical", gradient: "from-slate-400 to-slate-800" },
  { id: "metal", label: "Metal", gradient: "from-zinc-700 to-black" },
  { id: "lounge", label: "Chill / Lounge", gradient: "from-sky-400 to-indigo-700" },
  { id: "ambient", label: "Ambient", gradient: "from-violet-400 to-violet-900" },
  { id: "acoustic", label: "Acoustic", gradient: "from-orange-300 to-rose-500" },
  { id: "soundtrack", label: "Soundtrack", gradient: "from-yellow-400 to-red-600" },
];

function DiscoverPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const browse = useServerFn(browseJamendo);
  const importFn = useServerFn(importJamendoTrack);
  const [activeTag, setActiveTag] = useState<string>("trending");
  const [tracks, setTracks] = useState<JamendoTrack[]>([]);
  const [busy, setBusy] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const isTrending = activeTag === "trending";
    browse({
      data: isTrending
        ? { order: "popularity_week", limit: 24 }
        : { tag: activeTag, order: "popularity_month", limit: 24 },
    })
      .then((res) => {
        if (cancelled) return;
        if (res.error) toast.error(res.error);
        setTracks(res.results);
      })
      .catch(() => {})
      .finally(() => !cancelled && setBusy(false));
    return () => { cancelled = true; };
  }, [activeTag, browse]);

  const doImport = async (t: JamendoTrack) => {
    setImportingId(t.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Please sign in");
      await importFn({
        data: {
          accessToken,
          jamendoId: t.id,
          title: t.name,
          artist: t.artist_name,
          audioUrl: t.audiodownload || t.audio,
          coverUrl: t.image || null,
          durationSeconds: t.duration ?? null,
        },
      });
      toast.success(`Imported "${t.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportingId(null);
    }
  };

  return (
    <AppShell>
      <section className="mb-8">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Discover</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Browse free, Creative-Commons-licensed music from Jamendo. Tap a category, then import any track to your library.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Categories</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {TAGS.map((t) => {
            const active = activeTag === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTag(t.id)}
                className={`group relative aspect-square overflow-hidden rounded-xl bg-gradient-to-br ${t.gradient} p-3 text-left text-white shadow-md transition-transform hover:scale-[1.03] ${active ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
              >
                <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                <div className="relative flex h-full flex-col justify-between">
                  <div className="text-xs font-bold uppercase opacity-80">
                    {t.id === "trending" ? <Flame className="h-4 w-4" /> : "playlist"}
                  </div>
                  <div className="text-xl font-extrabold leading-tight drop-shadow-md sm:text-2xl">
                    {t.label}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {TAGS.find((x) => x.id === activeTag)?.label} · Top tracks
          </h2>
          {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {tracks.length === 0 && !busy ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            No tracks found for this category.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {tracks.map((t, idx) => (
              <li key={t.id} className="flex items-center gap-3 p-3 hover:bg-elevated">
                <div className="w-6 text-center text-xs font-semibold text-muted-foreground">{idx + 1}</div>
                <img src={t.image} alt="" loading="lazy" className="h-12 w-12 flex-shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{t.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {t.artist_name} · {Math.floor(t.duration / 60)}:{String(t.duration % 60).padStart(2, "0")}
                  </div>
                </div>
                <audio src={t.audio} controls preload="none" className="hidden h-8 sm:block" />
                <button
                  onClick={() => doImport(t)}
                  disabled={importingId !== null}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {importingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Import
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
