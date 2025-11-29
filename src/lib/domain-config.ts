/**
 * Domain Configuration for WIZmode v3.1
 * 
 * DEPRECATED: This file is maintained for backward compatibility only.
 * The canonical source for taxonomy data is now in the database:
 * - page_type_definitions table
 * - page_category_definitions table
 * 
 * Use src/lib/taxonomy.ts helpers instead for new code.
 */

import { 
  loadPageTypes, 
  loadCategories, 
  getPageTypesForDomain as getPageTypesForDomainDB,
  getCategoriesForPageType as getCategoriesForPageTypeDB,
} from "./taxonomy";

export interface DomainConfig {
  domains: string[];
  pageTypesByDomain: Record<string, string[]>;
  categoriesByPageType: Record<string, string[]>;
}

/**
 * @deprecated Use loadPageTypes() from taxonomy.ts instead
 * Legacy sync config - kept for backward compatibility
 */
export const DOMAIN_CONFIG: DomainConfig = {
  domains: ['Corporate', 'Beer', 'Pub'],
  
  pageTypesByDomain: {
    'Corporate': ['about', 'history', 'environment', 'careers', 'news', 'brewery'],
    'Beer': ['beers'],
    'Pub': ['pubs_hotels_estate'],
  },
  
  categoriesByPageType: {
    'about': ['General', 'Legal', 'Direct to Trade'],
    'history': ['History'],
    'environment': ['Sustainability', 'Community'],
    'careers': ['Working for Shepherd Neame', 'Pub Tenancies'],
    'news': ['Pubs & Hotels', 'Community', 'Beer and Drink Brands'],
    'brewery': ['Brewing Process', 'Visitors Centre'],
    'beers': ['Drink Brands', 'Collection Page'],
    'pubs_hotels_estate': ['About', 'Collection Page'],
  },
};

/**
 * Normalize a path to consistent format
 * Same logic used throughout the app
 */
export function normalizePath(path: string): string {
  let normalized = path.trim();
  
  // Strip protocol and domain if present (handle full URLs)
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    try {
      const url = new URL(normalized);
      normalized = url.pathname;
    } catch {
      // If URL parsing fails, just proceed with the string
    }
  }
  
  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  
  // Remove trailing slash (except for root)
  if (normalized !== '/' && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  
  // Convert to lowercase
  return normalized.toLowerCase();
}

/**
 * Get page types for a given domain
 * @deprecated Use getPageTypesForDomain from taxonomy.ts instead for async loading from database
 * This function returns hard-coded values and is kept only for backward compatibility
 */
export function getPageTypesForDomain(domain: string | null): string[] {
  if (!domain) return [];
  return DOMAIN_CONFIG.pageTypesByDomain[domain] || [];
}

/**
 * Get categories for a given page type
 * @deprecated Use getCategoriesForPageType from taxonomy.ts instead for async loading from database
 * This function returns hard-coded values and is kept only for backward compatibility
 */
export function getCategoriesForPageType(pageType: string | null): string[] {
  if (!pageType) return [];
  return DOMAIN_CONFIG.categoriesByPageType[pageType] || [];
}

/**
 * Async version that loads from database
 */
export async function getPageTypesForDomainAsync(domain: string | null): Promise<string[]> {
  if (!domain) return [];
  const types = await getPageTypesForDomainDB(domain, true);
  return types.map(t => t.id);
}

/**
 * Async version that loads from database
 */
export async function getCategoriesForPageTypeAsync(pageType: string | null): Promise<string[]> {
  if (!pageType) return [];
  const categories = await getCategoriesForPageTypeDB(pageType, true);
  return categories.map(c => c.label);
}

/**
 * Normalization maps for CSV parsing (backward compatibility)
 */
export const DOMAIN_NORMALIZATION_MAP: Record<string, string> = {
  'corporate': 'Corporate',
  'beer': 'Beer',
  'pub': 'Pub',
};

export const PAGE_TYPE_NORMALIZATION_MAP: Record<string, string> = {
  'about': 'About',
  'history': 'History',
  'environment': 'Environment',
  'careers': 'Careers',
  'news': 'News',
  'beers': 'Beers',
  'brewery': 'Brewery',
  'pubs & hotels estate': 'Pubs & Hotels Estate',
};

export const CATEGORY_NORMALIZATION_MAP: Record<string, string> = {
  'general': 'General',
  'legal': 'Legal',
  'direct to trade': 'Direct to Trade',
  'history': 'History',
  'sustainability': 'Sustainability',
  'community': 'Community',
  'working for shepherd neame': 'Working for Shepherd Neame',
  'pub tenancies': 'Pub Tenancies',
  'pubs & hotels': 'Pubs & Hotels',
  'beer and drink brands': 'Beer and Drink Brands',
  'brewing process': 'Brewing Process',
  'visitors centre': 'Visitors Centre',
  'drink brands': 'Drink Brands',
  'collection page': 'Collection Page',
  'about': 'About',
};
