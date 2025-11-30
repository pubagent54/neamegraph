/**
 * Rules Management Screen (Admin Only) - REFACTORED CONTROL CENTRE
 * 
 * Three-section layout for clean control centre experience:
 * 1. Rule Header/Meta (top) - Key meta about selected rule
 * 2. Preview (middle) - Test rule against real URLs and inspect JSON-LD
 * 3. Coverage (bottom) - Pages using this rule
 */

import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Edit2, Plus, Trash2, FileText, ExternalLink, Layers, Play, Copy, Loader2, Wrench, ChevronDown, ChevronRight, Shield } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePageTypes, useCategories } from "@/hooks/use-taxonomy";
import { getDomains } from "@/lib/taxonomy";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link } from "react-router-dom";

interface RuleBackup {
  content: string;
  timestamp: string;
}

interface Rule {
  id: string;
  name: string;
  body: string;
  rules_backup: RuleBackup[] | null;
  is_active: boolean;
  created_at: string;
  created_by_user_id: string | null;
  page_type: string | null;
  category: string | null;
  domain: string | null;
}

interface Page {
  id: string;
  path: string;
  page_type: string | null;
  category: string | null;
  status: string;
  domain: string;
}

export default function Rules() {
  const { userRole } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    name: "", 
    body: "", 
    page_type: "",
    category: "",
    domain: "",
    is_active: true
  });
  
  // Preview state
  const [selectedTestPageId, setSelectedTestPageId] = useState<string>("");
  const [previewJson, setPreviewJson] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Coverage state
  const [coveragePages, setCoveragePages] = useState<Page[]>([]);
  const [coverageLoading, setCoverageLoading] = useState(false);
  
  // UI state for rule grouping
  const [showLegacyRules, setShowLegacyRules] = useState<Record<string, boolean>>({});
  
  // Dev tools accordion state
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  
  const isAdmin = userRole === "admin";
  
  // Taxonomy-aware state
  const { pageTypes } = usePageTypes();
  const { categories } = useCategories();
  const [domains, setDomains] = useState<string[]>([]);

  useEffect(() => {
    fetchRules();
    loadDomains();
  }, []);

  useEffect(() => {
    if (selectedRule) {
      fetchCoverage();
    }
  }, [selectedRule]);

  const loadDomains = async () => {
    const domainList = await getDomains();
    setDomains(domainList);
  };

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase
        .from("rules")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rulesWithTypedBackups = (data || []).map(rule => ({
        ...rule,
        rules_backup: (rule.rules_backup as unknown as RuleBackup[]) || null
      }));
      setRules(rulesWithTypedBackups);
      
      // Auto-select first domain-level active rule
      const firstDomainRule = rulesWithTypedBackups.find(r => 
        r.is_active && r.domain && !r.page_type && !r.category
      );
      if (firstDomainRule) {
        setSelectedRule(firstDomainRule);
      }
    } catch (error) {
      console.error("Error fetching rules:", error);
      toast.error("Failed to fetch rules");
    } finally {
      setLoading(false);
    }
  };

  const fetchCoverage = async () => {
    if (!selectedRule) return;
    
    setCoverageLoading(true);
    try {
      let query = supabase.from("pages").select("id, path, page_type, category, status, domain");
      
      // Match based on rule specificity
      if (selectedRule.page_type && selectedRule.category) {
        // Category-specific override
        query = query
          .eq("page_type", selectedRule.page_type)
          .eq("category", selectedRule.category);
      } else if (selectedRule.page_type) {
        // Page type override
        query = query.eq("page_type", selectedRule.page_type);
      } else if (selectedRule.domain) {
        // Domain-level default
        query = query.eq("domain", selectedRule.domain);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      setCoveragePages(data || []);
    } catch (error) {
      console.error("Error fetching coverage:", error);
      toast.error("Failed to fetch coverage");
    } finally {
      setCoverageLoading(false);
    }
  };

  const handleRunPreview = async () => {
    if (!selectedRule) {
      toast.error("Please select a rule first");
      return;
    }
    
    if (!selectedTestPageId) {
      toast.error("Please select a test page");
      return;
    }
    
    setPreviewLoading(true);
    try {

    // Call generate-schema edge function
    console.log("Calling generate-schema with page_id:", selectedTestPageId);
    const { data, error } = await supabase.functions.invoke('generate-schema', {
      body: {
        page_id: selectedTestPageId || undefined
      }
    });

    console.log("Edge function response:", { data, error });

    // Check for error in data first (edge function returns errors as data)
    if (data?.error) {
      console.error("Schema generation error:", data.error);
      toast.error(data.error);
      setPreviewJson("");
      setPreviewLoading(false);
      return;
    }

    // Then check for HTTP-level errors
    if (error) {
      console.error("Edge function HTTP error:", error);
      const errorMsg = error.message || "Failed to generate preview";
      toast.error(errorMsg);
      setPreviewJson("");
      setPreviewLoading(false);
      return;
    }

    // Extract and parse the JSON-LD from the response
    let jsonLdContent = null;
    
    // Check if jsonld field exists in response (nested under schema_version)
    const jsonldSource = data?.schema_version?.jsonld || data?.jsonld;
    
    if (jsonldSource) {
      try {
        // If jsonld is a string, parse it to an object
        if (typeof jsonldSource === 'string') {
          jsonLdContent = JSON.parse(jsonldSource);
        } else {
          // If it's already an object, use it as-is
          jsonLdContent = jsonldSource;
        }
      } catch (parseError) {
        console.error("Failed to parse JSON-LD:", parseError);
        // If parsing fails, use the raw string
        jsonLdContent = jsonldSource;
      }
    }

    // If we successfully extracted JSON-LD content, pretty-print it
    if (jsonLdContent) {
      if (typeof jsonLdContent === 'string') {
        // If it's still a string (parsing failed), show as-is
        setPreviewJson(jsonLdContent);
      } else {
        // Pretty-print the object
        setPreviewJson(JSON.stringify(jsonLdContent, null, 2));
      }
      toast.success("Preview generated");
    } else {
      // No JSON-LD found in response
      console.error("No JSON-LD found in response:", data);
      toast.error("Preview response did not contain JSON-LD");
      setPreviewJson("");
    }
  } catch (error: any) {
    console.error("Error generating preview:", error);
    toast.error(error.message || "Failed to generate preview");
    setPreviewJson("");
  } finally {
    setPreviewLoading(false);
  }
  };

  const handleCopyJson = () => {
    if (previewJson) {
      navigator.clipboard.writeText(previewJson);
      toast.success("JSON-LD copied to clipboard");
    }
  };

  const handleSaveRule = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (selectedRule) {
        // Rotate backups: keep last 3 versions
        const existingBackups = selectedRule.rules_backup || [];
        const newBackup: RuleBackup = {
          content: selectedRule.body,
          timestamp: new Date().toISOString()
        };
        
        const updatedBackups = [newBackup, ...existingBackups].slice(0, 3);

        const { error } = await supabase
          .from("rules")
          .update({ 
            name: formData.name, 
            body: formData.body,
            page_type: formData.page_type || null,
            category: formData.category || null,
            domain: formData.domain || null,
            is_active: formData.is_active,
            rules_backup: updatedBackups as any
          })
          .eq("id", selectedRule.id);

        if (error) throw error;
        toast.success("Rule updated");
      }

      setEditDialogOpen(false);
      fetchRules();
    } catch (error) {
      console.error("Error saving rule:", error);
      toast.error("Failed to save rule");
    }
  };

  const handleEditRule = (rule: Rule) => {
    setFormData({
      name: rule.name,
      body: rule.body,
      page_type: rule.page_type || "",
      category: rule.category || "",
      domain: rule.domain || "",
      is_active: rule.is_active,
    });
    setEditDialogOpen(true);
  };

  const getDomainRules = () => {
    return rules.filter(r => r.domain && !r.page_type && !r.category);
  };

  const getRulesByDomain = () => {
    const domainGroups: Record<string, { primary: Rule[], legacy: Rule[] }> = {};
    
    rules.forEach(rule => {
      if (!rule.domain) return;
      
      if (!domainGroups[rule.domain]) {
        domainGroups[rule.domain] = { primary: [], legacy: [] };
      }
      
      // Active rules are primary, inactive rules are legacy
      if (rule.is_active) {
        domainGroups[rule.domain].primary.push(rule);
      } else {
        domainGroups[rule.domain].legacy.push(rule);
      }
    });
    
    return domainGroups;
  };

  const toggleLegacyRules = (domain: string) => {
    setShowLegacyRules(prev => ({ ...prev, [domain]: !prev[domain] }));
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

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">NeameGraph Brain Rules</h1>
          <p className="text-lg text-muted-foreground">
            Control centre for domain-level schema generation rules
          </p>
        </div>

        {/* SCHEMA QUALITY CHARTER BANNER */}
        <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-card to-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold text-sm">Schema Quality Charter (Global)</h3>
                  <p className="text-xs text-muted-foreground">Global quality rules that apply to all schema (Corporate, Beers, Pubs)</p>
                </div>
              </div>
              <Link to="/settings#charter">
                <Button variant="outline" size="sm" className="rounded-full">
                  <ExternalLink className="h-3 w-3 mr-2" />
                  View Full Charter
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* RULE SELECTOR */}
        <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Select Rule</CardTitle>
            <CardDescription>Choose a domain-level rule to view and configure</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(getRulesByDomain()).map(([domain, { primary, legacy }]) => (
                <div key={domain} className="space-y-3">
                  {/* Primary rules for this domain */}
                  <div className="grid gap-3">
                    {primary.map((rule) => (
                      <Button
                        key={rule.id}
                        variant={selectedRule?.id === rule.id ? "default" : "outline"}
                        className="justify-start h-auto py-3 px-4 rounded-xl"
                        onClick={() => setSelectedRule(rule)}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Layers className="h-4 w-4" />
                          <div className="flex-1 text-left">
                            <div className="font-semibold">{rule.name}</div>
                            <div className="text-xs text-muted-foreground">{rule.domain} domain</div>
                          </div>
                          {rule.is_active && (
                            <Badge variant="default" className="rounded-full">Active</Badge>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                  
                  {/* Legacy rules toggle */}
                  {legacy.length > 0 && (
                    <div className="ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleLegacyRules(domain)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {showLegacyRules[domain] ? (
                          <ChevronDown className="h-3 w-3 mr-1" />
                        ) : (
                          <ChevronRight className="h-3 w-3 mr-1" />
                        )}
                        {showLegacyRules[domain] ? 'Hide' : 'Show'} {legacy.length} other version{legacy.length !== 1 ? 's' : ''}
                      </Button>
                      
                      {showLegacyRules[domain] && (
                        <div className="mt-2 ml-4 space-y-2">
                          {legacy.map((rule) => (
                            <Button
                              key={rule.id}
                              variant={selectedRule?.id === rule.id ? "default" : "outline"}
                              className="justify-start h-auto py-2 px-3 rounded-lg w-full opacity-75"
                              onClick={() => setSelectedRule(rule)}
                            >
                              <div className="flex items-center gap-2 w-full">
                                <Layers className="h-3 w-3" />
                                <div className="flex-1 text-left">
                                  <div className="text-sm font-medium">{rule.name}</div>
                                  <div className="text-xs text-muted-foreground">Inactive</div>
                                </div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {selectedRule && (
          <>
            {/* SECTION 1: RULE HEADER / META */}
            <Card className="rounded-2xl">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-2xl">{selectedRule.name}</CardTitle>
                      <Badge variant="outline" className="rounded-full">
                        v2
                      </Badge>
                      {selectedRule.is_active && (
                        <Badge variant="default" className="rounded-full">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Entity type: {selectedRule.domain} · {selectedRule.page_type || "Domain-level"} 
                      {selectedRule.category ? ` · ${selectedRule.category}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(selectedRule.created_at).toLocaleString()}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => handleEditRule(selectedRule)}
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit Rule
                    </Button>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* SCHEMA DEV/DEBUG TOOLS ACCORDION */}
            <Card className="rounded-2xl border-muted/50">
              <Collapsible open={devToolsOpen} onOpenChange={setDevToolsOpen}>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-muted/10 transition-colors rounded-t-2xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <div className="text-left">
                          <CardTitle className="text-lg">Schema Dev/Debug Tools</CardTitle>
                          <CardDescription>Test rules and inspect coverage</CardDescription>
                        </div>
                      </div>
                      {devToolsOpen ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="space-y-8 pt-0">
                    {/* PREVIEW SECTION */}
                    <div className="space-y-4">
                      <div className="border-b pb-3">
                        <h3 className="font-semibold text-sm">Preview Schema</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Test this rule against a real URL and inspect the generated JSON-LD
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Test Page</Label>
                        <div className="flex gap-2">
                          <Select value={selectedTestPageId} onValueChange={setSelectedTestPageId}>
                            <SelectTrigger className="rounded-xl flex-1">
                              <SelectValue placeholder="Choose a test page..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl max-h-[300px]">
                              {coveragePages.slice(0, 20).map((page) => (
                                <SelectItem key={page.id} value={page.id}>
                                  {page.path}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={handleRunPreview}
                            disabled={previewLoading || !selectedTestPageId}
                            className="rounded-full"
                          >
                            {previewLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Run Preview
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {previewJson && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Generated JSON-LD</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCopyJson}
                              className="rounded-full"
                            >
                              <Copy className="h-3 w-3 mr-2" />
                              Copy JSON
                            </Button>
                          </div>
                          <div className="relative">
                            <pre className="text-xs font-mono bg-muted/50 rounded-xl p-4 overflow-x-auto max-h-[500px] overflow-y-auto border">
                              {previewJson}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* COVERAGE SECTION */}
                    <div className="space-y-4">
                      <div className="border-b pb-3">
                        <h3 className="font-semibold text-sm">Coverage</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {coverageLoading ? (
                            "Loading pages..."
                          ) : (
                            `This rule currently applies to ${coveragePages.length} page${coveragePages.length !== 1 ? 's' : ''}`
                          )}
                        </p>
                      </div>
                      
                      {coverageLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                      ) : coveragePages.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <p className="text-sm">No pages using this rule</p>
                        </div>
                      ) : (
                        <div className="border rounded-xl overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead className="font-semibold">Path</TableHead>
                                <TableHead className="font-semibold">Page Type</TableHead>
                                <TableHead className="font-semibold">Category</TableHead>
                                <TableHead className="font-semibold">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {coveragePages.slice(0, 50).map((page) => (
                                <TableRow key={page.id}>
                                  <TableCell className="font-mono text-sm">{page.path}</TableCell>
                                  <TableCell className="text-sm">{page.page_type || "—"}</TableCell>
                                  <TableCell className="text-sm">{page.category || "—"}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs rounded-full">
                                      {page.status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {coveragePages.length > 50 && (
                            <div className="p-3 bg-muted/20 text-center text-xs text-muted-foreground">
                              Showing first 50 of {coveragePages.length} pages
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          </>
        )}

        {/* EDIT DIALOG */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="rounded-2xl max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Rule</DialogTitle>
              <DialogDescription>
                Update the schema generation prompt for this rule
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Schema Generation Prompt</Label>
                <Textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  className="min-h-[300px] font-mono text-sm rounded-xl"
                />
              </div>

              {/* Backup history */}
              {selectedRule && Array.isArray(selectedRule.rules_backup) && selectedRule.rules_backup.length > 0 && (
                <div className="pt-4 border-t space-y-3">
                  <p className="text-sm font-medium">Previous versions ({selectedRule.rules_backup.length})</p>
                  <Accordion type="single" collapsible className="space-y-2">
                    {selectedRule.rules_backup.map((backup, index) => (
                      <AccordionItem 
                        key={index} 
                        value={`version-${index}`}
                        className="rounded-xl border bg-muted/30 px-4"
                      >
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center justify-between w-full pr-2">
                            <p className="text-xs font-medium text-muted-foreground text-left">
                              Version from {new Date(backup.timestamp).toLocaleString()}
                            </p>
                            {isAdmin && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Restore this version from ${new Date(backup.timestamp).toLocaleString()}?`)) {
                                    setFormData({ ...formData, body: backup.content });
                                    toast.success("Version restored to editor");
                                  }
                                }}
                                className="rounded-full h-7 text-xs"
                              >
                                Restore
                              </Button>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-3">
                          <pre className="text-xs font-mono bg-background/50 rounded-lg p-3 overflow-x-auto max-h-[200px] overflow-y-auto">
                            {backup.content}
                          </pre>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}

              <Button onClick={handleSaveRule} className="w-full rounded-full">
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
