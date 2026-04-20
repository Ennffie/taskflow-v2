export type Role = 'admin' | 'member' | 'viewer';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled' | 'focus';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type LogCategory = 'design' | 'research' | 'meeting' | 'review' | 'other';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  assignees: Profile[];
  tags: string[];
  log_count: number;
}

export interface LogEntry {
  id: string;
  task_id: string;
  date: string;
  event: string;
  category: LogCategory;
  time_spent: string | null;
  file_name: string | null;
  created_by: string;
  created_at: string;
  created_by_profile?: Profile;
}

export const STATUS_META: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  todo: { label: 'Todo', color: '#6b7280', bg: '#f3f4f6' },
  in_progress: { label: 'In Progress', color: '#6d28d9', bg: '#f3e8ff' },
  review: { label: 'Review', color: '#1d4ed8', bg: '#dbeafe' },
  done: { label: 'Done', color: '#047857', bg: '#d1fae5' },
  cancelled: { label: 'Cancelled', color: '#b91c1c', bg: '#fee2e2' },
  focus: { label: 'Focus', color: '#7c3aed', bg: '#ede9fe' },
};

export const PRIORITY_META: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: '#6b7280', bg: '#f3f4f6' },
  medium: { label: 'Medium', color: '#92400e', bg: '#fef3c7' },
  high: { label: 'High', color: '#b45309', bg: '#fed7aa' },
  urgent: { label: 'Urgent', color: '#b91c1c', bg: '#fee2e2' },
};

// Aliases for compatibility
export const STATUS_CONFIG = STATUS_META;
export const PRIORITY_CONFIG = PRIORITY_META;
