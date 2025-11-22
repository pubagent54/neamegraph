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
        keyFacts.author =
          mainEntity.author?.name || mainEntity.author || undefined;
        keyFacts.publisher =
          mainEntity.publisher?.name || mainEntity.publisher || undefined;
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
    const hasCommerceSchema = graph.some((node) => {
      const types = normaliseTypes(node);
      return types.some(
        (t) =>
          t === "Product" || t === "Offer" || t === "AggregateOffer"
      );
    });

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
    };
  }
}


