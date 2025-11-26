-- Make category nullable in rules table
-- This allows rules to be matched by page_type only
-- Category will still be passed as metadata to the LLM but won't affect rule selection

ALTER TABLE rules 
ALTER COLUMN category DROP NOT NULL;

-- Add comment to clarify the purpose
COMMENT ON COLUMN rules.category IS 'Optional. Not used for rule selection. Passed as metadata to schema engine for conditional logic within prompts.';