-- Drop existing check constraints first
ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_page_type_v2_check;
ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_category_check;

-- Update existing data to map old values to new values
-- Map page types
UPDATE public.pages 
SET page_type = CASE 
  WHEN page_type = 'beer_brand' THEN 'Beers'
  WHEN page_type = 'beer_collection' THEN 'Beers'
  WHEN page_type = 'CommunityPage' THEN 'Environment'
  WHEN page_type = 'GovernancePage' THEN 'About'
  WHEN page_type = 'org_root' THEN 'About'
  WHEN page_type = 'pubs_overview' THEN 'Pubs & Hotels Estate'
  ELSE page_type
END
WHERE page_type IN ('beer_brand', 'beer_collection', 'CommunityPage', 'GovernancePage', 'org_root', 'pubs_overview');

-- Map categories
UPDATE public.pages 
SET category = CASE 
  WHEN category = 'CharityAndDonations' THEN 'Community'
  WHEN category = 'Legal' THEN 'Legal'
  WHEN category = 'Overview' AND page_type = 'Pubs & Hotels Estate' THEN 'About'
  WHEN category = 'Overview' AND page_type = 'Beers' THEN 'Drink Brands'
  WHEN category = 'Overview' THEN 'About'
  ELSE category
END
WHERE category IN ('CharityAndDonations', 'Legal', 'Overview');

-- Set default categories for pages that now have page_type but no category
UPDATE public.pages
SET category = CASE
  WHEN page_type = 'Beers' AND category IS NULL THEN 'Drink Brands'
  WHEN page_type = 'Pubs & Hotels Estate' AND category IS NULL THEN 'About'
  WHEN page_type = 'Brewery' AND category IS NULL THEN 'Brewing Process'
  WHEN page_type = 'History' AND category IS NULL THEN 'History'
  WHEN page_type = 'Environment' AND category IS NULL THEN 'Sustainability'
  WHEN page_type = 'About' AND category IS NULL THEN 'Legal'
  WHEN page_type = 'Careers' AND category IS NULL THEN 'Working for Shepherd Neame'
  WHEN page_type = 'News' AND category IS NULL THEN 'Pubs & Hotels'
  ELSE category
END
WHERE page_type IN ('Beers', 'Pubs & Hotels Estate', 'Brewery', 'History', 'Environment', 'About', 'Careers', 'News')
AND category IS NULL;

-- Add new check constraints with the updated Corporate v2 Page Types and Categories
ALTER TABLE public.pages ADD CONSTRAINT pages_page_type_v2_check 
  CHECK (
    page_type IS NULL OR 
    page_type IN (
      'Pubs & Hotels Estate',
      'Beers',
      'Brewery',
      'History',
      'Environment',
      'About',
      'Careers',
      'News'
    )
  );

ALTER TABLE public.pages ADD CONSTRAINT pages_category_check 
  CHECK (
    category IS NULL OR 
    category IN (
      'About',
      'Collection Page',
      'Drink Brands',
      'Brewing Process',
      'Visitors Centre',
      'History',
      'Sustainability',
      'Community',
      'Legal',
      'Direct to Trade',
      'Working for Shepherd Neame',
      'Pub Tenancies',
      'Pubs & Hotels',
      'Beer and Drink Brands'
    )
  );