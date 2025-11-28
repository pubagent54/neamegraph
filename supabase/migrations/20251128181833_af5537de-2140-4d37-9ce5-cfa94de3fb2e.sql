-- Fix foreign key constraint to allow cascading deletes
-- When a page is deleted, automatically delete associated wizmode_run_items

-- Drop existing foreign key constraint
ALTER TABLE wizmode_run_items 
DROP CONSTRAINT IF EXISTS wizmode_run_items_page_id_fkey;

-- Add it back with ON DELETE CASCADE
ALTER TABLE wizmode_run_items 
ADD CONSTRAINT wizmode_run_items_page_id_fkey 
FOREIGN KEY (page_id) 
REFERENCES pages(id) 
ON DELETE CASCADE;