-- Add schema_quality_charter_prompt column to settings table
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS schema_quality_charter_prompt text;