-- Fix RLS policies for rules table to allow admin users to insert rules

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin users can insert rules" ON rules;
DROP POLICY IF EXISTS "Admin users can update rules" ON rules;
DROP POLICY IF EXISTS "Admin users can delete rules" ON rules;
DROP POLICY IF EXISTS "All authenticated users can view rules" ON rules;

-- Enable RLS on rules table
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to SELECT rules
CREATE POLICY "All authenticated users can view rules"
ON rules
FOR SELECT
TO authenticated
USING (true);

-- Allow admin users to INSERT rules
CREATE POLICY "Admin users can insert rules"
ON rules
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
    AND users.active = true
  )
);

-- Allow admin users to UPDATE rules
CREATE POLICY "Admin users can update rules"
ON rules
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
    AND users.active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
    AND users.active = true
  )
);

-- Allow admin users to DELETE rules
CREATE POLICY "Admin users can delete rules"
ON rules
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
    AND users.active = true
  )
);