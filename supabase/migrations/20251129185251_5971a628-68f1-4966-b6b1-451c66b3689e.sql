-- Fix function search path security warning
ALTER FUNCTION public.update_wizmode_runs_updated_at() SET search_path = public;