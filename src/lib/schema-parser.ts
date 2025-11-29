// src/lib/schema-parser.ts

export interface SchemaSummary {
  mainEntity: {
    type: string;
    name: string;
    id?: string;
  } | null;
  connections: {
    organization: boolean;
    collections: Array<{ name: string; url: string }>;
  };
  keyFacts: Record<string, any>;
  validation: {
    hasOrganization: boolean;
    hasMainEntity: boolean;
    noCommerceSchema: boolean;
  };
  pageType: string | null;
  images: {
    webPageImage?: string;
    brandImage?: string;
    brandLogo?: string;
  };
}

function normaliseTypes(node: any): string[] {
  if (!node || !node["@type"]) return [];
  return Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
}

export function parseSchemaForSummary(
  jsonld: string,
  section?: string | null
): SchemaSummary {
  try {
    const parsed = JSON.parse(jsonld);
    const graph: any[] = Array.isArray(parsed["@graph"])
      ? parsed["@graph"]
      : [];

    // --- Find organisation node ------------------------------------------------
    const orgNode = graph.find((node) => {
      const types = normaliseTypes(node);
      return (
        node["@id"]?.includes("#organization") ||
        types.includes("Organization") ||
        types.includes("Corporation")
      );
    });

    // --- Find WebPage node -----------------------------------------------------
    const webPageNode = graph.find((node) => {
      const types = normaliseTypes(node);
      return types.some((t) => typeof t === "string" && t.includes("Page"));
    });

    // --- Work out mainEntity ---------------------------------------------------
    const mainEntityId =
      webPageNode?.mainEntity?.["@id"] || webPageNode?.about?.["@id"];

    const mainEntity = mainEntityId
      ? graph.find((node) => node["@id"] === mainEntityId)
      : null;

    const mainEntityInfo = mainEntity
      ? {
          type: normaliseTypes(mainEntity).join(", "),
          name: mainEntity.name || "Unnamed entity",
          id: mainEntity["@id"],
        }
      : null;

    // --- Collections (e.g. beers, pubs, news) ---------------------------------
    const collections: Array<{ name: string; url: string }> = [];
    for (const node of graph) {
      const types = normaliseTypes(node);
      if (types.includes("CollectionPage") && node.name && node.url) {
        collections.push({
          name: node.name,
          url: node.url,
        });
      }
    }

    // --- Key facts -------------------------------------------------------------
    const keyFacts: Record<string, any> = {};

    if (mainEntity) {
      const types = normaliseTypes(mainEntity);

      // Generic description is useful for almost everything
      if (mainEntity.description) {
        keyFacts.description = mainEntity.description;
      }

      // ---- Brand (beer brand, estate brand, etc.) -----------------------------
      if (types.includes("Brand")) {
        keyFacts.type = "beer"; // currently our only Brand use-case

        const additional = mainEntity.additionalProperty;
        const propsArray = additional
          ? Array.isArray(additional)
            ? additional
            : [additional]
          : [];

        const extraProps: Array<{ name: string; value: string }> = [];

        for (const prop of propsArray) {
          if (!prop) continue;
          const rawName = (prop.name || "").toString();
          const name = rawName.toLowerCase();
          const value = prop.value;
          if (!value) continue;

          if (name === "abv") {
            keyFacts.abv = value;
          } else if (name === "style") {
            keyFacts.style = value;
          } else if (name === "colour" || name === "color") {
            keyFacts.colour = value;
          } else if (name === "aroma") {
            keyFacts.aroma = value;
          } else if (name === "taste") {
            keyFacts.taste = value;
          } else if (name === "water source") {
            keyFacts.waterSource = value;
          } else if (name === "hops") {
            keyFacts.hops = value;
          } else if (name === "awards" || name === "award") {
            keyFacts.awards = value;
          } else if (name === "heritage") {
            keyFacts.heritage = value;
          } else if (name === "formats") {
            keyFacts.formats = value;
          } else if (
            name === "provenance" ||
            name === "geographical protection" ||
            name === "geographical protection status"
          ) {
            keyFacts.provenance = value;
          } else {
            // Anything else, keep for future narrative
            extraProps.push({ name: rawName, value });
          }
        }

        if (extraProps.length) {
          keyFacts.extraProperties = extraProps;
        }

        keyFacts.hasImage = !!mainEntity.image;
        keyFacts.hasLogo = !!mainEntity.logo;
      }

      // ---- Articles / news / blog ---------------------------------------------
      else if (
        types.includes("NewsArticle") ||
        types.includes("BlogPosting")
      ) {
        keyFacts.type = "article";
        keyFacts.headline = mainEntity.headline;
        keyFacts.datePublished = mainEntity.datePublished;
        
        // Extract author - handle both string and object formats
        if (mainEntity.author) {
          if (typeof mainEntity.author === 'string') {
            keyFacts.author = mainEntity.author;
          } else if (mainEntity.author.name) {
            keyFacts.author = mainEntity.author.name;
          }
        }
        
        // Extract publisher - handle both string, object with name, and @id reference
        if (mainEntity.publisher) {
          if (typeof mainEntity.publisher === 'string') {
            keyFacts.publisher = mainEntity.publisher;
          } else if (mainEntity.publisher.name) {
            keyFacts.publisher = mainEntity.publisher.name;
          } else if (mainEntity.publisher["@id"]) {
            // Publisher is a reference - try to resolve from graph
            const publisherNode = graph.find(n => n["@id"] === mainEntity.publisher["@id"]);
            if (publisherNode?.name) {
              keyFacts.publisher = publisherNode.name;
            }
          }
        }
      }

      // ---- Generic corporate pages -------------------------------------------
      else if (types.some((t) => typeof t === "string" && t.includes("Page"))) {
        keyFacts.type = "page";
        keyFacts.pageType = types.find(
          (t) => typeof t === "string" && t.includes("Page")
        );
        if (mainEntity.about) {
          if (typeof mainEntity.about === "string") {
            keyFacts.about = mainEntity.about;
          } else if (Array.isArray(mainEntity.about)) {
            keyFacts.about =
              mainEntity.about[0]?.name || mainEntity.about[0] || undefined;
          } else {
            keyFacts.about = mainEntity.about.name || undefined;
          }
        }
      }
    }

    // --- Check for forbidden commerce schema ----------------------------------
    // Product itself is allowed for descriptive purposes (e.g. beers).
    // The real rule: no transactional/e-commerce fields like offers, prices, cart, stock.
    const hasCommerceSchema = graph.some((node) => {
      const types = normaliseTypes(node);
      // Check for explicit e-commerce types
      if (types.some((t) => t === "Offer" || t === "AggregateOffer")) {
        return true;
      }
      // Check for e-commerce properties on any node (especially Product nodes)
      if (node.offers || node.price || node.priceCurrency || node.availability) {
        return true;
      }
      return false;
    });

    // --- Extract image URLs ----------------------------------------------------
    // Helper to extract and normalise image URLs from schema fields
    // Handles both string and array formats, and ensures absolute URLs are preserved unchanged
    const extractImageUrl = (imageField: any): string | undefined => {
      if (!imageField) return undefined;
      
      let rawUrl: string | undefined;
      if (typeof imageField === 'string') {
        rawUrl = imageField;
      } else if (Array.isArray(imageField) && imageField.length > 0) {
        rawUrl = typeof imageField[0] === 'string' ? imageField[0] : undefined;
      }
      
      if (!rawUrl) return undefined;
      
      // If already absolute (http/https), return as-is WITHOUT any encoding
      // This prevents double-encoding of URLs like ?url=%2F becoming ?url%3D%252F
      if (/^https?:\/\//i.test(rawUrl)) {
        return rawUrl;
      }
      
      // Protocol-relative URLs (starts with //)
      if (/^\/\//.test(rawUrl)) {
        return `https:${rawUrl}`;
      }
      
      // Relative path - resolve against base URL
      try {
        const baseUrl = "https://www.shepherdneame.co.uk";
        return new URL(rawUrl, baseUrl).toString();
      } catch {
        return rawUrl;
      }
    };

    const images = {
      webPageImage: extractImageUrl(webPageNode?.image),
      brandImage: extractImageUrl(mainEntity?.image),
      brandLogo: extractImageUrl(mainEntity?.logo),
    };

    return {
      mainEntity: mainEntityInfo,
      connections: {
        organization: !!orgNode,
        collections,
      },
      keyFacts,
      validation: {
        hasOrganization: !!orgNode,
        hasMainEntity: !!mainEntity,
        noCommerceSchema: !hasCommerceSchema,
      },
      pageType: mainEntityInfo?.type || null,
      images,
    };
  } catch (error) {
    console.error("Error parsing schema for summary:", error);
    return {
      mainEntity: null,
      connections: {
        organization: false,
        collections: [],
      },
      keyFacts: {},
      validation: {
        hasOrganization: false,
        hasMainEntity: false,
        noCommerceSchema: true,
      },
      pageType: null,
      images: {
        webPageImage: undefined,
        brandImage: undefined,
        brandLogo: undefined,
      },
    };
  }
}


