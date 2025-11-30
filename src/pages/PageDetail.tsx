/**
 * Page Detail Screen - Tabbed Redesign
 * 
 * Clean, modern tabbed layout with three main sections:
 * 1. Story & checks - Human-readable narrative and validation
 * 2. Schema - Version history and JSON
 * 3. Metadata & settings - All configuration and domain-specific fields
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { validateJsonLdSchema, formatValidationIssue } from "@/lib/schema-validator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StoryAndChecksTab } from "@/components/page-detail/StoryAndChecksTab";
import { SchemaTab } from "@/components/page-detail/SchemaTab";
import { MetadataTab } from "@/components/page-detail/MetadataTab";

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
  domain: string;
  beer_abv: number | null;
  beer_style: string | null;
  beer_launch_year: number | null;
  beer_official_url: string | null;
  wikidata_candidate: boolean;
  wikidata_status: string;
  wikidata_qid: string | null;
  wikidata_label: string | null;
  wikidata_description: string | null;
  wikidata_language: string | null;
  wikidata_intro_year: number | null;
  wikidata_abv: number | null;
  wikidata_style: string | null;
  wikidata_official_website: string | null;
  wikidata_image_url: string | null;
  wikidata_notes: string | null;
  wikidata_verified_at: string | null;
  wikidata_last_exported_at: string | null;
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
  const [usedRule, setUsedRule] = useState<{ name: string; page_type: string | null; category: string | null } | null>(null);
  
  const [editableDomain, setEditableDomain] = useState<string>('Corporate');
  const [editableBeerAbv, setEditableBeerAbv] = useState<string>('');
  const [editableBeerStyle, setEditableBeerStyle] = useState<string>('');
  const [editableBeerLaunchYear, setEditableBeerLaunchYear] = useState<string>('');
  const [editableBeerOfficialUrl, setEditableBeerOfficialUrl] = useState<string>('');
  
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [liveCharterWarnings, setLiveCharterWarnings] = useState<string[] | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validatingVersionId, setValidatingVersionId] = useState<string | null>(null);

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
      
      setEditableDomain(pageResult.data.domain || 'Corporate');
      setEditablePageType(pageResult.data.page_type);
      setEditableCategory(pageResult.data.category);
      setEditableLogoUrl(pageResult.data.logo_url || '');
      setEditableHeroImageUrl(pageResult.data.hero_image_url || '');
      setEditableFaqMode(pageResult.data.faq_mode || 'auto');
      setEditableIsHomePage(pageResult.data.is_home_page || false);
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
      if (data?.error) throw new Error(data.error);

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
    
    if (page.is_home_page) {
      toast.info("Homepage schema is managed manually – NeameGraph Brain generation is disabled.");
      return;
    }
    
    if (page.domain === 'Pub') {
      toast.error("Pub module is Phase 2 – not implemented yet");
      return;
    }
    
    if (!page.page_type) {
      const domainLabel = page.domain === 'Beer' ? 'Beer Metadata' : 'Corporate v2 Metadata';
      toast.error(`Please set the Page Type in the ${domainLabel} section before generating schema.`);
      return;
    }
    
    setGenerating(true);

    try {
      toast.info("NeameGraph Brain is generating schema...");

      const { data, error } = await supabase.functions.invoke("generate-schema", {
        body: { page_id: page.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.used_rule) {
        setUsedRule(data.used_rule);
      }

      if (data?.charterWarnings) {
        setLiveCharterWarnings(data.charterWarnings);
      } else {
        setLiveCharterWarnings([]);
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
    if (!canEdit || !page) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error: versionError } = await supabase
        .from("schema_versions")
        .update({ status: "rejected" })
        .eq("id", versionId);

      if (versionError) throw versionError;

      const { error: pageError } = await supabase
        .from("pages")
        .update({ 
          status: "needs_rework",
          last_modified_by_user_id: user?.id,
        })
        .eq("id", page.id);

      if (pageError) throw pageError;

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

  const handleValidateSchema = (versionId: string, jsonld: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return;

    const canonicalUrl = page ? `https://www.shepherdneame.co.uk${page.path}` : undefined;
    const result = validateJsonLdSchema(jsonld, canonicalUrl);
    setValidationResult(result);
    setValidatingVersionId(versionId);
    setValidationDialogOpen(true);

    const errorCount = result.issues.filter((i: any) => i.severity === 'error').length;
    const warningCount = result.issues.filter((i: any) => i.severity === 'warning').length;
    
    if (errorCount > 0) {
      toast.error(`Validation failed: ${errorCount} error${errorCount > 1 ? 's' : ''} found`);
    } else if (warningCount > 0) {
      toast.warning(`Validation passed with ${warningCount} warning${warningCount > 1 ? 's' : ''}`);
    } else {
      toast.success('Schema validation passed ✓');
    }
  };

  const handleApproveWithValidation = async (versionId: string) => {
    if (!isAdmin || !page) return;

    const version = versions.find(v => v.id === versionId);
    if (!version) return;

    const canonicalUrl = page ? `https://www.shepherdneame.co.uk${page.path}` : undefined;
    const result = validateJsonLdSchema(version.jsonld, canonicalUrl);
    
    const errorCount = result.issues.filter((i: any) => i.severity === 'error').length;
    
    if (errorCount > 0) {
      setValidationResult(result);
      setValidatingVersionId(versionId);
      setValidationDialogOpen(true);
      toast.error('Schema has validation errors. Review issues before approving.');
      return;
    }

    await handleApprove(versionId);
  };

  const handleApprove = async (versionId: string) => {
    if (!isAdmin || !page) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error: versionError } = await supabase
        .from("schema_versions")
        .update({
          status: "approved",
          approved_by_user_id: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", versionId);

      if (versionError) throw versionError;

      const { error: deprecateError } = await supabase
        .from("schema_versions")
        .update({ status: "deprecated" })
        .eq("page_id", page.id)
        .neq("id", versionId);

      if (deprecateError) throw deprecateError;

      const { error: pageError } = await supabase
        .from("pages")
        .update({ 
          status: "approved",
          last_modified_by_user_id: user?.id,
        })
        .eq("id", page.id);

      if (pageError) throw pageError;

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

  const handleSaveWikidata = async (wikidataData: any) => {
    if (!page || !canEdit) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('pages')
        .update({
          wikidata_candidate: wikidataData.wikidata_candidate,
          wikidata_status: wikidataData.wikidata_status,
          wikidata_qid: wikidataData.wikidata_qid || null,
          wikidata_label: wikidataData.wikidata_label,
          wikidata_description: wikidataData.wikidata_description,
          wikidata_language: wikidataData.wikidata_language,
          wikidata_intro_year: wikidataData.wikidata_intro_year,
          wikidata_abv: wikidataData.wikidata_abv,
          wikidata_style: wikidataData.wikidata_style || null,
          wikidata_official_website: wikidataData.wikidata_official_website || null,
          wikidata_image_url: wikidataData.wikidata_image_url || null,
          wikidata_notes: wikidataData.wikidata_notes || null,
          wikidata_verified_at: wikidataData.wikidata_status === 'checked' || wikidataData.wikidata_status === 'ready_for_wikidata' 
            ? new Date().toISOString() 
            : page.wikidata_verified_at,
          last_modified_by_user_id: user?.id,
        })
        .eq('id', page.id);

      if (error) throw error;

      toast.success('Wikidata fields saved successfully');
      await fetchPageData();
    } catch (error) {
      console.error('Error saving wikidata fields:', error);
      toast.error('Failed to save wikidata fields');
    }
  };

  const handleSaveHomepageSchema = async (versionId: string, schema: string) => {
    if (!isAdmin || !page || !page.is_home_page) return;
    
    try {
      JSON.parse(schema);
      
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('schema_versions')
        .update({ jsonld: schema })
        .eq('id', versionId);

      if (error) throw error;

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
      await fetchPageData();
    } catch (error: any) {
      console.error('Error saving homepage schema:', error);
      if (error.message?.includes('JSON')) {
        toast.error('Invalid JSON format');
      } else {
        toast.error('Failed to save homepage schema');
      }
    }
  };

  const handleSaveNotes = async (notes: string) => {
    if (!page || !canEdit) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('pages')
        .update({
          notes: notes || null,
          last_modified_by_user_id: user?.id,
        })
        .eq('id', page.id);

      if (error) throw error;

      toast.success('Notes saved successfully');
      await fetchPageData();
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save notes');
    }
  };

  const handleCopyForDrupal = (jsonld: string) => {
    const scriptTag = `<script type="application/ld+json">\n${JSON.stringify(JSON.parse(jsonld), null, 2)}\n</script>`;
    navigator.clipboard.writeText(scriptTag);
    toast.success("Schema wrapped in script tags and copied to clipboard");
  };

  const handleDomainChange = (value: string) => {
    if (page?.is_home_page && value !== 'Corporate') {
      toast.error("Homepage must stay in the Corporate domain.");
      return;
    }
    setEditableDomain(value);
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

  const latestVersion = versions.length > 0 ? versions[0] : null;

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* Header bar */}
        <div>
          <Button variant="ghost" onClick={() => navigate("/pages")} className="mb-4 rounded-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pages
          </Button>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold tracking-tight font-mono mb-3">{page.path}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={page.status} />
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                  {page.domain}
                </span>
                {page.page_type && (
                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs">
                    {page.page_type}
                  </span>
                )}
                {page.category && (
                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
                    {page.category}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action strip with stats and buttons */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-lg">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Last Crawled</p>
                <p className="text-base font-semibold">
                  {page.last_crawled_at
                    ? new Date(page.last_crawled_at).toLocaleDateString()
                    : "Never"}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-lg">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Last Schema Generated</p>
                <p className="text-base font-semibold">
                  {page.last_schema_generated_at
                    ? new Date(page.last_schema_generated_at).toLocaleDateString()
                    : "Never"}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-lg">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">FAQ Mode</p>
                <p className="text-base font-semibold capitalize">
                  {page.faq_mode || "auto"}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-lg">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">HTML Hash</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-xs font-mono cursor-help">
                        {page.last_html_hash
                          ? `${page.last_html_hash.substring(0, 16)}...`
                          : "Not crawled"}
                      </p>
                    </TooltipTrigger>
                    {page.last_html_hash && (
                      <TooltipContent>
                        <p className="font-mono text-xs">{page.last_html_hash}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </CardContent>
            </Card>
          </div>

          {canEdit && (
            <div className="space-y-2">
              <div className="flex gap-3">
                <Button onClick={handleFetchHTML} disabled={generating} className="rounded-full">
                  <Download className="mr-2 h-4 w-4" />
                  Fetch HTML
                </Button>
                <Button 
                  onClick={handleGenerateSchema} 
                  disabled={generating || !page.last_html_hash || page.domain === 'Pub' || page.is_home_page}
                  className="rounded-full"
                  title={
                    page.is_home_page ? "Homepage schema is managed manually" :
                    page.domain === 'Pub' ? "Pub module is Phase 2" :
                    !page.last_html_hash ? "Fetch HTML first" :
                    "Generate schema"
                  }
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Generate Schema
                </Button>
              </div>
              {page.domain === 'Pub' && (
                <p className="text-xs text-muted-foreground">
                  Pub module is Phase 2 – not implemented yet
                </p>
              )}
              {page.is_home_page && (
                <p className="text-xs text-muted-foreground">
                  Homepage schema is managed manually
                </p>
              )}
              {usedRule && (page.domain === 'Corporate' || page.domain === 'Beer') && (
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
        </div>

        {/* Main tabbed content */}
        <Tabs defaultValue="story" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="story">Story & checks</TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
            <TabsTrigger value="metadata">Metadata & settings</TabsTrigger>
          </TabsList>

          <TabsContent value="story">
            <StoryAndChecksTab
              latestVersion={latestVersion}
              page={page}
              canEdit={canEdit}
              isAdmin={isAdmin}
              liveCharterWarnings={liveCharterWarnings}
              onValidate={handleValidateSchema}
              onApprove={handleApproveWithValidation}
              onReject={handleReject}
            />
          </TabsContent>

          <TabsContent value="schema">
            <SchemaTab
              versions={versions}
              page={page}
              notes={page.notes}
              canEdit={canEdit}
              isAdmin={isAdmin}
              isHomepage={page.is_home_page}
              onValidate={handleValidateSchema}
              onApprove={handleApproveWithValidation}
              onReject={handleReject}
              onCopyForDrupal={handleCopyForDrupal}
              onSaveHomepageSchema={handleSaveHomepageSchema}
              onSaveNotes={handleSaveNotes}
            />
          </TabsContent>

          <TabsContent value="metadata">
            <MetadataTab
              page={page}
              canEdit={canEdit}
              editableDomain={editableDomain}
              onDomainChange={handleDomainChange}
              onSaveDomain={handleSaveDomain}
              editablePageType={editablePageType}
              onPageTypeChange={setEditablePageType}
              editableCategory={editableCategory}
              onCategoryChange={setEditableCategory}
              editableLogoUrl={editableLogoUrl}
              onLogoUrlChange={setEditableLogoUrl}
              editableHeroImageUrl={editableHeroImageUrl}
              onHeroImageUrlChange={setEditableHeroImageUrl}
              editableFaqMode={editableFaqMode}
              onFaqModeChange={setEditableFaqMode}
              editableIsHomePage={editableIsHomePage}
              onIsHomePageChange={setEditableIsHomePage}
              onSaveV2Metadata={handleSaveV2Metadata}
              editableBeerAbv={editableBeerAbv}
              onBeerAbvChange={setEditableBeerAbv}
              editableBeerStyle={editableBeerStyle}
              onBeerStyleChange={setEditableBeerStyle}
              editableBeerLaunchYear={editableBeerLaunchYear}
              onBeerLaunchYearChange={setEditableBeerLaunchYear}
              editableBeerOfficialUrl={editableBeerOfficialUrl}
              onBeerOfficialUrlChange={setEditableBeerOfficialUrl}
              onSaveBeerMetadata={handleSaveBeerMetadata}
              onSaveWikidata={handleSaveWikidata}
              isSaving={isSaving}
              pageTypes={V2_PAGE_TYPES}
              categories={V2_CATEGORIES}
              faqModes={FAQ_MODES}
            />
          </TabsContent>
        </Tabs>

        {/* Validation Dialog */}
        <AlertDialog open={validationDialogOpen} onOpenChange={setValidationDialogOpen}>
          <AlertDialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>Schema Validation Results</AlertDialogTitle>
              <AlertDialogDescription>
                {validationResult && (
                  <>
                    <div className="mb-4">
                      <p className="font-medium">
                        Total Issues: {validationResult.issues.length} 
                        ({validationResult.issues.filter((i: any) => i.severity === 'error').length} errors, 
                        {validationResult.issues.filter((i: any) => i.severity === 'warning').length} warnings)
                      </p>
                    </div>
                    {validationResult.issues.length > 0 && (
                      <div className="space-y-2 text-left">
                        {validationResult.issues.map((issue: any, idx: number) => (
                          <div key={idx} className="p-3 rounded border bg-muted/30">
                            <p className="font-mono text-sm">{formatValidationIssue(issue)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
              {isAdmin && validatingVersionId && validationResult?.issues.filter((i: any) => i.severity === 'error').length > 0 && (
                <AlertDialogAction onClick={() => {
                  setValidationDialogOpen(false);
                  handleApprove(validatingVersionId);
                }}>
                  Approve Anyway (Override)
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
