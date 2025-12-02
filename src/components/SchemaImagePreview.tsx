import { useState } from "react";
import { ImageOff, ExternalLink } from "lucide-react";

interface SchemaImagePreviewProps {
  label: string;
  url: string | undefined;
  objectFit?: "cover" | "contain";
}

export function SchemaImagePreview({ label, url, objectFit = "cover" }: SchemaImagePreviewProps) {
  const [hasError, setHasError] = useState(false);

  // Extract filename or truncated URL for display
  const getDisplayUrl = (fullUrl: string): string => {
    try {
      const urlObj = new URL(fullUrl);
      // For Next.js image URLs, try to extract the inner filename
      if (urlObj.pathname === "/_next/image") {
        const innerUrl = urlObj.searchParams.get("url");
        if (innerUrl) {
          const decoded = decodeURIComponent(innerUrl);
          const parts = decoded.split("/");
          const filename = parts[parts.length - 1]?.split("?")[0];
          if (filename) {
            return filename.length > 40 ? `...${filename.slice(-40)}` : filename;
          }
        }
      }
      // For regular URLs, show the path
      const path = urlObj.pathname;
      return path.length > 50 ? `...${path.slice(-50)}` : path;
    } catch {
      return fullUrl.length > 50 ? `...${fullUrl.slice(-50)}` : fullUrl;
    }
  };

  if (!url) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="bg-muted rounded-lg border border-border h-32 flex flex-col items-center justify-center gap-2">
          <ImageOff className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">Not set in schema</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="bg-muted rounded-lg border border-border h-32 flex flex-col items-center justify-center gap-2">
          <ImageOff className="h-6 w-6 text-destructive/50" />
          <p className="text-xs text-muted-foreground">Failed to load</p>
        </div>
        <p className="text-xs text-muted-foreground break-all font-mono" title={url}>
          {getDisplayUrl(url)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block bg-background rounded-lg border border-border overflow-hidden h-32 relative group hover:border-primary/50 transition-colors"
      >
        <img
          src={url}
          alt={label}
          className={`w-full h-full ${objectFit === "contain" ? "object-contain p-2" : "object-cover"}`}
          onError={() => setHasError(true)}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <ExternalLink className="h-5 w-5 text-white drop-shadow-md" />
        </div>
      </a>
      <p className="text-xs text-muted-foreground font-mono truncate" title={url}>
        {getDisplayUrl(url)}
      </p>
    </div>
  );
}
