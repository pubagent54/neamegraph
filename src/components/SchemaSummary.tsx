import { CheckCircle, Circle, ExternalLink } from "lucide-react";
import { parseSchemaForSummary } from "@/lib/schema-parser";

interface SchemaSummaryProps {
  jsonld: string;
  section?: string | null;
  createdAt: string;
  status: string;
}

export function SchemaSummary({ jsonld, section, createdAt, status }: SchemaSummaryProps) {
  const summary = parseSchemaForSummary(jsonld, section);

  // Defensive check for invalid props
  if (!jsonld || !createdAt || !status) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Missing required data to display schema summary.</p>
      </div>
    );
  }

  if (!summary.mainEntity && !summary.validation.hasOrganization) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>We couldn't summarise this version automatically, but the JSON is still available in the JSON tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold mb-1">Schema Summary</h3>
        <p className="text-sm text-muted-foreground">
          Generated {new Date(createdAt).toLocaleDateString('en-GB', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
          })} • {status.charAt(0).toUpperCase() + status.slice(1)}
        </p>
      </div>

      {/* Main Entity */}
      {summary.mainEntity && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">What is this page about?</h4>
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Page Type</p>
                <p className="font-medium">{summary.mainEntity.type}</p>
              </div>
              {section && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Section</p>
                  <p className="font-medium capitalize">{section}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Main Entity Name</p>
              <p className="font-medium">{summary.mainEntity.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Connections */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">How does it connect to the rest of the site?</h4>
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            {summary.connections.organization ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm">Shepherd Neame Limited (Organization)</span>
          </div>
          {summary.connections.collections.map((collection, i) => (
            <div key={i} className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <a 
                href={collection.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm hover:underline flex items-center gap-1"
              >
                {collection.name}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Key Facts */}
      {Object.keys(summary.keyFacts).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">Key facts from this schema</h4>
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            {summary.keyFacts.type === "beer" && (
              <>
                <h5 className="font-semibold text-sm">Beer Brand Facts</h5>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {summary.keyFacts.abv && (
                    <div>
                      <p className="text-muted-foreground">ABV</p>
                      <p className="font-medium">{summary.keyFacts.abv}</p>
                    </div>
                  )}
                  {summary.keyFacts.style && (
                    <div>
                      <p className="text-muted-foreground">Style</p>
                      <p className="font-medium">{summary.keyFacts.style}</p>
                    </div>
                  )}
                  {summary.keyFacts.colour && (
                    <div>
                      <p className="text-muted-foreground">Colour</p>
                      <p className="font-medium">{summary.keyFacts.colour}</p>
                    </div>
                  )}
                  {summary.keyFacts.aroma && (
                    <div>
                      <p className="text-muted-foreground">Aroma</p>
                      <p className="font-medium">{summary.keyFacts.aroma}</p>
                    </div>
                  )}
                  {summary.keyFacts.taste && (
                    <div>
                      <p className="text-muted-foreground">Taste</p>
                      <p className="font-medium">{summary.keyFacts.taste}</p>
                    </div>
                  )}
                  {summary.keyFacts.waterSource && (
                    <div>
                      <p className="text-muted-foreground">Water Source</p>
                      <p className="font-medium">{summary.keyFacts.waterSource}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Image</p>
                    <p className="font-medium">{summary.keyFacts.hasImage ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Logo</p>
                    <p className="font-medium">{summary.keyFacts.hasLogo ? "Yes" : "No"}</p>
                  </div>
                </div>
              </>
            )}
            
            {summary.keyFacts.type === "article" && (
              <>
                <div className="space-y-2">
                  {summary.keyFacts.headline && (
                    <div>
                      <p className="text-muted-foreground text-sm">Headline</p>
                      <p className="font-medium">{summary.keyFacts.headline}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {summary.keyFacts.datePublished && (
                      <div>
                        <p className="text-muted-foreground">Date Published</p>
                        <p className="font-medium">
                          {new Date(summary.keyFacts.datePublished).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                    )}
                    {summary.keyFacts.author && (
                      <div>
                        <p className="text-muted-foreground">Author</p>
                        <p className="font-medium">{summary.keyFacts.author}</p>
                      </div>
                    )}
                    {summary.keyFacts.publisher && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Publisher</p>
                        <p className="font-medium">{summary.keyFacts.publisher}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
            
            {summary.keyFacts.type === "page" && (
              <div className="space-y-2 text-sm">
                {summary.keyFacts.pageType && (
                  <div>
                    <p className="text-muted-foreground">Page Type</p>
                    <p className="font-medium">{summary.keyFacts.pageType}</p>
                  </div>
                )}
                {summary.keyFacts.about && (
                  <div>
                    <p className="text-muted-foreground">About</p>
                    <p className="font-medium">{summary.keyFacts.about}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Images this schema is using */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Images this schema is using</h4>
        {!summary.images.webPageImage && !summary.images.brandImage && !summary.images.brandLogo ? (
          <div className="bg-muted/30 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">No image or logo properties found in this schema.</p>
          </div>
        ) : (
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* WebPage image */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {summary.keyFacts.type === "beer" ? "Beer hero image (page)" : "WebPage image"}
                </p>
                {summary.images.webPageImage ? (
                  <div className="space-y-2">
                    <div className="bg-background rounded border overflow-hidden relative">
                      <img 
                        src={summary.images.webPageImage} 
                        alt="WebPage hero"
                        className="w-full h-32 object-cover"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.error-overlay')) {
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'error-overlay absolute inset-0 flex items-center justify-center bg-muted/50';
                            errorDiv.innerHTML = '<span class="text-xs text-muted-foreground">Image failed to load</span>';
                            parent.appendChild(errorDiv);
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground break-all font-mono" title={summary.images.webPageImage}>
                      {summary.images.webPageImage}
                    </p>
                  </div>
                ) : (
                  <div className="bg-muted rounded border p-4 h-32 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">Not set in schema</p>
                  </div>
                )}
              </div>

              {/* Brand image */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {summary.keyFacts.type === "beer" ? "Beer hero image (brand)" : "Main entity image"}
                </p>
                {summary.images.brandImage ? (
                  <div className="space-y-2">
                    <div className="bg-background rounded border overflow-hidden relative">
                      <img 
                        src={summary.images.brandImage} 
                        alt="Brand hero"
                        className="w-full h-32 object-cover"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.error-overlay')) {
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'error-overlay absolute inset-0 flex items-center justify-center bg-muted/50';
                            errorDiv.innerHTML = '<span class="text-xs text-muted-foreground">Image failed to load</span>';
                            parent.appendChild(errorDiv);
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground break-all font-mono" title={summary.images.brandImage}>
                      {summary.images.brandImage}
                    </p>
                  </div>
                ) : (
                  <div className="bg-muted rounded border p-4 h-32 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">Not set in schema</p>
                  </div>
                )}
              </div>

              {/* Brand logo */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {summary.keyFacts.type === "beer" ? "Beer brand logo" : "Main entity logo"}
                </p>
                {summary.images.brandLogo ? (
                  <div className="space-y-2">
                    <div className="bg-background rounded border overflow-hidden relative">
                      <img 
                        src={summary.images.brandLogo} 
                        alt="Brand logo"
                        className="w-full h-32 object-contain p-4"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.error-overlay')) {
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'error-overlay absolute inset-0 flex items-center justify-center bg-muted/50';
                            errorDiv.innerHTML = '<span class="text-xs text-muted-foreground">Image failed to load</span>';
                            parent.appendChild(errorDiv);
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground break-all font-mono" title={summary.images.brandLogo}>
                      {summary.images.brandLogo}
                    </p>
                  </div>
                ) : (
                  <div className="bg-muted rounded border p-4 h-32 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">Not set in schema</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Validation */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Validation checks</h4>
        <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            {summary.validation.hasOrganization ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <span>Organization node present</span>
          </div>
          <div className="flex items-center gap-2">
            {summary.validation.hasMainEntity ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <span>Main entity type recognised</span>
          </div>
          <div className="flex items-center gap-2">
            {summary.validation.noCommerceSchema ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Circle className="h-4 w-4 text-amber-600" />
            )}
            <span>
              {summary.validation.noCommerceSchema 
                ? "Corporate vs commerce separation respected – descriptive Product schema allowed, no offers or prices" 
                : "Corporate vs commerce issue – this page includes offers, prices, or other e-commerce fields"}
            </span>
          </div>
        </div>
      </div>

      {/* How this page fits into the site */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">How this page fits into the site</h4>
        <div className="bg-muted/30 rounded-lg p-4">
          <p className="text-sm text-foreground/90 leading-relaxed">
            {renderHowFits(summary, section)}
          </p>
        </div>
      </div>

      {/* Why this is safe and useful */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Why this is safe and useful</h4>
        <div className="bg-muted/30 rounded-lg p-4">
          <p className="text-sm text-foreground/90 leading-relaxed">
            {renderWhySafe(summary)}
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper function to render "How this page fits into the site"
function renderHowFits(summary: any, section?: string | null): string {
  const entityName = summary.mainEntity?.name || "this page";
  const sectionName = section || "the site";

  if (summary.keyFacts?.type === "beer") {
    return `This page sits in the beers section of the Shepherd Neame site and marks ${entityName} as one of the brewery's products. In the schema it's modelled as a descriptive Product (not a shop listing) and links back to Shepherd Neame Limited as the manufacturer and brand owner, and into the Shepherd Neame beers collection, so search engines can see it as part of the wider range rather than an isolated product page.`;
  }

  if (summary.keyFacts?.type === "article") {
    return `This page is part of Shepherd Neame's editorial content, sitting within the ${sectionName} area and linked back to Shepherd Neame Limited as publisher. That tells search engines it belongs to the brewery's news and storytelling layer, alongside other articles on the site.`;
  }

  // Generic corporate page
  return `This page forms part of the Shepherd Neame corporate site and is linked back to Shepherd Neame Limited as the parent organisation. That makes it clear that this content belongs to the brewery's corporate story, alongside other sections such as beers, pubs, history, sustainability and investors.`;
}

// Helper function to render "Why this is safe and useful"
function renderWhySafe(summary: any): string {
  if (summary.keyFacts?.type === "beer") {
    return `For this beer, the schema models it as a Product (with supporting Brand references) but keeps it descriptive rather than transactional. It sticks to what's clearly on the page: the name, its place in the beers collection, key details like style, colour, ABV and flavour notes, plus any provenance or awards that are explicitly mentioned. It avoids any offers, prices, cart data or stock information, so search engines see this as a descriptive product page, not a sales listing. That gives AI and search a rich, trustworthy view of the beer without over-claiming or implying e-commerce.`;
  }

  if (summary.keyFacts?.type === "article") {
    return `For editorial content, the schema simply marks this out as a news or blog-style article from Shepherd Neame, with dates, headline and publisher where available. That helps search engines and AI understand it as part of the brewery's storytelling rather than advertising or product information, while staying firmly within the facts visible on the page.`;
  }

  return `For this kind of corporate page, the structured data focuses on the essentials: that it belongs to Shepherd Neame Limited, what the page is about, and where it sits in the overall site. Keeping to those on-page facts gives search engines and AI a clean, trustworthy signal about how this content fits into the wider Shepherd Neame story, without over-claiming or introducing details that visitors can't see.`;
}
