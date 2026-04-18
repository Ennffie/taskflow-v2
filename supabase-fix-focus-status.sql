-- Fix: Add 'focus' to tasks_status_check constraint
-- Run this in Supabase SQL Editor

-- 1. Drop existing constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- 2. Add new constraint with 'focus' included
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'cancelled', 'focus'));

-- 3. Also update the type if needed
-- Note: This assumes you have a custom type, skip if not needed
-- ALTER TYPE task_status ADD VALUE 'focus';
