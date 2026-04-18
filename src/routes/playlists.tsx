import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlayer } from "@/context/PlayerContext";
import type { Tables } from "@/integrations/supabase/types";
import type { Track } from "@/context/PlayerContext";
import { toast } from "sonner";
import { ListMusic, Plus, Trash2, Play, Music2, X, Globe, Lock } from "lucide-react";
import { publicUrl } from "@/lib/storage";

type Playlist = Tables<"playlists">;
type PlaylistTrack = Tables<"playlist_tracks">;

export const Route = createFileRoute("/playlists")({
  component: PlaylistsPage,
  head: () => ({ meta: [{ title: "Playlists — Wavely" }] }),
});

function PlaylistsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { play } = usePlayer();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [active, setActive] = useState<Playlist | null>(null);
  const [activeTracks, setActiveTracks] = useState<Track[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPublic, setNewPublic] = useState(false);
  const [deleting, setDeleting] = useState<Playlist | null>(null);
  const [adding, setAdding] = useState(false);
  const [myTracks, setMyTracks] = useState<Track[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const loadPlaylists = () => {
    if (!user) return;
    supabase.from("playlists").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setPlaylists(data ?? []));
  };
  useEffect(loadPlaylists, [user]);

  // Load tracks for the active playlist
  useEffect(() => {
    if (!active) { setActiveTracks([]); return; }
    (async () => {
      const { data: pts } = await supabase.from("playlist_tracks")
        .select("track_id, position")
        .eq("playlist_id", active.id)
        .order("position", { ascending: true });
      const ids = (pts ?? []).map((p: Pick<PlaylistTrack, "track_id" | "position">) => p.track_id);
      if (ids.length === 0) { setActiveTracks([]); return; }
      const { data: tracks } = await supabase.from("tracks").select("*").in("id", ids);
      // preserve playlist order
      const ordered = ids.map((id) => tracks?.find((t) => t.id === id)).filter(Boolean) as Track[];
      setActiveTracks(ordered);
    })();
  }, [active]);

  const create = async () => {
    if (!user || !newName.trim()) return;
    const { data, error } = await supabase.from("playlists")
      .insert({ user_id: user.id, name: newName.trim(), is_public: newPublic })
      .select().single();
    if (error) return toast.error(error.message);
    setNewName(""); setNewPublic(false); setCreating(false);
    toast.success("Playlist created");
    setPlaylists((p) => [data as Playlist, ...p]);
  };

  const removePlaylist = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("playlists").delete().eq("id", deleting.id);
    if (error) return toast.error(error.message);
    toast.success("Playlist deleted");
    if (active?.id === deleting.id) setActive(null);
    setDeleting(null);
    loadPlaylists();
  };

  const openAdd = async () => {
    if (!active || !user) return;
    const { data } = await supabase.from("tracks").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setMyTracks(data ?? []);
    setAdding(true);
  };

  const addTrack = async (t: Track) => {
    if (!active) return;
    const { error } = await supabase.from("playlist_tracks").insert({
      playlist_id: active.id, track_id: t.id, position: activeTracks.length,
    });
    if (error) {
      if (error.code === "23505") return toast.error("Already in this playlist.");
      return toast.error(error.message);
    }
    toast.success("Added");
    setActiveTracks((arr) => [...arr, t]);
  };

  const removeTrack = async (t: Track) => {
    if (!active) return;
    const { error } = await supabase.from("playlist_tracks").delete()
      .eq("playlist_id", active.id).eq("track_id", t.id);
    if (error) return toast.error(error.message);
    setActiveTracks((arr) => arr.filter((x) => x.id !== t.id));
  };

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Playlists</h1>
          <p className="mt-1 text-sm text-muted-foreground">Group your songs into custom collections.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105"
        >
          <Plus className="h-4 w-4" /> New playlist
        </button>
      </div>

      {playlists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground">
          No playlists yet. Create one to start organizing your music.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Playlist list */}
          <div className="space-y-2">
            {playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => setActive(pl)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors ${
                  active?.id === pl.id ? "bg-secondary" : "bg-card hover:bg-secondary/60"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-primary/40 to-primary/10">
                  <ListMusic className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{pl.name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {pl.is_public ? <><Globe className="h-3 w-3" /> Public</> : <><Lock className="h-3 w-3" /> Private</>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Active playlist details */}
          <div className="rounded-xl border border-border bg-card p-5">
            {!active ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Select a playlist.</div>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">{active.name}</h2>
                    <p className="text-xs text-muted-foreground">{activeTracks.length} {activeTracks.length === 1 ? "song" : "songs"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => activeTracks[0] && play(activeTracks[0], activeTracks)}
                      disabled={activeTracks.length === 0}
                      className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5" fill="currentColor" /> Play
                    </button>
                    <button onClick={openAdd} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-secondary">
                      <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                    <button onClick={() => setDeleting(active)} className="rounded-full border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {activeTracks.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Empty playlist. Click "Add" to put songs in.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {activeTracks.map((t, i) => {
                      const cover = publicUrl("covers", t.cover_path);
                      return (
                        <div key={t.id} className="group flex items-center gap-3 py-2">
                          <div className="w-6 text-center text-xs text-muted-foreground">{i + 1}</div>
                          <button onClick={() => play(t, activeTracks)} className="h-10 w-10 overflow-hidden rounded">
                            {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-muted"><Music2 className="h-4 w-4 text-muted-foreground" /></div>}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{t.title}</div>
                            <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
                          </div>
                          <button onClick={() => removeTrack(t)} className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100" aria-label="Remove">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setCreating(false)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold">New playlist</h2>
            <input
              autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Playlist name"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <label className="mt-3 flex items-center justify-between rounded-md border border-border bg-input/50 p-3">
              <div>
                <div className="text-sm font-semibold">Public</div>
                <div className="text-xs text-muted-foreground">Visible to anyone with the link.</div>
              </div>
              <input type="checkbox" checked={newPublic} onChange={(e) => setNewPublic(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)]" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setCreating(false)} className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={create} disabled={!newName.trim()} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Add tracks modal */}
      {adding && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setAdding(false)}>
          <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold">Add to "{active.name}"</h2>
            <div className="flex-1 overflow-y-auto">
              {myTracks.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground">No songs in your library yet.</div>
              ) : (
                myTracks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{t.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
                    </div>
                    <button onClick={() => addTrack(t)} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Add</button>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setAdding(false)} className="rounded-full px-4 py-2 text-sm">Done</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete playlist"
        message={deleting ? `"${deleting.name}" will be removed. The songs themselves are kept in your library.` : ""}
        confirmText="Delete"
        destructive
        onConfirm={removePlaylist}
        onCancel={() => setDeleting(null)}
      />
    </AppShell>
  );
}
