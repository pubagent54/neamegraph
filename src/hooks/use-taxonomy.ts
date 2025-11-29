/**
 * React hooks for accessing taxonomy data from database
 */

import { useEffect, useState } from "react";
import {
  loadPageTypes,
  loadCategories,
  getPageTypesForDomain,
  getCategoriesForPageType,
  getDomains,
  clearTaxonomyCache,
  type PageTypeDefinition,
  type CategoryDefinition
} from "@/lib/taxonomy";

/**
 * Load all page type definitions
 */
export function usePageTypes(forceRefresh = false) {
  const [pageTypes, setPageTypes] = useState<PageTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadPageTypes(forceRefresh)
      .then(setPageTypes)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [forceRefresh]);

  return { pageTypes, loading, error };
}

/**
 * Load all category definitions
 */
export function useCategories(forceRefresh = false) {
  const [categories, setCategories] = useState<CategoryDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadCategories(forceRefresh)
      .then(setCategories)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [forceRefresh]);

  return { categories, loading, error };
}

/**
 * Load page types for a specific domain
 */
export function usePageTypesForDomain(domain: string | null, activeOnly = true) {
  const [pageTypes, setPageTypes] = useState<PageTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!domain) {
      setPageTypes([]);
      setLoading(false);
      return;
    }

    getPageTypesForDomain(domain, activeOnly)
      .then(setPageTypes)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [domain, activeOnly]);

  return { pageTypes, loading, error };
}

/**
 * Load categories for a specific page type
 */
export function useCategoriesForPageType(pageTypeId: string | null, activeOnly = true) {
  const [categories, setCategories] = useState<CategoryDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!pageTypeId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    getCategoriesForPageType(pageTypeId, activeOnly)
      .then(setCategories)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [pageTypeId, activeOnly]);

  return { categories, loading, error };
}

/**
 * Load all domains
 */
export function useDomains() {
  const [domains, setDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getDomains()
      .then(setDomains)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { domains, loading, error };
}

/**
 * Hook to refresh taxonomy cache
 * Call this after making changes to taxonomy in the database
 */
export function useTaxonomyRefresh() {
  return {
    refresh: () => {
      clearTaxonomyCache();
    }
  };
}
