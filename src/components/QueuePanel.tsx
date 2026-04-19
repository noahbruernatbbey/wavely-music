import { usePlayer } from "@/context/PlayerContext";
import { CoverThumb } from "./CoverThumb";
import { X, Play, Pause, Trash2 } from "lucide-react";

export function QueuePanel() {
  const { queueOpen, setQueueOpen, queue, current, isPlaying, play, toggle, removeFromQueue } = usePlayer();

  if (!queueOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] sm:inset-auto sm:bottom-[96px] sm:right-4 sm:top-4">
      {/* mobile overlay */}
      <div className="absolute inset-0 bg-black/50 sm:hidden" onClick={() => setQueueOpen(false)} />
      <aside className="animate-slide-in-right absolute right-0 top-0 flex h-full w-full max-w-sm flex-col rounded-none border border-border bg-card shadow-2xl sm:h-[calc(100vh-120px)] sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-bold">Queue</h3>
          <button onClick={() => setQueueOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close queue">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {queue.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">Queue is empty. Play a song to get started.</div>
          ) : (
            queue.map((t) => {
              const active = current?.id === t.id;
              return (
                <div
                  key={t.id}
                  className={`group flex items-center gap-3 rounded-md px-2 py-2 transition-colors ${active ? "bg-secondary" : "hover:bg-secondary/50"}`}
                >
                  <button
                    onClick={() => (active ? toggle() : play(t, queue))}
                    className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded"
                  >
                    <CoverThumb path={t.cover_path} />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      {active && isPlaying ? <Pause className="h-4 w-4 text-white" fill="white" /> : <Play className="h-4 w-4 text-white" fill="white" />}
                    </div>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm font-medium ${active ? "text-primary" : ""}`}>{t.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
                  </div>
                  <button
                    onClick={() => removeFromQueue(t.id)}
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    aria-label="Remove from queue"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
