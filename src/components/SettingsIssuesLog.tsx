import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Pencil, Check, X, Trash2 } from "lucide-react";
import { format } from "date-fns";
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

interface Issue {
  id: string;
  issue: string;
  comments: string | null;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
  created_by_user_id: string | null;
}

export function SettingsIssuesLog() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIssue, setNewIssue] = useState("");
  const [newComments, setNewComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editIssue, setEditIssue] = useState("");
  const [editComments, setEditComments] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [issueToDelete, setIssueToDelete] = useState<Issue | null>(null);

  useEffect(() => {
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    try {
      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setIssues(data || []);
    } catch (error) {
      console.error("Error fetching issues:", error);
      toast.error("Failed to load issues");
    } finally {
      setLoading(false);
    }
  };

  const createIssue = async () => {
    if (!newIssue.trim()) {
      toast.error("Issue title is required");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("issues")
        .insert({
          issue: newIssue.trim(),
          comments: newComments.trim() || null,
          resolved: false,
          created_by_user_id: user?.id || null,
        });

      if (error) throw error;

      toast.success("Issue added");
      setNewIssue("");
      setNewComments("");
      await fetchIssues();
    } catch (error) {
      console.error("Error creating issue:", error);
      toast.error("Failed to add issue");
    } finally {
      setSubmitting(false);
    }
  };

  const updateIssue = async (id: string, patch: Partial<Issue>) => {
    try {
      const { error } = await supabase
        .from("issues")
        .update(patch)
        .eq("id", id);

      if (error) throw error;
      
      await fetchIssues();
    } catch (error) {
      console.error("Error updating issue:", error);
      toast.error("Failed to update issue");
    }
  };

  const toggleResolved = async (id: string, currentResolved: boolean) => {
    try {
      const patch: Partial<Issue> = {
        resolved: !currentResolved,
        resolved_at: !currentResolved ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from("issues")
        .update(patch)
        .eq("id", id);

      if (error) throw error;

      toast.success(!currentResolved ? "Issue marked as resolved" : "Issue reopened");
      await fetchIssues();
    } catch (error) {
      console.error("Error toggling resolved:", error);
      toast.error("Failed to update issue status");
    }
  };

  const startEdit = (issue: Issue) => {
    setEditingId(issue.id);
    setEditIssue(issue.issue);
    setEditComments(issue.comments || "");
  };

  const saveEdit = async (id: string) => {
    if (!editIssue.trim()) {
      toast.error("Issue title cannot be empty");
      return;
    }

    await updateIssue(id, {
      issue: editIssue.trim(),
      comments: editComments.trim() || null,
    });
    
    setEditingId(null);
    setEditIssue("");
    setEditComments("");
    toast.success("Issue updated");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditIssue("");
    setEditComments("");
  };

  const confirmDelete = (issue: Issue) => {
    setIssueToDelete(issue);
    setDeleteDialogOpen(true);
  };

  const deleteIssue = async () => {
    if (!issueToDelete) return;

    try {
      const { error } = await supabase
        .from("issues")
        .delete()
        .eq("id", issueToDelete.id);

      if (error) throw error;

      toast.success("Issue deleted");
      await fetchIssues();
    } catch (error) {
      console.error("Error deleting issue:", error);
      toast.error("Failed to delete issue");
    } finally {
      setDeleteDialogOpen(false);
      setIssueToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add issue form */}
      <div className="space-y-4 p-4 bg-muted/30 rounded-xl border">
        <div className="space-y-2">
          <Label htmlFor="new-issue">Issue</Label>
          <Input
            id="new-issue"
            value={newIssue}
            onChange={(e) => setNewIssue(e.target.value)}
            placeholder="Brief description of the issue"
            className="rounded-xl"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                createIssue();
              }
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-comments">Comments (optional)</Label>
          <Textarea
            id="new-comments"
            value={newComments}
            onChange={(e) => setNewComments(e.target.value)}
            placeholder="Additional notes or context"
            className="rounded-xl min-h-[80px]"
          />
        </div>

        <Button
          onClick={createIssue}
          disabled={submitting || !newIssue.trim()}
          className="rounded-full"
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          {submitting ? "Adding..." : "Add issue"}
        </Button>
      </div>

      {/* Issues list */}
      <div className="space-y-2">
        {issues.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No issues logged yet
          </div>
        ) : (
          <div className="space-y-2">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className={`p-4 rounded-xl border transition-colors ${
                  issue.resolved ? "bg-muted/20" : "bg-card"
                }`}
              >
                {editingId === issue.id ? (
                  // Edit mode
                  <div className="space-y-3">
                    <Input
                      value={editIssue}
                      onChange={(e) => setEditIssue(e.target.value)}
                      className="rounded-xl"
                      autoFocus
                    />
                    <Textarea
                      value={editComments}
                      onChange={(e) => setEditComments(e.target.value)}
                      className="rounded-xl min-h-[60px]"
                      placeholder="Comments"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveEdit(issue.id)}
                        className="rounded-full"
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEdit}
                        className="rounded-full"
                      >
                        <X className="mr-1 h-3 w-3" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={issue.resolved}
                        onCheckedChange={() => toggleResolved(issue.id, issue.resolved)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`font-medium ${
                              issue.resolved ? "text-muted-foreground line-through" : ""
                            }`}
                          >
                            {issue.issue}
                          </p>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit(issue)}
                              className="h-7 w-7 p-0 rounded-full"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => confirmDelete(issue)}
                              className="h-7 w-7 p-0 rounded-full text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {issue.comments && (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {issue.comments}
                          </p>
                        )}

                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>
                            Created {format(new Date(issue.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                          {issue.resolved_at && (
                            <span>
                              Resolved {format(new Date(issue.resolved_at), "MMM d, yyyy 'at' h:mm a")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete issue?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this issue? This action cannot be undone.
              {issueToDelete && (
                <div className="mt-3 p-3 rounded-lg bg-muted/50 border">
                  <p className="font-medium text-foreground">{issueToDelete.issue}</p>
                  {issueToDelete.comments && (
                    <p className="text-sm mt-1 text-muted-foreground">{issueToDelete.comments}</p>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteIssue}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
