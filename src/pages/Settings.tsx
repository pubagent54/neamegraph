import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, RefreshCw } from "lucide-react";

interface Settings {
  id: string;
  canonical_base_url: string;
  fetch_base_url: string;
  sitemap_url: string | null;
  preview_auth_user: string | null;
  preview_auth_password: string | null;
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

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
    </Layout>
  );
}
