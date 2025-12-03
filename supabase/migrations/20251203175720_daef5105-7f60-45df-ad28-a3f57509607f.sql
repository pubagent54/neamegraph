-- Create documents table for SOP and documentation
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by_user_id UUID REFERENCES public.users(id),
  updated_by_user_id UUID REFERENCES public.users(id)
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view documents
CREATE POLICY "Authenticated users can view documents"
ON public.documents
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only admins and editors can create documents
CREATE POLICY "Admins and editors can create documents"
ON public.documents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'editor')
  )
);

-- Only admins and editors can update documents
CREATE POLICY "Admins and editors can update documents"
ON public.documents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'editor')
  )
);

-- Only admins can delete documents
CREATE POLICY "Only admins can delete documents"
ON public.documents
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert a default welcome document
INSERT INTO public.documents (title, body) VALUES (
  'Welcome to NeameGraph SOP',
  '## Getting Started with NeameGraph v2

### 1. Add or update pages
Use WIZmode or the Pages view to import your corporate URLs (via CSV) and assign page types and categories.

### 2. Configure rules & generate schema
Set up or refine the Corporate v2 (and Beer) rules, then generate JSON-LD for your pages from the Rules / WIZmode flow.

### 3. Validate & implement
Test the generated schema on staging, fix any issues, then mark pages as Tested or Implemented once they''re live.'
);