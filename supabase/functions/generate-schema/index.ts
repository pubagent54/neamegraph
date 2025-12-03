import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

/**
 * Beer Image Extraction Utility
 *
 * Extracts hero images and logos from beer page HTML, handling Next.js image URLs.
 * Priority logic:
 * - Hero: og:image with /styles/page_hero/, then any img with page_hero, then beer name match
 * - Logo: filename contains both beer name and "logo", then just "logo" or "pumpclip"
 */
interface BeerImages {
  heroImageUrl?: string;
  logoImageUrl?: string;
}

function extractBeerImagesFromHtml(html: string, beerName: string, beerSlug?: string): BeerImages {
  const canonicalBase = "https://www.shepherdneame.co.uk";
  const result: BeerImages = {};

  // Normalize beer name for matching (e.g., "1698" or "Spitfire")
  const beerNameLower = beerName.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Beer slug is the URL-friendly version (e.g., "double-stout", "1698")
  const beerSlugLower = (beerSlug || beerName)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  // Also create underscore version for filename matching
  const beerSlugUnderscore = beerSlugLower.replace(/-/g, "_");

  console.log(
    `[Beer Image Extraction] Starting extraction for beer: "${beerName}" (normalized: "${beerNameLower}", slug: "${beerSlugLower}")`,
  );

  // Helper: Normalize a URL and extract the inner URL if it's a Next.js image wrapper
  // Returns isNextJs flag to help prioritize these URLs
  interface NormalizedUrl {
    fullUrl: string;
    innerUrl: string;
    isNextJs: boolean;
  }

  function normaliseUrl(raw: string): NormalizedUrl {
    try {
      const url = new URL(raw, canonicalBase);

      // Check if this is a Next.js image wrapper URL
      if (url.pathname === "/_next/image") {
        const inner = url.searchParams.get("url");
        if (inner) {
          const decoded = decodeURIComponent(inner);
          console.log(`[Beer Image Extraction] Next.js image URL found - inner: ${decoded.substring(0, 80)}...`);
          return {
            fullUrl: url.toString(),
            innerUrl: decoded,
            isNextJs: true,
          };
        }
      }

      return { fullUrl: url.toString(), innerUrl: url.toString(), isNextJs: false };
    } catch {
      return { fullUrl: raw, innerUrl: raw, isNextJs: false };
    }
  }

  // Helper: Check if URL matches hero patterns (in the innerUrl for matching)
  function isHeroCandidate(innerUrl: string): boolean {
    const lower = innerUrl.toLowerCase();
    return (
      lower.includes("/styles/page_hero/") ||
      lower.includes("page_hero") ||
      lower.includes("/styles/hero_") ||
      lower.includes("hero_")
    );
  }

  // Helper: Check if URL matches logo patterns (in the innerUrl for matching)
  function isLogoCandidate(innerUrl: string): boolean {
    const lower = innerUrl.toLowerCase();
    // Extract filename from path
    const filename = lower.split("/").pop() || "";
    return (
      filename.includes("logo") ||
      filename.includes("lockup") ||
      filename.includes("pumpclip") ||
      filename.includes("badge") ||
      filename.includes("roundel")
    );
  }

  // Helper: Check if URL or alt text contains the CURRENT beer's name/slug
  function containsBeerName(innerUrl: string, alt?: string): boolean {
    if (!beerNameLower && !beerSlugLower) return false;
    const urlLower = innerUrl.toLowerCase();
    const altLower = (alt || "").toLowerCase();

    // Check URL for beer name/slug matches
    const urlNormalized = urlLower.replace(/[^a-z0-9]/g, "");
    if (urlNormalized.includes(beerNameLower)) return true;
    if (urlLower.includes(beerSlugLower)) return true;
    if (urlLower.includes(beerSlugUnderscore)) return true;

    // Check alt text for beer name match
    const altNormalized = altLower.replace(/[^a-z0-9]/g, "");
    if (altNormalized.includes(beerNameLower)) return true;
    if (altLower.includes(beerSlugLower)) return true;

    return false;
  }

  // Helper: Check if image is inside a "related beers" section
  // These sections show other beers (e.g., "The Classic collection" strip)
  function isInRelatedBeersSection(imgElement: any): boolean {
    // Walk up the DOM tree looking for container sections that indicate "other beers"
    let parent = imgElement.parentElement;
    let depth = 0;
    const maxDepth = 10; // Don't walk too far up

    while (parent && depth < maxDepth) {
      const tagName = parent.tagName?.toLowerCase() || "";
      const className = (parent.getAttribute?.("class") || "").toLowerCase();
      const id = (parent.getAttribute?.("id") || "").toLowerCase();

      // Look for headings within this section that indicate related beers
      const headings = parent.querySelectorAll?.("h2, h3, h4");
      if (headings) {
        for (const h of headings) {
          const headingText = (h.textContent || "").toLowerCase();
          // Patterns for related beers sections
          if (
            headingText.includes("collection") ||
            headingText.includes("you might also like") ||
            headingText.includes("other beers") ||
            headingText.includes("related beers") ||
            headingText.includes("more beers") ||
            headingText.includes("discover more")
          ) {
            return true;
          }
        }
      }

      // Check class/id for carousel, slider, related section patterns
      if (
        className.includes("carousel") ||
        className.includes("slider") ||
        className.includes("related") ||
        className.includes("collection-strip") ||
        className.includes("beer-grid") ||
        className.includes("other-beers") ||
        id.includes("related") ||
        id.includes("collection")
      ) {
        return true;
      }

      parent = parent.parentElement;
      depth++;
    }

    return false;
  }

  // Helper: Check if this is a known-bad pattern to exclude
  // CRITICAL: These are zombie URLs that 404 on the live site
  function isKnownBadPattern(innerUrl: string, isNextJs: boolean): boolean {
    const lower = innerUrl.toLowerCase();

    // HARD BAN: Legacy theme-based beer images - these ALL 404
    if (lower.includes("/themes/custom/shepherdneame/images/beers/")) {
      console.log(`[Beer Image Extraction] ZOMBIE: Legacy theme path excluded: ${lower.substring(0, 80)}...`);
      return true;
    }

    // HARD BAN: Old d8-era zombie paths known to 404 (like 1698_Bottle_0.png, 1698_Lockup_0.png)
    if (lower.includes("/sites/default/files/styles/d8/public/image/")) {
      console.log(`[Beer Image Extraction] ZOMBIE: d8 style image path excluded: ${lower.substring(0, 80)}...`);
      return true;
    }
    if (lower.includes("/sites/default/files/image/2023-03/")) {
      console.log(`[Beer Image Extraction] ZOMBIE: Old 2023-03 image path excluded: ${lower.substring(0, 80)}...`);
      return true;
    }

    // Old wysiwyg paths that are always dead
    if (lower.includes("/styles/sn_wysiwyg_full_width/") || lower.includes("/styles/sn_wysiwyg_")) {
      return true;
    }

    // SVG sprites, icons, social logos etc - never useful for beer images
    if (
      lower.includes("sprite") ||
      lower.includes("favicon") ||
      lower.includes("icon-") ||
      lower.includes("logo-sheps") ||
      lower.includes("/icons/")
    ) {
      return true;
    }

    // CRITICAL: Direct shepherdneame.co.uk /sites/default/files/ paths that are NOT wrapped in _next/image
    // These old Drupal paths often 404 now that the site uses Next.js image optimization
    // Only flag as bad if it's NOT a Next.js wrapped URL AND it's on shepherdneame.co.uk (not snsites.co.uk)
    if (!isNextJs && lower.includes("shepherdneame.co.uk/sites/default/files/")) {
      console.log(
        `[Beer Image Extraction] ZOMBIE: Direct SN Drupal path (not via Next.js): ${lower.substring(0, 80)}...`,
      );
      return true;
    }

    return false;
  }

  // Helper: Check if filename looks like a bottle/pack shot
  function isBottleCandidate(innerUrl: string): boolean {
    const lower = innerUrl.toLowerCase();
    const filename = lower.split("/").pop() || "";
    return (
      (filename.includes("bottle") || filename.includes("pack") || filename.includes("can")) &&
      containsBeerName(innerUrl)
    );
  }

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) {
      console.log("[Beer Image Extraction] Failed to parse HTML");
      return result;
    }

    // Collect all candidate images with scoring
    interface ImageCandidate {
      fullUrl: string;
      innerUrl: string;
      isNextJs: boolean;
      source: "og" | "twitter" | "img" | "link";
      alt?: string; // alt text for img tags
      isInRelatedSection?: boolean; // true if from a "related beers" section
    }

    // Helper: Determine the schema-safe URL for a beer image candidate
    // Rule: If it's a Next.js URL with an inner snsites.co.uk CMS asset, use the inner URL
    // This gives us canonical, CDN-served URLs that don't 404
    const getSchemaImageUrl = (candidate: ImageCandidate): string => {
      const inner = candidate.innerUrl || "";

      // Prefer canonical CMS URLs on snsites.co.uk - these are the real CDN-served assets
      if (candidate.isNextJs && inner.startsWith("https://snsites.co.uk/sites/default/files/")) {
        console.log(`[Beer Image Extraction] → Using canonical snsites.co.uk URL: ${inner.substring(0, 100)}...`);
        return inner;
      }

      // Also accept direct snsites.co.uk URLs (not wrapped in Next.js)
      if (inner.startsWith("https://snsites.co.uk/sites/default/files/")) {
        console.log(`[Beer Image Extraction] → Using direct snsites.co.uk URL: ${inner.substring(0, 100)}...`);
        return inner;
      }

      // Fallback: whatever the browser actually uses (but this may be a wrapper URL)
      console.log(`[Beer Image Extraction] → Fallback to fullUrl: ${candidate.fullUrl.substring(0, 100)}...`);
      return candidate.fullUrl;
    };

    const candidates: ImageCandidate[] = [];

    // 1. og:image meta tag (highest priority source)
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage) {
      const content = ogImage.getAttribute("content");
      if (content) {
        const normalized = normaliseUrl(content);
        candidates.push({ ...normalized, source: "og" });
        console.log(
          `[Beer Image Extraction] Found og:image: ${normalized.fullUrl.substring(0, 80)}... (isNextJs: ${normalized.isNextJs})`,
        );
      }
    }

    // 2. twitter:image meta tag
    const twitterImage = doc.querySelector('meta[name="twitter:image"]');
    if (twitterImage) {
      const content = twitterImage.getAttribute("content");
      if (content) {
        const normalized = normaliseUrl(content);
        candidates.push({ ...normalized, source: "twitter" });
      }
    }

    // 3. img tags in main content (filter out related beers sections)
    const imgTags = doc.querySelectorAll("img");
    imgTags.forEach((img: any) => {
      const src = img.getAttribute("src") || img.getAttribute("data-src");
      if (src && !src.startsWith("data:")) {
        const normalized = normaliseUrl(src);
        const alt = img.getAttribute("alt") || "";
        const isRelated = isInRelatedBeersSection(img);

        candidates.push({
          ...normalized,
          source: "img",
          alt,
          isInRelatedSection: isRelated,
        });

        if (isRelated && isLogoCandidate(normalized.innerUrl)) {
          console.log(
            `[Beer Image Extraction] Skipping logo from related section: ${normalized.innerUrl.substring(0, 60)}...`,
          );
        }
      }
    });

    console.log(`[Beer Image Extraction] Found ${candidates.length} total image candidates`);

    // Filter out known-bad patterns
    const validCandidates = candidates.filter((c) => !isKnownBadPattern(c.innerUrl, c.isNextJs));
    console.log(`[Beer Image Extraction] After filtering bad patterns: ${validCandidates.length} valid candidates`);

    // =====================
    // CANDIDATE POOL SELECTION (snsites first)
    // =====================
    // Prefer canonical Drupal/CDN assets on snsites.co.uk. These are the real
    // images we want in schema. If we find any candidates whose innerUrl
    // points at snsites, we do *all* hero/logo selection only from that pool.
    //
    // If there are no snsites assets on the page, we fall back to the
    // existing sortedCandidates behaviour so other beers still get images.

    const snsitesCandidates = validCandidates.filter((c) => {
      const u = (c.innerUrl || c.fullUrl || "").toLowerCase();
      return u.includes("snsites.co.uk/sites/default/files/");
    });

    // Sort candidates to prefer Next.js URLs and og:image, as before
    const sortedCandidates = [...validCandidates].sort((a, b) => {
      if (a.isNextJs && !b.isNextJs) return -1;
      if (!a.isNextJs && b.isNextJs) return 1;
      if (a.source === "og" && b.source !== "og") return -1;
      if (a.source !== "og" && b.source === "og") return 1;
      return 0;
    });

    const candidatePool = snsitesCandidates.length > 0 ? snsitesCandidates : sortedCandidates;

    console.log(
      `[Beer Image Extraction] Using ${snsitesCandidates.length > 0 ? "snsites-only" : "all"} candidate pool for hero/logo selection (snsites=${snsitesCandidates.length})`,
    );

    // =====================
    // HERO IMAGE SELECTION
    // =====================
    // Priority (within each level, prefer Next.js URLs):
    // 1. og:image where inner URL includes page_hero (BEST)
    // 2. Any Next.js URL where inner URL includes page_hero
    // 3. Any candidate where inner URL includes page_hero
    // 4. Next.js URL with beer name match
    // 5. Any URL with beer name match
    // 6. Bottle/pack shot with beer name
    // 7. Fallback: any og:image

    let heroCandidate = candidatePool.find((c) => c.source === "og" && isHeroCandidate(c.innerUrl));

    if (!heroCandidate) {
      heroCandidate = candidatePool.find((c) => c.isNextJs && isHeroCandidate(c.innerUrl));
    }

    if (!heroCandidate) {
      heroCandidate = candidatePool.find((c) => isHeroCandidate(c.innerUrl));
    }

    if (!heroCandidate) {
      heroCandidate = candidatePool.find((c) => c.isNextJs && containsBeerName(c.innerUrl));
    }

    if (!heroCandidate) {
      heroCandidate = candidatePool.find((c) => containsBeerName(c.innerUrl));
    }

    if (!heroCandidate) {
      heroCandidate = candidatePool.find((c) => isBottleCandidate(c.innerUrl));
    }

    if (!heroCandidate) {
      // Final fallback: any og:image from the current pool
      heroCandidate = candidatePool.find((c) => c.source === "og");
    }

    if (heroCandidate) {
      const schemaUrl = getSchemaImageUrl(heroCandidate);
      result.heroImageUrl = schemaUrl;
      console.log(
        `[Beer Image Extraction] ✓ Selected hero: source=${heroCandidate.source}, isNextJs=${heroCandidate.isNextJs}`,
      );
      console.log(`[Beer Image Extraction]   innerUrl: ${heroCandidate.innerUrl.substring(0, 120)}...`);
      console.log(`[Beer Image Extraction]   schemaUrl: ${schemaUrl.substring(0, 120)}...`);
    } else {
      console.log("[Beer Image Extraction] ✗ No hero image found");
    }

    // =====================
    // LOGO IMAGE SELECTION (REFINED)
    // =====================
    // CRITICAL: Only select logos that belong to THIS beer, not "related beers"
    // Priority (within each level, prefer Next.js URLs):
    // 1. Logo with beer name in URL/alt AND NOT in related section (best case)
    // 2. Logo with beer name in URL/alt from ANY location (beer-specific badge trumps generic logo)
    // 3. Logo pattern NOT in related section (generic logo fallback)
    // 4. Fallback: any logo pattern (last resort)

    // Filter candidates for logo selection - exclude related beers section for primary picks
    const mainContentLogoCandidates = candidatePool.filter((c) => !c.isInRelatedSection);

    // 1. Best: Logo with beer name match, in main content area
    let logoCandidate = mainContentLogoCandidates.find(
      (c) => c.isNextJs && containsBeerName(c.innerUrl, c.alt) && isLogoCandidate(c.innerUrl),
    );

    if (!logoCandidate) {
      logoCandidate = mainContentLogoCandidates.find(
        (c) => containsBeerName(c.innerUrl, c.alt) && isLogoCandidate(c.innerUrl),
      );
    }

    // 2. Beer name match from ANY location (even related section) - beer-specific badge always beats generic logo
    if (!logoCandidate) {
      logoCandidate = candidatePool.find(
        (c) => c.isNextJs && containsBeerName(c.innerUrl, c.alt) && isLogoCandidate(c.innerUrl),
      );
    }

    if (!logoCandidate) {
      logoCandidate = candidatePool.find((c) => containsBeerName(c.innerUrl, c.alt) && isLogoCandidate(c.innerUrl));
    }

    // 3. Generic logo pattern in main content (no beer name match, but at least not from related section)
    if (!logoCandidate) {
      logoCandidate = mainContentLogoCandidates.find((c) => c.isNextJs && isLogoCandidate(c.innerUrl));
    }

    if (!logoCandidate) {
      logoCandidate = mainContentLogoCandidates.find((c) => isLogoCandidate(c.innerUrl));
    }

    if (logoCandidate) {
      const schemaUrl = getSchemaImageUrl(logoCandidate);
      result.logoImageUrl = schemaUrl;
      console.log(
        `[Beer Logo Selection] ✓ Selected logo: source=${logoCandidate.source}, isNextJs=${logoCandidate.isNextJs}, inRelated=${logoCandidate.isInRelatedSection || false}`,
      );
      console.log(
        `[Beer Logo Selection]   path=${beerSlugLower}, beerSlug=${beerSlugLower}, logoSrc=${schemaUrl.substring(0, 100)}`,
      );
      console.log(`[Beer Image Extraction]   innerUrl: ${logoCandidate.innerUrl.substring(0, 120)}...`);
      console.log(`[Beer Image Extraction]   schemaUrl: ${schemaUrl.substring(0, 120)}...`);
    } else {
      console.log("[Beer Image Extraction] ✗ No logo image found (this is OK - not all beers have logos in page)");
    }

    console.log(
      `[Beer Image Extraction] Complete for "${beerName}": hero=${result.heroImageUrl ? "✓" : "✗"}, logo=${result.logoImageUrl ? "✓" : "✗"}`,
    );
  } catch (err) {
    console.error("[Beer Image Extraction] Error:", err);
  }

  return result;
}

