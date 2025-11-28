/**
 * WIZmode v1 - Batch Page Creation & Schema Generation
 * 
 * Admin-only screen for uploading CSV batches to create pages and automatically
 * run Fetch HTML and Generate Schema workflows.
 * CSV format: domain, path, page_type, category (all required)
 * Reuses existing path normalization, duplicate detection, and edge functions.
 */

import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, PlayCircle, Loader2, CheckCircle2, XCircle, AlertCircle, Download, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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

export default function WIZmode() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userRole === "admin";
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [batchLabel, setBatchLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [currentRun, setCurrentRun] = useState<WizmodeRun | null>(null);
  const [runItems, setRunItems] = useState<WizmodeRunItem[]>([]);
  const [pastRuns, setPastRuns] = useState<WizmodeRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [estimatedRowCount, setEstimatedRowCount] = useState<number | null>(null);
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

  useEffect(() => {
    fetchPastRuns();
  }, []);

  useEffect(() => {
    if (!currentRun) return;

    // Initial fetch
    fetchRunProgress(currentRun.id);

    // Set up real-time subscriptions for live updates
    const itemsChannel = supabase
      .channel(`wizmode_items_${currentRun.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wizmode_run_items',
          filter: `run_id=eq.${currentRun.id}`
        },
        () => {
          // Refetch items when any change occurs
          fetchRunProgress(currentRun.id);
        }
      )
      .subscribe();

    const runsChannel = supabase
      .channel(`wizmode_run_${currentRun.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wizmode_runs',
          filter: `id=eq.${currentRun.id}`
        },
        (payload) => {
          const updatedRun = payload.new as WizmodeRun;
          setCurrentRun(updatedRun);
          
          if (updatedRun.status === "completed" || updatedRun.status === "failed") {
            toast.success(`Run ${updatedRun.status}`);
            fetchPastRuns();
          }
        }
      )
      .subscribe();

    // Cleanup subscriptions
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

      // If completed, update past runs list
      if (runData.status === "completed" || runData.status === "failed") {
        fetchPastRuns();
      }
    } catch (error) {
      console.error("Error fetching run progress:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".csv")) {
        toast.error("Please upload a CSV file");
        return;
      }
      setCsvFile(file);
      
      // Read file to count rows for initial estimate
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

        // Check if first row is a header or data
        const firstRow = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const requiredColumns = ["domain", "path", "page_type", "category"];
        const hasHeader = requiredColumns.every((col) => firstRow.includes(col));

        let headers: string[];
        let dataStartIndex: number;

        if (hasHeader) {
          // First row is header
          headers = firstRow;
          dataStartIndex = 1;
        } else {
          // No header, assume column order: domain, path, page_type, category
          headers = requiredColumns;
          dataStartIndex = 0;
        }

        // Category normalization map
        const categoryMap: Record<string, string> = {
          "pubs & hotels": "Pubs & Hotels",
          "beer & drinks brands": "Beer and Drink Brands",
          "beer and drink brands": "Beer and Drink Brands",
          "drink brands": "Drink Brands",
          "community": "Community",
          "collection page": "Collection Page",
          "working for shepherd neame": "Working for Shepherd Neame",
          "pub tenancies": "Pub Tenancies",
          "legal": "Legal",
          "direct to trade": "Direct to Trade",
          "general": "General",
          "history": "History",
          "environment": "Environment",
          "about": "About",
          "brewery history": "Brewery History",
          "brewing process": "Brewing Process",
          "facilities": "Facilities",
        };

        // Page type normalization map
        const pageTypeMap: Record<string, string> = {
          "about": "About",
          "history": "History",
          "environment": "Environment",
          "careers": "Careers",
          "news": "News",
          "beers": "Beers",
          "brewery": "Brewery",
          "pubs & hotels estate": "Pubs & Hotels Estate",
        };

        // Domain normalization map
        const domainMap: Record<string, string> = {
          "corporate": "Corporate",
          "beer": "Beer",
          "pub": "Pub",
        };

        const rows = lines.slice(dataStartIndex).map((line, index) => {
          const values = line.split(",").map((v) => v.trim());
          const row: any = { row_number: index + 1 };
          
          headers.forEach((header, i) => {
            let value = values[i] || "";
            
            // Normalize domain values
            if (header === "domain" && value) {
              const normalizedKey = value.toLowerCase();
              value = domainMap[normalizedKey] || value;
            }
            
            // Normalize page_type values
            if (header === "page_type" && value) {
              const normalizedKey = value.toLowerCase();
              value = pageTypeMap[normalizedKey] || value;
            }
            
            // Normalize category values
            if (header === "category" && value) {
              const normalizedKey = value.toLowerCase();
              value = categoryMap[normalizedKey] || value;
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

  const handleStartRun = async () => {
    if (!csvFile) {
      toast.error("Please select a CSV file");
      return;
    }

    setUploading(true);
    setStartTime(Date.now());

    try {
      // Parse CSV
      const rows = await parseCsv(csvFile);
      
      if (rows.length === 0) {
        toast.error("CSV file is empty");
        return;
      }

      toast.info(`Parsed ${rows.length} rows from CSV`);

      const { data: { user } } = await supabase.auth.getUser();

      // Create run
      const { data: run, error: runError } = await supabase
        .from("wizmode_runs")
        .insert({
          label: batchLabel || `Batch ${new Date().toISOString()}`,
          total_rows: rows.length,
          status: "pending",
          created_by_user_id: user?.id,
        })
        .select()
        .single();

      if (runError) throw runError;

      // Create run items
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
      // Fetch the items back to get full records with IDs
      const { data: createdItems } = await supabase
        .from("wizmode_run_items")
        .select("*")
        .eq("run_id", run.id)
        .order("row_number");
      
      setRunItems(createdItems || []);
      toast.success(`WIZmode run created with ${rows.length} rows`);

      // Start processing in background
      await supabase.functions.invoke("wizmode-process", {
        body: { run_id: run.id },
      });

      toast.info("Processing started in background...");
    } catch (error: any) {
      console.error("Error starting run:", error);
      toast.error(error.message || "Failed to start run");
    } finally {
      setUploading(false);
    }
  };

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

    return {
      completed,
      total: currentRun.total_rows,
      estimatedMs,
      avgTimePerRow
    };
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
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

      // Get the runs to be deleted for audit log
      const { data: runsToDelete, error: fetchError } = await supabase
        .from("wizmode_runs")
        .select("id, label, total_rows")
        .eq("status", "completed")
        .lt("created_at", thirtyDaysAgo.toISOString());

      if (fetchError) throw fetchError;

      // Delete old completed runs (items will cascade delete automatically)
      const { error: deleteError } = await supabase
        .from("wizmode_runs")
        .delete()
        .eq("status", "completed")
        .lt("created_at", thirtyDaysAgo.toISOString());

      if (deleteError) throw deleteError;

      // Log the cleanup
      await supabase.from("audit_log").insert({
        user_id: user.id,
        entity_type: "wizmode_runs",
        action: "cleanup_old_runs",
        details: {
          runs_deleted: runsToDelete?.length || 0,
          cutoff_date: thirtyDaysAgo.toISOString(),
          deleted_runs: runsToDelete?.map(r => ({ id: r.id, label: r.label, total_rows: r.total_rows })),
        },
      });

      toast.success(`Cleaned up ${runsToDelete?.length || 0} old completed runs`);
      setCleanupDialogOpen(false);
      fetchPastRuns();
    } catch (error: any) {
      console.error("Error cleaning up old runs:", error);
      toast.error(error.message || "Failed to clean up old runs");
    } finally {
      setCleaningUp(false);
    }
  };

  const getInitialEstimate = () => {
    if (!estimatedRowCount) return null;
    // Rough estimate: ~10-15 seconds per row (fetch HTML + generate schema)
    const avgTimePerRow = 12000; // 12 seconds average
    const totalMs = estimatedRowCount * avgTimePerRow;
    return formatTime(totalMs);
  };

  const summary = getSummary();
  const progress = currentRun ? (runItems.filter((i) => i.result !== "pending").length / currentRun.total_rows) * 100 : 0;

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">WIZmode v1</h1>
          <p className="text-lg text-muted-foreground">
            Batch page creation and schema generation from CSV
          </p>
        </div>

        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Upload CSV Batch</CardTitle>
            <CardDescription>
              CSV format: domain, path, page_type, category (all required).
              Example: <code className="bg-muted px-1 py-0.5 rounded">Beer,/beers/double-stout,Beers,Drink Brands</code>
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
              onClick={handleStartRun}
              disabled={!csvFile || uploading}
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

        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Past Runs</CardTitle>
                <CardDescription>Recent WIZmode batch processing runs</CardDescription>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Total Rows</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-xs">
                      {new Date(run.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{run.label || "Unnamed"}</TableCell>
                    <TableCell>{run.total_rows}</TableCell>
                    <TableCell>
                      {run.status === "completed" && (
                        <Badge className="rounded-full bg-green-500">Completed</Badge>
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
                        className="rounded-full"
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Cleanup Dialog */}
        <AlertDialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Clean Up Old WIZmode Runs</AlertDialogTitle>
              <AlertDialogDescription>
                {oldRunsCount === 0 ? (
                  <p>No old completed runs found (older than 30 days).</p>
                ) : (
                  <div className="space-y-2">
                    <p>
                      This will permanently delete <strong>{oldRunsCount}</strong> completed run{oldRunsCount !== 1 ? 's' : ''} older than 30 days and all their associated items.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      This action cannot be undone. Pages created by these runs will NOT be deleted.
                    </p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cleaningUp}>Cancel</AlertDialogCancel>
              {oldRunsCount > 0 && (
                <AlertDialogAction
                  onClick={handleCleanup}
                  disabled={cleaningUp}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {cleaningUp ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cleaning up...
                    </>
                  ) : (
                    `Delete ${oldRunsCount} Run${oldRunsCount !== 1 ? 's' : ''}`
                  )}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
