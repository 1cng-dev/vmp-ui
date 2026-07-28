-- Enable RLS
ALTER TABLE addon_services ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Team can view all addon services" ON addon_services;
DROP POLICY IF EXISTS "Customers can view their addon services" ON addon_services;
DROP POLICY IF EXISTS "Team can insert addon services" ON addon_services;
DROP POLICY IF EXISTS "Team can update addon services" ON addon_services;

-- Allow all authenticated users to view (since you're using app-level filtering)
CREATE POLICY "Allow authenticated read" ON addon_services FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Allow all authenticated users to insert (since you're using app-level validation)
CREATE POLICY "Allow authenticated insert" ON addon_services FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow all authenticated users to update
CREATE POLICY "Allow authenticated update" ON addon_services FOR UPDATE 
USING (auth.uid() IS NOT NULL);