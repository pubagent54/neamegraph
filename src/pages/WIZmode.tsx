/**
 * WIZmode v3.1 - Batch Page Creation & Schema Generation
 * 
 * Admin-only screen with two modes:
 * 1. Upload CSV - batch import from CSV file
 * 2. Table Entry - manual entry/paste of rows
 * 
 * Both modes feed into the same backend engine (wizmode-process)
 * 
 * TAXONOMY INTEGRATION:
 * Domain, Page Type, and Category options now come from database taxonomy tables
 * (page_type_definitions, page_category_definitions). Changes in /settings/taxonomy
 * automatically flow through to Wizmode dropdowns with no code changes.
 */

import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Wand2, PlayCircle, Loader2, CheckCircle2, XCircle, AlertCircle, Trash2, Plus, Eye, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { normalizePath } from "@/lib/domain-config";
import { loadPageTypes, loadCategories } from "@/lib/taxonomy";
import type { PageTypeDefinition, CategoryDefinition } from "@/lib/taxonomy";

interface WizmodeRun {
  id: string;
  created_at: string;
  label: string | null;
  total_rows: number;
  status: string;
}

interface WizmodeRunItem {
  id: string;
  row_number: number;
  domain: string;
  path: string;
  page_type: string | null;
  category: string | null;
  page_id: string | null;
  result: string;
  error_message: string | null;
  html_status: string;
  schema_status: string;
  validation_status: string;
  validation_error_count: number;
  validation_warning_count: number;
  validation_issues: any;
}

interface TableRow {
  id: string;
  urlOrPath: string;
  domain: string;
  page_type: string;
  category: string;
}

