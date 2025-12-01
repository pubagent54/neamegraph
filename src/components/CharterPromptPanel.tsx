import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Edit, X, Save } from "lucide-react";
import { toast } from "sonner";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface CharterPromptPanelProps {
  prompt: string | null;
  isAdmin: boolean;
  onSave: (newPrompt: string) => Promise<void>;
}

/**
 * Charter Prompt Panel - displays and allows editing (admin-only) of the 
 * full underlying Charter prompt used by the schema engine
 */
export function CharterPromptPanel({ prompt, isAdmin, onSave }: CharterPromptPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const displayPrompt = prompt || "";

  const handleEditClick = () => {
    setEditedPrompt(displayPrompt);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedPrompt("");
  };

  const handleSaveClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedPrompt);
      setIsEditing(false);
      setShowConfirmDialog(false);
      toast.success("Charter prompt updated successfully");
    } catch (error) {
      console.error("Error saving charter prompt:", error);
      toast.error("Failed to save charter prompt");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(displayPrompt);
      toast.success("Charter prompt copied to clipboard");
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="charter-prompt" className="border rounded-xl px-4 bg-muted/30">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-start justify-between gap-4 w-full pr-4">
              <div className="text-left">
                <h3 className="text-sm font-semibold mb-1">Charter Prompt (advanced)</h3>
                <p className="text-xs text-muted-foreground font-normal">
                  Underlying instructions used by the schema engine when enforcing the Schema Quality Charter. 
                  Editing this is an advanced operation.
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4 pb-4">
            <div className="flex gap-2 justify-end">
              {!isEditing && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyPrompt}
                    className="rounded-full"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy prompt
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleEditClick}
                      className="rounded-full"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit prompt
                    </Button>
                  )}
                </>
              )}
              {isEditing && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    className="rounded-full"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveClick}
                    disabled={isSaving}
                    className="rounded-full"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Saving..." : "Save changes"}
                  </Button>
                </>
              )}
            </div>

            <Textarea
              value={isEditing ? editedPrompt : displayPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              disabled={!isEditing}
              className="font-mono text-xs min-h-[400px] leading-relaxed"
              placeholder="Charter prompt will appear here..."
            />

            {!isAdmin && (
              <p className="text-xs text-muted-foreground italic">
                Only administrators can edit the Charter prompt.
              </p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Charter Prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing the Charter Prompt will affect how all schema is generated across Corporate, Beers, and Pubs. 
              Are you sure you want to update it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave} disabled={isSaving}>
              {isSaving ? "Updating..." : "Update Charter Prompt"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
