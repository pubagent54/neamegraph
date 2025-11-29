-- Drop legacy CHECK constraints on pages table
-- These constraints enforced hard-coded page_type and category values.
-- With the new taxonomy system (page_type_definitions, page_category_definitions),
-- valid values are now enforced in-app, not via database constraints.

ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_page_type_v2_check;
ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_category_check;

-- Note: The faq_mode_check constraint is kept as it's still valid
-- (faq_mode can only be 'auto' or 'ignore')