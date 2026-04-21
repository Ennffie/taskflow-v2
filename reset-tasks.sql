-- Reset all tasks data but KEEP members/profiles
DELETE FROM log_entries;
DELETE FROM task_assignees;
DELETE FROM tags;
DELETE FROM tasks;
