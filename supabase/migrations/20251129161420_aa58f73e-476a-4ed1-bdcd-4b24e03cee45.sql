-- Create issues table for tracking testing issues
CREATE TABLE public.issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue text NOT NULL,
  comments text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view all issues
CREATE POLICY "Authenticated users can view all issues"
ON public.issues
FOR SELECT
TO authenticated
USING (true);

-- All authenticated users can insert issues
CREATE POLICY "Authenticated users can insert issues"
ON public.issues
FOR INSERT
TO authenticated
WITH CHECK (true);

-- All authenticated users can update issues
CREATE POLICY "Authenticated users can update all issues"
ON public.issues
FOR UPDATE
TO authenticated
USING (true);

-- All authenticated users can delete issues
CREATE POLICY "Authenticated users can delete all issues"
ON public.issues
FOR DELETE
TO authenticated
USING (true);

-- Create index on created_at for ordering
CREATE INDEX idx_issues_created_at ON public.issues(created_at DESC);