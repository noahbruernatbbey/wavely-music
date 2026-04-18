import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TrackCard } from "@/components/TrackCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Track } from "@/context/PlayerContext";
import { Music2, Upload as UploadIcon, Search, Globe } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState<Track[]>([]);
  const [publicResults, setPublicResults] = useState<Track[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("tracks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => setMine(data ?? []));
  }, [user]);

  // Public search debounce
  useEffect(() => {
    const term = query.trim();
    if (!term) { setPublicResults([]); return; }
    setSearching(true);
    const id = setTimeout(async () => {
      const { data } = await supabase
        .from("tracks")
        .select("*")
        .eq("is_public", true)
        .or(`title.ilike.%${term}%,artist.ilike.%${term}%`)
        .order("created_at", { ascending: false })
        .limit(40);
      setPublicResults(data ?? []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {publicResults.map((t) => <TrackCard key={t.id} track={t} queue={publicResults} />)}
            </div>
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
        </>
      )}
    </AppShell>
  );
}
