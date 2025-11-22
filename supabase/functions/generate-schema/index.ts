import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateSchemaRequest {
  page_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("generate-schema function called");

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { page_id }: GenerateSchemaRequest = await req.json();

    if (!page_id) {
      return new Response(
        JSON.stringify({ error: "page_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating schema for page:", page_id);

    // 1. Load page context
    const { data: page, error: pageError } = await supabase
      .from("pages")
      .select("*")
      .eq("id", page_id)
      .single();

    if (pageError || !page) {
      console.error("Error fetching page:", pageError);
      return new Response(
        JSON.stringify({ error: "Page not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if HTML has been fetched
    if (!page.last_html_hash) {
      return new Response(
        JSON.stringify({ error: "HTML not fetched yet. Please fetch HTML first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load settings for canonical_base_url
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("*")
      .single();

    if (settingsError || !settings) {
      console.error("Error fetching settings:", settingsError);
      return new Response(
        JSON.stringify({ error: "Settings not found" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load the active rule
    const { data: activeRule, error: ruleError } = await supabase
      .from("rules")
      .select("*")
      .eq("is_active", true)
      .single();

    if (ruleError || !activeRule) {
      console.error("Error fetching active rule:", ruleError);
      return new Response(
        JSON.stringify({ error: "No active rule found. Please activate a rule first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the HTML again (we could store it but for now we refetch)
    const fetchUrl = `${settings.fetch_base_url}${page.path}`;
    const fetchHeaders: HeadersInit = {
      "User-Agent": "NeameGraph-SchemaGenerator/1.0",
    };

    if (settings.preview_auth_user && settings.preview_auth_password) {
      const credentials = btoa(`${settings.preview_auth_user}:${settings.preview_auth_password}`);
      fetchHeaders["Authorization"] = `Basic ${credentials}`;
    }

    const htmlResponse = await fetch(fetchUrl, {
      headers: fetchHeaders,
      redirect: "follow",
    });

    if (!htmlResponse.ok) {
      console.error("Failed to fetch HTML:", htmlResponse.status);
      return new Response(
        JSON.stringify({ error: "Failed to fetch HTML for schema generation" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await htmlResponse.text();
    console.log("HTML fetched for schema generation, length:", html.length);

    // Trim HTML to reasonable size (keep first 50k characters to avoid token limits)
    const trimmedHtml = html.length > 50000 ? html.substring(0, 50000) + "\n<!-- HTML truncated for AI processing -->" : html;

    // Build canonical_url
    const canonicalBaseUrl = settings.canonical_base_url.replace(/\/$/, "");
    const canonicalUrl = `${canonicalBaseUrl}${page.path}`;

    // Check schema engine version
    const schemaEngineVersion = settings.schema_engine_version || "v1";
    
    if (schemaEngineVersion === "v2") {
      // Validate v2 requirements
      const v2PageTypes = ["EstatePage", "GovernancePage", "CommunityPage", "SiteHomePage"];
      
      if (!page.page_type || !v2PageTypes.includes(page.page_type)) {
        return new Response(
          JSON.stringify({ 
            error: "Corporate v2 schema generation requires a valid Page Type (EstatePage, GovernancePage, CommunityPage, or SiteHomePage). Please set the Page Type before generating schema.",
            validation_errors: ["Missing or invalid page_type for v2"]
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check category requirement (all types except SiteHomePage need a category)
      if (page.page_type !== "SiteHomePage" && !page.category) {
        return new Response(
          JSON.stringify({ 
            error: `Corporate v2 schema generation requires a Category for ${page.page_type}. Please set the Category before generating schema.`,
            validation_errors: ["Missing category for v2"]
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // For now, return an error - v2 generation not implemented yet
      return new Response(
        JSON.stringify({ 
          error: "Corporate v2 engine not implemented yet. Please use v1 - Classic in the meantime." 
        }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Continue with v1 logic below...
    // 2. Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userMessage = `
Generate JSON-LD schema for the following page:

Canonical URL: ${canonicalUrl}
Path: ${page.path}
Section: ${page.section || "unknown"}
Page Type: ${page.page_type || "unknown"}
Has FAQ: ${page.has_faq}
Notes: ${page.notes || "none"}

HTML Content:
${trimmedHtml}

CRITICAL REQUIREMENTS - Your response MUST include:
1. An "@context" field set to "https://schema.org"
2. An "@graph" array containing all entities
3. An Organization node with EXACTLY these properties:
   - "@type": ["Organization", "Corporation"]
   - "@id": "https://www.shepherdneame.co.uk/#organization"
   - "name": "Shepherd Neame Limited"
   - "url": "https://www.shepherdneame.co.uk"

Return ONLY the JSON-LD object. No explanations, no markdown code blocks, just the raw JSON starting with { and ending with }.
`;

    console.log("Calling Lovable AI...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: activeRule.body },
          { role: "user", content: userMessage }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI API error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices?.[0]?.message?.content;

    if (!generatedContent) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ error: "AI returned no content" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("AI response received, length:", generatedContent.length);

    // 3. Validate the response
    let jsonld;
    try {
      // Try to extract JSON from markdown code blocks if present
      let jsonContent = generatedContent.trim();
      if (jsonContent.startsWith("```")) {
        const match = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
          jsonContent = match[1].trim();
        }
      }
      
      jsonld = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      return new Response(
        JSON.stringify({
          error: "AI did not return valid JSON",
          details: generatedContent.substring(0, 500)
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Basic validation
    const validationErrors: string[] = [];

    if (!jsonld["@context"]) {
      validationErrors.push("Missing @context");
    }

    if (!jsonld["@graph"] || !Array.isArray(jsonld["@graph"])) {
      validationErrors.push("Missing or invalid @graph array");
    }

    // Check for Organization node
    const orgNode = jsonld["@graph"]?.find((node: any) =>
      node["@id"] === "https://www.shepherdneame.co.uk/#organization" &&
      node.name === "Shepherd Neame Limited"
    );

    if (!orgNode) {
      validationErrors.push("Missing required Organization node with correct @id and name");
    }

    // For beer pages, ensure no Product/Offer schema
    if (page.page_type === "beer_brand" || page.page_type === "beer_collection") {
      const hasCommerce = jsonld["@graph"]?.some((node: any) => {
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        return types.some((t: string) =>
          ["Product", "Offer", "AggregateOffer", "ProductModel", "ItemList"].includes(t)
        );
      });

      if (hasCommerce) {
        validationErrors.push("Beer pages must not include Product or Offer schema");
      }
    }

    if (validationErrors.length > 0) {
      console.error("Validation errors:", validationErrors);
      return new Response(
        JSON.stringify({
          error: "Schema validation failed",
          validation_errors: validationErrors
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Save schema version
    const jsonldString = JSON.stringify(jsonld, null, 2);

    // Calculate hash
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonldString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const schemaHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Get the next version number
    const { data: existingVersions, error: versionsError } = await supabase
      .from("schema_versions")
      .select("version_number")
      .eq("page_id", page_id)
      .order("version_number", { ascending: false })
      .limit(1);

    const nextVersionNumber = existingVersions && existingVersions.length > 0
      ? existingVersions[0].version_number + 1
      : 1;

    // Insert schema version
    const { data: schemaVersion, error: schemaError } = await supabase
      .from("schema_versions")
      .insert({
        page_id: page_id,
        version_number: nextVersionNumber,
        jsonld: jsonldString,
        status: "draft",
        created_by_user_id: user.id,
        rules_id: activeRule.id,
        google_rr_passed: false,
      })
      .select()
      .single();

    if (schemaError) {
      console.error("Error saving schema version:", schemaError);
      return new Response(
        JSON.stringify({ error: "Failed to save schema version" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update page
    const { error: pageUpdateError } = await supabase
      .from("pages")
      .update({
        last_schema_generated_at: new Date().toISOString(),
        last_schema_hash: schemaHash,
        status: "ai_draft",
        last_modified_by_user_id: user.id,
      })
      .eq("id", page_id);

    if (pageUpdateError) {
      console.error("Error updating page:", pageUpdateError);
    }

    // 6. Audit log
    await supabase.from("audit_log").insert({
      user_id: user.id,
      entity_type: "schema_version",
      entity_id: schemaVersion.id,
      action: "generate_schema",
      details: {
        page_id: page_id,
        page_path: page.path,
        version_number: nextVersionNumber,
        rule_id: activeRule.id,
        rule_name: activeRule.name,
      },
    });

    console.log("Schema generation completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        schema_version: schemaVersion,
        version_number: nextVersionNumber,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-schema function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

