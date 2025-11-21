import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { FileText, CheckCircle2, AlertCircle, Clock, Rocket } from "lucide-react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: pages, error } = await supabase
        .from("pages")
        .select("status");

      if (error) throw error;

      const total = pages?.length || 0;
      const no_schema = pages?.filter((p) => p.status === "not_started").length || 0;
      const draft = pages?.filter((p) => p.status === "ai_draft").length || 0;
      const approved = pages?.filter((p) => p.status === "approved").length || 0;
      const implemented = pages?.filter((p) => p.status === "implemented").length || 0;
      const needs_rework = pages?.filter((p) => p.status === "needs_rework").length || 0;

      setStats({ total, no_schema, draft, approved, implemented, needs_rework });
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
      title: "AI Draft",
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
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your corporate schema management
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and views</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/pages">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  View All Pages
                </Button>
              </Link>
              <Link to="/pages?status=ai_draft">
                <Button variant="outline" className="w-full justify-start">
                  <Clock className="mr-2 h-4 w-4" />
                  Review AI Drafts
                </Button>
              </Link>
              <Link to="/pages?status=needs_rework">
                <Button variant="outline" className="w-full justify-start">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Pages Needing Rework
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Next steps for your workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium mb-1">1. Add Pages</p>
                <p className="text-muted-foreground">
                  Import pages via CSV or sync from your sitemap
                </p>
              </div>
              <div>
                <p className="font-medium mb-1">2. Configure Rules</p>
                <p className="text-muted-foreground">
                  Set up AI prompts for schema generation
                </p>
              </div>
              <div>
                <p className="font-medium mb-1">3. Generate Schema</p>
                <p className="text-muted-foreground">
                  Fetch HTML and create JSON-LD for your pages
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
