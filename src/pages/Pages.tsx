/**
 * Pages List Screen
 * 
 * Main pages management view displaying all corporate pages with filtering, search, and bulk actions.
 * Handles all three domain lanes (Corporate, Beer, Pub) with inline editing for page metadata.
 * Status workflow: not_started → ai_draft → needs_review → approved → implemented.
 * Clicking a path navigates to PageDetail for schema generation and version management.
 * 
 * TAXONOMY INTEGRATION:
 * - Domain, Page Type, and Category dropdowns are now powered by the database-driven taxonomy system
 * - Source tables: page_type_definitions and page_category_definitions
 * - Changes made in Settings → Page Types & Categories automatically flow through to this UI
 * - Legacy/inactive values are preserved and displayed with "(legacy)" suffix for backward compatibility
 */

import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DomainBadge } from "@/components/DomainBadge";
import { Badge } from "@/components/ui/badge";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, Upload, Trash2, Edit, CheckCircle2, Circle, Loader2, ArrowUp, ArrowUpDown, ArrowUp as ArrowUpIcon, ArrowDown, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDomains, usePageTypes, usePageTypesForDomain, useCategoriesForPageType } from "@/hooks/use-taxonomy";
import { PageTypeSelect } from "@/components/PageTypeSelect";
import { CategorySelect } from "@/components/CategorySelect";

const SECTIONS = [
  "beers", "pubs", "stay", "news", "history", "sustainability",
  "investors", "careers", "about", "contact", "other"
];

const PAGE_TYPES = [
  "org_root", "beer_brand", "beer_collection", "pubs_overview", "pubs_collection",
  "history_page", "sustainability_page", "investors_page", "careers_page",
  "about_page", "contact_page", "news_article", "press_release", "blog_post",
  "faq_page", "collection", "other"
];

const FAQ_MODES = ["auto", "ignore"];

import { 
  PAGE_STATUS_CONFIG, 
  PAGE_STATUS_OPTIONS,
  normalizeStatus,
  statusRequiresSchema,
  statusToDatabase,
  canUpdateStatus,
  type PageStatus 
} from "@/config/pageStatus";

// ========================================
// DOMAIN LANE LOGIC - Corporate, Beer, Pub
// ----------------------------------------
// Corporate: Full rules-based schema engine with page_type/category matching
// Beer: Uses same rules engine as Corporate, with beer-specific metadata fields
// Pub: Phase 2 placeholder - schema generation disabled
// NOTE: Domain list is now loaded from database via useDomains() hook
// ========================================

// ========================================
// PAGE STATUS WORKFLOW
// ----------------------------------------
// not_started → ai_draft (Brain generates) → needs_review 
// → approved (admin only) → implemented (admin only)
// Can branch to needs_rework from needs_review
// ========================================

// ========================================
// Domain field: Corporate, Beer, or Pub
// All existing pages default to 'Corporate' to preserve current behavior
// ========================================
interface Page {
  id: string;
  path: string;
  section: string | null;
  page_type: string | null;
  status: string;
  has_faq: boolean;
  priority: number | null;
  last_schema_generated_at: string | null;
  category: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  faq_mode: string;
  is_home_page: boolean;
  domain: string; // 'Corporate', 'Beer', or 'Pub'
  // NOTE: beer_* fields (beer_abv, beer_style, beer_launch_year, beer_official_url)
  // are stored in the pages table as a first step. These may later be moved
  // to a dedicated Beer entity table – don't over-optimise around their
  // current location.
  beer_abv: number | null;
  beer_style: string | null;
  beer_launch_year: number | null;
  beer_official_url: string | null;
}

