import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface RenameRuleDialogProps {
  ruleId: string;
  currentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RenameRuleDialog({ ruleId, currentName, open, onOpenChange, onSuccess }: RenameRuleDialogProps) {
  const [newName, setNewName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmedName = newName.trim();
    
    if (!trimmedName) {
      toast.error("Rule name cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("rules")
        .update({ name: trimmedName })
        .eq("id", ruleId);

      if (error) throw error;

      toast.success("Rule renamed successfully");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error renaming rule:", error);
      toast.error("Failed to rename rule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Rename rule</DialogTitle>
          <DialogDescription>
            Enter a new name for this rule
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rule-name">Rule name</Label>
            <Input
              id="rule-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="rounded-xl"
              placeholder="Enter rule name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-full"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !newName.trim()}
            className="rounded-full"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
