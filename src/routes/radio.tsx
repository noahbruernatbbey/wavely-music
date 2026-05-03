import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Radio as RadioIcon, Play, Pause, Loader2, Volume2, Plus, Trash2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/context/PlayerContext";
import { AppShell } from "@/components/AppShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Station = {
  id: string;
  name: string;
  tagline: string;
  genre: string;
  network: "SomaFM" | "iHeartRadio" | "Custom";
  url: string;
  hls?: boolean;
  color: string;
};

const CUSTOM_KEY = "wavely.customStations.v1";

const STATIONS: Station[] = [
  // iHeartRadio (HLS)
  { id: "ihr-z100", name: "Z100 New York", tagline: "New York's #1 Hit Music Station", genre: "Top 40", network: "iHeartRadio", url: "https://stream.revma.ihrhls.com/zc185/hls.m3u8", hls: true, color: "from-red-500/30 to-pink-500/10" },
  { id: "ihr-kiis", name: "102.7 KIIS FM", tagline: "Los Angeles' #1 Hit Music Station", genre: "Top 40", network: "iHeartRadio", url: "https://stream.revma.ihrhls.com/zc181/hls.m3u8", hls: true, color: "from-fuchsia-500/30 to-purple-500/10" },
  { id: "ihr-power106", name: "Power 106 LA", tagline: "LA's #1 for Hip Hop", genre: "Hip-Hop", network: "iHeartRadio", url: "https://stream.revma.ihrhls.com/zc6694/hls.m3u8", hls: true, color: "from-orange-500/30 to-red-500/10" },
  { id: "ihr-kissla", name: "103.5 KISS FM Chicago", tagline: "Chicago's #1 Hit Music Station", genre: "Top 40", network: "iHeartRadio", url: "https://stream.revma.ihrhls.com/zc197/hls.m3u8", hls: true, color: "from-pink-500/30 to-rose-500/10" },
  { id: "ihr-real925", name: "REAL 92.3 LA", tagline: "LA's New Hip Hop", genre: "Hip-Hop", network: "iHeartRadio", url: "https://stream.revma.ihrhls.com/zc4543/hls.m3u8", hls: true, color: "from-violet-500/30 to-indigo-500/10" },
  { id: "ihr-channelq", name: "Channel Q", tagline: "Pop hits and the LGBTQ+ community", genre: "Pop", network: "iHeartRadio", url: "https://stream.revma.ihrhls.com/zc7615/hls.m3u8", hls: true, color: "from-rose-500/30 to-pink-500/10" },
  // SomaFM
  { id: "soma-groove", name: "Groove Salad", tagline: "Chilled ambient/downtempo beats and grooves", genre: "Ambient", network: "SomaFM", url: "https://ice1.somafm.com/groovesalad-128-mp3", color: "from-emerald-500/30 to-teal-500/10" },
  { id: "soma-defcon", name: "DEF CON Radio", tagline: "Music for hacking — DEF CON", genre: "Electronic", network: "SomaFM", url: "https://ice1.somafm.com/defcon-128-mp3", color: "from-red-500/30 to-orange-500/10" },
  { id: "soma-lush", name: "Lush", tagline: "Sensuous and mellow vocals, mostly female", genre: "Vocal", network: "SomaFM", url: "https://ice1.somafm.com/lush-128-mp3", color: "from-pink-500/30 to-fuchsia-500/10" },
  { id: "soma-indie", name: "Indie Pop Rocks!", tagline: "New and classic indie pop tracks", genre: "Indie", network: "SomaFM", url: "https://ice1.somafm.com/indiepop-128-mp3", color: "from-yellow-500/30 to-amber-500/10" },
  { id: "soma-drone", name: "Drone Zone", tagline: "Atmospheric textures with minimal beats", genre: "Ambient", network: "SomaFM", url: "https://ice1.somafm.com/dronezone-128-mp3", color: "from-indigo-500/30 to-violet-500/10" },
  { id: "soma-secret", name: "Secret Agent", tagline: "Soundtrack for your stylish, mysterious life", genre: "Lounge", network: "SomaFM", url: "https://ice1.somafm.com/secretagent-128-mp3", color: "from-slate-500/30 to-zinc-500/10" },
  { id: "soma-beatblender", name: "Beat Blender", tagline: "A late night blend of deep-house and downtempo", genre: "House", network: "SomaFM", url: "https://ice1.somafm.com/beatblender-128-mp3", color: "from-purple-500/30 to-blue-500/10" },
  { id: "soma-bagel", name: "BAGeL Radio", tagline: "Indie rock that won't make you cringe", genre: "Rock", network: "SomaFM", url: "https://ice1.somafm.com/bagel-128-mp3", color: "from-orange-500/30 to-red-500/10" },
  { id: "soma-fluid", name: "Fluid", tagline: "Drown in the electronic sound of instrumental hiphop", genre: "Hip-Hop", network: "SomaFM", url: "https://ice1.somafm.com/fluid-128-mp3", color: "from-cyan-500/30 to-sky-500/10" },
  { id: "soma-poptron", name: "PopTron", tagline: "Electropop and indie dance rock with sparkle", genre: "Pop", network: "SomaFM", url: "https://ice1.somafm.com/poptron-128-mp3", color: "from-rose-500/30 to-pink-500/10" },
  { id: "soma-folk", name: "Folk Forward", tagline: "Indie folk, acoustic and Americana", genre: "Folk", network: "SomaFM", url: "https://ice1.somafm.com/folkfwd-128-mp3", color: "from-amber-500/30 to-yellow-500/10" },
  { id: "soma-thistle", name: "ThistleRadio", tagline: "Celtic and world music", genre: "World", network: "SomaFM", url: "https://ice1.somafm.com/thistle-128-mp3", color: "from-green-500/30 to-lime-500/10" },
];

