-- Add page_type and category columns to rules table for Corporate v2 metadata matching
ALTER TABLE public.rules 
ADD COLUMN page_type TEXT,
ADD COLUMN category TEXT;

-- Add index for faster lookups
CREATE INDEX idx_rules_page_type_category ON public.rules(page_type, category);

-- Add comment
COMMENT ON COLUMN public.rules.page_type IS 'Corporate v2 Page Type (EstatePage, GovernancePage, CommunityPage, SiteHomePage)';
COMMENT ON COLUMN public.rules.category IS 'Corporate v2 Category (e.g., Overview, Collections, About, Legal, etc.)';