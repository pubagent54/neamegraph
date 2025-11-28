import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink } from "lucide-react";

interface WikidataData {
  wikidata_candidate: boolean;
  wikidata_status: string;
  wikidata_qid: string | null;
  wikidata_label: string;
  wikidata_description: string;
  wikidata_language: string;
  wikidata_intro_year: number | null;
  wikidata_abv: number | null;
  wikidata_style: string | null;
  wikidata_official_website: string | null;
  wikidata_image_url: string | null;
  wikidata_notes: string | null;
  wikidata_verified_at: string | null;
  wikidata_last_exported_at: string | null;
}

interface WikidataPanelProps {
  wikidataData: WikidataData;
  beerName: string;
  beerAbv: number | null;
  beerStyle: string | null;
  beerLaunchYear: number | null;
  beerOfficialUrl: string | null;
  canEdit: boolean;
  onSave: (data: WikidataData) => Promise<void>;
}

const WIKIDATA_STATUS_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'draft', label: 'Draft' },
  { value: 'checked', label: 'Checked' },
  { value: 'ready_for_wikidata', label: 'Ready for Wikidata' },
  { value: 'exported', label: 'Exported' },
  { value: 'live', label: 'Live' },
];

export function WikidataPanel({
  wikidataData,
  beerName,
  beerAbv,
  beerStyle,
  beerLaunchYear,
  beerOfficialUrl,
  canEdit,
  onSave,
}: WikidataPanelProps) {
  const [formData, setFormData] = useState<WikidataData>(wikidataData);
  const [isSaving, setIsSaving] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize with sensible defaults if fields are empty
  useEffect(() => {
    if (!hasInitialized && !wikidataData.wikidata_label) {
      const defaultDescription = beerStyle 
        ? `${beerName} is a ${beerStyle.toLowerCase()} beer brewed by Shepherd Neame in Kent, England.`
        : `${beerName} is a beer brewed by Shepherd Neame in Kent, England.`;

      setFormData({
        ...wikidataData,
        wikidata_label: wikidataData.wikidata_label || beerName,
        wikidata_description: wikidataData.wikidata_description || defaultDescription,
        wikidata_language: wikidataData.wikidata_language || 'en',
        wikidata_intro_year: wikidataData.wikidata_intro_year ?? beerLaunchYear,
        wikidata_abv: wikidataData.wikidata_abv ?? beerAbv,
        wikidata_style: wikidataData.wikidata_style || beerStyle || '',
        wikidata_official_website: wikidataData.wikidata_official_website || beerOfficialUrl || '',
      });
      setHasInitialized(true);
    }
  }, [hasInitialized, wikidataData, beerName, beerAbv, beerStyle, beerLaunchYear, beerOfficialUrl]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wikidata</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Candidate & Status Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="candidate"
                checked={formData.wikidata_candidate}
                onCheckedChange={(checked) => setFormData({ ...formData, wikidata_candidate: checked })}
                disabled={!canEdit}
              />
              <Label htmlFor="candidate" className="font-medium">Candidate for Wikidata</Label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.wikidata_status}
                onValueChange={(value) => setFormData({ ...formData, wikidata_status: value })}
                disabled={!canEdit}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WIKIDATA_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.wikidata_qid && (
              <div className="space-y-2">
                <Label>Wikidata Item</Label>
                <a
                  href={`https://www.wikidata.org/wiki/${formData.wikidata_qid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  {formData.wikidata_qid}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Core Data Section */}
        <div className="space-y-4 border-t pt-4">
          <h4 className="text-sm font-semibold">Core data for the item</h4>
          
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={formData.wikidata_label}
                onChange={(e) => setFormData({ ...formData, wikidata_label: e.target.value })}
                disabled={!canEdit}
                placeholder="Beer name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.wikidata_description}
                onChange={(e) => setFormData({ ...formData, wikidata_description: e.target.value })}
                disabled={!canEdit}
                placeholder="Short Wikipedia-style description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Input
                  id="language"
                  value={formData.wikidata_language}
                  onChange={(e) => setFormData({ ...formData, wikidata_language: e.target.value })}
                  disabled={!canEdit}
                  placeholder="en"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="intro-year">Intro Year</Label>
                <Input
                  id="intro-year"
                  type="number"
                  value={formData.wikidata_intro_year ?? ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    wikidata_intro_year: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  disabled={!canEdit}
                  placeholder="YYYY"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="abv">ABV (%)</Label>
                <Input
                  id="abv"
                  type="number"
                  step="0.1"
                  value={formData.wikidata_abv ?? ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    wikidata_abv: e.target.value ? parseFloat(e.target.value) : null 
                  })}
                  disabled={!canEdit}
                  placeholder="4.5"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="style">Style</Label>
              <Input
                id="style"
                value={formData.wikidata_style ?? ''}
                onChange={(e) => setFormData({ ...formData, wikidata_style: e.target.value })}
                disabled={!canEdit}
                placeholder="e.g. English stout, Kentish pale ale"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Official Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.wikidata_official_website ?? ''}
                onChange={(e) => setFormData({ ...formData, wikidata_official_website: e.target.value })}
                disabled={!canEdit}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Image URL</Label>
              <Input
                id="image"
                type="url"
                value={formData.wikidata_image_url ?? ''}
                onChange={(e) => setFormData({ ...formData, wikidata_image_url: e.target.value })}
                disabled={!canEdit}
                placeholder="https://..."
              />
            </div>
          </div>
        </div>

        {/* Verification & Notes Section */}
        <div className="space-y-4 border-t pt-4">
          <h4 className="text-sm font-semibold">Verification & notes</h4>
          
          <div className="flex gap-4 text-xs text-muted-foreground">
            {formData.wikidata_verified_at && (
              <div>
                <span className="font-medium">Verified:</span>{' '}
                {formatDate(formData.wikidata_verified_at)}
              </div>
            )}
            {formData.wikidata_last_exported_at && (
              <div>
                <span className="font-medium">Last exported:</span>{' '}
                {formatDate(formData.wikidata_last_exported_at)}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.wikidata_notes ?? ''}
              onChange={(e) => setFormData({ ...formData, wikidata_notes: e.target.value })}
              disabled={!canEdit}
              placeholder="Sources, URLs, or other notes..."
              rows={3}
            />
          </div>
        </div>

        {canEdit && (
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? 'Saving...' : 'Save Wikidata'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}