-- Normalize all existing paths in the pages table
-- This ensures consistency with the UI normalizePath() function

-- Create a temporary function to normalize paths
CREATE OR REPLACE FUNCTION normalize_path(p text) RETURNS text AS $$
BEGIN
  -- Trim whitespace
  p := trim(p);
  
  -- Ensure leading /
  IF NOT p LIKE '/%' THEN
    p := '/' || p;
  END IF;
  
  -- Strip trailing / except for root
  IF p != '/' AND p LIKE '%/' THEN
    p := rtrim(p, '/');
  END IF;
  
  RETURN p;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update all paths to normalized versions
UPDATE public.pages
SET path = normalize_path(path)
WHERE path != normalize_path(path);

-- Check for duplicates after normalization
DO $$
DECLARE
  duplicate_count integer;
  duplicate_paths text;
BEGIN
  -- Count duplicates
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT path, COUNT(*) as cnt
    FROM public.pages
    GROUP BY path
    HAVING COUNT(*) > 1
  ) duplicates;
  
  -- If duplicates exist, raise an error with details
  IF duplicate_count > 0 THEN
    SELECT string_agg(path || ' (' || cnt || ' copies)', ', ')
    INTO duplicate_paths
    FROM (
      SELECT path, COUNT(*) as cnt
      FROM public.pages
      GROUP BY path
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC, path
    ) duplicates;
    
    RAISE EXCEPTION 'Path normalization created % duplicate path(s): %. Please manually resolve these duplicates before proceeding.', 
      duplicate_count, duplicate_paths;
  END IF;
END $$;

-- Clean up the temporary function
DROP FUNCTION normalize_path(text);

-- Add a comment documenting the normalization
COMMENT ON CONSTRAINT pages_path_unique ON public.pages IS 
  'Ensures unique paths. Paths are normalized: trimmed, leading /, no trailing / (except root).';