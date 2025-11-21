import { parseSchemaForSummary } from "@/lib/schema-parser";

interface SchemaStoryProps {
  jsonld: string;
  section?: string | null;
  path: string;
}

export function SchemaStory({ jsonld, section, path }: SchemaStoryProps) {
  const summary = parseSchemaForSummary(jsonld, section);

  if (!summary.mainEntity && !summary.validation.hasOrganization) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>We don't have a schema story for this version yet. Generate schema first, then this tab will explain what it's saying.</p>
      </div>
    );
  }

  const entityName = summary.mainEntity?.name || "this page";
  const entityType = summary.mainEntity?.type || "page";
  const sectionName = section || "the site";

  // Build the narrative based on the entity type and available data
  const renderIntro = () => {
    if (summary.keyFacts.type === "beer") {
      return `This page tells search engines that ${entityName} is a Shepherd Neame beer brand, sitting within the main ${sectionName} section of the website.`;
    } else if (summary.keyFacts.type === "article") {
      return `This page tells search engines that this is a ${entityType} titled "${summary.keyFacts.headline || entityName}", published as part of Shepherd Neame's ${sectionName} content.`;
    } else {
      return `This page tells search engines that this is ${entityType === "WebPage" ? "a corporate page" : `an ${entityType}`} about ${entityName}, positioned within the ${sectionName} section.`;
    }
  };

  const renderConnections = () => {
    const parts = [];
    
    if (summary.connections.organization) {
      parts.push("We link this page back to Shepherd Neame Limited as the publisher and parent organisation.");
    }

    if (summary.connections.collections.length > 0) {
      const collectionNames = summary.connections.collections.map(c => c.name).join(" and ");
      parts.push(`The page is positioned inside the ${collectionNames} so it's clearly treated as part of ${summary.connections.collections.length === 1 ? "this collection" : "these collections"} rather than a standalone piece.`);
    }

    return parts.join(" ");
  };

  const renderKeyFacts = () => {
    if (summary.keyFacts.type === "beer") {
      const facts = [];
      
      if (summary.keyFacts.style) {
        facts.push(`a ${summary.keyFacts.style}`);
      }
      
      if (summary.keyFacts.abv) {
        facts.push(`at ${summary.keyFacts.abv} ABV`);
      }
      
      if (summary.keyFacts.colour) {
        facts.push(`${summary.keyFacts.colour} in colour`);
      }

      let description = `We describe ${entityName}${facts.length > 0 ? ` as ${facts.join(", ")}` : ""}.`;

      const details = [];
      if (summary.keyFacts.aroma) {
        details.push(`with aromas of ${summary.keyFacts.aroma}`);
      }
      if (summary.keyFacts.taste) {
        details.push(`and flavours of ${summary.keyFacts.taste}`);
      }

      if (details.length > 0) {
        description += ` The schema captures sensory characteristics ${details.join(" ")}.`;
      }

      if (summary.keyFacts.waterSource) {
        description += ` We also flag that it's brewed with water ${summary.keyFacts.waterSource}.`;
      }

      if (summary.keyFacts.hasImage || summary.keyFacts.hasLogo) {
        const visual = [];
        if (summary.keyFacts.hasImage) visual.push("a hero image");
        if (summary.keyFacts.hasLogo) visual.push("a logo");
        description += ` We provide ${visual.join(" and ")} so the brand is visually recognisable.`;
      }

      return description;
    } else if (summary.keyFacts.type === "article") {
      let description = `The schema marks this as a ${entityType}`;
      
      if (summary.keyFacts.headline) {
        description += `, with the headline "${summary.keyFacts.headline}"`;
      }
      
      if (summary.keyFacts.datePublished) {
        const date = new Date(summary.keyFacts.datePublished).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        description += `, published on ${date}`;
      }
      
      if (summary.keyFacts.author) {
        description += ` and credited to ${summary.keyFacts.author}`;
      }
      
      if (summary.keyFacts.publisher) {
        description += `, with ${summary.keyFacts.publisher} as the publisher`;
      }
      
      description += ".";
      return description;
    } else {
      let description = `We present this as ${entityType.startsWith("A") || entityType.startsWith("E") || entityType.startsWith("I") || entityType.startsWith("O") || entityType.startsWith("U") ? "an" : "a"} ${entityType}`;
      
      if (summary.keyFacts.about) {
        description += ` focused on ${summary.keyFacts.about}`;
      } else if (summary.connections.organization) {
        description += ` focused on Shepherd Neame Limited`;
      }
      
      description += ", so search engines understand it describes the company itself rather than a single product or news story.";
      return description;
    }
  };

  const renderCompliance = () => {
    if (summary.keyFacts.type === "beer") {
      return "Importantly, this schema treats the beer as a brand and avoids any price or SKU information, so the corporate page stays clean and accurate.";
    } else if (summary.keyFacts.type === "article") {
      return "The schema focuses on the editorial content without any commercial elements, keeping the page clearly positioned as news rather than advertising.";
    } else {
      return "We're being conservative with the data we include, only marking up information that's clearly present on the page and relevant to this corporate context.";
    }
  };

  return (
    <div className="prose prose-sm max-w-none space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">In plain English</h3>
        <p className="text-foreground/90 leading-relaxed">
          {renderIntro()}
        </p>
      </div>

      {(summary.connections.organization || summary.connections.collections.length > 0) && (
        <div>
          <h4 className="text-base font-semibold mb-3">How this page fits into the site</h4>
          <p className="text-foreground/90 leading-relaxed">
            {renderConnections()}
          </p>
        </div>
      )}

      {Object.keys(summary.keyFacts).length > 0 && (
        <div>
          <h4 className="text-base font-semibold mb-3">Key facts we're highlighting</h4>
          <p className="text-foreground/90 leading-relaxed">
            {renderKeyFacts()}
          </p>
        </div>
      )}

      <div>
        <h4 className="text-base font-semibold mb-3">Why this is safe and useful</h4>
        <p className="text-foreground/90 leading-relaxed">
          {renderCompliance()}
        </p>
      </div>
    </div>
  );
}
