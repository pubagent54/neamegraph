-- Add rules_backup column to store previous version of rules before updates
ALTER TABLE public.rules ADD COLUMN rules_backup text;