/**
 * Canonical Shepherd Neame Organization configuration
 *
 * MASTER LOCKER: These constants are the single source of truth for
 * Organization and WebSite nodes across ALL schema generation.
 */
const ORG_ID = "https://www.shepherdneame.co.uk/#organization";
const ORG_URL = "https://www.shepherdneame.co.uk";
const ORG_LOGO_URL = "https://www.shepherdneame.co.uk/sites/default/files/shepherd-neame-logo-square-1024.png";

// Canonical master Organization node ("locker" schema)
const MASTER_ORG_NODE: any = {
  "@type": ["Organization", "Corporation"],
  "@id": "https://www.shepherdneame.co.uk/#organization",
  "name": "Shepherd Neame Limited",
  "url": "https://www.shepherdneame.co.uk",
  "description": "Shepherd Neame is an independent family brewer, pub and hotel operator based in Faversham, Kent, widely recognised as Britain's oldest brewer.",
  "foundingDate": "1698",
  "foundingLocation": {
    "@type": "Place",
    "name": "Faversham, Kent, UK"
  },
  "slogan": "Britain's Oldest Brewer",
  "logo": {
    "@id": "https://www.shepherdneame.co.uk/#logo"
  },
  "image": {
    "@id": "https://www.shepherdneame.co.uk/#logo"
  },
  "address": {
    "@id": "https://www.shepherdneame.co.uk/#org-address"
  },
  "telephone": "+44 1795 532206",
  "email": "company@shepherd-neame.co.uk",
  "leiCode": "2138005EBUHGVOACDX31",
  "identifier": [
    {
      "@type": "PropertyValue",
      "propertyID": "Companies House",
      "value": "00138256",
      "url": "https://find-and-update.company-information.service.gov.uk/company/00138256"
    },
    {
      "@type": "PropertyValue",
      "propertyID": "AQSE Ticker",
      "value": "SHEP",
      "url": "https://www.aquis.eu/companies/shepherd-neame"
    }
  ],
  "tickerSymbol": "AQSE:SHEP",
  "sameAs": [
    "https://www.wikidata.org/wiki/Q12002324",
    "https://en.wikipedia.org/wiki/Shepherd_Neame_Brewery",
    "https://www.linkedin.com/company/shepherd-neame/",
    "https://www.facebook.com/ShepherdNeame",
    "https://twitter.com/shepherdneame",
    "https://www.instagram.com/shepherdneame/",
    "https://www.youtube.com/user/ShepherdNeameBrewery"
  ],
  "memberOf": [
    {
      "@type": "Organization",
      "name": "British Beer & Pub Association",
      "url": "https://beerandpub.com/"
    }
  ],
  "areaServed": [
    {
      "@type": "Place",
      "name": "South East England"
    },
    {
      "@type": "Country",
      "name": "United Kingdom"
    }
  ],
  "contactPoint": [
    {
      "@type": "ContactPoint",
      "contactType": "Customer Service",
      "telephone": "+44 1795 532206",
      "email": "company@shepherd-neame.co.uk",
      "areaServed": "GB",
      "availableLanguage": ["en-GB", "en"]
    },
    {
      "@type": "ContactPoint",
      "contactType": "Investor Relations",
      "telephone": "+44 1795 532206",
      "email": "investors@shepherdneame.co.uk",
      "areaServed": "GB",
      "availableLanguage": ["en-GB", "en"]
    }
  ],
  "mainEntityOfPage": {
    "@id": "https://www.shepherdneame.co.uk/#webpage"
  }
};

// Canonical master WebSite node ("locker" schema)
const MASTER_WEBSITE_NODE: any = {
  "@type": "WebSite",
  "@id": "https://www.shepherdneame.co.uk/#website",
  "url": "https://www.shepherdneame.co.uk",
  "name": "Shepherd Neame",
  "description": "Shepherd Neame's official website, featuring its brewery, beers, pubs and hotels across Kent, London and the South East.",
  "publisher": {
    "@id": "https://www.shepherdneame.co.uk/#organization"
  },
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://www.shepherdneame.co.uk/search?keys={search_term_string}",
    "query-input": "required name=search_term_string"
  }
};

