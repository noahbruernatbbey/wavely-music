import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { publicUrl } from "@/lib/storage";

export type Track = Tables<"tracks">;

interface PlayerCtx {
  current: Track | null;
  queue: Track[];
  isPlaying: boolean;
  progress: number;
  duration: number;
  play: (track: Track, queue?: Track[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (s: number) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const Ctx = createContext<PlayerCtx | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = new Audio();
    audioRef.current = el;
    const onTime = () => setProgress(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onEnd = () => setIsPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnd);
    return () => {
      el.pause();
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnd);
    };
  }, []);

  const play = (track: Track, q?: Track[]) => {
    const el = audioRef.current;
    if (!el) return;
    const url = publicUrl("audio", track.audio_path);
    if (!url) return;
    if (current?.id !== track.id) {
      el.src = url;
      setCurrent(track);
      setProgress(0);
    }
    if (q) setQueue(q);
    el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  };

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

  const next = () => {
    if (!current || queue.length === 0) return;
    const i = queue.findIndex((t) => t.id === current.id);
    const n = queue[(i + 1) % queue.length];
    if (n) play(n, queue);
  };

  const prev = () => {
    if (!current || queue.length === 0) return;
    const i = queue.findIndex((t) => t.id === current.id);
    const p = queue[(i - 1 + queue.length) % queue.length];
    if (p) play(p, queue);
  };

  const seek = (s: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = s;
    setProgress(s);
  };

  return (
    <Ctx.Provider value={{ current, queue, isPlaying, progress, duration, play, toggle, next, prev, seek, audioRef }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePlayer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used within PlayerProvider");
  return v;
}
