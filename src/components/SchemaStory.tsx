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

  const isBeer = summary.keyFacts.type === "beer";
  const isArticle = summary.keyFacts.type === "article";

  // --- Rich beer story -------------------------------------------------------

  const renderBeerRichStory = () => {
    if (!isBeer) return null;

    const {
      style,
      colour,
      abv,
      ibu,
      aroma,
      taste,
      hops,
      heritage,
      waterSource,
      awards,
    } = summary.keyFacts;

    const sentences: string[] = [];

    // Base identity + origin
    const stylePart = style ? style : "beer";
    const colourPart = colour ? `${colour} ` : "";
    const abvPart = abv ? ` at ${abv} ABV` : "";
    const ibuPart = ibu ? ` with ${ibu} IBUs` : "";

    let firstSentence = `This page tells the story of ${entityName}, a ${colourPart}${stylePart} brewed by Shepherd Neame${abvPart}${ibuPart}.`;
    if (heritage) {
      // e.g. "originally brewed to celebrate the brewery’s tercentenary"
      firstSentence += ` It is presented here as ${heritage}.`;
    }
    sentences.push(firstSentence);

    // Flavour / sensory
    if (aroma || taste) {
      const flavourBits: string[] = [];
      if (aroma) flavourBits.push(aroma);
      if (taste) flavourBits.push(taste);

      sentences.push(
        `The flavour description highlights ${flavourBits.join(
          ", with "
        )}, giving a rich sense of how it looks, smells and tastes in the glass.`
      );
    }

    // Hops, water, awards
    const detailBits: string[] = [];
    if (hops) detailBits.push(`its hop bill – ${hops}`);
    if (waterSource) detailBits.push(`the water source – ${waterSource}`);
    if (awards) detailBits.push(`key awards and credentials such as ${awards}`);

    if (detailBits.length) {
      sentences.push(
        `The schema also encodes brewed-in details like ${detailBits.join(
          "; "
        )}, so search engines and AI can see this is a fully characterised Shepherd Neame beer brand, not just a name and a picture.`
      );
    }

    return sentences.join(" ");
  };

  // --- Generic intro for non-beer pages -------------------------------------

  const renderIntro = () => {
    if (isBeer) {
      return renderBeerRichStory();
    }

    if (isArticle) {
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
    return `This page serves as a corporate page for Shepherd Neame Limited, ${
      summary.keyFacts.about
        ? `focused on ${summary.keyFacts.about}`
        : "sharing important information about the company"
    }.`;
  };

  // --- How the page fits into the site --------------------------------------

  const renderHowFits = () => {
    if (isBeer) {
      return `This page sits in the beers section of the Shepherd Neame site and marks ${entityName} as one of the brewery's beer brands. In the schema it links back to Shepherd Neame Limited as the parent organisation and into the Shepherd Neame beers collection, so search engines can see it as part of the wider range rather than an isolated product page.`;
    }

    if (isArticle) {
      return `This page is part of Shepherd Neame's editorial content, sitting within the ${sectionName} area and linked back to Shepherd Neame Limited as publisher. That tells search engines it belongs to the brewery's news and storytelling layer, alongside other articles on the site.`;
    }

    // Generic corporate page
    return `This page forms part of the Shepherd Neame corporate site and is linked back to Shepherd Neame Limited as the parent organisation. That makes it clear that this content belongs to the brewery's corporate story, alongside other sections such as beers, pubs, history, sustainability and investors.`;
  };

  // --- Why the schema is safe & useful --------------------------------------

  const renderWhySafe = () => {
    if (isBeer) {
      return `For this beer brand, the schema sticks to what's clearly on the page: the brand name, its place in the beers collection, key details like style, colour, ABV, IBU, flavour notes, provenance, hop bill and any awards that are explicitly mentioned. It avoids any price, SKU or ecommerce-style data, so search engines see this as a corporate brand page, not a sales listing. That gives AI and search a rich, trustworthy view of the beer without over-claiming.`;
    }

    if (isArticle) {
      return `For editorial content, the schema simply marks this out as a news or blog-style article from Shepherd Neame, with dates, headline and publisher where available. That helps search engines and AI understand it as part of the brewery's storytelling rather than advertising or product information, while staying firmly within the facts visible on the page.`;
    }

    return `For this kind of corporate page, the structured data focuses on the essentials: that it belongs to Shepherd Neame Limited, what the page is about, and where it sits in the overall site. Keeping to those on-page facts gives search engines and AI a clean, trustworthy signal about how this content fits into the wider Shepherd Neame story, without over-claiming or introducing details that visitors can't see.`;
  };

  // --- Render ----------------------------------------------------------------

  return (
    <div className="prose prose-sm max-w-none space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">In plain English</h3>
        <p className="text-foreground/90 leading-relaxed">{renderIntro()}</p>
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
