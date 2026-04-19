import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TrackCard } from "@/components/TrackCard";
import { supabase } from "@/integrations/supabase/client";
import type { Track } from "@/context/PlayerContext";
import type { Tables } from "@/integrations/supabase/types";
import { ArrowLeft, User as UserIcon } from "lucide-react";

type Profile = Tables<"profiles">;

export const Route = createFileRoute("/u/$userId")({
  component: ArtistPage,
});

function ArtistPage() {
  const { userId } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: p }, { data: t }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("tracks").select("*").eq("user_id", userId).eq("is_public", true).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setProfile(p ?? null);
      setTracks(t ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const avatarUrl = profile?.avatar_url ?? null;
  const name = profile?.display_name ?? "Unknown artist";

  return (
    <AppShell>
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <section className="mb-10 flex flex-col items-start gap-6 sm:flex-row sm:items-end">
        <div className="h-40 w-40 overflow-hidden rounded-full bg-muted shadow-xl ring-4 ring-card">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <UserIcon className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Artist</div>
          <h1 className="mt-1 text-4xl font-bold tracking-tight sm:text-6xl">{name}</h1>
          {profile?.bio && (
            <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm text-muted-foreground">{profile.bio}</p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            {tracks.length} public {tracks.length === 1 ? "song" : "songs"}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Public songs</h2>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : tracks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            This artist hasn't shared any public songs yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {tracks.map((t) => <TrackCard key={t.id} track={t} queue={tracks} />)}
          </div>
        )}
      </section>
    </AppShell>
  );
}
