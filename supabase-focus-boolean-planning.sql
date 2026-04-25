-- Convert focus from status into boolean flag, and add planning status

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS is_focus boolean NOT NULL DEFAULT false;

UPDATE tasks
SET is_focus = true,
    status = 'in_progress'
WHERE status = 'focus';

ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks
ADD CONSTRAINT tasks_status_check
CHECK (status IN ('todo', 'planning', 'in_progress', 'review', 'done', 'cancelled'));