export default function WIZmode() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userRole === "admin";

  // Taxonomy data loaded once at component mount
  const [domains, setDomains] = useState<string[]>([]);
  const [allPageTypes, setAllPageTypes] = useState<PageTypeDefinition[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryDefinition[]>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);

  // Shared state
  const [batchLabel, setBatchLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [currentRun, setCurrentRun] = useState<WizmodeRun | null>(null);
  const [runItems, setRunItems] = useState<WizmodeRunItem[]>([]);
  const [pastRuns, setPastRuns] = useState<WizmodeRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  
  // CSV mode state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [estimatedRowCount, setEstimatedRowCount] = useState<number | null>(null);

  // Table mode state
  const [tableRows, setTableRows] = useState<TableRow[]>([
    { id: crypto.randomUUID(), urlOrPath: '', domain: '', page_type: '', category: '' }
  ]);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());

  // Cleanup dialog
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [oldRunsCount, setOldRunsCount] = useState<number>(0);
  const [cleaningUp, setCleaningUp] = useState(false);

  // Admin-only check
  if (userRole !== "admin") {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">WIZmode is available to administrators only.</p>
          <Button onClick={() => navigate("/pages")} className="mt-4">
            Back to Pages
          </Button>
        </div>
      </Layout>
    );
  }

  // Load taxonomy data on mount
  useEffect(() => {
    const loadTaxonomy = async () => {
      try {
        setTaxonomyLoading(true);
        const [pageTypes, categories] = await Promise.all([
          loadPageTypes(true),
          loadCategories(true)
        ]);
        
        setAllPageTypes(pageTypes);
        setAllCategories(categories);
        
        // Extract unique domains from page types
        const uniqueDomains = Array.from(new Set(pageTypes.map(pt => pt.domain))).sort();
        setDomains(uniqueDomains);
      } catch (error) {
        console.error("Error loading taxonomy:", error);
        toast.error("Failed to load taxonomy data");
      } finally {
        setTaxonomyLoading(false);
      }
    };
    
    loadTaxonomy();
  }, []);

  useEffect(() => {
    fetchPastRuns();
  }, []);

  useEffect(() => {
    if (!currentRun) return;

    fetchRunProgress(currentRun.id);

    const itemsChannel = supabase
      .channel(`wizmode_items_${currentRun.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'wizmode_run_items',
        filter: `run_id=eq.${currentRun.id}`
      }, () => {
        fetchRunProgress(currentRun.id);
      })
      .subscribe();

    const runsChannel = supabase
      .channel(`wizmode_run_${currentRun.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'wizmode_runs',
        filter: `id=eq.${currentRun.id}`
      }, (payload) => {
        const updatedRun = payload.new as WizmodeRun;
        setCurrentRun(updatedRun);
        
        if (updatedRun.status === "completed" || updatedRun.status === "failed") {
          toast.success(`Run ${updatedRun.status}`);
          fetchPastRuns();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(runsChannel);
    };
  }, [currentRun?.id]);

  const fetchPastRuns = async () => {
    try {
      const { data, error } = await supabase
        .from("wizmode_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setPastRuns(data || []);
    } catch (error) {
      console.error("Error fetching past runs:", error);
    }
  };

  const fetchRunProgress = async (runId: string) => {
    try {
      const { data: runData, error: runError } = await supabase
        .from("wizmode_runs")
        .select("*")
        .eq("id", runId)
        .single();

      if (runError) throw runError;
      setCurrentRun(runData);

      const { data: itemsData, error: itemsError } = await supabase
        .from("wizmode_run_items")
        .select("*")
        .eq("run_id", runId)
        .order("row_number");

      if (itemsError) throw itemsError;
      setRunItems(itemsData || []);

      if (runData.status === "completed" || runData.status === "failed") {
        fetchPastRuns();
      }
    } catch (error) {
      console.error("Error fetching run progress:", error);
    }
  };

  // Helper to get page types for a domain
  const getPageTypesForDomain = (domain: string): PageTypeDefinition[] => {
    if (!domain) return [];
    return allPageTypes.filter(pt => pt.domain === domain && pt.active);
  };

  // Helper to get categories for a page type
  const getCategoriesForPageType = (pageTypeId: string): CategoryDefinition[] => {
    if (!pageTypeId) return [];
    return allCategories.filter(cat => cat.page_type_id === pageTypeId && cat.active);
  };

  // ============================================
  // CSV MODE FUNCTIONS
  // ============================================

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".csv")) {
        toast.error("Please upload a CSV file");
        return;
      }
      setCsvFile(file);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter((line) => line.trim());
        const firstRow = lines[0]?.split(",").map((h) => h.trim().toLowerCase());
        const requiredColumns = ["domain", "path", "page_type", "category"];
        const hasHeader = requiredColumns.every((col) => firstRow.includes(col));
        const dataLines = hasHeader ? lines.length - 1 : lines.length;
        setEstimatedRowCount(dataLines);
      };
      reader.readAsText(file);
    }
  };

  const parseCsv = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split("\n").filter((line) => line.trim());
        
        if (lines.length < 1) {
          reject(new Error("CSV file is empty"));
          return;
        }

        const firstRow = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const requiredColumns = ["domain", "path", "page_type", "category"];
        const hasHeader = requiredColumns.every((col) => firstRow.includes(col));

        let headers: string[];
        let dataStartIndex: number;

        if (hasHeader) {
          headers = firstRow;
          dataStartIndex = 1;
        } else {
          headers = requiredColumns;
          dataStartIndex = 0;
        }

        const rows = lines.slice(dataStartIndex).map((line, index) => {
          const values = line.split(",").map((v) => v.trim());
          const row: any = { row_number: index + 1 };
          
          headers.forEach((header, i) => {
            let value = values[i] || "";
            
            // Normalize domain (case-insensitive match)
            if (header === "domain" && value) {
              const matchedDomain = domains.find(d => d.toLowerCase() === value.toLowerCase());
              value = matchedDomain || value;
            }
            
            // Normalize page_type (case-insensitive match against IDs)
            if (header === "page_type" && value) {
              const matchedPageType = allPageTypes.find(pt => 
                pt.id.toLowerCase() === value.toLowerCase() || 
                pt.label.toLowerCase() === value.toLowerCase()
              );
              value = matchedPageType ? matchedPageType.id : value;
            }
            
            // Normalize category (case-insensitive match against IDs)
            if (header === "category" && value) {
              const matchedCategory = allCategories.find(cat => 
                cat.id.toLowerCase() === value.toLowerCase() || 
                cat.label.toLowerCase() === value.toLowerCase()
              );
              value = matchedCategory ? matchedCategory.id : value;
            }
            
            row[header] = value;
          });
          
          return row;
        });

        resolve(rows);
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  };

  const handleStartCsvRun = async () => {
    if (!csvFile) {
      toast.error("Please select a CSV file");
      return;
    }

    setUploading(true);
    setStartTime(Date.now());

    try {
      const rows = await parseCsv(csvFile);
      
      if (rows.length === 0) {
        toast.error("CSV file is empty");
        return;
      }

      toast.info(`Parsed ${rows.length} rows from CSV`);

      const { data: { user } } = await supabase.auth.getUser();

      const { data: run, error: runError } = await supabase
        .from("wizmode_runs")
        .insert({
          label: batchLabel || `CSV Batch ${new Date().toLocaleDateString()}`,
          total_rows: rows.length,
          status: "pending",
          created_by_user_id: user?.id,
        })
        .select()
        .single();

      if (runError) throw runError;

      const items = rows.map((row) => ({
        run_id: run.id,
        row_number: row.row_number,
        domain: row.domain,
        path: row.path,
        page_type: row.page_type,
        category: row.category,
        result: "pending",
        html_status: "pending",
        schema_status: "pending",
      }));

      const { error: itemsError } = await supabase
        .from("wizmode_run_items")
        .insert(items);

      if (itemsError) throw itemsError;

      setCurrentRun(run);
      const { data: createdItems } = await supabase
        .from("wizmode_run_items")
        .select("*")
        .eq("run_id", run.id)
        .order("row_number");
      
      setRunItems(createdItems || []);
      toast.success(`WIZmode run created with ${rows.length} rows`);

      await supabase.functions.invoke("wizmode-process", {
        body: { run_id: run.id },
      });

      toast.info("Processing started in background...");
      
      // Clear CSV file
      setCsvFile(null);
      setBatchLabel("");
    } catch (error: any) {
      console.error("Error starting run:", error);
      toast.error(error.message || "Failed to start run");
    } finally {
      setUploading(false);
    }
  };

  // ============================================
  // TABLE MODE FUNCTIONS
  // ============================================

  const addTableRow = () => {
    setTableRows([...tableRows, {
      id: crypto.randomUUID(),
      urlOrPath: '',
      domain: '',
      page_type: '',
      category: '',
    }]);
  };

  const deleteTableRow = (id: string) => {
    if (tableRows.length === 1) {
      // Reset to single empty row
      setTableRows([{
        id: crypto.randomUUID(),
        urlOrPath: '',
        domain: '',
        page_type: '',
        category: '',
      }]);
    } else {
      setTableRows(tableRows.filter(row => row.id !== id));
    }
    // Clear validation errors for deleted row
    setValidationErrors(new Set([...validationErrors].filter(err => !err.startsWith(id))));
  };

  const clearTable = () => {
    setTableRows([{
      id: crypto.randomUUID(),
      urlOrPath: '',
      domain: '',
      page_type: '',
      category: '',
    }]);
    setValidationErrors(new Set());
  };

  const updateTableRow = (id: string, field: keyof TableRow, value: any) => {
    setTableRows(tableRows.map(row => {
      if (row.id !== id) return row;
      
      const updated = { ...row, [field]: value };
      
      // Reset dependent fields when parent changes
      if (field === 'domain') {
        updated.page_type = '';
        updated.category = '';
      } else if (field === 'page_type') {
        updated.category = '';
      }
      
      return updated;
    }));
    
    // Clear validation errors for this field
    setValidationErrors(new Set([...validationErrors].filter(err => !err.startsWith(`${id}-${field}`))));
  };

  const matchValueCaseInsensitive = (value: string, options: { id: string; label: string }[]): string => {
    if (!value) return '';
    const normalized = value.trim().toLowerCase();
    const matched = options.find(opt => 
      opt.id.toLowerCase() === normalized || 
      opt.label.toLowerCase() === normalized
    );
    return matched ? matched.id : '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    
    const clipboardText = e.clipboardData.getData('text/plain');
    if (!clipboardText.trim()) return;

    // Parse clipboard data into rows and cells
    const pastedRows = clipboardText
      .replace(/\r/g, "")
      .split("\n")
      .filter(line => line.trim().length > 0)
      .map(line => line.split("\t"));

    if (pastedRows.length === 0) return;

    // Find starting row index (default to 0 if no focus)
    const startIndex = 0;

    // Ensure we have enough rows in the table
    const updatedRows = [...tableRows];
    while (updatedRows.length < startIndex + pastedRows.length) {
      updatedRows.push({
        id: crypto.randomUUID(),
        urlOrPath: '',
        domain: '',
        page_type: '',
        category: '',
      });
    }

    // Apply pasted data to rows
    pastedRows.forEach((cells, i) => {
      const rowIndex = startIndex + i;
      const row = updatedRows[rowIndex];

      // Column 1: URL/Path
      if (cells[0]) {
        row.urlOrPath = cells[0].trim();
      }

      // Column 2: Domain
      if (cells[1]) {
        const matchedDomain = domains.find(d => d.toLowerCase() === cells[1].trim().toLowerCase());
        row.domain = matchedDomain || '';
        // Reset dependent fields if domain changes
        if (!matchedDomain) {
          row.page_type = '';
          row.category = '';
        }
      }

      // Column 3: Page Type
      if (cells[2] && row.domain) {
        const pageTypesForDomain = getPageTypesForDomain(row.domain);
        const matchedPageType = matchValueCaseInsensitive(cells[2], pageTypesForDomain);
        row.page_type = matchedPageType;
        // Reset category if page type changes
        if (!matchedPageType) {
          row.category = '';
        }
      }

      // Column 4: Category
      if (cells[3] && row.page_type) {
        const categoriesForPageType = getCategoriesForPageType(row.page_type);
        const matchedCategory = matchValueCaseInsensitive(cells[3], categoriesForPageType);
        row.category = matchedCategory;
      }
    });

    setTableRows(updatedRows);
    setValidationErrors(new Set()); // Clear validation errors after paste
    toast.success(`Pasted ${pastedRows.length} row${pastedRows.length === 1 ? '' : 's'} into Table Entry`);
  };

  const validateTableRows = (): { valid: boolean; validRows: any[]; errors: string[] } => {
    const errors: string[] = [];
    const validRows: any[] = [];
    const newValidationErrors = new Set<string>();

    tableRows.forEach((row, index) => {
      // Skip completely empty rows
      if (!row.urlOrPath && !row.domain && !row.page_type && !row.category) {
        return;
      }

      // Check required fields
      if (!row.urlOrPath.trim()) {
        errors.push(`Row ${index + 1}: URL/Path is required`);
        newValidationErrors.add(`${row.id}-urlOrPath`);
      }
      if (!row.domain) {
        errors.push(`Row ${index + 1}: Domain is required`);
        newValidationErrors.add(`${row.id}-domain`);
      } else if (!domains.includes(row.domain)) {
        errors.push(`Row ${index + 1}: Invalid domain "${row.domain}"`);
        newValidationErrors.add(`${row.id}-domain`);
      }
      
      if (!row.page_type) {
        errors.push(`Row ${index + 1}: Page Type is required`);
        newValidationErrors.add(`${row.id}-page_type`);
      } else if (row.domain) {
        const validPageTypes = getPageTypesForDomain(row.domain);
        if (!validPageTypes.find(pt => pt.id === row.page_type)) {
          errors.push(`Row ${index + 1}: Invalid page type "${row.page_type}" for domain "${row.domain}"`);
          newValidationErrors.add(`${row.id}-page_type`);
        }
      }
      
      if (!row.category) {
        errors.push(`Row ${index + 1}: Category is required`);
        newValidationErrors.add(`${row.id}-category`);
      } else if (row.page_type) {
        const validCategories = getCategoriesForPageType(row.page_type);
        if (!validCategories.find(cat => cat.id === row.category)) {
          errors.push(`Row ${index + 1}: Invalid category "${row.category}" for page type "${row.page_type}"`);
          newValidationErrors.add(`${row.id}-category`);
        }
      }

      // If all required fields present and valid, add to valid rows
      if (row.urlOrPath.trim() && row.domain && row.page_type && row.category && 
          newValidationErrors.size === validRows.length * 4) { // No new errors for this row
        const normalizedPathValue = normalizePath(row.urlOrPath);
        validRows.push({
          row_number: index + 1,
          domain: row.domain,
          path: normalizedPathValue,
          page_type: row.page_type,
          category: row.category,
        });
      }
    });

    setValidationErrors(newValidationErrors);

    return {
      valid: errors.length === 0 && validRows.length > 0,
      validRows,
      errors,
    };
  };

  const handleStartTableRun = async () => {
    const validation = validateTableRows();

    if (!validation.valid) {
      if (validation.validRows.length === 0) {
        toast.error("Please add at least one complete row before starting WIZmode");
      } else {
        toast.error(`Found ${validation.errors.length} validation error(s). Please fix highlighted fields.`);
      }
      return;
    }

    setUploading(true);
    setStartTime(Date.now());

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: run, error: runError } = await supabase
        .from("wizmode_runs")
        .insert({
          label: batchLabel || `Table Batch ${new Date().toLocaleDateString()}`,
          total_rows: validation.validRows.length,
          status: "pending",
          created_by_user_id: user?.id,
        })
        .select()
        .single();

      if (runError) throw runError;

      const items = validation.validRows.map((row) => ({
        run_id: run.id,
        row_number: row.row_number,
        domain: row.domain,
        path: row.path,
        page_type: row.page_type,
        category: row.category,
        result: "pending",
        html_status: "pending",
        schema_status: "pending",
      }));

      const { error: itemsError } = await supabase
        .from("wizmode_run_items")
        .insert(items);

      if (itemsError) throw itemsError;

      setCurrentRun(run);
      const { data: createdItems } = await supabase
        .from("wizmode_run_items")
        .select("*")
        .eq("run_id", run.id)
        .order("row_number");
      
      setRunItems(createdItems || []);
      toast.success(`WIZmode run created with ${validation.validRows.length} rows`);

      await supabase.functions.invoke("wizmode-process", {
        body: { run_id: run.id },
      });

      toast.info("Processing started in background...");
      
      // Clear table
      clearTable();
      setBatchLabel("");
    } catch (error: any) {
      console.error("Error starting run:", error);
      toast.error(error.message || "Failed to start run");
    } finally {
      setUploading(false);
    }
  };

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const viewRunDetails = async (runId: string) => {
    setSelectedRunId(runId);
    await fetchRunProgress(runId);
  };

  const getSummary = () => {
    if (!runItems.length) return null;

    const created = runItems.filter((i) => i.result === "created").length;
    const updated = runItems.filter((i) => i.result === "updated").length;
    const skipped = runItems.filter((i) => i.result === "skipped_duplicate").length;
    const errors = runItems.filter((i) => i.result === "error").length;
    const htmlSuccess = runItems.filter((i) => i.html_status === "success").length;
    const schemaSuccess = runItems.filter((i) => i.schema_status === "success").length;
    const validationValid = runItems.filter((i) => i.validation_status === "valid").length;
    const validationInvalid = runItems.filter((i) => i.validation_status === "invalid").length;
    const completed = runItems.filter((i) => i.result !== "pending").length;

    return { created, updated, skipped, errors, htmlSuccess, schemaSuccess, validationValid, validationInvalid, completed };
  };

  const getEstimatedTimeRemaining = () => {
    if (!currentRun || !startTime || !runItems.length) return null;

    const completed = runItems.filter((i) => i.result !== "pending").length;
    if (completed === 0) return null;

    const elapsed = Date.now() - startTime;
    const avgTimePerRow = elapsed / completed;
    const remaining = currentRun.total_rows - completed;
    const estimatedMs = remaining * avgTimePerRow;

    return { completed, estimatedMs, avgTimePerRow };
  };

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes === 0) return `${remainingSeconds}s`;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getInitialEstimate = (): string => {
    if (!estimatedRowCount) return "Unknown";
    const avgTimePerRow = 12000;
    const totalMs = estimatedRowCount * avgTimePerRow;
    return formatTime(totalMs);
  };

  const checkOldRuns = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count, error } = await supabase
        .from("wizmode_runs")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed")
        .lt("created_at", thirtyDaysAgo.toISOString());

      if (error) throw error;
      setOldRunsCount(count || 0);
      setCleanupDialogOpen(true);
    } catch (error) {
      console.error("Error checking old runs:", error);
      toast.error("Failed to check old runs");
    }
  };

  const handleCleanup = async () => {
    setCleaningUp(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const { data: runsToDelete, error: fetchError } = await supabase
        .from("wizmode_runs")
        .select("id, label, total_rows")
        .eq("status", "completed")
        .lt("created_at", thirtyDaysAgo.toISOString());

      if (fetchError) throw fetchError;

      const { error: deleteError } = await supabase
        .from("wizmode_runs")
        .delete()
        .eq("status", "completed")
        .lt("created_at", thirtyDaysAgo.toISOString());

      if (deleteError) throw deleteError;

      await supabase.from("audit_log").insert({
        user_id: user.id,
        entity_type: "wizmode_runs",
        action: "cleanup_old_runs",
        details: {
          deleted_count: runsToDelete?.length || 0,
          deleted_runs: runsToDelete?.map(r => ({ id: r.id, label: r.label, total_rows: r.total_rows })) || [],
        },
      });

      toast.success(`Cleaned up ${runsToDelete?.length || 0} old runs`);
      setCleanupDialogOpen(false);
      fetchPastRuns();
    } catch (error) {
      console.error("Error cleaning up old runs:", error);
      toast.error("Failed to clean up old runs");
    } finally {
      setCleaningUp(false);
    }
  };

  const summary = getSummary();
  const progress = currentRun ? (runItems.filter((i) => i.result !== "pending").length / currentRun.total_rows) * 100 : 0;

  // ============================================
  // RENDER
  // ============================================

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header with Wizard Branding */}
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-primary/10 p-3">
            <Wand2 className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-4xl font-bold tracking-tight mb-2">
              Wizmode – Large Batch Processing Facility
            </h1>
            <p className="text-lg text-muted-foreground">
              Use Wizmode when you need to upload or update lots of pages in one go. Paste data from Google Sheets or upload a CSV, and NeameGraph will map each row to the correct domain, page type, and category using the central taxonomy.
            </p>
          </div>
        </div>

        {/* Mode Selection Tabs */}
        <Tabs defaultValue="csv" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="csv">Upload CSV</TabsTrigger>
            <TabsTrigger value="table">Table Entry</TabsTrigger>
          </TabsList>

          {/* CSV Upload Mode */}
          <TabsContent value="csv" className="space-y-4 mt-6">
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Upload CSV Batch</CardTitle>
                <CardDescription>
                  Upload a CSV file with pages and taxonomy columns for bulk import or update.
                  <br />
                  CSV format: <code className="bg-muted px-2 py-1 rounded text-xs">domain, path, page_type, category</code>
                  <br />
                  Example row: <code className="bg-muted px-2 py-1 rounded text-xs">Beer,/beers/double-stout,beers,drink_brands</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="batch-label">Batch Label (optional)</Label>
                  <Input
                    id="batch-label"
                    placeholder="e.g., January 2025 Beer Launch"
                    value={batchLabel}
                    onChange={(e) => setBatchLabel(e.target.value)}
                    className="rounded-full"
                  />
                </div>
                <div>
                  <Label htmlFor="csv-file">CSV File</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="rounded-full"
                  />
                  {estimatedRowCount && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {estimatedRowCount} rows detected • Estimated time: ~{getInitialEstimate()}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleStartCsvRun}
                  disabled={!csvFile || uploading || taxonomyLoading}
                  className="rounded-full"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Start WIZmode Run
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Table Entry Mode */}
          <TabsContent value="table" className="space-y-4 mt-6">
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Add by Table</CardTitle>
                <CardDescription>
                  Paste or type rows directly here for quick bulk entry from Sheets or Excel.
                  <br />
                  Type rows directly or paste from Google Sheets / Excel (Ctrl/Cmd+V).
                  <br />
                  Paste 1-4 columns: URL/Path | Domain | Page Type | Category
                  <br />
                  Example: <code className="bg-muted px-2 py-1 rounded text-xs">/beers/orchard-view | Beer | beers | drink_brands</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Shared Batch Label */}
                <div>
                  <Label htmlFor="table-batch-label">Batch Label (optional)</Label>
                  <Input
                    id="table-batch-label"
                    placeholder="e.g., Manual Beer Entry"
                    value={batchLabel}
                    onChange={(e) => setBatchLabel(e.target.value)}
                    className="rounded-full"
                  />
                </div>

                {/* Table */}
                <div 
                  className="border rounded-xl overflow-hidden"
                  onPaste={handlePaste}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30%]">URL / Path</TableHead>
                        <TableHead className="w-[15%]">Domain</TableHead>
                        <TableHead className="w-[20%]">Page Type</TableHead>
                        <TableHead className="w-[25%]">Category</TableHead>
                        <TableHead className="w-[10%]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableRows.map((row, index) => {
                        const pageTypesForRow = getPageTypesForDomain(row.domain);
                        const categoriesForRow = getCategoriesForPageType(row.page_type);
                        
                        return (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Input
                                placeholder="/beers/orchard-view"
                                value={row.urlOrPath}
                                onChange={(e) => updateTableRow(row.id, 'urlOrPath', e.target.value)}
                                className={`rounded-md ${validationErrors.has(`${row.id}-urlOrPath`) ? 'border-red-500' : ''}`}
                              />
                            </TableCell>
                             <TableCell>
                              <Select
                                value={row.domain || ""}
                                onValueChange={(value) => updateTableRow(row.id, 'domain', value)}
                                disabled={taxonomyLoading}
                              >
                                <SelectTrigger className={`rounded-md ${validationErrors.has(`${row.id}-domain`) ? 'border-red-500' : ''}`}>
                                  <SelectValue placeholder={taxonomyLoading ? "Loading..." : "Select..."} />
                                </SelectTrigger>
                                <SelectContent className="bg-background border border-border shadow-lg z-50">
                                  {domains.map(domain => (
                                    <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                             <TableCell>
                              <Select
                                value={row.page_type || ""}
                                onValueChange={(value) => updateTableRow(row.id, 'page_type', value)}
                                disabled={!row.domain || taxonomyLoading}
                              >
                                <SelectTrigger className={`rounded-md ${validationErrors.has(`${row.id}-page_type`) ? 'border-red-500' : ''}`}>
                                  <SelectValue placeholder={!row.domain ? "Select domain first" : taxonomyLoading ? "Loading..." : "Select..."} />
                                </SelectTrigger>
                                <SelectContent className="bg-background border border-border shadow-lg z-50">
                                  {pageTypesForRow.map(pt => (
                                    <SelectItem key={pt.id} value={pt.id}>{pt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                             <TableCell>
                              <Select
                                value={row.category || ""}
                                onValueChange={(value) => updateTableRow(row.id, 'category', value)}
                                disabled={!row.page_type || taxonomyLoading}
                              >
                                <SelectTrigger className={`rounded-md ${validationErrors.has(`${row.id}-category`) ? 'border-red-500' : ''}`}>
                                  <SelectValue placeholder={!row.page_type ? "Select page type first" : taxonomyLoading ? "Loading..." : "Select..."} />
                                </SelectTrigger>
                                <SelectContent className="bg-background border border-border shadow-lg z-50">
                                  {categoriesForRow.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteTableRow(row.id)}
                                className="rounded-full"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={addTableRow}
                    variant="outline"
                    className="rounded-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Row
                  </Button>
                  <Button
                    onClick={clearTable}
                    variant="outline"
                    className="rounded-full"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All
                  </Button>
                  <div className="flex-1" />
                  <Button
                    onClick={handleStartTableRun}
                    disabled={uploading || taxonomyLoading}
                    className="rounded-full"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Start WIZmode Run
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Current Run Section */}
        {currentRun && (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Current Run: {currentRun.label}</CardTitle>
              <CardDescription>
                Status: {currentRun.status}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {(() => {
                const timeEstimate = getEstimatedTimeRemaining();
                return (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        Processing row {timeEstimate?.completed || 0} of {currentRun.total_rows}
                      </span>
                      {timeEstimate && timeEstimate.completed > 0 && (
                        <span className="text-sm text-muted-foreground">
                          ~{formatTime(timeEstimate.estimatedMs)} remaining
                        </span>
                      )}
                    </div>
                    <Progress value={progress} className="h-2" />
                    {timeEstimate && timeEstimate.completed > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Average: {formatTime(timeEstimate.avgTimePerRow)} per row
                      </p>
                    )}
                  </div>
                );
              })()}

              {summary && (
                <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
                  <Card className="rounded-xl">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{summary.created}</div>
                      <p className="text-xs text-muted-foreground">Created</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{summary.updated}</div>
                      <p className="text-xs text-muted-foreground">Updated</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{summary.skipped}</div>
                      <p className="text-xs text-muted-foreground">Skipped</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{summary.errors}</div>
                      <p className="text-xs text-muted-foreground">Errors</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{summary.htmlSuccess}</div>
                      <p className="text-xs text-muted-foreground">HTML ✓</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{summary.schemaSuccess}</div>
                      <p className="text-xs text-muted-foreground">Schema ✓</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-green-600">{summary.validationValid}</div>
                      <p className="text-xs text-muted-foreground">Valid</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-red-600">{summary.validationInvalid}</div>
                      <p className="text-xs text-muted-foreground">Invalid</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Path</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Page Type</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>HTML</TableHead>
                      <TableHead>Schema</TableHead>
                      <TableHead>Validation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.row_number}</TableCell>
                        <TableCell className="font-mono text-xs">{item.path}</TableCell>
                        <TableCell>{item.domain}</TableCell>
                        <TableCell className="text-xs">{item.page_type}</TableCell>
                        <TableCell>
                          {item.result === "created" && (
                            <Badge className="rounded-full bg-green-500">Created</Badge>
                          )}
                          {item.result === "updated" && (
                            <Badge className="rounded-full bg-blue-500">Updated</Badge>
                          )}
                          {item.result === "skipped_duplicate" && (
                            <Badge className="rounded-full bg-yellow-500">Skipped</Badge>
                          )}
                          {item.result === "error" && (
                            <Badge className="rounded-full bg-red-500">Error</Badge>
                          )}
                          {item.result === "pending" && (
                            <Badge className="rounded-full bg-gray-500">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.html_status === "success" && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                          {item.html_status === "failed" && (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          {item.html_status === "pending" && (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                          )}
                        </TableCell>
                        <TableCell>
                          {item.schema_status === "success" && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                          {item.schema_status === "failed" && (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          {item.schema_status === "pending" && (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                          )}
                        </TableCell>
                        <TableCell>
                          {item.validation_status === "valid" && (
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              {item.validation_warning_count > 0 && (
                                <span className="text-xs text-yellow-600">
                                  ({item.validation_warning_count}⚠️)
                                </span>
                              )}
                            </div>
                          )}
                          {item.validation_status === "invalid" && (
                            <div className="flex items-center gap-1">
                              <XCircle className="h-4 w-4 text-red-500" />
                              <span className="text-xs text-red-600">
                                {item.validation_error_count}❌
                              </span>
                            </div>
                          )}
                          {item.validation_status === "pending" && (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                          )}
                          {item.validation_status === "skipped" && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {item.validation_status === "error" && (
                            <div title="Validation error">
                              <AlertCircle className="h-4 w-4 text-orange-500" />
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Past Runs Section */}
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Past Runs</CardTitle>
                <CardDescription>Recent WIZmode batches</CardDescription>
              </div>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkOldRuns}
                  className="rounded-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clean Up Old Runs
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pastRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">{run.label}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(run.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>{run.total_rows}</TableCell>
                      <TableCell>
                        {run.status === "completed" && (
                          <Badge className="rounded-full bg-green-500">Completed</Badge>
                        )}
                        {run.status === "pending" && (
                          <Badge className="rounded-full bg-gray-500">Pending</Badge>
                        )}
                        {run.status === "running" && (
                          <Badge className="rounded-full bg-blue-500">Running</Badge>
                        )}
                        {run.status === "failed" && (
                          <Badge className="rounded-full bg-red-500">Failed</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewRunDetails(run.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Cleanup Dialog */}
        <AlertDialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clean Up Old Runs</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {oldRunsCount} completed WIZmode run{oldRunsCount !== 1 ? 's' : ''} older than 30 days, along with their run items.
                <br /><br />
                <strong>Note:</strong> This will NOT delete any pages - only the WIZmode run history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cleaningUp}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCleanup}
                disabled={cleaningUp}
                className="bg-red-600 hover:bg-red-700"
              >
                {cleaningUp ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  `Delete ${oldRunsCount} Run${oldRunsCount !== 1 ? 's' : ''}`
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
