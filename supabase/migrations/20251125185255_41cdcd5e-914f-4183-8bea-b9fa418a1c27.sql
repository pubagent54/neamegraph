-- Add domain field to pages table (defaults to 'Corporate' to preserve existing behavior)
ALTER TABLE pages ADD COLUMN domain TEXT NOT NULL DEFAULT 'Corporate';
ALTER TABLE pages ADD CONSTRAINT pages_domain_check 
  CHECK (domain IN ('Corporate', 'Beer', 'Pub'));

-- Add beer-specific fields to pages table
-- NOTE: These fields (beer_abv, beer_style, beer_launch_year, beer_official_url)
-- are stored in the pages table as a first step. These may later be moved
-- to a dedicated Beer entity table – don't over-optimise around their
-- current location.
ALTER TABLE pages ADD COLUMN beer_abv DECIMAL(4,2);
ALTER TABLE pages ADD COLUMN beer_style TEXT;
ALTER TABLE pages ADD COLUMN beer_launch_year INTEGER;
ALTER TABLE pages ADD COLUMN beer_official_url TEXT;