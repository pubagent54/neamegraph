/**
 * Pages List Screen
 * 
 * Main pages management view displaying all corporate pages with filtering, search, and bulk actions.
 * Handles all three domain lanes (Corporate, Beer, Pub) with inline editing for page metadata.
 * Status workflow: not_started → ai_draft → needs_review → approved → implemented.
 * Clicking a path navigates to PageDetail for schema generation and version management.
 */

import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { DomainBadge } from "@/components/DomainBadge";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, Upload, Trash2, Edit, CheckCircle2, Circle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

// ========================================
// DOMAIN CONFIG - Single source of truth for Domain → Page Type → Category hierarchy
// ----------------------------------------
// Defines which Page Types and Categories are valid for each Domain lane
// Used by Add New Page modal and inline editing to enforce clean relationships
// ========================================
const DOMAIN_CONFIG: Record<string, {
  pageTypes: string[];
  categoriesByPageType: Record<string, string[]>;
}> = {
  Corporate: {
    pageTypes: ['About', 'History', 'Environment', 'Careers', 'News', 'Beers', 'Pubs & Hotels Estate'],
    categoriesByPageType: {
      'About': ['Legal', 'Direct to Trade', 'General'],
      'History': ['History'],
      'Environment': ['Sustainability', 'Community'],
      'Careers': ['Working for Shepherd Neame', 'Pub Tenancies'],
      'News': ['Pubs & Hotels', 'Community', 'Beer and Drink Brands'],
      'Beers': ['Drink Brands', 'Collection Page'],
      'Pubs & Hotels Estate': ['About', 'Collection Page'],
    },
  },
  Beer: {
    pageTypes: ['Beers', 'Brewery'],
    categoriesByPageType: {
      'Beers': ['Drink Brands', 'Collection Page'],
      'Brewery': ['Brewing Process', 'Visitors Centre'],
    },
  },
  Pub: {
    pageTypes: ['Pubs & Hotels Estate'],
    categoriesByPageType: {
      'Pubs & Hotels Estate': ['Managed', 'Tenanted', 'Freehouses'],
    },
  },
};

// Legacy V2 constants for backwards compatibility (if needed elsewhere)
const V2_PAGE_TYPES = [
  'Pubs & Hotels Estate',
  'Beers',
  'Brewery',
  'History',
  'Environment',
  'About',
  'Careers',
  'News',
];

const V2_CATEGORIES: Record<string, string[]> = {
  'Pubs & Hotels Estate': ['About', 'Collection Page'],
  'Beers': ['Drink Brands', 'Collection Page'],
  'Brewery': ['Brewing Process', 'Visitors Centre'],
  'History': ['History'],
  'Environment': ['Sustainability', 'Community'],
  'About': ['Legal', 'Direct to Trade', 'General'],
  'Careers': ['Working for Shepherd Neame', 'Pub Tenancies'],
  'News': ['Pubs & Hotels', 'Community', 'Beer and Drink Brands'],
};

const FAQ_MODES = ["auto", "ignore"];

// Status options in fixed order: Implemented always last
const STATUS_OPTIONS = [
  "not_started",    // Not Started
  "ai_draft",       // Brain Draft
  "needs_review",   // Needs Review
  "needs_rework",   // Needs Rework
  "approved",       // Approved
  "implemented"     // Implemented (always last)
];

// Status configuration for labels and dot colors
const STATUS_CONFIG = {
  not_started: { 
    label: "Not Started", 
    dotClass: "bg-muted-foreground"
  },
  ai_draft: { 
    label: "Brain Draft", 
    dotClass: "bg-status-draft"
  },
  needs_review: { 
    label: "Needs Review", 
    dotClass: "bg-status-review"
  },
  needs_rework: { 
    label: "Needs Rework", 
    dotClass: "bg-status-error"
  },
  approved: { 
    label: "Approved", 
    dotClass: "bg-status-approved"
  },
  implemented: { 
    label: "Implemented", 
    dotClass: "bg-status-implemented"
  },
} as const;

