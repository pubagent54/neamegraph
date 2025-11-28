import { useEffect, useState, useRef, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ExternalLink, Maximize2, Download, Save, Play, Pause } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ForceGraph2D from "react-force-graph-2d";
import { useNavigate } from "react-router-dom";
import shepsLogo from "@/assets/neamegraph-logo.png";
import { useToast } from "@/hooks/use-toast";

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
  fx?: number;
  fy?: number;
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
  const { toast } = useToast();
  const [graphData, setGraphData] = useState<GraphSnapshot>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set());
  const [schemaFilter, setSchemaFilter] = useState<'all' | 'no_schema' | 'has_schema'>('all');
  const [wikidataFilter, setWikidataFilter] = useState<'all' | 'with' | 'without'>('all');
  const [isAnimating, setIsAnimating] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState([1]);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const fgRef = useRef<any>();
  const logoImageRef = useRef<HTMLImageElement | null>(null);

  // Load logo image for org node rendering
  useEffect(() => {
    const img = new Image();
    img.src = shepsLogo;
    img.onload = () => {
      logoImageRef.current = img;
    };
  }, []);

  const fetchGraphData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('graph-beers', {
        body: { schemaFilter, wikidataFilter },
      });

      if (error) throw error;

      setGraphData(data);
      
      // Load saved layout after data is fetched
      loadSavedLayout(data.nodes);
    } catch (error) {
      console.error("Error fetching graph data:", error);
    } finally {
      setLoading(false);
    }
  }, [schemaFilter, wikidataFilter]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  const loadSavedLayout = async (nodes: GraphNode[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const filterKey = `${schemaFilter}-${wikidataFilter}`;
      const { data, error } = await supabase
        .from('graph_layouts')
        .select('layout_data')
        .eq('user_id', user.id)
        .eq('filter_key', filterKey)
        .maybeSingle();

      if (error) {
        console.error('Error loading layout:', error);
        return;
      }

      if (data?.layout_data) {
        const layoutData = data.layout_data as Record<string, { x: number; y: number; fx: number; fy: number }>;
        
        // Apply saved positions to nodes
        nodes.forEach(node => {
          const savedPos = layoutData[node.id];
          if (savedPos) {
            node.x = savedPos.x;
            node.y = savedPos.y;
            node.fx = savedPos.fx;
            node.fy = savedPos.fy;
          }
        });
      }
    } catch (error) {
      console.error('Error loading layout:', error);
    }
  };

  const handleSaveLayout = async () => {
    if (!fgRef.current || graphData.nodes.length === 0) {
      toast({
        title: "Nothing to save",
        description: "No graph layout to save",
        variant: "destructive",
      });
      return;
    }

    setIsSavingLayout(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Capture current node positions
      const layoutData: Record<string, { x: number; y: number; fx: number | undefined; fy: number | undefined }> = {};
      graphData.nodes.forEach(node => {
        layoutData[node.id] = {
          x: node.x || 0,
          y: node.y || 0,
          fx: node.fx,
          fy: node.fy,
        };
      });

      const filterKey = `${schemaFilter}-${wikidataFilter}`;
      
      const { error } = await supabase
        .from('graph_layouts')
        .upsert({
          user_id: user.id,
          filter_key: filterKey,
          layout_data: layoutData,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,filter_key'
        });

      if (error) throw error;

      toast({
        title: "Layout saved",
        description: "Graph layout has been saved successfully",
      });
    } catch (error) {
      console.error('Error saving layout:', error);
      toast({
        title: "Save failed",
        description: "Could not save graph layout",
        variant: "destructive",
      });
    } finally {
      setIsSavingLayout(false);
    }
  };

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);

    // If organization node, open homepage in new tab
    if (node.type === 'organization') {
      window.open('https://www.shepherdneame.co.uk/', '_blank', 'noopener,noreferrer');
    }

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

  const toggleAnimation = useCallback(() => {
    if (!fgRef.current) return;
    
    if (isAnimating) {
      // Pause: fix all nodes in place
      graphData.nodes.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
          node.fx = node.x;
          node.fy = node.y;
        }
      });
      fgRef.current.d3ReheatSimulation();
    } else {
      // Resume: unfix all nodes
      graphData.nodes.forEach(node => {
        node.fx = undefined;
        node.fy = undefined;
      });
      fgRef.current.d3ReheatSimulation();
    }
    
    setIsAnimating(!isAnimating);
  }, [isAnimating, graphData.nodes]);

  const handleSpeedChange = useCallback((value: number[]) => {
    setAnimationSpeed(value);
    if (fgRef.current) {
      // Adjust simulation velocityDecay based on speed
      // Higher speed = less decay = faster movement
      const decay = 1 - (value[0] * 0.3); // 0.7 to 0.1 range
      fgRef.current.d3Force('charge').velocityDecay?.(decay);
      fgRef.current.d3ReheatSimulation();
    }
  }, []);

  const handleExportJSON = useCallback(() => {
    if (graphData.nodes.length === 0) {
      toast({
        title: "Nothing to export",
        description: "Adjust filters to show at least one node",
        variant: "destructive",
      });
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const snapshot = {
      generatedAt: new Date().toISOString(),
      filters: {
        schema: schemaFilter,
        wikidata: wikidataFilter,
      },
      nodes: graphData.nodes,
      links: graphData.links,
    };

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neamegraph-knowledge-graph-v1-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Graph JSON exported",
      description: "Download started",
    });
  }, [graphData, schemaFilter, wikidataFilter, toast]);

  const handleExportPNG = useCallback(() => {
    if (graphData.nodes.length === 0) {
      toast({
        title: "Nothing to export",
        description: "Adjust filters to show at least one node",
        variant: "destructive",
      });
      return;
    }

    if (!fgRef.current) {
      toast({
        title: "Export failed",
        description: "Graph not ready",
        variant: "destructive",
      });
      return;
    }

    try {
      const canvas = fgRef.current.renderer().domElement;
      const dataUrl = canvas.toDataURL('image/png');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `neamegraph-knowledge-graph-v1-${timestamp}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast({
        title: "Graph PNG exported",
        description: "Download started",
      });
    } catch (error) {
      console.error('Export PNG error:', error);
      toast({
        title: "Export failed",
        description: "Could not capture graph image",
        variant: "destructive",
      });
    }
  }, [graphData.nodes.length, toast]);

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

    // Special rendering for organization node with logo
    if (node.type === 'organization' && logoImageRef.current) {
      const logoSize = nodeSize * 2.5;
      const isDimmed = highlightNodes.size > 0 && !highlightNodes.has(node.id);
      
      // Draw circle background
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, logoSize, 0, 2 * Math.PI, false);
      ctx.fillStyle = isDimmed ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.95)';
      ctx.fill();
      ctx.strokeStyle = isDimmed ? 'rgba(128, 128, 128, 0.3)' : nodeColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw logo inside circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, logoSize - 4, 0, 2 * Math.PI, false);
      ctx.clip();
      ctx.globalAlpha = isDimmed ? 0.3 : 1;
      
      const imgSize = (logoSize - 4) * 1.6;
      ctx.drawImage(
        logoImageRef.current,
        node.x! - imgSize / 2,
        node.y! - imgSize / 2,
        imgSize,
        imgSize
      );
      ctx.restore();

      // Draw label below (only if zoomed in enough)
      if (globalScale > 1.5) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(
          node.x! - bckgDimensions[0] / 2,
          node.y! + logoSize + 2,
          bckgDimensions[0],
          bckgDimensions[1]
        );

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white';
        ctx.fillText(label, node.x!, node.y! + logoSize + 2 + bckgDimensions[1] / 2);
      }
    } else {
      // Standard rendering for beer/wikidata nodes
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

              <Button 
                onClick={handleSaveLayout} 
                variant="outline" 
                size="sm"
                disabled={isSavingLayout || graphData.nodes.length === 0}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Layout
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportJSON}>
                    Export JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPNG}>
                    Export PNG
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-2 border-l pl-4">
                <Button
                  onClick={toggleAnimation}
                  variant="outline"
                  size="sm"
                >
                  {isAnimating ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <div className="flex items-center gap-2 min-w-[120px]">
                  <span className="text-xs text-muted-foreground">Speed:</span>
                  <Slider
                    value={animationSpeed}
                    onValueChange={handleSpeedChange}
                    min={0.5}
                    max={3}
                    step={0.5}
                    className="w-20"
                  />
                </div>
              </div>

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
                    onNodeDragEnd={(node: any) => {
                      node.fx = node.x;
                      node.fy = node.y;
                    }}
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
