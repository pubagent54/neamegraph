-- Convert rules_backup from single text to JSONB array storing last 3 versions
-- Each backup will have structure: {content: string, timestamp: string}

-- First, migrate existing rules_backup data to new format
-- If rules_backup exists, convert it to array with single item
ALTER TABLE public.rules 
ADD COLUMN rules_backup_history JSONB DEFAULT '[]'::jsonb;

-- Migrate existing backup data to new format
UPDATE public.rules
SET rules_backup_history = jsonb_build_array(
  jsonb_build_object(
    'content', rules_backup,
    'timestamp', now()
  )
)
WHERE rules_backup IS NOT NULL AND rules_backup != '';

-- Drop old column and rename new one
ALTER TABLE public.rules DROP COLUMN rules_backup;
ALTER TABLE public.rules RENAME COLUMN rules_backup_history TO rules_backup;