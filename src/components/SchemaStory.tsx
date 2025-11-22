import { parseSchemaForSummary } from "@/lib/schema-parser";

interface SchemaStoryProps {
  jsonld: string;
  section?: string | null;
  path: string;
}

type BeerFacts = {
  isBeer: boolean;
  name?: string;
  style?: string;
  colour?: string;
  abv?: string;
  aroma?: string;
  taste?: string;
  hops?: string;
  awards?: string;
  heritage?: string;
  waterSource?: string;
  serve?: string;
};

function extractBeerFactsFromSchema(jsonld: string): BeerFacts {
  if (!jsonld) return { isBeer: false };

  try {
    const data = JSON.parse(jsonld);
    const graph = Array.isArray(data["@graph"]) ? data["@graph"] : [];

    // Find a Brand node for beers
    const brandNode =
      graph.find(
        (node: any) =>
          node &&
          (node["@type"] === "Brand" ||
            (Array.isArray(node["@type"]) && node["@type"].includes("Brand"))) &&
          typeof node["@id"] === "string" &&
          node["@id"].includes("/beers/")
      ) || null;

    if (!brandNode) {
      return { isBeer: false };
    }

    const getProp = (name: string): string | undefined => {
      const props = Array.isArray(brandNode.additionalProperty)
        ? brandNode.additionalProperty
        : [];
      const match = props.find(
        (p: any) =>
          p &&
          typeof p.name === "string" &&
          p.name.toLowerCase() === name.toLowerCase()
      );
      if (!match) return undefined;
      if (typeof match.value === "string") return match.value;
      if (match.value != null) return String(match.value);
      return undefined;
    };

    return {
      isBeer: true,
      name: typeof brandNode.name === "string" ? brandNode.name : undefined,
      style: getProp("Style"),
      colour: getProp("Colour"),
      abv: getProp("ABV"),
      aroma: getProp("Aroma") || getProp("Cyclops Aroma"),
      taste: getProp("Taste") || getProp("Cyclops Taste"),
      hops: getProp("Hops"),
      awards: getProp("Awards"),
      heritage: getProp("Geographical protection") || getProp("Heritage"),
      waterSource: getProp("Water source") || getProp("Water Source"),
      serve: getProp("Recommended serve") || getProp("Serve Recommendation"),
    };
  } catch {
    return { isBeer: false };
  }
}

