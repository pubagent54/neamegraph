/**
 * Taxonomy helpers - loads page types and categories from database
 * This is the canonical source for all taxonomy data
 */

import { supabase } from "@/integrations/supabase/client";

export interface PageTypeDefinition {
  id: string;
  label: string;
  description: string | null;
  domain: string;
  sort_order: number;
  active: boolean;
}

export interface CategoryDefinition {
  id: string;
  page_type_id: string;
  label: string;
  description: string | null;
  sort_order: number;
  active: boolean;
}

let cachedPageTypes: PageTypeDefinition[] | null = null;
let cachedCategories: CategoryDefinition[] | null = null;

/**
 * Load all page type definitions from database
 * Results are cached for performance
 */
export async function loadPageTypes(forceRefresh = false): Promise<PageTypeDefinition[]> {
  if (cachedPageTypes && !forceRefresh) {
    return cachedPageTypes;
  }

  const { data, error } = await supabase
    .from("page_type_definitions")
    .select("*")
    .order("sort_order");

  if (error) {
    console.error("Error loading page types:", error);
    return [];
  }

  cachedPageTypes = data || [];
  return cachedPageTypes;
}

/**
 * Load all category definitions from database
 * Results are cached for performance
 */
export async function loadCategories(forceRefresh = false): Promise<CategoryDefinition[]> {
  if (cachedCategories && !forceRefresh) {
    return cachedCategories;
  }

  const { data, error } = await supabase
    .from("page_category_definitions")
    .select("*")
    .order("sort_order");

  if (error) {
    console.error("Error loading categories:", error);
    return [];
  }

  cachedCategories = data || [];
  return cachedCategories;
}

/**
 * Get page types for a specific domain
 */
export async function getPageTypesForDomain(domain: string, activeOnly = true): Promise<PageTypeDefinition[]> {
  const allTypes = await loadPageTypes();
  return allTypes.filter(pt => 
    pt.domain === domain && (!activeOnly || pt.active)
  );
}

/**
 * Get categories for a specific page type
 */
export async function getCategoriesForPageType(pageTypeId: string, activeOnly = true): Promise<CategoryDefinition[]> {
  const allCategories = await loadCategories();
  return allCategories.filter(cat => 
    cat.page_type_id === pageTypeId && (!activeOnly || cat.active)
  );
}

/**
 * Get all domains
 * Always returns the canonical set of domains: Corporate, Beer, Pub
 */
export async function getDomains(): Promise<string[]> {
  // Return canonical domain list regardless of whether page types exist
  // Pub domain is reserved for future use
  return ['Corporate', 'Beer', 'Pub'];
}

/**
 * Clear taxonomy cache - call after updates
 */
export function clearTaxonomyCache() {
  cachedPageTypes = null;
  cachedCategories = null;
}

/**
 * Get display label for a page type ID
 */
export async function getPageTypeLabel(id: string): Promise<string> {
  const pageTypes = await loadPageTypes();
  const type = pageTypes.find(pt => pt.id === id);
  return type?.label || id;
}

/**
 * Get display label for a category ID
 */
export async function getCategoryLabel(id: string): Promise<string> {
  const categories = await loadCategories();
  const category = categories.find(cat => cat.id === id);
  return category?.label || id;
}
