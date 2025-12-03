import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { FileText, Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
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

interface Document {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export function DocumentsPanel() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  
  const { canEditRules } = usePermissions();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
      if (data && data.length > 0 && !expandedId) {
        setExpandedId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast.error("Title is required");
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("documents").insert({
        title: newTitle.trim(),
        body: newBody,
        created_by_user_id: userData.user?.id,
        updated_by_user_id: userData.user?.id,
      });

      if (error) throw error;

      toast.success("Document created");
      setIsCreating(false);
      setNewTitle("");
      setNewBody("");
      fetchDocuments();
    } catch (error: any) {
      toast.error(error.message || "Failed to create document");
    }
  };

  const handleEdit = (doc: Document) => {
    setEditingId(doc.id);
    setEditTitle(doc.title);
    setEditBody(doc.body);
  };

  const handleSave = async () => {
    if (!editingId || !editTitle.trim()) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("documents")
        .update({
          title: editTitle.trim(),
          body: editBody,
          updated_by_user_id: userData.user?.id,
        })
        .eq("id", editingId);

      if (error) throw error;

      toast.success("Document saved");
      setEditingId(null);
      fetchDocuments();
    } catch (error: any) {
      toast.error(error.message || "Failed to save document");
    }
  };

  const handleDelete = async () => {
    if (!docToDelete) return;

    try {
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", docToDelete);

      if (error) throw error;

      toast.success("Document deleted");
      setDocToDelete(null);
      setDeleteDialogOpen(false);
      fetchDocuments();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete document");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <FileText className="h-5 w-5" />
            SOP & Docs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="h-5 w-5" />
                SOP & Docs
              </CardTitle>
              <CardDescription>Standard operating procedures and documentation</CardDescription>
            </div>
            {canEditRules && !isCreating && (
              <Button size="sm" variant="outline" onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isCreating && (
            <div className="border rounded-xl p-4 space-y-3 bg-muted/30">
              <Input
                placeholder="Document title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="font-medium"
              />
              <Textarea
                placeholder="Document content (supports Markdown)..."
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={6}
                className="font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate}>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsCreating(false);
                    setNewTitle("");
                    setNewBody("");
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {documents.length === 0 && !isCreating ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No documents yet. {canEditRules && "Click 'New' to create one."}
            </p>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="border rounded-xl overflow-hidden"
              >
                {editingId === doc.id ? (
                  <div className="p-4 space-y-3 bg-muted/30">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="font-medium"
                    />
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={8}
                      className="font-mono text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSave}>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => toggleExpand(doc.id)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Updated {format(new Date(doc.updated_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {canEditRules && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(doc);
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDocToDelete(doc.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {expandedId === doc.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    {expandedId === doc.id && (
                      <div className="px-4 pb-4 border-t bg-muted/20">
                        <div className="prose prose-sm dark:prose-invert max-w-none pt-3">
                          <ReactMarkdown>{doc.body || "*No content*"}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
