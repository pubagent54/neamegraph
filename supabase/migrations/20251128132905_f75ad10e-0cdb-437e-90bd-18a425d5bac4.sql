-- Lowercase all existing paths for case-insensitive handling
-- First check if this would create duplicates
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  -- Check for paths that would collide after lowercasing
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT lower(path) as normalized_path, COUNT(*) as cnt
    FROM public.pages
    GROUP BY lower(path)
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE NOTICE 'Found % paths that would collide after lowercasing. Manual review needed.', duplicate_count;
  ELSE
    -- Safe to lowercase all paths
    UPDATE public.pages
    SET path = lower(path)
    WHERE path != lower(path);
    
    RAISE NOTICE 'Lowercased all paths successfully';
  END IF;
END $$;