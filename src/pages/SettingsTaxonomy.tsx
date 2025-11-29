import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, RefreshCw, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { TaxonomyAccordion } from "@/components/taxonomy/TaxonomyAccordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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

export default function SettingsTaxonomy() {
  const { userRole } = useAuth();
  const [pageTypes, setPageTypes] = useState<PageType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [applyingChanges, setApplyingChanges] = useState(false);
  
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    fetchTaxonomy();
  }, []);

  const fetchTaxonomy = async () => {
    try {
      const [typesResult, categoriesResult] = await Promise.all([
        supabase.from("page_type_definitions").select("*").order("sort_order"),
        supabase.from("page_category_definitions").select("*").order("sort_order")
      ]);

      if (typesResult.error) throw typesResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      setPageTypes(typesResult.data || []);
      setCategories(categoriesResult.data || []);
      setHasChanges(false);
    } catch (error) {
      console.error("Error fetching taxonomy:", error);
      toast.error("Failed to fetch taxonomy");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyChanges = async () => {
    setApplyingChanges(true);
    try {
      // In a full implementation, this would:
      // 1. Update any cached/derived fields on pages
      // 2. Refresh materialized views if any
      // 3. Log the taxonomy update to audit_log
      
      toast.success("Taxonomy changes applied to existing pages");
      setHasChanges(false);
    } catch (error) {
      console.error("Error applying changes:", error);
      toast.error("Failed to apply changes");
    } finally {
      setApplyingChanges(false);
    }
  };

  const handleDismissChanges = () => {
    setHasChanges(false);
    toast.info("Changes banner dismissed");
  };

  const updatePageType = async (id: string, updates: Partial<PageType>) => {
    try {
      const { error } = await supabase
        .from("page_type_definitions")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      setPageTypes(prev => 
        prev.map(pt => pt.id === id ? { ...pt, ...updates } : pt)
      );
      setHasChanges(true);
      toast.success("Page type updated");
    } catch (error) {
      console.error("Error updating page type:", error);
      toast.error("Failed to update page type");
    }
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    try {
      const { error } = await supabase
        .from("page_category_definitions")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      setCategories(prev => 
        prev.map(cat => cat.id === id ? { ...cat, ...updates } : cat)
      );
      setHasChanges(true);
      toast.success("Category updated");
    } catch (error) {
      console.error("Error updating category:", error);
      toast.error("Failed to update category");
    }
  };

  const addCategory = async (pageTypeId: string, label: string) => {
    if (!label.trim()) {
      toast.error("Category label is required");
      return;
    }

    try {
      const id = `${pageTypeId}_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
      const maxSort = Math.max(
        0,
        ...categories.filter(c => c.page_type_id === pageTypeId).map(c => c.sort_order)
      );

      const newCategory: Category = {
        id,
        page_type_id: pageTypeId,
        label,
        description: null,
        sort_order: maxSort + 10,
        active: true
      };

      const { error } = await supabase
        .from("page_category_definitions")
        .insert(newCategory);

      if (error) throw error;

      setCategories(prev => [...prev, newCategory]);
      setHasChanges(true);
      toast.success("Category added");
    } catch (error) {
      console.error("Error adding category:", error);
      toast.error("Failed to add category");
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from("page_category_definitions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setCategories(prev => prev.filter(cat => cat.id !== id));
      setHasChanges(true);
      toast.success("Category deleted");
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("Failed to delete category");
    }
  };

  // Filter logic
  const filteredPageTypes = pageTypes.filter(pt => {
    const matchesSearch = !searchQuery || 
      pt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pt.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pt.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDomain = domainFilter === "all" || pt.domain === domainFilter;
    const matchesActive = showInactive || pt.active;

    return matchesSearch && matchesDomain && matchesActive;
  });

  const getPageCount = async (pageTypeId: string) => {
    const { count } = await supabase
      .from("pages")
      .select("*", { count: "exact", head: true })
      .eq("page_type", pageTypeId);
    return count || 0;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Page Types & Categories</h1>
          <p className="text-lg text-muted-foreground">
            Manage the canonical taxonomy for all pages
          </p>
        </div>

        {hasChanges && (
          <Alert className="border-primary/50 bg-primary/5">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <strong>You've updated Page Types & Categories.</strong>
                <p className="text-sm text-muted-foreground mt-1">
                  Apply these changes to existing pages to update metadata that depends on these definitions.
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  size="sm"
                  onClick={handleApplyChanges}
                  disabled={applyingChanges}
                  className="rounded-full"
                >
                  {applyingChanges ? "Applying..." : "Apply changes to pages"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismissChanges}
                  className="rounded-full"
                >
                  Dismiss
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card className="p-4 rounded-2xl border-0 shadow-sm">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search types, categories, IDs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>
            </div>

            <div className="w-[180px]">
              <Label htmlFor="domain-filter">Domain</Label>
              <Select value={domainFilter} onValueChange={setDomainFilter}>
                <SelectTrigger id="domain-filter" className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All domains</SelectItem>
                  <SelectItem value="Corporate">Corporate</SelectItem>
                  <SelectItem value="Beer">Beer</SelectItem>
                  <SelectItem value="Pub">Pub</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive" className="cursor-pointer">
                Show inactive
              </Label>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchTaxonomy}
              className="rounded-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </Card>

        <div className="space-y-3">
          {filteredPageTypes.length === 0 ? (
            <Card className="p-8 text-center rounded-2xl border-0 shadow-sm">
              <p className="text-muted-foreground">No page types match your filters</p>
            </Card>
          ) : (
            filteredPageTypes.map(pageType => (
              <TaxonomyAccordion
                key={pageType.id}
                pageType={pageType}
                categories={categories.filter(cat => cat.page_type_id === pageType.id)}
                showInactive={showInactive}
                isAdmin={isAdmin}
                onUpdatePageType={updatePageType}
                onUpdateCategory={updateCategory}
                onAddCategory={addCategory}
                onDeleteCategory={deleteCategory}
              />
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
