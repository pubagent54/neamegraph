import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WizmodeRequest {
  run_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("wizmode-process function called");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { run_id }: WizmodeRequest = await req.json();

    if (!run_id) {
      return new Response(
        JSON.stringify({ error: "run_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing WIZmode run:", run_id);

    // Update run status to running
    await supabase
      .from("wizmode_runs")
      .update({ status: "running" })
      .eq("id", run_id);

    // Fetch all items for this run
    const { data: items, error: itemsError } = await supabase
      .from("wizmode_run_items")
      .select("*")
      .eq("run_id", run_id)
      .order("row_number");

    if (itemsError) throw itemsError;

    console.log(`Found ${items?.length || 0} items to process`);

    // Helper to normalize paths (same as frontend)
    const normalizePath = (path: string): string => {
      let normalized = path.trim();
      if (!normalized.startsWith("/")) {
        normalized = "/" + normalized;
      }
      if (normalized !== "/" && normalized.endsWith("/")) {
        normalized = normalized.slice(0, -1);
      }
      return normalized.toLowerCase();
    };

    // Process each item sequentially
    for (const item of items || []) {
      console.log(`Processing row ${item.row_number}: ${item.path}`);

      try {
        // Validate required fields
        if (!item.domain || !item.path || !item.page_type || !item.category) {
          await supabase
            .from("wizmode_run_items")
            .update({
              result: "error",
              error_message: "Missing required field (domain, path, page_type, or category)",
            })
            .eq("id", item.id);
          continue;
        }

        const normalizedPath = normalizePath(item.path);

        // Check for duplicate
        const { data: existingPage } = await supabase
          .from("pages")
          .select("id, path")
          .eq("path", normalizedPath)
          .single();

        let pageId: string;
        let result: string;

        if (existingPage) {
          // Page exists - update it (fetch fresh HTML + generate new schema)
          pageId = existingPage.id;
          result = "updated";
          console.log(`Found existing page: ${normalizedPath} (ID: ${existingPage.id}) - will update`);
        } else {
          // Create new page
          const { data: newPage, error: createError } = await supabase
            .from("pages")
            .insert({
              domain: item.domain,
              path: normalizedPath,
              page_type: item.page_type,
              category: item.category,
              status: "not_started",
            })
            .select()
            .single();

          if (createError) throw createError;

          pageId = newPage.id;
          result = "created";
          console.log(`Created page: ${normalizedPath} (ID: ${newPage.id})`);
        }

        // Update item with page_id and result
        await supabase
          .from("wizmode_run_items")
          .update({
            result: result,
            page_id: pageId,
          })
          .eq("id", item.id);

        // Run Fetch HTML (for both new and existing pages)
        try {
          console.log(`Fetching HTML for ${normalizedPath}...`);
          const { error: htmlError } = await supabase.functions.invoke("fetch-html", {
            body: { page_id: pageId },
          });

          if (htmlError) throw htmlError;

          await supabase
            .from("wizmode_run_items")
            .update({ html_status: "success" })
            .eq("id", item.id);

          console.log(`HTML fetch success for ${normalizedPath}`);
        } catch (htmlError: any) {
          console.error(`HTML fetch failed for ${normalizedPath}:`, htmlError);
          await supabase
            .from("wizmode_run_items")
            .update({ html_status: "failed" })
            .eq("id", item.id);
        }

        // Run Generate Schema (for both new and existing pages)
        try {
          console.log(`Generating schema for ${normalizedPath}...`);
          const { error: schemaError } = await supabase.functions.invoke("generate-schema", {
            body: { page_id: pageId },
          });

          if (schemaError) throw schemaError;

          await supabase
            .from("wizmode_run_items")
            .update({ schema_status: "success" })
            .eq("id", item.id);

          console.log(`Schema generation success for ${normalizedPath}`);
        } catch (schemaError: any) {
          console.error(`Schema generation failed for ${normalizedPath}:`, schemaError);
          await supabase
            .from("wizmode_run_items")
            .update({ schema_status: "failed" })
            .eq("id", item.id);
        }
      } catch (rowError: any) {
        console.error(`Error processing row ${item.row_number}:`, rowError);
        await supabase
          .from("wizmode_run_items")
          .update({
            result: "error",
            error_message: rowError.message || "Unknown error",
          })
          .eq("id", item.id);
      }
    }

    // Mark run as completed
    await supabase
      .from("wizmode_runs")
      .update({ status: "completed" })
      .eq("id", run_id);

    console.log("WIZmode run completed successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Run completed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in wizmode-process:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
