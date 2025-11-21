-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

-- Create page_status enum
CREATE TYPE public.page_status AS ENUM (
  'not_started',
  'ai_draft',
  'needs_review',
  'approved',
  'implemented',
  'needs_rework',
  'removed_from_sitemap'
);

-- Create schema_version_status enum
CREATE TYPE public.schema_version_status AS ENUM (
  'draft',
  'approved',
  'deprecated',
  'rejected'
);

-- Create settings table (single row config)
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_base_url TEXT NOT NULL DEFAULT 'https://www.shepherdneame.co.uk',
  fetch_base_url TEXT NOT NULL DEFAULT 'https://shepherdneame.shepspreview.co.uk',
  sitemap_url TEXT,
  preview_auth_user TEXT,
  preview_auth_password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true
);

-- Create pages table
CREATE TABLE public.pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT UNIQUE NOT NULL,
  section TEXT,
  page_type TEXT,
  status public.page_status NOT NULL DEFAULT 'not_started',
  has_faq BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER,
  notes TEXT,
  last_crawled_at TIMESTAMPTZ,
  last_html_hash TEXT,
  last_schema_generated_at TIMESTAMPTZ,
  last_schema_hash TEXT,
  discovered_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES public.users(id),
  last_modified_by_user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rules table
CREATE TABLE public.rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID REFERENCES public.users(id)
);

-- Create schema_versions table
CREATE TABLE public.schema_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  jsonld TEXT NOT NULL,
  status public.schema_version_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID REFERENCES public.users(id),
  approved_by_user_id UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  google_rr_passed BOOLEAN NOT NULL DEFAULT false,
  validation_notes TEXT,
  rules_id UUID REFERENCES public.rules(id),
  UNIQUE(page_id, version_number)
);

-- Create audit_log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  details JSONB
);

-- Create graph_nodes table
CREATE TABLE public.graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id TEXT UNIQUE NOT NULL,
  label TEXT,
  node_type TEXT,
  page_id UUID REFERENCES public.pages(id),
  status TEXT,
  site TEXT NOT NULL DEFAULT 'corporate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create graph_edges table
CREATE TABLE public.graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_schema_id TEXT NOT NULL,
  target_schema_id TEXT NOT NULL,
  relationship TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_edges ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add updated_at triggers
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pages_updated_at
  BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_graph_nodes_updated_at
  BEFORE UPDATE ON public.graph_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create user profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'viewer',
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function to check if user has a role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = _user_id
      AND role = _role
      AND active = true
  )
$$;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.users
  WHERE id = auth.uid()
    AND active = true
$$;

-- RLS Policies for settings
CREATE POLICY "All authenticated users can view settings"
  ON public.settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can update settings"
  ON public.settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for users
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage all users"
  ON public.users FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for pages
CREATE POLICY "All authenticated users can view pages"
  ON public.pages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Editors and admins can insert pages"
  ON public.pages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'editor')
  );

CREATE POLICY "Editors and admins can update pages"
  ON public.pages FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'editor')
  );

CREATE POLICY "Only admins can delete pages"
  ON public.pages FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for rules
CREATE POLICY "All authenticated users can view rules"
  ON public.rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage rules"
  ON public.rules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for schema_versions
CREATE POLICY "All authenticated users can view schema_versions"
  ON public.schema_versions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Editors and admins can insert schema_versions"
  ON public.schema_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'editor')
  );

CREATE POLICY "Admins can update schema_versions"
  ON public.schema_versions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for audit_log
CREATE POLICY "All authenticated users can view audit_log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can insert audit_log"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for graph_nodes and graph_edges
CREATE POLICY "All authenticated users can view graph_nodes"
  ON public.graph_nodes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage graph_nodes"
  ON public.graph_nodes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "All authenticated users can view graph_edges"
  ON public.graph_edges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage graph_edges"
  ON public.graph_edges FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert default settings row
INSERT INTO public.settings (canonical_base_url, fetch_base_url, sitemap_url)
VALUES (
  'https://www.shepherdneame.co.uk',
  'https://shepherdneame.shepspreview.co.uk',
  'https://www.shepherdneame.co.uk/sitemap.xml'
);