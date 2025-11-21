import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig = {
  not_started: { label: "Not Started", className: "bg-muted text-muted-foreground" },
  ai_draft: { label: "AI Draft", className: "bg-status-draft/20 text-status-draft border-status-draft/30" },
  needs_review: { label: "Needs Review", className: "bg-status-review/20 text-status-review border-status-review/30" },
  approved: { label: "Approved", className: "bg-status-approved/20 text-status-approved border-status-approved/30" },
  implemented: { label: "Implemented", className: "bg-status-implemented/20 text-status-implemented border-status-implemented/30" },
  needs_rework: { label: "Needs Rework", className: "bg-status-error/20 text-status-error border-status-error/30" },
  removed_from_sitemap: { label: "Removed", className: "bg-status-removed/20 text-status-removed border-status-removed/30" },
  draft: { label: "Draft", className: "bg-status-draft/20 text-status-draft border-status-draft/30" },
  rejected: { label: "Rejected", className: "bg-status-error/20 text-status-error border-status-error/30" },
  deprecated: { label: "Deprecated", className: "bg-status-removed/20 text-status-removed border-status-removed/30" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    className: "bg-muted text-muted-foreground",
  };

  return (
    <Badge variant="outline" className={`${config.className} ${className || ""}`}>
      {config.label}
    </Badge>
  );
}
