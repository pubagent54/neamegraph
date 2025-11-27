/**
 * Frontend helper to understand v2 rules structure
 * Note: The actual rules loading happens in the edge function
 */

// Categories for each page type
export const V2_CATEGORIES: Record<string, string[]> = {
  'Pubs & Hotels Estate': ['Estate Overview', 'Pub Finder', 'Individual Pubs'],
  'Beers': ['Beer Brands', 'Beer Collections', 'Brewing Process'],
  'Brewery': ['Brewery History', 'Brewing Process', 'Facilities'],
  'History': ['Company History', 'Heritage', 'Timeline'],
  'Environment': ['Sustainability', 'Community', 'Initiatives'],
  'About': ['General', 'Company Info', 'Leadership'],
  'Careers': ['Jobs', 'Culture', 'Benefits'],
  'News': ['Press Releases', 'Blog Posts', 'Updates'],
};
