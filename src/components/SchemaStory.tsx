// src/components/SchemaStory.tsx

import { parseSchemaForSummary } from "@/lib/schema-parser";

interface SchemaStoryProps {
  jsonld: string;
  section?: string | null;
  path: string;
}

export function SchemaStory({ jsonld, section }: SchemaStoryProps) {
  const summary = parseSchemaForSummary(jsonld, section);

  if (!summary.mainEntity && !summary.validation.hasOrganization) {
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

  // ---------------------------------------------------------------------------
  // In plain English
  // ---------------------------------------------------------------------------

  const renderIntro = () => {
    // --- Beer brands ---------------------------------------------------------
    if (summary.keyFacts.type === "beer") {
      const {
        style,
        colour,
        abv,
        description,
        formats,
        provenance,
      } = summary.keyFacts;

      const hasColour = !!colour;
      const hasStyle = !!style;
      const hasAbv = !!abv;

      const sentences: string[] = [];

      if (hasColour && hasStyle && hasAbv) {
        sentences.push(
          `${entityName} is a ${colour} ${style} from Shepherd Neame, sitting at ${abv} ABV.`
        );
      } else if (hasStyle && hasAbv) {
        sentences.push(
          `${entityName} is a ${style} at ${abv} ABV, brewed by Shepherd Neame in Kent.`
        );
      } else if (hasStyle) {
        sentences.push(
          `${entityName} is a ${style}, brewed by Shepherd Neame in Kent.`
        );
      } else {
        sentences.push(
          `${entityName} is a Shepherd Neame beer brand, brewed in Kent.`
        );
      }

      // If the Brand node carries a rich description, surface it directly.
      if (description) {
        sentences.push(description);
      }

      // Add formats / provenance if present.
      if (formats || provenance) {
        if (formats && provenance) {
          sentences.push(
            `In the schema it&apos;s recorded as being available as ${formats}, with provenance noted as ${provenance}.`
          );
        } else if (formats) {
          sentences.push(
            `The schema records its current serve as ${formats}.`
          );
        } else if (provenance) {
          sentences.push(
            `The schema also records its provenance as ${provenance}.`
          );
        }
      }

      return sentences.join(" ");
    }

    // --- Articles ------------------------------------------------------------
    if (summary.keyFacts.type === "article") {
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

    // --- Generic corporate pages --------------------------------------------
    return `This page serves as ${
      entityType === "WebPage"
        ? "a key corporate page"
        : `an ${entityType} page`
    } for Shepherd Neame Limited, ${
      summary.keyFacts.about
        ? `focused on ${summary.keyFacts.about}.`
        : "sharing important information about the company."
    }`;
  };

  // ---------------------------------------------------------------------------
  // Beer flavour / sensory story
  // ---------------------------------------------------------------------------

  const renderFlavourStory = () => {
    if (summary.keyFacts.type !== "beer") return null;

    const { colour, aroma, taste, description } = summary.keyFacts;

    const hasColour = !!colour;
    const hasAroma = !!aroma;
    const hasTaste = !!taste;

    // If we explicitly have aroma/taste, build from those.
    if (hasColour || hasAroma || hasTaste) {
      let line = "";

      if (hasColour && (hasAroma || hasTaste)) {
        line = `It pours ${colour} and delivers `;
        const flavourNotes: string[] = [];
        if (hasAroma) flavourNotes.push(aroma);
        if (hasTaste) flavourNotes.push(taste);
        line += flavourNotes.join(", with ") + ".";
      } else if (hasColour) {
        line = `It pours ${colour}.`;
      } else {
        const flavourNotes: string[] = [];
        if (hasAroma) flavourNotes.push(aroma);
        if (hasTaste) flavourNotes.push(taste);
        line = `It delivers ${flavourNotes.join(", with ")}.`;
      }

      return line;
    }

    // Fallback: if we only have a rich description, use that as the flavour line.
    if (description) {
      return description;
    }

    return null;
  };

  // ---------------------------------------------------------------------------
  // Beer provenance: hops, water, awards, heritage, formats, provenance
  // ---------------------------------------------------------------------------

  const renderProvenance = () => {
    if (summary.keyFacts.type !== "beer") return null;

    const {
      waterSource,
      hops,
      awards,
      heritage,
      formats,
      provenance,
      extraProperties,
    } = summary.keyFacts;

    const hasWater = !!waterSource;
    const hasHops = !!hops;
    const hasAwards = !!awards;
    const hasHeritage = !!heritage;
    const hasFormats = !!formats;
    const hasProvenance = !!provenance;

    if (
      !hasWater &&
      !hasHops &&
      !hasAwards &&
      !hasHeritage &&
      !hasFormats &&
      !hasProvenance &&
      !extraProperties
    ) {
      return null;
    }

    let story = "";

    const brewingBits: string[] = [];
    if (hasWater) brewingBits.push(`brewed with water ${waterSource}`);
    if (hasHops) brewingBits.push(`hopped with ${hops}`);
    if (hasFormats) brewingBits.push(`served as ${formats}`);
    if (hasProvenance) brewingBits.push(`recorded as ${provenance}`);

    if (brewingBits.length) {
      story = `In brewing terms, it&apos;s ${brewingBits.join(", and ")}.`;
    }

    const pedigreeBits: string[] = [];
    if (hasAwards) pedigreeBits.push(awards);
    if (hasHeritage) pedigreeBits.push(heritage);

    if (extraProperties && Array.isArray(extraProperties)) {
      for (const prop of extraProperties) {
        if (prop?.name && prop?.value) {
          pedigreeBits.push(`${prop.name}: ${prop.value}`);
        }
      }
    }

    if (pedigreeBits.length) {
      const pedigreeText = pedigreeBits.join(", ");
      if (story) {
        story += ` It carries a pedigree that includes ${pedigreeText}.`;
      } else {
        story = `It carries a pedigree that includes ${pedigreeText}.`;
      }
    }

    return story || null;
  };

  // ---------------------------------------------------------------------------
  // How this page fits into the site
  // ---------------------------------------------------------------------------

  const renderHowFits = () => {
    if (summary.keyFacts.type === "beer") {
      return `This page sits in the beers section of the Shepherd Neame site and marks ${entityName} as one of the brewery&apos;s beer brands. In the schema it links back to Shepherd Neame Limited as the parent organisation and into the Shepherd Neame beers collection, so search engines can see it as part of the wider range rather than an isolated product page.`;
    }

    if (summary.keyFacts.type === "article") {
      return `This page is part of Shepherd Neame&apos;s editorial content, sitting within the ${sectionName} area and linked back to Shepherd Neame Limited as publisher. That tells search engines it belongs to the brewery&apos;s news and storytelling layer, alongside other articles on the site.`;
    }

    return `This page forms part of the Shepherd Neame corporate site and is linked back to Shepherd Neame Limited as the parent organisation. That makes it clear that this content belongs to the brewery&apos;s corporate story, alongside other sections such as beers, pubs, history, sustainability and investors.`;
  };

  // ---------------------------------------------------------------------------
  // Why this is safe & useful
  // ---------------------------------------------------------------------------

  const renderWhySafe = () => {
    if (summary.keyFacts.type === "beer") {
      return `For this beer brand, the schema sticks to what&apos;s clearly on the page: the brand name, its place in the beers collection, key details like style, colour, ABV and flavour notes, plus any provenance, formats or awards that are explicitly mentioned. It avoids any price, SKU or ecommerce-style data, so search engines see this as a corporate brand page, not a sales listing. That gives AI and search a rich, trustworthy view of the beer without over-claiming.`;
    }

    if (summary.keyFacts.type === "article") {
      return `For editorial content, the schema simply marks this out as a news or blog-style article from Shepherd Neame, with dates, headline and publisher where available. That helps search engines and AI understand it as part of the brewery&apos;s storytelling rather than advertising or product information, while staying firmly within the facts visible on the page.`;
    }

    return `For this kind of corporate page, the structured data focuses on the essentials: that it belongs to Shepherd Neame Limited, what the page is about, and where it sits in the overall site. Keeping to those on-page facts gives search engines and AI a clean, trustworthy signal about how this content fits into the wider Shepherd Neame story, without over-claiming or introducing details that visitors can&apos;t see.`;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="prose prose-sm max-w-none space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">In plain English</h3>
        <div className="space-y-3 text-foreground/90 leading-relaxed">
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
