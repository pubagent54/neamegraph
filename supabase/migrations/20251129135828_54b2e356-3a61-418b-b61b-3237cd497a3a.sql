-- Add domain field to rules table for domain-specific rules
ALTER TABLE public.rules
  ADD COLUMN domain text;

-- Create index for faster domain lookups
CREATE INDEX idx_rules_domain ON public.rules(domain);

-- Add comment explaining the field
COMMENT ON COLUMN public.rules.domain IS 'Domain this rule applies to (Corporate, Beer, Pub). NULL for page_type/category overrides that work across domains.';

-- Update existing default rule to be Corporate domain rule (if any exists)
UPDATE public.rules
SET domain = 'Corporate'
WHERE page_type IS NULL 
  AND category IS NULL 
  AND domain IS NULL;