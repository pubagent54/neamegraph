import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";

interface GraphNode {
  id: string;
  schema_id: string;
  label: string | null;
  node_type: string | null;
  status: string | null;
  site: string;
}

interface GraphEdge {
  id: string;
  source_schema_id: string;
  target_schema_id: string;
  relationship: string;
}

export default function Graph() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGraphData();
  }, []);

  const fetchGraphData = async () => {
    try {
      const [nodesResult, edgesResult] = await Promise.all([
        supabase.from("graph_nodes").select("*"),
        supabase.from("graph_edges").select("*"),
      ]);

      if (nodesResult.error) throw nodesResult.error;
      if (edgesResult.error) throw edgesResult.error;

      setNodes(nodesResult.data || []);
      setEdges(edgesResult.data || []);
    } catch (error) {
      console.error("Error fetching graph data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getNodesByType = () => {
    const types: { [key: string]: GraphNode[] } = {};
    nodes.forEach((node) => {
      const type = node.node_type || "Unknown";
      if (!types[type]) types[type] = [];
      types[type].push(node);
    });
    return types;
  };

  const nodesByType = getNodesByType();

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Knowledge Graph</h1>
          <p className="text-lg text-muted-foreground">
            Visual representation of schema entities and relationships
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : nodes.length === 0 ? (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="py-12 text-center text-muted-foreground">
              No graph data available yet. Generate and approve schemas to build the graph.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-card to-muted/30">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Total Nodes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">{nodes.length}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-card to-muted/30">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Total Relationships</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">{edges.length}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-card to-muted/30">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Entity Types</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">{Object.keys(nodesByType).length}</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {Object.entries(nodesByType).map(([type, typeNodes]) => (
                <Card key={type} className="rounded-2xl border-0 shadow-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{type}</CardTitle>
                      <Badge variant="secondary" className="rounded-full">{typeNodes.length} nodes</Badge>
                    </div>
                    <CardDescription>
                      Entities of type {type}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {typeNodes.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{node.label || node.schema_id}</p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {node.schema_id}
                            </p>
                          </div>
                          {node.status && (
                            <StatusBadge status={node.status} />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {edges.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Relationships</CardTitle>
                  <CardDescription>
                    Connections between entities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {edges.slice(0, 20).map((edge) => (
                      <div
                        key={edge.id}
                        className="p-3 rounded-lg border text-sm"
                      >
                        <p className="font-mono text-xs mb-2 text-muted-foreground">
                          {edge.source_schema_id}
                        </p>
                        <p className="text-center font-medium text-primary">
                          → {edge.relationship} →
                        </p>
                        <p className="font-mono text-xs mt-2 text-muted-foreground">
                          {edge.target_schema_id}
                        </p>
                      </div>
                    ))}
                    {edges.length > 20 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        And {edges.length - 20} more relationships...
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
