-- Fix: Add next_status column to log_entries table
-- Run this in Supabase SQL Editor

-- 1. Check if column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'log_entries' 
AND column_name = 'next_status';

-- 2. Add column if not exists
ALTER TABLE log_entries 
ADD COLUMN IF NOT EXISTS next_status VARCHAR(50);

-- 3. Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'log_entries';
