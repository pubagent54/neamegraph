import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Files, User, Loader2, CheckCircle2, Settings as SettingsIcon, ChevronRight, Table, FlaskRound } from "lucide-react";
import { Link } from "react-router-dom";
import { DocumentsPanel } from "@/components/DocumentsPanel";

interface Stats {
  total: number;
  needs_attention: number;
  in_progress: number;
  implemented: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    needs_attention: 0,
    in_progress: 0,
    implemented: 0,
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
      
      // Needs Attention: Naked, needs review, or needs rework
      const needs_attention = pages?.filter((p) => 
        ["not_started", "needs_review", "needs_rework"].includes(p.status)
      ).length || 0;
      
      // In Progress: Approved or ready for upload
      const in_progress = pages?.filter((p) => 
        ["approved", "ai_draft"].includes(p.status)
      ).length || 0;
      
      // Implemented: Live on site
      const implemented = pages?.filter((p) => p.status === "implemented").length || 0;

      const corporate = pages?.filter((p) => (p.domain || 'Corporate') === 'Corporate').length || 0;
      const beer = pages?.filter((p) => p.domain === 'Beer').length || 0;
      const pub = pages?.filter((p) => p.domain === 'Pub').length || 0;

      setStats({ total, needs_attention, in_progress, implemented });
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
      icon: Files,
      description: "All pages tracked",
      bgClass: "bg-muted",
      iconClass: "text-muted-foreground",
    },
    {
      title: "Needs Attention",
      value: stats.needs_attention,
      icon: User,
      description: "Naked, Draft, or Needs Review",
      bgClass: "bg-rose-500/10 dark:bg-rose-500/20",
      iconClass: "text-rose-600 dark:text-rose-400",
    },
    {
      title: "In Progress",
      value: stats.in_progress,
      icon: Loader2,
      description: "Actively being worked on",
      bgClass: "bg-blue-500/10 dark:bg-blue-500/20",
      iconClass: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Implemented",
      value: stats.implemented,
      icon: CheckCircle2,
      description: "Tested or live and verified",
      bgClass: "bg-emerald-500/10 dark:bg-emerald-500/20",
      iconClass: "text-emerald-600 dark:text-emerald-400",
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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-card to-muted/30 hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center ${card.bgClass}`}>
                    <Icon className={`h-7 w-7 ${card.iconClass} ${card.title === "In Progress" ? "animate-spin" : ""}`} />
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
                <p className="text-sm text-muted-foreground">Using v2 Beers engine</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/30 dark:from-purple-950/30 dark:to-purple-900/10">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Pub Pages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-purple-700 dark:text-purple-400 mb-1">{domainStats.pub}</div>
                <p className="text-sm text-muted-foreground">Phase 3 – planned January 2026</p>
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
                NeameGraph uses the Corporate v2 schema engine to generate high-quality JSON-LD for your corporate pages. The engine version is locked here to keep your schema consistent and stable.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Quick Actions</CardTitle>
              <CardDescription>Common tasks and views</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/pages" className="block">
                <div className="flex items-center justify-between rounded-xl border px-4 py-3 hover:bg-muted/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Table className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">View All Pages</p>
                      <p className="text-xs text-muted-foreground">Browse the complete page inventory</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
              <Link to="/pages" className="block">
                <div className="flex items-center justify-between rounded-xl border px-4 py-3 hover:bg-muted/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center">
                      <User className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Fix Naked & Draft Pages</p>
                      <p className="text-xs text-muted-foreground">Tackle pages with no or early schema first</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
              <Link to="/pages" className="block">
                <div className="flex items-center justify-between rounded-xl border px-4 py-3 hover:bg-muted/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center">
                      <FlaskRound className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Review Ready for Test</p>
                      <p className="text-xs text-muted-foreground">Check pages queued for validation</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            </CardContent>
          </Card>

          <DocumentsPanel />
        </div>
      </div>
    </Layout>
  );
}
