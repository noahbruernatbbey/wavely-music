import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { publicUrl } from "@/lib/storage";
import { toast } from "sonner";
import { User as UserIcon, Camera, X, Search, Globe, Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";

type SearchResult = { user_id: string; display_name: string | null; avatar_url: string | null };

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Profile — Wavely" }] }),
});

function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [trackCount, setTrackCount] = useState(0);
  const [isPublic, setIsPublic] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url, bio, is_public").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        setDisplayName(data?.display_name ?? "");
        setAvatarPath(data?.avatar_url ?? null);
        setBio((data as { bio?: string | null } | null)?.bio ?? "");
        setIsPublic(Boolean((data as { is_public?: boolean } | null)?.is_public));
      });
    supabase.from("tracks").select("*", { count: "exact", head: true }).eq("user_id", user.id)
      .then(({ count }) => setTrackCount(count ?? 0));
  }, [user]);

  // Debounced search of public profiles
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .eq("is_public", true)
        .ilike("display_name", `%${q}%`)
        .limit(20);
      setResults((data ?? []) as SearchResult[]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName, bio } as never).eq("user_id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
  };

  const togglePublicProfile = async (val: boolean) => {
    if (!user) return;
    setIsPublic(val);
    const { error } = await supabase.from("profiles").update({ is_public: val } as never).eq("user_id", user.id);
    if (error) { setIsPublic(!val); return toast.error(error.message); }
    toast.success(val ? "Profile is now public" : "Profile is now private");
  };

  const onAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      return toast.error("Please choose a PNG, JPG or WEBP image.");
    }
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB.");
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    // Best-effort: remove the previous one
    if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath]);
    const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: path }).eq("user_id", user.id);
    setUploading(false);
    if (dbErr) return toast.error(dbErr.message);
    setAvatarPath(path);
    toast.success("Avatar updated");
  };

  const resetAvatar = async () => {
    if (!user || !avatarPath) return;
    setUploading(true);
    await supabase.storage.from("avatars").remove([avatarPath]);
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", user.id);
    setUploading(false);
    if (error) return toast.error(error.message);
    setAvatarPath(null);
    toast.success("Avatar removed");
  };

  const avatarUrl = avatarPath ? publicUrl("avatars", avatarPath) : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-secondary sm:h-32 sm:w-32">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-12 w-12 text-muted-foreground sm:h-16 sm:w-16" />
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 disabled:opacity-50"
              aria-label="Change avatar"
            >
              <Camera className="h-4 w-4" />
            </button>
            {avatarPath && (
              <button
                onClick={resetAvatar}
                disabled={uploading}
                className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform hover:scale-110 disabled:opacity-50"
                aria-label="Remove avatar"
                title="Remove avatar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onAvatarSelected} />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-5xl">{displayName || "You"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{trackCount} {trackCount === 1 ? "song" : "songs"} · {user?.email}</p>
            {bio && <p className="mt-3 max-w-md whitespace-pre-line text-sm text-foreground/90">{bio}</p>}
            {uploading && <p className="mt-1 text-xs text-primary">Uploading avatar…</p>}
          </div>
        </div>

        <div className="mt-10 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-bold">Edit profile</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Display name</label>
              <input
                value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bio</label>
              <textarea
                value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={4}
                placeholder="Tell people a little about yourself…"
                className="w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="mt-1 text-right text-[11px] text-muted-foreground">{bio.length}/500</div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</label>
              <input value={user?.email ?? ""} disabled className="w-full rounded-md border border-border bg-input/50 px-3 py-2 text-sm text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  Public profile
                </div>
                <p className="text-[11px] text-muted-foreground">Allow others to find your profile in search.</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={togglePublicProfile} />
            </div>
            <button
              onClick={save} disabled={busy}
              className="rounded-full bg-primary px-6 py-2 font-semibold text-primary-foreground transition-transform hover:scale-105 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div className="mt-10 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-bold">Find people</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search public profiles by name…"
              className="w-full rounded-md border border-border bg-input pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="mt-4 space-y-2">
            {search.trim().length < 2 && (
              <p className="text-xs text-muted-foreground">Type at least 2 characters to search.</p>
            )}
            {searching && <p className="text-xs text-muted-foreground">Searching…</p>}
            {!searching && search.trim().length >= 2 && results.length === 0 && (
              <p className="text-xs text-muted-foreground">No public profiles match "{search}".</p>
            )}
            {results.map((r) => {
              const av = r.avatar_url ? publicUrl("avatars", r.avatar_url) : null;
              return (
                <Link
                  key={r.user_id}
                  to="/u/$userId"
                  params={{ userId: r.user_id }}
                  className="flex items-center gap-3 rounded-md border border-border bg-background/50 px-3 py-2 transition-colors hover:border-primary hover:bg-muted/40"
                >
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-secondary">
                    {av ? <img src={av} alt="" className="h-full w-full object-cover" /> : <UserIcon className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="text-sm font-semibold">{r.display_name || "Unnamed user"}</div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
