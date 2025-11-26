-- Make page_type nullable in rules table to support default rules
ALTER TABLE public.rules 
ALTER COLUMN page_type DROP NOT NULL;