export default function Pages() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pageTypeFilter, setPageTypeFilter] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [bulkPaths, setBulkPaths] = useState("");
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"section" | "page_type" | "status" | "delete" | null>(null);
  const [bulkActionValue, setBulkActionValue] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicatePaths, setDuplicatePaths] = useState<string[]>([]);
  const [pendingNewPaths, setPendingNewPaths] = useState<string[]>([]);
  const [newPage, setNewPage] = useState({
    path: "",
    domain: "Corporate",
    page_type: "",
    category: "",
    has_faq: false,
    notes: "",
    faq_mode: "auto",
    is_home_page: false,
  });
  const [pathError, setPathError] = useState("");
  const [duplicatePage, setDuplicatePage] = useState<any>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [searchParams] = useSearchParams();
  const { userRole } = useAuth();
  const [schemaVersions, setSchemaVersions] = useState<Record<string, { hasV1: boolean; hasV2: boolean }>>({});

  const canEdit = userRole === "admin" || userRole === "editor";
  const isAdmin = userRole === "admin";
  const [copyingSchemaForPageId, setCopyingSchemaForPageId] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [modalCopyContent, setModalCopyContent] = useState("");
  const [sortColumn, setSortColumn] = useState<string>("last_schema_generated_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Load taxonomy from database
  const { domains, loading: domainsLoading } = useDomains();
  const { pageTypes: allPageTypes, loading: allPageTypesLoading } = usePageTypes();
  const { pageTypes: domainPageTypes, loading: domainPageTypesLoading } = usePageTypesForDomain(newPage.domain, true);
  const { categories: pageTypeCategories, loading: categoriesLoading } = useCategoriesForPageType(newPage.page_type, true);

  useEffect(() => {
    fetchPages();
    const statusParam = searchParams.get("status");
    if (statusParam) {
      setStatusFilter(statusParam);
    }
  }, [searchParams]);

  // Fetch schema versions to determine v1/v2 status
  useEffect(() => {
    const fetchSchemaVersions = async () => {
      try {
        const { data, error } = await supabase
          .from("schema_versions")
          .select("page_id");
        
        if (error) throw error;
        
        const versions: Record<string, { hasV1: boolean; hasV2: boolean }> = {};
        data?.forEach((sv: any) => {
          if (!versions[sv.page_id]) {
            versions[sv.page_id] = { hasV1: false, hasV2: false };
          }
          // For now, we'll mark all as v2 since v1 is legacy
          // This can be enhanced later with actual version detection
          versions[sv.page_id].hasV2 = true;
        });
        
        setSchemaVersions(versions);
      } catch (error) {
        console.error("Error fetching schema versions:", error);
      }
    };
    
    if (pages.length > 0) {
      fetchSchemaVersions();
    }
  }, [pages]);

  const getSchemaVersionBadge = (pageId: string) => {
    const versions = schemaVersions[pageId];
    if (!versions || (!versions.hasV1 && !versions.hasV2)) {
      return <Badge variant="outline" className="rounded-full text-xs bg-muted/50">None</Badge>;
    }
    if (versions.hasV1 && versions.hasV2) {
      return <Badge variant="outline" className="rounded-full text-xs bg-primary/10 text-primary">Both</Badge>;
    }
    if (versions.hasV2) {
      return <Badge variant="outline" className="rounded-full text-xs bg-green-500/10 text-green-600 dark:text-green-500">v2</Badge>;
    }
    if (versions.hasV1) {
      return <Badge variant="outline" className="rounded-full text-xs bg-orange-500/10 text-orange-600 dark:text-orange-500">v1</Badge>;
    }
    return null;
  };

  // Normalize path: trim, ensure leading /, strip trailing / (except root), lowercase
  const normalizePath = (path: string): string => {
    let normalized = path.trim();
    
    // Ensure leading /
    if (!normalized.startsWith("/")) {
      normalized = "/" + normalized;
    }
    
    // Strip trailing / except for root
    if (normalized !== "/" && normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    
    // Make case-insensitive by lowercasing
    normalized = normalized.toLowerCase();
    
    return normalized;
  };

  const fetchPages = async () => {
    try {
      const { data, error } = await supabase
        .from("pages")
        .select("*")
        .order("path");

      if (error) throw error;
      setPages(data || []);
    } catch (error) {
      console.error("Error fetching pages:", error);
      toast.error("Failed to fetch pages");
    } finally {
      setLoading(false);
    }
  };

  // Debounced duplicate check
  const checkDuplicatePath = async (rawPath: string) => {
    if (!rawPath.trim()) {
      setDuplicatePage(null);
      setPathError("");
      return;
    }

    const normalizedPath = normalizePath(rawPath);
    setCheckingDuplicate(true);

    try {
      const { data, error } = await supabase
        .from("pages")
        .select("id, domain, page_type, path")
        .eq("path", normalizedPath)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setDuplicatePage(data[0]);
        setPathError("This page already exists in the database. Open the existing page instead of creating a duplicate.");
      } else {
        setDuplicatePage(null);
        setPathError("");
      }
    } catch (error) {
      console.error("Error checking duplicate:", error);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  // Debounce timer
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newPage.path) {
        checkDuplicatePath(newPage.path);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [newPage.path]);

  const handleAddPage = async () => {
    try {
      setPathError(""); // Clear any previous errors

      if (!newPage.path) {
        setPathError("Path is required");
        return;
      }

      // Normalize the path
      const normalizedPath = normalizePath(newPage.path);

      // Validate Page Type and Category for Corporate and Beer domains
      if (newPage.domain === "Corporate" || newPage.domain === "Beer") {
        if (!newPage.page_type) {
          toast.error("Page Type is required for Corporate and Beer domains");
          return;
        }
        if (!newPage.category) {
          toast.error("Category is required for Corporate and Beer domains");
          return;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be logged in to add pages");
        return;
      }

      // Pre-flight duplicate check
      const { data: existingPage, error: checkError } = await supabase
        .from("pages")
        .select("id, domain, page_type, path")
        .eq("path", normalizedPath)
        .limit(1);

      if (checkError) {
        console.error("Error checking for duplicate:", checkError);
      }

      if (existingPage && existingPage.length > 0) {
        setDuplicatePage(existingPage[0]);
        setPathError("This page already exists in the database. Open the existing page instead of creating a duplicate.");
        return; // Don't proceed with insert
      }

      const { error } = await supabase.from("pages").insert({
        path: normalizedPath,
        domain: newPage.domain || "Corporate",
        section: null,
        page_type: newPage.page_type || null,
        category: newPage.category || null,
        has_faq: newPage.has_faq,
        priority: null,
        notes: newPage.notes || null,
        status: "not_started" as const,
        created_by_user_id: user.id,
        last_modified_by_user_id: user.id,
        faq_mode: newPage.faq_mode || "auto",
        is_home_page: newPage.is_home_page,
      });

      if (error) {
        // Handle unique constraint violation (any duplicate path error)
        if (error.code === "23505") {
          setPathError("This page already exists in the database. Open the existing page instead of creating a duplicate.");
          return; // Don't throw, don't toast - just show inline error
        }
        throw error;
      }

      toast.success("Page added successfully");
      setNewPage({
        path: "",
        domain: "Corporate",
        page_type: "",
        category: "",
        has_faq: false,
        notes: "",
        faq_mode: "auto",
        is_home_page: false,
      });
      setPathError("");
      setDuplicatePage(null);
      setAddDialogOpen(false);
      fetchPages();
    } catch (error: any) {
      console.error("Error adding page:", error);
      toast.error("Failed to add page. Please try again.");
    }
  };

  const autoDetectMetadata = (path: string) => {
    let section = "other";
    let page_type = "other";

    if (path === "/") {
      section = "about";
      page_type = "org_root";
    } else if (path.startsWith("/beers/")) {
      section = "beers";
      page_type = path.split("/").length > 3 ? "beer_brand" : "beer_collection";
    } else if (path.startsWith("/pubs/") || path.startsWith("/our-pubs/")) {
      section = "pubs";
      page_type = path.includes("collection") ? "pubs_collection" : "pubs_overview";
    } else if (path.startsWith("/stay/")) {
      section = "stay";
      page_type = "collection";
    } else if (path.startsWith("/news/")) {
      section = "news";
      page_type = path.split("/").length > 3 ? "news_article" : "collection";
    } else if (path.startsWith("/press/")) {
      section = "news";
      page_type = "press_release";
    } else if (path.includes("history") || path.includes("heritage")) {
      section = "history";
      page_type = "history_page";
    } else if (path.includes("sustainability")) {
      section = "sustainability";
      page_type = "sustainability_page";
    } else if (path.includes("investors")) {
      section = "investors";
      page_type = "investors_page";
    } else if (path.includes("careers") || path.includes("jobs")) {
      section = "careers";
      page_type = "careers_page";
    } else if (path.includes("about")) {
      section = "about";
      page_type = "about_page";
    } else if (path.includes("contact")) {
      section = "contact";
      page_type = "contact_page";
    } else if (path.includes("faq")) {
      section = "other";
      page_type = "faq_page";
    }

    return { section, page_type };
  };

  const handleBulkAdd = async () => {
    try {
      const paths = bulkPaths
        .split("\n")
        .map((p) => normalizePath(p))
        .filter((p) => p.length > 0);

      if (paths.length === 0) {
        toast.error("Please enter at least one path");
        return;
      }

      const { data: existingPages, error: fetchError } = await supabase
        .from("pages")
        .select("path")
        .in("path", paths);

      if (fetchError) throw fetchError;

      const existingPaths = new Set(existingPages?.map(p => p.path) || []);
      const newPaths = paths.filter(path => !existingPaths.has(path));
      const duplicates = paths.filter(path => existingPaths.has(path));

      if (duplicates.length > 0) {
        // Show duplicate dialog
        setDuplicatePaths(duplicates);
        setPendingNewPaths(newPaths);
        setDuplicateDialogOpen(true);
        return;
      }

      if (newPaths.length === 0) {
        toast.info("All paths already exist in the database");
        setBulkPaths("");
        setBulkDialogOpen(false);
        return;
      }

      // No duplicates, proceed with insert
      await insertNewPages(newPaths);
    } catch (error: any) {
      console.error("Error bulk adding pages:", error);
      toast.error(error.message || "Failed to add pages");
    }
  };

  const insertNewPages = async (pathsToInsert: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be logged in to add pages");
        return;
      }

      const pagesToInsert = pathsToInsert.map((path) => {
        return {
          path,
          section: null,
          page_type: null,
          category: null,
          status: "not_started" as any, // Will be normalized to "naked" in UI
          has_faq: false,
          created_by_user_id: user.id,
          last_modified_by_user_id: user.id,
        };
      });

      const { error } = await supabase.from("pages").insert(pagesToInsert);

      if (error) throw error;

      toast.success(`Added ${pathsToInsert.length} pages successfully`);
      setBulkPaths("");
      setBulkDialogOpen(false);
      fetchPages();
    } catch (error: any) {
      console.error("Error inserting pages:", error);
      toast.error(error.message || "Failed to add pages");
    }
  };

  const handleKeepExisting = async () => {
    // Only add new paths, skip duplicates
    if (pendingNewPaths.length > 0) {
      await insertNewPages(pendingNewPaths);
    } else {
      toast.info("No new pages to add");
      setBulkPaths("");
      setBulkDialogOpen(false);
    }
    setDuplicateDialogOpen(false);
    setDuplicatePaths([]);
    setPendingNewPaths([]);
  };

  const handleReplaceExisting = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      // Delete existing pages with duplicate paths
      const { error: deleteError } = await supabase
        .from("pages")
        .delete()
        .in("path", duplicatePaths);

      if (deleteError) throw deleteError;

      // Insert all paths (new + replaced)
      const allPaths = [...pendingNewPaths, ...duplicatePaths];
      await insertNewPages(allPaths);

      toast.success(`Replaced ${duplicatePaths.length} existing pages and added ${pendingNewPaths.length} new pages`);
      
      setDuplicateDialogOpen(false);
      setDuplicatePaths([]);
      setPendingNewPaths([]);
    } catch (error: any) {
      console.error("Error replacing pages:", error);
      toast.error(error.message || "Failed to replace pages");
    }
  };

  const handleInlineUpdate = async (pageId: string, field: string, value: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      // Validate status changes with guard rails
      if (field === "status") {
        const page = pages.find(p => p.id === pageId);
        if (!page) {
          toast.error("Page not found");
          return;
        }

        const hasSchema = !!page.last_schema_generated_at;
        const validation = canUpdateStatus(page.status, value as PageStatus, hasSchema);
        
        if (!validation.allowed) {
          toast.error(validation.message || "Cannot update status");
          return;
        }
      }

      // Convert UI status value to database enum value
      const dbValue = field === "status" ? statusToDatabase(value as PageStatus) : value;

      const { error } = await supabase
        .from("pages")
        .update({
          [field]: dbValue as any,
          last_modified_by_user_id: user.id,
        })
        .eq("id", pageId);

      if (error) throw error;

      // Update local state with database value
      setPages(pages.map(p => p.id === pageId ? { ...p, [field]: dbValue } : p));
      toast.success("Status updated successfully");
    } catch (error: any) {
      console.error("Error updating page:", error);
      toast.error(error.message || "Failed to update page");
    }
  };

  const handleCopyDrupalSchema = async (page: Page) => {
    setCopyingSchemaForPageId(page.id);
    try {
      // Fetch the latest schema version for this page
      const { data: schemaVersions, error } = await supabase
        .from("schema_versions")
        .select("jsonld")
        .eq("page_id", page.id)
        .order("version_number", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Database error fetching schema:", error);
        toast.error("Database error: " + error.message);
        return;
      }

      if (!schemaVersions || schemaVersions.length === 0) {
        toast.error("No schema found for this page. Generate schema first.");
        return;
      }

      const jsonldString = schemaVersions[0].jsonld;
      
      // Parse and pretty-print the JSON
      let prettyJson: string;
      try {
        const parsed = JSON.parse(jsonldString);
        prettyJson = JSON.stringify(parsed, null, 2);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        toast.error("Schema JSON is malformed and cannot be copied");
        return;
      }

      // Wrap in script tag
      const scriptTag = `<script type="application/ld+json">\n${prettyJson}\n</script>`;

      // Show modal with selectable text (works in all browsers)
      setModalCopyContent(scriptTag);
      setShowCopyModal(true);
    } catch (error: any) {
      console.error("Unexpected error copying schema:", error);
      toast.error("Unexpected error: " + (error.message || "Unknown error"));
    } finally {
      setCopyingSchemaForPageId(null);
    }
  };

  const handleBulkAction = async () => {
    if (!bulkActionType || selectedPageIds.size === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const selectedIds = Array.from(selectedPageIds);

      if (bulkActionType === "delete") {
        // Prevent deletion of homepage
        const homepageInSelection = pages.some(p => selectedPageIds.has(p.id) && p.path === "/");
        if (homepageInSelection) {
          toast.error("Cannot delete the homepage");
          return;
        }

        const { error } = await supabase
          .from("pages")
          .delete()
          .in("id", selectedIds);

        if (error) throw error;

        await supabase.from("audit_log").insert({
          user_id: user.id,
          entity_type: "page",
          action: "bulk_delete",
          details: { ids: selectedIds, count: selectedIds.length },
        });

        toast.success(`Deleted ${selectedIds.length} pages`);
      } else if (bulkActionType === "status") {
        // Validate status changes for each selected page
        const selectedPages = pages.filter(p => selectedPageIds.has(p.id));
        const newStatus = bulkActionValue as PageStatus;
        const invalidPages: string[] = [];
        
        for (const page of selectedPages) {
          const hasSchema = !!page.last_schema_generated_at;
          const validation = canUpdateStatus(page.status, newStatus, hasSchema);
          if (!validation.allowed) {
            invalidPages.push(page.path);
          }
        }
        
        if (invalidPages.length > 0) {
          toast.error(
            `Cannot update ${invalidPages.length} page(s) to ${PAGE_STATUS_CONFIG[newStatus].label}. ` +
            `Some pages don't meet requirements (missing schema or invalid transition).`,
            { duration: 5000 }
          );
          return;
        }
        
        // Convert UI status value to database enum value
        const dbValue = statusToDatabase(newStatus);
        
        const { error } = await supabase
          .from("pages")
          .update({
            status: dbValue as any,
            last_modified_by_user_id: user.id,
          })
          .in("id", selectedIds);

        if (error) throw error;

        await supabase.from("audit_log").insert({
          user_id: user.id,
          entity_type: "page",
          action: "bulk_update",
          details: {
            ids: selectedIds,
            field: "status",
            new_value: bulkActionValue,
            count: selectedIds.length,
          },
        });

        toast.success(`Updated ${selectedIds.length} pages to ${PAGE_STATUS_CONFIG[newStatus].label}`);
      } else {
        // Non-status bulk updates (section, page_type, etc.)
        const { error } = await supabase
          .from("pages")
          .update({
            [bulkActionType]: bulkActionValue,
            last_modified_by_user_id: user.id,
          })
          .in("id", selectedIds);

        if (error) throw error;

        await supabase.from("audit_log").insert({
          user_id: user.id,
          entity_type: "page",
          action: "bulk_update",
          details: {
            ids: selectedIds,
            field: bulkActionType,
            new_value: bulkActionValue,
            count: selectedIds.length,
          },
        });

        toast.success(`Updated ${selectedIds.length} pages`);
      }

      setBulkActionDialogOpen(false);
      setBulkActionType(null);
      setBulkActionValue("");
      setSelectedPageIds(new Set());
      fetchPages();
    } catch (error: any) {
      console.error("Error performing bulk action:", error);
      toast.error(error.message || "Failed to perform bulk action");
    }
  };

  const handleResetPages = async () => {
    if (resetConfirmText !== "RESET") {
      toast.error("Please type RESET to confirm");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      // Get counts before deletion
      const { count: pagesCount } = await supabase.from("pages").select("*", { count: "exact", head: true });
      const { count: schemaCount } = await supabase.from("schema_versions").select("*", { count: "exact", head: true });
      const { count: nodesCount } = await supabase.from("graph_nodes").select("*", { count: "exact", head: true });
      const { count: edgesCount } = await supabase.from("graph_edges").select("*", { count: "exact", head: true });

      // Delete all pages (cascading will handle schema_versions)
      await supabase.from("pages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("graph_nodes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("graph_edges").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      await supabase.from("audit_log").insert({
        user_id: user.id,
        entity_type: "page",
        action: "reset_pages",
        details: {
          pages_deleted: pagesCount || 0,
          schema_versions_deleted: schemaCount || 0,
          graph_nodes_deleted: nodesCount || 0,
          graph_edges_deleted: edgesCount || 0,
        },
      });

      toast.success("All pages and related data have been reset");
      setResetDialogOpen(false);
      setResetConfirmText("");
      fetchPages();
    } catch (error: any) {
      console.error("Error resetting pages:", error);
      toast.error(error.message || "Failed to reset pages");
    }
  };

  const toggleSelectAll = () => {
    if (selectedPageIds.size === filteredPages.length) {
      setSelectedPageIds(new Set());
    } else {
      setSelectedPageIds(new Set(filteredPages.map(p => p.id)));
    }
  };

  const toggleSelectPage = (pageId: string) => {
    const newSelected = new Set(selectedPageIds);
    if (newSelected.has(pageId)) {
      newSelected.delete(pageId);
    } else {
      newSelected.add(pageId);
    }
    setSelectedPageIds(newSelected);
  };

  // Check if a page is the homepage
  const isHomepage = (page: Page) => {
    return page.is_home_page || page.path === "/" || page.path === "";
  };

  // Handle column header click for sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, default to desc for dates, asc for text
      setSortColumn(column);
      setSortDirection(column === "last_schema_generated_at" ? "desc" : "asc");
    }
  };

  // Sort comparator
  const sortPages = (a: Page, b: Page) => {
    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case "path":
        aValue = a.path.toLowerCase();
        bValue = b.path.toLowerCase();
        break;
      case "domain":
        aValue = a.domain?.toLowerCase() || "";
        bValue = b.domain?.toLowerCase() || "";
        break;
      case "page_type":
        aValue = a.page_type?.toLowerCase() || "";
        bValue = b.page_type?.toLowerCase() || "";
        break;
      case "category":
        aValue = a.category?.toLowerCase() || "";
        bValue = b.category?.toLowerCase() || "";
        break;
      case "status":
        aValue = normalizeStatus(a.status);
        bValue = normalizeStatus(b.status);
        break;
      case "last_schema_generated_at":
        // Sort null dates to end
        aValue = a.last_schema_generated_at ? new Date(a.last_schema_generated_at).getTime() : 0;
        bValue = b.last_schema_generated_at ? new Date(b.last_schema_generated_at).getTime() : 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  };

  const filteredPages = pages.filter((page) => {
    const matchesSearch = page.path.toLowerCase().includes(searchQuery.toLowerCase());
    // Normalize both the page status and filter status for comparison
    const normalizedPageStatus = normalizeStatus(page.status);
    const matchesStatus = statusFilter === "all" || normalizedPageStatus === statusFilter;
    const matchesPageType = pageTypeFilter === "all" || page.page_type === pageTypeFilter;
    const matchesDomain = domainFilter === "all" || page.domain === domainFilter;
    return matchesSearch && matchesStatus && matchesPageType && matchesDomain;
  });

  // Separate homepage from other pages and apply sorting
  const homepageRows = filteredPages.filter(isHomepage);
  const otherRows = filteredPages.filter(page => !isHomepage(page)).sort(sortPages);

  const getPathDisplay = (path: string) => {
    return path === "/" ? "Homepage (root)" : path;
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">Pages</h1>
            <p className="text-lg text-muted-foreground">
              Manage corporate pages and their schema
            </p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              {isAdmin && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={async () => {
                          try {
                            // Check if there are any beers ready for export
                            const { data: readyBeers, error } = await supabase
                              .from('pages')
                              .select('id')
                              .eq('domain', 'Beer')
                              .eq('wikidata_candidate', true)
                              .eq('wikidata_status', 'ready_for_wikidata')
                              .is('wikidata_qid', null);

                            if (error) throw error;

                            if (!readyBeers || readyBeers.length === 0) {
                              toast.info('No beers marked Ready for Wikidata');
                              return;
                            }

                            toast.info(`Exporting ${readyBeers.length} beers to Wikidata...`);

                            const { data, error: exportError } = await supabase.functions.invoke('export-wikidata-beers');

                            if (exportError) throw exportError;

                            // Trigger download
                            const blob = new Blob([data], { type: 'text/plain' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
                            a.download = `sheps-beers-wikidata-${timestamp}.txt`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);

                            toast.success(`Exported ${readyBeers.length} beers to Wikidata TSV`);
                            await fetchPages(); // Refresh to show updated status
                          } catch (error: any) {
                            console.error('Export error:', error);
                            toast.error(error.message || 'Failed to export beers');
                          }
                        }}
                      >
                        Export Wikidata (Beers)
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Export beers ready for Wikidata as QuickStatements format
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Page
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Page</DialogTitle>
                    <DialogDescription>
                      Manually add a single page to track
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="path">Path *</Label>
                      <Input
                        id="path"
                        placeholder="/beers/spitfire"
                        value={newPage.path}
                        onChange={(e) => {
                          setNewPage({ ...newPage, path: e.target.value });
                          setPathError(""); // Clear error on input change
                          setDuplicatePage(null); // Clear duplicate state
                        }}
                        className={`rounded-xl ${pathError ? "border-destructive" : ""}`}
                      />
                      {pathError && (
                        <p className="text-sm text-destructive mt-1">
                          {pathError}
                          {duplicatePage && (
                            <>
                              {" "}
                              <button
                                type="button"
                                className="underline font-medium hover:text-destructive/80"
                                onClick={() => window.open(`/pages/${duplicatePage.id}`, "_blank")}
                              >
                                View existing page
                              </button>
                            </>
                          )}
                        </p>
                      )}
                      {checkingDuplicate && (
                        <p className="text-xs text-muted-foreground">Checking for duplicates...</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="domain">Domain</Label>
                      <Select 
                        value={newPage.domain} 
                        onValueChange={(value) => {
                          // When domain changes, reset page_type and category
                          setNewPage({ 
                            ...newPage, 
                            domain: value, 
                            page_type: "", 
                            category: "" 
                          });
                        }}
                        disabled={domainsLoading}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder={domainsLoading ? "Loading..." : "Select a domain"} />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {domains.map((domain) => (
                            <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="page_type">
                        Page Type {(newPage.domain === "Corporate" || newPage.domain === "Beer") && <span className="text-destructive">*</span>}
                      </Label>
                      <Select 
                        value={newPage.page_type} 
                        onValueChange={(value) => {
                          // When page type changes, reset category
                          setNewPage({ ...newPage, page_type: value, category: "" });
                        }}
                        disabled={!newPage.domain || domainPageTypesLoading}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder={
                            !newPage.domain 
                              ? "Select a domain first" 
                              : domainPageTypesLoading 
                                ? "Loading..." 
                                : domainPageTypes.length === 0
                                  ? "No page types configured for this domain"
                                  : "Select a page type"
                          } />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl max-h-[300px]">
                          {domainPageTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(newPage.domain === "Corporate" || newPage.domain === "Beer") && (
                        <p className="text-xs text-muted-foreground">Required for {newPage.domain} pages</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">
                        Category {(newPage.domain === "Corporate" || newPage.domain === "Beer") && <span className="text-destructive">*</span>}
                      </Label>
                      <Select 
                        value={newPage.category} 
                        onValueChange={(value) => setNewPage({ ...newPage, category: value })}
                        disabled={!newPage.page_type || categoriesLoading}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder={
                            !newPage.page_type 
                              ? "Select a page type first" 
                              : categoriesLoading 
                                ? "Loading..." 
                                : pageTypeCategories.length === 0
                                  ? "No categories configured for this page type"
                                  : "Select a category"
                          } />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl max-h-[300px]">
                          {pageTypeCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(newPage.domain === "Corporate" || newPage.domain === "Beer") && (
                        <p className="text-xs text-muted-foreground">Required for {newPage.domain} pages</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="faq_mode">FAQ Mode</Label>
                        <Select value={newPage.faq_mode} onValueChange={(value) => setNewPage({ ...newPage, faq_mode: value })}>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl">
                            {FAQ_MODES.map((mode) => (
                              <SelectItem key={mode} value={mode}>{mode === "auto" ? "Auto" : "Ignore"}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2 pt-8">
                        <input
                          type="checkbox"
                          id="has_faq"
                          checked={newPage.has_faq}
                          onChange={(e) => setNewPage({ ...newPage, has_faq: e.target.checked })}
                          className="rounded border-input"
                        />
                        <Label htmlFor="has_faq" className="cursor-pointer">Has FAQ</Label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        placeholder="Optional notes about this page..."
                        value={newPage.notes}
                        onChange={(e) => setNewPage({ ...newPage, notes: e.target.value })}
                        className="min-h-[80px] rounded-xl"
                      />
                    </div>

                    <Button 
                      onClick={handleAddPage} 
                      className="w-full rounded-full"
                      disabled={!!duplicatePage || checkingDuplicate}
                    >
                      Add Page
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-full">
                    <Upload className="mr-2 h-4 w-4" />
                    Bulk Add Pages
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Bulk Add Pages</DialogTitle>
                    <DialogDescription>
                      Enter one path per line. Section and page type will be auto-detected.
                    </DialogDescription>
                  </DialogHeader>
                  <Textarea
                    placeholder="/beers/spitfire&#10;/about-us&#10;/news/new-appointment"
                    value={bulkPaths}
                    onChange={(e) => setBulkPaths(e.target.value)}
                    className="min-h-[200px] rounded-xl"
                  />
                  <Button onClick={handleBulkAdd} className="rounded-full">Add Pages</Button>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-full bg-muted/30 border-0 focus-visible:ring-primary/20"
            />
          </div>
          <Select value={pageTypeFilter} onValueChange={setPageTypeFilter} disabled={allPageTypesLoading}>
            <SelectTrigger className="w-[180px] rounded-full bg-muted/30 border-0">
              <SelectValue placeholder="Filter by page type" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">All Page Types</SelectItem>
              {allPageTypes.map((type) => (
                <SelectItem key={type.id} value={type.label}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] rounded-full bg-muted/30 border-0">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">All Statuses</SelectItem>
              {PAGE_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {PAGE_STATUS_CONFIG[status].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={domainFilter} onValueChange={setDomainFilter} disabled={domainsLoading}>
            <SelectTrigger className="w-[180px] rounded-full bg-muted/30 border-0">
              <SelectValue placeholder="Filter by domain" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Domains</SelectItem>
              {domains.map((domain) => (
                <SelectItem key={domain} value={domain}>
                  {domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedPageIds.size > 0 && canEdit && (
          <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-2xl">
            <span className="text-sm text-muted-foreground">{selectedPageIds.size} selected</span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setBulkActionType("section");
                setBulkActionValue(SECTIONS[0]);
                setBulkActionDialogOpen(true);
              }}
            >
              Change Section
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setBulkActionType("page_type");
                setBulkActionValue(PAGE_TYPES[0]);
                setBulkActionDialogOpen(true);
              }}
            >
              Change Type
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setBulkActionType("status");
                setBulkActionValue(PAGE_STATUS_OPTIONS[0]);
                setBulkActionDialogOpen(true);
              }}
            >
              Change Status
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setBulkActionType("delete");
                setBulkActionDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full ml-auto"
              onClick={() => setSelectedPageIds(new Set())}
            >
              Clear
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="border-0 rounded-2xl overflow-hidden shadow-sm bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/30">
                  {canEdit && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedPageIds.size === filteredPages.length && filteredPages.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead 
                    className="font-semibold cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => handleSort("path")}
                  >
                    <div className="flex items-center gap-1">
                      Path (view)
                      {sortColumn === "path" && (
                        sortDirection === "asc" ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      )}
                      {sortColumn !== "path" && <ArrowUpDown className="h-4 w-4 opacity-30" />}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => handleSort("domain")}
                  >
                    <div className="flex items-center gap-1">
                      Domain
                      {sortColumn === "domain" && (
                        sortDirection === "asc" ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      )}
                      {sortColumn !== "domain" && <ArrowUpDown className="h-4 w-4 opacity-30" />}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => handleSort("page_type")}
                  >
                    <div className="flex items-center gap-1">
                      Page Type
                      {sortColumn === "page_type" && (
                        sortDirection === "asc" ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      )}
                      {sortColumn !== "page_type" && <ArrowUpDown className="h-4 w-4 opacity-30" />}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => handleSort("category")}
                  >
                    <div className="flex items-center gap-1">
                      Category
                      {sortColumn === "category" && (
                        sortDirection === "asc" ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      )}
                      {sortColumn !== "category" && <ArrowUpDown className="h-4 w-4 opacity-30" />}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="font-semibold cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sortColumn === "status" && (
                        sortDirection === "asc" ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      )}
                      {sortColumn !== "status" && <ArrowUpDown className="h-4 w-4 opacity-30" />}
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold w-12"></TableHead>
                  <TableHead className="font-semibold">Schema Ver</TableHead>
                  <TableHead className="font-semibold">FAQ</TableHead>
                  <TableHead 
                    className="font-semibold cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => handleSort("last_schema_generated_at")}
                  >
                    <div className="flex items-center gap-1">
                      Last Schema
                      {sortColumn === "last_schema_generated_at" && (
                        sortDirection === "asc" ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      )}
                      {sortColumn !== "last_schema_generated_at" && <ArrowUpDown className="h-4 w-4 opacity-30" />}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 10 : 9} className="text-center text-muted-foreground py-8">
                    No pages found
                  </TableCell>
                </TableRow>
                ) : (
                  // Render homepage rows first, then other sorted rows
                  [...homepageRows, ...otherRows].map((page) => {
                    const pageIsHomepage = isHomepage(page);
                    return (
                    <TableRow 
                      key={page.id}
                      className={pageIsHomepage ? "bg-muted/20" : ""}
                    >
                      {canEdit && (
                        <TableCell>
                          <Checkbox
                            checked={selectedPageIds.has(page.id)}
                            onCheckedChange={() => toggleSelectPage(page.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          {pageIsHomepage && (
                            <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          )}
                          <Link 
                            to={`/pages/${page.id}`} 
                            className="text-primary hover:text-primary/80 hover:underline transition-all cursor-pointer font-medium"
                          >
                            {getPathDisplay(page.path)}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell>
                        {pageIsHomepage && !canEdit ? (
                          <DomainBadge domain={page.domain || 'Corporate'} />
                        ) : pageIsHomepage && canEdit ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <DomainBadge domain={page.domain || 'Corporate'} />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Homepage domain is protected</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <DomainBadge domain={page.domain || 'Corporate'} />
                        )}
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <PageTypeSelect
                            domain={page.domain || 'Corporate'}
                            value={page.page_type}
                            onChange={(newType) => handleInlineUpdate(page.id, "page_type", newType)}
                            onPageTypeChange={() => {
                              // Clear category when page type changes
                              if (page.category) {
                                handleInlineUpdate(page.id, "category", null);
                              }
                            }}
                          />
                        ) : (
                          <span className="text-sm">{page.page_type || "—"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <CategorySelect
                            pageType={page.page_type}
                            value={page.category}
                            onChange={(newCategory) => handleInlineUpdate(page.id, "category", newCategory)}
                          />
                        ) : (
                          <span className="text-sm">{page.category || "—"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <TooltipProvider>
                            <Tooltip>
                              <Select
                                value={normalizeStatus(page.status)}
                                onValueChange={(value) => handleInlineUpdate(page.id, "status", value)}
                              >
                                <TooltipTrigger asChild>
                                  <SelectTrigger 
                                    className="w-8 h-8 rounded-full p-0 border-0 hover:bg-accent"
                                    aria-label={PAGE_STATUS_CONFIG[normalizeStatus(page.status)].label}
                                  >
                                    <div 
                                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${PAGE_STATUS_CONFIG[normalizeStatus(page.status)].bgClass}`}
                                    >
                                      {(() => {
                                        const StatusIcon = PAGE_STATUS_CONFIG[normalizeStatus(page.status)].icon;
                                        return <StatusIcon className={`h-3.5 w-3.5 ${PAGE_STATUS_CONFIG[normalizeStatus(page.status)].textClass}`} />;
                                      })()}
                                    </div>
                                  </SelectTrigger>
                                </TooltipTrigger>
                                <SelectContent className="rounded-xl">
                                  {PAGE_STATUS_OPTIONS.map((status) => {
                                    const hasSchema = !!page.last_schema_generated_at;
                                    const validation = canUpdateStatus(page.status, status, hasSchema);
                                    return (
                                      <SelectItem 
                                        key={status} 
                                        value={status}
                                        disabled={!validation.allowed}
                                      >
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className="flex items-center gap-2">
                                                <div className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${PAGE_STATUS_CONFIG[status].bgClass}`}>
                                                  {(() => {
                                                    const StatusIcon = PAGE_STATUS_CONFIG[status].icon;
                                                    return <StatusIcon className={`h-3 w-3 ${PAGE_STATUS_CONFIG[status].textClass}`} />;
                                                  })()}
                                                </div>
                                                <span>{PAGE_STATUS_CONFIG[status].label}</span>
                                              </div>
                                            </TooltipTrigger>
                                            {!validation.allowed && (
                                              <TooltipContent side="right">
                                                <p className="text-xs max-w-[200px]">{validation.message}</p>
                                              </TooltipContent>
                                            )}
                                          </Tooltip>
                                        </TooltipProvider>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              <TooltipContent>
                                <p className="font-medium">{PAGE_STATUS_CONFIG[normalizeStatus(page.status)].label}</p>
                                <p className="text-xs text-muted-foreground mt-1">{PAGE_STATUS_CONFIG[normalizeStatus(page.status)].description}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${PAGE_STATUS_CONFIG[normalizeStatus(page.status)].bgClass}`}
                                  aria-label={`${PAGE_STATUS_CONFIG[normalizeStatus(page.status)].label} - ${PAGE_STATUS_CONFIG[normalizeStatus(page.status)].description}`}
                                  title={`${PAGE_STATUS_CONFIG[normalizeStatus(page.status)].label} - ${PAGE_STATUS_CONFIG[normalizeStatus(page.status)].description}`}
                                >
                                  {(() => {
                                    const StatusIcon = PAGE_STATUS_CONFIG[normalizeStatus(page.status)].icon;
                                    return <StatusIcon className={`h-3.5 w-3.5 ${PAGE_STATUS_CONFIG[normalizeStatus(page.status)].textClass}`} />;
                                  })()}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">{PAGE_STATUS_CONFIG[normalizeStatus(page.status)].label}</p>
                                <p className="text-xs text-muted-foreground mt-1">{PAGE_STATUS_CONFIG[normalizeStatus(page.status)].description}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                disabled={
                                  normalizeStatus(page.status) === 'naked' || 
                                  !page.last_schema_generated_at ||
                                  copyingSchemaForPageId === page.id
                                }
                                onClick={() => handleCopyDrupalSchema(page)}
                                aria-label="Copy Drupal script schema"
                              >
                                {copyingSchemaForPageId === page.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <ArrowUp className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Copy Drupal &lt;script&gt; schema</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-default">
                                {getSchemaVersionBadge(page.id)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Schema version indicator</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <Checkbox
                            checked={page.has_faq}
                            onCheckedChange={(checked) => handleInlineUpdate(page.id, "has_faq", checked)}
                          />
                        ) : (
                          page.has_faq ? "Yes" : "No"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          {page.last_schema_generated_at && (
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 flex-shrink-0" />
                          )}
                          <span>
                            {page.last_schema_generated_at
                              ? new Date(page.last_schema_generated_at).toLocaleDateString()
                              : "Never"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {isAdmin && (
          <div className="mt-8 p-6 border-2 border-destructive/20 rounded-2xl bg-destructive/5">
            <h3 className="text-lg font-semibold text-destructive mb-2">Danger Zone</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Permanently delete all pages and related schema/graph data. This action cannot be undone.
            </p>
            <Button
              variant="destructive"
              onClick={() => setResetDialogOpen(true)}
              className="rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Reset All Pages
            </Button>
          </div>
        )}

        <p className="text-sm text-muted-foreground px-2">
          Showing {filteredPages.length} of {pages.length} pages
        </p>

        {/* Bulk Action Dialog */}
        <AlertDialog open={bulkActionDialogOpen} onOpenChange={setBulkActionDialogOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {bulkActionType === "delete" ? "Delete Pages" : `Change ${bulkActionType}`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {bulkActionType === "delete" ? (
                  `Are you sure you want to delete ${selectedPageIds.size} pages? This action cannot be undone.`
                ) : (
                  <>
                    Select a new value for {bulkActionType} for {selectedPageIds.size} pages.
                    <div className="mt-4">
                      {bulkActionType === "section" && (
                        <Select value={bulkActionValue} onValueChange={setBulkActionValue}>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl">
                            {SECTIONS.map((section) => (
                              <SelectItem key={section} value={section}>{section}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {bulkActionType === "page_type" && (
                        <Select value={bulkActionValue} onValueChange={setBulkActionValue}>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl">
                            {PAGE_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {bulkActionType === "status" && (
                        <Select value={bulkActionValue} onValueChange={setBulkActionValue}>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl">
                            {PAGE_STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {PAGE_STATUS_CONFIG[status].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkAction} className="rounded-full">
                {bulkActionType === "delete" ? "Delete" : "Update"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reset Pages Dialog */}
        <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Reset All Pages</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete ALL pages, schema versions, and graph data. This action cannot be undone.
                <div className="mt-4">
                  <Label>Type RESET to confirm</Label>
                  <Input
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="RESET"
                    className="mt-2 rounded-xl"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full" onClick={() => setResetConfirmText("")}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleResetPages}
                disabled={resetConfirmText !== "RESET"}
                className="rounded-full bg-destructive hover:bg-destructive/90"
              >
                Reset All Pages
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Duplicate Pages Dialog */}
        <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Duplicate Pages Detected</AlertDialogTitle>
              <AlertDialogDescription>
                The following {duplicatePaths.length} path(s) already exist in the database:
                <div className="mt-3 p-3 bg-muted/50 rounded-xl max-h-[200px] overflow-y-auto">
                  <ul className="text-sm space-y-1">
                    {duplicatePaths.map((path) => (
                      <li key={path} className="font-mono text-foreground">{path}</li>
                    ))}
                  </ul>
                </div>
                <p className="mt-3">
                  Would you like to <strong>replace</strong> the existing pages (deleting all their data including schema versions) or <strong>keep</strong> the existing ones and only add the {pendingNewPaths.length} new path(s)?
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                className="rounded-full" 
                onClick={() => {
                  setDuplicateDialogOpen(false);
                  setDuplicatePaths([]);
                  setPendingNewPaths([]);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <Button
                variant="outline"
                onClick={handleKeepExisting}
                className="rounded-full"
              >
                Keep Existing
              </Button>
              <AlertDialogAction
                onClick={handleReplaceExisting}
                className="rounded-full bg-destructive hover:bg-destructive/90"
              >
                Replace Existing
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Copy Modal - Works in all browsers */}
        <Dialog open={showCopyModal} onOpenChange={setShowCopyModal}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Copy Drupal Schema</DialogTitle>
              <DialogDescription>
                Click the Copy button below, or manually select all (Cmd/Ctrl+A) and copy (Cmd/Ctrl+C)
              </DialogDescription>
            </DialogHeader>
            <textarea
              readOnly
              value={modalCopyContent}
              className="w-full h-96 p-4 font-mono text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              onFocus={(e) => e.target.select()}
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowCopyModal(false)}
              >
                Close
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(modalCopyContent);
                    toast.success("Copied to clipboard!");
                  } catch (err) {
                    toast.error("Could not auto-copy. Please select the text above and copy manually (Cmd/Ctrl+C)");
                  }
                }}
              >
                Copy to Clipboard
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
