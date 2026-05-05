import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Radio as RadioIcon, Play, Pause, Loader2, Volume2, Plus, Trash2, Globe, Lock, Download, Upload } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/context/PlayerContext";
import { AppShell } from "@/components/AppShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const SUGGESTED_URLS: { name: string; url: string }[] = [
  { name: "Heart 70s", url: "https://media-ssl.musicradio.com/Heart70s" },
  { name: "Heart 80s", url: "https://media-ssl.musicradio.com/Heart80s" },
  { name: "Heart 90s", url: "https://media-ssl.musicradio.com/Heart90s" },
  { name: "Heart 00s", url: "https://media-ssl.musicradio.com/Heart00s" },
  { name: "Heart Dance", url: "https://media-ssl.musicradio.com/HeartDance" },
  { name: "Capital UK", url: "https://media-ssl.musicradio.com/CapitalUK" },
  { name: "Smooth UK", url: "https://media-ssl.musicradio.com/SmoothUK" },
  { name: "Classic FM", url: "https://media-ssl.musicradio.com/ClassicFM" },
  { name: "Gold", url: "https://media-ssl.musicradio.com/Gold" },
  { name: "LBC UK", url: "https://media-ssl.musicradio.com/LBCUK" },
  { name: "BBC Radio 1 (HLS)", url: "https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_radio_one/bbc_radio_one.isml/bbc_radio_one-audio%3d96000.norewind.m3u8" },
  { name: "KEXP 90.3 Seattle", url: "https://kexp-mp3-128.streamguys1.com/kexp128.mp3" },
];

type Station = {
  id: string;
  name: string;
  tagline: string;
  genre: string;
  network: "SomaFM" | "iHeartRadio" | "Custom";
  url: string;
  hls?: boolean;
  color: string;
  ownerId?: string | null;
  isPublic?: boolean;
};

const CUSTOM_KEY = "wavely.customStations.v1";

