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
          We don't have a schema story for this version yet. Generate schema
          first, then this tab will explain what it's saying.
        </p>
      </div>
    );
  }

  const entityName = summary.mainEntity?.name || "this page";
  const entityType = summary.mainEntity?.type || "page";
  const sectionName = section || "the site";

  const keyFacts = summary.keyFacts || {};

  // 1) IN PLAIN ENGLISH
  const renderPlainEnglish = () => {
    // Beer brand-style pages
    if (keyFacts.type === "beer") {
      const hasColour = !!keyFacts.colour;
      const hasStyle = !!keyFacts.style;
      const hasAbv = !!keyFacts.abv;
      const hasAroma = !!keyFacts.aroma;
      const hasTaste = !!keyFacts.taste;

      const bits: string[] = [];

      // Core identity
      if (hasColour && hasStyle && hasAbv) {
        bits.push(
          `${entityName} is a ${keyFacts.colour} ${keyFacts.style} from Shepherd Neame at ${keyFacts.abv} ABV.`
        );
      } else if (hasStyle && hasAbv) {
        bits.push(
          `${entityName} is a ${keyFacts.style} brewed by Shepherd Neame, sitting at ${keyFacts.abv} ABV.`
        );
      } else if (hasStyle) {
        bits.push(
          `${entityName} is a ${keyFacts.style} brewed by Shepherd Neame.`
        );
      } else {
        bits.push(
          `${entityName} is a Shepherd Neame beer brand described on this page.`
        );
      }

      // Colour / aroma / taste
      if (hasColour && (hasAroma || hasTaste)) {
        const flavourParts: string[] = [];
        if (hasAroma) flavourParts.push(keyFacts.aroma);
        if (hasTaste) flavourParts.push(keyFacts.taste);

        bits.push(
          `It pours ${keyFacts.colour} and is described with flavours such as ${flavourParts.join(
            " and "
          )}.`
        );
      } else if (hasColour) {
        bits.push(`It pours ${keyFacts.colour}.`);
      } else if (hasAroma || hasTaste) {
        const flavourParts: string[] = [];
        if (hasAroma) flavourParts.push(keyFacts.aroma);
        if (hasTaste) flavourParts.push(keyFacts.taste);
        bits.push(
          `The flavour notes on the page highlight ${flavourParts.join(" and ")}.`
        );
      }

      // Serve recommendation
      if (keyFacts.serveRecommendation) {
        bits.push(keyFacts.serveRecommendation);
      }

      return bits.join(" ");
    }

    // News / article pages
    if (keyFacts.type === "article") {
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
      } from Shepherd Neame`;
      if (date) story += `, published on ${date}`;
      if (keyFacts.about) story += `, focusing on ${keyFacts.about}`;
      story += ".";

      return story;
    }

    // Generic corporate / information pages
    const aboutText = keyFacts.about
      ? `focused on ${keyFacts.about}`
      : "sharing important information about the company";

    if (entityType === "WebPage") {
      return `This page is a key corporate page for Shepherd Neame Limited, ${aboutText}.`;
    }

    return `This page presents ${entityName}, an ${entityType} within the Shepherd Neame site, ${aboutText}.`;
  };

  // 2) HOW THIS PAGE FITS INTO THE SITE
  const renderHowItFits = () => {
    // Beer pages
    if (keyFacts.type === "beer") {
      return `Within the Shepherd Neame website, this page sits in the ${sectionName} section and is treated as a beer brand page rather than a product listing. It is linked back to Shepherd Neame Limited as the parent brewer and sits alongside other beers in the main beers collection, helping to show how this particular ale fits into the wider portfolio.`;
    }

    // Article / news
    if (keyFacts.type === "article") {
      return `This page lives in the ${sectionName} area of the site as part of Shepherd Neame's news and storytelling. It links back to Shepherd Neame Limited as the publisher, so it is clearly understood as editorial content that belongs to the brewery rather than a standalone or external piece.`;
    }

    // Everything else (corporate sections, history, sustainability, etc.)
    return `This page forms part of the ${sectionName} section of the Shepherd Neame site and is linked back to Shepherd Neame Limited as the parent organisation. That makes it clear that this content belongs to the brewery's corporate story, alongside other sections such as beers, pubs, history, sustainability and investors.`;
  };

  // 3) WHY THIS IS SAFE AND USEFUL
  const renderWhyItIsSafeAndUseful = () => {
    if (keyFacts.type === "beer") {
      return `The structured data behind this page only encodes factual details such as the beer’s name, style, strength, flavour notes, formats and any awards the page mentions, and it keeps clear of prices, SKUs or offers. That means search engines and AI tools can understand this as a Shepherd Neame beer brand in the beers collection, linked back to the brewery itself, without turning it into a sales listing or adding anything that isn’t already visible on the page.`;
    }

    if (keyFacts.type === "article") {
      return `For this article, the structured data simply marks it as editorial content from Shepherd Neame, with its headline, dates, author and topic connected back to the organisation. This helps search and AI distinguish it from adverts or product pages, and supports more accurate answers whenever someone asks about Shepherd Neame news or activity in this area.`;
    }

    return `For this kind of corporate page, the structured data focuses on the essentials: that it belongs to Shepherd Neame Limited, what the page is about, and where it sits in the overall site. Keeping to those on-page facts gives search engines and AI a clean, trustworthy signal about how this content fits into the wider Shepherd Neame story, without over-claiming or introducing details that visitors can’t see.`;
  };

  return (
    <div className="prose prose-sm max-w-none space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">In plain English</h3>
        <p className="text-foreground/90 leading-relaxed">
          {renderPlainEnglish()}
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">
          How this page fits into the site
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          {renderHowItFits()}
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">
          Why this is safe and useful
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          {renderWhyItIsSafeAndUseful()}
        </p>
      </div>
    </div>
  );
}
