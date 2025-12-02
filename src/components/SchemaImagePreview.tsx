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
