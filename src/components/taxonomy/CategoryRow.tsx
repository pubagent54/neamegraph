import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Category {
  id: string;
  page_type_id: string;
  label: string;
  description: string | null;
  sort_order: number;
  active: boolean;
}

interface CategoryRowProps {
  category: Category;
  isAdmin: boolean;
  onUpdate: (id: string, updates: Partial<Category>) => void;
  onDelete: (id: string) => void;
}

export function CategoryRow({ category, isAdmin, onUpdate, onDelete }: CategoryRowProps) {
  const [editedLabel, setEditedLabel] = useState(category.label);
  const [editedDescription, setEditedDescription] = useState(category.description || "");
  const [editedSortOrder, setEditedSortOrder] = useState(category.sort_order.toString());

  const handleBlur = (field: keyof Category, value: any) => {
    if (field === "sort_order") {
      const numValue = parseInt(value) || 0;
      if (numValue !== category.sort_order) {
        onUpdate(category.id, { [field]: numValue });
      }
    } else if (value !== category[field]) {
      onUpdate(category.id, { [field]: value || null });
    }
  };

  return (
    <div className="grid grid-cols-12 gap-3 items-center p-3 rounded-xl hover:bg-muted/30 transition-colors">
      <div className="col-span-3">
        <Input
          value={editedLabel}
          onChange={(e) => setEditedLabel(e.target.value)}
          onBlur={() => handleBlur("label", editedLabel)}
          disabled={!isAdmin}
          className="h-9 rounded-lg"
        />
      </div>

      <div className="col-span-3">
        <code className="text-xs bg-muted px-2 py-1 rounded">
          {category.id}
        </code>
      </div>

      <div className="col-span-3">
        <Input
          value={editedDescription}
          onChange={(e) => setEditedDescription(e.target.value)}
          onBlur={() => handleBlur("description", editedDescription)}
          placeholder="Optional description..."
          disabled={!isAdmin}
          className="h-9 rounded-lg text-sm"
        />
      </div>

      <div className="col-span-1 flex justify-center">
        <Switch
          checked={category.active}
          onCheckedChange={(checked) => onUpdate(category.id, { active: checked })}
          disabled={!isAdmin}
        />
      </div>

      <div className="col-span-1">
        <Input
          type="number"
          value={editedSortOrder}
          onChange={(e) => setEditedSortOrder(e.target.value)}
          onBlur={() => handleBlur("sort_order", editedSortOrder)}
          disabled={!isAdmin}
          className="h-9 rounded-lg text-center"
        />
      </div>

      <div className="col-span-1 flex justify-end">
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete category?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete <strong>{category.label}</strong> ({category.id}).
                  Pages using this category will need to be updated manually.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(category.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
