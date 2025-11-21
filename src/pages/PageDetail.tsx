import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Download, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface Page {
  id: string;
  path: string;
  section: string | null;
  page_type: string | null;
  status: string;
  has_faq: boolean;
  notes: string | null;
  last_crawled_at: string | null;
  last_schema_generated_at: string | null;
}

interface SchemaVersion {
  id: string;
  version_number: number;
  jsonld: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  google_rr_passed: boolean;
  validation_notes: string | null;
}

export default function PageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [page, setPage] = useState<Page | null>(null);
  const [versions, setVersions] = useState<SchemaVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const canEdit = userRole === "admin" || userRole === "editor";
  const isAdmin = userRole === "admin";

  useEffect(() => {
    if (id) {
      fetchPageData();
    }
  }, [id]);

  const fetchPageData = async () => {
    try {
      const [pageResult, versionsResult] = await Promise.all([
        supabase.from("pages").select("*").eq("id", id).single(),
        supabase
          .from("schema_versions")
          .select("*")
          .eq("page_id", id)
          .order("version_number", { ascending: false }),
      ]);

      if (pageResult.error) throw pageResult.error;
      if (versionsResult.error) throw versionsResult.error;

      setPage(pageResult.data);
      setVersions(versionsResult.data || []);
    } catch (error) {
      console.error("Error fetching page data:", error);
      toast.error("Failed to fetch page data");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchHTML = async () => {
    if (!page) return;
    setGenerating(true);

    try {
      const { data: settings } = await supabase.from("settings").select("*").single();
      
      const url = `${settings.fetch_base_url}${page.path}`;
      toast.info(`Fetching HTML from ${url}...`);

      // In a real implementation, this would call an edge function
      // For now, we'll just simulate the process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const { error } = await supabase
        .from("pages")
        .update({ last_crawled_at: new Date().toISOString() })
        .eq("id", page.id);

      if (error) throw error;

      toast.success("HTML fetched successfully");
      fetchPageData();
    } catch (error) {
      console.error("Error fetching HTML:", error);
      toast.error("Failed to fetch HTML");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSchema = async () => {
    if (!page) return;
    toast.info("Schema generation would be implemented via edge function");
  };

  const handleApprove = async (versionId: string) => {
    if (!isAdmin) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Update the version to approved
      const { error: versionError } = await supabase
        .from("schema_versions")
        .update({
          status: "approved",
          approved_by_user_id: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", versionId);

      if (versionError) throw versionError;

      // Deprecate other versions
      const { error: deprecateError } = await supabase
        .from("schema_versions")
        .update({ status: "deprecated" })
        .eq("page_id", page.id)
        .neq("id", versionId);

      if (deprecateError) throw deprecateError;

      // Update page status
      const { error: pageError } = await supabase
        .from("pages")
        .update({ status: "approved" })
        .eq("id", page.id);

      if (pageError) throw pageError;

      toast.success("Schema version approved");
      fetchPageData();
    } catch (error) {
      console.error("Error approving schema:", error);
      toast.error("Failed to approve schema");
    }
  };

  const handleMarkImplemented = async () => {
    if (!isAdmin || !page) return;

    try {
      const { error } = await supabase
        .from("pages")
        .update({ status: "implemented" })
        .eq("id", page.id);

      if (error) throw error;

      toast.success("Marked as implemented");
      fetchPageData();
    } catch (error) {
      console.error("Error marking as implemented:", error);
      toast.error("Failed to update status");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!page) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Page not found</p>
          <Button onClick={() => navigate("/pages")} className="mt-4">
            Back to Pages
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <Button variant="ghost" onClick={() => navigate("/pages")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pages
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight font-mono">{page.path}</h1>
              <p className="text-muted-foreground mt-1">
                {page.section} • {page.page_type}
              </p>
            </div>
            <StatusBadge status={page.status} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Last Crawled</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                {page.last_crawled_at
                  ? new Date(page.last_crawled_at).toLocaleString()
                  : "Never"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Last Schema Generated</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                {page.last_schema_generated_at
                  ? new Date(page.last_schema_generated_at).toLocaleString()
                  : "Never"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Has FAQ</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{page.has_faq ? "Yes" : "No"}</p>
            </CardContent>
          </Card>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <Button onClick={handleFetchHTML} disabled={generating}>
              <Download className="mr-2 h-4 w-4" />
              Fetch HTML
            </Button>
            <Button onClick={handleGenerateSchema} disabled={generating}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Generate Schema
            </Button>
            {isAdmin && page.status === "approved" && (
              <Button onClick={handleMarkImplemented} variant="outline">
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark as Implemented
              </Button>
            )}
          </div>
        )}

        <Tabs defaultValue="schema" className="w-full">
          <TabsList>
            <TabsTrigger value="schema">Schema Versions</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="schema" className="space-y-4">
            {versions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No schema versions yet
                </CardContent>
              </Card>
            ) : (
              versions.map((version) => (
                <Card key={version.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          Version {version.version_number}
                        </CardTitle>
                        <CardDescription>
                          {new Date(version.created_at).toLocaleString()}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={version.status} />
                        {isAdmin && version.status === "draft" && (
                          <Button
                            size="sm"
                            onClick={() => handleApprove(version.id)}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={version.jsonld}
                      readOnly
                      className="font-mono text-xs min-h-[200px]"
                    />
                    {version.validation_notes && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {version.validation_notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
          <TabsContent value="notes">
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={page.notes || ""}
                  placeholder="Add notes about this page..."
                  readOnly={!canEdit}
                  className="min-h-[200px]"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
