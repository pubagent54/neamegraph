/**
 * Page Status Configuration
 * 
 * 5-state workflow for page schema lifecycle:
 * 1. Naked - No usable schema yet
 * 2. Review - Schema exists but needs fixes (validation/content issues)
 * 3. Approved - Schema passes checks, ready to upload
 * 4. Upload - Queued for manual Drupal paste
 * 5. Live - Pasted into Drupal and spot-checked live
 */

export const PAGE_STATUS_CONFIG = {
  naked: {
    label: "Naked",
    order: 1,
    dotClass: "bg-muted-foreground",
    tooltip: "No schema captured for this page yet.",
  },
  review: {
    label: "Review",
    order: 2,
    dotClass: "bg-status-review",
    tooltip: "Schema exists but needs fixes (validation or content issues).",
  },
  approved: {
    label: "Approved",
    order: 3,
    dotClass: "bg-status-approved",
    tooltip: "Schema passes checks and is ready to upload.",
  },
  upload: {
    label: "Upload",
    order: 4,
    dotClass: "bg-primary",
    tooltip: "Ready for manual paste into Drupal.",
  },
  live: {
    label: "Live",
    order: 5,
    dotClass: "bg-status-implemented",
    tooltip: "Schema pasted into Drupal and spot-checked on the live site.",
  },
} as const;

export type PageStatus = keyof typeof PAGE_STATUS_CONFIG;

// Ordered array for UI selectors
export const PAGE_STATUS_OPTIONS: PageStatus[] = Object.entries(PAGE_STATUS_CONFIG)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([key]) => key as PageStatus);

/**
 * Normalize legacy status values to new 5-state system
 */
export function normalizeStatus(status: string | null | undefined): PageStatus {
  if (!status) return "naked";
  
  const normalized = status.toLowerCase().trim();
  
  // Map old statuses to new ones
  const statusMap: Record<string, PageStatus> = {
    // Naked equivalents
    "not_started": "naked",
    "no_schema": "naked",
    "none": "naked",
    "": "naked",
    
    // Review equivalents
    "draft": "review",
    "needs_review": "review",
    "needs_rework": "review",
    "in_progress": "review",
    
    // Approved equivalents
    "approved": "approved",
    "ok": "approved",
    "ready": "approved",
    
    // Upload equivalents
    "ai_draft": "upload", // Map ai_draft to upload state
    "upload": "upload",
    "queued": "upload",
    
    // Live equivalents
    "implemented": "live",
    "live": "live",
    "production": "live",
    "published": "live",
    "removed_from_sitemap": "live", // Assume previously live
  };
  
  return statusMap[normalized] || "naked";
}

/**
 * Check if a status requires schema to be present
 */
export function statusRequiresSchema(status: PageStatus): boolean {
  return ["approved", "upload", "live"].includes(status);
}

/**
 * Get suggested status based on page state and validation
 */
export function deriveSuggestedStatus(
  hasSchema: boolean,
  validationPassed?: boolean
): PageStatus {
  if (!hasSchema) return "naked";
  if (validationPassed === true) return "approved";
  if (validationPassed === false) return "review";
  return "review"; // Default for schema but unknown validation
}

/**
 * Convert UI status to database enum value
 * Maps new 5-state workflow to existing database enum
 */
export function statusToDatabase(uiStatus: PageStatus): string {
  const dbStatusMap: Record<PageStatus, string> = {
    naked: "not_started",
    review: "needs_review",
    approved: "approved",
    upload: "ai_draft", // Use ai_draft to distinguish from approved
    live: "implemented",
  };
  
  return dbStatusMap[uiStatus];
}
