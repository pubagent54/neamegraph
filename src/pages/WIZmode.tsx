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
import { Upload, PlayCircle, Loader2, CheckCircle2, XCircle, AlertCircle, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";

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
}

export default function WIZmode() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [batchLabel, setBatchLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [currentRun, setCurrentRun] = useState<WizmodeRun | null>(null);
  const [runItems, setRunItems] = useState<WizmodeRunItem[]>([]);
  const [pastRuns, setPastRuns] = useState<WizmodeRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

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
    if (currentRun && currentRun.status === "running") {
      const interval = setInterval(() => {
        fetchRunProgress(currentRun.id);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [currentRun]);

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
    }
  };

  const parseCsv = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split("\n").filter((line) => line.trim());
        
        if (lines.length < 2) {
          reject(new Error("CSV must have at least a header row and one data row"));
          return;
        }

        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        
        // Validate required columns
        const requiredColumns = ["domain", "path", "page_type", "category"];
        const missingColumns = requiredColumns.filter((col) => !headers.includes(col));
        
        if (missingColumns.length > 0) {
          reject(new Error(`Missing required columns: ${missingColumns.join(", ")}`));
          return;
        }

        const rows = lines.slice(1).map((line, index) => {
          const values = line.split(",").map((v) => v.trim());
          const row: any = { row_number: index + 1 };
          
          headers.forEach((header, i) => {
            row[header] = values[i] || "";
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
    const skipped = runItems.filter((i) => i.result === "skipped_duplicate").length;
    const errors = runItems.filter((i) => i.result === "error").length;
    const htmlSuccess = runItems.filter((i) => i.html_status === "success").length;
    const schemaSuccess = runItems.filter((i) => i.schema_status === "success").length;

    return { created, skipped, errors, htmlSuccess, schemaSuccess };
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
                Status: {currentRun.status} • {runItems.filter((i) => i.result !== "pending").length} of {currentRun.total_rows} rows processed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Progress value={progress} className="h-2" />

              {summary && (
                <div className="grid gap-4 md:grid-cols-5">
                  <Card className="rounded-xl">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{summary.created}</div>
                      <p className="text-xs text-muted-foreground">Pages Created</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{summary.skipped}</div>
                      <p className="text-xs text-muted-foreground">Skipped (Duplicates)</p>
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
                      <p className="text-xs text-muted-foreground">HTML Success</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{summary.schemaSuccess}</div>
                      <p className="text-xs text-muted-foreground">Schema Success</p>
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
            <CardTitle>Past Runs</CardTitle>
            <CardDescription>Recent WIZmode batch processing runs</CardDescription>
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
      </div>
    </Layout>
  );
}
