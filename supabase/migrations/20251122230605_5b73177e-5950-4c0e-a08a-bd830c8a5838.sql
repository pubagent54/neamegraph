-- Add schema_engine_version column to settings table
ALTER TABLE settings 
ADD COLUMN schema_engine_version text NOT NULL DEFAULT 'v1';

-- Add constraint to ensure only v1 or v2 values
ALTER TABLE settings
ADD CONSTRAINT settings_schema_engine_version_check 
CHECK (schema_engine_version IN ('v1', 'v2'));