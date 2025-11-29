-- Add updated_at column to wizmode_runs table
ALTER TABLE public.wizmode_runs 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing rows to have updated_at same as created_at
UPDATE public.wizmode_runs 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Create trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_wizmode_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at on wizmode_runs updates
CREATE TRIGGER trigger_update_wizmode_runs_updated_at
  BEFORE UPDATE ON public.wizmode_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_wizmode_runs_updated_at();