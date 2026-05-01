import { useCallback, useEffect, useState } from "react";

export type HistoryTrack = {
  sunoId: string;
  title: string | null;
  tags: string | null;
  audioUrl: string | null;
  imageUrl: string | null;
  duration: number | null;
  savedTrackId: string | null;
};

export type HistoryEntry = {
  taskId: string;
  prompt: string;
  style: string | null;
  instrumental: boolean;
  status: string;
  createdAt: number;
  tracks: HistoryTrack[];
};

const MAX_ENTRIES = 25;
const keyFor = (userId: string | null | undefined) =>
  userId ? `wavely:suno-history:${userId}` : `wavely:suno-history:anon`;

function read(userId: string | null | undefined): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(userId: string | null | undefined, entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // quota or serialization errors — ignore silently
  }
}

export function useSunoHistory(userId: string | null | undefined) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setEntries(read(userId));
  }, [userId]);

  const upsert = useCallback(
    (entry: HistoryEntry) => {
      setEntries((prev) => {
        const next = [entry, ...prev.filter((e) => e.taskId !== entry.taskId)].slice(0, MAX_ENTRIES);
        write(userId, next);
        return next;
      });
    },
    [userId],
  );

  const markTrackSaved = useCallback(
    (taskId: string, sunoId: string, savedTrackId: string) => {
      setEntries((prev) => {
        const next = prev.map((e) =>
          e.taskId !== taskId
            ? e
            : { ...e, tracks: e.tracks.map((t) => (t.sunoId === sunoId ? { ...t, savedTrackId } : t)) },
        );
        write(userId, next);
        return next;
      });
    },
    [userId],
  );

  const remove = useCallback(
    (taskId: string) => {
      setEntries((prev) => {
        const next = prev.filter((e) => e.taskId !== taskId);
        write(userId, next);
        return next;
      });
    },
    [userId],
  );

  const clear = useCallback(() => {
    setEntries([]);
    write(userId, []);
  }, [userId]);

  return { entries, upsert, markTrackSaved, remove, clear };
}
