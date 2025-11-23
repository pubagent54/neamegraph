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
import { CheckCircle, Copy, Edit2, Plus, RotateCcw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Rule {
  id: string;
  name: string;
  body: string;
  rules_backup: string | null;
  is_active: boolean;
  created_at: string;
  created_by_user_id: string | null;
}

export default function Rules() {
  const { userRole } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [formData, setFormData] = useState({ name: "", body: "" });
  const [originalBodies, setOriginalBodies] = useState<Record<string, string>>({});
  
  const isAdmin = userRole === "admin";

  useEffect(() => {
    fetchRules();
  }, []);

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
            created_by_user_id: user?.id,
          });

        if (error) throw error;
        toast.success("Rule created");
      }

      setDialogOpen(false);
      setEditingRule(null);
      setFormData({ name: "", body: "" });
      fetchRules();
    } catch (error) {
      console.error("Error saving rule:", error);
      toast.error("Failed to save rule");
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
    });
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleEdit = (rule: Rule) => {
    setFormData({
      name: rule.name,
      body: rule.body,
    });
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setFormData({ name: "", body: "" });
    setEditingRule(null);
    setDialogOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">AI Rules</h1>
            <p className="text-lg text-muted-foreground">
              Manage prompts for schema generation
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
                  Define the AI prompt for schema generation
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
                  <Label htmlFor="body">Prompt Body</Label>
                  <Textarea
                    id="body"
                    value={formData.body}
                    onChange={(e) =>
                      setFormData({ ...formData, body: e.target.value })
                    }
                    placeholder="Enter the system prompt for AI schema generation..."
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
    </Layout>
  );
}
