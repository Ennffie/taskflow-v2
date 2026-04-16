import { supabase } from './supabase';
import type { LogEntry, Profile, TaskItem, TaskPriority, TaskStatus } from '../types';

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('id, name, email, role').order('name');
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function fetchTasks(): Promise<TaskItem[]> {
  const [{ data: tasks, error: taskError }, { data: assignees, error: assigneeError }, { data: tags, error: tagError }, { data: logs, error: logError }, { data: profiles, error: profileError }] = await Promise.all([
    supabase.from('tasks').select('*').order('updated_at', { ascending: false }),
    supabase.from('task_assignees').select('task_id, user_id'),
    supabase.from('tags').select('task_id, name'),
    supabase.from('log_entries').select('id, task_id'),
    supabase.from('profiles').select('id, name, email, role'),
  ]);

  if (taskError || assigneeError || tagError || logError || profileError) {
    throw taskError || assigneeError || tagError || logError || profileError;
  }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
  const assigneeMap = new Map<string, Profile[]>();
  const tagMap = new Map<string, string[]>();
  const logCountMap = new Map<string, number>();

  (assignees ?? []).forEach((row: any) => {
    const profile = profileMap.get(row.user_id);
    if (!profile) return;
    assigneeMap.set(row.task_id, [...(assigneeMap.get(row.task_id) ?? []), profile]);
  });

  (tags ?? []).forEach((row: any) => {
    tagMap.set(row.task_id, [...(tagMap.get(row.task_id) ?? []), row.name]);
  });

  (logs ?? []).forEach((row: any) => {
    logCountMap.set(row.task_id, (logCountMap.get(row.task_id) ?? 0) + 1);
  });

  return (tasks ?? []).map((task: any) => ({
    ...task,
    assignees: assigneeMap.get(task.id) ?? [],
    tags: tagMap.get(task.id) ?? [],
    log_count: logCountMap.get(task.id) ?? 0,
  }));
}

export async function fetchTask(taskId: string): Promise<TaskItem | null> {
  const tasks = await fetchTasks();
  return tasks.find((task) => task.id === taskId) ?? null;
}

export async function fetchLogs(taskId?: string): Promise<LogEntry[]> {
  let query = supabase.from('log_entries').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
  if (taskId) query = query.eq('task_id', taskId);
  const [{ data: logs, error: logError }, { data: profiles, error: profileError }] = await Promise.all([
    query,
    supabase.from('profiles').select('id, name, email, role'),
  ]);
  if (logError || profileError) throw logError || profileError;
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
  return (logs ?? []).map((log: any) => ({ ...log, created_by_profile: profileMap.get(log.created_by) }));
}

export async function createTask(input: {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  assignee_ids: string[];
  tags: string[];
}) {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not signed in');

  const { data: task, error } = await supabase.from('tasks').insert({
    title: input.title,
    description: input.description || null,
    status: input.status,
    priority: input.priority,
    due_date: input.due_date || null,
    created_by: userId,
    updated_by: userId,
  }).select().single();
  if (error) throw error;

  const taskId = task.id;
  const uniqueAssignees = Array.from(new Set(input.assignee_ids.filter(Boolean)));
  const uniqueTags = Array.from(new Set(input.tags.map((tag) => tag.trim()).filter(Boolean)));

  if (uniqueAssignees.length) {
    const { error: assigneeError } = await supabase.from('task_assignees').insert(uniqueAssignees.map((user_id) => ({ task_id: taskId, user_id })));
    if (assigneeError) throw assigneeError;
  }

  if (uniqueTags.length) {
    const { error: tagError } = await supabase.from('tags').insert(uniqueTags.map((name) => ({ task_id: taskId, name })));
    if (tagError) throw tagError;
  }

  return taskId as string;
}

export async function updateTask(taskId: string, updates: Partial<Pick<TaskItem, 'title' | 'description' | 'status' | 'priority' | 'due_date'>>) {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not signed in');
  const { error } = await supabase.from('tasks').update({ ...updates, updated_by: userId }).eq('id', taskId);
  if (error) throw error;
}

export async function replaceTaskAssignees(taskId: string, assigneeIds: string[]) {
  const { error: deleteError } = await supabase.from('task_assignees').delete().eq('task_id', taskId);
  if (deleteError) throw deleteError;
  const uniqueAssignees = Array.from(new Set(assigneeIds.filter(Boolean)));
  if (!uniqueAssignees.length) return;
  const { error } = await supabase.from('task_assignees').insert(uniqueAssignees.map((user_id) => ({ task_id: taskId, user_id })));
  if (error) throw error;
}

export async function replaceTaskTags(taskId: string, tags: string[]) {
  const { error: deleteError } = await supabase.from('tags').delete().eq('task_id', taskId);
  if (deleteError) throw deleteError;
  const uniqueTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
  if (!uniqueTags.length) return;
  const { error } = await supabase.from('tags').insert(uniqueTags.map((name) => ({ task_id: taskId, name })));
  if (error) throw error;
}

export async function createLog(input: {
  task_id: string;
  date: string;
  event: string;
  category: LogEntry['category'];
  time_spent?: string;
  file_name?: string;
  next_status?: TaskStatus | '';
}) {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not signed in');

  const { error } = await supabase.from('log_entries').insert({
    task_id: input.task_id,
    date: input.date,
    event: input.event,
    category: input.category,
    time_spent: input.time_spent || null,
    file_name: input.file_name || null,
    created_by: userId,
  });
  if (error) throw error;

  if (input.next_status) {
    await updateTask(input.task_id, { status: input.next_status });
  }
}

export async function fetchMyLogs() {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not signed in');
  const logs = await fetchLogs();
  return logs.filter((log) => log.created_by === userId);
}
