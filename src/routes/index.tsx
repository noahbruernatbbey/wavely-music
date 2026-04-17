import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TrackCard } from "@/components/TrackCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Track } from "@/context/PlayerContext";
import { Music2, Upload as UploadIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("tracks").select("*").order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => setTracks(data ?? []));
  }, [user]);

  return (
    <AppShell>
      <section className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Good vibes</h1>
        <p className="mt-2 text-muted-foreground">Welcome back. Here's your latest uploads.</p>
      </section>

      {tracks.length === 0 ? (
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
            {tracks.map((t) => <TrackCard key={t.id} track={t} queue={tracks} />)}
          </div>
        </>
      )}
    </AppShell>
  );
}
