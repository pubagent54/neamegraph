-- Add preview_auth_enabled field to settings table
ALTER TABLE public.settings 
ADD COLUMN preview_auth_enabled boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN public.settings.preview_auth_enabled IS 'Toggle for enabling/disabling preview authentication. When false, fetch_base_url is used without credentials.';