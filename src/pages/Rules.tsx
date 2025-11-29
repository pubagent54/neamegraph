/**
 * Rules Management Screen (Admin Only)
 * 
 * Manages schema generation prompts at the Domain level (Corporate, Beer, Pub).
 * Rules are sent as system prompts to NeameGraph Brain (LLM) when generating JSON-LD.
 * Domain-level rules are the primary/default way to configure schema generation.
 * Page Type and Category are passed as context to the prompt for adaptive behavior.
 * Advanced users can optionally create page_type/category-specific overrides.
 */

import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Edit2, Plus, Trash2, FileText, ExternalLink, Layers } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
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
import { SCHEMA_QUALITY_RULES, SCHEMA_QUALITY_RULE_DESCRIPTIONS } from "@/config/schemaQualityRules";
import { ORG_DESCRIPTION } from "@/config/organization";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePageTypes, useCategories } from "@/hooks/use-taxonomy";
import { getDomains } from "@/lib/taxonomy";

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
    category: "",
    domain: "",
    is_active: true
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<Rule | null>(null);
  
  const isAdmin = userRole === "admin";
  
  // Taxonomy-aware state
  const { pageTypes } = usePageTypes();
  const { categories } = useCategories();
  const [domains, setDomains] = useState<string[]>([]);
  const [showAdvancedOverrides, setShowAdvancedOverrides] = useState(false);

  useEffect(() => {
    fetchRules();
    loadDomains();
  }, []);

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
      // Cast rules_backup from Json to RuleBackup[]
      const rulesWithTypedBackups = (data || []).map(rule => ({
        ...rule,
        rules_backup: (rule.rules_backup as unknown as RuleBackup[]) || null
      }));
      setRules(rulesWithTypedBackups);
    } catch (error) {
      console.error("Error fetching rules:", error);
      toast.error("Failed to fetch rules");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (editingRule) {
        // Rotate backups: keep last 3 versions
        const existingBackups = editingRule.rules_backup || [];
        const newBackup: RuleBackup = {
          content: editingRule.body,
          timestamp: new Date().toISOString()
        };
        
        // Add current content as newest backup and keep only last 3
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
            rules_backup: updatedBackups as any // Cast to any for Supabase Json type
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
            domain: formData.domain || null,
            created_by_user_id: user?.id,
            is_active: true,
          });

        if (error) throw error;
        toast.success("Rule created");
      }

      setDialogOpen(false);
      setEditingRule(null);
      setFormData({ name: "", body: "", page_type: "", category: "", domain: "", is_active: true });
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

  const handleEdit = (rule: Rule) => {
    setFormData({
      name: rule.name,
      body: rule.body,
      page_type: rule.page_type || "",
      category: rule.category || "",
      domain: rule.domain || "",
      is_active: rule.is_active,
    });
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const openDeleteDialog = (rule: Rule) => {
    setRuleToDelete(rule);
    setDeleteDialogOpen(true);
  };

  // ========================================
  // RULES MATCHING ALGORITHM (PRIORITY ORDER)
  // ----------------------------------------
  // Rules are matched with the following priority:
  // 1. Category-specific override: rules.page_type == page.page_type AND rules.category == page.category
  // 2. Page Type override: rules.page_type == page.page_type AND rules.category IS NULL
  // 3. Domain default: rules.page_type IS NULL AND rules.category IS NULL (matched by domain in app logic)
  // 
  // Domain context (domain, pageType, category) is always passed to the prompt for adaptive behavior.
  // Database enforces unique constraint on active rules per (page_type, category) combination.
  // ----------------------------------------

  // Get domain-level rule for a given domain
  const getDomainRule = (domain: string) => {
    // Domain rules have domain set and page_type/category null
    return rules.find(r => r.is_active && r.domain === domain && r.page_type === null && r.category === null);
  };

  // Get domain status
  const getDomainStatus = (domain: string) => {
    const domainRule = getDomainRule(domain);
    if (!domainRule) return { status: "not_configured", label: "Not configured", variant: "outline" as const };
    if (domainRule.is_active) return { status: "active", label: "Active", variant: "default" as const };
    return { status: "draft", label: "Draft", variant: "secondary" as const };
  };

  // Get page type/category overrides for display in advanced section
  const getOverrideRules = () => {
    return rules.filter(r => r.page_type !== null || r.category !== null);
  };

  // Domain rules for display
  const domainRules = domains.map(domain => ({
    domain,
    rule: getDomainRule(domain),
    status: getDomainStatus(domain)
  }));

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">NeameGraph Brain Rules</h1>
          <p className="text-lg text-muted-foreground">
            Domain-level schema generation prompts. Each domain has a primary rule that defines how the NeameGraph Brain generates JSON-LD schema. Page Type and Category are passed as context to enable adaptive behavior.
          </p>
        </div>

        {/* DOMAIN-LEVEL RULES */}
        <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  <CardTitle className="text-2xl">Domain Rules</CardTitle>
                </div>
                <CardDescription>
                  Primary schema generation rules organized by domain. Domain rules are the default way to configure schema generation. {domainRules.filter(d => d.status.status === 'active').length} of {domains.length} domains configured.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {domainRules.map(({ domain, rule, status }) => (
                <div 
                  key={domain}
                  className="rounded-xl border bg-card p-4 hover:border-primary/40 transition-colors cursor-pointer"
                  onClick={() => {
                    if (rule) {
                      handleEdit(rule);
                    } else {
                      // Create new rule for this domain
                      setFormData({ 
                        name: `${domain} Schema Rule`, 
                        body: `# ${domain} Schema Generation Prompt\n\nYou will generate JSON-LD schema for ${domain} pages.\n\nContext provided:\n- domain: ${domain}\n- pageType: (will be provided)\n- category: (will be provided)\n\nUse this context to adapt schema generation behavior. Follow the Schema Quality Charter principles.\n\n## Instructions\n\nTODO: Add specific instructions for ${domain} schema generation.`, 
                        page_type: "",
                        category: "",
                        domain: domain,
                        is_active: true
                      });
                      setEditingRule(null);
                      setDialogOpen(true);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{domain}</h3>
                        <Badge variant={status.variant} className="rounded-full text-xs">
                          {status.label}
                        </Badge>
                      </div>
                      {rule ? (
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">{rule.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Updated {new Date(rule.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No rule configured. Click to create.
                        </p>
                      )}
                    </div>
                    {rule && isAdmin && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(rule);
                          }}
                          className="rounded-full"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Advanced Overrides Section */}
            <div className="mt-6 pt-6 border-t">
              <Collapsible open={showAdvancedOverrides} onOpenChange={setShowAdvancedOverrides}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between rounded-xl">
                    <span className="text-sm font-medium">Advanced overrides (optional)</span>
                    <Badge variant="outline" className="rounded-full">
                      {getOverrideRules().length} override{getOverrideRules().length !== 1 ? 's' : ''}
                    </Badge>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Advanced: Create page type or category-specific rule overrides. These are rarely needed—most schema generation should use the domain-level rule. Overrides take precedence over domain rules when matched.
                    </p>
                    {getOverrideRules().length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <p className="text-sm">No overrides configured.</p>
                        <p className="text-xs mt-1">Domain-level rules handle all pages by default.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {getOverrideRules().map(rule => (
                          <div 
                            key={rule.id}
                            className="rounded-lg border bg-card p-3 text-sm space-y-1"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="font-medium">{rule.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {rule.page_type && (
                                    <Badge variant="outline" className="text-xs rounded-full">
                                      Page Type: {pageTypes.find(pt => pt.id === rule.page_type)?.label || rule.page_type}
                                    </Badge>
                                  )}
                                  {rule.category && (
                                    <Badge variant="outline" className="text-xs rounded-full">
                                      Category: {categories.find(c => c.id === rule.category)?.label || rule.category}
                                    </Badge>
                                  )}
                                  {rule.is_active && (
                                    <Badge className="text-xs rounded-full">Active</Badge>
                                  )}
                                </div>
                              </div>
                              {isAdmin && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(rule)}
                                    className="h-8 w-8 p-0 rounded-full"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openDeleteDialog(rule)}
                                    className="h-8 w-8 p-0 rounded-full text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData({ name: "", body: "", page_type: "", category: "", domain: "", is_active: true });
                          setEditingRule(null);
                          setDialogOpen(true);
                        }}
                        className="w-full rounded-full mt-3"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Override Rule
                      </Button>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CardContent>
        </Card>

        {/* SCHEMA QUALITY CHARTER (GLOBAL) */}
        <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle className="text-2xl">Schema Quality Charter (Global)</CardTitle>
                </div>
                <CardDescription>
                  Global quality standards that apply to all domain rules. Domain-level prompts receive domain, pageType, and category as context to enable adaptive schema generation behavior.
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
              
              <div className="rounded-lg border bg-primary/5 p-4">
                <p className="text-sm font-medium mb-2">Taxonomy Context Passed to Prompts:</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>• <span className="font-mono">domain</span> – The domain scope (Corporate, Beer, Pub)</p>
                  <p>• <span className="font-mono">pageType</span> – The page type ID from taxonomy</p>
                  <p>• <span className="font-mono">category</span> – The category ID from taxonomy</p>
                  <p className="mt-2 italic">Use these values in your domain rule prompts to adapt schema generation behavior (e.g., treat FAQ categories as FAQPage, careers pages as JobPosting, etc.).</p>
                </div>
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
      </div>

      {/* RULE EDITOR DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
            
            <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
              <div className="space-y-0.5">
                <Label htmlFor="is_active" className="text-base font-medium">
                  Active Rule
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable this rule for schema generation. Disabled rules are ignored.
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
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
                  setFormData({ ...formData, page_type: value, category: "" });
                }}
              >
                <SelectTrigger id="page_type" className="rounded-xl">
                  <SelectValue placeholder="Default (all page types)" />
                </SelectTrigger>
                <SelectContent>
                  {pageTypes.filter(pt => pt.active).map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.label}
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
                  {formData.page_type && categories
                    .filter(cat => cat.page_type_id === formData.page_type && cat.active)
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.label}
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

            {/* Backup history - show last 3 versions */}
            {editingRule && editingRule.rules_backup && editingRule.rules_backup.length > 0 && (
              <div className="pt-4 border-t space-y-3">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl justify-between"
                      type="button"
                    >
                      <span className="text-sm font-medium">
                        View previous versions ({editingRule.rules_backup.length})
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 space-y-3">
                    {editingRule.rules_backup.map((backup, index) => (
                      <div 
                        key={index}
                        className="rounded-xl border bg-muted/30 p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">
                            Version from {new Date(backup.timestamp).toLocaleString()}
                          </p>
                          {isAdmin && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
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
                        <pre className="text-xs font-mono bg-background/50 rounded-lg p-3 overflow-x-auto max-h-[200px] overflow-y-auto">
                          {backup.content}
                        </pre>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
