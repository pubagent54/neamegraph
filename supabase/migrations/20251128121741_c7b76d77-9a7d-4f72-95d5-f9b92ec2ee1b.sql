-- Add master organization schema fields to settings table
ALTER TABLE public.settings 
ADD COLUMN organization_schema_json TEXT NULL,
ADD COLUMN organization_schema_backup_json TEXT NULL;

COMMENT ON COLUMN public.settings.organization_schema_json IS 'Current approved master Organization JSON-LD for https://www.shepherdneame.co.uk/#organization';
COMMENT ON COLUMN public.settings.organization_schema_backup_json IS 'Previous version of organization_schema_json for rollback';