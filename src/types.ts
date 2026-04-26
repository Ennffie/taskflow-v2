export type Role = 'admin' | 'member' | 'viewer';
export type TaskStatus = 'todo' | 'planning' | 'in_progress' | 'internal_review' | 'round_1_wip' | 'round_1_review' | 'round_2_wip' | 'round_2_review' | 'round_3_wip' | 'round_3_review' | 'pending_mpfa_pc_nfc' | 'review' | 'done' | 'cancelled';
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
  parent_id?: string | null;
  is_focus?: boolean;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  progress_percent?: number;
  round_number?: number;
  is_finished?: boolean;
  assignees: Profile[];
  tags: string[];
  log_count: number;
  subtask_count?: number;
  subtasks?: TaskItem[];
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
  planning: { label: 'Planning', color: '#0f766e', bg: '#ccfbf1' },
  in_progress: { label: 'In Progress', color: '#6d28d9', bg: '#f3e8ff' },
  internal_review: { label: 'Internal Review', color: '#7c3aed', bg: '#f3e8ff' },
  round_1_wip: { label: 'Round 1 WIP', color: '#9333ea', bg: '#f3e8ff' },
  round_1_review: { label: 'Round 1 Review', color: '#2563eb', bg: '#dbeafe' },
  round_2_wip: { label: 'Round 2 WIP', color: '#7c3aed', bg: '#ede9fe' },
  round_2_review: { label: 'Round 2 Review', color: '#1d4ed8', bg: '#dbeafe' },
  round_3_wip: { label: 'Round 3 WIP', color: '#6d28d9', bg: '#f5f3ff' },
  round_3_review: { label: 'Round 3 Review', color: '#1e40af', bg: '#dbeafe' },
  pending_mpfa_pc_nfc: { label: 'Pending MPFA/PC for NFC', color: '#92400e', bg: '#fef3c7' },
  review: { label: 'Review', color: '#1d4ed8', bg: '#dbeafe' },
  done: { label: 'Done', color: '#047857', bg: '#d1fae5' },
  cancelled: { label: 'Cancelled', color: '#b91c1c', bg: '#fee2e2' },
};

export const TASK_STATUS_OPTIONS: TaskStatus[] = [
  'todo',
  'planning',
  'in_progress',
  'internal_review',
  'round_1_wip',
  'round_1_review',
  'round_2_wip',
  'round_2_review',
  'round_3_wip',
  'round_3_review',
  'pending_mpfa_pc_nfc',
  'review',
  'done',
  'cancelled',
];

export const FOCUS_META = { label: 'Focus', color: '#7c3aed', bg: '#ede9fe' };

export const PRIORITY_META: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: '#6b7280', bg: '#f3f4f6' },
  medium: { label: 'Medium', color: '#92400e', bg: '#fef3c7' },
  high: { label: 'High', color: '#b45309', bg: '#fed7aa' },
  urgent: { label: 'Urgent', color: '#b91c1c', bg: '#fee2e2' },
};

// Aliases for compatibility
export const STATUS_CONFIG = STATUS_META;
export const PRIORITY_CONFIG = PRIORITY_META;
