import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ReactMarkdown from "react-markdown";

interface SchemaStoryProps {
  jsonld: string;
  pageType?: string | null;
  category?: string | null;
}

export function SchemaStory({ jsonld, pageType, category }: SchemaStoryProps) {
  const [story, setStory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function generateStory() {
      if (!jsonld) {
        setError("No JSON-LD available to generate story");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: invokeError } = await supabase.functions.invoke(
          'generate-schema-story',
          {
            body: { 
              jsonld,
              pageType,
              category
            }
          }
        );

        if (invokeError) {
          throw invokeError;
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        if (data?.story) {
          setStory(data.story);
        } else {
          throw new Error("No story returned from AI service");
        }
      } catch (err) {
        console.error('Error generating schema story:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate story');
      } finally {
        setLoading(false);
      }
    }

    generateStory();
  }, [jsonld, pageType, category]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Generating knowledge panel from JSON-LD...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!story) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No story could be generated from this schema.</p>
      </div>
    );
  }

  return (
    <div className="prose prose-sm max-w-none space-y-4">
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h3 className="text-lg font-semibold mb-3 mt-6 first:mt-0">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-foreground/90 leading-relaxed mb-3">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="space-y-2 ml-4 mb-4">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="text-foreground/90 leading-relaxed">{children}</li>
          ),
        }}
      >
        {story}
      </ReactMarkdown>
    </div>
  );
}
