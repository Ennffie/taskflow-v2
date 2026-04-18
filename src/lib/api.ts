import { supabase } from './supabase';
import type { LogEntry, Profile, TaskItem, TaskPriority, TaskStatus } from '../types';

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .order('name');
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function fetchTasks(): Promise<TaskItem[]> {
  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .order('due_date', { ascending: true });

  if (taskError || !tasks || tasks.length === 0) return [];

  // Get all related data in single batch
  const taskIds = tasks.map(t => t.id);
  const [{ data: assignees }, { data: tags }, { data: logs }, { data: profiles }] = await Promise.all([
    supabase.from('task_assignees').select('task_id, user_id').in('task_id', taskIds),
    supabase.from('tags').select('task_id, name').in('task_id', taskIds),
    supabase.from('log_entries').select('id, task_id').in('task_id', taskIds),
    supabase.from('profiles').select('id, name, email, role'),
  ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
  const assigneeMap = new Map<string, Profile[]>();
  const tagMap = new Map<string, string[]>();

  (assignees ?? []).forEach((a: any) => {
    const profile = profileMap.get(a.user_id);
    if (!profile) return;
    const list = assigneeMap.get(a.task_id) ?? [];
    list.push(profile);
    assigneeMap.set(a.task_id, list);
  });

  (tags ?? []).forEach((t: any) => {
    const list = tagMap.get(t.task_id) ?? [];
    list.push(t.name);
    tagMap.set(t.task_id, list);
  });

  const logCounts = new Map<string, number>();
  (logs ?? []).forEach((l: any) => {
    logCounts.set(l.task_id, (logCounts.get(l.task_id) ?? 0) + 1);
  });

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    created_by: t.created_by,
    updated_by: t.updated_by,
    created_at: t.created_at,
    updated_at: t.updated_at,
    assignees: assigneeMap.get(t.id) ?? [],
    tags: tagMap.get(t.id) ?? [],
    log_count: logCounts.get(t.id) ?? 0,
  })) as TaskItem[];
}

export async function fetchTask(taskId: string): Promise<TaskItem | null> {
  const { data: task, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();
  
  if (error || !task) return null;

  const [{ data: assignees }, { data: tags }, { data: logs }] = await Promise.all([
    supabase.from('task_assignees').select('task_id, user_id').eq('task_id', taskId),
    supabase.from('tags').select('task_id, name').eq('task_id', taskId),
    supabase.from('log_entries').select('id, task_id').eq('task_id', taskId),
  ]);

  const { data: profiles } = await supabase.from('profiles').select('id, name, email, role');
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
  
  const taskAssignees = (assignees ?? [])
    .map((a: any) => profileMap.get(a.user_id))
    .filter(Boolean) as Profile[];

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    due_date: task.due_date,
    created_by: task.created_by,
    updated_by: task.updated_by,
    created_at: task.created_at,
    updated_at: task.updated_at,
    assignees: taskAssignees,
    tags: (tags ?? []).map((t: any) => t.name),
    log_count: (logs ?? []).length,
  } as TaskItem;
}

export async function fetchMyLogs(): Promise<LogEntry[]> {
  // Simplified - fetch all logs and filter client-side
  const { data, error } = await supabase
    .from('log_entries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as LogEntry[];
}

export async function createTask(payload: {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  assignee_ids: string[];
  tags: string[];
}) {
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      title: payload.title,
      description: payload.description,
      status: payload.status,
      priority: payload.priority,
      due_date: payload.due_date ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  if (payload.assignee_ids.length > 0) {
    await supabase.from('task_assignees').insert(
      payload.assignee_ids.map((uid) => ({ task_id: task.id, user_id: uid }))
    );
  }

  if (payload.tags.length > 0) {
    await supabase.from('tags').insert(
      payload.tags.map((name) => ({ task_id: task.id, name }))
    );
  }

  return task;
}

export async function updateTask(
  taskId: string,
  payload: Partial<{
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
  }>
) {
  const { error } = await supabase
    .from('tasks')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw error;
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}

export async function createLog(payload: {
  task_id: string;
  date: string;
  event: string;
  category: string;
  time_spent?: string;
  file_name?: string;
  next_status?: string;
}) {
  // Insert log entry
  const { error } = await supabase.from('log_entries').insert({
    task_id: payload.task_id,
    date: payload.date,
    event: payload.event,
    category: payload.category,
    time_spent: payload.time_spent ?? null,
    file_name: payload.file_name ?? null,
    next_status: payload.next_status ?? null,
  });
  if (error) throw error;

  // If next_status is provided, update the task's status
  if (payload.next_status && payload.next_status !== '') {
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ status: payload.next_status, updated_at: new Date().toISOString() })
      .eq('id', payload.task_id);
    if (updateError) throw updateError;
  }
}

export async function fetchLogs(taskId: string): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from('log_entries')
    .select('*')
    .eq('task_id', taskId)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as LogEntry[];
}

export async function deleteLog(logId: string) {
  const { error } = await supabase.from('log_entries').delete().eq('id', logId);
  if (error) throw error;
}
