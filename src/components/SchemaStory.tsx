import { parseSchemaForSummary } from "@/lib/schema-parser";

interface SchemaStoryProps {
  jsonld: string;
  section?: string | null;
  path: string;
}

export function SchemaStory({ jsonld, section, path }: SchemaStoryProps) {
  const summary = parseSchemaForSummary(jsonld, section);

  if (!summary.mainEntity && !summary.validation?.hasOrganization) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>
          We don&apos;t have a schema story for this version yet. Generate
          schema first, then this tab will explain what it&apos;s saying.
        </p>
      </div>
    );
  }

  const entityName = summary.mainEntity?.name || "this page";
  const entityType = summary.mainEntity?.type || "page";
  const sectionName = section || "the site";

  // Normalise key facts so we don't keep checking for undefined
  const keyFacts = (summary.keyFacts ?? {}) as any;

  // Work out what kind of thing this page is REALLY about
  type EntityKind = "beer" | "article" | "other";

  let entityKind: EntityKind;
  if (keyFacts.type === "beer") {
    entityKind = "beer";
  } else if (keyFacts.type === "article") {
    entityKind = "article";
  } else if (section === "beers" || path.startsWith("/beers")) {
    // Fallback: anything in the beers section is treated as a beer brand
    entityKind = "beer";
  } else if (
    summary.mainEntity?.type === "NewsArticle" ||
    summary.mainEntity?.type === "BlogPosting"
  ) {
    entityKind = "article";
  } else {
    entityKind = "other";
  }

  // --- Plain-language intro --------------------------------------------------

  const renderIntro = () => {
    if (entityKind === "beer") {
      const { style, colour, abv } = keyFacts;

      const hasColour = !!colour;
      const hasStyle = !!style;
      const hasAbv = !!abv;

      if (hasColour && hasStyle && hasAbv) {
        // e.g. "1698 Bottle Conditioned Ale is a copper-bronze Kentish strong ale from Shepherd Neame, sitting at 6.5% ABV."
        return `${entityName} is a ${colour} ${style} from Shepherd Neame, sitting at ${abv} ABV.`;
      } else if (hasStyle && hasAbv) {
        return `${entityName} is a ${style} at ${abv} ABV, brewed by Shepherd Neame in Kent.`;
      } else if (hasStyle) {
        return `${entityName} is a ${style}, brewed by Shepherd Neame in Kent.`;
      } else {
        return `${entityName} is a Shepherd Neame beer brand, brewed in Kent.`;
      }
    }

    if (entityKind === "article") {
      const headline = keyFacts.headline || entityName;
      const date = keyFacts.datePublished
        ? new Date(keyFacts.datePublished).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : null;

      let story = `"${headline}" is ${
        keyFacts.author ? `a piece by ${keyFacts.author}` : "an article"
      }`;
      if (date) {
        story += `, published on ${date}`;
      }
      story += `, telling part of Shepherd Neame's ${sectionName} story.`;

      return story;
    }

    // Generic corporate page
    return `This page serves as ${
      entityType === "WebPage" ? "a key corporate page" : `an ${entityType} page`
    } for Shepherd Neame Limited, ${
      keyFacts.about
        ? `focused on ${keyFacts.about}.`
        : "sharing important information about the company."
    }`;
  };

  // --- Beer flavour / sensory story ------------------------------------------

  const renderFlavourStory = () => {
    if (entityKind !== "beer") return null;

    const { colour, aroma, taste, ibu } = keyFacts;

    const hasColour = !!colour;
    const hasAroma = !!aroma;
    const hasTaste = !!taste;
    const hasIbu = !!ibu;

    if (!hasColour && !hasAroma && !hasTaste && !hasIbu) return null;

    let description = "";

    if (hasColour && (hasAroma || hasTaste)) {
      description = `It pours ${colour} and delivers `;
      const flavourNotes: string[] = [];
      if (hasAroma) flavourNotes.push(aroma);
      if (hasTaste) flavourNotes.push(taste);
      description += flavourNotes.join(", with ") + ".";
    } else if (hasColour) {
      description = `It pours ${colour}.`;
    } else {
      const flavourNotes: string[] = [];
      if (hasAroma) flavourNotes.push(aroma);
      if (hasTaste) flavourNotes.push(taste);
      description = `It delivers ${flavourNotes.join(", with ")}.`;
    }

    if (hasIbu) {
      description += description.endsWith(".")
        ? ` Its bitterness sits around ${ibu} IBUs.`
        : ` Its bitterness sits around ${ibu} IBUs.`;
    }

    return description;
  };

  // --- Beer provenance: hops, water, awards, heritage, serve -----------------

  const renderProvenance = () => {
    if (entityKind !== "beer") return null;

    const { waterSource, hops, awards, heritage, serve } = keyFacts;

    const hasWater = !!waterSource;
    const hasHops = !!hops;
    const hasAwards = !!awards;
    const hasHeritage = !!heritage;
    const hasServe = !!serve;

    if (!hasWater && !hasHops && !hasAwards && !hasHeritage && !hasServe)
      return null;

    let story = "";

    if (hasWater || hasHops) {
      const brewingParts: string[] = [];
      if (hasWater) {
        brewingParts.push(`brewed with water ${waterSource}`);
      }
      if (hasHops) {
        brewingParts.push(`hopped with ${hops}`);
      }
      story = `It's ${brewingParts.join(" and ")}`;
    }

    if (hasAwards || hasHeritage) {
      const credentials: string[] = [];
      if (hasAwards) credentials.push(awards);
      if (hasHeritage) credentials.push(heritage);

      const pedigreeText = credentials.join(", ");

      if (story) {
        story += `, with a pedigree that includes ${pedigreeText}`;
      } else {
        story = `With a pedigree that includes ${pedigreeText}`;
      }
    }

    if (hasServe) {
      story += story ? `. It’s best enjoyed ${serve}.` : `Best enjoyed ${serve}.`;
    } else if (story) {
      story += ".";
    }

    return story || null;
  };

  // --- How the page fits into the site ---------------------------------------

  const renderHowFits = () => {
    if (entityKind === "beer") {
      return `This page sits in the beers section of the Shepherd Neame site and marks ${entityName} as one of the brewery's core beer brands. In the schema it links back to Shepherd Neame Limited as the parent organisation and into the Shepherd Neame beers collection, so search engines can see it as part of the wider range rather than an isolated product page.`;
    }

    if (entityKind === "article") {
      return `This page is part of Shepherd Neame's editorial content, sitting within the ${sectionName} area and linked back to Shepherd Neame Limited as publisher. That tells search engines it belongs to the brewery's news and storytelling layer, alongside other articles on the site.`;
    }

    // Generic corporate page
    return `This page forms part of the Shepherd Neame corporate site and is linked back to Shepherd Neame Limited as the parent organisation. That makes it clear that this content belongs to the brewery's corporate story, alongside other sections such as beers, pubs, history, sustainability and investors.`;
  };

  // --- Why the schema is safe & useful ---------------------------------------

  const renderWhySafe = () => {
    if (entityKind === "beer") {
      return `For this beer brand, the schema sticks to what's clearly on the page: the brand name, its place in the beers collection, key details like style, colour, ABV and flavour notes, plus any provenance or awards that are explicitly mentioned. It avoids any price, SKU or ecommerce-style data, so search engines see this as a corporate brand page, not a sales listing. That gives AI and search a rich, trustworthy view of the beer without over-claiming.`;
    }

    if (entityKind === "article") {
      return `For editorial content, the schema simply marks this out as a news or blog-style article from Shepherd Neame, with dates, headline and publisher where available. That helps search engines and AI understand it as part of the brewery's storytelling rather than advertising or product information, while staying firmly within the facts visible on the page.`;
    }

    return `For this kind of corporate page, the structured data focuses on the essentials: that it belongs to Shepherd Neame Limited, what the page is about, and where it sits in the overall site. Keeping to those on-page facts gives search engines and AI a clean, trustworthy signal about how this content fits into the wider Shepherd Neame story, without over-claiming or introducing details that visitors can't see.`;
  };

  // --- Render ----------------------------------------------------------------

  return (
    <div className="prose prose-sm max-w-none space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">In plain English</h3>
        <div className="space-y-3 text-foreground/90 leading-relaxed">
          <p>{renderIntro()}</p>
          {entityKind === "beer" && renderFlavourStory() && (
            <p>{renderFlavourStory()}</p>
          )}
          {entityKind === "beer" && renderProvenance() && (
            <p>{renderProvenance()}</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">
          How this page fits into the site
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          {renderHowFits()}
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">
          Why this is safe and useful
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          {renderWhySafe()}
        </p>
      </div>
    </div>
  );
}
