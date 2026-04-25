import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { UploadCloud, Music2, Image as ImageIcon, X, Sparkles } from "lucide-react";
import { JamendoImportDialog } from "@/components/JamendoImportDialog";

export const Route = createFileRoute("/upload")({
  component: UploadPage,
  head: () => ({ meta: [{ title: "Upload Song — Wavely" }] }),
});

function UploadPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jamendoOpen, setJamendoOpen] = useState(false);
  const audioInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!cover) return setCoverPreview(null);
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  const handleAudio = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("audio/") && !f.name.toLowerCase().endsWith(".mp3")) {
      return toast.error("Please select an MP3 audio file");
    }
    if (f.size > 50 * 1024 * 1024) return toast.error("Max 50MB");
    setAudio(f);
    if (!title) setTitle(f.name.replace(/\.(mp3|wav|m4a|ogg)$/i, ""));
  };

  const handleCover = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Please select an image (PNG/JPG)");
    if (f.size > 5 * 1024 * 1024) return toast.error("Cover max 5MB");
    setCover(f);
  };

  const onDropAudio = (e: DragEvent) => {
    e.preventDefault();
    handleAudio(e.dataTransfer.files?.[0] ?? null);
  };
  const onDropCover = (e: DragEvent) => {
    e.preventDefault();
    handleCover(e.dataTransfer.files?.[0] ?? null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !audio || !title.trim() || !artist.trim()) {
      return toast.error("Please fill all fields and pick an MP3");
    }
    setBusy(true);
    setProgress(10);
    try {
      const ts = Date.now();
      const audioPath = `${user.id}/${ts}-${audio.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: aErr } = await supabase.storage.from("audio").upload(audioPath, audio, {
        contentType: audio.type || "audio/mpeg",
      });
      if (aErr) throw aErr;
      setProgress(60);

      let coverPath: string | null = null;
      if (cover) {
        const cExt = cover.name.split(".").pop() || "jpg";
        coverPath = `${user.id}/${ts}-cover.${cExt}`;
        const { error: cErr } = await supabase.storage.from("covers").upload(coverPath, cover, {
          contentType: cover.type,
        });
        if (cErr) throw cErr;
      }
      setProgress(85);

      const { error: dErr } = await supabase.from("tracks").insert({
        user_id: user.id,
        title: title.trim(),
        artist: artist.trim(),
        audio_path: audioPath,
        cover_path: coverPath,
      });
      if (dErr) throw dErr;
      setProgress(100);
      toast.success("Track uploaded!");
      navigate({ to: "/library" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Upload a song</h1>
        <p className="mt-1 text-muted-foreground">Add an MP3 with cover art to your library.</p>

        <form onSubmit={submit} className="mt-8 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Audio dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDropAudio}
              onClick={() => audioInput.current?.click()}
              className="group flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-6 text-center transition-colors hover:border-primary hover:bg-elevated"
            >
              <input
                ref={audioInput}
                type="file"
                accept="audio/mpeg,audio/mp3,.mp3"
                className="hidden"
                onChange={(e) => handleAudio(e.target.files?.[0] ?? null)}
              />
              {audio ? (
                <div className="flex flex-col items-center gap-2">
                  <Music2 className="h-12 w-12 text-primary" />
                  <div className="text-sm font-semibold">{audio.name}</div>
                  <div className="text-xs text-muted-foreground">{(audio.size / 1024 / 1024).toFixed(1)} MB</div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setAudio(null); }} className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" /> Remove
                  </button>
                </div>
              ) : (
                <>
                  <UploadCloud className="h-12 w-12 text-muted-foreground transition-colors group-hover:text-primary" />
                  <div className="mt-3 font-semibold">Drop MP3 here</div>
                  <div className="text-xs text-muted-foreground">or click to browse · max 50MB</div>
                </>
              )}
            </div>

            {/* Cover dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDropCover}
              onClick={() => coverInput.current?.click()}
              className="group relative flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-card p-6 text-center transition-colors hover:border-primary hover:bg-elevated"
            >
              <input
                ref={coverInput}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => handleCover(e.target.files?.[0] ?? null)}
              />
              {coverPreview ? (
                <>
                  <img src={coverPreview} alt="Cover preview" className="absolute inset-0 h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCover(null); }}
                    className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <ImageIcon className="h-12 w-12 text-muted-foreground transition-colors group-hover:text-primary" />
                  <div className="mt-3 font-semibold">Drop cover art</div>
                  <div className="text-xs text-muted-foreground">PNG or JPG · max 5MB</div>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Title</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="Song title"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Artist</label>
              <input
                required
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                maxLength={150}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="Artist name"
              />
            </div>
          </div>

          {busy && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-50 sm:w-auto sm:px-10"
          >
            {busy ? "Uploading…" : "Upload song"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
