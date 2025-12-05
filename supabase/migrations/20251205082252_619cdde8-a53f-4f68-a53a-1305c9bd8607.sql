-- Fix: Restrict settings table access to admin users only
-- This prevents non-admin users from seeing preview_auth_password

DROP POLICY IF EXISTS "All authenticated users can view settings" ON public.settings;

CREATE POLICY "Admins can view settings" ON public.settings
  FOR SELECT USING (has_role(auth.uid(), 'admin'));