import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Layers, MoreVertical, Edit3, Trash2 } from "lucide-react";
import { RenameRuleDialog } from "./RenameRuleDialog";
import { DeleteRuleDialog } from "./DeleteRuleDialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Rule {
  id: string;
  name: string;
  domain: string | null;
  is_active: boolean;
  page_type: string | null;
  category: string | null;
}

interface RuleCardProps {
  rule: Rule;
  isSelected: boolean;
  isLegacy?: boolean;
  isAdmin: boolean;
  onSelect: () => void;
  onActiveToggle: () => void;
  onRuleUpdated: () => void;
  canDelete: boolean;
}

export function RuleCard({ 
  rule, 
  isSelected, 
  isLegacy = false, 
  isAdmin, 
  onSelect, 
  onActiveToggle,
  onRuleUpdated,
  canDelete
}: RuleCardProps) {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleActiveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isAdmin) return;
    
    setToggling(true);
    try {
      const newActiveState = !rule.is_active;
      
      // If turning on, turn off all other rules in the same domain
      if (newActiveState && rule.domain) {
        // First, turn off all other rules in this domain
        const { error: deactivateError } = await supabase
          .from("rules")
          .update({ is_active: false })
          .eq("domain", rule.domain)
          .neq("id", rule.id);
        
        if (deactivateError) throw deactivateError;
      }
      
      // Then toggle this rule
      const { error } = await supabase
        .from("rules")
        .update({ is_active: newActiveState })
        .eq("id", rule.id);
      
      if (error) throw error;
      
      toast.success(newActiveState ? "Rule activated" : "Rule deactivated");
      onActiveToggle();
    } catch (error) {
      console.error("Error toggling rule active state:", error);
      toast.error("Failed to update rule status");
    } finally {
      setToggling(false);
    }
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameDialogOpen(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rule.is_active && canDelete) {
      setDeleteDialogOpen(true);
    }
  };

  return (
    <>
      <div
        className={`
          flex items-center gap-3 p-3 rounded-xl border transition-all
          ${isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-accent/50'}
          ${isLegacy ? 'opacity-75' : ''}
        `}
      >
        <Button
          variant="ghost"
          className="flex-1 justify-start h-auto p-0 hover:bg-transparent"
          onClick={onSelect}
        >
          <div className="flex items-center gap-3 w-full">
            <Layers className="h-4 w-4 flex-shrink-0" />
            <div className="flex-1 text-left min-w-0">
              <div className="font-semibold text-sm truncate">{rule.name}</div>
              <div className="text-xs opacity-80">{rule.domain} domain</div>
            </div>
          </div>
        </Button>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Active toggle */}
          {isAdmin && (
            <div 
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-accent/30 transition-colors cursor-pointer"
              onClick={handleActiveToggle}
            >
              <span className="text-xs font-medium">Active</span>
              <Switch
                checked={rule.is_active}
                disabled={toggling}
                className="scale-75"
              />
            </div>
          )}
          
          {!isAdmin && rule.is_active && (
            <Badge variant="default" className="rounded-full text-xs">
              Active
            </Badge>
          )}
          
          {/* Overflow menu */}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={handleRename}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Rename rule
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  disabled={rule.is_active || !canDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete rule
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <RenameRuleDialog
        ruleId={rule.id}
        currentName={rule.name}
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        onSuccess={onRuleUpdated}
      />

      <DeleteRuleDialog
        ruleId={rule.id}
        ruleName={rule.name}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={onRuleUpdated}
      />
    </>
  );
}
