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

import { User, Eye, CheckCircle2, Upload as UploadIcon, Star, LucideIcon } from "lucide-react";

export interface StatusConfig {
  label: string;
  order: number;
  dotClass: string;
  tooltip: string;
  icon: LucideIcon;
  bgClass: string;
  textClass: string;
  description: string;
}

export const PAGE_STATUS_CONFIG: Record<string, StatusConfig> = {
  naked: {
    label: "Naked",
    order: 1,
    dotClass: "bg-muted-foreground",
    tooltip: "No schema captured for this page yet.",
    icon: User,
    bgClass: "bg-rose-500/10 dark:bg-rose-500/20",
    textClass: "text-rose-600 dark:text-rose-400",
    description: "No schema yet",
  },
  review: {
    label: "Review",
    order: 2,
    dotClass: "bg-status-review",
    tooltip: "Schema exists but needs fixes (validation or content issues).",
    icon: Eye,
    bgClass: "bg-amber-500/10 dark:bg-amber-500/20",
    textClass: "text-amber-600 dark:text-amber-400",
    description: "Needs fixes",
  },
  approved: {
    label: "Approved",
    order: 3,
    dotClass: "bg-status-approved",
    tooltip: "Schema passes checks and is ready to upload.",
    icon: CheckCircle2,
    bgClass: "bg-emerald-500/10 dark:bg-emerald-500/20",
    textClass: "text-emerald-600 dark:text-emerald-400",
    description: "Ready to upload",
  },
  upload: {
    label: "Upload",
    order: 4,
    dotClass: "bg-primary",
    tooltip: "Ready for manual paste into Drupal.",
    icon: UploadIcon,
    bgClass: "bg-blue-500/10 dark:bg-blue-500/20",
    textClass: "text-blue-600 dark:text-blue-400",
    description: "Ready for Drupal",
  },
  live: {
    label: "Live",
    order: 5,
    dotClass: "bg-status-implemented",
    tooltip: "Schema pasted into Drupal and spot-checked on the live site.",
    icon: Star,
    bgClass: "bg-yellow-400/20 dark:bg-yellow-400/30",
    textClass: "text-yellow-600 dark:text-yellow-400",
    description: "Live on site",
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
 * Validation result for status transitions
 */
export interface StatusValidationResult {
  allowed: boolean;
  message?: string;
}

/**
 * Validate if a status change is allowed based on current page state
 * Returns validation result with helpful error message if not allowed
 */
export function canUpdateStatus(
  currentStatus: string,
  newStatus: PageStatus,
  hasSchema: boolean
): StatusValidationResult {
  // Normalize current status to UI slug
  const currentNormalized = normalizeStatus(currentStatus);
  
  // Rule 1: Approved requires schema
  if (newStatus === "approved" && !hasSchema) {
    return {
      allowed: false,
      message: "You can only mark a page as Approved once valid schema exists. Generate schema first.",
    };
  }
  
  // Rule 2: Upload requires Approved first
  if (newStatus === "upload") {
    if (!hasSchema) {
      return {
        allowed: false,
        message: "Upload requires valid schema. Generate and approve schema first.",
      };
    }
    if (!["approved", "upload", "live"].includes(currentNormalized)) {
      return {
        allowed: false,
        message: "Set status to Approved first before moving to Upload.",
      };
    }
  }
  
  // Rule 3: Live requires Upload or Approved first
  if (newStatus === "live") {
    if (!hasSchema) {
      return {
        allowed: false,
        message: "Live requires valid schema. Generate and approve schema first.",
      };
    }
    if (!["approved", "upload", "live"].includes(currentNormalized)) {
      return {
        allowed: false,
        message: "Set status to Approved or Upload first before moving to Live.",
      };
    }
  }
  
  // All checks passed
  return { allowed: true };
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
