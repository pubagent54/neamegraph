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

  // --- Try to read extra beer facts directly from the JSON-LD ---------------

  type BeerExtraFacts = {
    formats?: string;
    provenance?: string;
    ibu?: string;
  };

  let beerExtraFacts: BeerExtraFacts = {};

  if (summary.keyFacts?.type === "beer" && jsonld) {
    try {
      const parsed = JSON.parse(jsonld);
      const graph = Array.isArray(parsed?.["@graph"])
        ? parsed["@graph"]
        : [];

      // Prefer the Brand node that matches the main entity, otherwise first Brand
      const mainId = summary.mainEntity?.id;
      let brandNode: any =
        graph.find((node: any) => {
          const types = node?.["@type"];
          const asArray = Array.isArray(types) ? types : [types];
          return asArray?.includes("Brand") && node?.["@id"] === mainId;
        }) ||
        graph.find((node: any) => {
          const types = node?.["@type"];
          const asArray = Array.isArray(types) ? types : [types];
          return asArray?.includes("Brand");
        });

      if (brandNode && Array.isArray(brandNode.additionalProperty)) {
        const extras: BeerExtraFacts = {};
        for (const prop of brandNode.additionalProperty) {
          const name = (prop?.name || "").toString().toLowerCase();
          const value = prop?.value?.toString();
          if (!value) continue;

          if (name === "formats" || name === "format") {
            extras.formats = value;
          } else if (name === "provenance") {
            extras.provenance = value;
          } else if (name === "ibu" || name === "ibus") {
            extras.ibu = value;
          }
        }
        beerExtraFacts = extras;
      }
    } catch {
      // If parsing fails, we just fall back to whatever keyFacts gives us.
    }
  }

  // --- Plain-language intro --------------------------------------------------

  const renderIntro = () => {
    if (summary.keyFacts?.type === "beer") {
      const { style, colour, abv } = summary.keyFacts;

      const hasColour = !!colour;
      const hasStyle = !!style;
      const hasAbv = !!abv;

      if (hasColour && hasStyle && hasAbv) {
        // Rich opening: name + colour + style + ABV
        return `This page tells the story of ${entityName}, a ${colour} ${style} from Shepherd Neame, sitting at ${abv} ABV.`;
      } else if (hasStyle && hasAbv) {
        return `This page tells the story of ${entityName}, a ${style} at ${abv} ABV brewed by Shepherd Neame in Kent.`;
      } else if (hasStyle) {
        return `This page tells the story of ${entityName}, a ${style} brewed by Shepherd Neame in Kent.`;
      } else {
        return `This page tells the story of ${entityName}, a Shepherd Neame beer brand brewed in Kent.`;
      }
    }

    if (summary.keyFacts?.type === "article") {
      const headline = summary.keyFacts.headline || entityName;
      const date = summary.keyFacts.datePublished
        ? new Date(summary.keyFacts.datePublished).toLocaleDateString(
            "en-GB",
            {
              day: "numeric",
              month: "long",
              year: "numeric",
            }
          )
        : null;

      let story = `"${headline}" is ${
        summary.keyFacts.author ? `a piece by ${summary.keyFacts.author}` : "an article"
      }`;
      if (date) {
        story += `, published on ${date}`;
      }
      story += `, telling part of Shepherd Neame&apos;s ${sectionName} story.`;

      return story;
    }

    // Generic corporate page
    return `This page serves as ${
      entityType === "WebPage"
        ? "a corporate page"
        : `an ${entityType} page`
    } for Shepherd Neame Limited, ${
      summary.keyFacts?.about
        ? `focused on ${summary.keyFacts.about}.`
        : "sharing important information about the company."
    }`;
  };

  // --- Beer flavour / sensory story ------------------------------------------

  const renderFlavourStory = () => {
    if (summary.keyFacts?.type !== "beer") return null;

    const { colour, aroma, taste } = summary.keyFacts;

    const hasColour = !!colour;
    const hasAroma = !!aroma;
    const hasTaste = !!taste;

    if (!hasColour && !hasAroma && !hasTaste) return null;

    let description = "";

    if (hasColour && (hasAroma || hasTaste)) {
      description = `On the flavour side, it pours ${colour} and delivers `;
      const flavourNotes: string[] = [];
      if (hasAroma) flavourNotes.push(aroma);
      if (hasTaste) flavourNotes.push(taste);
      description += flavourNotes.join(", with ") + ".";
    } else if (hasColour) {
      description = `On the flavour side, it pours ${colour}.`;
    } else {
      const flavourNotes: string[] = [];
      if (hasAroma) flavourNotes.push(aroma);
      if (hasTaste) flavourNotes.push(taste);
      description = `On the flavour side, it delivers ${flavourNotes.join(
        ", with "
      )}.`;
    }

    return description;
  };

  // --- Beer provenance: hops, water, awards, heritage ------------------------

  const renderProvenance = () => {
    if (summary.keyFacts?.type !== "beer") return null;

    const { waterSource, hops, awards, heritage } = summary.keyFacts;

    const hasWater = !!waterSource;
    const hasHops = !!hops;
    const hasAwards = !!awards;
    const hasHeritage = !!heritage;

    if (!hasWater && !hasHops && !hasAwards && !hasHeritage) return null;

    let story = "";

    if (hasWater || hasHops) {
      const brewingParts: string[] = [];
      if (hasWater) {
        brewingParts.push(`brewed with water ${waterSource}`);
      }
      if (hasHops) {
        brewingParts.push(`hopped with ${hops}`);
      }
      story = `It&apos;s ${brewingParts.join(" and ")}`;
    }

    if (hasAwards || hasHeritage) {
      const credentials: string[] = [];
      if (hasAwards) credentials.push(awards);
      if (hasHeritage) credentials.push(heritage);

      const pedigreeText = credentials.join(", ");

      if (story) {
        story += `, with a pedigree that includes ${pedigreeText}.`;
      } else {
        story = `With a pedigree that includes ${pedigreeText}.`;
      }
    } else if (story) {
      story += ".";
    }

    return story || null;
  };

  // --- Beer fact summary (ABV, style, formats, provenance, IBU) --------------

  const renderBeerFactSummary = () => {
    if (summary.keyFacts?.type !== "beer") return null;

    const facts: string[] = [];

    if (summary.keyFacts.abv) {
      facts.push(`ABV ${summary.keyFacts.abv}%`);
    }

    if (summary.keyFacts.style) {
      facts.push(summary.keyFacts.style);
    }

    if (summary.keyFacts.colour) {
      facts.push(`${summary.keyFacts.colour.toLowerCase()} colour`);
    }

    if (beerExtraFacts.ibu) {
      facts.push(`IBU ${beerExtraFacts.ibu}`);
    }

    if (beerExtraFacts.formats) {
      facts.push(`format: ${beerExtraFacts.formats}`);
    }

    if (beerExtraFacts.provenance) {
      facts.push(beerExtraFacts.provenance);
    }

    if (!facts.length) return null;

    return `Key facts encoded in the schema include ${facts.join(
      ", "
    )}.`;
  };

  // --- How the page fits into the site ---------------------------------------

  const renderHowFits = () => {
    if (summary.keyFacts?.type === "beer") {
      return `This page sits in the beers section of the Shepherd Neame site and marks ${entityName} as one of the brewery&apos;s beer brands. In the schema it links back to Shepherd Neame Limited as the parent organisation and into the Shepherd Neame beers collection, so search engines can see it as part of the wider range rather than an isolated product page.`;
    }

    if (summary.keyFacts?.type === "article") {
      return `This page is part of Shepherd Neame&apos;s editorial content, sitting within the ${sectionName} area and linked back to Shepherd Neame Limited as publisher. That tells search engines it belongs to the brewery&apos;s news and storytelling layer, alongside other articles on the site.`;
    }

    // Generic corporate page
    return `This page forms part of the Shepherd Neame corporate site and is linked back to Shepherd Neame Limited as the parent organisation. That makes it clear that this content belongs to the brewery&apos;s corporate story, alongside other sections such as beers, pubs, history, sustainability and investors.`;
  };

  // --- Why the schema is safe & useful ---------------------------------------

  const renderWhySafe = () => {
    if (summary.keyFacts?.type === "beer") {
      return `For this beer brand, the schema sticks to what&apos;s clearly on the page: the brand name, its place in the beers collection, key details like style, colour, ABV and flavour notes, plus any provenance or awards that are explicitly mentioned. It avoids any price, SKU or ecommerce-style data, so search engines see this as a corporate brand page, not a sales listing. That gives AI and search a rich, trustworthy view of the beer without over-claiming.`;
    }

    if (summary.keyFacts?.type === "article") {
      return `For editorial content, the schema simply marks this out as a news or blog-style article from Shepherd Neame, with dates, headline and publisher where available. That helps search engines and AI understand it as part of the brewery&apos;s storytelling rather than advertising or product information, while staying firmly within the facts visible on the page.`;
    }

    return `For this kind of corporate page, the structured data focuses on the essentials: that it belongs to Shepherd Neame Limited, what the page is about, and where it sits in the overall site. Keeping to those on-page facts gives search engines and AI a clean, trustworthy signal about how this content fits into the wider Shepherd Neame story, without over-claiming or introducing details that visitors can&apos;t see.`;
  };

  // --- Render ----------------------------------------------------------------

  return (
    <div className="prose prose-sm max-w-none space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">In plain English</h3>
        <div className="space-y-3 text-foreground/90 leading-relaxed">
          <p>{renderIntro()}</p>
          {summary.keyFacts?.type === "beer" && renderFlavourStory() && (
            <p>{renderFlavourStory()}</p>
          )}
          {summary.keyFacts?.type === "beer" && renderProvenance() && (
            <p>{renderProvenance()}</p>
          )}
          {summary.keyFacts?.type === "beer" && renderBeerFactSummary() && (
            <p>{renderBeerFactSummary()}</p>
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
