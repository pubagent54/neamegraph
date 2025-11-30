import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Save } from "lucide-react";
import { WikidataPanel } from "@/components/WikidataPanel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface MetadataTabProps {
  page: any;
  canEdit: boolean;
  // Domain
  editableDomain: string;
  onDomainChange: (value: string) => void;
  onSaveDomain: () => void;
  // Corporate v2
  editablePageType: string | null;
  onPageTypeChange: (value: string) => void;
  editableCategory: string | null;
  onCategoryChange: (value: string) => void;
  editableLogoUrl: string;
  onLogoUrlChange: (value: string) => void;
  editableHeroImageUrl: string;
  onHeroImageUrlChange: (value: string) => void;
  editableFaqMode: string;
  onFaqModeChange: (value: string) => void;
  editableIsHomePage: boolean;
  onIsHomePageChange: (value: boolean) => void;
  onSaveV2Metadata: () => void;
  // Beer
  editableBeerAbv: string;
  onBeerAbvChange: (value: string) => void;
  editableBeerStyle: string;
  onBeerStyleChange: (value: string) => void;
  editableBeerLaunchYear: string;
  onBeerLaunchYearChange: (value: string) => void;
  editableBeerOfficialUrl: string;
  onBeerOfficialUrlChange: (value: string) => void;
  onSaveBeerMetadata: () => void;
  // Wikidata
  onSaveWikidata: (data: any) => Promise<void>;
  isSaving: boolean;
  // Options
  pageTypes: string[];
  categories: Record<string, string[]>;
  faqModes: Array<{ value: string; label: string }>;
}

