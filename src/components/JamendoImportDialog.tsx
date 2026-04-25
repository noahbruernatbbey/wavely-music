import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchJamendo, importJamendoTrack, type JamendoTrack } from "@/server/jamendo.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Loader2, Music2, X, Download } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function JamendoImportDialog({ open, onClose, onImported }: Props) {
  const search = useServerFn(searchJamendo);
  const importTrack = useServerFn(importJamendoTrack);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JamendoTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  if (!open) return null;

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await search({ data: { query: query.trim() } });
      if (res.error) {
        toast.error(res.error);
        setResults([]);
      } else {
        setResults(res.results);
        if (res.results.length === 0) toast.info("No results found");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const doImport = async (t: JamendoTrack) => {
    setImportingId(t.id);
    try {
      await importTrack({
        data: {
          jamendoId: t.id,
          title: t.name,
          artist: t.artist_name,
          audioUrl: t.audiodownload || t.audio,
          coverUrl: t.image || null,
          durationSeconds: t.duration ?? null,
        },
      });
      toast.success(`Imported "${t.name}"`);
      onImported();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-lg font-bold">Import from Jamendo</h2>
            <p className="text-xs text-muted-foreground">Free, Creative-Commons-licensed music</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-elevated">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={runSearch} className="flex gap-2 border-b border-border p-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or artist…"
              className="w-full rounded-md border border-border bg-input py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </button>
        </form>

        <div className="flex-1 overflow-y-auto p-2">
          {results.length === 0 && !searching && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <Music2 className="h-10 w-10 opacity-40" />
              <p className="text-sm">Search Jamendo's catalog to import a track</p>
            </div>
          )}
          <ul className="space-y-1">
            {results.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-elevated"
              >
                <img
                  src={t.image}
                  alt=""
                  className="h-12 w-12 flex-shrink-0 rounded object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{t.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {t.artist_name} · {Math.floor(t.duration / 60)}:{String(t.duration % 60).padStart(2, "0")}
                  </div>
                </div>
                <button
                  onClick={() => doImport(t)}
                  disabled={importingId !== null}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {importingId === t.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Import
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
