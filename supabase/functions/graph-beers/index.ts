import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse filters from request
    const { schemaFilter, wikidataFilter } = await req.json().catch(() => ({
      schemaFilter: 'all',
      wikidataFilter: 'all',
    }));

    console.log('Fetching beer pages with filters:', { schemaFilter, wikidataFilter });

    // Fetch all beer pages
    let query = supabase
      .from('pages')
      .select(`
        id,
        path,
        domain,
        beer_abv,
        beer_style,
        beer_launch_year,
        beer_official_url,
        wikidata_qid,
        wikidata_label,
        status
      `)
      .eq('domain', 'Beer');

    // Apply wikidata filter
    if (wikidataFilter === 'with') {
      query = query.not('wikidata_qid', 'is', null);
    } else if (wikidataFilter === 'without') {
      query = query.is('wikidata_qid', null);
    }

    const { data: beerPages, error: pagesError } = await query;

    if (pagesError) {
      console.error('Error fetching beer pages:', pagesError);
      throw pagesError;
    }

    console.log(`Found ${beerPages?.length || 0} beer pages`);

    // Get latest schema versions for all beer pages
    const pageIds = beerPages?.map(p => p.id) || [];
    const { data: schemaVersions, error: schemaError } = await supabase
      .from('schema_versions')
      .select('page_id, status, jsonld')
      .in('page_id', pageIds)
      .order('version_number', { ascending: false });

    if (schemaError) {
      console.error('Error fetching schema versions:', schemaError);
    }

    // Build a map of latest schema status per page
    const latestSchemaMap = new Map();
    schemaVersions?.forEach(sv => {
      if (!latestSchemaMap.has(sv.page_id)) {
        latestSchemaMap.set(sv.page_id, sv);
      }
    });

    // Build nodes and links
    const nodes: any[] = [];
    const links: any[] = [];

    // Add Organization node (always present)
    nodes.push({
      id: 'org-sheps',
      type: 'organization',
      label: 'Shepherd Neame',
      subtitle: 'Brewery & pub company',
    });

    // Track Wikidata QIDs we've seen
    const wikidataQids = new Set<string>();

    // Add Beer nodes
    for (const beer of beerPages || []) {
      const latestSchema = latestSchemaMap.get(beer.id);
      const hasSchema = !!latestSchema;
      const schemaStatus = latestSchema?.status || null;
      const hasWikidata = !!beer.wikidata_qid;

      // Apply schema filter
      if (schemaFilter === 'no_schema' && hasSchema) continue;
      if (schemaFilter === 'has_schema' && !hasSchema) continue;

      // Extract beer name from path
      const pathParts = beer.path.split('/').filter(Boolean);
      const beerName = pathParts[pathParts.length - 1]
        ?.split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || 'Unknown Beer';

      // Build subtitle with ABV and style
      const subtitleParts: string[] = [];
      if (beer.beer_abv) subtitleParts.push(`${beer.beer_abv}%`);
      if (beer.beer_style) subtitleParts.push(beer.beer_style);
      const subtitle = subtitleParts.join(' • ') || undefined;

      const beerNode = {
        id: `beer-${beer.id}`,
        type: 'beer',
        label: beer.wikidata_label || beerName,
        subtitle,
        pageId: beer.id,
        wikidataQid: beer.wikidata_qid,
        metrics: {
          hasSchema,
          schemaStatus,
          hasWikidata,
          pageStatus: beer.status,
          abv: beer.beer_abv,
          style: beer.beer_style,
          launchYear: beer.beer_launch_year,
          officialUrl: beer.beer_official_url,
        },
      };

      nodes.push(beerNode);

      // Add link: Organization -> Beer
      links.push({
        id: `org-beer-${beer.id}`,
        source: 'org-sheps',
        target: `beer-${beer.id}`,
        relation: 'produces',
      });

      // Add Wikidata node if present
      if (beer.wikidata_qid && !wikidataQids.has(beer.wikidata_qid)) {
        wikidataQids.add(beer.wikidata_qid);
        nodes.push({
          id: `wikidata-${beer.wikidata_qid}`,
          type: 'wikidata',
          label: beer.wikidata_qid,
          subtitle: 'Wikidata',
          wikidataQid: beer.wikidata_qid,
        });
      }

      // Add link: Beer -> Wikidata
      if (beer.wikidata_qid) {
        links.push({
          id: `beer-wikidata-${beer.id}`,
          source: `beer-${beer.id}`,
          target: `wikidata-${beer.wikidata_qid}`,
          relation: 'sameAs',
        });
      }
    }

    console.log(`Built graph with ${nodes.length} nodes and ${links.length} links`);

    return new Response(
      JSON.stringify({
        nodes,
        links,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in graph-beers function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
