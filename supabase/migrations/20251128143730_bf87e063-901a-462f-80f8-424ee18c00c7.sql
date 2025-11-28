-- WIZmode v1 batch processing tables
-- Used to track CSV batch page creation and HTML/schema generation runs

-- Runs table
CREATE TABLE wizmode_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID REFERENCES public.users(id),
  label TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

-- Run items table - one per CSV row
CREATE TABLE wizmode_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES wizmode_runs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  domain TEXT NOT NULL,
  path TEXT NOT NULL,
  page_type TEXT,
  category TEXT,
  page_id UUID REFERENCES public.pages(id),
  result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'created', 'skipped_duplicate', 'error')),
  error_message TEXT,
  html_status TEXT NOT NULL DEFAULT 'pending' CHECK (html_status IN ('pending', 'success', 'failed')),
  schema_status TEXT NOT NULL DEFAULT 'pending' CHECK (schema_status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE wizmode_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wizmode_run_items ENABLE ROW LEVEL SECURITY;

-- RLS policies - admin and editor can view all, only admin can create runs
CREATE POLICY "Admins and editors can view wizmode_runs"
  ON wizmode_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND (role = 'admin' OR role = 'editor')
        AND active = true
    )
  );

CREATE POLICY "Admins can manage wizmode_runs"
  ON wizmode_runs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
        AND active = true
    )
  );

CREATE POLICY "Admins and editors can view wizmode_run_items"
  ON wizmode_run_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND (role = 'admin' OR role = 'editor')
        AND active = true
    )
  );

CREATE POLICY "Admins can manage wizmode_run_items"
  ON wizmode_run_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
        AND active = true
    )
  );

-- Indexes for performance
CREATE INDEX idx_wizmode_run_items_run_id ON wizmode_run_items(run_id);
CREATE INDEX idx_wizmode_run_items_page_id ON wizmode_run_items(page_id);
CREATE INDEX idx_wizmode_runs_created_by ON wizmode_runs(created_by_user_id);