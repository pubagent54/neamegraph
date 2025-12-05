import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { CheckCircle, XCircle, ShieldCheck, AlertTriangle } from "lucide-react";
import { SchemaSummary } from "@/components/SchemaSummary";
import { SchemaStory } from "@/components/SchemaStory";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StoryAndChecksTabProps {
  latestVersion: any | null;
  page: any;
  canEdit: boolean;
  isAdmin: boolean;
  liveCharterWarnings: string[] | null;
  onValidate: (versionId: string, jsonld: string) => void;
  onApprove: (versionId: string) => void;
  onReject: (versionId: string) => void;
}

export function StoryAndChecksTab({
  latestVersion,
  page,
  canEdit,
  isAdmin,
  liveCharterWarnings,
  onValidate,
  onApprove,
  onReject,
}: StoryAndChecksTabProps) {
  if (!latestVersion) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No schema versions yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Generate a schema to see the story and checks
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Story panel - spans 2 columns */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Story we're telling</CardTitle>
            <CardDescription>
              Knowledge panel generated from JSON-LD
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ErrorBoundary>
              <SchemaStory 
                jsonld={latestVersion.jsonld}
                pageType={page.page_type}
                category={page.category}
              />
            </ErrorBoundary>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary & validation</CardTitle>
            <CardDescription>
              Structured overview from schema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ErrorBoundary>
              <SchemaSummary 
                jsonld={latestVersion.jsonld}
                section={page.section}
                createdAt={latestVersion.created_at}
                status={latestVersion.status}
                pageHeroImageUrl={page.hero_image_url}
                pageLogoUrl={page.logo_url}
              />
            </ErrorBoundary>
          </CardContent>
        </Card>
      </div>

      {/* Validation & status panel */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status & validation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Current Status</p>
              <StatusBadge status={page.status} className="text-base" />
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Last Generated</p>
              <p className="text-sm font-medium">
                {page.last_schema_generated_at
                  ? new Date(page.last_schema_generated_at).toLocaleString()
                  : "Never"}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Schema Version</p>
              <p className="text-sm font-medium">
                Version {latestVersion.version_number}
              </p>
            </div>

            {liveCharterWarnings !== null && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Charter Quality</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-help ${
                        liveCharterWarnings.length === 0
                          ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                          : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}>
                        {liveCharterWarnings.length === 0 ? (
                          <>
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Charter: OK</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>Charter: Warnings</span>
                          </>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-md">
                      {liveCharterWarnings.length === 0 ? (
                        <p>All Schema Quality Charter checks passed.</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="font-semibold">Quality warnings:</p>
                          <ul className="list-disc pl-4 space-y-1 text-sm">
                            {liveCharterWarnings.map((warning, idx) => (
                              <li key={idx}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}

            <div className="pt-4 space-y-2 border-t">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => onValidate(latestVersion.id, latestVersion.jsonld)}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Validate
              </Button>
              
              {canEdit && latestVersion.status === "draft" && (
                <>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => onApprove(latestVersion.id)}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    onClick={() => onReject(latestVersion.id)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