const STATIONS: Station[] = [
  { id: "ihr-z100", name: "Z100 New York", tagline: "New York's #1 Hit Music Station", genre: "Top 40", network: "iHeartRadio", url: "https://stream.revma.ihrhls.com/zc185/hls.m3u8", hls: true, color: "from-red-500/30 to-pink-500/10" },
  { id: "ihr-kiis", name: "102.7 KIIS FM", tagline: "Los Angeles' #1 Hit Music Station", genre: "Top 40", network: "iHeartRadio", url: "https://stream.revma.ihrhls.com/zc181/hls.m3u8", hls: true, color: "from-fuchsia-500/30 to-purple-500/10" },
  { id: "ihr-power106", name: "Power 106 LA", tagline: "LA's #1 for Hip Hop", genre: "Hip-Hop", network: "iHeartRadio", url: "https://stream.revma.ihrhls.com/zc6694/hls.m3u8", hls: true, color: "from-orange-500/30 to-red-500/10" },
  { id: "ihr-kissla", name: "103.5 KISS FM Chicago", tagline: "Chicago's #1 Hit Music Station", genre: "Top 40", network: "iHeartRadio", url: "https://stream.revma.ihrhls.com/zc197/hls.m3u8", hls: true, color: "from-pink-500/30 to-rose-500/10" },
  { id: "ihr-real925", name: "REAL 92.3 LA", tagline: "LA's New Hip Hop", genre: "Hip-Hop", network: "iHeartRadio", url: "https://stream.revma.ihrhls.com/zc4543/hls.m3u8", hls: true, color: "from-violet-500/30 to-indigo-500/10" },
  { id: "ihr-channelq", name: "Channel Q", tagline: "Pop hits and the LGBTQ+ community", genre: "Pop", network: "iHeartRadio", url: "https://stream.revma.ihrhls.com/zc7615/hls.m3u8", hls: true, color: "from-rose-500/30 to-pink-500/10" },
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
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [filter, setFilter] = useState<"All" | "iHeartRadio" | "SomaFM" | "Custom">("All");
  const [customStations, setCustomStations] = useState<Station[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newPublic, setNewPublic] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load custom stations: from DB if signed in (own + public), else localStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (user) {
        const { data } = await supabase
          .from("custom_stations")
          .select("id,user_id,name,url,hls,is_public")
          .or(`user_id.eq.${user.id},is_public.eq.true`)
          .order("created_at", { ascending: false });
        if (cancelled) return;
        setCustomStations(
          (data ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            tagline: r.user_id === user.id ? "Your station" : "Community station",
            genre: "Custom",
            network: "Custom" as const,
            url: r.url,
            hls: r.hls,
            color: "from-sky-500/30 to-cyan-500/10",
            ownerId: r.user_id,
            isPublic: r.is_public,
          })),
        );
      } else {
        try {
          const raw = localStorage.getItem(CUSTOM_KEY);
          if (raw) setCustomStations(JSON.parse(raw));
        } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const persistLocal = (next: Station[]) => {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const addCustom = async () => {
    const name = newName.trim();
    const url = newUrl.trim();
    if (!name || name.length > 60) { setFormError("Enter a name (1–60 characters)."); return; }
    if (!/^https?:\/\//i.test(url)) { setFormError("URL must start with http:// or https://"); return; }
    const isHls = /\.m3u8(\?|$)/i.test(url);

    if (user) {
      const { data, error } = await supabase
        .from("custom_stations")
        .insert({ user_id: user.id, name, url, hls: isHls, is_public: newPublic })
        .select("id,user_id,name,url,hls,is_public")
        .single();
      if (error || !data) { setFormError(error?.message ?? "Failed to save station"); return; }
      setCustomStations([{
        id: data.id, name: data.name, tagline: "Your station", genre: "Custom", network: "Custom",
        url: data.url, hls: data.hls, color: "from-sky-500/30 to-cyan-500/10",
        ownerId: data.user_id, isPublic: data.is_public,
      }, ...customStations]);
      toast.success("Station added");
    } else {
      const station: Station = {
        id: `custom-${Date.now()}`, name, tagline: "Custom station", genre: "Custom",
        network: "Custom", url, hls: isHls, color: "from-sky-500/30 to-cyan-500/10",
      };
      const next = [station, ...customStations];
      setCustomStations(next);
      persistLocal(next);
    }
    setNewName(""); setNewUrl(""); setNewPublic(false); setFormError(null);
    setDialogOpen(false);
  };

  const removeCustom = async (id: string) => {
    if (activeId === id) {
      audioRef.current?.pause();
      stopHls();
      setActiveId(null);
    }
    if (user) {
      const { error } = await supabase.from("custom_stations").delete().eq("id", id);
      if (error) { toast.error(error.message); return; }
    }
    const next = customStations.filter((s) => s.id !== id);
    setCustomStations(next);
    if (!user) persistLocal(next);
  };

  const togglePublic = async (s: Station) => {
    if (!user || s.ownerId !== user.id) return;
    const nextVal = !s.isPublic;
    const { error } = await supabase.from("custom_stations").update({ is_public: nextVal }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    setCustomStations((cs) => cs.map((x) => x.id === s.id ? { ...x, isPublic: nextVal } : x));
    toast.success(nextVal ? "Station is now public" : "Station is now private");
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const exportStations = () => {
    const mine = customStations.filter((s) => !user || !s.ownerId || s.ownerId === user.id);
    if (mine.length === 0) { toast.error("No custom stations to export"); return; }
    const payload = {
      type: "wavely.customStations",
      version: 1,
      exportedAt: new Date().toISOString(),
      stations: mine.map((s) => ({ name: s.name, url: s.url, hls: !!s.hls, isPublic: !!s.isPublic })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wavely-stations-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${mine.length} station${mine.length === 1 ? "" : "s"}`);
  };

  const importStations = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : parsed?.stations;
      if (!Array.isArray(list)) throw new Error("Invalid file format");
      const valid = list
        .map((r: { name?: unknown; url?: unknown; hls?: unknown; isPublic?: unknown }) => ({
          name: typeof r?.name === "string" ? r.name.trim() : "",
          url: typeof r?.url === "string" ? r.url.trim() : "",
          hls: typeof r?.hls === "boolean" ? r.hls : false,
          isPublic: typeof r?.isPublic === "boolean" ? r.isPublic : false,
        }))
        .filter((r) => r.name && /^https?:\/\//i.test(r.url));
      if (valid.length === 0) { toast.error("No valid stations found in file"); return; }

      const existingUrls = new Set(customStations.map((s) => s.url));
      const fresh = valid.filter((r) => !existingUrls.has(r.url));
      if (fresh.length === 0) { toast.info("All stations already imported"); return; }

      if (user) {
        const rows = fresh.map((r) => ({
          user_id: user.id, name: r.name, url: r.url,
          hls: r.hls || /\.m3u8(\?|$)/i.test(r.url), is_public: r.isPublic,
        }));
        const { data, error } = await supabase.from("custom_stations").insert(rows).select("id,user_id,name,url,hls,is_public");
        if (error || !data) { toast.error(error?.message ?? "Import failed"); return; }
        setCustomStations([
          ...data.map((d) => ({
            id: d.id, name: d.name, tagline: "Your station", genre: "Custom",
            network: "Custom" as const, url: d.url, hls: d.hls,
            color: "from-sky-500/30 to-cyan-500/10", ownerId: d.user_id, isPublic: d.is_public,
          })),
          ...customStations,
        ]);
      } else {
        const added: Station[] = fresh.map((r, i) => ({
          id: `custom-${Date.now()}-${i}`, name: r.name, tagline: "Custom station",
          genre: "Custom", network: "Custom", url: r.url,
          hls: r.hls || /\.m3u8(\?|$)/i.test(r.url),
          color: "from-sky-500/30 to-cyan-500/10",
        }));
        const next = [...added, ...customStations];
        setCustomStations(next);
        persistLocal(next);
      }
      toast.success(`Imported ${fresh.length} station${fresh.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error("Import failed", { description: e instanceof Error ? e.message : "Invalid JSON file" });
    }
  };

  useEffect(() => {
    const el = new Audio();
    el.preload = "none";
    el.volume = volume;
    audioRef.current = el;
    const onPlaying = () => setLoading(false);
    const onWaiting = () => setLoading(true);
    const onError = () => {
      setLoading(false);
      setActiveId((id) => {
        if (id) toast.error("Stream failed to play", { description: "The station may be offline, geo-restricted, or blocked by CORS." });
        return null;
      });
    };
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

  const failPlayback = (msg?: string) => {
    setLoading(false);
    setActiveId(null);
    toast.error("Stream failed to play", {
      description: msg ?? "The station may be offline, geo-restricted, or blocked by CORS.",
    });
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
        el.play().catch(() => failPlayback());
      } else if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;
        hls.loadSource(s.url);
        hls.attachMedia(el);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          el.play().catch(() => failPlayback());
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) { stopHls(); failPlayback(`HLS error: ${data.details ?? data.type}`); }
        });
      } else {
        failPlayback("HLS playback not supported in this browser.");
      }
    } else {
      el.src = s.url;
      el.play().catch(() => failPlayback());
    }
  };

  const allStations = [...customStations, ...STATIONS];
  const active = allStations.find((s) => s.id === activeId);
  const visible = filter === "All" ? allStations : allStations.filter((s) => s.network === filter);


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

      <div className="flex flex-wrap items-center gap-2">
        {(["All", "iHeartRadio", "SomaFM", "Custom"] as const).map((f) => (
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
        <button
          onClick={() => setDialogOpen(true)}
          className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/60 px-4 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
        >
          <Plus className="h-3.5 w-3.5" />
          Add station
        </button>
        <button
          onClick={exportStations}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          title="Download your custom stations as a JSON file"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          title="Import stations from a JSON file"
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importStations(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((s) => {
          const isActive = activeId === s.id;
          const isMine = s.network === "Custom" && (!user || s.ownerId === user?.id || !s.ownerId);
          const ownedByMe = s.network === "Custom" && user && s.ownerId === user.id;
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
                    {s.network === "Custom" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/50 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                        {s.isPublic ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                        {s.isPublic ? "Public" : "Private"}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-lg font-bold">{s.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{s.tagline}</div>
                </div>
                <div className="flex items-center gap-2">
                  {ownedByMe && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); togglePublic(s); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); togglePublic(s); } }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-background/60 text-muted-foreground hover:bg-primary hover:text-primary-foreground"
                      aria-label={s.isPublic ? "Make private" : "Make public"}
                      title={s.isPublic ? "Make private" : "Make public"}
                    >
                      {s.isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    </span>
                  )}
                  {isMine && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); removeCustom(s.id); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); removeCustom(s.id); } }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-background/60 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                      aria-label="Remove station"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  )}
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

      <p className="text-xs text-muted-foreground">Streams provided by iHeartRadio and SomaFM. {user ? "Your custom stations sync to your account." : "Sign in to sync custom stations across devices."}</p>
    </div>

    <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setFormError(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a custom station</DialogTitle>
          <DialogDescription>
            Paste a direct audio stream URL (MP3, AAC, or HLS .m3u8). Some broadcasters geo-restrict or block browsers via CORS — if a stream won't play, try one of the suggestions below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="station-name">Station name</Label>
            <Input id="station-name" value={newName} maxLength={60} onChange={(e) => setNewName(e.target.value)} placeholder="My favorite radio" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="station-url">Stream URL</Label>
            <Input id="station-url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://example.com/stream.mp3 or .m3u8" />
          </div>
          {user && (
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
              <div>
                <Label htmlFor="station-public" className="cursor-pointer">Make public</Label>
                <p className="text-[11px] text-muted-foreground">Other users can discover and play this station.</p>
              </div>
              <Switch id="station-public" checked={newPublic} onCheckedChange={setNewPublic} />
            </div>
          )}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Suggested stations</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_URLS.map((sug) => (
                <button
                  key={sug.url}
                  type="button"
                  onClick={() => { setNewUrl(sug.url); if (!newName.trim()) setNewName(sug.name); }}
                  className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs hover:border-primary hover:text-primary"
                >
                  {sug.name}
                </button>
              ))}
            </div>
          </div>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={addCustom}>Add station</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </AppShell>
  );
}
