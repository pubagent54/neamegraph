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

  // --- Rich beer story paragraph ---------------------------------------------

  const renderRichBeerStory = () => {
    if (summary.keyFacts.type !== "beer") return null;

    const {
      style,
      colour,
      abv,
      aroma,
      taste,
      hops,
      heritage,
      serveRecommendation,
      awards,
      waterSource,
    } = summary.keyFacts;

    const bits: string[] = [];

    // First sentence – what the page is doing
    const stylePart = style ? `, a ${style}` : "";
    const heritagePart = heritage ? `, ${heritage}` : "";
    bits.push(
      `This page tells the story of ${entityName}${stylePart} brewed by Shepherd Neame${heritagePart}.`
    );

    // Second sentence – flavour & colour
    const flavourParts: string[] = [];
    if (colour) flavourParts.push(`${colour.toLowerCase()} in the glass`);
    if (aroma) flavourParts.push(`with aromas of ${aroma}`);
    if (taste) flavourParts.push(`and a palate described as ${taste}`);
    if (flavourParts.length) {
      bits.push(
        `It is presented as ${flavourParts.join(", ")}${
          abv ? `, sitting at ${abv} ABV` : ""
        }.`
      );
    } else if (abv) {
      bits.push(`It is positioned as a ${style || "beer"} at ${abv} ABV.`);
    }

    // Third sentence – hops, water, serve rec, awards
    const provenanceParts: string[] = [];
    if (hops) provenanceParts.push(`built on hops including ${hops}`);
    if (waterSource) provenanceParts.push(`brewed with water ${waterSource}`);
    if (provenanceParts.length) {
      bits.push(`The page emphasises it as ${provenanceParts.join(" and ")}.`);
    }

    if (serveRecommendation) {
      bits.push(`There is a serving suggestion to ${serveRecommendation}.`);
    }

    if (awards) {
      bits.push(
        `Awards and credentials on the page reinforce its pedigree, including ${awards}.`
      );
    }

    return bits.join(" ");
  };

  // --- Plain-language intro (short, factual) ---------------------------------

  const renderIntro = () => {
    if (summary.keyFacts.type === "beer") {
      const { style, colour, abv } = summary.keyFacts;

      const hasColour = !!colour;
      const hasStyle = !!style;
      const hasAbv = !!abv;

      if (hasColour && hasStyle && hasAbv) {
        return `${entityName} is a ${colour} ${style} from Shepherd Neame, sitting at ${abv} ABV.`;
      } else if (hasStyle && hasAbv) {
        return `${entityName} is a ${style} at ${abv} ABV, brewed by Shepherd Neame in Kent.`;
      } else if (hasStyle) {
        return `${entityName} is a ${style}, brewed by Shepherd Neame in Kent.`;
      } else {
        return `${entityName} is a Shepherd Neame beer brand, brewed in Kent.`;
      }
    }

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
      story += `, telling part of Shepherd Neame's ${sectionName} story.`;

      return story;
    }

    // Generic corporate page
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

  // --- Beer flavour / sensory story (shorter add-on) -------------------------

  const renderFlavourStory = () => {
    if (summary.keyFacts.type !== "beer") return null;

    const { colour, aroma, taste } = summary.keyFacts;

    const hasColour = !!colour;
    const hasAroma = !!aroma;
    const hasTaste = !!taste;

    if (!hasColour && !hasAroma && !hasTaste) return null;

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

    return description;
  };

  // --- Beer provenance: hops, water, awards, heritage (short add-on) ---------

  const renderProvenance = () => {
    if (summary.keyFacts.type !== "beer") return null;

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
      story = `It's ${brewingParts.join(" and ")}`;
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

  // --- How the page fits into the site ---------------------------------------

  const renderHowFits = () => {
    if (summary.keyFacts.type === "beer") {
      return `This page sits in the beers section of the Shepherd Neame site and marks ${entityName} as one of the brewery's core beer brands. In the schema it links back to Shepherd Neame Limited as the parent organisation and into the Shepherd Neame beers collection, so search engines can see it as part of the wider range rather than an isolated product page.`;
    }

    if (summary.keyFacts.type === "article") {
      return `This page is part of Shepherd Neame's editorial content, sitting within the ${sectionName} area and linked back to Shepherd Neame Limited as publisher. That tells search engines it belongs to the brewery's news and storytelling layer, alongside other articles on the site.`;
    }

    // Generic corporate page
    return `This page forms part of the Shepherd Neame corporate site and is linked back to Shepherd Neame Limited as the parent organisation. That makes it clear that this content belongs to the brewery's corporate story, alongside other sections such as beers, pubs, history, sustainability and investors.`;
  };

  // --- Why the schema is safe & useful ---------------------------------------

  const renderWhySafe = () => {
    if (summary.keyFacts.type === "beer") {
      return `For this beer brand, the schema sticks to what's clearly on the page: the brand name, its place in the beers collection, key details like style, colour, ABV and flavour notes, plus any provenance or awards that are explicitly mentioned. It avoids any price, SKU or ecommerce-style data, so search engines see this as a corporate brand page, not a sales listing. That gives AI and search a rich, trustworthy view of the beer without over-claiming.`;
    }

    if (summary.keyFacts.type === "article") {
      return `For editorial content, the schema simply marks this out as a news or blog-style article from Shepherd Neame, with dates, headline and publisher where available. That helps search engines and AI understand it as part of the brewery's storytelling rather than advertising or product information, while staying firmly within the facts visible on the page.`;
    }

    return `For this kind of corporate page, the structured data focuses on the essentials: that it belongs to Shepherd Neame Limited, what the page is about, and where it sits in the overall site. Keeping to those on-page facts gives search engines and AI a clean, trustworthy signal about how this content fits into the wider Shepherd Neame story, without over-claiming or introducing details that visitors can't see.`;
  };

  // --- What search & AI can understand from this schema ----------------------

  const renderWhatSearchUnderstands = () => {
    if (summary.keyFacts.type === "beer") {
      const {
        style,
        abv,
        colour,
        ibu,
        hops,
        aroma,
        taste,
        awards,
        heritage,
        waterSource,
      } = summary.keyFacts;

      const facts: string[] = [];

      if (style || abv || colour) {
        const bits: string[] = [];
        if (style) bits.push(style);
        if (colour) bits.push(colour.toLowerCase());
        if (abv) bits.push(`${abv} ABV`);
        facts.push(
          `that ${entityName} is a ${bits.join(
            ", "
          )} beer brand brewed by Shepherd Neame`
        );
      } else {
        facts.push(`that ${entityName} is a Shepherd Neame beer brand`);
      }

      if (ibu) {
        facts.push(`that it has a bitterness level of ${ibu} IBU`);
      }

      if (hops) {
        facts.push(`that it is hopped with ${hops}`);
      }

      if (aroma || taste) {
        const flavourBits: string[] = [];
        if (aroma) flavourBits.push(aroma);
        if (taste) flavourBits.push(taste);
        facts.push(`that its flavour profile includes ${flavourBits.join(" and ")}`);
      }

      if (waterSource) {
        facts.push(`that it is brewed with water ${waterSource}`);
      }

      if (awards || heritage) {
        const credBits: string[] = [];
        if (awards) credBits.push(awards);
        if (heritage) credBits.push(heritage);
        facts.push(`that it carries pedigree and credentials such as ${credBits.join(
          " and "
        )}`);
      }

      const joinedFacts =
        facts.length === 1
          ? facts[0]
          : facts.slice(0, -1).join(", ") + " and " + facts[facts.length - 1];

      return `From this schema, search engines and AI can safely understand ${joinedFacts}, and that it sits inside the Shepherd Neame beers collection under Shepherd Neame Limited as the parent organisation.`;
    }

    if (summary.keyFacts.type === "article") {
      const headline = summary.keyFacts.headline || entityName;
      const bits: string[] = [
        `that "${headline}" is an editorial article`,
        "that it is published by Shepherd Neame Limited",
      ];

      if (summary.keyFacts.datePublished) {
        bits.push(
          `that it was published on ${new Date(
            summary.keyFacts.datePublished
          ).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}`
        );
      }

      if (summary.keyFacts.author) {
        bits.push(`that it is authored by ${summary.keyFacts.author}`);
      }

      const joinedFacts =
        bits.length === 1
          ? bits[0]
          : bits.slice(0, -1).join(", ") + " and " + bits[bits.length - 1];

      return `From this schema, search engines and AI can clearly see ${joinedFacts}, and that it belongs within Shepherd Neame's ${sectionName} content rather than being a product or offer.`;
    }

    // Generic corporate / other
    const about = summary.keyFacts.about;
    const facts: string[] = [];

    if (about) {
      facts.push(`that this page is about ${about}`);
    } else {
      facts.push("that this is a corporate information page");
    }

    if (summary.validation.hasOrganization) {
      facts.push("that it is owned by Shepherd Neame Limited");
    }

    const joinedFacts =
      facts.length === 1
        ? facts[0]
        : facts.slice(0, -1).join(", ") + " and " + facts[facts.length - 1];

    return `From this schema, search engines and AI can reliably understand ${joinedFacts}, and how it sits alongside other sections of the Shepherd Neame site such as beers, pubs, history, sustainability and investors.`;
  };

  // --- Render ----------------------------------------------------------------

  return (
    <div className="prose prose-sm max-w-none space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">In plain English</h3>
        <div className="space-y-3 text-foreground/90 leading-relaxed">
          {summary.keyFacts.type === "beer" && renderRichBeerStory() && (
            <p>{renderRichBeerStory()}</p>
          )}
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

      <div>
        <h3 className="text-lg font-semibold mb-4">
          How search &amp; AI read this schema
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          {renderWhatSearchUnderstands()}
        </p>
      </div>
    </div>
  );
}
