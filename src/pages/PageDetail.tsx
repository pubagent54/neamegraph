import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Download, RefreshCw, CheckCircle, XCircle, Save, ChevronDown, Copy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SchemaSummary } from "@/components/SchemaSummary";
import { SchemaStory } from "@/components/SchemaStory";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// ========================================
// DOMAIN LANE LOGIC
// ----------------------------------------
// 'Corporate' - Full schema generation using existing v2 Corporate engine
// 'Beer' - Shows beer metadata panel, Generate Schema shows stub message
// 'Pub' - Shows placeholder, Generate Schema button disabled
// ========================================
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
  domain: string; // 'Corporate', 'Beer', or 'Pub'
  beer_abv: number | null;
  beer_style: string | null;
  beer_launch_year: number | null;
  beer_official_url: string | null;
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
  const [isV2MetadataOpen, setIsV2MetadataOpen] = useState(false);
  const [usedRule, setUsedRule] = useState<{ name: string; page_type: string | null; category: string | null } | null>(null);
  
  // Domain state
  const [editableDomain, setEditableDomain] = useState<string>('Corporate');
  
  // Beer metadata state
  const [editableBeerAbv, setEditableBeerAbv] = useState<string>('');
  const [editableBeerStyle, setEditableBeerStyle] = useState<string>('');
  const [editableBeerLaunchYear, setEditableBeerLaunchYear] = useState<string>('');
  const [editableBeerOfficialUrl, setEditableBeerOfficialUrl] = useState<string>('');
  
  // Homepage manual schema editing
  const [isEditingHomepageSchema, setIsEditingHomepageSchema] = useState(false);
  const [editedHomepageSchema, setEditedHomepageSchema] = useState<string>('');

  const canEdit = userRole === "admin" || userRole === "editor";
  const isAdmin = userRole === "admin";

  const getV2MetadataSummary = () => {
    const parts: string[] = [];
    
    if (editablePageType) {
      parts.push(editablePageType);
    } else {
      parts.push("Page Type not set");
    }
    
    if (editablePageType) {
      if (editableCategory) {
        parts.push(editableCategory);
      } else {
        parts.push("Category not set");
      }
    }
    
    const faqModeLabel = FAQ_MODES.find(m => m.value === editableFaqMode)?.label || editableFaqMode;
    parts.push(`FAQ: ${faqModeLabel}`);
    
    return parts.join(" · ");
  };

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
      
      // Initialize domain state
      setEditableDomain(pageResult.data.domain || 'Corporate');
      
      // Initialize v2 metadata state
      setEditablePageType(pageResult.data.page_type);
      setEditableCategory(pageResult.data.category);
      setEditableLogoUrl(pageResult.data.logo_url || '');
      setEditableHeroImageUrl(pageResult.data.hero_image_url || '');
      setEditableFaqMode(pageResult.data.faq_mode || 'auto');
      setEditableIsHomePage(pageResult.data.is_home_page || false);
      
      // Initialize beer metadata state
      setEditableBeerAbv(pageResult.data.beer_abv?.toString() || '');
      setEditableBeerStyle(pageResult.data.beer_style || '');
      setEditableBeerLaunchYear(pageResult.data.beer_launch_year?.toString() || '');
      setEditableBeerOfficialUrl(pageResult.data.beer_official_url || '');
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
    
    // ========================================
    // HOMEPAGE PROTECTION - Block AI generation for homepage
    // ========================================
    if (page.is_home_page) {
      toast.info("Homepage schema is managed manually – NeameGraph Brain generation is disabled.");
      return;
    }
    
    // ========================================
    // DOMAIN LANE LOGIC - Handle different domains
    // ========================================
    
    // Pub lane: UI blocks this, shouldn't be called
    if (page.domain === 'Pub') {
      toast.error("Pub module is Phase 2 – not implemented yet");
      return;
    }
    
    // Beer lane: Show stub message, don't call edge function
    if (page.domain === 'Beer') {
      toast.info("Beer schema engine coming soon – no schema generated yet");
      return;
    }
    
    // Corporate lane: Validate required metadata before calling edge function
    if (page.domain === 'Corporate' && !page.page_type) {
      toast.error("Please set the Page Type in the Corporate v2 Metadata section before generating schema.");
      return;
    }
    
    // Corporate lane: Use existing v2 Corporate schema engine
    setGenerating(true);

    try {
      toast.info("NeameGraph Brain is generating schema...");

      const { data, error } = await supabase.functions.invoke("generate-schema", {
        body: { page_id: page.id },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      // Store the used rule info if provided
      if (data?.used_rule) {
        setUsedRule(data.used_rule);
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

  const handleSaveDomain = async () => {
    if (!page || !canEdit) return;
    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('pages')
        .update({
          domain: editableDomain,
          last_modified_by_user_id: user?.id,
        })
        .eq('id', page.id);

      if (error) throw error;

      toast.success('Domain updated successfully');
      await fetchPageData();
    } catch (error) {
      console.error('Error saving domain:', error);
      toast.error('Failed to save domain');
    } finally {
      setIsSaving(false);
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

  const handleSaveBeerMetadata = async () => {
    if (!page || !canEdit) return;
    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('pages')
        .update({
          beer_abv: editableBeerAbv ? parseFloat(editableBeerAbv) : null,
          beer_style: editableBeerStyle || null,
          beer_launch_year: editableBeerLaunchYear ? parseInt(editableBeerLaunchYear) : null,
          beer_official_url: editableBeerOfficialUrl || null,
          last_modified_by_user_id: user?.id,
        })
        .eq('id', page.id);

      if (error) throw error;

      toast.success('Beer metadata saved successfully');
      await fetchPageData();
    } catch (error) {
      console.error('Error saving beer metadata:', error);
      toast.error('Failed to save beer metadata');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveHomepageSchema = async (versionId: string) => {
    if (!isAdmin || !page || !page.is_home_page) return;
    
    setIsSaving(true);
    try {
      // Validate JSON
      JSON.parse(editedHomepageSchema);
      
      const { data: { user } } = await supabase.auth.getUser();

      // Update the existing schema version
      const { error } = await supabase
        .from('schema_versions')
        .update({
          jsonld: editedHomepageSchema,
        })
        .eq('id', versionId);

      if (error) throw error;

      // Audit log
      await supabase.from("audit_log").insert({
        user_id: user?.id,
        entity_type: "schema_version",
        entity_id: versionId,
        action: "update",
        details: {
          page_id: page.id,
          page_path: page.path,
          note: "Manual homepage schema edit",
        },
      });

      toast.success('Homepage schema saved successfully');
      setIsEditingHomepageSchema(false);
      await fetchPageData();
    } catch (error: any) {
      console.error('Error saving homepage schema:', error);
      if (error.message?.includes('JSON')) {
        toast.error('Invalid JSON format');
      } else {
        toast.error('Failed to save homepage schema');
      }
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
          <div className="space-y-2">
            <div className="flex gap-3">
              <Button onClick={handleFetchHTML} disabled={generating} className="rounded-full">
                <Download className="mr-2 h-4 w-4" />
                Fetch HTML
              </Button>
              <Button 
                onClick={handleGenerateSchema} 
                disabled={generating || !page.last_html_hash || page.domain === 'Pub'}
                className="rounded-full"
                title={
                  page.domain === 'Pub' ? "Pub module is Phase 2 – not implemented yet" :
                  page.domain === 'Beer' ? "Beer schema engine coming soon" :
                  !page.last_html_hash ? "Fetch HTML first" :
                  "Generate schema"
                }
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
            {page.domain === 'Pub' && (
              <p className="text-xs text-muted-foreground">
                Pub module is Phase 2 – not implemented yet
              </p>
            )}
            {page.domain === 'Beer' && (
              <p className="text-xs text-muted-foreground">
                Beer schema engine coming soon – no schema generated yet
              </p>
            )}
            {usedRule && page.domain === 'Corporate' && (
              <p className="text-xs text-muted-foreground">
                Using rules: <span className="font-medium">{usedRule.name}</span>
                {usedRule.page_type && (
                  <span className="ml-1">
                    ({usedRule.page_type}
                    {usedRule.category && ` · ${usedRule.category}`})
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Domain Selector - Prominent, always visible */}
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Page Domain</CardTitle>
            <CardDescription>
              Select the domain lane for this page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Select
                value={editableDomain}
                onValueChange={(value) => {
                  // Block domain change for homepage
                  if (page.is_home_page && value !== 'Corporate') {
                    toast.error("Homepage must stay in the Corporate domain.");
                    return;
                  }
                  setEditableDomain(value);
                }}
                disabled={!canEdit || page.is_home_page}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Corporate">Corporate</SelectItem>
                  <SelectItem value="Beer">Beer</SelectItem>
                  <SelectItem value="Pub">Pub</SelectItem>
                </SelectContent>
              </Select>
              {canEdit && editableDomain !== page.domain && (
                <Button 
                  onClick={handleSaveDomain} 
                  disabled={isSaving}
                  size="sm"
                  className="rounded-full"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Domain"}
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {editableDomain === 'Corporate' && "Uses existing v2 Corporate schema engine"}
              {editableDomain === 'Beer' && "Beer schema engine coming soon"}
              {editableDomain === 'Pub' && "Pub module is Phase 2 – not implemented yet"}
            </p>
          </CardContent>
        </Card>

        {/* Corporate v2 Metadata Section - only show for Corporate domain */}
        {page.domain === 'Corporate' && (
          <Collapsible
            open={isV2MetadataOpen}
            onOpenChange={setIsV2MetadataOpen}
            className="rounded-2xl"
          >
          <Card className="rounded-2xl border-0 shadow-sm">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      Corporate v2 Metadata
                      <ChevronDown 
                        className={`h-4 w-4 transition-transform duration-200 ${
                          isV2MetadataOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </CardTitle>
                    <CardDescription>
                      {isV2MetadataOpen 
                        ? "These fields are used by the v2 Corporate schema engine."
                        : getV2MetadataSummary()
                      }
                    </CardDescription>
                  </div>
                  {!isV2MetadataOpen && canEdit && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="ml-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsV2MetadataOpen(true);
                      }}
                    >
                      Edit metadata
                    </Button>
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="space-y-6 pt-0">
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
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category - conditional based on Page Type */}
                  {editablePageType && editablePageType !== 'Site Home Page' && (
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
                            <SelectItem key={cat} value={cat}>
                              {cat}
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

                  {/* Is Home Page Toggle */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="isHomePage">Is Home Page</Label>
                      <Switch
                        id="isHomePage"
                        checked={editableIsHomePage}
                        onCheckedChange={setEditableIsHomePage}
                        disabled={!canEdit}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Mark this page as the site homepage
                    </p>
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
                  {editableLogoUrl ? (
                    <div className="mt-2 h-24 w-32 rounded-lg border bg-muted/40 overflow-hidden flex items-center justify-center">
                      <img
                        src={editableLogoUrl}
                        alt="Logo preview"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.preview-text')) {
                            const text = document.createElement('span');
                            text.className = 'preview-text text-xs text-muted-foreground';
                            text.textContent = 'No preview';
                            parent.appendChild(text);
                          }
                        }}
                      />
                    </div>
                  ) : null}
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
                  {editableHeroImageUrl ? (
                    <div className="mt-2 h-24 w-32 rounded-lg border bg-muted/40 overflow-hidden flex items-center justify-center">
                      <img
                        src={editableHeroImageUrl}
                        alt="Hero image preview"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.preview-text')) {
                            const text = document.createElement('span');
                            text.className = 'preview-text text-xs text-muted-foreground';
                            text.textContent = 'No preview';
                          }
                        }}
                      />
                    </div>
                  ) : null}
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
            </CollapsibleContent>
          </Card>
        </Collapsible>
        )}

        {/* Beer Metadata Section - only show for Beer domain */}
        {page.domain === 'Beer' && (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Beer Metadata</CardTitle>
              <CardDescription>
                These fields will be used by the Beer schema engine (coming soon)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="beerAbv">ABV (%)</Label>
                  <Input
                    id="beerAbv"
                    type="number"
                    step="0.1"
                    placeholder="4.5"
                    value={editableBeerAbv}
                    onChange={(e) => setEditableBeerAbv(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="beerStyle">Style</Label>
                  <Input
                    id="beerStyle"
                    type="text"
                    placeholder="IPA, Lager, Pale Ale..."
                    value={editableBeerStyle}
                    onChange={(e) => setEditableBeerStyle(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="beerLaunchYear">Launch Year</Label>
                  <Input
                    id="beerLaunchYear"
                    type="number"
                    placeholder="2020"
                    value={editableBeerLaunchYear}
                    onChange={(e) => setEditableBeerLaunchYear(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="beerOfficialUrl">Official Beer URL</Label>
                  <Input
                    id="beerOfficialUrl"
                    type="text"
                    placeholder="https://..."
                    value={editableBeerOfficialUrl}
                    onChange={(e) => setEditableBeerOfficialUrl(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
              </div>
              {canEdit && (
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSaveBeerMetadata}
                    disabled={isSaving}
                    className="rounded-full"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Beer Metadata'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pub Placeholder - only show for Pub domain */}
        {page.domain === 'Pub' && (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Pub Module</CardTitle>
              <CardDescription>
                Phase 2 – not implemented yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                The Pub module will be added in a future release. This will include schema generation for individual pub and hotel pages.
              </p>
            </CardContent>
          </Card>
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
                          pageType={page.page_type}
                          category={page.category}
                        />
                      </TabsContent>
                      <TabsContent value="json" className="mt-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            {/* Homepage manual editing for admins only */}
                            {page.is_home_page && isAdmin && !isEditingHomepageSchema && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditedHomepageSchema(version.jsonld);
                                  setIsEditingHomepageSchema(true);
                                }}
                              >
                                Edit homepage schema
                              </Button>
                            )}
                            {page.is_home_page && isAdmin && isEditingHomepageSchema && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveHomepageSchema(version.id)}
                                  disabled={isSaving}
                                >
                                  <Save className="mr-2 h-4 w-4" />
                                  {isSaving ? 'Saving...' : 'Save'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setIsEditingHomepageSchema(false);
                                    setEditedHomepageSchema('');
                                  }}
                                  disabled={isSaving}
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                            {(!page.is_home_page || !isEditingHomepageSchema) && (
                              <div className="flex-1" />
                            )}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const textToCopy = isEditingHomepageSchema ? editedHomepageSchema : version.jsonld;
                                  navigator.clipboard.writeText(textToCopy);
                                  toast.success("Raw JSON copied to clipboard");
                                }}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy JSON
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const rawJson = isEditingHomepageSchema ? editedHomepageSchema : version.jsonld;
                                  const wrappedForDrupal = `<script type="application/ld+json">\n${rawJson}\n</script>`;
                                  navigator.clipboard.writeText(wrappedForDrupal);
                                  toast.success("Schema copied for Drupal (with script tag wrapper)");
                                }}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy for Drupal
                              </Button>
                            </div>
                          </div>
                          
                          {/* Read-only textarea for non-homepage or non-admin */}
                          {(!page.is_home_page || !isAdmin || !isEditingHomepageSchema) && (
                            <textarea
                              readOnly
                              value={version.jsonld}
                              className="w-full rounded-lg border border-border bg-muted p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              style={{ 
                                minHeight: '400px',
                                maxHeight: '600px',
                                overflow: 'auto',
                                whiteSpace: 'pre',
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                              }}
                              onClick={(e) => {
                                e.currentTarget.focus();
                              }}
                              onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
                                  e.preventDefault();
                                  e.currentTarget.select();
                                }
                              }}
                            />
                          )}
                          
                          {/* Editable textarea for homepage admin editing */}
                          {page.is_home_page && isAdmin && isEditingHomepageSchema && (
                            <textarea
                              value={editedHomepageSchema}
                              onChange={(e) => setEditedHomepageSchema(e.target.value)}
                              className="w-full rounded-lg border border-border bg-background p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              style={{ 
                                minHeight: '400px',
                                maxHeight: '600px',
                                overflow: 'auto',
                                whiteSpace: 'pre',
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                              }}
                            />
                          )}
                          
                          {page.is_home_page && !isAdmin && (
                            <p className="text-xs text-muted-foreground">
                              Homepage schema is managed manually by admins only.
                            </p>
                          )}
                        </div>
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
