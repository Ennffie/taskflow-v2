-- Add enhanced fields to subtasks for inline editing
-- Subtasks now support: status, assignee_ids, progress (independent from parent)

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;

-- Note: subtasks use the same tasks table with parent_id set
-- status already exists on tasks table
-- assignees are stored in task_assignees table (task_id references subtask id)

-- Update existing subtasks to have reasonable defaults
UPDATE tasks 
SET progress = CASE 
  WHEN is_finished = true THEN 100
  ELSE COALESCE(progress_percent, 0)
END
WHERE parent_id IS NOT NULL;

-- Create index for faster subtask queries
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id_status ON tasks(parent_id, status);
