import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Page {
  id: string;
  path: string;
  section: string | null;
  page_type: string | null;
  status: string;
  has_faq: boolean;
  last_schema_generated_at: string | null;
}

export default function Pages() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [bulkPaths, setBulkPaths] = useState("");
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const { userRole } = useAuth();

  const canEdit = userRole === "admin" || userRole === "editor";

  useEffect(() => {
    fetchPages();
    const statusParam = searchParams.get("status");
    if (statusParam) {
      setStatusFilter(statusParam);
    }
  }, [searchParams]);

  const fetchPages = async () => {
    try {
      const { data, error } = await supabase
        .from("pages")
        .select("*")
        .order("path");

      if (error) throw error;
      setPages(data || []);
    } catch (error) {
      console.error("Error fetching pages:", error);
      toast.error("Failed to fetch pages");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAdd = async () => {
    try {
      const paths = bulkPaths
        .split("\n")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      if (paths.length === 0) {
        toast.error("Please enter at least one path");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      const pagesToInsert = paths.map((path) => {
        let section = "other";
        let page_type = "other";

        if (path.startsWith("/beers/")) {
          section = "beers";
          page_type = path.split("/").length > 3 ? "beer_brand" : "collection";
        } else if (path.startsWith("/pubs/") || path.startsWith("/our-pubs/")) {
          section = "pubs";
          page_type = "pubs_collection";
        } else if (path.startsWith("/news/") || path.startsWith("/press/")) {
          section = "news";
          page_type = path.split("/").length > 3 ? "news_article" : "collection";
        } else if (path.includes("about") || path.includes("history") || path.includes("heritage")) {
          section = "history";
          page_type = "about_page";
        } else if (path.includes("sustainability")) {
          section = "sustainability";
          page_type = "sustainability_page";
        } else if (path.includes("investors")) {
          section = "investors";
          page_type = "investors_page";
        } else if (path.includes("careers") || path.includes("jobs")) {
          section = "careers";
          page_type = "careers_page";
        } else if (path.includes("contact")) {
          section = "contact";
          page_type = "contact_page";
        }

        return {
          path,
          section,
          page_type,
          status: "not_started" as const,
          created_by_user_id: user?.id,
        };
      });

      const { error } = await supabase.from("pages").insert(pagesToInsert);

      if (error) throw error;

      toast.success(`Added ${paths.length} pages successfully`);
      setBulkPaths("");
      setBulkDialogOpen(false);
      fetchPages();
    } catch (error: any) {
      console.error("Error bulk adding pages:", error);
      toast.error(error.message || "Failed to add pages");
    }
  };

  const filteredPages = pages.filter((page) => {
    const matchesSearch = page.path.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || page.status === statusFilter;
    const matchesSection = sectionFilter === "all" || page.section === sectionFilter;
    return matchesSearch && matchesStatus && matchesSection;
  });

  const sections = Array.from(new Set(pages.map((p) => p.section).filter(Boolean)));

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pages</h1>
            <p className="text-muted-foreground">
              Manage corporate pages and their schema
            </p>
          </div>
          {canEdit && (
            <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Bulk Add Pages
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Add Pages</DialogTitle>
                  <DialogDescription>
                    Enter one path per line. Section and page type will be auto-detected.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  placeholder="/beers/spitfire&#10;/about-us&#10;/news/new-appointment"
                  value={bulkPaths}
                  onChange={(e) => setBulkPaths(e.target.value)}
                  className="min-h-[200px]"
                />
                <Button onClick={handleBulkAdd}>Add Pages</Button>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {sections.map((section) => (
                <SelectItem key={section} value={section!}>
                  {section}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="ai_draft">AI Draft</SelectItem>
              <SelectItem value="needs_review">Needs Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="implemented">Implemented</SelectItem>
              <SelectItem value="needs_rework">Needs Rework</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>FAQ</TableHead>
                  <TableHead>Last Schema</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No pages found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPages.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell className="font-mono text-sm">{page.path}</TableCell>
                      <TableCell>{page.section || "—"}</TableCell>
                      <TableCell>{page.page_type || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={page.status} />
                      </TableCell>
                      <TableCell>{page.has_faq ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {page.last_schema_generated_at
                          ? new Date(page.last_schema_generated_at).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/pages/${page.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Showing {filteredPages.length} of {pages.length} pages
        </p>
      </div>
    </Layout>
  );
}
