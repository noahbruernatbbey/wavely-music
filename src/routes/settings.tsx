import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlayer } from "@/context/PlayerContext";
import { toast } from "sonner";
import { Settings as SettingsIcon, LogOut, Trash2, Volume2 } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Wavely" }] }),
});

function SettingsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { volume, setVolume } = usePlayer();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const changePassword = async () => {
    if (newPassword.length < 6) return toast.error("Password must be at least 6 characters.");
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwBusy(false);
    if (error) return toast.error(error.message);
    setNewPassword("");
    toast.success("Password updated");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account and playback preferences.</p>
          </div>
        </div>

        {/* Playback */}
        <Section title="Playback">
          <div className="flex items-center gap-3">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Default volume</label>
              <input
                type="range" min={0} max={1} step={0.01} value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="track-slider w-full"
              />
            </div>
            <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">{Math.round(volume * 100)}%</span>
          </div>
        </Section>

        {/* Account */}
        <Section title="Account">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Email</label>
              <input value={user?.email ?? ""} disabled className="w-full rounded-md border border-border bg-input/50 px-3 py-2 text-sm text-muted-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Change password</label>
              <div className="flex gap-2">
                <input
                  type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password"
                  className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={changePassword} disabled={pwBusy || !newPassword}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {pwBusy ? "…" : "Update"}
                </button>
              </div>
            </div>
            <button
              onClick={() => setConfirmSignOut(true)}
              className="mt-2 flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-medium hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </Section>

        {/* Danger zone */}
        <Section title="Danger zone" tone="destructive">
          <div className="text-sm text-muted-foreground">
            Account deletion isn't available yet. To delete your account, contact support.
          </div>
          <button
            disabled
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-destructive/40 px-5 py-2 text-sm font-medium text-destructive opacity-60"
          >
            <Trash2 className="h-4 w-4" /> Delete account
          </button>
        </Section>

        {/* About */}
        <Section title="About">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Wavely</span> v1.0 — your personal music library.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Wavely. All rights reserved.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Audio you upload remains yours. By uploading, you confirm you have the rights to share the content.
          </p>
        </Section>
      </div>

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out?"
        message="You'll need to sign in again to access your library."
        confirmText="Sign out"
        onConfirm={signOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </AppShell>
  );
}

function Section({ title, tone, children }: { title: string; tone?: "destructive"; children: React.ReactNode }) {
  return (
    <section className={`mb-6 rounded-xl border bg-card p-6 ${tone === "destructive" ? "border-destructive/30" : "border-border"}`}>
      <h2 className={`mb-4 text-lg font-bold ${tone === "destructive" ? "text-destructive" : ""}`}>{title}</h2>
      {children}
    </section>
  );
}
