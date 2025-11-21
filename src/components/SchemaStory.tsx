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
      // Build opening sentence with available facts
      const parts = [];
      parts.push(`${entityName} is`);
      
      if (summary.keyFacts.style) {
        parts.push(`a ${summary.keyFacts.style}`);
      }
      
      if (summary.keyFacts.abv) {
        parts.push(`at ${summary.keyFacts.abv} ABV`);
      }
      
      parts.push(`brewed by Shepherd Neame in Kent.`);
      
      return parts.join(" ").replace(" is a ", " is a ").replace(" is at ", " at ");
    } else if (summary.keyFacts.type === "article") {
      const headline = summary.keyFacts.headline || entityName;
      const date = summary.keyFacts.datePublished ? new Date(summary.keyFacts.datePublished).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }) : null;
      
      let story = `"${headline}" is ${summary.keyFacts.author ? `a piece by ${summary.keyFacts.author}` : 'an article'}`;
      if (date) {
        story += `, published on ${date}`;
      }
      story += `, telling the story of Shepherd Neame's ${sectionName}.`;
      
      return story;
    } else {
      return `This page serves as ${entityType === "WebPage" ? "a key corporate page" : `an ${entityType}`} for Shepherd Neame Limited, ${summary.keyFacts.about ? `focused on ${summary.keyFacts.about}` : 'sharing essential information about the company'}.`;
    }
  };

  const renderFlavourStory = () => {
    if (summary.keyFacts.type !== "beer") return null;
    
    const sentences = [];
    
    // Build flavour and mouthfeel sentence
    const flavourParts = [];
    
    if (summary.keyFacts.colour) {
      flavourParts.push(`pours ${summary.keyFacts.colour}`);
    }
    
    const tasteParts = [];
    if (summary.keyFacts.aroma) {
      tasteParts.push(summary.keyFacts.aroma);
    }
    if (summary.keyFacts.taste) {
      tasteParts.push(summary.keyFacts.taste);
    }
    
    if (tasteParts.length > 0) {
      const tasteText = tasteParts.join(", with ");
      if (flavourParts.length > 0) {
        sentences.push(`It ${flavourParts[0]} and delivers ${tasteText}.`);
      } else {
        sentences.push(`It delivers ${tasteText}.`);
      }
    } else if (flavourParts.length > 0) {
      sentences.push(`It ${flavourParts[0]}.`);
    }
    
    return sentences.length > 0 ? sentences.join(" ") : null;
  };

  const renderProvenance = () => {
    if (summary.keyFacts.type !== "beer") return null;
    
    const parts = [];
    
    if (summary.keyFacts.waterSource) {
      parts.push(`brewed with water ${summary.keyFacts.waterSource}`);
    }
    
    if (summary.keyFacts.hops) {
      parts.push(`hopped with ${summary.keyFacts.hops}`);
    }
    
    if (parts.length === 0) return null;
    
    return `It's ${parts.join(" and ")}.`;
  };

  const renderWhyItMatters = () => {
    if (summary.keyFacts.type === "beer") {
      return "Behind the scenes, the schema tells search engines that this is a Shepherd Neame beer brand in the Beers section, not a product listing. It links back to Shepherd Neame Limited as the parent organisation and avoids any price or SKU data, so the corporate page stays clean and accurate.";
    } else if (summary.keyFacts.type === "article") {
      return "The schema marks this clearly as editorial content from Shepherd Neame, linking back to the organisation and ensuring search engines understand this is news rather than advertising or product information.";
    } else {
      return "The schema connects this page to Shepherd Neame Limited as the parent organisation, helping search engines understand the corporate structure and how this page fits into the broader site architecture.";
    }
  };

  return (
    <div className="prose prose-sm max-w-none space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">In plain English</h3>
        <div className="space-y-4 text-foreground/90 leading-relaxed">
          <p>{renderIntro()}</p>
          
          {summary.keyFacts.type === "beer" && renderFlavourStory() && (
            <p>{renderFlavourStory()}</p>
          )}
          
          {summary.keyFacts.type === "beer" && renderProvenance() && (
            <p>{renderProvenance()}</p>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-base font-semibold mb-3">Why this matters for search & AI</h4>
        <p className="text-foreground/90 leading-relaxed">
          {renderWhyItMatters()}
        </p>
      </div>
    </div>
  );
}
