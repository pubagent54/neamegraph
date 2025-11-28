-- Add validation fields to wizmode_run_items table
ALTER TABLE wizmode_run_items 
ADD COLUMN validation_status text DEFAULT 'pending',
ADD COLUMN validation_error_count integer DEFAULT 0,
ADD COLUMN validation_warning_count integer DEFAULT 0,
ADD COLUMN validation_issues jsonb DEFAULT '[]'::jsonb;