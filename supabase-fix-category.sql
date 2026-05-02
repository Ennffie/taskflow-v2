-- Fix log_entries category constraint to include 'development'
-- Run this in Supabase SQL Editor

-- First, drop the existing constraint
ALTER TABLE log_entries DROP CONSTRAINT IF EXISTS log_entries_category_check;

-- Then add the new constraint with 'development' included
ALTER TABLE log_entries ADD CONSTRAINT log_entries_category_check 
  CHECK (category IN ('design', 'research', 'meeting', 'review', 'development', 'other'));
