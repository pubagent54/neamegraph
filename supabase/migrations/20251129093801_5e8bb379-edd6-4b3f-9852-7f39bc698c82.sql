-- Create page type definitions table
CREATE TABLE IF NOT EXISTS public.page_type_definitions (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  domain TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create page category definitions table
CREATE TABLE IF NOT EXISTS public.page_category_definitions (
  id TEXT PRIMARY KEY,
  page_type_id TEXT NOT NULL REFERENCES public.page_type_definitions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.page_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_category_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can view
CREATE POLICY "All authenticated users can view page_type_definitions"
  ON public.page_type_definitions FOR SELECT
  USING (true);

CREATE POLICY "All authenticated users can view page_category_definitions"
  ON public.page_category_definitions FOR SELECT
  USING (true);

-- RLS Policies: Only admins can modify
CREATE POLICY "Admins can manage page_type_definitions"
  ON public.page_type_definitions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage page_category_definitions"
  ON public.page_category_definitions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes
CREATE INDEX idx_page_type_definitions_domain ON public.page_type_definitions(domain);
CREATE INDEX idx_page_type_definitions_active ON public.page_type_definitions(active);
CREATE INDEX idx_page_category_definitions_page_type ON public.page_category_definitions(page_type_id);
CREATE INDEX idx_page_category_definitions_active ON public.page_category_definitions(active);

-- Create updated_at trigger
CREATE TRIGGER update_page_type_definitions_updated_at
  BEFORE UPDATE ON public.page_type_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_page_category_definitions_updated_at
  BEFORE UPDATE ON public.page_category_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with current taxonomy data
-- Corporate domain page types
INSERT INTO public.page_type_definitions (id, label, description, domain, sort_order, active) VALUES
  ('about', 'About', 'Company information, legal, and trade', 'Corporate', 10, true),
  ('history', 'History', 'Company history and heritage', 'Corporate', 20, true),
  ('environment', 'Environment', 'Sustainability and community', 'Corporate', 30, true),
  ('careers', 'Careers', 'Working at Shepherd Neame and pub tenancies', 'Corporate', 40, true),
  ('news', 'News', 'News articles and press releases', 'Corporate', 50, true),
  ('brewery', 'Brewery', 'Brewing process and visitor information', 'Corporate', 60, true);

-- Beer domain page types
INSERT INTO public.page_type_definitions (id, label, description, domain, sort_order, active) VALUES
  ('beers', 'Beers', 'Beer brands and collections', 'Beer', 10, true);

-- Pub domain page types
INSERT INTO public.page_type_definitions (id, label, description, domain, sort_order, active) VALUES
  ('pubs_hotels_estate', 'Pubs & Hotels Estate', 'Pub and hotel estate pages', 'Pub', 10, true);

-- Seed categories for each page type
-- About categories
INSERT INTO public.page_category_definitions (id, page_type_id, label, description, sort_order, active) VALUES
  ('about_general', 'about', 'General', 'General about pages', 10, true),
  ('about_legal', 'about', 'Legal', 'Legal and compliance information', 20, true),
  ('about_direct_to_trade', 'about', 'Direct to Trade', 'Trade and supplier information', 30, true);

-- History categories
INSERT INTO public.page_category_definitions (id, page_type_id, label, description, sort_order, active) VALUES
  ('history_history', 'history', 'History', 'Company history content', 10, true);

-- Environment categories
INSERT INTO public.page_category_definitions (id, page_type_id, label, description, sort_order, active) VALUES
  ('environment_sustainability', 'environment', 'Sustainability', 'Environmental sustainability initiatives', 10, true),
  ('environment_community', 'environment', 'Community', 'Community engagement and support', 20, true);

-- Careers categories
INSERT INTO public.page_category_definitions (id, page_type_id, label, description, sort_order, active) VALUES
  ('careers_working', 'careers', 'Working for Shepherd Neame', 'Employment opportunities', 10, true),
  ('careers_tenancies', 'careers', 'Pub Tenancies', 'Pub tenancy information', 20, true);

-- News categories
INSERT INTO public.page_category_definitions (id, page_type_id, label, description, sort_order, active) VALUES
  ('news_pubs_hotels', 'news', 'Pubs & Hotels', 'Pub and hotel news', 10, true),
  ('news_community', 'news', 'Community', 'Community news', 20, true),
  ('news_beer_drink', 'news', 'Beer and Drink Brands', 'Beer and drink brand news', 30, true);

-- Brewery categories
INSERT INTO public.page_category_definitions (id, page_type_id, label, description, sort_order, active) VALUES
  ('brewery_process', 'brewery', 'Brewing Process', 'How beer is brewed', 10, true),
  ('brewery_visitors', 'brewery', 'Visitors Centre', 'Visitor information', 20, true);

-- Beer categories
INSERT INTO public.page_category_definitions (id, page_type_id, label, description, sort_order, active) VALUES
  ('beers_drink_brands', 'beers', 'Drink Brands', 'Individual beer brand pages', 10, true),
  ('beers_collection', 'beers', 'Collection Page', 'Beer collection overview pages', 20, true);

-- Pub categories
INSERT INTO public.page_category_definitions (id, page_type_id, label, description, sort_order, active) VALUES
  ('pubs_about', 'pubs_hotels_estate', 'About', 'About the pub estate', 10, true),
  ('pubs_collection', 'pubs_hotels_estate', 'Collection Page', 'Pub collection pages', 20, true);