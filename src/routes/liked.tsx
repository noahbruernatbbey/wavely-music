import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TrackCard } from "@/components/TrackCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Track } from "@/context/PlayerContext";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/liked")({
  component: LikedPage,
});

function LikedPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setFetching(true);
      const { data: liked } = await supabase
        .from("likes")
        .select("track_id, created_at, tracks(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setTracks((liked ?? []).map((l: any) => l.tracks).filter(Boolean));
      setFetching(false);
    })();
  }, [user]);

  return (
    <AppShell>
      <section className="mb-8 flex items-end gap-6">
        <div className="flex h-40 w-40 items-center justify-center rounded-md bg-gradient-to-br from-pink-500/80 via-rose-500/60 to-primary/40 shadow-xl">
          <Heart className="h-16 w-16 text-white" fill="currentColor" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collection</div>
          <h1 className="mt-1 text-4xl font-bold tracking-tight sm:text-6xl">Liked Songs</h1>
          <p className="mt-3 text-sm text-muted-foreground">{tracks.length} {tracks.length === 1 ? "song" : "songs"}</p>
        </div>
      </section>

      {fetching ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : tracks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
          <Heart className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">No liked songs yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tap the heart on any song to save it here.</p>
          <Link to="/" className="mt-5 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Browse music</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {tracks.map((t) => <TrackCard key={t.id} track={t} queue={tracks} />)}
        </div>
      )}
    </AppShell>
  );
}
