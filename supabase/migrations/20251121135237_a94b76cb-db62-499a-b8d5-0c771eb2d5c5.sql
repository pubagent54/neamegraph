-- Drop existing policies for pages table
DROP POLICY IF EXISTS "All authenticated users can view pages" ON public.pages;
DROP POLICY IF EXISTS "Editors and admins can insert pages" ON public.pages;
DROP POLICY IF EXISTS "Editors and admins can update pages" ON public.pages;
DROP POLICY IF EXISTS "Only admins can delete pages" ON public.pages;

-- Create improved policies for pages table
CREATE POLICY "All authenticated users can view pages"
ON public.pages
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Editors and admins can insert pages"
ON public.pages
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role))
  AND created_by_user_id = auth.uid()
  AND last_modified_by_user_id = auth.uid()
);

CREATE POLICY "Editors and admins can update pages"
ON public.pages
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (last_modified_by_user_id = auth.uid());

CREATE POLICY "Admins can delete pages"
ON public.pages
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update schema_versions policies
DROP POLICY IF EXISTS "All authenticated users can view schema_versions" ON public.schema_versions;
DROP POLICY IF EXISTS "Editors and admins can insert schema_versions" ON public.schema_versions;
DROP POLICY IF EXISTS "Admins can update schema_versions" ON public.schema_versions;

CREATE POLICY "All authenticated users can view schema_versions"
ON public.schema_versions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Editors and admins can insert schema_versions"
ON public.schema_versions
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role))
  AND created_by_user_id = auth.uid()
);

CREATE POLICY "Admins can update schema_versions"
ON public.schema_versions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update graph_nodes policies
DROP POLICY IF EXISTS "All authenticated users can view graph_nodes" ON public.graph_nodes;
DROP POLICY IF EXISTS "Admins can manage graph_nodes" ON public.graph_nodes;

CREATE POLICY "All authenticated users can view graph_nodes"
ON public.graph_nodes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage graph_nodes"
ON public.graph_nodes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Update graph_edges policies
DROP POLICY IF EXISTS "All authenticated users can view graph_edges" ON public.graph_edges;
DROP POLICY IF EXISTS "Admins can manage graph_edges" ON public.graph_edges;

CREATE POLICY "All authenticated users can view graph_edges"
ON public.graph_edges
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage graph_edges"
ON public.graph_edges
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Update rules policies
DROP POLICY IF EXISTS "All authenticated users can view rules" ON public.rules;
DROP POLICY IF EXISTS "Only admins can manage rules" ON public.rules;

CREATE POLICY "All authenticated users can view rules"
ON public.rules
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage rules"
ON public.rules
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND (created_by_user_id = auth.uid() OR created_by_user_id IS NULL)
);

-- Update settings policies
DROP POLICY IF EXISTS "All authenticated users can view settings" ON public.settings;
DROP POLICY IF EXISTS "Only admins can update settings" ON public.settings;

CREATE POLICY "All authenticated users can view settings"
ON public.settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can update settings"
ON public.settings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update audit_log policies
DROP POLICY IF EXISTS "All authenticated users can view audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "All authenticated users can insert audit_log" ON public.audit_log;

CREATE POLICY "All authenticated users can view audit_log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "All users can insert their own audit_log entries"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());