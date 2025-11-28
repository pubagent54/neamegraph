-- Add Wikidata fields to pages table for Beer pages
ALTER TABLE public.pages
ADD COLUMN wikidata_candidate boolean NOT NULL DEFAULT false,
ADD COLUMN wikidata_status text NOT NULL DEFAULT 'none',
ADD COLUMN wikidata_qid text,
ADD COLUMN wikidata_label text,
ADD COLUMN wikidata_description text,
ADD COLUMN wikidata_language text DEFAULT 'en',
ADD COLUMN wikidata_intro_year integer,
ADD COLUMN wikidata_abv numeric,
ADD COLUMN wikidata_style text,
ADD COLUMN wikidata_official_website text,
ADD COLUMN wikidata_image_url text,
ADD COLUMN wikidata_verified_at timestamp with time zone,
ADD COLUMN wikidata_verified_by uuid REFERENCES public.users(id),
ADD COLUMN wikidata_last_exported_at timestamp with time zone,
ADD COLUMN wikidata_notes text;

-- Add constraint for wikidata_status enum
ALTER TABLE public.pages
ADD CONSTRAINT pages_wikidata_status_check 
CHECK (wikidata_status IN ('none', 'draft', 'checked', 'ready_for_wikidata', 'exported', 'live'));

-- Create index on wikidata fields for export queries
CREATE INDEX idx_pages_wikidata_export 
ON public.pages(domain, wikidata_candidate, wikidata_status, wikidata_qid)
WHERE domain = 'Beer' AND wikidata_candidate = true;