// ========================================
// DOMAIN LANE LOGIC - Corporate, Beer, Pub
// ----------------------------------------
// Corporate: Full rules-based schema engine with page_type/category matching
// Beer: Uses same rules engine as Corporate, with beer-specific metadata fields
// Pub: Phase 2 placeholder - schema generation disabled
// ========================================
const DOMAINS = ["Corporate", "Beer", "Pub"];

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

  const canEdit = userRole === "admin" || userRole === "editor";
  const isAdmin = userRole === "admin";

  useEffect(() => {
    fetchPages();
    const statusParam = searchParams.get("status");
    if (statusParam) {
      setStatusFilter(statusParam);
    }
  }, [searchParams]);

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
          status: "not_started" as const,
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

      const { error } = await supabase
        .from("pages")
        .update({
          [field]: value,
          last_modified_by_user_id: user.id,
        })
        .eq("id", pageId);

      if (error) throw error;

      setPages(pages.map(p => p.id === pageId ? { ...p, [field]: value } : p));
      toast.success("Page updated");
    } catch (error: any) {
      console.error("Error updating page:", error);
      toast.error(error.message || "Failed to update page");
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
      } else {
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

  const filteredPages = pages.filter((page) => {
    const matchesSearch = page.path.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || page.status === statusFilter;
    const matchesPageType = pageTypeFilter === "all" || page.page_type === pageTypeFilter;
    const matchesDomain = domainFilter === "all" || page.domain === domainFilter;
    return matchesSearch && matchesStatus && matchesPageType && matchesDomain;
  });

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
                          const domain = value as keyof typeof DOMAIN_CONFIG;
                          // When domain changes, reset page_type and category
                          const newState = { 
                            ...newPage, 
                            domain: value, 
                            page_type: "", 
                            category: "" 
                          };
                          
                          // Auto-select "Beers" for Beer domain
                          if (domain === "Beer") {
                            newState.page_type = "Beers";
                            // Auto-select category if only one option
                            const categories = DOMAIN_CONFIG.Beer.categoriesByPageType["Beers"];
                            if (categories && categories.length === 1) {
                              newState.category = categories[0];
                            }
                          }
                          
                          setNewPage(newState);
                        }}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {DOMAINS.map((domain) => (
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
                          const newState = { ...newPage, page_type: value, category: "" };
                          
                          // Auto-select category if only one option for this page type
                          const domain = newPage.domain as keyof typeof DOMAIN_CONFIG;
                          const domainConfig = DOMAIN_CONFIG[domain];
                          const categories = domainConfig?.categoriesByPageType[value];
                          if (categories && categories.length === 1) {
                            newState.category = categories[0];
                          }
                          
                          setNewPage(newState);
                        }}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select a page type" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl max-h-[300px]">
                          {(() => {
                            const domain = newPage.domain as keyof typeof DOMAIN_CONFIG;
                            const allowedTypes = DOMAIN_CONFIG[domain]?.pageTypes || [];
                            return allowedTypes.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ));
                          })()}
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
                        disabled={!newPage.page_type}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl max-h-[300px]">
                          {(() => {
                            if (!newPage.page_type) return null;
                            const domain = newPage.domain as keyof typeof DOMAIN_CONFIG;
                            const domainConfig = DOMAIN_CONFIG[domain];
                            const categories = domainConfig?.categoriesByPageType[newPage.page_type] || [];
                            return categories.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ));
                          })()}
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
          <Select value={pageTypeFilter} onValueChange={setPageTypeFilter}>
            <SelectTrigger className="w-[180px] rounded-full bg-muted/30 border-0">
              <SelectValue placeholder="Filter by page type" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">All Page Types</SelectItem>
              {V2_PAGE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
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
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="ai_draft">Brain Draft</SelectItem>
              <SelectItem value="needs_review">Needs Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="implemented">Implemented</SelectItem>
              <SelectItem value="needs_rework">Needs Rework</SelectItem>
            </SelectContent>
          </Select>
          <Select value={domainFilter} onValueChange={setDomainFilter}>
            <SelectTrigger className="w-[180px] rounded-full bg-muted/30 border-0">
              <SelectValue placeholder="Filter by domain" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Domains</SelectItem>
              {DOMAINS.map((domain) => (
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
                setBulkActionValue(STATUS_OPTIONS[0]);
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
                  <TableHead className="font-semibold">Path (view)</TableHead>
                  <TableHead className="font-semibold">Domain</TableHead>
                  <TableHead className="font-semibold">Page Type</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">FAQ</TableHead>
                  <TableHead className="font-semibold">Last Schema</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 8 : 7} className="text-center text-muted-foreground py-8">
                    No pages found
                  </TableCell>
                </TableRow>
                ) : (
                  filteredPages.map((page) => (
                    <TableRow key={page.id}>
                      {canEdit && (
                        <TableCell>
                          <Checkbox
                            checked={selectedPageIds.has(page.id)}
                            onCheckedChange={() => toggleSelectPage(page.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-sm">
                        <Link 
                          to={`/pages/${page.id}`} 
                          className="text-primary hover:text-primary/80 hover:underline transition-all cursor-pointer font-medium"
                        >
                          {getPathDisplay(page.path)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <DomainBadge domain={page.domain || 'Corporate'} />
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <Select
                            value={page.page_type || "none"}
                            onValueChange={(value) => {
                              const newType = value === "none" ? null : value;
                              handleInlineUpdate(page.id, "page_type", newType);
                              // Clear category if it's not valid for the new page type
                              if (newType && page.category) {
                                const domain = page.domain as keyof typeof DOMAIN_CONFIG;
                                const domainConfig = DOMAIN_CONFIG[domain];
                                const validCategories = domainConfig?.categoriesByPageType[newType] || [];
                                if (!validCategories.includes(page.category)) {
                                  handleInlineUpdate(page.id, "category", null);
                                }
                              }
                            }}
                          >
                            <SelectTrigger className="w-[180px] h-8 rounded-lg">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl max-h-[300px]">
                              <SelectItem value="none">—</SelectItem>
                              {(() => {
                                const domain = page.domain as keyof typeof DOMAIN_CONFIG;
                                const allowedTypes = DOMAIN_CONFIG[domain]?.pageTypes || V2_PAGE_TYPES;
                                // Show current value even if not in allowed list (legacy data)
                                const typesToShow = page.page_type && !allowedTypes.includes(page.page_type)
                                  ? [page.page_type, ...allowedTypes]
                                  : allowedTypes;
                                return typesToShow.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ));
                              })()}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm">{page.page_type || "—"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <Select
                            value={page.category || "none"}
                            onValueChange={(value) => handleInlineUpdate(page.id, "category", value === "none" ? null : value)}
                            disabled={!page.page_type}
                          >
                            <SelectTrigger className="w-[160px] h-8 rounded-lg">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl max-h-[300px]">
                              <SelectItem value="none">—</SelectItem>
                              {(() => {
                                if (!page.page_type) return null;
                                const domain = page.domain as keyof typeof DOMAIN_CONFIG;
                                const domainConfig = DOMAIN_CONFIG[domain];
                                const allowedCategories = domainConfig?.categoriesByPageType[page.page_type] || V2_CATEGORIES[page.page_type] || [];
                                // Show current value even if not in allowed list (legacy data)
                                const categoriesToShow = page.category && !allowedCategories.includes(page.category)
                                  ? [page.category, ...allowedCategories]
                                  : allowedCategories;
                                return categoriesToShow.map((cat) => (
                                  <SelectItem key={cat} value={cat}>
                                    {cat}
                                  </SelectItem>
                                ));
                              })()}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm">{page.category || "—"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <TooltipProvider>
                            <Tooltip>
                              <Select
                                value={page.status}
                                onValueChange={(value) => handleInlineUpdate(page.id, "status", value)}
                              >
                                <TooltipTrigger asChild>
                                  <SelectTrigger 
                                    className="w-8 h-8 rounded-full p-0 border-0 hover:bg-accent"
                                    aria-label={STATUS_CONFIG[page.status as keyof typeof STATUS_CONFIG]?.label || page.status}
                                  >
                                    <span
                                      className={`inline-block w-3 h-3 rounded-full ${STATUS_CONFIG[page.status as keyof typeof STATUS_CONFIG]?.dotClass || "bg-muted-foreground"}`}
                                    />
                                  </SelectTrigger>
                                </TooltipTrigger>
                                <SelectContent className="rounded-xl">
                                  {STATUS_OPTIONS.map((status) => (
                                    <SelectItem key={status} value={status}>
                                      <StatusBadge status={status as any} />
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <TooltipContent>
                                <p>{STATUS_CONFIG[page.status as keyof typeof STATUS_CONFIG]?.label || page.status}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-full"
                                  aria-label={STATUS_CONFIG[page.status as keyof typeof STATUS_CONFIG]?.label || page.status}
                                >
                                  <span
                                    className={`inline-block w-3 h-3 rounded-full ${STATUS_CONFIG[page.status as keyof typeof STATUS_CONFIG]?.dotClass || "bg-muted-foreground"}`}
                                  />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{STATUS_CONFIG[page.status as keyof typeof STATUS_CONFIG]?.label || page.status}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
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
                  ))
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
                            {STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status}>{status}</SelectItem>
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
      </div>
    </Layout>
  );
}
