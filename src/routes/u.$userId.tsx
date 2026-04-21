import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { TrackCard } from "@/components/TrackCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Track } from "@/context/PlayerContext";
import type { Tables } from "@/integrations/supabase/types";
import { ArrowLeft, User as UserIcon, UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";

type Profile = Tables<"profiles">;

export const Route = createFileRoute("/u/$userId")({
  component: ArtistPage,
});

function ArtistPage() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playCounts, setPlayCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  const isSelf = user?.id === userId;

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: t }, { count: fc }, { count: fwc }, followRow] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("tracks").select("*").eq("user_id", userId).eq("is_public", true).order("created_at", { ascending: false }),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
      user ? supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", userId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setProfile(p ?? null);
    const trackList = t ?? [];
    setTracks(trackList);
    setFollowers(fc ?? 0);
    setFollowing(fwc ?? 0);
    setIsFollowing(!!(followRow as any)?.data);

    if (trackList.length > 0) {
      const ids = trackList.map((x) => x.id);
      const { data: pc } = await supabase.from("play_counts" as never).select("track_id, count").in("track_id", ids);
      const map: Record<string, number> = {};
      ((pc as any[]) ?? []).forEach((r) => { map[r.track_id] = Number(r.count) || 0; });
      setPlayCounts(map);
    } else {
      setPlayCounts({});
    }
    setLoading(false);
  }, [userId, user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleFollow = async () => {
    if (!user) { toast.error("Sign in to follow artists"); return; }
    if (isSelf) return;
    setBusy(true);
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
      setIsFollowing(false);
      setFollowers((n) => Math.max(0, n - 1));
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: userId });
      if (!error) {
        setIsFollowing(true);
        setFollowers((n) => n + 1);
      } else {
        toast.error(error.message);
      }
    }
    setBusy(false);
  };

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
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span><strong className="text-foreground">{followers.toLocaleString()}</strong> {followers === 1 ? "follower" : "followers"}</span>
            <span className="text-border">•</span>
            <span><strong className="text-foreground">{following.toLocaleString()}</strong> following</span>
            <span className="text-border">•</span>
            <span><strong className="text-foreground">{tracks.length}</strong> public {tracks.length === 1 ? "song" : "songs"}</span>
          </div>
          {!isSelf && (
            <button
              onClick={handleFollow}
              disabled={busy}
              className={`mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50 ${
                isFollowing
                  ? "border border-border bg-card text-foreground hover:bg-elevated"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {isFollowing ? <><UserCheck className="h-4 w-4" /> Following</> : <><UserPlus className="h-4 w-4" /> Follow</>}
            </button>
          )}
        </div>
      </section>

      {!loading && tracks.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-xl font-bold">Top tracks</h2>
          <ol className="overflow-hidden rounded-xl border border-border bg-card/40">
            {[...tracks]
              .sort((a, b) => (playCounts[b.id] ?? 0) - (playCounts[a.id] ?? 0))
              .slice(0, 5)
              .map((t, i) => {
                const plays = playCounts[t.id] ?? 0;
                return (
                  <li key={t.id} className="flex items-center gap-4 border-b border-border px-4 py-2 last:border-b-0 hover:bg-elevated/40">
                    <span className="w-5 text-right text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
                    </div>
                    <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                      {plays.toLocaleString()} {plays === 1 ? "play" : "plays"}
                    </span>
                  </li>
                );
              })}
          </ol>
        </section>
      )}

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
