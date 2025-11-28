-- Create table to store graph layout configurations
CREATE TABLE IF NOT EXISTS public.graph_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  layout_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  filter_key text NOT NULL DEFAULT 'default',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, filter_key)
);

-- Enable RLS
ALTER TABLE public.graph_layouts ENABLE ROW LEVEL SECURITY;

-- Users can manage their own layouts
CREATE POLICY "Users can view their own layouts"
  ON public.graph_layouts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own layouts"
  ON public.graph_layouts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own layouts"
  ON public.graph_layouts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own layouts"
  ON public.graph_layouts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_graph_layouts_updated_at
  BEFORE UPDATE ON public.graph_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_graph_layouts_user_filter ON public.graph_layouts(user_id, filter_key);