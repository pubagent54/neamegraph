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
      const hasColour = !!summary.keyFacts.colour;
      const hasStyle = !!summary.keyFacts.style;
      const hasAbv = !!summary.keyFacts.abv;
      
      // Choose pattern based on available data
      if (hasColour && hasStyle && hasAbv) {
        // Pattern: "{name} is a {colour} {style} from Shepherd Neame, sitting at {abv} ABV."
        return `${entityName} is a ${summary.keyFacts.colour} ${summary.keyFacts.style} from Shepherd Neame, sitting at ${summary.keyFacts.abv} ABV.`;
      } else if (hasStyle && hasAbv) {
        // Pattern: "{name} is a {style} at {abv} ABV, brewed by Shepherd Neame in Kent."
        return `${entityName} is a ${summary.keyFacts.style} at ${summary.keyFacts.abv} ABV, brewed by Shepherd Neame in Kent.`;
      } else if (hasStyle) {
        return `${entityName} is a ${summary.keyFacts.style}, brewed by Shepherd Neame in Kent.`;
      } else {
        return `${entityName} is brewed by Shepherd Neame in Kent.`;
      }
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
    
    const hasColour = !!summary.keyFacts.colour;
    const hasAroma = !!summary.keyFacts.aroma;
    const hasTaste = !!summary.keyFacts.taste;
    
    if (!hasColour && !hasAroma && !hasTaste) return null;
    
    // Build vivid flavor description
    let description = "";
    
    if (hasColour && (hasAroma || hasTaste)) {
      // Full pattern: "It pours {colour} and delivers {aroma/taste}..."
      description = `It pours ${summary.keyFacts.colour} and delivers `;
      
      const flavorNotes = [];
      if (hasAroma) flavorNotes.push(summary.keyFacts.aroma);
      if (hasTaste) flavorNotes.push(summary.keyFacts.taste);
      
      description += flavorNotes.join(", with ") + ".";
    } else if (hasColour) {
      description = `It pours ${summary.keyFacts.colour}.`;
    } else if (hasAroma || hasTaste) {
      const flavorNotes = [];
      if (hasAroma) flavorNotes.push(summary.keyFacts.aroma);
      if (hasTaste) flavorNotes.push(summary.keyFacts.taste);
      
      description = `It delivers ${flavorNotes.join(", with ")}.`;
    }
    
    return description;
  };

  const renderProvenance = () => {
    if (summary.keyFacts.type !== "beer") return null;
    
    const hasWater = !!summary.keyFacts.waterSource;
    const hasHops = !!summary.keyFacts.hops;
    const hasAwards = !!summary.keyFacts.awards;
    const hasHeritage = !!summary.keyFacts.heritage;
    
    if (!hasWater && !hasHops && !hasAwards && !hasHeritage) return null;
    
    // Build natural provenance narrative
    let story = "";
    
    if (hasWater || hasHops) {
      const brewingParts = [];
      if (hasWater) {
        brewingParts.push(`brewed with water ${summary.keyFacts.waterSource}`);
      }
      if (hasHops) {
        brewingParts.push(`hopped with ${summary.keyFacts.hops}`);
      }
      story = `It's ${brewingParts.join(" and ")}`;
    }
    
    if (hasAwards || hasHeritage) {
      const credentials = [];
      if (hasAwards) credentials.push(summary.keyFacts.awards);
      if (hasHeritage) credentials.push(summary.keyFacts.heritage);
      
      const pedigreeText = credentials.join(", ");
      
      if (story) {
        story += `, with a pedigree that includes ${pedigreeText}.`;
      } else {
        story = `With a pedigree that includes ${pedigreeText}.`;
      }
    } else if (story) {
      story += ".";
    }
    
    return story;
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
