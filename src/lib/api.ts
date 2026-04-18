import { supabase } from './supabase';
import type { LogEntry, Profile, TaskItem, TaskPriority, TaskStatus } from '../types';

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchProfiles(): Promise<Profile[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .order('name');
    if (error) throw error;
    return (data ?? []) as Profile[];
  } catch (err) {
    console.error('fetchProfiles error:', err);
    return [];
  }
}

export async function fetchTasks(): Promise<TaskItem[]> {
  try {
    // Sequential requests to avoid lock conflicts
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .order('updated_at', { ascending: false });

    if (taskError) throw taskError;
    if (!tasks || tasks.length === 0) return [];

    // Fetch related data with delay to avoid lock
    await new Promise(r => setTimeout(r, 100));
    
    const { data: assignees, error: assigneeError } = await supabase
      .from('task_assignees')
      .select('task_id, user_id');

    if (assigneeError) {
      console.warn('task_assignees fetch failed:', assigneeError);
    }

    await new Promise(r => setTimeout(r, 100));

    const { data: tags, error: tagError } = await supabase
      .from('tags')
      .select('task_id, name');

    if (tagError) {
      console.warn('tags fetch failed:', tagError);
    }

    await new Promise(r => setTimeout(r, 100));

    const { data: logs, error: logError } = await supabase
      .from('log_entries')
      .select('id, task_id');

    if (logError) {
      console.warn('log_entries fetch failed:', logError);
    }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email, role');

    if (profileError) {
      console.warn('profiles fetch failed:', profileError);
    }

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

    return (tasks as any[]).map((t) => ({
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
  } catch (err: any) {
    console.error('fetchTasks error:', err);
    // Return empty array instead of throwing to prevent UI crash
    return [];
  }
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
  const userId = await currentUserId();
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      title: payload.title,
      description: payload.description,
      status: payload.status,
      priority: payload.priority,
      due_date: payload.due_date ?? null,
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  if (payload.assignee_ids.length > 0) {
    const { error: assigneeError } = await supabase.from('task_assignees').insert(
      payload.assignee_ids.map((uid) => ({ task_id: task.id, user_id: uid }))
    );
    if (assigneeError) throw assigneeError;
  }

  if (payload.tags.length > 0) {
    const { error: tagError } = await supabase.from('tags').insert(
      payload.tags.map((name) => ({ task_id: task.id, name }))
    );
    if (tagError) throw tagError;
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
  const userId = await currentUserId();
  const { error } = await supabase
    .from('tasks')
    .update({ ...payload, updated_at: new Date().toISOString(), updated_by: userId })
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
  const userId = await currentUserId();
  const { error } = await supabase.from('log_entries').insert({
    task_id: payload.task_id,
    date: payload.date,
    event: payload.event,
    category: payload.category,
    time_spent: payload.time_spent ?? null,
    file_name: payload.file_name ?? null,
    next_status: payload.next_status ?? null,
    created_by: userId,
  });
  if (error) throw error;
}

export async function fetchLogs(taskId: string): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from('log_entries')
    .select('id, task_id, date, event, category, time_spent, file_name, next_status, created_at, created_by')
    .eq('task_id', taskId)
    .order('date', { ascending: false });

  if (error) throw error;

  const userIds = [...new Set((data ?? []).map((l: any) => l.created_by).filter(Boolean))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .in('id', userIds);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  return (data ?? []).map((l: any) => ({
    ...l,
    created_by_profile: profileMap.get(l.created_by),
  })) as LogEntry[];
}

export async function fetchTask(taskId: string): Promise<TaskItem | null> {
  try {
    const { data: task, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    
    if (error || !task) return null;

    await new Promise(r => setTimeout(r, 50));
    
    const [{ data: assignees }, { data: tags }, { data: logs }] = await Promise.all([
      supabase.from('task_assignees').select('task_id, user_id').eq('task_id', taskId),
      supabase.from('tags').select('task_id, name').eq('task_id', taskId),
      supabase.from('log_entries').select('id, task_id').eq('task_id', taskId),
    ]);

    await new Promise(r => setTimeout(r, 50));
    
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email, role');

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
    
    const taskAssignees = (assignees ?? [])
      .map((a: any) => profileMap.get(a.user_id))
      .filter(Boolean) as Profile[];
    
    const taskTags = (tags ?? []).map((t: any) => t.name);

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
      tags: taskTags,
      log_count: (logs ?? []).length,
    } as TaskItem;
  } catch (err) {
    console.error('fetchTask error:', err);
    return null;
  }
}

export async function fetchMyLogs(): Promise<LogEntry[]> {
  try {
    const userId = await currentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('log_entries')
      .select('id, task_id, date, event, category, time_spent, file_name, next_status, created_at, created_by')
      .eq('created_by', userId)
      .order('date', { ascending: false });

    if (error) throw error;
    return (data ?? []) as LogEntry[];
  } catch (err: any) {
    console.error('fetchMyLogs error:', err);
    return [];
  }
}
