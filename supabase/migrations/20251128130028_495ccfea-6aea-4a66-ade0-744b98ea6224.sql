-- Add unique constraint on pages.path
-- This ensures no duplicate paths can be created
ALTER TABLE public.pages ADD CONSTRAINT pages_path_unique UNIQUE (path);