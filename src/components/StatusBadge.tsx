import { Badge } from "@/components/ui/badge";
import { PAGE_STATUS_CONFIG, normalizeStatus, type PageStatus } from "@/config/pageStatus";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = normalizeStatus(status) as PageStatus;
  const config = PAGE_STATUS_CONFIG[normalizedStatus];

  return (
    <Badge variant="outline" className={`bg-muted/50 text-foreground border-border ${className || ""}`}>
      {config.label}
    </Badge>
  );
}
