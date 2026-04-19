import { useSignedUrl } from "@/hooks/useSignedUrl";
import { Music2 } from "lucide-react";

export function CoverThumb({ path, alt = "", className = "h-full w-full object-cover" }: { path: string | null | undefined; alt?: string; className?: string }) {
  const url = useSignedUrl("covers", path);
  if (url) return <img src={url} alt={alt} className={className} loading="lazy" />;
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <Music2 className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
