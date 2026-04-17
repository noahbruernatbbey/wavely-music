import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Profile — Wavely" }] }),
});

function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [trackCount, setTrackCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name ?? ""));
    supabase.from("tracks").select("*", { count: "exact", head: true }).eq("user_id", user.id)
      .then(({ count }) => setTrackCount(count ?? 0));
  }, [user]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("user_id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-5">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary sm:h-32 sm:w-32">
            <UserIcon className="h-12 w-12 text-muted-foreground sm:h-16 sm:w-16" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-5xl">{displayName || "You"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{trackCount} {trackCount === 1 ? "song" : "songs"} · {user?.email}</p>
          </div>
        </div>

        <div className="mt-10 rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-bold">Edit profile</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</label>
              <input value={user?.email ?? ""} disabled className="w-full rounded-md border border-border bg-input/50 px-3 py-2 text-sm text-muted-foreground" />
            </div>
            <button
              onClick={save}
              disabled={busy}
              className="rounded-full bg-primary px-6 py-2 font-semibold text-primary-foreground transition-transform hover:scale-105 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