/**
 * Build default Organization node from master locker
 * Deep-clones to prevent accidental mutation
 */
function buildDefaultOrgNode(): any {
  return JSON.parse(JSON.stringify(MASTER_ORG_NODE));
}

/**
 * Build default WebSite node from master locker
 * Deep-clones to prevent accidental mutation
 */
function buildDefaultWebsiteNode(): any {
  return JSON.parse(JSON.stringify(MASTER_WEBSITE_NODE));
}

/**
 * Load canonical Organization and WebSite nodes.
 * 
 * Strategy: Start with the rich master locker, overlay any extra fields from
 * the homepage schema (if available), but ensure master locker core fields always win.
 * 
 * This ensures a single source of truth for Org/WebSite across ALL pages.
 */
async function getCanonicalOrgAndWebsite(
  supabaseClient: any
): Promise<{ orgNode: any; websiteNode: any; fromHomepage: boolean }> {
  const orgId = "https://www.shepherdneame.co.uk/#organization";
  const websiteId = "https://www.shepherdneame.co.uk/#website";

  // Always start with rich master locker defaults
  const defaultOrg = buildDefaultOrgNode();
  const defaultWebsite = buildDefaultWebsiteNode();

  try {
    // Find the homepage page record
    console.log("[Canonical Org/WebSite] Looking for homepage with is_home_page=true...");
    const { data: homePage, error: homePageError } = await supabaseClient
      .from("pages")
      .select("id, path")
      .eq("is_home_page", true)
      .single();

    if (homePageError) {
      console.log(`[Canonical Org/WebSite] Homepage query error: ${homePageError.message}, using master locker`);
      return {
        orgNode: defaultOrg,
        websiteNode: defaultWebsite,
        fromHomepage: false,
      };
    }

    if (!homePage) {
      console.log("[Canonical Org/WebSite] No homepage found with is_home_page=true, using master locker");
      return {
        orgNode: defaultOrg,
        websiteNode: defaultWebsite,
        fromHomepage: false,
      };
    }

    console.log(`[Canonical Org/WebSite] Found homepage: id=${homePage.id}, path=${homePage.path}`);

    // Get the latest schema version for homepage (prefer approved, fall back to any)
    const { data: schemaVersion, error: schemaError } = await supabaseClient
      .from("schema_versions")
      .select("jsonld, version_number, status")
      .eq("page_id", homePage.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    if (schemaError) {
      console.log(`[Canonical Org/WebSite] Schema query error: ${schemaError.message}, using master locker`);
      return {
        orgNode: defaultOrg,
        websiteNode: defaultWebsite,
        fromHomepage: false,
      };
    }

    if (!schemaVersion || !schemaVersion.jsonld) {
      console.log("[Canonical Org/WebSite] No schema_version found for homepage, using master locker");
      return {
        orgNode: defaultOrg,
        websiteNode: defaultWebsite,
        fromHomepage: false,
      };
    }

    console.log(`[Canonical Org/WebSite] Found homepage schema: v${schemaVersion.version_number}, status=${schemaVersion.status}, jsonld length=${schemaVersion.jsonld.length}`);

    // Parse the homepage JSON-LD
    let homeJsonld: any;
    try {
      homeJsonld = typeof schemaVersion.jsonld === "string"
        ? JSON.parse(schemaVersion.jsonld)
        : schemaVersion.jsonld;
    } catch (parseErr) {
      console.log(`[Canonical Org/WebSite] Failed to parse homepage schema JSON: ${parseErr}, using master locker`);
      return {
        orgNode: defaultOrg,
        websiteNode: defaultWebsite,
        fromHomepage: false,
      };
    }

    const graph = homeJsonld["@graph"];
    if (!Array.isArray(graph)) {
      console.log("[Canonical Org/WebSite] Homepage schema has no @graph array, using master locker");
      return {
        orgNode: defaultOrg,
        websiteNode: defaultWebsite,
        fromHomepage: false,
      };
    }

    console.log(`[Canonical Org/WebSite] Homepage @graph has ${graph.length} nodes`);

    // Extract Organization node by @id first, then by type
    let foundOrg = graph.find((node: any) => node["@id"] === orgId);
    if (!foundOrg) {
      foundOrg = graph.find((node: any) => {
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        return types.includes("Organization") || types.includes("Corporation");
      });
    }

    // Extract WebSite node by @id first, then by type
    let foundWebsite = graph.find((node: any) => node["@id"] === websiteId);
    if (!foundWebsite) {
      foundWebsite = graph.find((node: any) => {
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        return types.includes("WebSite");
      });
    }

    // MERGE STRATEGY: Homepage fields first, then master locker wins
    // This means: extra fields from homepage are preserved, but master locker core fields overwrite
    // Order: foundOrg → defaultOrg means default (master locker) wins for shared keys
    const orgNode = foundOrg
      ? {
          ...foundOrg,              // Any extra homepage-only fields first
          ...defaultOrg,            // Master locker wins for all its fields
          "@id": orgId,             // Force canonical @id
          url: ORG_URL,             // Force canonical url
        }
      : defaultOrg;

    // Same merge for WebSite
    const websiteNode = foundWebsite
      ? {
          ...foundWebsite,          // Any extra homepage-only fields first
          ...defaultWebsite,        // Master locker wins
          "@id": websiteId,         // Force canonical @id
          url: "https://www.shepherdneame.co.uk",
          publisher: { "@id": orgId },
        }
      : defaultWebsite;

    const orgSource = foundOrg ? "homepage (master locker wins)" : "master locker only";
    const websiteSource = foundWebsite ? "homepage (master locker wins)" : "master locker only";
    console.log(`[Canonical Org/WebSite] Loaded (org: ${orgSource}, website: ${websiteSource})`);

    return {
      orgNode,
      websiteNode,
      fromHomepage: foundOrg !== undefined || foundWebsite !== undefined,
    };
  } catch (err) {
    console.error("[Canonical Org/WebSite] Unexpected error loading from homepage:", err);
    return {
      orgNode: defaultOrg,
      websiteNode: defaultWebsite,
      fromHomepage: false,
    };
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateSchemaRequest {
  page_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("generate-schema function called");

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this is a service role call (internal/automated)
    const authHeader = req.headers.get("Authorization");
    const isServiceRoleCall = authHeader?.includes(supabaseServiceKey);

    let userId: string | null = null;

    if (!isServiceRoleCall) {
      // Regular user call - require authentication
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    } else {
      console.log("Service role call detected - proceeding without user auth");
      // userId remains null for automated calls
    }

    // Parse request body
    const { page_id }: GenerateSchemaRequest = await req.json();

    if (!page_id) {
      return new Response(JSON.stringify({ error: "page_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Generating schema for page:", page_id);

    // 1. Load page context (including wikidata_qid for sameAs injection)
    const { data: page, error: pageError } = await supabase
      .from("pages")
      .select(
        "id, path, section, page_type, category, faq_mode, logo_url, hero_image_url, is_home_page, domain, beer_abv, beer_style, beer_launch_year, beer_official_url, last_html_hash, has_faq, notes, wikidata_qid",
      )
      .eq("id", page_id)
      .single();

    if (pageError || !page) {
      console.error("Error fetching page:", pageError);
      return new Response(JSON.stringify({ error: "Page not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================
    // HOMEPAGE PROTECTION
    // ----------------------------------------
    // Homepage schema is managed manually by admins only.
    // AI generation is explicitly disabled for the homepage.
    // ========================================
    if (page.is_home_page) {
      console.log("Homepage detected - AI generation blocked (manual-only)");
      return new Response(
        JSON.stringify({ error: "Homepage schema is managed manually and cannot be generated by AI." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ========================================
    // DOMAIN LANE LOGIC
    // ----------------------------------------
    // 'Corporate' & 'Beer' - Use the rules-based schema engine with page_type + category matching
    // 'Pub' - Individual pub/hotel pages (Phase 2 - UI blocks this)
    // ========================================

    // Defensive check: UI should prevent Pub calls, but handle gracefully if reached
    const pageDomain = page.domain || "Corporate"; // Default to Corporate for existing records

    if (pageDomain === "Pub") {
      console.log("Pub lane - should not reach edge function (UI should block)");
      return new Response(JSON.stringify({ error: "Pub schema generation is not yet implemented (Phase 2)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================
    // RULES-BASED SCHEMA ENGINE (Corporate & Beer)
    // Uses page_type + category to select the correct active rule
    // All logic below this point uses the rules system
    // ========================================

    // Check if HTML has been fetched
    if (!page.last_html_hash) {
      return new Response(JSON.stringify({ error: "HTML not fetched yet. Please fetch HTML first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load settings for canonical_base_url
    const { data: settings, error: settingsError } = await supabase.from("settings").select("*").single();

    if (settingsError || !settings) {
      console.error("Error fetching settings:", settingsError);
      return new Response(JSON.stringify({ error: "Settings not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check schema engine version first to determine which rules to load
    const schemaEngineVersion = settings.schema_engine_version || "v1";

    // For v1, load the active rule from rules table
    let activeRule = null;
    if (schemaEngineVersion === "v1") {
      const { data: rule, error: ruleError } = await supabase.from("rules").select("*").eq("is_active", true).single();

      if (ruleError || !rule) {
        console.error("Error fetching active rule:", ruleError);
        return new Response(JSON.stringify({ error: "No active rule found. Please activate a rule first." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      activeRule = rule;
    }

    // Fetch the HTML again (we could store it but for now we refetch)
    const fetchUrl = `${settings.fetch_base_url}${page.path}`;
    const fetchHeaders: HeadersInit = {
      "User-Agent": "NeameGraph-SchemaGenerator/1.0",
    };

    if (settings.preview_auth_user && settings.preview_auth_password) {
      const credentials = btoa(`${settings.preview_auth_user}:${settings.preview_auth_password}`);
      fetchHeaders["Authorization"] = `Basic ${credentials}`;
    }

    const htmlResponse = await fetch(fetchUrl, {
      headers: fetchHeaders,
      redirect: "follow",
    });

    if (!htmlResponse.ok) {
      console.error("Failed to fetch HTML:", htmlResponse.status);
      return new Response(JSON.stringify({ error: "Failed to fetch HTML for schema generation" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = await htmlResponse.text();
    console.log("HTML fetched for schema generation, length:", html.length);

    // Trim HTML to reasonable size (keep first 50k characters to avoid token limits)
    const trimmedHtml =
      html.length > 50000 ? html.substring(0, 50000) + "\n<!-- HTML truncated for AI processing -->" : html;

    // Build canonical_url
    const canonicalBaseUrl = settings.canonical_base_url.replace(/\/$/, "");
    const canonicalUrl = `${canonicalBaseUrl}${page.path}`;

    if (schemaEngineVersion === "v2") {
      // Load v2 rules from the rules table based on domain, page_type, and category
      // The rules matching system handles missing/invalid page_type by falling back to default domain rule
      console.log(
        `Loading v2 rules for domain: ${pageDomain}, pageType: ${page.page_type || "none"}, category: ${page.category || "none"}`,
      );

      // RULES MATCHING ALGORITHM (with domain priority):
      // 1. Try: domain + page_type + category match
      // 2. Try: domain + page_type (category null)
      // 3. Try: domain-level default (page_type & category both null)
      // 4. Fall back to any active rule if no domain match

      let matchedRule = null;

      // Try domain + page_type + category
      if (page.page_type && page.category) {
        const { data: specificRule } = await supabase
          .from("rules")
          .select("*")
          .eq("domain", pageDomain)
          .eq("page_type", page.page_type)
          .eq("category", page.category)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (specificRule) {
          matchedRule = specificRule;
          console.log(
            `Using specific rule for ${pageDomain} · ${page.page_type} · ${page.category}: ${matchedRule.name}`,
          );
        }
      }

      // Try domain + page_type (category null)
      if (!matchedRule && page.page_type) {
        const { data: pageTypeRule } = await supabase
          .from("rules")
          .select("*")
          .eq("domain", pageDomain)
          .eq("page_type", page.page_type)
          .is("category", null)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pageTypeRule) {
          matchedRule = pageTypeRule;
          console.log(`Using page type rule for ${pageDomain} · ${page.page_type}: ${matchedRule.name}`);
        }
      }

      // Try domain-level default (page_type & category both null)
      if (!matchedRule) {
        const { data: domainRule } = await supabase
          .from("rules")
          .select("*")
          .eq("domain", pageDomain)
          .is("page_type", null)
          .is("category", null)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (domainRule) {
          matchedRule = domainRule;
          console.log(`Using domain-level default rule for ${pageDomain}: ${matchedRule.name}`);
        }
      }

      // Final fallback: any active default rule (no domain filter)
      if (!matchedRule) {
        const { data: fallbackRule } = await supabase
          .from("rules")
          .select("*")
          .is("page_type", null)
          .is("category", null)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        matchedRule = fallbackRule;

        if (matchedRule) {
          console.log(`Using fallback default rule (no domain match): ${matchedRule.name}`);
        }
      }

      if (!matchedRule) {
        return new Response(
          JSON.stringify({
            error: `No active rule found for domain "${pageDomain}". Please create a rule for this domain in the Brain Rules section.`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const v2Rules = matchedRule.body;
      const usedRuleId = matchedRule.id;
      console.log(`Final matched rule: ${matchedRule.name} (domain: ${matchedRule.domain || "any"})`);
      console.log(`v2 rules loaded, length: ${v2Rules.length}`);

      // Build v2 user message with rules at the top
      const v2UserMessage = `
${v2Rules}

---

Generate JSON-LD schema for the following page:

Canonical URL: ${canonicalUrl}
Path: ${page.path}
Page Type: ${page.page_type}
Category: ${page.category || "N/A"}
FAQ Mode: ${page.faq_mode || "auto"}
Logo URL: ${page.logo_url || "none"}
Hero Image URL: ${page.hero_image_url || "none"}

HTML Content:
${trimmedHtml}

CRITICAL: Return ONLY valid JSON-LD. Start with { and end with }. Do not include markdown code blocks, explanations, or any other text. The response must be parseable by JSON.parse().
`;

      console.log("Calling Lovable AI for v2 schema generation...");

      // Call Lovable AI with v2 rules
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const v2AiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a corporate schema.org JSON-LD generator. Follow all rules provided." },
            { role: "user", content: v2UserMessage },
          ],
        }),
      });

      if (!v2AiResponse.ok) {
        const errorText = await v2AiResponse.text();
        console.error("AI API error (v2):", v2AiResponse.status, errorText);

        if (v2AiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (v2AiResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "Payment required. Please add credits to your Lovable AI workspace." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({ error: "AI API error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const v2AiData = await v2AiResponse.json();
      const v2GeneratedContent = v2AiData.choices?.[0]?.message?.content;

      if (!v2GeneratedContent) {
        console.error("No content in v2 AI response");
        return new Response(JSON.stringify({ error: "AI returned no content" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("v2 AI response received, length:", v2GeneratedContent.length);

      // Parse and validate v2 response
      let v2Jsonld;
      try {
        let jsonContent = v2GeneratedContent.trim();

        // Remove markdown code blocks if present
        if (jsonContent.startsWith("```")) {
          const match = jsonContent.match(/```(?:json|jsonld)?\s*([\s\S]*?)```/);
          if (match) {
            jsonContent = match[1].trim();
          }
        }

        // Remove any leading/trailing text that's not JSON
        const jsonStart = jsonContent.indexOf("{");
        const jsonEnd = jsonContent.lastIndexOf("}");

        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
        }

        // Try to parse
        v2Jsonld = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error("Failed to parse v2 AI response as JSON:", parseError);
        console.error("AI response (first 1000 chars):", v2GeneratedContent.substring(0, 1000));
        return new Response(
          JSON.stringify({
            error:
              "AI did not return valid JSON. The schema generation prompt may need refinement, or the AI may be having difficulty with this page content.",
            details: v2GeneratedContent.substring(0, 500),
            parseError: parseError instanceof Error ? parseError.message : String(parseError),
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Basic v2 validation
      const v2ValidationErrors: string[] = [];

      if (!v2Jsonld["@context"]) {
        v2ValidationErrors.push("Missing @context");
      }

      if (!v2Jsonld["@graph"] || !Array.isArray(v2Jsonld["@graph"])) {
        v2ValidationErrors.push("Missing or invalid @graph array");
      }

      if (v2ValidationErrors.length > 0) {
        console.error("v2 Validation errors:", v2ValidationErrors);
        return new Response(
          JSON.stringify({
            error: "Schema validation failed",
            validation_errors: v2ValidationErrors,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // ========================================
      // SCHEMA QUALITY CHARTER ENFORCEMENT
      // ----------------------------------------
      // Post-process the AI-generated JSON-LD to enforce Charter rules:
      // 1. Load canonical Organization and WebSite from homepage schema
      // 2. Strip any LLM-emitted Organization/WebSite nodes
      // 3. Inject canonical nodes (single source of truth)
      // 4. Make all WebPage nodes point to WebSite via isPartOf
      // 5. Ensure publisher correctly links back to canonical Organization
      // 6. Only emit FAQ schema when there is real on-page FAQ content
      // See docs/schema-quality-charter.md for quality standards
      // ========================================
      const graph = v2Jsonld["@graph"] || [];
      let charterWarnings: string[] = [];

      const websiteId = "https://www.shepherdneame.co.uk/#website";
      const orgId = "https://www.shepherdneame.co.uk/#organization";

      // STEP 1: Load canonical Organization and WebSite from homepage schema
      // This ensures a single source of truth for Org/WebSite across ALL pages
      const { orgNode: canonicalOrg, websiteNode: canonicalWebsite, fromHomepage } = 
        await getCanonicalOrgAndWebsite(supabase);

      console.log(`[Canonical Nodes] Source: ${fromHomepage ? "homepage schema" : "hardcoded defaults"}`);

      // STEP 1a: Strip ALL Organization and WebSite nodes emitted by LLM
      // We will inject our single canonical versions instead
      for (let i = graph.length - 1; i >= 0; i--) {
        const node = graph[i];
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        const nodeId = node["@id"] || "";

        // Remove if @type includes Organization or WebSite
        const isOrgType = types.includes("Organization") || types.includes("Corporation");
        const isWebsiteType = types.includes("WebSite");
        
        // Also remove if @id matches canonical IDs (regardless of type)
        const isCanonicalOrgId = nodeId === orgId;
        const isCanonicalWebsiteId = nodeId === websiteId;

        if (isOrgType || isWebsiteType || isCanonicalOrgId || isCanonicalWebsiteId) {
          graph.splice(i, 1);
        }
      }

      console.log("✓ Stripped LLM-emitted Organization/WebSite nodes");

      // STEP 1b: Inject the canonical Organization and WebSite nodes
      // These come from homepage schema (preferred) or hardcoded defaults (fallback)
      let orgNode = { ...canonicalOrg };
      let websiteNode = { ...canonicalWebsite };

      // Ensure canonical @id and url values are always correct
      orgNode["@id"] = orgId;
      orgNode.url = ORG_URL;
      websiteNode["@id"] = websiteId;
      websiteNode.url = "https://www.shepherdneame.co.uk";
      websiteNode.publisher = { "@id": orgId };

      graph.push(orgNode);
      graph.push(websiteNode);

      console.log("✓ Injected canonical Organization and WebSite nodes");

      // STEP 2: Fix isPartOf on all WebPage nodes
      // Charter rule: WebPage nodes must link to WebSite via isPartOf, not Organization
      // NOTE: This filter only matches primary WebPage nodes, not specialized types like FAQPage
      // to avoid false positives in Charter validation (e.g. WebPage + FAQPage is a valid pattern)
      let webPageNodes = graph.filter((node: any) => {
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        return types.includes("WebPage");
      });

      webPageNodes.forEach((node: any) => {
        // Set isPartOf to WebSite (not Organization)
        node.isPartOf = { "@id": websiteId };
      });

      if (webPageNodes.length > 0) {
        console.log(`✓ Fixed isPartOf for ${webPageNodes.length} WebPage node(s)`);
      }

      // STEP 3: Ensure WebPage nodes have publisher linking to Organization
      // Charter rule: key entities must explicitly link back to canonical Organization
      webPageNodes.forEach((node: any) => {
        if (!node.publisher) {
          node.publisher = { "@id": orgId };
        } else if (typeof node.publisher === "string") {
          // Normalize string to object form
          node.publisher = { "@id": orgId };
        }
      });

      console.log(`✓ Ensured publisher on ${webPageNodes.length} WebPage node(s)`);

      // STEP 4: Remove FAQ schema if not appropriate
      // Charter rule: FAQ schema only when real on-page FAQ content exists
      const shouldHaveFAQ = page.has_faq === true && page.faq_mode !== "ignore";

      if (!shouldHaveFAQ) {
        // Remove any FAQPage, Question, or Answer nodes
        const beforeLength = graph.length;
        for (let i = graph.length - 1; i >= 0; i--) {
          const node = graph[i];
          const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];

          if (types.includes("FAQPage") || types.includes("Question") || types.includes("Answer")) {
            graph.splice(i, 1);
          } else if (Array.isArray(node["@type"]) && node["@type"].includes("FAQPage")) {
            // Remove FAQPage from type array if present with other types
            node["@type"] = node["@type"].filter((t: string) => t !== "FAQPage");
            if (node["@type"].length === 0) {
              graph.splice(i, 1);
            }
          }
        }

        const removedCount = beforeLength - graph.length;
        if (removedCount > 0) {
          console.log(`✓ Removed ${removedCount} FAQ-related node(s) (no real FAQ content)`);
        }
      }

      // STEP 5: Clean up dangling hasPart references
      // Prevent validation errors like "hasPart references non-existent node .../Beers#brewery-faq"
      // This can happen when FAQ nodes are removed but hasPart still references them
      const existingIds = new Set(graph.map((node: any) => node["@id"]).filter((id: any) => typeof id === "string"));

      const cleanHasPart = (value: any) => {
        if (!value) return undefined;

        const toIds = (v: any): string[] => {
          if (!v) return [];
          if (typeof v === "string") return [v];
          if (Array.isArray(v)) return v.flatMap(toIds);
          if (typeof v === "object" && v["@id"]) return [v["@id"]];
          return [];
        };

        const ids = toIds(value).filter((id) => existingIds.has(id));

        if (ids.length === 0) return undefined;

        if (Array.isArray(value)) {
          // Return array of objects with @id
          return ids.map((id) => ({ "@id": id }));
        }

        // Single reference: return as object with @id
        return { "@id": ids[0] };
      };

      let cleanedHasPartCount = 0;
      graph.forEach((node: any) => {
        if (node.hasPart) {
          const cleaned = cleanHasPart(node.hasPart);
          if (cleaned) {
            node.hasPart = cleaned;
          } else {
            delete node.hasPart;
            cleanedHasPartCount++;
          }
        }
      });

      if (cleanedHasPartCount > 0) {
        console.log(`✓ Cleaned ${cleanedHasPartCount} dangling hasPart reference(s)`);
      }

      // STEP 6: Make Brand the canonical beer entity (beer detail pages)
      // Beer Domain Rule v2.3: Brand-first, non-transactional
      // Beer detail pages use Brand as the main entity with NO Product/Offer nodes
      // Collection pages (like /Beers) remain as ItemList/CollectionPage pointing to Brand IDs
      const BEERS_COLLECTION_URL = "https://www.shepherdneame.co.uk/beers";

      // Beer detail pages: any path under /beers/slug (but NOT the collection page itself)
      const isBeerDetailPage =
        typeof page.path === "string" &&
        page.path.toLowerCase().startsWith("/beers/") &&
        canonicalUrl.toLowerCase() !== BEERS_COLLECTION_URL.toLowerCase();

      // Beers collection page: the top-level /Beers
      const isBeersCollectionPage =
        typeof canonicalUrl === "string" && canonicalUrl.toLowerCase() === BEERS_COLLECTION_URL.toLowerCase();

      console.log(
        `[Beer Detail Detection] path=${page.path}, domain=${pageDomain}, isBeerDetailPage=${isBeerDetailPage}, isBeersCollectionPage=${isBeersCollectionPage}`,
      );

      if (isBeerDetailPage) {
        console.log("Beer detail page detected - applying Brand-first canonicalisation (no Product)");

        // Find the main WebPage node for this page
        const pageWebPageNode = graph.find((node: any) => {
          const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
          return types.includes("WebPage") && node.url === canonicalUrl;
        });

        if (pageWebPageNode) {
          // Derive clean beer name (remove "| Shepherd Neame" suffix)
          const deriveBeerName = () => {
            // Prefer WebPage name without brand suffixes
            if (pageWebPageNode.name && typeof pageWebPageNode.name === "string") {
              return pageWebPageNode.name.replace(/\s*\|\s*Shepherd Neame\s*$/i, "").trim();
            }

            // Fallback: slug → words
            const slugPart = page.path?.split("/").pop() || "";
            if (slugPart) {
              return slugPart
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c: string) => c.toUpperCase())
                .trim();
            }

            return "Beer";
          };

          const beerName = deriveBeerName();
          const brandId = `${canonicalUrl}#brand`;
          const webpageId = `${canonicalUrl}#webpage`;

          // Find existing Brand node or legacy Product node to convert
          let brandNode = graph.find((node: any) => {
            if (node["@id"] === brandId) return true;
            const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
            return types.includes("Brand") && node.url === canonicalUrl;
          });

          // Look for legacy Product node to convert if no Brand exists
          const legacyProductNode = graph.find((node: any) => {
            if (node["@id"] === `${canonicalUrl}#product`) return true;
            const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
            return types.includes("Product") && node.url === canonicalUrl;
          });

          if (!brandNode) {
            // Create Brand node, copying data from legacy Product if available
            brandNode = {
              "@type": "Brand",
              "@id": brandId,
              name: beerName,
              url: canonicalUrl,
              mainEntityOfPage: { "@id": webpageId },
            };

            if (legacyProductNode) {
              // Copy useful properties from legacy Product to Brand
              if (legacyProductNode.description && !brandNode.description) {
                brandNode.description = legacyProductNode.description;
              }
              if (legacyProductNode.image && !brandNode.image) {
                brandNode.image = legacyProductNode.image;
              }
              if (legacyProductNode.logo && !brandNode.logo) {
                brandNode.logo = legacyProductNode.logo;
              }
              if (legacyProductNode.additionalProperty) {
                brandNode.additionalProperty = legacyProductNode.additionalProperty;
              }
              console.log("✓ Converted legacy Product data to Brand node");
            } else {
              // Use WebPage description as fallback
              if (pageWebPageNode.description && !brandNode.description) {
                brandNode.description = pageWebPageNode.description;
              }
            }

            graph.push(brandNode);
            console.log("✓ Created Brand node for beer");
          } else {
            // Ensure existing Brand has correct linking
            brandNode["@id"] = brandId;
            brandNode.name = beerName;
            brandNode.url = canonicalUrl;
            brandNode.mainEntityOfPage = { "@id": webpageId };
          }

          // Add beer-specific metadata from page data to Brand
          if (page.beer_abv && !brandNode.additionalProperty?.some((p: any) => p.name === "ABV")) {
            brandNode.additionalProperty = brandNode.additionalProperty || [];
            brandNode.additionalProperty.push({
              "@type": "PropertyValue",
              name: "ABV",
              value: page.beer_abv.toString() + "%",
            });
          }

          if (page.beer_style && !brandNode.additionalProperty?.some((p: any) => p.name === "Style")) {
            brandNode.additionalProperty = brandNode.additionalProperty || [];
            brandNode.additionalProperty.push({
              "@type": "PropertyValue",
              name: "Style",
              value: page.beer_style,
            });
          }

          if (page.beer_launch_year) {
            brandNode.foundingDate = page.beer_launch_year.toString();
          }

          if (page.wikidata_qid && !brandNode.sameAs) {
            brandNode.sameAs = [`https://www.wikidata.org/wiki/${page.wikidata_qid}`];
          }

          // Tasting notes from page metadata
          if (page.notes && !brandNode.additionalProperty?.some((p: any) => p.name === "Tasting notes")) {
            brandNode.additionalProperty = brandNode.additionalProperty || [];
            brandNode.additionalProperty.push({
              "@type": "PropertyValue",
              name: "Tasting notes",
              value: page.notes,
            });
          }

          console.log("✓ Enriched Brand with page-backed descriptive properties");

          // ========================================
          // BEER IMAGE EXTRACTION (Next.js-aware)
          // ========================================
          const beerSlug = page.path?.split("/").pop() || "";
          const extractedImages = extractBeerImagesFromHtml(html, beerName, beerSlug);

          let chosenHeroUrl: string | undefined = undefined;
          let chosenLogoUrl: string | undefined = undefined;

          // Hero image priority:
          // 1) Extracted from HTML (Next.js image URLs with page_hero pattern)
          // 2) page.hero_image_url from metadata
          // 3) Existing Brand image
          // 4) final fallback: ORG_LOGO_URL

          if (extractedImages.heroImageUrl) {
            chosenHeroUrl = extractedImages.heroImageUrl;
            console.log(`✓ Using extracted hero image: ${chosenHeroUrl.substring(0, 100)}...`);
          } else if (page.hero_image_url) {
            chosenHeroUrl = page.hero_image_url;
          } else if (brandNode.image) {
            chosenHeroUrl = typeof brandNode.image === "string" ? brandNode.image : brandNode.image?.url;
          }

          if (!chosenHeroUrl) {
            chosenHeroUrl = ORG_LOGO_URL; // final fallback only
          }

          // Logo image priority:
          // 1) Extracted from HTML (filename contains "logo" or "pumpclip")
          // 2) page.logo_url from metadata
          // 3) Existing Brand logo

          if (extractedImages.logoImageUrl) {
            chosenLogoUrl = extractedImages.logoImageUrl;
            console.log(`✓ Using extracted logo image: ${chosenLogoUrl.substring(0, 100)}...`);
          } else if (page.logo_url) {
            chosenLogoUrl = page.logo_url;
          } else if (brandNode.logo) {
            chosenLogoUrl = typeof brandNode.logo === "string" ? brandNode.logo : brandNode.logo?.url;
          }

          // Apply hero image to Brand node
          brandNode.image = {
            "@type": "ImageObject",
            url: chosenHeroUrl,
            contentUrl: chosenHeroUrl,
            caption: `${beerName} hero image`,
          };

          // Apply logo to Brand node if found
          if (chosenLogoUrl) {
            brandNode.logo = {
              "@type": "ImageObject",
              url: chosenLogoUrl,
              contentUrl: chosenLogoUrl,
              caption: `${beerName} logo`,
            };
          }

          // Apply hero image to WebPage node as well
          pageWebPageNode.image = {
            "@type": "ImageObject",
            url: chosenHeroUrl,
            contentUrl: chosenHeroUrl,
            caption: `${beerName} hero image`,
          };

          // Ensure WebPage has correct @id and types for AboutPage
          pageWebPageNode["@id"] = webpageId;
          const existingTypes = Array.isArray(pageWebPageNode["@type"])
            ? pageWebPageNode["@type"]
            : [pageWebPageNode["@type"]];
          if (!existingTypes.includes("AboutPage")) {
            pageWebPageNode["@type"] = [...existingTypes.filter((t: string) => t !== "WebPage"), "WebPage", "AboutPage"];
          }

          // Ensure WebPage mainEntity/about point to Brand (not Product)
          pageWebPageNode.mainEntity = { "@id": brandId };
          pageWebPageNode.about = { "@id": brandId };

          console.log("✓ Linked WebPage mainEntity/about to Brand");

          // ========================================
          // REMOVE PRODUCT/OFFER NODES FROM BEER PAGES
          // ========================================
          // Beer domain is strictly non-transactional: no Product, Offer, AggregateOffer
          const commerceTypes = ["Product", "Offer", "AggregateOffer", "ProductModel"];
          const beforeLength = graph.length;

          for (let i = graph.length - 1; i >= 0; i--) {
            const node = graph[i];
            const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
            const hasCommerceType = types.some((t: string) => commerceTypes.includes(t));

            if (hasCommerceType) {
              graph.splice(i, 1);
            }
          }

          const removedCount = beforeLength - graph.length;
          if (removedCount > 0) {
            console.log(`✓ Removed ${removedCount} Product/Offer node(s) from Beer detail page`);
          }
        }
      }

      // STEP 6a: Normalize breadcrumbs for beer detail pages
      // Enforce consistent middle breadcrumb: Home → Beers → Beer name
      if (isBeerDetailPage) {
        // Find the BreadcrumbList node
        const breadcrumbNode = graph.find((node: any) => {
          const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
          return types.includes("BreadcrumbList") && node["@id"]?.endsWith("#breadcrumbs");
        });

        if (breadcrumbNode && breadcrumbNode.itemListElement) {
          // Get cleaned beer name from Brand node (not Product - Beer is Brand-first)
          const brandNode = graph.find((n: any) => n["@id"] === `${canonicalUrl}#brand`);
          const beerName = brandNode?.name || canonicalUrl.split("/").pop()?.replace(/-/g, " ") || "Beer";

          // Normalize breadcrumbs: Home → Beers (canonical URL) → Beer name (clean)
          breadcrumbNode.itemListElement = [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: "https://www.shepherdneame.co.uk/",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Beers",
              item: BEERS_COLLECTION_URL,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: beerName,
              item: canonicalUrl,
            },
          ];

          console.log("✓ Normalized breadcrumbs for beer detail page");
        }
      }

      // STEP 7: /Beers collection ItemList → Brand @ids (HTML-verified)
      // Beer Domain Rule v2.3: Brand-first, non-transactional
      // For the /Beers collection page:
      // - Start from the LLM-emitted ItemList
      // - ONLY keep entries whose URLs actually appear in the page HTML
      // - Convert all surviving URLs into Brand @ids
      // - Update numberOfItems and renumber positions 1..N
      if (isBeersCollectionPage) {
        console.log("/Beers collection page detected - rebuilding ItemList from HTML-backed items");

        const beersItemList = graph.find((node: any) => {
          const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
          return types.includes("ItemList");
        });

        if (beersItemList) {
          const canonicalBase = "https://www.shepherdneame.co.uk";

          // Helper: extract a usable URL from the ListItem.item structure
          const extractUrlFromItem = (listItem: any): string | null => {
            if (!listItem?.item) return null;

            // item is a string URL
            if (typeof listItem.item === "string") {
              return listItem.item;
            }

            // item is an object with a url property
            if (typeof listItem.item === "object" && listItem.item.url) {
              return listItem.item.url;
            }

            // item is an object with an @id (strip fragment)
            if (typeof listItem.item === "object" && listItem.item["@id"]) {
              return String(listItem.item["@id"]).split("#")[0];
            }

            return null;
          };

          // Helper: normalize URL to canonical base + pathname
          const normalizeToCanonicalUrl = (url: string): string => {
            try {
              const parsedUrl = new URL(url, canonicalBase);
              return `${canonicalBase}${parsedUrl.pathname}`;
            } catch {
              return url;
            }
          };

          const originalItems = Array.isArray(beersItemList.itemListElement)
            ? beersItemList.itemListElement
            : [];

          const filteredItems: any[] = [];
          const droppedItems: string[] = [];

          for (const listItem of originalItems) {
            const rawUrl = extractUrlFromItem(listItem);
            if (!rawUrl) {
              droppedItems.push("[no URL]");
              continue;
            }

            const normalizedUrl = normalizeToCanonicalUrl(rawUrl);

            // If HTML is available, require evidence that this URL (or its path) is actually on the page
            let hasEvidenceInHtml = true;
            if (typeof html === "string") {
              try {
                const parsed = new URL(normalizedUrl, canonicalBase);
                const pathOnly = parsed.pathname;

                hasEvidenceInHtml =
                  html.includes(normalizedUrl) ||
                  html.includes(pathOnly);
              } catch {
                hasEvidenceInHtml = html.includes(normalizedUrl);
              }
            }

            if (!hasEvidenceInHtml) {
              droppedItems.push(normalizedUrl);
              continue;
            }

            const brandId = `${normalizedUrl}#brand`;

            filteredItems.push({
              "@type": "ListItem",
              position: filteredItems.length + 1, // 1-indexed
              item: { "@id": brandId },
            });
          }

          beersItemList.itemListElement = filteredItems;
          beersItemList.numberOfItems = filteredItems.length;

          console.log(
            `✓ Rebuilt /Beers ItemList with ${filteredItems.length} HTML-backed Brand items (from ${originalItems.length} original items)`
          );
          if (droppedItems.length > 0) {
            console.log("⚠ Dropped /Beers ItemList entries with no HTML evidence:");
            droppedItems.forEach((u) => console.log(`   - ${u}`));
          }
        }

        // Also ensure the /Beers collection WebPage has correct types
        const collectionWebPage = graph.find((node: any) => {
          const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
          return types.includes("WebPage") && node.url === canonicalUrl;
        });

        if (collectionWebPage) {
          const existingTypes = Array.isArray(collectionWebPage["@type"])
            ? collectionWebPage["@type"]
            : [collectionWebPage["@type"]];

          // Ensure CollectionPage is in the types
          if (!existingTypes.includes("CollectionPage")) {
            collectionWebPage["@type"] = [
              ...existingTypes.filter((t: string) => t !== "WebPage"),
              "WebPage",
              "CollectionPage",
            ];
          }

          // If ItemList exists, link mainEntity/about to it
          if (beersItemList && beersItemList["@id"]) {
            collectionWebPage.mainEntity = { "@id": beersItemList["@id"] };
            collectionWebPage.about = { "@id": beersItemList["@id"] };
          }

          console.log("✓ Ensured /Beers collection WebPage has CollectionPage type and mainEntity/about wired to ItemList");
        }

        // STEP 7a: Remove any Product/Offer nodes from collection page too
        // Beer domain is strictly non-transactional at all levels
        const commerceTypes = ["Product", "Offer", "AggregateOffer", "ProductModel"];
        const beforeLength = graph.length;

        for (let i = graph.length - 1; i >= 0; i--) {
          const node = graph[i];
          const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
          const hasCommerceType = types.some((t: string) => commerceTypes.includes(t));

          if (hasCommerceType) {
            graph.splice(i, 1);
          }
        }

        const removedCount = beforeLength - graph.length;
        if (removedCount > 0) {
          console.log(`✓ Removed ${removedCount} Product/Offer node(s) from Beer collection page`);
        }
      }

      // ========================================
      // STEP 8: NON-BEER PAGE HERO IMAGE HANDLING
      // ----------------------------------------
      // For Corporate pages AND the /Beers collection (NOT beer detail pages),
      // extract hero image from HTML and set WebPage.image + primaryImageOfPage.
      // Organization.logo is already set to ORG_LOGO_URL in STEP 1a.
      // All logo fields use the canonical corporate logo.
      // ========================================
      if (!isBeerDetailPage || isBeersCollectionPage) {
        console.log("[Non-beer page] Extracting hero image");

        // Helper: Robust URL normalisation for non-beer images
        // Returns null for invalid/empty URLs, fully qualified absolute URL otherwise
        // Handles Next.js /_next/image wrappers with both absolute and relative inner URLs
        function normaliseNonBeerUrl(raw: string | null | undefined, pageUrl?: string): string | null {
          if (!raw || raw.trim() === "") return null;

          const trimmed = raw.trim();
          const canonicalOrigin = "https://www.shepherdneame.co.uk";
          const cdnOrigin = "https://snsites.co.uk";

          try {
            // Protocol-relative URL
            if (trimmed.startsWith("//")) {
              return `https:${trimmed}`;
            }

            // Absolute URLs and absolute paths handled through URL()
            const isAbsolutePath = trimmed.startsWith("/");
            const baseForPath = isAbsolutePath ? canonicalOrigin : undefined;
            const url = new URL(trimmed, baseForPath);

            // Handle Next.js image wrapper - unwrap the inner ?url=
            if (url.pathname === "/_next/image") {
              const inner = url.searchParams.get("url");
              if (inner) {
                const innerDecoded = decodeURIComponent(inner);

                // Already a full URL (e.g. https://snsites.co.uk/...)
                if (innerDecoded.startsWith("http://") || innerDecoded.startsWith("https://")) {
                  return innerDecoded;
                }

                // Protocol-relative in the inner URL
                if (innerDecoded.startsWith("//")) {
                  return `https:${innerDecoded}`;
                }

                // If it's a CDN /sites path, resolve against snsites.co.uk,
                // otherwise resolve against the page URL or canonical origin.
                const base =
                  innerDecoded.startsWith("/sites/") || innerDecoded.startsWith("sites/")
                    ? cdnOrigin
                    : pageUrl || canonicalOrigin;

                return new URL(innerDecoded, base).toString();
              }
            }

            // Not a Next.js wrapper; return fully resolved URL with query + hash intact
            return url.toString();
          } catch {
            // Relative path that failed the first URL() call – try resolving against page URL
            try {
              const baseUrl = pageUrl || canonicalOrigin;
              const resolved = new URL(trimmed, baseUrl);
              return resolved.toString();
            } catch {
              // If URL parsing still fails, give up
              return null;
            }
          }
        }

        // Helper: Check if URL looks like a valid image URL
        function isLikelyImageUrl(url: string): boolean {
          const lower = url.toLowerCase();
          // Image file extensions
          if (/\.(jpg|jpeg|png|webp|gif|avif)(\?|$|#)/i.test(lower)) return true;
          // CDN image paths
          if (lower.includes("/sites/default/files/")) return true;
          if (lower.includes("snsites.co.uk")) return true;
          // Image style paths
          if (lower.includes("/styles/")) return true;
          return false;
        }

        // Helper: Check if image should be excluded (logos, icons, social, etc.)
        function shouldExcludeImage(src: string, alt?: string, className?: string): boolean {
          const srcLower = src.toLowerCase();
          const altLower = (alt || "").toLowerCase();
          const classLower = (className || "").toLowerCase();

          // SVGs and tiny icons
          if (srcLower.endsWith(".svg")) return true;
          if (srcLower.includes("/icons/")) return true;
          if (srcLower.includes("favicon")) return true;
          if (srcLower.includes("sprite")) return true;

          // Logo patterns
          if (srcLower.includes("logo")) return true;
          if (altLower.includes("logo")) return true;
          if (classLower.includes("logo")) return true;

          // Social media icons
          const socialPatterns = ["facebook", "twitter", "instagram", "linkedin", "youtube", "x.com", "social"];
          for (const pattern of socialPatterns) {
            if (srcLower.includes(pattern) || altLower.includes(pattern) || classLower.includes(pattern)) {
              return true;
            }
          }

          // Icon patterns
          if (altLower.includes("icon") || classLower.includes("icon")) return true;

          // Tracking pixels and tiny images (base64 1x1)
          if (srcLower.includes("pixel") || srcLower.includes("tracking")) return true;

          return false;
        }

        // Helper: Extract hero image URL from non-beer page HTML
        function extractNonBeerHeroImageFromHtml(
          htmlContent: string,
          pageUrl: string,
        ): { heroUrl: string | null; caption?: string } {
          try {
            const doc = new DOMParser().parseFromString(htmlContent, "text/html");
            if (!doc) return { heroUrl: null };

            // Priority 1: og:image meta tag (if it looks like a real image)
            const ogImageMeta =
              doc.querySelector('meta[property="og:image"]') || doc.querySelector('meta[name="og:image"]');
            if (ogImageMeta) {
              const content = ogImageMeta.getAttribute("content");
              if (content) {
                const normalised = normaliseNonBeerUrl(content, pageUrl);
                if (normalised && isLikelyImageUrl(normalised)) {
                  console.log(`[Non-beer hero] Found og:image: ${normalised.substring(0, 100)}...`);
                  return { heroUrl: normalised };
                }
              }
            }

            // Priority 2: twitter:image meta tag
            const twitterImageMeta = doc.querySelector('meta[name="twitter:image"]');
            if (twitterImageMeta) {
              const content = twitterImageMeta.getAttribute("content");
              if (content) {
                const normalised = normaliseNonBeerUrl(content, pageUrl);
                if (normalised && isLikelyImageUrl(normalised)) {
                  console.log(`[Non-beer hero] Found twitter:image: ${normalised.substring(0, 100)}...`);
                  return { heroUrl: normalised };
                }
              }
            }

            // Priority 3: Hero image from <main> element (or body fallback)
            const mainElement = doc.querySelector("main") || doc.querySelector("body");
            if (mainElement) {
              // Get all images within main content
              const imgs = mainElement.querySelectorAll("img");

              // First pass: look for page_hero images
              for (const img of imgs) {
                const imgEl = img as any;
                const src = imgEl.getAttribute("src") || imgEl.getAttribute("data-src");
                const srcset = imgEl.getAttribute("srcset");
                const alt = imgEl.getAttribute("alt") || "";
                const className = imgEl.getAttribute("class") || "";

                if (!src || src.startsWith("data:")) continue;
                if (shouldExcludeImage(src, alt, className)) continue;

                const normalised = normaliseNonBeerUrl(src, pageUrl);
                if (!normalised) continue;

                // Check for page_hero pattern (highest priority within main)
                const lower = normalised.toLowerCase();
                if (lower.includes("/styles/page_hero/") || lower.includes("page_hero")) {
                  console.log(`[Non-beer hero] Found page_hero img: ${normalised.substring(0, 100)}...`);
                  return { heroUrl: normalised, caption: alt || undefined };
                }
              }

              // Second pass: first significant image in main (not a logo/icon)
              for (const img of imgs) {
                const imgEl = img as any;
                const src = imgEl.getAttribute("src") || imgEl.getAttribute("data-src");
                const srcset = imgEl.getAttribute("srcset");
                const alt = imgEl.getAttribute("alt") || "";
                const className = imgEl.getAttribute("class") || "";

                if (!src || src.startsWith("data:")) continue;
                if (shouldExcludeImage(src, alt, className)) continue;

                // Use srcset first URL if available
                let urlToUse = src;
                if (srcset) {
                  const firstSrcsetUrl = srcset.split(",")[0]?.trim().split(/\s+/)[0];
                  if (firstSrcsetUrl) {
                    urlToUse = firstSrcsetUrl;
                  }
                }

                const normalised = normaliseNonBeerUrl(urlToUse, pageUrl);
                if (!normalised) continue;

                // Accept snsites.co.uk CDN images or /sites/default/files/ paths
                const lower = normalised.toLowerCase();
                if (lower.includes("snsites.co.uk/sites/default/files/") || lower.includes("/sites/default/files/")) {
                  console.log(`[Non-beer hero] Found main content img: ${normalised.substring(0, 100)}...`);
                  return { heroUrl: normalised, caption: alt || undefined };
                }
              }

              // Third pass: any reasonable image in main content
              for (const img of imgs) {
                const imgEl = img as any;
                const src = imgEl.getAttribute("src") || imgEl.getAttribute("data-src");
                const alt = imgEl.getAttribute("alt") || "";
                const className = imgEl.getAttribute("class") || "";

                if (!src || src.startsWith("data:")) continue;
                if (shouldExcludeImage(src, alt, className)) continue;

                const normalised = normaliseNonBeerUrl(src, pageUrl);
                if (normalised && isLikelyImageUrl(normalised)) {
                  console.log(`[Non-beer hero] Found fallback main img: ${normalised.substring(0, 100)}...`);
                  return { heroUrl: normalised, caption: alt || undefined };
                }
              }
            }

            console.log("[Non-beer hero] No suitable hero image found");
            return { heroUrl: null };
          } catch (err) {
            console.log("[Non-beer hero] Error parsing HTML:", err);
            return { heroUrl: null };
          }
        }

        // Default fallback hero image for non-beer pages when no hero is found
        // Using the corporate hero image from the website
        const DEFAULT_NON_BEER_HERO_URL =
          "https://snsites.co.uk/sites/default/files/styles/page_hero/public/shepherd-neame-brewery-hero.jpg";

        // Extract hero image
        const nonBeerImages = extractNonBeerHeroImageFromHtml(html, canonicalUrl);
        const heroImageUrl = nonBeerImages.heroUrl || DEFAULT_NON_BEER_HERO_URL;

        // The corporate logo is already defined as ORG_LOGO_URL at the top of this file
        // All non-beer pages use this single consistent logo
        const logoUrl = ORG_LOGO_URL;

        console.log(`✓ Non-beer hero image: ${heroImageUrl.substring(0, 100)}...`);

        // Build ImageObject for WebPage hero
        const heroImageObject: any = {
          "@type": "ImageObject",
          url: heroImageUrl,
          contentUrl: heroImageUrl,
        };

        // Add caption if available
        if (nonBeerImages.caption) {
          heroImageObject.caption = nonBeerImages.caption;
        }

        // Apply hero image to WebPage node(s)
        webPageNodes.forEach((node: any) => {
          node.image = heroImageObject;
          node.primaryImageOfPage = heroImageObject;
        });

        // Also wire hero + logo to the primary mainEntity for this non-beer page
        const primaryWebPageNode = webPageNodes.find((node: any) => node.url === canonicalUrl);
        if (primaryWebPageNode) {
          // Prefer mainEntity, fall back to about
          const mainEntityId =
            (primaryWebPageNode.mainEntity &&
              typeof primaryWebPageNode.mainEntity === "object" &&
              (primaryWebPageNode.mainEntity as any)["@id"]) ||
            (primaryWebPageNode.about &&
              typeof primaryWebPageNode.about === "object" &&
              (primaryWebPageNode.about as any)["@id"]) ||
            null;

          if (mainEntityId) {
            const mainEntityNode = graph.find((node: any) => node["@id"] === mainEntityId);
            if (mainEntityNode) {
              // Use the same hero image for the main entity image
              (mainEntityNode as any).image = heroImageObject;

              // Ensure the main entity exposes a corporate logo for Schema Weaver
              if (!(mainEntityNode as any).logo) {
                (mainEntityNode as any).logo = {
                  "@type": "ImageObject",
                  url: logoUrl,
                  contentUrl: logoUrl,
                };
              }
              console.log(`✓ Set mainEntity image + logo for ${mainEntityId}`);
            }
          }
        }

        if (webPageNodes.length > 0) {
          console.log(`✓ Set WebPage.image + primaryImageOfPage on ${webPageNodes.length} node(s)`);
        }

        // Ensure Organization node has consistent logo (should already be set in STEP 1a)
        // This is defensive - logo should already be correct
        if (orgNode && !orgNode.logo) {
          orgNode.logo = {
            "@type": "ImageObject",
            url: logoUrl,
          };
          console.log("✓ Set Organization.logo (defensive)");
        }
      }

      // Update the graph in the jsonld object
      v2Jsonld["@graph"] = graph;

      // ========================================
      // SCHEMA QUALITY CHARTER VALIDATION
      // ----------------------------------------
      // Validate that enforcements worked correctly
      // ========================================

      // Rule: mustLinkToCanonicalOrg
      // Check for canonical Organization node
      const hasOrgNode = graph.some((node: any) => node["@id"] === "https://www.shepherdneame.co.uk/#organization");
      if (!hasOrgNode) {
        charterWarnings.push(
          "CHARTER VIOLATION: Missing canonical Organization node (@id: https://www.shepherdneame.co.uk/#organization)",
        );
      } else {
        // Check that key entities link to Organization (string or object form)
        const hasOrgReferences = graph.some(
          (node: any) =>
            node.publisher === "https://www.shepherdneame.co.uk/#organization" ||
            (typeof node.publisher === "object" &&
              node.publisher?.["@id"] === "https://www.shepherdneame.co.uk/#organization") ||
            node.manufacturer === "https://www.shepherdneame.co.uk/#organization" ||
            (typeof node.manufacturer === "object" &&
              node.manufacturer?.["@id"] === "https://www.shepherdneame.co.uk/#organization") ||
            node.parentOrganization === "https://www.shepherdneame.co.uk/#organization" ||
            (typeof node.parentOrganization === "object" &&
              node.parentOrganization?.["@id"] === "https://www.shepherdneame.co.uk/#organization") ||
            node.brand === "https://www.shepherdneame.co.uk/#organization" ||
            (typeof node.brand === "object" && node.brand?.["@id"] === "https://www.shepherdneame.co.uk/#organization"),
        );
        if (!hasOrgReferences) {
          charterWarnings.push("CHARTER WARNING: No entities link to the canonical Organization node");
        }
      }

      // Rule: mustLinkToWebsite
      // Check that WebPage nodes link to WebSite via isPartOf (should be enforced already)
      const hasWebsiteLink = webPageNodes.every(
        (node: any) =>
          node.isPartOf === "https://www.shepherdneame.co.uk/#website" ||
          (typeof node.isPartOf === "object" && node.isPartOf?.["@id"] === "https://www.shepherdneame.co.uk/#website"),
      );
      if (webPageNodes.length > 0 && !hasWebsiteLink) {
        charterWarnings.push("CHARTER WARNING: Not all WebPage nodes link to the main Website via isPartOf");
      }

      // Rule: requireVisibleFAQForFAQSchema
      // Check if FAQ schema is present when faq_mode is not 'auto' or has_faq is false
      const hasFAQSchema = graph.some((node: any) => {
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        return types.includes("FAQPage") || types.includes("Question");
      });
      if (hasFAQSchema && (page.faq_mode === "ignore" || !page.has_faq)) {
        charterWarnings.push("CHARTER WARNING: FAQ schema present but FAQ mode is disabled or no FAQ content detected");
      }

      // Rule: enforceStableIds
      // Check for duplicate @id values
      const seenIds = new Set<string>();
      const duplicateIds: string[] = [];
      graph.forEach((node: any) => {
        if (node["@id"]) {
          if (seenIds.has(node["@id"])) {
            duplicateIds.push(node["@id"]);
          } else {
            seenIds.add(node["@id"]);
          }
        }
      });
      if (duplicateIds.length > 0) {
        charterWarnings.push(`CHARTER VIOLATION: Duplicate @id values found: ${duplicateIds.join(", ")}`);
      }

      // Rule: oneMainEntityPerPage
      // Count primary WebPage nodes with mainEntity or about properties
      // NOTE: This only checks true WebPage nodes, not specialized types like FAQPage
      // A WebPage + FAQPage combination is valid and should not trigger this warning
      const webPagesWithMainEntity = webPageNodes.filter((node: any) => node.mainEntity || node.about);
      if (webPagesWithMainEntity.length > 1) {
        charterWarnings.push(
          "CHARTER WARNING: Multiple WebPage nodes with mainEntity/about detected - page may have competing primary entities",
        );
      }

      // ========================================
      // FINAL ORG/WEBSITE CONSISTENCY VALIDATION
      // ----------------------------------------
      // Ensure exactly one Organization and one WebSite node exist
      // This is critical for graph consistency across all pages
      // ========================================
      const orgCount = graph.filter((node: any) => {
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        return types.includes("Organization") || types.includes("Corporation");
      }).length;

      const websiteCount = graph.filter((node: any) => {
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        return types.includes("WebSite");
      }).length;

      if (orgCount !== 1 || websiteCount !== 1) {
        console.error(`[Org/WebSite Validation] ERROR: Expected exactly 1 Organization and 1 WebSite, found Org=${orgCount}, WebSite=${websiteCount}`);
        charterWarnings.push(
          `ORG CONSISTENCY VIOLATION: Expected exactly one Organization and one WebSite node, found Org=${orgCount}, WebSite=${websiteCount}.`
        );
      } else {
        console.log("✓ Org/WebSite validation passed: Exactly 1 Organization and 1 WebSite node");
      }

      // Log all Charter warnings
      if (charterWarnings.length > 0) {
        console.warn("=== Schema Quality Charter Warnings ===");
        charterWarnings.forEach((warning) => console.warn(warning));
        console.warn("=======================================");
        console.warn(
          `Charter compliance: ${charterWarnings.filter((w) => w.includes("VIOLATION")).length} violations, ${charterWarnings.filter((w) => w.includes("WARNING")).length} warnings`,
        );
        console.warn("See docs/schema-quality-charter.md for quality standards");
      } else {
        console.log("✓ Schema Quality Charter: All checks passed");
      }

      // ========================================
      // FINAL BEER-DOMAIN VALIDATION
      // ----------------------------------------
      // Beer Domain Rule v2.3: Brand-first, non-transactional
      // Final safety check: Beer-domain @graph must NEVER contain:
      // - Product, Offer, AggregateOffer, or any ecommerce types
      // This is a last-line-of-defence validation after all processing.
      // ========================================
      if (pageDomain === "Beer") {
        const commerceTypes = ["Product", "Offer", "AggregateOffer", "ProductModel"];
        const offendingNodes: string[] = [];

        graph.forEach((node: any) => {
          const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
          const foundCommerce = types.filter((t: string) => commerceTypes.includes(t));
          if (foundCommerce.length > 0) {
            offendingNodes.push(`${node["@id"] || "unknown"} (${foundCommerce.join(", ")})`);
          }
        });

        if (offendingNodes.length > 0) {
          // Log error but also defensively strip them out
          console.error(`[Beer Domain Validation] ERROR: Found ${offendingNodes.length} commerce node(s) in Beer-domain schema:`);
          offendingNodes.forEach((n) => console.error(`  - ${n}`));
          charterWarnings.push(`BEER DOMAIN VIOLATION: Found Product/Offer schema in Beer-domain output: ${offendingNodes.join("; ")}`);

          // Defensive removal (should not be needed if earlier steps worked correctly)
          for (let i = graph.length - 1; i >= 0; i--) {
            const node = graph[i];
            const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
            const hasCommerceType = types.some((t: string) => commerceTypes.includes(t));
            if (hasCommerceType) {
              graph.splice(i, 1);
            }
          }
          console.log(`✓ Defensively removed commerce nodes from Beer-domain output`);
        } else {
          console.log("✓ Beer-domain validation passed: No Product/Offer nodes in output");
        }
      }

      // ========================================
      // WIKIDATA SAMEAS INJECTION
      // ----------------------------------------
      // If this is a Beer page with a wikidata_qid, inject the sameAs URL
      // into the main Beer entity (typically a Brand node)
      // ========================================
      if (pageDomain === "Beer" && page.wikidata_qid && v2Jsonld["@graph"]) {
        const wikidataUrl = `https://www.wikidata.org/wiki/${page.wikidata_qid}`;
        console.log(`Injecting Wikidata sameAs: ${wikidataUrl}`);

        // Find the main beer entity in the graph (typically has @type containing "Brand")
        // and inject/append sameAs
        const graph = v2Jsonld["@graph"];
        for (let i = 0; i < graph.length; i++) {
          const node = graph[i];
          const nodeTypes = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];

          // Look for Brand nodes (main beer entity)
          if (nodeTypes.includes("Brand")) {
            if (!node.sameAs) {
              node.sameAs = [wikidataUrl];
            } else if (Array.isArray(node.sameAs)) {
              if (!node.sameAs.includes(wikidataUrl)) {
                node.sameAs.push(wikidataUrl);
              }
            } else {
              // sameAs is a single string, convert to array
              node.sameAs = [node.sameAs, wikidataUrl];
            }
            console.log(`Added Wikidata sameAs to Brand node: ${node["@id"]}`);
            break; // Only inject once
          }
        }
      }

      // Save v2 schema version
      const v2JsonldString = JSON.stringify(v2Jsonld, null, 2);

      const encoder = new TextEncoder();
      const data = encoder.encode(v2JsonldString);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const v2SchemaHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: existingVersions, error: versionsError } = await supabase
        .from("schema_versions")
        .select("version_number")
        .eq("page_id", page_id)
        .order("version_number", { ascending: false })
        .limit(1);

      const nextVersionNumber =
        existingVersions && existingVersions.length > 0 ? existingVersions[0].version_number + 1 : 1;

      const { data: v2SchemaVersion, error: v2SchemaError } = await supabase
        .from("schema_versions")
        .insert({
          page_id: page_id,
          version_number: nextVersionNumber,
          jsonld: v2JsonldString,
          status: "draft",
          created_by_user_id: userId,
          rules_id: usedRuleId,
          google_rr_passed: false,
        })
        .select()
        .single();

      if (v2SchemaError) {
        console.error("Error saving v2 schema version:", v2SchemaError);
        return new Response(JSON.stringify({ error: "Failed to save schema version" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("pages")
        .update({
          last_schema_generated_at: new Date().toISOString(),
          last_schema_hash: v2SchemaHash,
          status: "ai_draft",
          last_modified_by_user_id: userId,
        })
        .eq("id", page_id);

      await supabase.from("audit_log").insert({
        user_id: userId || "system",
        entity_type: "schema_version",
        entity_id: v2SchemaVersion.id,
        action: "generate_schema",
        details: {
          page_id: page_id,
          page_path: page.path,
          version_number: nextVersionNumber,
          engine_version: "v2",
          page_type: page.page_type,
          category: page.category,
        },
      });

      console.log("v2 Schema generation completed successfully");

      // charterWarnings is derived from the Schema Quality Charter checks and is used by the UI
      // to show Charter compliance per schema run. Empty array if no warnings.
      return new Response(
        JSON.stringify({
          success: true,
          schema_version: v2SchemaVersion,
          version_number: nextVersionNumber,
          engine_version: "v2",
          used_rule: {
            id: matchedRule.id,
            name: matchedRule.name,
            page_type: matchedRule.page_type,
            category: matchedRule.category,
          },
          charterWarnings, // String array of Charter compliance warnings
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Continue with v1 logic below...
    // 2. Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userMessage = `
Generate JSON-LD schema for the following page:

Canonical URL: ${canonicalUrl}
Path: ${page.path}
Section: ${page.section || "unknown"}
Page Type: ${page.page_type || "unknown"}
Has FAQ: ${page.has_faq}
Notes: ${page.notes || "none"}

HTML Content:
${trimmedHtml}

CRITICAL REQUIREMENTS - Your response MUST include:
1. An "@context" field set to "https://schema.org"
2. An "@graph" array containing all entities
3. An Organization node with EXACTLY these properties:
   - "@type": ["Organization", "Corporation"]
   - "@id": "https://www.shepherdneame.co.uk/#organization"
   - "name": "Shepherd Neame Limited"
   - "url": "https://www.shepherdneame.co.uk"

   NOTE: In future versions, the Organization node should be sourced from settings.organization_schema_json 
   instead of being generated inline by the AI. This will ensure a single master Organization node across all pages.

Return ONLY the JSON-LD object. No explanations, no markdown code blocks, just the raw JSON starting with { and ending with }.
`;

    console.log("Calling Lovable AI...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: activeRule.body },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ error: "AI API error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices?.[0]?.message?.content;

    if (!generatedContent) {
      console.error("No content in AI response");
      return new Response(JSON.stringify({ error: "AI returned no content" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("AI response received, length:", generatedContent.length);

    // 3. Validate the response
    let jsonld;
    try {
      // Try to extract JSON from markdown code blocks if present
      let jsonContent = generatedContent.trim();
      if (jsonContent.startsWith("```")) {
        const match = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
          jsonContent = match[1].trim();
        }
      }

      jsonld = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      return new Response(
        JSON.stringify({
          error: "AI did not return valid JSON",
          details: generatedContent.substring(0, 500),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Basic validation
    const validationErrors: string[] = [];

    if (!jsonld["@context"]) {
      validationErrors.push("Missing @context");
    }

    if (!jsonld["@graph"] || !Array.isArray(jsonld["@graph"])) {
      validationErrors.push("Missing or invalid @graph array");
    }

    // Check for Organization node
    // TODO: In future, replace this validation with a check that the Organization node
    // matches the master Organization schema from settings.organization_schema_json
    const orgNode = jsonld["@graph"]?.find(
      (node: any) =>
        node["@id"] === "https://www.shepherdneame.co.uk/#organization" && node.name === "Shepherd Neame Limited",
    );

    if (!orgNode) {
      validationErrors.push("Missing required Organization node with correct @id and name");
    }

    // For beer pages, ensure no Product/Offer schema
    if (page.page_type === "beer_brand" || page.page_type === "beer_collection") {
      const hasCommerce = jsonld["@graph"]?.some((node: any) => {
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        return types.some((t: string) =>
          ["Product", "Offer", "AggregateOffer", "ProductModel", "ItemList"].includes(t),
        );
      });

      if (hasCommerce) {
        validationErrors.push("Beer pages must not include Product or Offer schema");
      }
    }

    if (validationErrors.length > 0) {
      console.error("Validation errors:", validationErrors);
      return new Response(
        JSON.stringify({
          error: "Schema validation failed",
          validation_errors: validationErrors,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Save schema version
    const jsonldString = JSON.stringify(jsonld, null, 2);

    // Calculate hash
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonldString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const schemaHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Get the next version number
    const { data: existingVersions, error: versionsError } = await supabase
      .from("schema_versions")
      .select("version_number")
      .eq("page_id", page_id)
      .order("version_number", { ascending: false })
      .limit(1);

    const nextVersionNumber =
      existingVersions && existingVersions.length > 0 ? existingVersions[0].version_number + 1 : 1;

    // Insert schema version
    const { data: schemaVersion, error: schemaError } = await supabase
      .from("schema_versions")
      .insert({
        page_id: page_id,
        version_number: nextVersionNumber,
        jsonld: jsonldString,
        status: "draft",
        created_by_user_id: userId,
        rules_id: activeRule.id,
        google_rr_passed: false,
      })
      .select()
      .single();

    if (schemaError) {
      console.error("Error saving schema version:", schemaError);
      return new Response(JSON.stringify({ error: "Failed to save schema version" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update page
    const { error: pageUpdateError } = await supabase
      .from("pages")
      .update({
        last_schema_generated_at: new Date().toISOString(),
        last_schema_hash: schemaHash,
        status: "ai_draft",
        last_modified_by_user_id: userId,
      })
      .eq("id", page_id);

    if (pageUpdateError) {
      console.error("Error updating page:", pageUpdateError);
    }

    // 6. Audit log
    await supabase.from("audit_log").insert({
      user_id: userId || "system",
      entity_type: "schema_version",
      entity_id: schemaVersion.id,
      action: "generate_schema",
      details: {
        page_id: page_id,
        page_path: page.path,
        version_number: nextVersionNumber,
        rule_id: activeRule.id,
        rule_name: activeRule.name,
      },
    });

    console.log("Schema generation completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        schema_version: schemaVersion,
        version_number: nextVersionNumber,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in generate-schema function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
