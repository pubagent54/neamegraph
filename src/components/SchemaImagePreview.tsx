import { useState, useEffect } from "react";
import { ImageOff, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type ImageSource = 'schema' | 'metadata' | 'none';

interface SchemaImagePreviewProps {
  label: string;
  url: string | undefined;
  objectFit?: "cover" | "contain";
  source?: ImageSource;
  fallbackUrl?: string | null;
}

export function SchemaImagePreview({ 
  label, 
  url, 
  objectFit = "cover", 
  source = 'none',
  fallbackUrl 
}: SchemaImagePreviewProps) {
  const [hasError, setHasError] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string | undefined>(url || undefined);
  const [currentSource, setCurrentSource] = useState<ImageSource>(source);

  // Reset state when props change
  useEffect(() => {
    setDisplayUrl(url || undefined);
    setCurrentSource(source);
    setHasError(false);
  }, [url, source]);

  const handleImageError = () => {
    // If schema image fails and we have a fallback, try the fallback
    if (currentSource === 'schema' && fallbackUrl) {
      setDisplayUrl(fallbackUrl);
      setCurrentSource('metadata');
      setHasError(false);
    } else {
      setHasError(true);
    }
  };

  const getSourceLabel = () => {
    if (currentSource === 'schema') return 'From schema';
    if (currentSource === 'metadata') return 'From page metadata';
    return null;
  };

  // Extract filename or truncated URL for display
  // Handles Next.js _next/image URLs by extracting the inner filename
  const getDisplayUrl = (fullUrl: string): string => {
    try {
      const urlObj = new URL(fullUrl);
      
      // For Next.js image URLs, extract and display the inner filename
      if (urlObj.pathname === "/_next/image") {
        const innerUrl = urlObj.searchParams.get("url");
        if (innerUrl) {
          const decoded = decodeURIComponent(innerUrl);
          // Get just the filename from the decoded inner URL
          const parts = decoded.split("/");
          const rawFilename = parts[parts.length - 1]?.split("?")[0] || "";
          
          // Clean up common filename patterns
          const cleanFilename = rawFilename
            .replace(/^RS\d+_/, "") // Remove RS12345_ prefix
            .replace(/_mpr.*$/, "") // Remove _mpr suffix
            .replace(/%20/g, " ")   // Replace URL-encoded spaces
            .replace(/\(\d+\)/g, ""); // Remove (1), (2) etc.
          
          const display = cleanFilename.length > 45 
            ? `...${cleanFilename.slice(-45)}` 
            : cleanFilename;
          
          return `📦 ${display}`; // Indicate this is a Next.js optimized image
        }
      }
      
      // For regular URLs, show the path with filename
      const path = urlObj.pathname;
      const filename = path.split("/").pop() || path;
      
      if (filename.length > 50) {
        return `...${filename.slice(-50)}`;
      }
      return filename.length > 45 ? `...${path.slice(-45)}` : path;
    } catch {
      return fullUrl.length > 50 ? `...${fullUrl.slice(-50)}` : fullUrl;
    }
  };

  if (!displayUrl) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="bg-muted rounded-lg border border-border h-32 flex flex-col items-center justify-center gap-2">
          <ImageOff className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">Not set in schema or metadata</p>
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
        <p className="text-xs text-muted-foreground break-all font-mono" title={displayUrl}>
          {getDisplayUrl(displayUrl)}
        </p>
      </div>
    );
  }

  const sourceLabel = getSourceLabel();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {sourceLabel && (
          <Badge 
            variant={currentSource === 'schema' ? 'default' : 'secondary'} 
            className="text-[10px] px-1.5 py-0"
          >
            {sourceLabel}
          </Badge>
        )}
      </div>
      <a
        href={displayUrl}
        target="_blank"
        rel="noreferrer"
        className="block bg-background rounded-lg border border-border overflow-hidden h-32 relative group hover:border-primary/50 transition-colors"
      >
        <img
          src={displayUrl}
          alt={label}
          className={`w-full h-full ${objectFit === "contain" ? "object-contain p-2" : "object-cover"}`}
          onError={handleImageError}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <ExternalLink className="h-5 w-5 text-white drop-shadow-md" />
        </div>
      </a>
      <p className="text-xs text-muted-foreground font-mono truncate" title={displayUrl}>
        {getDisplayUrl(displayUrl)}
      </p>
    </div>
  );
}
