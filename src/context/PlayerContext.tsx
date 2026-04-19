import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { signedUrl } from "@/lib/storage";

export type Track = Tables<"tracks">;
export type RepeatMode = "off" | "all" | "one";

interface PlayerCtx {
  current: Track | null;
  queue: Track[];
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Number of times to repeat the current song when repeat==="one". 0 = infinite. */
  repeatCount: number;
  /** Times the current song has already auto-replayed in "one" mode. */
  repeatPlayed: number;
  queueOpen: boolean;
  play: (track: Track, queue?: Track[]) => void | Promise<void>;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (s: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setRepeatCount: (n: number) => void;
  setQueueOpen: (open: boolean) => void;
  removeFromQueue: (id: string) => void;
}

const Ctx = createContext<PlayerCtx | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [repeatCount, setRepeatCountState] = useState(0); // 0 = infinite
  const [repeatPlayed, setRepeatPlayed] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);

  // Refs to avoid stale closures inside the audio "ended" listener
  const stateRef = useRef({ current, queue, shuffle, repeat, repeatCount, repeatPlayed });
  stateRef.current = { current, queue, shuffle, repeat, repeatCount, repeatPlayed };

  const play = useCallback(async (track: Track, q?: Track[]) => {
    const el = audioRef.current;
    if (!el) return;
    if (stateRef.current.current?.id !== track.id) {
      const url = await signedUrl("audio", track.audio_path);
      if (!url) return;
      el.src = url;
      setCurrent(track);
      setProgress(0);
      setRepeatPlayed(0);
    }
    if (q) setQueue(q);
    el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, []);

  const advance = useCallback((direction: 1 | -1) => {
    const { current: cur, queue: q, shuffle: sh } = stateRef.current;
    if (!cur || q.length === 0) return;
    let nextTrack: Track | undefined;
    if (sh && q.length > 1) {
      const others = q.filter((t) => t.id !== cur.id);
      nextTrack = others[Math.floor(Math.random() * others.length)];
    } else {
      const i = q.findIndex((t) => t.id === cur.id);
      const idx = (i + direction + q.length) % q.length;
      nextTrack = q[idx];
    }
    if (nextTrack) play(nextTrack, q);
  }, [play]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = new Audio();
    el.volume = volume;
    audioRef.current = el;
    const onTime = () => setProgress(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onEnd = () => {
      const { repeat: r, repeatCount: rc, repeatPlayed: rp, queue: q, current: cur } = stateRef.current;
      // Repeat one mode
      if (r === "one") {
        // 0 = infinite; otherwise repeat rc times then stop or advance
        if (rc === 0 || rp + 1 < rc) {
          setRepeatPlayed((p) => p + 1);
          el.currentTime = 0;
          el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
          return;
        }
        // exhausted
        setRepeatPlayed(0);
        if (r === "one") {
          // After finishing the count, stop unless repeat all is also implied; we just stop.
          setIsPlaying(false);
          return;
        }
      }
      // Repeat all or off
      if (cur && q.length > 0) {
        const i = q.findIndex((t) => t.id === cur.id);
        const isLast = i === q.length - 1;
        if (isLast && r === "off" && !stateRef.current.shuffle) {
          setIsPlaying(false);
          return;
        }
        advance(1);
      } else {
        setIsPlaying(false);
      }
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnd);
    return () => {
      el.pause();
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el || !current) return;
    if (el.paused) {
      el.play().then(() => setIsPlaying(true));
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const next = () => advance(1);
  const prev = () => advance(-1);

  const seek = (s: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = s;
    setProgress(s);
  };

  const setVolume = (v: number) => {
    const el = audioRef.current;
    const clamped = Math.max(0, Math.min(1, v));
    if (el) el.volume = clamped;
    setVolumeState(clamped);
  };

  const toggleShuffle = () => setShuffle((s) => !s);
  const cycleRepeat = () => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"));
  const setRepeatCount = (n: number) => { setRepeatCountState(Math.max(0, Math.floor(n))); setRepeatPlayed(0); };
  const removeFromQueue = (id: string) => setQueue((q) => q.filter((t) => t.id !== id));

  return (
    <Ctx.Provider value={{
      current, queue, isPlaying, progress, duration, volume, shuffle, repeat, repeatCount, repeatPlayed, queueOpen,
      play, toggle, next, prev, seek, setVolume, toggleShuffle, cycleRepeat, setRepeatCount, setQueueOpen, removeFromQueue,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePlayer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used within PlayerProvider");
  return v;
}
