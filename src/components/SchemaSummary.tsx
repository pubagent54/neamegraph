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
            <span>Corporate vs commerce separation respected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