export const Route = createFileRoute("/radio")({
  component: RadioPage,
  head: () => ({
    meta: [
      { title: "Live Radio — Wavely" },
      { name: "description", content: "Stream live iHeartRadio and SomaFM stations across genres — top 40, hip-hop, ambient, indie and more." },
    ],
  }),
});

function RadioPage() {
  const player = usePlayer();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [filter, setFilter] = useState<"All" | "iHeartRadio" | "SomaFM">("All");

  useEffect(() => {
    const el = new Audio();
    el.preload = "none";
    el.volume = volume;
    audioRef.current = el;
    const onPlaying = () => setLoading(false);
    const onWaiting = () => setLoading(true);
    const onError = () => { setLoading(false); setActiveId(null); };
    el.addEventListener("playing", onPlaying);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("error", onError);
    return () => {
      el.pause();
      hlsRef.current?.destroy();
      hlsRef.current = null;
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const stopHls = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  };

  const playStation = (s: Station) => {
    const el = audioRef.current;
    if (!el) return;
    if (activeId === s.id) {
      el.pause();
      stopHls();
      setActiveId(null);
      setLoading(false);
      return;
    }
    if (player.isPlaying) player.toggle();
    setLoading(true);
    stopHls();
    setActiveId(s.id);
    if (s.hls) {
      if (el.canPlayType("application/vnd.apple.mpegurl")) {
        el.src = s.url;
        el.play().catch(() => { setLoading(false); setActiveId(null); });
      } else if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;
        hls.loadSource(s.url);
        hls.attachMedia(el);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          el.play().catch(() => { setLoading(false); setActiveId(null); });
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) { stopHls(); setLoading(false); setActiveId(null); }
        });
      } else {
        setLoading(false);
        setActiveId(null);
      }
    } else {
      el.src = s.url;
      el.play().catch(() => { setLoading(false); setActiveId(null); });
    }
  };

  const active = STATIONS.find((s) => s.id === activeId);
  const visible = filter === "All" ? STATIONS : STATIONS.filter((s) => s.network === filter);


  return (
    <AppShell>
    <div className="space-y-8">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          <RadioIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Radio</h1>
          <p className="text-sm text-muted-foreground">Curated 24/7 streams across genres</p>
        </div>
      </header>

      {active && (
        <div className={`flex flex-col gap-4 rounded-xl border bg-gradient-to-br ${active.color} p-5 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Now streaming</div>
              <div className="text-lg font-semibold">{active.name}</div>
              <div className="text-xs text-muted-foreground">{active.tagline}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider value={[volume * 100]} onValueChange={(v) => setVolume((v[0] ?? 0) / 100)} max={100} step={1} className="w-32" />
            <button
              onClick={() => active && playStation(active)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
              aria-label="Stop"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(["All", "iHeartRadio", "SomaFM"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
              filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((s) => {
          const isActive = activeId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => playStation(s)}
              className={`group relative overflow-hidden rounded-xl border bg-gradient-to-br ${s.color} p-5 text-left transition-all hover:scale-[1.02] hover:border-primary/50 ${isActive ? "border-primary" : ""}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.genre}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">· {s.network}</span>
                  </div>
                  <div className="mt-1 text-lg font-bold">{s.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{s.tagline}</div>
                </div>
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-background/80 text-foreground shadow group-hover:bg-primary group-hover:text-primary-foreground">
                  {isActive && loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isActive ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 translate-x-0.5" />
                  )}
                </div>
              </div>
              {isActive && (
                <div className="mt-3 flex items-center gap-2 text-xs font-medium text-red-500">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  LIVE
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">Streams provided by iHeartRadio and SomaFM.</p>
    </div>
    </AppShell>
  );
}
