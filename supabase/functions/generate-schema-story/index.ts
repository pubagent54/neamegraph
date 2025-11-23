import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jsonld, pageType, category } = await req.json();

    if (!jsonld) {
      return new Response(
        JSON.stringify({ error: 'jsonld is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a Schema Storyteller for Shepherd Neame. You will be given a single JSON-LD block and optional hints about page type and category. Your job is to explain, in clear human language, what this data says about the page and the entities it describes. Base your answer **only** on the JSON-LD you see. Do not invent facts that are not present.

Structure your answer as:

1. 'What this page is about'
   - 2–3 short sentences summarising the main topic (e.g. a beer brand, a collection of pubs, a community programme, a news article, etc.).

2. 'Key entities and facts'
   - Bullet points for:
     - The main entity (the thing referenced by mainEntity / mainEntityOfPage).
     - The Organization (Shepherd Neame) and how it relates (manufacturer, provider, sponsor, etc.).
     - Any collections (ItemList), programmes, services, beers, brands, pubs, places or events.
   - Include important properties: names, descriptions, URLs, images/logos, ABV, formats, types, categories, etc., but only when they appear in the JSON-LD.

3. 'Important relationships'
   - A few bullets that explain the relationships in simple language (e.g. 'This beer is brewed by Shepherd Neame and sold in keg format.').

Rules:
- Base everything strictly on the JSON-LD you receive.
- Do not mention that you are an AI model.
- Do not show JSON, code fences or schema.org property names unless unavoidable.
- Do NOT include sections like 'How this page fits into the site' or 'Why this is safe and useful' – those belong in the Summary tab.
- Write in a confident, knowledgeable tone.
- Use markdown formatting for headings (##) and bullet points (-)`;

    const userPrompt = `Here is the JSON-LD for a Shepherd Neame page${pageType ? ` (Page Type: ${pageType}` : ''}${category ? `, Category: ${category})` : pageType ? ')' : ''}:

${jsonld}

Please explain what this schema says about the page, based only on what you can see in the JSON-LD above.`;

    console.log('Calling Lovable AI for schema story generation...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to generate story from AI service' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const story = data.choices?.[0]?.message?.content;

    if (!story) {
      console.error('No story content in AI response');
      return new Response(
        JSON.stringify({ error: 'AI service returned empty response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Schema story generated successfully');

    return new Response(
      JSON.stringify({ story }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-schema-story:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
