import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Download, RefreshCw, CheckCircle, XCircle, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SchemaSummary } from "@/components/SchemaSummary";
import { SchemaStory } from "@/components/SchemaStory";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

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
  last_html_hash: string | null;
  category: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  faq_mode: string;
  is_home_page: boolean;
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

const V2_PAGE_TYPES = [
  { value: 'EstatePage', label: 'Estate Page' },
  { value: 'GovernancePage', label: 'Governance Page' },
  { value: 'CommunityPage', label: 'Community Page' },
  { value: 'SiteHomePage', label: 'Site Home Page' },
];

const V2_CATEGORIES: Record<string, { value: string; label: string }[]> = {
  EstatePage: [
    { value: 'Overview', label: 'Overview' },
    { value: 'Collections', label: 'Collections' },
    { value: 'EthosAndSuppliers', label: 'Ethos and Suppliers' },
  ],
  GovernancePage: [
    { value: 'About', label: 'About' },
    { value: 'Legal', label: 'Legal' },
    { value: 'TradeAndSupply', label: 'Trade and Supply' },
  ],
  CommunityPage: [
    { value: 'ShepsGiving', label: 'Sheps Giving' },
    { value: 'CharityAndDonations', label: 'Charity and Donations' },
    { value: 'ArtsAndCulture', label: 'Arts and Culture' },
    { value: 'CommunityOverview', label: 'Community Overview' },
  ],
};

const FAQ_MODES = [
  { value: 'auto', label: 'Auto' },
  { value: 'ignore', label: 'Ignore' },
];

