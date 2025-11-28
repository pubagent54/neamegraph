/**
 * Domain Configuration for WIZmode v3.1
 * Defines the hierarchical relationship between domains, page types, and categories
 */

export interface DomainConfig {
  domains: string[];
  pageTypesByDomain: Record<string, string[]>;
  categoriesByPageType: Record<string, string[]>;
}

export const DOMAIN_CONFIG: DomainConfig = {
  domains: ['Corporate', 'Beer', 'Pub'],
  
  pageTypesByDomain: {
    'Corporate': [
      'About',
      'History',
      'Environment',
      'Careers',
      'News',
      'Brewery',
    ],
    'Beer': [
      'Beers',
    ],
    'Pub': [
      'Pubs & Hotels Estate',
    ],
  },
  
  categoriesByPageType: {
    // Corporate page types
    'About': ['General', 'Legal', 'Direct to Trade'],
    'History': ['History'],
    'Environment': ['Sustainability', 'Community'],
    'Careers': ['Working for Shepherd Neame', 'Pub Tenancies'],
    'News': ['Pubs & Hotels', 'Community', 'Beer and Drink Brands'],
    'Brewery': ['Brewing Process', 'Visitors Centre'],
    
    // Beer page types
    'Beers': ['Drink Brands', 'Collection Page'],
    
    // Pub page types
    'Pubs & Hotels Estate': ['About', 'Collection Page'],
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
 */
export function getPageTypesForDomain(domain: string | null): string[] {
  if (!domain) return [];
  return DOMAIN_CONFIG.pageTypesByDomain[domain] || [];
}

/**
 * Get categories for a given page type
 */
export function getCategoriesForPageType(pageType: string | null): string[] {
  if (!pageType) return [];
  return DOMAIN_CONFIG.categoriesByPageType[pageType] || [];
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
