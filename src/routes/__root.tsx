import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { PlayerProvider } from "@/context/PlayerContext";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found</p>
        <a href="/" className="mt-6 inline-block rounded-full bg-primary px-5 py-2 font-semibold text-primary-foreground">
          Go home
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Wavely — Your Personal Music Library" },
      { name: "description", content: "Upload, organize and stream your own music collection. A modern, Spotify-inspired audio player." },
      { property: "og:title", content: "Wavely — Your Personal Music Library" },
      { name: "twitter:title", content: "Wavely — Your Personal Music Library" },
      { property: "og:description", content: "Upload, organize and stream your own music collection. A modern, Spotify-inspired audio player." },
      { name: "twitter:description", content: "Upload, organize and stream your own music collection. A modern, Spotify-inspired audio player." },
      { name: "twitter:card", content: "summary" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <PlayerProvider>
      <Outlet />
      <Toaster />
    </PlayerProvider>
  );
}
