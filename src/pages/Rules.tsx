/**
 * Rules Management Screen (Admin Only)
 * 
 * Manages schema generation prompts matched by (page_type, category) pairs.
 * Rules are sent as system prompts to NeameGraph Brain (LLM) when generating JSON-LD.
 * Features: inline editing, backup/restore, coverage dashboard, and preview/test tool.
 * Default rule (both page_type and category NULL) serves as fallback for unmatched pages.
 */

import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Copy, Edit2, Plus, RotateCcw, Trash2, FileText, ExternalLink } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { V2_CATEGORIES } from "@/lib/rules";
import { SCHEMA_QUALITY_RULES, SCHEMA_QUALITY_RULE_DESCRIPTIONS } from "@/config/schemaQualityRules";
import { ORG_DESCRIPTION } from "@/config/organization";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Rule {
  id: string;
  name: string;
  body: string;
  rules_backup: string | null;
  is_active: boolean;
  created_at: string;
  created_by_user_id: string | null;
  page_type: string | null;
  category: string | null;
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

export default function Rules() {
  const { userRole } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [formData, setFormData] = useState({ 
    name: "", 
    body: "", 
    page_type: "",
    category: ""
  });
  const [originalBodies, setOriginalBodies] = useState<Record<string, string>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<Rule | null>(null);
  
  const isAdmin = userRole === "admin";
  const [pageTypeCounts, setPageTypeCounts] = useState<Record<string, number>>({});
  const [previewPageType, setPreviewPageType] = useState<string>("");
  const [previewRule, setPreviewRule] = useState<Rule | null>(null);
  const [previewDefaultRule, setPreviewDefaultRule] = useState<Rule | null>(null);
  const [pages, setPages] = useState<Array<{ id: string; path: string; page_type: string | null }>>([]);
  const [previewPageId, setPreviewPageId] = useState<string>("");
  const [ruleCoverage, setRuleCoverage] = useState<Record<string, { rule: Rule | null; count: number }>>({});

  useEffect(() => {
    fetchRules();
    fetchPageTypeCounts();
    fetchPages();
    fetchRuleCoverage();
  }, []);

  useEffect(() => {
    setPreviewRule(null);
    setPreviewDefaultRule(null);
  }, [previewPageType, previewPageId]);

  useEffect(() => {
    // Refetch coverage when rules change
    if (rules.length > 0) {
      fetchRuleCoverage();
    }
  }, [rules]);

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase
        .from("rules")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRules(data || []);
      
      // Store original bodies for inline editing
      const bodies: Record<string, string> = {};
      (data || []).forEach((rule) => {
        bodies[rule.id] = rule.body;
      });
      setOriginalBodies(bodies);
    } catch (error) {
      console.error("Error fetching rules:", error);
      toast.error("Failed to fetch rules");
    } finally {
      setLoading(false);
    }
  };

  const fetchPageTypeCounts = async () => {
    try {
      const { data, error } = await supabase
        .from("pages")
        .select("page_type");

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((page) => {
        const type = page.page_type || "unknown";
        counts[type] = (counts[type] || 0) + 1;
      });
      setPageTypeCounts(counts);
    } catch (error) {
      console.error("Error fetching page type counts:", error);
    }
  };

  const fetchPages = async () => {
    try {
      const { data, error } = await supabase
        .from("pages")
        .select("id, path, page_type")
        .order("path");

      if (error) throw error;
      setPages(data || []);
    } catch (error) {
      console.error("Error fetching pages:", error);
    }
  };

  const handleInlineUpdate = async (ruleId: string, newBody: string) => {
    try {
      const originalBody = originalBodies[ruleId];
      
      const { error } = await supabase
        .from("rules")
        .update({
          body: newBody,
          rules_backup: originalBody,
        })
        .eq("id", ruleId);

      if (error) throw error;
      
      toast.success("Rules updated");
      await fetchRules();
    } catch (error) {
      console.error("Error updating rules:", error);
      toast.error("Failed to update rules");
    }
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (editingRule) {
        // Before updating, backup the current body
        const { error } = await supabase
          .from("rules")
          .update({ 
            name: formData.name, 
            body: formData.body,
            page_type: formData.page_type || null,
            category: formData.category || null,
            rules_backup: editingRule.body // Backup current rules before updating
          })
          .eq("id", editingRule.id);

        if (error) throw error;
        toast.success("Rule updated");
      } else {
        const { error } = await supabase
          .from("rules")
          .insert({
            name: formData.name,
            body: formData.body,
            page_type: formData.page_type || null,
            category: formData.category || null,
            created_by_user_id: user?.id,
          });

        if (error) throw error;
        toast.success("Rule created");
      }

      setDialogOpen(false);
      setEditingRule(null);
      setFormData({ name: "", body: "", page_type: "", category: "" });
      fetchRules();
    } catch (error) {
      console.error("Error saving rule:", error);
      toast.error("Failed to save rule");
    }
  };

  const handleDelete = async () => {
    if (!ruleToDelete) return;

    try {
      const { error } = await supabase
        .from("rules")
        .delete()
        .eq("id", ruleToDelete.id);

      if (error) throw error;

      toast.success("Rule deleted");
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
      fetchRules();
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast.error("Failed to delete rule");
    }
  };

  const handleRestoreBackup = async (rule: Rule) => {
    if (!rule.rules_backup) {
      toast.error("No backup available");
      return;
    }

    try {
      // Move current rules to backup, restore backup as current
      const { error } = await supabase
        .from("rules")
        .update({
          rules_backup: rule.body,
          body: rule.rules_backup,
        })
        .eq("id", rule.id);

      if (error) throw error;
      
      toast.success("Backup restored successfully");
      fetchRules();
    } catch (error) {
      console.error("Error restoring backup:", error);
      toast.error("Failed to restore backup");
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      const ruleToActivate = rules.find(r => r.id === id);
      if (!ruleToActivate) return;

      // Deactivate any other rule with the same page_type + category combination
      const { error: deactivateError } = await supabase
        .from("rules")
        .update({ is_active: false })
        .eq("page_type", ruleToActivate.page_type)
        .eq("category", ruleToActivate.category)
        .neq("id", id);

      if (deactivateError) throw deactivateError;

      // Activate selected rule
      const { error } = await supabase
        .from("rules")
        .update({ is_active: true })
        .eq("id", id);

      if (error) throw error;

      toast.success("Active rule updated");
      fetchRules();
    } catch (error) {
      console.error("Error setting active rule:", error);
      toast.error("Failed to update active rule");
    }
  };

  const handleDuplicate = (rule: Rule) => {
    setFormData({
      name: `${rule.name} (Copy)`,
      body: rule.body,
      page_type: rule.page_type || "",
      category: rule.category || "",
    });
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleEdit = (rule: Rule) => {
    setFormData({
      name: rule.name,
      body: rule.body,
      page_type: rule.page_type || "",
      category: rule.category || "",
    });
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setFormData({ name: "", body: "", page_type: "", category: "" });
    setEditingRule(null);
    setDialogOpen(true);
  };

  const openDeleteDialog = (rule: Rule) => {
    setRuleToDelete(rule);
    setDeleteDialogOpen(true);
  };

  // ========================================
  // RULES MATCHING ALGORITHM
  // ----------------------------------------
  // Rules are matched by (page_type, category) pair
  // 1. Try exact match: rules.page_type = page.page_type AND rules.category = page.category
  // 2. Fallback: active default rule where both page_type and category are NULL
  // 3. Database enforces unique constraint on active rules per (page_type, category)
  // ----------------------------------------
  const handlePreview = async () => {
    let targetPageType = previewPageType;
    let targetCategory: string | null = null;
    
    // If a specific page is selected, use its page type and category
    if (previewPageId) {
      const { data: selectedPage } = await supabase
        .from("pages")
        .select("page_type, category")
        .eq("id", previewPageId)
        .single();
        
      if (selectedPage?.page_type) {
        targetPageType = selectedPage.page_type;
        targetCategory = selectedPage.category;
      }
    }
    
    if (!targetPageType) return;

    // Find specific rule for this page type + category combination
    const specificRule = rules.find(
      (r) => r.is_active && 
             r.page_type === targetPageType && 
             r.category === targetCategory
    );

    // Find the default rule for comparison (page_type and category both null)
    const defaultRule = rules.find(
      (r) => r.is_active && r.page_type === null && r.category === null
    );
    
    if (specificRule) {
      setPreviewRule(specificRule);
      setPreviewDefaultRule(defaultRule || null);
      return;
    }

    // Fallback to default rule
    setPreviewRule(defaultRule || null);
    setPreviewDefaultRule(null); // No need to show it twice
  };

  const getRuleCoverage = async () => {
    // Fetch pages with their page_type and category
    const { data: pagesData } = await supabase
      .from("pages")
      .select("page_type, category");
    
    const coverage: Record<string, { rule: Rule | null; count: number }> = {};
    
    (pagesData || []).forEach((page) => {
      const key = `${page.page_type || 'unknown'}::${page.category || 'none'}`;
      
      // Find matching rule for this page_type + category
      const matchedRule = rules.find(
        (r) => r.is_active && 
               r.page_type === page.page_type && 
               r.category === page.category
      );
      
      // Fall back to default rule if no specific match
      const defaultRule = rules.find(
        (r) => r.is_active && r.page_type === null && r.category === null
      );
      
      const ruleToUse = matchedRule || defaultRule;
      
      if (!coverage[key]) {
        coverage[key] = { rule: ruleToUse, count: 0 };
      }
      coverage[key].count++;
    });

    return coverage;
  };

  const fetchRuleCoverage = async () => {
    const coverage = await getRuleCoverage();
    setRuleCoverage(coverage);
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">NeameGraph Brain Rules</h1>
          <p className="text-lg text-muted-foreground">
            Manage schema engine prompts for each page type and category combination. Set a default rule (no page type or category) to handle pages without specific rules.
          </p>
        </div>

        {/* 0. SCHEMA QUALITY CHARTER (GLOBAL) */}
        <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle className="text-2xl">Schema Quality Charter (Global)</CardTitle>
                </div>
                <CardDescription>
                  These global quality rules apply to every schema run (Corporate, Beers, Pubs). They are defined in the Schema Quality Charter and enforced by the schema engine.
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('/docs/schema-quality-charter.md', '_blank')}
                className="rounded-full"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Full Charter
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Organization Strap Display */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  <span className="font-semibold">Shepherd Neame Organisation strap (ORG_DESCRIPTION):</span>
                </p>
                <p className="text-sm leading-relaxed">
                  {ORG_DESCRIPTION}
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Rule</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center w-[100px]">Enabled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(SCHEMA_QUALITY_RULES).map(([key, enabled]) => (
                    <TableRow key={key}>
                      <TableCell className="font-mono text-sm">
                        {key}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {SCHEMA_QUALITY_RULE_DESCRIPTIONS[key as keyof typeof SCHEMA_QUALITY_RULES]}
                      </TableCell>
                      <TableCell className="text-center">
                        {enabled ? (
                          <Badge className="bg-primary rounded-full">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full">
                            No
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground italic">
                These rules are currently non-configurable and apply to all domains. Changes to schema quality philosophy should be reflected in both the Charter document and the schema engine validation logic.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 1. RULES LIST (TOP) */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Rules</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Create rules for specific page type and category combinations. The default rule (no page type/category set) applies to pages without a matching specific rule.
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNewDialog} className="rounded-full">
                  <Plus className="mr-2 h-4 w-4" />
                  New Rule
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingRule ? "Edit Rule" : "Create New Rule"}
                </DialogTitle>
                <DialogDescription>
                  Define the NeameGraph Brain prompt for schema generation
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Corporate Schema Prompt v1.1"
                    className="rounded-xl"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="page_type">Page Type (Optional)</Label>
                    {formData.page_type && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData({ ...formData, page_type: "" })}
                        className="h-auto py-1 px-2 text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <Select
                    value={formData.page_type}
                    onValueChange={(value) => {
                      setFormData({ ...formData, page_type: value });
                    }}
                  >
                    <SelectTrigger id="page_type" className="rounded-xl">
                      <SelectValue placeholder="Default (all page types)" />
                    </SelectTrigger>
                    <SelectContent>
                      {V2_PAGE_TYPES.map((pt) => (
                        <SelectItem key={pt} value={pt}>
                          {pt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                   <p className="text-xs text-muted-foreground">
                    Leave blank for a default rule that applies to all page types. Set to create a specific rule for that page type.
                   </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="category">Category (Optional)</Label>
                    {formData.category && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData({ ...formData, category: "" })}
                        className="h-auto py-1 px-2 text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => {
                      setFormData({ ...formData, category: value });
                    }}
                    disabled={!formData.page_type}
                  >
                    <SelectTrigger id="category" className="rounded-xl">
                      <SelectValue placeholder={formData.page_type ? "Select category" : "Select page type first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.page_type && V2_CATEGORIES[formData.page_type]?.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Optional category for this rule. Combine with Page Type for fine-grained rule matching.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="body">Prompt Body</Label>
                    <span className="text-xs text-muted-foreground">
                      {formData.body.length} characters
                      {formData.body.length > 0 && ` • ${formData.body.split('\n').length} lines`}
                    </span>
                  </div>
                  <Textarea
                    id="body"
                    value={formData.body}
                    onChange={(e) =>
                      setFormData({ ...formData, body: e.target.value })
                    }
                    placeholder="Enter the system prompt for NeameGraph Brain schema generation..."
                    className="min-h-[400px] font-mono text-sm rounded-xl leading-relaxed"
                  />
                  <p className="text-xs text-muted-foreground">
                    This prompt will be used by NeameGraph Brain to generate JSON-LD schema for matching pages.
                  </p>
                </div>
                <Button onClick={handleSave} className="w-full rounded-full">
                  Save Rule
                </Button>
              </div>
            </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : rules.length === 0 ? (
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="py-12 text-center text-muted-foreground">
                No rules created yet
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {rules.map((rule) => (
              <Card 
                key={rule.id}
                className={`rounded-2xl border-0 shadow-sm transition-all ${
                  rule.is_active ? "ring-2 ring-primary bg-gradient-to-br from-card to-primary/5" : ""
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-xl">{rule.name}</CardTitle>
                        {rule.is_active && (
                          <Badge className="bg-primary rounded-full">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Active
                          </Badge>
                        )}
                        <Badge variant="outline" className="rounded-full">
                          {rule.page_type || "Default (all page types)"}
                        </Badge>
                        {rule.category && (
                          <Badge variant="outline" className="rounded-full bg-muted">
                            {rule.category}
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        Created {new Date(rule.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(rule)}
                        className="rounded-full"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicate(rule)}
                        className="rounded-full"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeleteDialog(rule)}
                          className="rounded-full text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {!rule.is_active && (
                        <Button
                          size="sm"
                          onClick={() => handleSetActive(rule.id)}
                          className="rounded-full"
                        >
                          Set Active
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Schema Rules (prompt)</h3>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {rule.body.length} chars • {rule.body.split('\n').length} lines
                        </span>
                        {rule.created_at && (
                          <span className="text-xs text-muted-foreground">
                            Last updated {new Date(rule.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                      <Textarea
                        value={rule.body}
                        readOnly={!isAdmin}
                        onChange={(e) => {
                          if (isAdmin) {
                            const updatedRules = rules.map((r) =>
                              r.id === rule.id ? { ...r, body: e.target.value } : r
                            );
                            setRules(updatedRules);
                          }
                        }}
                        onBlur={() => {
                          if (isAdmin && rule.body !== originalBodies[rule.id]) {
                            handleInlineUpdate(rule.id, rule.body);
                          }
                        }}
                        className={`font-mono text-sm min-h-[180px] leading-relaxed bg-background/50 border-0 resize-none ${
                          isAdmin ? "focus-visible:ring-1 focus-visible:ring-primary" : "focus-visible:ring-0"
                        }`}
                      />
                    </div>
                    {!isAdmin && (
                      <p className="text-xs text-muted-foreground italic">
                        These rules can only be edited by an admin.
                      </p>
                    )}
                  </div>

                  {rule.rules_backup && (
                    <Collapsible className="space-y-2">
                      <div className="flex items-center justify-between">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                            View previous rules (backup)
                          </Button>
                        </CollapsibleTrigger>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestoreBackup(rule)}
                            className="text-xs rounded-full"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Restore backup as current rules
                          </Button>
                        )}
                      </div>
                      <CollapsibleContent>
                        <div className="bg-muted/20 p-3 rounded-lg border border-border/30">
                          <pre className="font-mono text-xs whitespace-pre-wrap break-words text-muted-foreground">
                            {rule.rules_backup}
                          </pre>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </Card>
              ))}
            </div>
          )}
        </div>

        {/* 2. RULES COVERAGE BY PAGE TYPE (MIDDLE) */}
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Rules Coverage by Page Type & Category</CardTitle>
            <CardDescription>Shows which rule applies to each page type and category combination</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-sm">Page Type</th>
                    <th className="text-left p-3 font-medium text-sm">Category</th>
                    <th className="text-left p-3 font-medium text-sm">Rule Used</th>
                    <th className="text-right p-3 font-medium text-sm"># Pages</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(ruleCoverage).map(([key, { rule, count }]) => {
                    const [pageType, category] = key.split('::');
                    return (
                      <tr key={key} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <Badge variant="outline" className="rounded-full font-normal">
                            {pageType === 'unknown' ? 'Not Set' : pageType}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="rounded-full font-normal bg-muted">
                            {category === 'none' ? 'Not Set' : category}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {rule ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{rule.name}</span>
                              {!rule.page_type && !rule.category && (
                                <Badge variant="secondary" className="rounded-full text-xs">
                                  default
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">No active rule</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <span className="text-sm font-medium">{count}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 3. RULE PREVIEW & TEST (BOTTOM) */}
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Rule Preview & Test</CardTitle>
            <CardDescription>Preview which rule would be selected for a given page type or specific page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Selection Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Page Type</Label>
                <Select value={previewPageType} onValueChange={(val) => {
                  setPreviewPageType(val);
                  setPreviewPageId(""); // Clear page selection when page type changes
                }}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Choose a page type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {V2_PAGE_TYPES.map((pt) => (
                      <SelectItem key={pt} value={pt}>
                        {pt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Specific Page (optional)</Label>
                <Select value={previewPageId} onValueChange={setPreviewPageId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Or choose a specific page..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((page) => (
                      <SelectItem key={page.id} value={page.id}>
                        {page.path} {page.page_type ? `(${page.page_type})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={handlePreview} 
              disabled={!previewPageType && !previewPageId} 
              className="w-full rounded-full"
            >
              Preview Rule Selection
            </Button>

            {/* Preview Results */}
            {previewRule && (
              <div className="space-y-4 p-6 bg-muted/30 rounded-xl border border-border/50">
                {/* Summary Lines */}
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Rule that will be used:</p>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-lg">{previewRule.name}</p>
                        {previewRule.page_type ? (
                          <Badge variant="outline" className="rounded-full">
                            {previewRule.page_type}
                          </Badge>
                        ) : (
                          <Badge className="rounded-full bg-primary">
                            Default (all types)
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {previewDefaultRule && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">
                        Default rule (fallback): <span className="font-medium">{previewDefaultRule.name}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Accordion for Prompt Body */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="prompt" className="border-0">
                    <AccordionTrigger className="text-sm font-medium hover:no-underline py-2">
                      Show prompt body
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="mt-2 p-4 bg-background rounded-lg border max-h-[400px] overflow-y-auto">
                        <pre className="font-mono text-xs whitespace-pre-wrap break-words">
                          {previewRule.body}
                        </pre>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}

            {(previewPageType || previewPageId) && !previewRule && (
              <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/20">
                <p className="text-sm text-destructive">
                  No active rule found for this selection
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{ruleToDelete?.name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
