import { useEffect, useState, useRef, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Maximize2 } from "lucide-react";
import ForceGraph2D from "react-force-graph-2d";
import { useNavigate } from "react-router-dom";

type GraphNodeType = 'organization' | 'beer' | 'wikidata';

interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  subtitle?: string;
  pageId?: string | null;
  wikidataQid?: string | null;
  metrics?: {
    hasSchema?: boolean;
    schemaStatus?: string | null;
    hasWikidata?: boolean;
    pageStatus?: string;
    abv?: number | null;
    style?: string | null;
    launchYear?: number | null;
    officialUrl?: string | null;
  };
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphLink {
  id: string;
  source: string;
  target: string;
  relation: 'produces' | 'sameAs';
}

interface GraphSnapshot {
  nodes: GraphNode[];
  links: GraphLink[];
}

export default function Graph() {
  const navigate = useNavigate();
  const [graphData, setGraphData] = useState<GraphSnapshot>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set());
  const [schemaFilter, setSchemaFilter] = useState<'all' | 'no_schema' | 'has_schema'>('all');
  const [wikidataFilter, setWikidataFilter] = useState<'all' | 'with' | 'without'>('all');
  const fgRef = useRef<any>();

  const fetchGraphData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('graph-beers', {
        body: { schemaFilter, wikidataFilter },
      });

      if (error) throw error;

      setGraphData(data);
    } catch (error) {
      console.error("Error fetching graph data:", error);
    } finally {
      setLoading(false);
    }
  }, [schemaFilter, wikidataFilter]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);

    // Find connected nodes
    const connectedNodes = new Set<string>([node.id]);
    const connectedLinks = new Set<string>();

    graphData.links.forEach(link => {
      if (link.source === node.id || (typeof link.source === 'object' && (link.source as any).id === node.id)) {
        const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
        connectedNodes.add(targetId);
        connectedLinks.add(link.id);
      }
      if (link.target === node.id || (typeof link.target === 'object' && (link.target as any).id === node.id)) {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
        connectedNodes.add(sourceId);
        connectedLinks.add(link.id);
      }
    });

    setHighlightNodes(connectedNodes);
    setHighlightLinks(connectedLinks);
  }, [graphData.links]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());
  }, []);

  const handleResetView = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400);
    }
  }, []);

  const getNodeColor = (node: GraphNode): string => {
    if (highlightNodes.size > 0 && !highlightNodes.has(node.id)) {
      return 'rgba(128, 128, 128, 0.3)';
    }

    switch (node.type) {
      case 'organization':
        return 'hsl(var(--primary))';
      case 'wikidata':
        return 'hsl(var(--accent))';
      case 'beer':
        if (node.metrics?.hasSchema && node.metrics?.hasWikidata) {
          return 'hsl(142, 71%, 45%)'; // green
        } else if (node.metrics?.hasSchema) {
          return 'hsl(45, 93%, 47%)'; // amber
        } else {
          return 'hsl(0, 72%, 51%)'; // red
        }
      default:
        return 'hsl(var(--muted))';
    }
  };

  const getNodeSize = (node: GraphNode): number => {
    switch (node.type) {
      case 'organization':
        return 12;
      case 'wikidata':
        return 5;
      case 'beer':
        return 8;
      default:
        return 6;
    }
  };

  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.label;
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    const textWidth = ctx.measureText(label).width;
    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4);

    const nodeSize = getNodeSize(node);
    const nodeColor = getNodeColor(node);

    // Draw node circle
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, nodeSize, 0, 2 * Math.PI, false);
    ctx.fillStyle = nodeColor;
    ctx.fill();

    // Draw label background (only if zoomed in enough)
    if (globalScale > 1.5) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(
        node.x! - bckgDimensions[0] / 2,
        node.y! + nodeSize + 2,
        bckgDimensions[0],
        bckgDimensions[1]
      );

      // Draw label text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'white';
      ctx.fillText(label, node.x!, node.y! + nodeSize + 2 + bckgDimensions[1] / 2);
    }
  }, [highlightNodes]);

  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D) => {
    const isHighlighted = highlightLinks.has(link.id);
    const isDimmed = highlightNodes.size > 0 && !isHighlighted;

    ctx.strokeStyle = isDimmed
      ? 'rgba(128, 128, 128, 0.2)'
      : link.relation === 'produces'
      ? 'rgba(100, 100, 255, 0.4)'
      : 'rgba(255, 100, 100, 0.4)';
    ctx.lineWidth = isHighlighted ? 2 : 1;
  }, [highlightNodes, highlightLinks]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Knowledge Graph v1</h1>
          <p className="text-lg text-muted-foreground">
            Interactive visualization of Shepherd Neame's beer universe
          </p>
        </div>

        {/* Filters */}
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Schema:</span>
                <Select value={schemaFilter} onValueChange={(v: any) => setSchemaFilter(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="no_schema">No schema</SelectItem>
                    <SelectItem value="has_schema">Has schema</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Wikidata:</span>
                <Select value={wikidataFilter} onValueChange={(v: any) => setWikidataFilter(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="with">With QID</SelectItem>
                    <SelectItem value="without">Without QID</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleResetView} variant="outline" size="sm">
                <Maximize2 className="h-4 w-4 mr-2" />
                Reset View
              </Button>

              <div className="ml-auto flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(142, 71%, 45%)' }} />
                  <span>Schema + Wikidata</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(45, 93%, 47%)' }} />
                  <span>Schema only</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(0, 72%, 51%)' }} />
                  <span>No schema</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Graph */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
              {loading ? (
                <CardContent className="flex items-center justify-center h-[600px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </CardContent>
              ) : graphData.nodes.length === 0 ? (
                <CardContent className="flex items-center justify-center h-[600px] text-muted-foreground">
                  No graph data available with current filters
                </CardContent>
              ) : (
                <div className="relative">
                  <ForceGraph2D
                    ref={fgRef}
                    graphData={graphData}
                    nodeId="id"
                    nodeLabel={(node: any) => `${node.label}${node.subtitle ? ` (${node.subtitle})` : ''}`}
                    nodeCanvasObject={paintNode}
                    linkCanvasObject={paintLink}
                    onNodeClick={handleNodeClick}
                    onBackgroundClick={handleBackgroundClick}
                    width={800}
                    height={600}
                    backgroundColor="transparent"
                    linkDirectionalParticles={2}
                    linkDirectionalParticleSpeed={0.003}
                    cooldownTicks={100}
                    onEngineStop={() => fgRef.current?.zoomToFit(400)}
                  />
                </div>
              )}
            </Card>
          </div>

          {/* Details Panel */}
          <div className="lg:col-span-1">
            <Card className="rounded-2xl border-0 shadow-sm h-[600px] overflow-y-auto">
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedNode ? 'Node Details' : 'Select a Node'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedNode ? (
                  <p className="text-sm text-muted-foreground">
                    Click on a node in the graph to view its details
                  </p>
                ) : (
                  <>
                    {/* Node Type Badge */}
                    <div>
                      <Badge variant="secondary" className="capitalize">
                        {selectedNode.type}
                      </Badge>
                    </div>

                    {/* Label */}
                    <div>
                      <h3 className="text-xl font-semibold">{selectedNode.label}</h3>
                      {selectedNode.subtitle && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedNode.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Organization Details */}
                    {selectedNode.type === 'organization' && (
                      <div className="space-y-2">
                        <p className="text-sm">
                          Central node representing Shepherd Neame brewery
                        </p>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm font-medium">Connected Beers</p>
                          <p className="text-2xl font-bold mt-1">
                            {graphData.nodes.filter(n => n.type === 'beer').length}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Beer Details */}
                    {selectedNode.type === 'beer' && selectedNode.metrics && (
                      <div className="space-y-3">
                        {/* Schema Status */}
                        <div className="p-3 bg-muted rounded-lg space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Schema Status</p>
                          {selectedNode.metrics.hasSchema ? (
                            <>
                              <Badge variant="outline" className="capitalize">
                                {selectedNode.metrics.schemaStatus}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                Page status: {selectedNode.metrics.pageStatus}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-destructive">No schema generated</p>
                          )}
                        </div>

                        {/* Beer Properties */}
                        {(selectedNode.metrics.abv || selectedNode.metrics.style || selectedNode.metrics.launchYear) && (
                          <div className="p-3 bg-muted rounded-lg space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Beer Properties</p>
                            {selectedNode.metrics.abv && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">ABV:</span>
                                <span className="font-medium">{selectedNode.metrics.abv}%</span>
                              </div>
                            )}
                            {selectedNode.metrics.style && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Style:</span>
                                <span className="font-medium">{selectedNode.metrics.style}</span>
                              </div>
                            )}
                            {selectedNode.metrics.launchYear && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Launch Year:</span>
                                <span className="font-medium">{selectedNode.metrics.launchYear}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Wikidata */}
                        {selectedNode.wikidataQid && (
                          <div className="p-3 bg-muted rounded-lg space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Wikidata</p>
                            <a
                              href={`https://www.wikidata.org/wiki/${selectedNode.wikidataQid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                              {selectedNode.wikidataQid}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="pt-2 space-y-2">
                          {selectedNode.pageId && (
                            <Button
                              onClick={() => navigate(`/pages/${selectedNode.pageId}`)}
                              variant="outline"
                              className="w-full"
                              size="sm"
                            >
                              View Page
                            </Button>
                          )}
                          {selectedNode.metrics.officialUrl && (
                            <Button
                              onClick={() => window.open(selectedNode.metrics!.officialUrl!, '_blank')}
                              variant="outline"
                              className="w-full"
                              size="sm"
                            >
                              Official Beer Page
                              <ExternalLink className="h-3 w-3 ml-2" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Wikidata Details */}
                    {selectedNode.type === 'wikidata' && (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Wikidata item linked to beer entity
                        </p>
                        <Button
                          onClick={() => window.open(`https://www.wikidata.org/wiki/${selectedNode.wikidataQid}`, '_blank')}
                          variant="outline"
                          className="w-full"
                          size="sm"
                        >
                          View on Wikidata
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-card to-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Total Nodes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{graphData.nodes.length}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-card to-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Beer Entities</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {graphData.nodes.filter(n => n.type === 'beer').length}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-card to-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">With Wikidata</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {graphData.nodes.filter(n => n.type === 'beer' && n.metrics?.hasWikidata).length}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-card to-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Relationships</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{graphData.links.length}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