export default function PageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [page, setPage] = useState<Page | null>(null);
  const [versions, setVersions] = useState<SchemaVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editablePageType, setEditablePageType] = useState<string | null>(null);
  const [editableCategory, setEditableCategory] = useState<string | null>(null);
  const [editableLogoUrl, setEditableLogoUrl] = useState<string>('');
  const [editableHeroImageUrl, setEditableHeroImageUrl] = useState<string>('');
  const [editableFaqMode, setEditableFaqMode] = useState<string>('auto');
  const [editableIsHomePage, setEditableIsHomePage] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);

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
      
      // Initialize v2 metadata state
      setEditablePageType(pageResult.data.page_type);
      setEditableCategory(pageResult.data.category);
      setEditableLogoUrl(pageResult.data.logo_url || '');
      setEditableHeroImageUrl(pageResult.data.hero_image_url || '');
      setEditableFaqMode(pageResult.data.faq_mode || 'auto');
      setEditableIsHomePage(pageResult.data.is_home_page || false);
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

      const { data, error } = await supabase.functions.invoke("fetch-html", {
        body: { page_id: page.id },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.html_changed) {
        toast.success(`HTML fetched successfully (${data.html_length} bytes, content changed)`);
      } else {
        toast.success(`HTML fetched successfully (${data.html_length} bytes, no changes)`);
      }
      
      fetchPageData();
    } catch (error: any) {
      console.error("Error fetching HTML:", error);
      toast.error(error.message || "Failed to fetch HTML");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSchema = async () => {
    if (!page) return;
    setGenerating(true);

    try {
      toast.info("Generating schema with AI...");

      const { data, error } = await supabase.functions.invoke("generate-schema", {
        body: { page_id: page.id },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(`Schema v${data.version_number} generated successfully`);
      fetchPageData();
    } catch (error: any) {
      console.error("Error generating schema:", error);
      toast.error(error.message || "Failed to generate schema");
    } finally {
      setGenerating(false);
    }
  };

  const handleReject = async (versionId: string) => {
    if (!canEdit) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Update the version to rejected
      const { error: versionError } = await supabase
        .from("schema_versions")
        .update({
          status: "rejected",
        })
        .eq("id", versionId);

      if (versionError) throw versionError;

      // Update page status
      const { error: pageError } = await supabase
        .from("pages")
        .update({ 
          status: "needs_rework",
          last_modified_by_user_id: user?.id,
        })
        .eq("id", page.id);

      if (pageError) throw pageError;

      // Audit log
      await supabase.from("audit_log").insert({
        user_id: user?.id,
        entity_type: "schema_version",
        entity_id: versionId,
        action: "reject_schema",
        details: {
          page_id: page.id,
          page_path: page.path,
        },
      });

      toast.success("Schema version rejected");
      fetchPageData();
    } catch (error) {
      console.error("Error rejecting schema:", error);
      toast.error("Failed to reject schema");
    }
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
        .update({ 
          status: "approved",
          last_modified_by_user_id: user?.id,
        })
        .eq("id", page.id);

      if (pageError) throw pageError;

      // Audit log
      await supabase.from("audit_log").insert({
        user_id: user?.id,
        entity_type: "schema_version",
        entity_id: versionId,
        action: "approve_schema",
        details: {
          page_id: page.id,
          page_path: page.path,
        },
      });

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

  const handleSaveV2Metadata = async () => {
    if (!page || !canEdit) return;
    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('pages')
        .update({
          page_type: editablePageType,
          category: editableCategory,
          logo_url: editableLogoUrl || null,
          hero_image_url: editableHeroImageUrl || null,
          faq_mode: editableFaqMode,
          is_home_page: editableIsHomePage,
          last_modified_by_user_id: user?.id,
        })
        .eq('id', page.id);

      if (error) throw error;

      toast.success('Corporate v2 metadata saved successfully');
      await fetchPageData();
    } catch (error) {
      console.error('Error saving v2 metadata:', error);
      toast.error('Failed to save v2 metadata');
    } finally {
      setIsSaving(false);
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
      <div className="space-y-8">
        <div>
          <Button variant="ghost" onClick={() => navigate("/pages")} className="mb-4 rounded-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pages
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight font-mono mb-2">{page.path}</h1>
              <p className="text-lg text-muted-foreground">
                {page.section} • {page.page_type}
                {page.category && ` • ${page.category}`}
                {page.is_home_page && " • Home Page"}
              </p>
            </div>
            <StatusBadge status={page.status} />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-card to-muted/30">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Last Crawled</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {page.last_crawled_at
                  ? new Date(page.last_crawled_at).toLocaleDateString()
                  : "Never"}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-card to-muted/30">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Last Schema Generated</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {page.last_schema_generated_at
                  ? new Date(page.last_schema_generated_at).toLocaleDateString()
                  : "Never"}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-card to-muted/30">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">FAQ Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold capitalize">
                {page.faq_mode || "auto"}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-card to-muted/30">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">HTML Hash</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs font-mono">
                {page.last_html_hash
                  ? `${page.last_html_hash.substring(0, 16)}...`
                  : "Not crawled"}
              </p>
            </CardContent>
          </Card>
        </div>

        {(page.logo_url || page.hero_image_url) && (
          <div className="grid gap-6 md:grid-cols-2">
            {page.logo_url && (
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Logo</CardTitle>
                </CardHeader>
                <CardContent>
                  <img src={page.logo_url} alt="Logo" className="max-w-[200px] max-h-[100px] object-contain" />
                </CardContent>
              </Card>
            )}
            {page.hero_image_url && (
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Hero Image</CardTitle>
                </CardHeader>
                <CardContent>
                  <img src={page.hero_image_url} alt="Hero" className="w-full max-h-[200px] object-cover rounded-lg" />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {canEdit && (
          <div className="flex gap-3">
            <Button onClick={handleFetchHTML} disabled={generating} className="rounded-full">

              <Download className="mr-2 h-4 w-4" />
              Fetch HTML
            </Button>
            <Button 
              onClick={handleGenerateSchema} 
              disabled={generating || !page.last_html_hash}
              className="rounded-full"
            >
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

        {/* Corporate v2 Metadata Section */}
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Corporate v2 Metadata (Optional)</CardTitle>
            <CardDescription>
              These fields are used by the v2 Corporate schema engine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Page Type */}
              <div className="space-y-2">
                <Label htmlFor="pageType">Page Type</Label>
                <Select
                  value={editablePageType || ''}
                  onValueChange={setEditablePageType}
                  disabled={!canEdit}
                >
                  <SelectTrigger id="pageType">
                    <SelectValue placeholder="Select page type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {V2_PAGE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category - conditional based on Page Type */}
              {editablePageType && editablePageType !== 'SiteHomePage' && (
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={editableCategory || ''}
                    onValueChange={setEditableCategory}
                    disabled={!canEdit}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(V2_CATEGORIES[editablePageType] || []).map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* FAQ Mode */}
              <div className="space-y-2">
                <Label htmlFor="faqMode">FAQ Mode</Label>
                <Select
                  value={editableFaqMode}
                  onValueChange={setEditableFaqMode}
                  disabled={!canEdit}
                >
                  <SelectTrigger id="faqMode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FAQ_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Is Home Page Checkbox */}
              <div className="flex items-center space-x-2 pt-8">
                <Checkbox
                  id="isHomePage"
                  checked={editableIsHomePage}
                  onCheckedChange={(checked) => setEditableIsHomePage(checked === true)}
                  disabled={!canEdit}
                />
                <Label
                  htmlFor="isHomePage"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Is Home Page
                </Label>
              </div>
            </div>

            {/* Logo URL with Preview */}
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                type="text"
                placeholder="https://example.com/logo.png"
                value={editableLogoUrl}
                onChange={(e) => setEditableLogoUrl(e.target.value)}
                disabled={!canEdit}
              />
              {editableLogoUrl && (
                <div className="mt-2 p-4 border rounded-lg bg-muted/30">
                  <img
                    src={editableLogoUrl}
                    alt="Logo preview"
                    className="max-w-[200px] max-h-[100px] object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Hero Image URL with Preview */}
            <div className="space-y-2">
              <Label htmlFor="heroImageUrl">Hero Image URL</Label>
              <Input
                id="heroImageUrl"
                type="text"
                placeholder="https://example.com/hero.jpg"
                value={editableHeroImageUrl}
                onChange={(e) => setEditableHeroImageUrl(e.target.value)}
                disabled={!canEdit}
              />
              {editableHeroImageUrl && (
                <div className="mt-2 p-4 border rounded-lg bg-muted/30">
                  <img
                    src={editableHeroImageUrl}
                    alt="Hero image preview"
                    className="w-full max-h-[200px] object-cover rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Save Button */}
            {canEdit && (
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveV2Metadata}
                  disabled={isSaving}
                  className="rounded-full"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save v2 Metadata'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

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
                        {canEdit && version.status === "draft" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(version.id)}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(version.id)}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="summary" className="w-full">
                      <TabsList>
                        <TabsTrigger value="summary">Summary</TabsTrigger>
                        <TabsTrigger value="story">The story we're telling</TabsTrigger>
                        <TabsTrigger value="json">JSON</TabsTrigger>
                      </TabsList>
                      <TabsContent value="summary" className="mt-4">
                        <SchemaSummary 
                          jsonld={version.jsonld}
                          section={page.section}
                          createdAt={version.created_at}
                          status={version.status}
                        />
                      </TabsContent>
                      <TabsContent value="story" className="mt-4">
                        <SchemaStory 
                          jsonld={version.jsonld}
                          section={page.section}
                          path={page.path}
                        />
                      </TabsContent>
                      <TabsContent value="json" className="mt-4">
                        <Textarea
                          value={version.jsonld}
                          readOnly
                          className="font-mono text-xs min-h-[200px]"
                        />
                      </TabsContent>
                    </Tabs>
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
