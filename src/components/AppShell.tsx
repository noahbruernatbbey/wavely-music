import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Player } from "./Player";
import { QueuePanel } from "./QueuePanel";
import { Library, Upload, User, LogOut, Music2, Home, ListMusic, Settings, PanelLeftClose, PanelLeft, Heart } from "lucide-react";

function NavLink({ to, icon: Icon, children, collapsed }: { to: string; icon: typeof Home; children: ReactNode; collapsed: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const active = path === to;
  return (
    <Link
      to={to}
      title={collapsed ? String(children) : undefined}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span>{children}</span>}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "1";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-collapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const sidebarWidth = collapsed ? "w-16" : "w-60";
  const mainPad = collapsed ? "md:pl-16" : "md:pl-60";

  return (
    <div className="min-h-screen pb-28 sm:pb-24">
      <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col gap-1 bg-sidebar p-4 transition-[width] duration-200 md:flex ${sidebarWidth}`}>
        <div className={`mb-2 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2 px-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <Music2 className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight">Wavely</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        <NavLink to="/" icon={Home} collapsed={collapsed}>Home</NavLink>
        <NavLink to="/library" icon={Library} collapsed={collapsed}>My Library</NavLink>
        <NavLink to="/liked" icon={Heart} collapsed={collapsed}>Liked Songs</NavLink>
        <NavLink to="/playlists" icon={ListMusic} collapsed={collapsed}>Playlists</NavLink>
        <NavLink to="/upload" icon={Upload} collapsed={collapsed}>Upload</NavLink>
        <NavLink to="/profile" icon={User} collapsed={collapsed}>Profile</NavLink>
        <NavLink to="/settings" icon={Settings} collapsed={collapsed}>Settings</NavLink>
        <div className="mt-auto">
          {user ? (
            <button
              onClick={signOut}
              title={collapsed ? "Sign out" : undefined}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground ${collapsed ? "justify-center" : ""}`}
            >
              <LogOut className="h-5 w-5" /> {!collapsed && "Sign out"}
            </button>
          ) : (
            <Link to="/auth" className={`flex items-center gap-3 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground ${collapsed ? "justify-center" : ""}`}>
              {collapsed ? <User className="h-4 w-4" /> : "Sign in"}
            </Link>
          )}
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary">
            <Music2 className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-bold">Wavely</span>
        </Link>
        {user ? (
          <button onClick={signOut} className="text-sm text-muted-foreground" aria-label="Sign out">
            <LogOut className="h-5 w-5" />
          </button>
        ) : (
          <Link to="/auth" className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">Sign in</Link>
        )}
      </header>

      <main className={`transition-[padding] duration-200 ${mainPad}`}>
        <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>

      <nav className="fixed bottom-[88px] left-0 right-0 z-40 grid grid-cols-5 border-t border-border bg-sidebar md:hidden">
        <Link to="/" className="flex flex-col items-center gap-1 py-2 text-[10px] text-muted-foreground"><Home className="h-5 w-5" /> Home</Link>
        <Link to="/library" className="flex flex-col items-center gap-1 py-2 text-[10px] text-muted-foreground"><Library className="h-5 w-5" /> Library</Link>
        <Link to="/playlists" className="flex flex-col items-center gap-1 py-2 text-[10px] text-muted-foreground"><ListMusic className="h-5 w-5" /> Lists</Link>
        <Link to="/upload" className="flex flex-col items-center gap-1 py-2 text-[10px] text-muted-foreground"><Upload className="h-5 w-5" /> Upload</Link>
        <Link to="/profile" className="flex flex-col items-center gap-1 py-2 text-[10px] text-muted-foreground"><User className="h-5 w-5" /> Profile</Link>
      </nav>

      <Player />
      <QueuePanel />
    </div>
  );
}
