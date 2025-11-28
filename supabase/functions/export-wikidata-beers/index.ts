import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WikidataBeer {
  id: string;
  path: string;
  wikidata_label: string;
  wikidata_description: string;
  wikidata_language: string;
  wikidata_intro_year: number | null;
  wikidata_abv: number | null;
  wikidata_style: string | null;
  wikidata_official_website: string | null;
  wikidata_image_url: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is authenticated and is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: userData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || userData?.role !== 'admin') {
      throw new Error('Admin access required');
    }

    console.log('Fetching beers ready for Wikidata export...');

    // Fetch beers ready for export
    const { data: beers, error: beersError } = await supabase
      .from('pages')
      .select('id, path, wikidata_label, wikidata_description, wikidata_language, wikidata_intro_year, wikidata_abv, wikidata_style, wikidata_official_website, wikidata_image_url')
      .eq('domain', 'Beer')
      .eq('wikidata_candidate', true)
      .eq('wikidata_status', 'ready_for_wikidata')
      .is('wikidata_qid', null);

    if (beersError) {
      console.error('Error fetching beers:', beersError);
      throw beersError;
    }

    console.log(`Found ${beers?.length || 0} beers to export`);

    if (!beers || beers.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No beers ready for export' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Build QuickStatements export
    const statements: string[] = [];

    for (const beer of beers as WikidataBeer[]) {
      const escapedLabel = (beer.wikidata_label || '').replace(/"/g, '\\"');
      const escapedDescription = (beer.wikidata_description || '').replace(/"/g, '\\"');
      const language = beer.wikidata_language || 'en';

      statements.push('CREATE');
      statements.push(`LAST\tL${language}\t"${escapedLabel}"`);
      statements.push(`LAST\tD${language}\t"${escapedDescription}"`);
      
      // P31 = instance of, Q44 = beer
      statements.push('LAST\tP31\tQ44');
      
      // P17 = country, Q145 = United Kingdom
      statements.push('LAST\tP17\tQ145');
      
      // P176 = manufacturer, Q12002324 = Shepherd Neame Limited
      statements.push('LAST\tP176\tQ12002324');
      
      // P2665 = alcohol by volume (only if present)
      if (beer.wikidata_abv !== null && beer.wikidata_abv !== undefined) {
        statements.push(`LAST\tP2665\t${beer.wikidata_abv}`);
      }
      
      // P577 = publication date/inception (only if year present)
      if (beer.wikidata_intro_year !== null && beer.wikidata_intro_year !== undefined) {
        statements.push(`LAST\tP577\t+${beer.wikidata_intro_year}-01-01T00:00:00Z/9`);
      }
      
      // P856 = official website (only if present)
      if (beer.wikidata_official_website) {
        const escapedUrl = beer.wikidata_official_website.replace(/"/g, '\\"');
        statements.push(`LAST\tP856\t"${escapedUrl}"`);
      }
      
      // P18 = image (only if present)
      if (beer.wikidata_image_url) {
        const escapedImageUrl = beer.wikidata_image_url.replace(/"/g, '\\"');
        statements.push(`LAST\tP18\t"${escapedImageUrl}"`);
      }
      
      // Add blank line between beers
      statements.push('');
    }

    const exportContent = statements.join('\n');

    // Update exported beers
    const beerIds = beers.map(b => b.id);
    const { error: updateError } = await supabase
      .from('pages')
      .update({
        wikidata_status: 'exported',
        wikidata_last_exported_at: new Date().toISOString(),
      })
      .in('id', beerIds);

    if (updateError) {
      console.error('Error updating beer status:', updateError);
      // Don't fail the export, just log the error
    }

    console.log(`Successfully exported ${beers.length} beers`);

    // Generate filename with timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
    const filename = `sheps-beers-wikidata-${timestamp}.txt`;

    return new Response(exportContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});