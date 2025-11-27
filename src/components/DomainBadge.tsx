import { Badge } from "@/components/ui/badge";

interface DomainBadgeProps {
  domain: string;
  className?: string;
}

/**
 * Domain badge component for displaying page domain (Corporate, Beer, Pub)
 * with semantic color coding.
 * 
 * Corporate: Blue theme (primary domain using v2 rules engine)
 * Beer: Amber/Yellow theme (rules-based engine with beer metadata)
 * Pub: Purple theme (Phase 2 placeholder)
 */
export function DomainBadge({ domain, className }: DomainBadgeProps) {
  const domainConfig = {
    Corporate: {
      className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
    },
    Beer: {
      className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
    },
    Pub: {
      className: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800",
    },
  };

  const config = domainConfig[domain as keyof typeof domainConfig] || {
    className: "bg-muted text-muted-foreground",
  };

  return (
    <Badge variant="outline" className={`rounded-full ${config.className} ${className || ""}`}>
      {domain}
    </Badge>
  );
}
