-- Add new columns for Corporate v2 page metadata (excluding page_type which already exists)
ALTER TABLE pages 
ADD COLUMN category text,
ADD COLUMN logo_url text,
ADD COLUMN hero_image_url text,
ADD COLUMN faq_mode text NOT NULL DEFAULT 'auto',
ADD COLUMN is_home_page boolean NOT NULL DEFAULT false;

-- Add check constraints for valid values
ALTER TABLE pages
ADD CONSTRAINT pages_page_type_v2_check 
CHECK (page_type IS NULL OR page_type IN ('EstatePage', 'GovernancePage', 'CommunityPage', 'SiteHomePage', 'org_root', 'beer_brand', 'beer_collection', 'pubs_overview', 'pubs_collection', 'history_page', 'sustainability_page', 'investors_page', 'careers_page', 'about_page', 'contact_page', 'news_article', 'press_release', 'blog_post', 'faq_page', 'collection', 'other'));

ALTER TABLE pages
ADD CONSTRAINT pages_category_check 
CHECK (category IS NULL OR category IN ('Overview', 'Collections', 'EthosAndSuppliers', 'About', 'Legal', 'TradeAndSupply', 'ShepsGiving', 'CharityAndDonations', 'ArtsAndCulture', 'CommunityOverview'));

ALTER TABLE pages
ADD CONSTRAINT pages_faq_mode_check 
CHECK (faq_mode IN ('auto', 'ignore'));