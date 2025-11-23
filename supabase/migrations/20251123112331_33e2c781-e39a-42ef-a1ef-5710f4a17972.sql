-- Add 'General' to the allowed category values
ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_category_check;

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
      'General',
      'Working for Shepherd Neame',
      'Pub Tenancies',
      'Pubs & Hotels',
      'Beer and Drink Brands'
    )
  );