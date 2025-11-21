import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FetchHtmlRequest {
  page_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("fetch-html function called");

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { page_id }: FetchHtmlRequest = await req.json();

    if (!page_id) {
      return new Response(
        JSON.stringify({ error: "page_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Fetching page:", page_id);

    // Fetch the page from database
    const { data: page, error: pageError } = await supabase
      .from("pages")
      .select("*")
      .eq("id", page_id)
      .single();

    if (pageError || !page) {
      console.error("Error fetching page:", pageError);
      return new Response(
        JSON.stringify({ error: "Page not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch settings to get base URL and auth credentials
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("*")
      .single();

    if (settingsError || !settings) {
      console.error("Error fetching settings:", settingsError);
      return new Response(
        JSON.stringify({ error: "Settings not found" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build the URL to fetch HTML from
    const fetchUrl = `${settings.fetch_base_url}${page.path}`;
    console.log("Fetching HTML from:", fetchUrl);

    // Prepare fetch headers
    const fetchHeaders: HeadersInit = {
      "User-Agent": "NeameGraph-HTMLFetcher/1.0",
    };

    // Add HTTP Basic Auth if configured
    if (settings.preview_auth_user && settings.preview_auth_password) {
      const credentials = btoa(`${settings.preview_auth_user}:${settings.preview_auth_password}`);
      fetchHeaders["Authorization"] = `Basic ${credentials}`;
      console.log("Using HTTP Basic Auth");
    }

    // Fetch the HTML
    const htmlResponse = await fetch(fetchUrl, {
      headers: fetchHeaders,
      redirect: "follow",
    });

    if (!htmlResponse.ok) {
      console.error("Failed to fetch HTML:", htmlResponse.status, htmlResponse.statusText);
      return new Response(
        JSON.stringify({
          error: `Failed to fetch HTML: ${htmlResponse.status} ${htmlResponse.statusText}`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const html = await htmlResponse.text();
    console.log("HTML fetched successfully, length:", html.length);

    // Calculate SHA-256 hash of the HTML
    const encoder = new TextEncoder();
    const data = encoder.encode(html);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const htmlHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    console.log("HTML hash calculated:", htmlHash);

    // Check if HTML has changed
    const htmlChanged = page.last_html_hash !== htmlHash;

    // Update page record with crawl metadata
    const { error: updateError } = await supabase
      .from("pages")
      .update({
        last_crawled_at: new Date().toISOString(),
        last_html_hash: htmlHash,
      })
      .eq("id", page_id);

    if (updateError) {
      console.error("Error updating page:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update page metadata" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Page metadata updated successfully");

    // Return the HTML and metadata
    return new Response(
      JSON.stringify({
        success: true,
        html,
        html_hash: htmlHash,
        html_changed: htmlChanged,
        fetch_url: fetchUrl,
        html_length: html.length,
        crawled_at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in fetch-html function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