export function SchemaStory({ jsonld, section, path }: SchemaStoryProps) {
  const summary = parseSchemaForSummary(jsonld, section);
  const beerFacts = extractBeerFactsFromSchema(jsonld);

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

  const entityName =
    beerFacts.name || summary.mainEntity?.name || "this page";
  const entityType = summary.mainEntity?.type || "page";
  const sectionName = section || "the site";

  const isBeerPage = beerFacts.isBeer || summary.keyFacts.type === "beer";

  // --- Rich intro: main story this schema is telling -------------------------

  const renderIntro = () => {
    if (isBeerPage) {
      const { style, colour, abv } = beerFacts;

      const bits: string[] = [];

      // Sentence 1 – what the beer is
      if (style && colour && abv) {
        bits.push(
          `This page tells the story of ${entityName}, a ${colour.toLowerCase()} ${style} from Shepherd Neame, sitting at ${abv}% ABV.`
        );
      } else if (style && abv) {
        bits.push(
          `This page tells the story of ${entityName}, a ${style} brewed by Shepherd Neame at ${abv}% ABV.`
        );
      } else if (style) {
        bits.push(
          `This page tells the story of ${entityName}, a ${style} brewed by Shepherd Neame.`
        );
      } else {
        bits.push(
          `This page tells the story of ${entityName}, a Shepherd Neame beer brand.`
        );
      }

      return bits.join(" ");
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
      story += `, telling part of Shepherd Neame&apos;s ${sectionName} story.`;

      return story;
    }

    // Generic corporate page
    return `This page serves as a corporate page for Shepherd Neame Limited, ${
      summary.keyFacts.about
        ? `focused on ${summary.keyFacts.about}.`
        : "sharing important information about the company."
    }`;
  };

  // --- Beer flavour / sensory story ------------------------------------------

  const renderFlavourStory = () => {
    if (!isBeerPage) return null;

    const { colour, aroma, taste, serve, hops } = beerFacts;

    const hasColour = !!colour;
    const hasAroma = !!aroma;
    const hasTaste = !!taste;

    if (!hasColour && !hasAroma && !hasTaste && !serve && !hops) return null;

    const bits: string[] = [];

    if (hasColour || hasAroma || hasTaste) {
      if (hasColour && (hasAroma || hasTaste)) {
        const notes: string[] = [];
        if (hasAroma) notes.push(aroma!);
        if (hasTaste) notes.push(taste!);
        bits.push(
          `On the flavour side, it pours ${colour} and is described as delivering ${notes.join(
            ", with "
          )}.`
        );
      } else if (hasColour) {
        bits.push(`On the flavour side, it pours ${colour}.`);
      } else {
        const notes: string[] = [];
        if (hasAroma) notes.push(aroma!);
        if (hasTaste) notes.push(taste!);
        bits.push(`On the flavour side, it is described as ${notes.join(", with ")}.`);
      }
    }

    if (hops) {
      bits.push(`The hop bill is listed as ${hops}.`);
    }

    if (serve) {
      bits.push(`The page also suggests a food pairing: ${serve}.`);
    }

    return bits.join(" ");
  };

  // --- Beer provenance: water, awards, heritage ------------------------------

  const renderProvenance = () => {
    if (!isBeerPage) return null;

    const { waterSource, awards, heritage } = beerFacts;

    if (!waterSource && !awards && !heritage) return null;

    const bits: string[] = [];

    if (waterSource) {
      bits.push(`It is brewed with water ${waterSource}.`);
    }

    const credParts: string[] = [];
    if (awards) credParts.push(awards);
    if (heritage) credParts.push(heritage);

    if (credParts.length > 0) {
      bits.push(
        `Its pedigree on the page includes ${credParts.join(", ")}.`
      );
    }

    return bits.join(" ");
  };

  // --- How the page fits into the site ---------------------------------------

  const renderHowFits = () => {
    if (isBeerPage) {
      return `This page sits in the beers section of the Shepherd Neame site and marks ${entityName} as one of the brewery&apos;s beer brands. In the schema it links back to Shepherd Neame Limited as the parent organisation and into the Shepherd Neame beers collection, so search engines can see it as part of the wider range rather than an isolated product page.`;
    }

    if (summary.keyFacts.type === "article") {
      return `This page is part of Shepherd Neame&apos;s editorial content, sitting within the ${sectionName} area and linked back to Shepherd Neame Limited as publisher. That tells search engines it belongs to the brewery&apos;s news and storytelling layer, alongside other articles on the site.`;
    }

    return `This page forms part of the Shepherd Neame corporate site and is linked back to Shepherd Neame Limited as the parent organisation. That makes it clear that this content belongs to the brewery&apos;s corporate story, alongside other sections such as beers, pubs, history, sustainability and investors.`;
  };

  // --- Why the schema is safe & useful ---------------------------------------

  const renderWhySafe = () => {
    if (isBeerPage) {
      return `For this beer brand, the schema sticks to what&apos;s clearly on the page: the brand name, its place in the beers collection, key details like style, colour, ABV and flavour notes, plus any provenance or awards that are explicitly mentioned. It avoids any price, SKU or ecommerce-style data, so search engines see this as a corporate brand page, not a sales listing. That gives AI and search a rich, trustworthy view of the beer without over-claiming.`;
    }

    if (summary.keyFacts.type === "article") {
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
          {renderFlavourStory() && <p>{renderFlavourStory()}</p>}
          {renderProvenance() && <p>{renderProvenance()}</p>}
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
