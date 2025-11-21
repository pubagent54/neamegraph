import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Copy, Edit2, Plus } from "lucide-react";

interface Rule {
  id: string;
  name: string;
  body: string;
  is_active: boolean;
  created_at: string;
}

export default function Rules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [formData, setFormData] = useState({ name: "", body: "" });

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
        const { error } = await supabase
          .from("rules")
          .update({ name: formData.name, body: formData.body })
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Rules</h1>
            <p className="text-muted-foreground">
              Manage prompts for schema generation
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="mr-2 h-4 w-4" />
                New Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>
                  {editingRule ? "Edit Rule" : "Create New Rule"}
                </DialogTitle>
                <DialogDescription>
                  Define the AI prompt for schema generation
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Corporate Schema Prompt v1.1"
                  />
                </div>
                <div>
                  <Label htmlFor="body">Prompt Body</Label>
                  <Textarea
                    id="body"
                    value={formData.body}
                    onChange={(e) =>
                      setFormData({ ...formData, body: e.target.value })
                    }
                    placeholder="Enter the system prompt for AI schema generation..."
                    className="min-h-[400px] font-mono text-sm"
                  />
                </div>
                <Button onClick={handleSave} className="w-full">
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
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No rules created yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <Card key={rule.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle>{rule.name}</CardTitle>
                        {rule.is_active && (
                          <Badge className="bg-status-implemented text-white">
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
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicate(rule)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {!rule.is_active && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleSetActive(rule.id)}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Set Active
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={rule.body}
                    readOnly
                    className="font-mono text-xs min-h-[150px]"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
