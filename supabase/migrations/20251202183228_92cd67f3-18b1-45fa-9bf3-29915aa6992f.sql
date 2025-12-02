-- Add invited_by column to track who invited each user
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES public.users(id);