-- Fix: Add 'focus' to tasks_status_check constraint
-- Run this in Supabase SQL Editor

-- 1. First, check current constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'tasks'::regclass 
AND conname = 'tasks_status_check';

-- 2. Drop existing constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- 3. Add new constraint with 'focus' included
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'cancelled', 'focus'));

-- 4. Verify
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'tasks'::regclass 
AND conname = 'tasks_status_check';
