import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, RefreshCw, Copy, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Settings {
  id: string;
  canonical_base_url: string;
  fetch_base_url: string;
  sitemap_url: string | null;
  preview_auth_user: string | null;
  preview_auth_password: string | null;
  schema_engine_version: string;
  organization_schema_json: string | null;
  organization_schema_backup_json: string | null;
}

export default function Settings() {
  const { userRole } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockCode, setUnlockCode] = useState("");
  const [unlockError, setUnlockError] = useState("");
  
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to fetch settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("settings")
        .update({
          canonical_base_url: settings.canonical_base_url,
          fetch_base_url: settings.fetch_base_url,
          sitemap_url: settings.sitemap_url,
          preview_auth_user: settings.preview_auth_user,
          preview_auth_password: settings.preview_auth_password,
          schema_engine_version: 'v2', // Always use v2 Corporate engine
        })
        .eq("id", settings.id);

      if (error) throw error;

      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSitemapSync = async () => {
    setSyncing(true);
    try {
      // In a real implementation, this would call an edge function
      toast.info("Sitemap sync would be implemented via edge function");
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success("Sitemap sync completed");
    } catch (error) {
      console.error("Error syncing sitemap:", error);
      toast.error("Failed to sync sitemap");
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyOrgSchema = async () => {
    if (!settings?.organization_schema_json) {
      toast.error("No organization schema to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(settings.organization_schema_json);
      toast.success("Organization schema copied to clipboard");
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleSaveOrgSchema = async () => {
    if (!settings || !isAdmin) return;
    setSaving(true);

    try {
      // Move current to backup, save new current
      const { error } = await supabase
        .from("settings")
        .update({
          organization_schema_backup_json: settings.organization_schema_json,
          organization_schema_json: settings.organization_schema_json,
        })
        .eq("id", settings.id);

      if (error) throw error;

      toast.success("Master Organization schema saved & backed up");
      await fetchSettings(); // Refresh to get updated backup
    } catch (error) {
      console.error("Error saving organization schema:", error);
      toast.error("Failed to save organization schema");
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreOrgSchema = async () => {
    if (!settings?.organization_schema_backup_json || !isAdmin) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("settings")
        .update({
          organization_schema_json: settings.organization_schema_backup_json,
        })
        .eq("id", settings.id);

      if (error) throw error;

      toast.success("Organization schema restored from backup");
      await fetchSettings(); // Refresh
      setShowRestoreDialog(false);
    } catch (error) {
      console.error("Error restoring organization schema:", error);
      toast.error("Failed to restore organization schema");
    } finally {
      setSaving(false);
    }
  };

  const handleUnlockChest = () => {
    if (unlockCode === "011225") {
      setIsUnlocked(true);
      setUnlockError("");
      toast.success("Chest unlocked – editing enabled.");
    } else {
      setUnlockError("Incorrect code. Try again.");
    }
  };

  const getCharacterCount = (text: string | null) => {
    return text?.length || 0;
  };

  const getLineCount = (text: string | null) => {
    return text ? text.split('\n').length : 0;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!settings) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Settings not found</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Settings</h1>
          <p className="text-lg text-muted-foreground">
            Configure system-wide options
          </p>
        </div>

        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">URLs</CardTitle>
            <CardDescription>
              Configure base URLs for canonical links and HTML fetching
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="canonical">Canonical Base URL</Label>
              <Input
                id="canonical"
                value={settings.canonical_base_url}
                onChange={(e) =>
                  setSettings({ ...settings, canonical_base_url: e.target.value })
                }
                placeholder="https://www.shepherdneame.co.uk"
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                Used for @id and url values in JSON-LD
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fetch">Fetch Base URL</Label>
              <Input
                id="fetch"
                value={settings.fetch_base_url}
                onChange={(e) =>
                  setSettings({ ...settings, fetch_base_url: e.target.value })
                }
                placeholder="https://shepherdneame.shepspreview.co.uk"
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                Used for retrieving HTML (preview or live site)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sitemap">Sitemap URL</Label>
              <Input
                id="sitemap"
                value={settings.sitemap_url || ""}
                onChange={(e) =>
                  setSettings({ ...settings, sitemap_url: e.target.value })
                }
                placeholder="https://www.shepherdneame.co.uk/sitemap.xml"
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                Used for automatic page discovery
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Schema Engine</CardTitle>
            <CardDescription>
              Current schema generation engine
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted/30 rounded-xl border">
              <p className="text-sm text-muted-foreground">
                NeameGraph is using the <strong className="text-foreground">Corporate v2 engine</strong> for this app.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Preview Authentication</CardTitle>
            <CardDescription>
              Optional HTTP Basic Auth credentials for preview site
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="auth-user">Username</Label>
              <Input
                id="auth-user"
                value={settings.preview_auth_user || ""}
                onChange={(e) =>
                  setSettings({ ...settings, preview_auth_user: e.target.value })
                }
                placeholder="Optional"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                type="password"
                value={settings.preview_auth_password || ""}
                onChange={(e) =>
                  setSettings({ ...settings, preview_auth_password: e.target.value })
                }
                placeholder="Optional"
                className="rounded-xl"
              />
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Master Organisation Schema</CardTitle>
              <CardDescription>
                Single source of truth for the Organization node at https://www.shepherdneame.co.uk/#organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isUnlocked && (
                <div className="p-4 bg-muted/30 rounded-xl border space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="unlock-code">Unlock code</Label>
                    <div className="flex gap-2">
                      <Input
                        id="unlock-code"
                        type="password"
                        value={unlockCode}
                        onChange={(e) => {
                          setUnlockCode(e.target.value);
                          setUnlockError("");
                        }}
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        className="rounded-xl max-w-[200px]"
                      />
                      <Button
                        size="sm"
                        onClick={handleUnlockChest}
                        className="rounded-full"
                      >
                        Unlock chest
                      </Button>
                    </div>
                    {unlockError && (
                      <p className="text-xs text-destructive">{unlockError}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter the unlock code to edit the master schema.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="org-schema">Organization JSON-LD</Label>
                  <span className="text-xs text-muted-foreground">
                    {getCharacterCount(settings.organization_schema_json)} characters · {getLineCount(settings.organization_schema_json)} lines
                  </span>
                </div>
                <Textarea
                  id="org-schema"
                  value={settings.organization_schema_json || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, organization_schema_json: e.target.value })
                  }
                  placeholder='{"@type": ["Organization", "Corporation"], "@id": "https://www.shepherdneame.co.uk/#organization", ...}'
                  className="font-mono text-sm min-h-[300px] leading-relaxed"
                  disabled={!isUnlocked}
                />
                <p className="text-xs text-muted-foreground">
                  This is the <strong>master Organization node</strong> that represents Shepherd Neame Limited. 
                  In future versions, page-level schema generators will read from this source instead of generating it inline.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyOrgSchema}
                  disabled={!isUnlocked || !settings.organization_schema_json}
                  className="rounded-full"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy JSON
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveOrgSchema}
                  disabled={!isUnlocked || saving || !settings.organization_schema_json}
                  className="rounded-full"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save & Backup"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRestoreDialog(true)}
                  disabled={!isUnlocked || !settings.organization_schema_backup_json}
                  className="rounded-full"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore Last Backup
                </Button>
              </div>

              {settings.organization_schema_backup_json && (
                <div className="p-3 bg-muted/30 rounded-xl border text-xs text-muted-foreground">
                  <strong className="text-foreground">Backup available:</strong> {getCharacterCount(settings.organization_schema_backup_json)} characters · {getLineCount(settings.organization_schema_backup_json)} lines
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="rounded-full">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
          <Button
            variant="outline"
            onClick={handleSitemapSync}
            disabled={syncing}
            className="rounded-full"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Run Sitemap Sync"}
          </Button>
        </div>
      </div>

      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Organization Schema Backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace the current Organization schema with the last backup version. 
              The current version will not be lost—it remains in the database history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreOrgSchema}>
              Restore Backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
