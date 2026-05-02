-- TaskFlow - Delete All Data Script
-- Run this in Supabase SQL Editor to clear all tasks and related data
-- WARNING: This will permanently delete all tasks, logs, assignees, and tags!

-- Step 1: Delete all log entries (child records)
DELETE FROM log_entries;

-- Step 2: Delete all task assignees (junction table)
DELETE FROM task_assignees;

-- Step 3: Delete all tags
DELETE FROM tags;

-- Step 4: Delete all tasks
DELETE FROM tasks;

-- Verify deletion
SELECT 
  'Tasks' as table_name, COUNT(*) as count FROM tasks
UNION ALL
SELECT 'Log Entries', COUNT(*) FROM log_entries
UNION ALL
SELECT 'Task Assignees', COUNT(*) FROM task_assignees
UNION ALL
SELECT 'Tags', COUNT(*) FROM tags;
