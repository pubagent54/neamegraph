import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { CheckCircle, XCircle, ShieldCheck, Copy, Edit2, Save, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchemaSummary } from "@/components/SchemaSummary";
import { SchemaStory } from "@/components/SchemaStory";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { toast } from "sonner";

interface SchemaTabProps {
  versions: any[];
  page: any;
  notes: string | null;
  canEdit: boolean;
  isAdmin: boolean;
  isHomepage: boolean;
  onValidate: (versionId: string, jsonld: string) => void;
  onApprove: (versionId: string) => void;
  onReject: (versionId: string) => void;
  onCopyForDrupal: (jsonld: string) => void;
  onSaveHomepageSchema: (versionId: string, schema: string) => Promise<void>;
  onSaveNotes: (notes: string) => Promise<void>;
}

export function SchemaTab({
  versions,
  page,
  notes,
  canEdit,
  isAdmin,
  isHomepage,
  onValidate,
  onApprove,
  onReject,
  onCopyForDrupal,
  onSaveHomepageSchema,
  onSaveNotes,
}: SchemaTabProps) {
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editedSchema, setEditedSchema] = useState<string>("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState(notes || "");
  const [saving, setSaving] = useState(false);

  const handleStartEdit = (version: any) => {
    setEditingVersionId(version.id);
    setEditedSchema(version.jsonld);
  };

  const handleCancelEdit = () => {
    setEditingVersionId(null);
    setEditedSchema("");
  };

  const handleSaveSchema = async (versionId: string) => {
    setSaving(true);
    try {
      await onSaveHomepageSchema(versionId, editedSchema);
      setEditingVersionId(null);
      setEditedSchema("");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyJson = (jsonld: string) => {
    navigator.clipboard.writeText(jsonld);
    toast.success("JSON copied to clipboard");
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await onSaveNotes(editedNotes);
      setEditingNotes(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Tabs defaultValue="versions" className="w-full">
      <TabsList>
        <TabsTrigger value="versions">Schema Versions</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>

      <TabsContent value="versions" className="space-y-4 mt-4">
        {versions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onValidate(version.id, version.jsonld)}
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Validate
                    </Button>
                    {canEdit && version.status === "draft" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => onApprove(version.id)}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onReject(version.id)}
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
                    <TabsTrigger value="story">Story</TabsTrigger>
                    <TabsTrigger value="json">JSON</TabsTrigger>
                  </TabsList>
                  <TabsContent value="summary" className="mt-4">
                    <ErrorBoundary>
                      <SchemaSummary 
                        jsonld={version.jsonld}
                        section={page.section}
                        createdAt={version.created_at}
                        status={version.status}
                      />
                    </ErrorBoundary>
                  </TabsContent>
                  <TabsContent value="story" className="mt-4">
                    <ErrorBoundary>
                      <SchemaStory 
                        jsonld={version.jsonld}
                        pageType={page.page_type}
                        category={page.category}
                      />
                    </ErrorBoundary>
                  </TabsContent>
                  <TabsContent value="json" className="mt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        {isHomepage && isAdmin && editingVersionId !== version.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartEdit(version)}
                          >
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit homepage schema
                          </Button>
                        )}
                        {!isHomepage && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopyJson(version.jsonld)}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Copy JSON
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onCopyForDrupal(version.jsonld)}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Copy for Drupal
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      {editingVersionId === version.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editedSchema}
                            onChange={(e) => setEditedSchema(e.target.value)}
                            className="font-mono text-xs min-h-[400px]"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveSchema(version.id)}
                              disabled={saving}
                            >
                              <Save className="mr-2 h-4 w-4" />
                              {saving ? "Saving..." : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                              disabled={saving}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono max-h-[600px] overflow-y-auto select-text">
                          {JSON.stringify(JSON.parse(version.jsonld), null, 2)}
                        </pre>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>

      <TabsContent value="notes" className="mt-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Page Notes</CardTitle>
                <CardDescription>
                  Internal notes about this page (not included in schema)
                </CardDescription>
              </div>
              {canEdit && !editingNotes && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingNotes(true);
                    setEditedNotes(notes || "");
                  }}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingNotes ? (
              <div className="space-y-4">
                <Textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  placeholder="Add notes about this page..."
                  className="min-h-[200px]"
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveNotes} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Save Notes"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingNotes(false);
                      setEditedNotes(notes || "");
                    }}
                    disabled={saving}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-foreground/90 whitespace-pre-wrap">
                {notes || (
                  <p className="text-muted-foreground italic">No notes yet</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