export function MetadataTab(props: MetadataTabProps) {
  const {
    page,
    canEdit,
    editableDomain,
    onDomainChange,
    onSaveDomain,
    editablePageType,
    onPageTypeChange,
    editableCategory,
    onCategoryChange,
    editableLogoUrl,
    onLogoUrlChange,
    editableHeroImageUrl,
    onHeroImageUrlChange,
    editableFaqMode,
    onFaqModeChange,
    editableIsHomePage,
    onIsHomePageChange,
    onSaveV2Metadata,
    editableBeerAbv,
    onBeerAbvChange,
    editableBeerStyle,
    onBeerStyleChange,
    editableBeerLaunchYear,
    onBeerLaunchYearChange,
    editableBeerOfficialUrl,
    onBeerOfficialUrlChange,
    onSaveBeerMetadata,
    onSaveWikidata,
    isSaving,
    pageTypes,
    categories,
    faqModes,
  } = props;

  return (
    <div className="space-y-6">
      {/* Page Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle>Page Metadata</CardTitle>
          <CardDescription>
            Core page information and domain lane
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Domain</Label>
              <Select
                value={editableDomain}
                onValueChange={onDomainChange}
                disabled={!canEdit || page.is_home_page}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Corporate">Corporate</SelectItem>
                  <SelectItem value="Beer">Beer</SelectItem>
                  <SelectItem value="Pub">Pub</SelectItem>
                </SelectContent>
              </Select>
              {page.is_home_page && (
                <p className="text-xs text-muted-foreground">
                  Homepage must stay in Corporate domain
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Path</Label>
              <Input value={page.path} disabled className="font-mono text-sm" />
            </div>
          </div>

          {canEdit && editableDomain !== page.domain && (
            <div className="flex justify-end">
              <Button onClick={onSaveDomain} disabled={isSaving} size="sm">
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save Domain"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schema Engine Info */}
      <Card>
        <CardHeader>
          <CardTitle>Schema Engine</CardTitle>
          <CardDescription>
            {editableDomain === 'Corporate' && "Uses rules-based Corporate v2 schema engine"}
            {editableDomain === 'Beer' && "Uses rules-based Beer schema engine"}
            {editableDomain === 'Pub' && "Pub module is Phase 2 – not implemented yet"}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Domain-Specific Metadata */}
      {editableDomain === 'Corporate' && (
        <Card>
          <CardHeader>
            <CardTitle>Corporate Metadata</CardTitle>
            <CardDescription>
              Fields used by the v2 Corporate schema engine
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pageType">Page Type</Label>
                <Select
                  value={editablePageType || ''}
                  onValueChange={onPageTypeChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger id="pageType">
                    <SelectValue placeholder="Select page type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pageTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editablePageType && (
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={editableCategory || ''}
                    onValueChange={onCategoryChange}
                    disabled={!canEdit}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(categories[editablePageType] || []).map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="faqMode">FAQ Mode</Label>
                <Select
                  value={editableFaqMode}
                  onValueChange={onFaqModeChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger id="faqMode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {faqModes.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="isHomePage">Is Home Page</Label>
                  <Switch
                    id="isHomePage"
                    checked={editableIsHomePage}
                    onCheckedChange={onIsHomePageChange}
                    disabled={!canEdit}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  type="text"
                  placeholder="https://example.com/logo.png"
                  value={editableLogoUrl}
                  onChange={(e) => onLogoUrlChange(e.target.value)}
                  disabled={!canEdit}
                />
                {editableLogoUrl && (
                  <div className="mt-2 h-24 w-32 rounded-lg border bg-muted/40 overflow-hidden flex items-center justify-center">
                    <img
                      src={editableLogoUrl}
                      alt="Logo preview"
                      className="h-full w-full object-contain p-2"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="heroImageUrl">Hero Image URL</Label>
                <Input
                  id="heroImageUrl"
                  type="text"
                  placeholder="https://example.com/hero.jpg"
                  value={editableHeroImageUrl}
                  onChange={(e) => onHeroImageUrlChange(e.target.value)}
                  disabled={!canEdit}
                />
                {editableHeroImageUrl && (
                  <div className="mt-2 h-24 w-full rounded-lg border bg-muted/40 overflow-hidden">
                    <img
                      src={editableHeroImageUrl}
                      alt="Hero image preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            {canEdit && (
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={onSaveV2Metadata} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Corporate Metadata'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {editableDomain === 'Beer' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Beer Metadata</CardTitle>
              <CardDescription>
                Beer-specific product information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="beerAbv">ABV (%)</Label>
                  <Input
                    id="beerAbv"
                    type="number"
                    step="0.1"
                    placeholder="4.5"
                    value={editableBeerAbv}
                    onChange={(e) => onBeerAbvChange(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="beerStyle">Style</Label>
                  <Input
                    id="beerStyle"
                    type="text"
                    placeholder="IPA, Lager, Pale Ale..."
                    value={editableBeerStyle}
                    onChange={(e) => onBeerStyleChange(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="beerLaunchYear">Launch Year</Label>
                  <Input
                    id="beerLaunchYear"
                    type="number"
                    placeholder="2020"
                    value={editableBeerLaunchYear}
                    onChange={(e) => onBeerLaunchYearChange(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="beerOfficialUrl">Official Beer URL</Label>
                  <Input
                    id="beerOfficialUrl"
                    type="text"
                    placeholder="https://..."
                    value={editableBeerOfficialUrl}
                    onChange={(e) => onBeerOfficialUrlChange(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
              </div>
              {canEdit && (
                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={onSaveBeerMetadata} disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Beer Metadata'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <WikidataPanel
            wikidataData={{
              wikidata_candidate: page.wikidata_candidate || false,
              wikidata_status: page.wikidata_status || 'none',
              wikidata_qid: page.wikidata_qid,
              wikidata_label: page.wikidata_label || '',
              wikidata_description: page.wikidata_description || '',
              wikidata_language: page.wikidata_language || 'en',
              wikidata_intro_year: page.wikidata_intro_year,
              wikidata_abv: page.wikidata_abv,
              wikidata_style: page.wikidata_style,
              wikidata_official_website: page.wikidata_official_website,
              wikidata_image_url: page.wikidata_image_url,
              wikidata_notes: page.wikidata_notes,
              wikidata_verified_at: page.wikidata_verified_at,
              wikidata_last_exported_at: page.wikidata_last_exported_at,
            }}
            beerName={page.path.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || ''}
            beerAbv={page.beer_abv}
            beerStyle={page.beer_style}
            beerLaunchYear={page.beer_launch_year}
            beerOfficialUrl={page.beer_official_url}
            canEdit={canEdit}
            onSave={onSaveWikidata}
          />
        </>
      )}

      {editableDomain === 'Pub' && (
        <Card>
          <CardHeader>
            <CardTitle>Pub Module</CardTitle>
            <CardDescription>
              Phase 2 – not implemented yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The Pub module will be added in a future release. This will include schema generation for individual pub and hotel pages.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
