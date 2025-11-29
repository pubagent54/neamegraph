/**
 * Schema Quality Rules Configuration
 * 
 * Distilled from the Schema Quality Charter (docs/schema-quality-charter.md)
 * These rules apply globally to all schema generation (Corporate, Beers, Pubs).
 * 
 * Each flag represents a non-negotiable quality requirement that the schema
 * engine validates post-generation.
 */

export type SchemaQualityRules = {
  /**
   * Every schema graph must include the canonical Organization node
   * (@id: https://www.shepherdneame.co.uk/#organization) and relevant
   * entities must link to it via publisher/manufacturer/parentOrganization.
   */
  mustLinkToCanonicalOrg: boolean;

  /**
   * Every WebPage schema must link to the main Website node via isPartOf
   * (@id: https://www.shepherdneame.co.uk/#website).
   */
  mustLinkToWebsite: boolean;

  /**
   * FAQ schema (FAQPage/Question/Answer nodes) should only be generated
   * when the Q&As are actually visible on-page. No invented FAQs.
   */
  requireVisibleFAQForFAQSchema: boolean;

  /**
   * No invented or unverified data: awards, ratings, prices, service areas,
   * or other facts that are not visible or clearly implied on the page.
   */
  disallowInventedData: boolean;

  /**
   * Entities must use stable, predictable @id patterns (organization, website,
   * webpage, product, pub) without duplication. Same entity = same @id.
   */
  enforceStableIds: boolean;

  /**
   * Each page should have a single clear main entity (via mainEntity/about)
   * rather than multiple competing primary entities.
   */
  oneMainEntityPerPage: boolean;
};

/**
 * Global schema quality rules - currently non-configurable.
 * All flags are enabled by default to ensure consistent quality.
 * 
 * Changes to this config should be reflected in both:
 * - docs/schema-quality-charter.md (human-readable philosophy)
 * - Schema engine validation logic (enforcement)
 */
export const SCHEMA_QUALITY_RULES: SchemaQualityRules = {
  mustLinkToCanonicalOrg: true,
  mustLinkToWebsite: true,
  requireVisibleFAQForFAQSchema: true,
  disallowInventedData: true,
  enforceStableIds: true,
  oneMainEntityPerPage: true,
};

/**
 * Human-readable descriptions for UI display
 */
export const SCHEMA_QUALITY_RULE_DESCRIPTIONS: Record<keyof SchemaQualityRules, string> = {
  mustLinkToCanonicalOrg: "Every schema graph must include the canonical Organization node and link to it.",
  mustLinkToWebsite: "Every WebPage schema must link to the main Website node via isPartOf.",
  requireVisibleFAQForFAQSchema: "FAQ schema is only generated when the Q&As are visible on-page.",
  disallowInventedData: "No invented or unverified awards, ratings, or other facts.",
  enforceStableIds: "Entities use stable, predictable @id patterns without duplication.",
  oneMainEntityPerPage: "Each page has a single clear main entity, not multiple competing ones.",
};
