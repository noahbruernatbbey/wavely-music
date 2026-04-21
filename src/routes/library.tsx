import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TrackCard } from "@/components/TrackCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Track } from "@/context/PlayerContext";
import { toast } from "sonner";
import { Search } from "lucide-react";

export const Route = createFileRoute("/library")({
  component: LibraryPage,
  head: () => ({ meta: [{ title: "My Library — Wavely" }] }),
});

function LibraryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "title" | "artist">("recent");
  const [editing, setEditing] = useState<Track | null>(null);
  const [deleting, setDeleting] = useState<Track | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const [plays, setPlays] = useState<Record<string, number>>({});

  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase.from("tracks").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const list = data ?? [];
    setTracks(list);
    if (list.length) {
      const { data: pc } = await supabase.from("play_counts").select("track_id, count").in("track_id", list.map((t) => t.id));
      const map: Record<string, number> = {};
      (pc ?? []).forEach((r: { track_id: string; count: number }) => { map[r.track_id] = Number(r.count); });
      setPlays(map);
    } else {
      setPlays({});
    }
  };

  useEffect(() => { if (user) refresh(); }, [user]);

  const filtered = tracks
    .filter((t) =>
      !query ||
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.artist.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "artist") return a.artist.localeCompare(b.artist);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    await supabase.storage.from("audio").remove([deleting.audio_path]);
    if (deleting.cover_path) await supabase.storage.from("covers").remove([deleting.cover_path]);
    const { error } = await supabase.from("tracks").delete().eq("id", deleting.id);
    setDeleteBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Track deleted");
    setDeleting(null);
    refresh();
  };

  // Owner-only edit/delete: show controls only when track belongs to current user
  const canManage = (t: Track) => !!user && t.user_id === user.id;

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">My Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tracks.length} {tracks.length === 1 ? "song" : "songs"}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…"
              className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary sm:w-56"
            />
          </div>
          <select
            value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-full border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="recent">Recently added</option>
            <option value="title">Title</option>
            <option value="artist">Artist</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground">
          {tracks.length === 0 ? "No tracks yet — head to Upload to add your first song." : "No tracks match your search."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((t) => (
            <TrackCard
              key={t.id}
              track={t}
              queue={filtered}
              playCount={plays[t.id] ?? 0}
              onEdit={canManage(t) ? setEditing : undefined}
              onDelete={canManage(t) ? setDeleting : undefined}
            />
          ))}
        </div>
      )}

      {editing && (
        <EditModal track={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete track"
        message={deleting ? `"${deleting.title}" will be permanently removed, including its audio and cover art.` : ""}
        confirmText="Delete"
        destructive
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </AppShell>
  );
}

function EditModal({ track, onClose, onSaved }: { track: Track; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [isPublic, setIsPublic] = useState(track.is_public);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("tracks").update({ title, artist, is_public: isPublic }).eq("id", track.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold">Edit track</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Artist</label>
            <input value={artist} onChange={(e) => setArtist(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center justify-between rounded-md border border-border bg-input/50 p-3">
            <div>
              <div className="text-sm font-semibold">Public</div>
              <div className="text-xs text-muted-foreground">Anyone can find this song in search.</div>
            </div>
            <input
              type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)}
              className="h-5 w-5 accent-[var(--color-primary)]"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={save} disabled={busy} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
