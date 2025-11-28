import { createClient } from 'npm:@supabase/supabase-js@2';

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
    const { scope, schemaFilter, wikidataFilter } = await req.json().catch(() => ({
      scope: 'Beers',
      schemaFilter: 'all',
      wikidataFilter: 'all',
    }));

    console.log('Fetching graph data with filters:', { scope, schemaFilter, wikidataFilter });

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

    // Helper function to fetch and process pages by domain
    const fetchDomainPages = async (domain: string, nodeType: string) => {
      let query = supabase
        .from('pages')
        .select(`
          id,
          path,
          domain,
          page_type,
          category,
          beer_abv,
          beer_style,
          beer_launch_year,
          beer_official_url,
          wikidata_qid,
          wikidata_label,
          status
        `)
        .eq('domain', domain);

      // Apply wikidata filter (only for Beer domain)
      if (domain === 'Beer') {
        if (wikidataFilter === 'with') {
          query = query.not('wikidata_qid', 'is', null);
        } else if (wikidataFilter === 'without') {
          query = query.is('wikidata_qid', null);
        }
      }

      const { data: pages, error: pagesError } = await query;

      if (pagesError) {
        console.error(`Error fetching ${domain} pages:`, pagesError);
        throw pagesError;
      }

      console.log(`Found ${pages?.length || 0} ${domain} pages`);

      // Get latest schema versions for all pages
      const pageIds = pages?.map(p => p.id) || [];
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

      // Process pages
      for (const page of pages || []) {
        const latestSchema = latestSchemaMap.get(page.id);
        const hasSchema = !!latestSchema;
        const schemaStatus = latestSchema?.status || null;

        // Apply schema filter
        if (schemaFilter === 'no_schema' && hasSchema) continue;
        if (schemaFilter === 'has_schema' && !hasSchema) continue;

        let nodeId: string;
        let label: string;
        let subtitle: string | undefined;
        let metrics: any;

        if (domain === 'Beer') {
          // Extract beer name from path
          const pathParts = page.path.split('/').filter(Boolean);
          const beerName = pathParts[pathParts.length - 1]
            ?.split('-')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ') || 'Unknown Beer';

          // Build subtitle with ABV and style
          const subtitleParts: string[] = [];
          if (page.beer_abv) subtitleParts.push(`${page.beer_abv}%`);
          if (page.beer_style) subtitleParts.push(page.beer_style);
          subtitle = subtitleParts.join(' • ') || undefined;

          nodeId = `beer-${page.id}`;
          label = page.wikidata_label || beerName;
          metrics = {
            hasSchema,
            schemaStatus,
            hasWikidata: !!page.wikidata_qid,
            pageStatus: page.status,
            abv: page.beer_abv,
            style: page.beer_style,
            launchYear: page.beer_launch_year,
            officialUrl: page.beer_official_url,
          };
        } else if (domain === 'Corporate') {
          // Extract corporate page name from path
          const pathParts = page.path.split('/').filter(Boolean);
          const pageName = pathParts[pathParts.length - 1]
            ?.split('-')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ') || 'Corporate Page';

          // Build subtitle with page type and category
          const subtitleParts: string[] = [];
          if (page.page_type) subtitleParts.push(page.page_type);
          if (page.category) subtitleParts.push(page.category);
          subtitle = subtitleParts.join(' • ') || undefined;

          nodeId = `corporate-${page.id}`;
          label = pageName;
          metrics = {
            hasSchema,
            schemaStatus,
            pageStatus: page.status,
            pageType: page.page_type,
            category: page.category,
          };
        } else if (domain === 'Pub') {
          // Extract pub name from path
          const pathParts = page.path.split('/').filter(Boolean);
          const pubName = pathParts[pathParts.length - 1]
            ?.split('-')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ') || 'Pub Page';

          // Build subtitle with category
          subtitle = page.category || undefined;

          nodeId = `pub-${page.id}`;
          label = pubName;
          metrics = {
            hasSchema,
            schemaStatus,
            pageStatus: page.status,
            category: page.category,
          };
        } else {
          continue;
        }

        const node = {
          id: nodeId,
          type: `${domain.toLowerCase()}_page`,
          domain,
          label,
          subtitle,
          pageId: page.id,
          wikidataQid: page.wikidata_qid,
          metrics,
        };

        nodes.push(node);

        // Add link: Organization -> Page
        links.push({
          id: `org-${nodeId}`,
          source: 'org-sheps',
          target: nodeId,
          relation: domain === 'Beer' ? 'produces' : 'describes',
        });

        // Add Wikidata node and link if present (Beer only)
        if (domain === 'Beer' && page.wikidata_qid) {
          if (!wikidataQids.has(page.wikidata_qid)) {
            wikidataQids.add(page.wikidata_qid);
            nodes.push({
              id: `wikidata-${page.wikidata_qid}`,
              type: 'wikidata',
              label: page.wikidata_qid,
              subtitle: 'Wikidata',
              wikidataQid: page.wikidata_qid,
            });
          }

          links.push({
            id: `${nodeId}-wikidata`,
            source: nodeId,
            target: `wikidata-${page.wikidata_qid}`,
            relation: 'sameAs',
          });
        }
      }
    };

    // Fetch pages based on scope
    if (scope === 'All') {
      await fetchDomainPages('Beer', 'beer_page');
      await fetchDomainPages('Corporate', 'corporate_page');
      await fetchDomainPages('Pub', 'pub_page');
    } else if (scope === 'Beers') {
      await fetchDomainPages('Beer', 'beer_page');
    } else if (scope === 'Corporate') {
      await fetchDomainPages('Corporate', 'corporate_page');
    } else if (scope === 'Pubs') {
      await fetchDomainPages('Pub', 'pub_page');
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
    console.error('Error in graph-pages function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
