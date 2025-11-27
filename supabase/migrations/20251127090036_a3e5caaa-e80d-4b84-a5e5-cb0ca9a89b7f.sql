-- Add unique constraint for active rules based on page_type and category
-- This ensures only one active rule can exist for each (page_type, category) combination

CREATE UNIQUE INDEX rules_active_page_type_category_unique 
ON rules (page_type, category) 
WHERE is_active = true;

-- Add comment explaining the constraint
COMMENT ON INDEX rules_active_page_type_category_unique IS 
'Ensures only one active rule exists for each (page_type, category) combination. NULL values are treated as distinct, allowing multiple NULL combinations.';