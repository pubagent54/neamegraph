/**
 * Permissions Hook
 * 
 * Single source of truth for role-based permissions.
 * Maps database roles (admin/editor/viewer) to display roles (god/creator/viewer).
 */

import { useAuth } from "@/contexts/AuthContext";

// Map database roles to display roles
export type DisplayRole = "god" | "creator" | "viewer";

const ROLE_MAP: Record<string, DisplayRole> = {
  admin: "god",
  editor: "creator",
  viewer: "viewer",
};

const ROLE_DISPLAY_NAMES: Record<DisplayRole, string> = {
  god: "God Like",
  creator: "Creator",
  viewer: "Viewer",
};

const ROLE_DESCRIPTIONS: Record<DisplayRole, string> = {
  god: "Full access - manage users, rules, settings, and schema",
  creator: "Can generate and save schema, but cannot edit rules or manage users",
  viewer: "Read-only access to pages, rules, and schema",
};

export interface Permissions {
  // Core permissions
  canManageUsers: boolean;
  canEditRules: boolean;
  canEditSettings: boolean;
  canGenerateSchema: boolean;
  canSaveSchema: boolean;
  canEditPages: boolean;
  isReadOnly: boolean;
  
  // Role info
  role: DisplayRole | null;
  dbRole: string | null;
  displayName: string;
  description: string;
}

export function usePermissions(): Permissions {
  const { userRole } = useAuth();
  
  // Map database role to display role
  const displayRole: DisplayRole | null = userRole ? (ROLE_MAP[userRole] || "viewer") : null;
  
  // Derive permissions from role
  const canManageUsers = displayRole === "god";
  const canEditRules = displayRole === "god";
  const canEditSettings = displayRole === "god";
  const canGenerateSchema = displayRole === "god" || displayRole === "creator";
  const canSaveSchema = canGenerateSchema;
  const canEditPages = displayRole === "god" || displayRole === "creator";
  const isReadOnly = displayRole === "viewer";
  
  return {
    canManageUsers,
    canEditRules,
    canEditSettings,
    canGenerateSchema,
    canSaveSchema,
    canEditPages,
    isReadOnly,
    role: displayRole,
    dbRole: userRole,
    displayName: displayRole ? ROLE_DISPLAY_NAMES[displayRole] : "Unknown",
    description: displayRole ? ROLE_DESCRIPTIONS[displayRole] : "",
  };
}

// Export utilities for use elsewhere
export { ROLE_MAP, ROLE_DISPLAY_NAMES, ROLE_DESCRIPTIONS };
