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
import { CheckCircle, Copy, Edit2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
    page_type: "" 
  });
  const [originalBodies, setOriginalBodies] = useState<Record<string, string>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<Rule | null>(null);
  
  const isAdmin = userRole === "admin";
  const [pageTypeCounts, setPageTypeCounts] = useState<Record<string, number>>({});
  const [previewPageType, setPreviewPageType] = useState<string>("");
  const [previewRule, setPreviewRule] = useState<Rule | null>(null);

  useEffect(() => {
    fetchRules();
    fetchPageTypeCounts();
  }, []);

  useEffect(() => {
    setPreviewRule(null);
  }, [previewPageType]);

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
            created_by_user_id: user?.id,
          });

        if (error) throw error;
        toast.success("Rule created");
      }

      setDialogOpen(false);
      setEditingRule(null);
      setFormData({ name: "", body: "", page_type: "" });
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
      // Deactivate all rules
      await supabase.from("rules").update({ is_active: false }).neq("id", "");

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
    });
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleEdit = (rule: Rule) => {
    setFormData({
      name: rule.name,
      body: rule.body,
      page_type: rule.page_type || "",
    });
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setFormData({ name: "", body: "", page_type: "" });
    setEditingRule(null);
    setDialogOpen(true);
  };

  const openDeleteDialog = (rule: Rule) => {
    setRuleToDelete(rule);
    setDeleteDialogOpen(true);
  };

  const handlePreview = () => {
    if (!previewPageType) return;

    // Find specific rule for this page type
    const specificRule = rules.find(
      (r) => r.is_active && r.page_type === previewPageType
    );

    if (specificRule) {
      setPreviewRule(specificRule);
      return;
    }

    // Fallback to default rule
    const defaultRule = rules.find((r) => r.is_active && r.page_type === null);
    setPreviewRule(defaultRule || null);
  };

  const getRuleCoverage = () => {
    const coverage: Record<string, { rule: Rule | null; count: number }> = {};
    
    // Get all unique page types
    const allPageTypes = [...new Set(Object.keys(pageTypeCounts))];
    
    allPageTypes.forEach((pageType) => {
      const specificRule = rules.find(
        (r) => r.is_active && r.page_type === pageType
      );
      
      if (specificRule) {
        coverage[pageType] = {
          rule: specificRule,
          count: pageTypeCounts[pageType] || 0,
        };
      } else {
        const defaultRule = rules.find((r) => r.is_active && r.page_type === null);
        coverage[pageType] = {
          rule: defaultRule,
          count: pageTypeCounts[pageType] || 0,
        };
      }
    });

    return coverage;
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">NeameGraph Brain Rules</h1>
          <p className="text-lg text-muted-foreground">
            Manage prompts for schema generation
          </p>
        </div>

        {/* Rules Coverage Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Rule Coverage by Page Type</CardTitle>
              <CardDescription>Which rules apply to each page type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(getRuleCoverage()).map(([pageType, { rule, count }]) => (
                  <div key={pageType} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="rounded-full">
                        {pageType}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{count} pages</span>
                    </div>
                    <div className="text-sm">
                      {rule ? (
                        <span className="font-medium">{rule.name}</span>
                      ) : (
                        <span className="text-muted-foreground italic">No rule</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Rule Preview</CardTitle>
              <CardDescription>Test which rule applies to a page type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Page Type</Label>
                <Select value={previewPageType} onValueChange={setPreviewPageType}>
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
              <Button onClick={handlePreview} disabled={!previewPageType} className="w-full rounded-full">
                Preview Rule Selection
              </Button>
              {previewRule && (
                <div className="mt-4 p-4 bg-muted/30 rounded-xl border border-border/50">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{previewRule.name}</p>
                      {previewRule.page_type ? (
                        <Badge variant="outline" className="rounded-full mt-1">
                          Specific: {previewRule.page_type}
                        </Badge>
                      ) : (
                        <Badge className="rounded-full mt-1 bg-primary">
                          Default (fallback)
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                    {previewRule.body.substring(0, 150)}...
                  </p>
                </div>
              )}
              {previewPageType && !previewRule && (
                <div className="mt-4 p-4 bg-destructive/10 rounded-xl border border-destructive/20">
                  <p className="text-sm text-destructive">
                    No active rule found for this page type
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mt-8">
          <h2 className="text-2xl font-bold tracking-tight">All Rules</h2>
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
                    Optional. If left blank, this rule is the default for all page types that don't have a more specific rule. If set, this rule only applies to that page type.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body">Prompt Body</Label>
                  <Textarea
                    id="body"
                    value={formData.body}
                    onChange={(e) =>
                      setFormData({ ...formData, body: e.target.value })
                    }
                    placeholder="Enter the system prompt for NeameGraph Brain schema generation..."
                    className="min-h-[400px] font-mono text-sm rounded-xl"
                  />
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
                      {rule.created_at && (
                        <span className="text-xs text-muted-foreground">
                          Last updated {new Date(rule.created_at).toLocaleDateString()}
                        </span>
                      )}
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
                        className={`font-mono text-sm min-h-[180px] bg-background/50 border-0 resize-none ${
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
