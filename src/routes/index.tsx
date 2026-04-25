import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { TrackCard } from "@/components/TrackCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Track } from "@/context/PlayerContext";
import type { Tables } from "@/integrations/supabase/types";
import { Music2, Upload as UploadIcon, Search, Globe, ListMusic, Plus, Sparkles, Download, Loader2 } from "lucide-react";
import { searchJamendo, importJamendoTrack, type JamendoTrack } from "@/server/jamendo.functions";
import { toast } from "sonner";

type Playlist = Tables<"playlists">;

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [publicResults, setPublicResults] = useState<Track[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [jamendoResults, setJamendoResults] = useState<JamendoTrack[]>([]);
  const [jamendoSearching, setJamendoSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const searchJamendoFn = useServerFn(searchJamendo);
  const importJamendoFn = useServerFn(importJamendoTrack);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("tracks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => setMine(data ?? []));
    supabase.from("playlists").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => setPlaylists(data ?? []));
  }, [user]);

  // Public + Jamendo search debounce
  useEffect(() => {
    const term = query.trim();
    if (!term) { setPublicResults([]); setJamendoResults([]); return; }
    setSearching(true);
    setJamendoSearching(true);
    const id = setTimeout(async () => {
      const [pub, jam] = await Promise.all([
        supabase
          .from("tracks")
          .select("*")
          .eq("is_public", true)
          .or(`title.ilike.%${term}%,artist.ilike.%${term}%`)
          .order("created_at", { ascending: false })
          .limit(40),
        searchJamendoFn({ data: { query: term, limit: 12 } }).catch(() => ({ results: [], error: null })),
      ]);
      setPublicResults(pub.data ?? []);
      setSearching(false);
      setJamendoResults(jam.results ?? []);
      setJamendoSearching(false);
    }, 350);
    return () => clearTimeout(id);
  }, [query, searchJamendoFn]);

  const handleImport = async (t: JamendoTrack) => {
    setImportingId(t.id);
    try {
      await importJamendoFn({
        data: {
          jamendoId: t.id,
          title: t.name,
          artist: t.artist_name,
          audioUrl: t.audiodownload || t.audio,
          coverUrl: t.image || null,
          durationSeconds: t.duration ?? null,
        },
      });
      toast.success(`Imported "${t.name}" to your library`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportingId(null);
    }
  };

  const showSearch = useMemo(() => query.trim().length > 0, [query]);

  return (
    <AppShell>
      <section className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Good vibes</h1>
        <p className="mt-2 text-muted-foreground">Welcome back. Discover music shared by everyone.</p>
        <div className="relative mt-5 max-w-xl">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search public songs and artists…"
            className="w-full rounded-full border border-border bg-card py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </section>

      {showSearch ? (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <h2 className="text-xl font-bold">Public results for "{query}"</h2>
          </div>
          {searching && publicResults.length === 0 ? (
            <div className="text-sm text-muted-foreground">Searching…</div>
          ) : publicResults.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
              No public songs match. Try a different query.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {publicResults.map((t) => <TrackCard key={t.id} track={t} queue={publicResults} />)}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {Array.from(new Map(publicResults.map((t) => [t.user_id, t.artist])).entries()).map(([uid, artist]) => (
                  <Link key={uid} to="/u/$userId" params={{ userId: uid }} className="rounded-full bg-card px-4 py-1.5 text-xs font-semibold hover:bg-elevated">
                    Visit {artist} →
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      ) : mine.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            <Music2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Your library is empty</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Upload your first MP3 with cover art and start building your personal music collection.
          </p>
          <Link to="/upload" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-semibold text-primary-foreground transition-transform hover:scale-105">
            <UploadIcon className="h-4 w-4" /> Upload a song
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">Recently added</h2>
            <Link to="/library" className="text-sm font-semibold text-muted-foreground hover:text-foreground">Show all</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {mine.map((t) => <TrackCard key={t.id} track={t} queue={mine} />)}
          </div>

          <section className="mt-10">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">Your playlists</h2>
              <Link to="/playlists" className="text-sm font-semibold text-muted-foreground hover:text-foreground">Show all</Link>
            </div>
            {playlists.length === 0 ? (
              <Link
                to="/playlists"
                className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-5 py-6 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
                  <Plus className="h-5 w-5" />
                </div>
                Create your first playlist to organize your songs.
              </Link>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {playlists.map((pl) => (
                  <Link
                    key={pl.id}
                    to="/playlists"
                    className="group flex flex-col gap-3 rounded-lg bg-card p-3 transition-all hover:bg-elevated"
                  >
                    <div className="flex aspect-square items-center justify-center rounded-md bg-gradient-to-br from-primary/40 via-primary/20 to-secondary shadow-md">
                      <ListMusic className="h-12 w-12 text-primary-foreground/90" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{pl.name}</div>
                      <div className="truncate text-sm text-muted-foreground">{pl.is_public ? "Public" : "Private"} playlist</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
