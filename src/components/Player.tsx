import { usePlayer } from "@/context/PlayerContext";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { Play, Pause, SkipBack, SkipForward, Music2, Shuffle, Repeat, Repeat1, ListMusic, Volume2, VolumeX } from "lucide-react";

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export function Player() {
  const {
    current, isPlaying, progress, duration, volume, shuffle, repeat, repeatCount, queueOpen,
    toggle, next, prev, seek, setVolume, toggleShuffle, cycleRepeat, setRepeatCount, setQueueOpen,
  } = usePlayer();
  const cover = useSignedUrl("covers", current?.cover_path);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-[var(--player)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-3 py-3 sm:gap-4 sm:px-6">
        {/* Track info */}
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-[0_0_26%]">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="h-12 w-12 flex-shrink-0 rounded-md object-cover shadow-lg sm:h-14 sm:w-14"
            />
          ) : (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-muted sm:h-14 sm:w-14">
              <Music2 className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{current?.title ?? "Nothing playing"}</div>
            <div className="truncate text-xs text-muted-foreground">{current?.artist ?? "—"}</div>
          </div>
          {isPlaying && (
            <div className="ml-2 hidden h-4 items-end gap-[2px] sm:flex">
              <span className="eq-bar h-full w-[2px] bg-primary" />
              <span className="eq-bar h-full w-[2px] bg-primary" />
              <span className="eq-bar h-full w-[2px] bg-primary" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-1 flex-col items-center gap-1 sm:flex-[0_0_46%]">
          <div className="flex items-center gap-3 sm:gap-5">
            <button
              onClick={toggleShuffle}
              className={`hidden transition-colors sm:block ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              aria-label="Shuffle"
              title="Shuffle"
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <button onClick={prev} disabled={!current} className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30" aria-label="Previous">
              <SkipBack className="h-5 w-5" fill="currentColor" />
            </button>
            <button
              onClick={toggle}
              disabled={!current}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 disabled:opacity-30 sm:h-10 sm:w-10"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" />}
            </button>
            <button onClick={next} disabled={!current} className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30" aria-label="Next">
              <SkipForward className="h-5 w-5" fill="currentColor" />
            </button>
            <div className="hidden items-center gap-1 sm:flex">
              <button
                onClick={cycleRepeat}
                className={`transition-colors ${repeat !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                aria-label="Repeat"
                title={`Repeat: ${repeat}`}
              >
                {repeat === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
              </button>
              {repeat === "one" && (
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(parseInt(e.target.value) || 0)}
                  className="w-10 rounded-md border border-border bg-input px-1 py-0.5 text-center text-[11px] outline-none focus:ring-1 focus:ring-primary"
                  title="Repeat count (0 = infinite)"
                />
              )}
            </div>
          </div>
          <div className="hidden w-full items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span className="w-9 text-right tabular-nums">{fmt(progress)}</span>
            <input
              type="range" min={0} max={duration || 0} step={0.1} value={progress}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="track-slider flex-1" disabled={!current}
            />
            <span className="w-9 tabular-nums">{fmt(duration)}</span>
          </div>
        </div>

        {/* Right: queue + volume */}
        <div className="hidden items-center justify-end gap-3 sm:flex sm:flex-[0_0_28%]">
          <button
            onClick={() => setQueueOpen(!queueOpen)}
            className={`transition-colors ${queueOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            aria-label="Queue"
            title="Queue"
          >
            <ListMusic className="h-4 w-4" />
          </button>
          <button
            onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={volume > 0 ? "Mute" : "Unmute"}
          >
            {volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <input
            type="range" min={0} max={1} step={0.01} value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="track-slider w-24"
            aria-label="Volume"
          />
        </div>
      </div>

      {/* Mobile progress bar */}
      <div className="px-3 pb-2 sm:hidden">
        <input
          type="range" min={0} max={duration || 0} step={0.1} value={progress}
          onChange={(e) => seek(parseFloat(e.target.value))}
          className="track-slider w-full" disabled={!current}
        />
      </div>
    </div>
  );
}
