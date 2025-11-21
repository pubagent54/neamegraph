-- Update RLS policies for pages table
DROP POLICY IF EXISTS "All authenticated users can view pages" ON public.pages;
DROP POLICY IF EXISTS "Editors and admins can insert pages" ON public.pages;
DROP POLICY IF EXISTS "Editors and admins can update pages" ON public.pages;
DROP POLICY IF EXISTS "Admins can delete pages" ON public.pages;

-- Pages table: admin + editor can manage, viewer can view
CREATE POLICY "All authenticated users can view pages"
ON public.pages FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Editors and admins can insert pages"
ON public.pages FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role))
);

CREATE POLICY "Editors and admins can update pages"
ON public.pages FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Editors and admins can delete pages"
ON public.pages FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

-- Update RLS policies for schema_versions table
DROP POLICY IF EXISTS "All authenticated users can view schema_versions" ON public.schema_versions;
DROP POLICY IF EXISTS "Editors and admins can insert schema_versions" ON public.schema_versions;
DROP POLICY IF EXISTS "Admins can update schema_versions" ON public.schema_versions;

CREATE POLICY "All authenticated users can view schema_versions"
ON public.schema_versions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Editors and admins can insert schema_versions"
ON public.schema_versions FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Editors and admins can update schema_versions"
ON public.schema_versions FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Editors and admins can delete schema_versions"
ON public.schema_versions FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

-- Update RLS policies for rules table
DROP POLICY IF EXISTS "All authenticated users can view rules" ON public.rules;
DROP POLICY IF EXISTS "Admins can manage rules" ON public.rules;

CREATE POLICY "All authenticated users can view rules"
ON public.rules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert rules"
ON public.rules FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update rules"
ON public.rules FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete rules"
ON public.rules FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update RLS policies for settings table
DROP POLICY IF EXISTS "All authenticated users can view settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.settings;

CREATE POLICY "All authenticated users can view settings"
ON public.settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can update settings"
ON public.settings FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));