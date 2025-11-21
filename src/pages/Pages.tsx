import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newPage, setNewPage] = useState({
    path: "",
    section: "",
    page_type: "",
    has_faq: false,
    priority: 1,
    notes: "",
  });
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

  const handleAddPage = async () => {
    try {
      if (!newPage.path) {
        toast.error("Path is required");
        return;
      }

      if (!newPage.path.startsWith("/")) {
        toast.error("Path must start with /");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("pages").insert({
        path: newPage.path,
        section: newPage.section || null,
        page_type: newPage.page_type || null,
        has_faq: newPage.has_faq,
        priority: newPage.priority || null,
        notes: newPage.notes || null,
        status: "not_started" as const,
        created_by_user_id: user?.id,
      });

      if (error) throw error;

      toast.success("Page added successfully");
      setNewPage({
        path: "",
        section: "",
        page_type: "",
        has_faq: false,
        priority: 1,
        notes: "",
      });
      setAddDialogOpen(false);
      fetchPages();
    } catch (error: any) {
      console.error("Error adding page:", error);
      toast.error(error.message || "Failed to add page");
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
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">Pages</h1>
            <p className="text-lg text-muted-foreground">
              Manage corporate pages and their schema
            </p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Page
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Page</DialogTitle>
                    <DialogDescription>
                      Manually add a single page to track
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="path">Path *</Label>
                      <Input
                        id="path"
                        placeholder="/beers/spitfire"
                        value={newPage.path}
                        onChange={(e) => setNewPage({ ...newPage, path: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="section">Section</Label>
                        <Input
                          id="section"
                          placeholder="beers, news, etc."
                          value={newPage.section}
                          onChange={(e) => setNewPage({ ...newPage, section: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="page_type">Page Type</Label>
                        <Input
                          id="page_type"
                          placeholder="beer_brand, etc."
                          value={newPage.page_type}
                          onChange={(e) => setNewPage({ ...newPage, page_type: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Input
                          id="priority"
                          type="number"
                          value={newPage.priority}
                          onChange={(e) => setNewPage({ ...newPage, priority: parseInt(e.target.value) || 1 })}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="flex items-center space-x-2 pt-8">
                        <input
                          type="checkbox"
                          id="has_faq"
                          checked={newPage.has_faq}
                          onChange={(e) => setNewPage({ ...newPage, has_faq: e.target.checked })}
                          className="rounded border-input"
                        />
                        <Label htmlFor="has_faq" className="cursor-pointer">Has FAQ</Label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        placeholder="Optional notes about this page..."
                        value={newPage.notes}
                        onChange={(e) => setNewPage({ ...newPage, notes: e.target.value })}
                        className="min-h-[80px] rounded-xl"
                      />
                    </div>
                    <Button onClick={handleAddPage} className="w-full rounded-full">Add Page</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-full">
                    <Upload className="mr-2 h-4 w-4" />
                    Bulk Add Pages
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
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
                    className="min-h-[200px] rounded-xl"
                  />
                  <Button onClick={handleBulkAdd} className="rounded-full">Add Pages</Button>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-full bg-muted/30 border-0 focus-visible:ring-primary/20"
            />
          </div>
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger className="w-[180px] rounded-full bg-muted/30 border-0">
              <SelectValue placeholder="Filter by section" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">All Sections</SelectItem>
              {sections.map((section) => (
                <SelectItem key={section} value={section!}>
                  {section}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] rounded-full bg-muted/30 border-0">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
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
          <div className="border-0 rounded-2xl overflow-hidden shadow-sm bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/30">
                  <TableHead className="font-semibold">Path</TableHead>
                  <TableHead className="font-semibold">Section</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">FAQ</TableHead>
                  <TableHead className="font-semibold">Last Schema</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
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
                          <Button variant="ghost" size="sm" className="rounded-full">
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

        <p className="text-sm text-muted-foreground px-2">
          Showing {filteredPages.length} of {pages.length} pages
        </p>
      </div>
    </Layout>
  );
}
