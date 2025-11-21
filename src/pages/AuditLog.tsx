import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user_id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  details: any;
  users: {
    email: string;
  };
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("audit_log")
        .select(`
          *,
          users (
            email
          )
        `)
        .order("timestamp", { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesEntityType =
      entityTypeFilter === "all" || log.entity_type === entityTypeFilter;
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    return matchesEntityType && matchesAction;
  });

  const entityTypes = Array.from(new Set(logs.map((l) => l.entity_type)));
  const actions = Array.from(new Set(logs.map((l) => l.action)));

  const actionColors: { [key: string]: string } = {
    create: "bg-status-approved/20 text-status-approved",
    update: "bg-status-review/20 text-status-review",
    delete: "bg-status-error/20 text-status-error",
    approve: "bg-status-implemented/20 text-status-implemented",
    reject: "bg-status-error/20 text-status-error",
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Audit Log</h1>
          <p className="text-lg text-muted-foreground">
            Track all system changes and user actions
          </p>
        </div>

        <div className="flex gap-3">
          <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
            <SelectTrigger className="w-[200px] rounded-full bg-muted/30 border-0">
              <SelectValue placeholder="Filter by entity" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">All Entities</SelectItem>
              {entityTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[200px] rounded-full bg-muted/30 border-0">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">All Actions</SelectItem>
              {actions.map((action) => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="py-12 text-center text-muted-foreground">
              No audit log entries found
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">{log.users.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.entity_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={actionColors[log.action] || ""}
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.entity_id && (
                        <span className="font-mono text-xs">
                          {log.entity_id.substring(0, 8)}...
                        </span>
                      )}
                      {log.details && (
                        <span className="ml-2">
                          {JSON.stringify(log.details).substring(0, 50)}...
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-sm text-muted-foreground px-2">
          Showing {filteredLogs.length} of {logs.length} entries
        </p>
      </div>
    </Layout>
  );
}
