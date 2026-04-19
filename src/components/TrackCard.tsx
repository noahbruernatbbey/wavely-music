import { useSignedUrl } from "@/hooks/useSignedUrl";
import { usePlayer, type Track } from "@/context/PlayerContext";
import { useLikedIds } from "@/hooks/useLikes";
import { useAuth } from "@/hooks/useAuth";
import { Play, Pause, Music2, Pencil, Trash2, Heart } from "lucide-react";

export function TrackCard({
  track,
  queue,
  onEdit,
  onDelete,
}: {
  track: Track;
  queue: Track[];
  onEdit?: (t: Track) => void;
  onDelete?: (t: Track) => void;
}) {
  const { current, isPlaying, play, toggle } = usePlayer();
  const { user } = useAuth();
  const { ids, toggle: toggleLike } = useLikedIds();
  const active = current?.id === track.id;
  const playing = active && isPlaying;
  const cover = useSignedUrl("covers", track.cover_path);
  const liked = ids.has(track.id);

  return (
    <div className="group relative flex flex-col gap-3 rounded-lg bg-card p-3 transition-all hover:bg-elevated">
      <div className="relative aspect-square overflow-hidden rounded-md bg-muted shadow-md">
        {cover ? (
          <img src={cover} alt={track.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music2 className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        {user && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleLike(track.id); }}
            className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 backdrop-blur transition-all hover:scale-110"
            aria-label={liked ? "Unlike" : "Like"}
            title={liked ? "Remove from Liked Songs" : "Add to Liked Songs"}
          >
            <Heart className={`h-4 w-4 ${liked ? "text-primary" : "text-foreground"}`} fill={liked ? "currentColor" : "none"} />
          </button>
        )}
        <button
          onClick={() => (active ? toggle() : play(track, queue))}
          className="absolute bottom-2 right-2 flex h-11 w-11 translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-xl transition-all hover:scale-105 group-hover:translate-y-0 group-hover:opacity-100 data-[active=true]:translate-y-0 data-[active=true]:opacity-100"
          data-active={active}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5 translate-x-[1px]" fill="currentColor" />}
        </button>
      </div>
      <div className="min-w-0">
        <div className="truncate font-semibold">{track.title}</div>
        <div className="truncate text-sm text-muted-foreground">{track.artist}</div>
      </div>
      {(onEdit || onDelete) && (
        <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          {onEdit && (
            <button onClick={() => onEdit(track)} className="flex-1 rounded-md bg-secondary px-2 py-1 text-xs hover:bg-muted" aria-label="Edit">
              <Pencil className="mx-auto h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(track)} className="flex-1 rounded-md bg-secondary px-2 py-1 text-xs text-destructive hover:bg-muted" aria-label="Delete">
              <Trash2 className="mx-auto h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
