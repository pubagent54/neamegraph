import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { FileText, CheckCircle2, AlertCircle, Clock, Rocket, Settings as SettingsIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Stats {
  total: number;
  no_schema: number;
  draft: number;
  approved: number;
  implemented: number;
  needs_rework: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    no_schema: 0,
    draft: 0,
    approved: 0,
    implemented: 0,
    needs_rework: 0,
  });
  const [domainStats, setDomainStats] = useState({
    corporate: 0,
    beer: 0,
    pub: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: pages, error } = await supabase
        .from("pages")
        .select("status, domain");

      if (error) throw error;

      const total = pages?.length || 0;
      const no_schema = pages?.filter((p) => p.status === "not_started").length || 0;
      const draft = pages?.filter((p) => p.status === "ai_draft").length || 0;
      const approved = pages?.filter((p) => p.status === "approved").length || 0;
      const implemented = pages?.filter((p) => p.status === "implemented").length || 0;
      const needs_rework = pages?.filter((p) => p.status === "needs_rework").length || 0;

      const corporate = pages?.filter((p) => (p.domain || 'Corporate') === 'Corporate').length || 0;
      const beer = pages?.filter((p) => p.domain === 'Beer').length || 0;
      const pub = pages?.filter((p) => p.domain === 'Pub').length || 0;

      setStats({ total, no_schema, draft, approved, implemented, needs_rework });
      setDomainStats({ corporate, beer, pub });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Pages",
      value: stats.total,
      icon: FileText,
      description: "All pages tracked",
      color: "text-primary",
    },
    {
      title: "No Schema",
      value: stats.no_schema,
      icon: AlertCircle,
      description: "Pages without schema",
      color: "text-muted-foreground",
    },
    {
      title: "Brain Draft",
      value: stats.draft,
      icon: Clock,
      description: "Awaiting review",
      color: "text-status-draft",
    },
    {
      title: "Approved",
      value: stats.approved,
      icon: CheckCircle2,
      description: "Ready for implementation",
      color: "text-status-approved",
    },
    {
      title: "Implemented",
      value: stats.implemented,
      icon: Rocket,
      description: "Live on site",
      color: "text-status-implemented",
    },
    {
      title: "Needs Rework",
      value: stats.needs_rework,
      icon: AlertCircle,
      description: "Requires attention",
      color: "text-status-error",
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-10">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Dashboard</h1>
          <p className="text-lg text-muted-foreground">
            Overview of your corporate schema management
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-card to-muted/30 hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <div className={`h-10 w-10 rounded-full bg-background/50 flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold mb-1">{card.value}</div>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Domain Breakdown */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-4">Domain Breakdown</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/30 dark:from-blue-950/30 dark:to-blue-900/10">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Corporate Pages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-blue-700 dark:text-blue-400 mb-1">{domainStats.corporate}</div>
                <p className="text-sm text-muted-foreground">Using v2 Corporate engine</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/30 dark:from-amber-950/30 dark:to-amber-900/10">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Beer Pages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-amber-700 dark:text-amber-400 mb-1">{domainStats.beer}</div>
                <p className="text-sm text-muted-foreground">Engine coming soon</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/30 dark:from-purple-950/30 dark:to-purple-900/10">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Pub Pages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-purple-700 dark:text-purple-400 mb-1">{domainStats.pub}</div>
                <p className="text-sm text-muted-foreground">Phase 2 - not implemented</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Schema Engine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                NeameGraph is using the Corporate v2 schema engine for this app. 
                This is locked and cannot be changed from here.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Quick Actions</CardTitle>
              <CardDescription>Common tasks and views</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to="/pages">
                <Button variant="outline" className="w-full justify-start rounded-full border-muted hover:bg-muted/50 transition-colors">
                  <FileText className="mr-2 h-4 w-4" />
                  View All Pages
                </Button>
              </Link>
              <Link to="/pages?status=ai_draft">
                <Button variant="outline" className="w-full justify-start rounded-full border-muted hover:bg-muted/50 transition-colors">
                  <Clock className="mr-2 h-4 w-4" />
                  Review Brain Drafts
                </Button>
              </Link>
              <Link to="/pages?status=needs_rework">
                <Button variant="outline" className="w-full justify-start rounded-full border-muted hover:bg-muted/50 transition-colors">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Pages Needing Rework
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Getting Started</CardTitle>
              <CardDescription>Next steps for your workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  1
                </div>
                <div>
                  <p className="font-semibold mb-1">Add Pages</p>
                  <p className="text-sm text-muted-foreground">
                    Import pages via CSV or sync from your sitemap
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  2
                </div>
                <div>
                  <p className="font-semibold mb-1">Configure Rules</p>
                  <p className="text-sm text-muted-foreground">
                    Set up NeameGraph Brain prompts for schema generation
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  3
                </div>
                <div>
                  <p className="font-semibold mb-1">Generate Schema</p>
                  <p className="text-sm text-muted-foreground">
                    Fetch HTML and create JSON-LD for your pages
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
