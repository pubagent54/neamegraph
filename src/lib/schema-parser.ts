export interface SchemaSummary {
  mainEntity: {
    type: string;
    name: string;
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

export function parseSchemaForSummary(jsonldString: string, section?: string | null): SchemaSummary {
  try {
    const jsonld = JSON.parse(jsonldString);
    const graph = jsonld["@graph"] || [];
    
    // Find organization node
    const orgNode = graph.find((node: any) => 
      node["@id"]?.includes("#organization") || 
      (Array.isArray(node["@type"]) ? node["@type"].includes("Organization") : node["@type"] === "Organization")
    );
    
    // Find WebPage node
    const webPageNode = graph.find((node: any) => {
      const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
      return types.some((t: string) => t?.includes("Page"));
    });
    
    // Find main entity
    const mainEntityId = webPageNode?.mainEntity?.["@id"] || webPageNode?.about?.["@id"];
    const mainEntity = mainEntityId 
      ? graph.find((node: any) => node["@id"] === mainEntityId)
      : null;
    
    // Extract main entity info
    const mainEntityInfo = mainEntity ? {
      type: Array.isArray(mainEntity["@type"]) ? mainEntity["@type"].join(", ") : mainEntity["@type"],
      name: mainEntity.name || "Unnamed entity"
    } : null;
    
    // Find collections
    const collections: Array<{ name: string; url: string }> = [];
    graph.forEach((node: any) => {
      const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
      if (types.includes("CollectionPage") && node.name && node.url) {
        collections.push({ name: node.name, url: node.url });
      }
    });
    
    // Extract key facts based on entity type
    const keyFacts: Record<string, any> = {};
    
    if (mainEntity) {
      const types = Array.isArray(mainEntity["@type"]) ? mainEntity["@type"] : [mainEntity["@type"]];
      
      if (types.includes("Brand")) {
        // Beer brand facts
        keyFacts.type = "beer";
        if (mainEntity.additionalProperty) {
          const props = Array.isArray(mainEntity.additionalProperty) 
            ? mainEntity.additionalProperty 
            : [mainEntity.additionalProperty];
          
          props.forEach((prop: any) => {
            const name = prop.name?.toLowerCase();
            if (name === "abv") keyFacts.abv = prop.value;
            if (name === "style") keyFacts.style = prop.value;
            if (name === "colour" || name === "color") keyFacts.colour = prop.value;
            if (name === "aroma") keyFacts.aroma = prop.value;
            if (name === "taste") keyFacts.taste = prop.value;
            if (name === "water source") keyFacts.waterSource = prop.value;
          });
        }
        keyFacts.hasImage = !!mainEntity.image;
        keyFacts.hasLogo = !!mainEntity.logo;
      } else if (types.includes("NewsArticle") || types.includes("BlogPosting")) {
        // News article facts
        keyFacts.type = "article";
        keyFacts.headline = mainEntity.headline;
        keyFacts.datePublished = mainEntity.datePublished;
        keyFacts.author = mainEntity.author?.name || mainEntity.author;
        keyFacts.publisher = mainEntity.publisher?.name || mainEntity.publisher;
      } else if (types.some((t: string) => t.includes("Page"))) {
        // Other page types
        keyFacts.type = "page";
        keyFacts.pageType = types.find((t: string) => t.includes("Page"));
        keyFacts.about = mainEntity.about?.name || (typeof mainEntity.about === "string" ? mainEntity.about : null);
      }
    }
    
    // Check for commerce schema (should not be present for corporate pages)
    const hasCommerceSchema = graph.some((node: any) => {
      const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
      return types.some((t: string) => 
        t === "Product" || t === "Offer" || t === "AggregateOffer"
      );
    });
    
    return {
      mainEntity: mainEntityInfo,
      connections: {
        organization: !!orgNode,
        collections
      },
      keyFacts,
      validation: {
        hasOrganization: !!orgNode,
        hasMainEntity: !!mainEntity,
        noCommerceSchema: !hasCommerceSchema
      },
      pageType: mainEntityInfo?.type || null
    };
  } catch (error) {
    console.error("Error parsing schema:", error);
    return {
      mainEntity: null,
      connections: {
        organization: false,
        collections: []
      },
      keyFacts: {},
      validation: {
        hasOrganization: false,
        hasMainEntity: false,
        noCommerceSchema: true
      },
      pageType: null
    };
  }
}

