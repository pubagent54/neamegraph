import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CategoryRow } from "./CategoryRow";
import { Input } from "@/components/ui/input";

interface PageType {
  id: string;
  label: string;
  description: string | null;
  domain: string;
  sort_order: number;
  active: boolean;
}

interface Category {
  id: string;
  page_type_id: string;
  label: string;
  description: string | null;
  sort_order: number;
  active: boolean;
}

interface TaxonomyAccordionProps {
  pageType: PageType;
  categories: Category[];
  showInactive: boolean;
  isAdmin: boolean;
  onUpdatePageType: (id: string, updates: Partial<PageType>) => void;
  onUpdateCategory: (id: string, updates: Partial<Category>) => void;
  onAddCategory: (pageTypeId: string, label: string) => void;
  onDeleteCategory: (id: string) => void;
}

export function TaxonomyAccordion({
  pageType,
  categories,
  showInactive,
  isAdmin,
  onUpdatePageType,
  onUpdateCategory,
  onAddCategory,
  onDeleteCategory
}: TaxonomyAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

  const visibleCategories = showInactive
    ? categories
    : categories.filter(cat => cat.active);

  const handleAddCategory = () => {
    if (newCategoryLabel.trim()) {
      onAddCategory(pageType.id, newCategoryLabel);
      setNewCategoryLabel("");
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <ChevronDown
                className={`h-5 w-5 text-muted-foreground transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{pageType.label}</h3>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {pageType.id}
                  </Badge>
                  {!pageType.active && (
                    <Badge variant="outline" className="text-xs">
                      Inactive
                    </Badge>
                  )}
                </div>
                {pageType.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {pageType.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline">{pageType.domain}</Badge>
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                {visibleCategories.length} {visibleCategories.length === 1 ? 'category' : 'categories'}
              </Badge>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t">
            <div className="p-4 space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-12 gap-3 px-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <div className="col-span-3">Label</div>
                <div className="col-span-3">ID</div>
                <div className="col-span-3">Description</div>
                <div className="col-span-1 text-center">Active</div>
                <div className="col-span-1 text-center">Sort</div>
                <div className="col-span-1"></div>
              </div>

              {/* Category rows */}
              {visibleCategories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No categories yet
                </div>
              ) : (
                visibleCategories.map(category => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    isAdmin={isAdmin}
                    onUpdate={onUpdateCategory}
                    onDelete={onDeleteCategory}
                  />
                ))
              )}

              {/* Add new category */}
              {isAdmin && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      placeholder="New category label..."
                      value={newCategoryLabel}
                      onChange={(e) => setNewCategoryLabel(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                      className="rounded-xl"
                    />
                    <Button
                      size="sm"
                      onClick={handleAddCategory}
                      disabled={!newCategoryLabel.trim()}
                      className="rounded-full"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Category
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
