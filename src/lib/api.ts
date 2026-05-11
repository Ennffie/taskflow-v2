import { supabase } from './supabase';
import { getReportDate } from './date';
import type { LogEntry, Profile, Role, TaskItem, TaskPriority, TaskStatus } from '../types';

// Fetch bridge URL from Supabase app_config
export async function fetchBridgeUrl(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'bridge_url')
      .single();
    if (error) {
      console.error('[fetchBridgeUrl] error:', error);
      return null;
    }
    return data?.value || null;
  } catch (e) {
    console.error('[fetchBridgeUrl] exception:', e);
    return null;
  }
}

// Retry wrapper for Supabase calls to handle lock contention
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      // Check if it's a lock error
      if (err?.message?.includes('lock') || err?.message?.includes('another request stole')) {
        await new Promise(r => setTimeout(r, 200 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

type TaskRecord = {
  id: string;
  parent_id?: string | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  is_focus?: boolean | null;
  progress_percent?: number | null;
  round_number?: number | null;
  is_finished?: boolean | null;
  today_update?: string | null;
  next_day_focus?: string | null;
};

function formatTaskFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function buildTaskUpdateEvents(before: TaskRecord, after: Partial<TaskRecord>): string[] {
  const targetLabel = before.parent_id ? `Subtask ${after.title ?? before.title}` : `Main Task ${after.title ?? before.title}`;
  const events: string[] = [];

  const pushChange = (label: string, beforeValue: unknown, afterValue: unknown) => {
    if (beforeValue === afterValue) return;
    events.push(`${targetLabel} ${label}: ${formatTaskFieldValue(beforeValue)} → ${formatTaskFieldValue(afterValue)}`);
  };

  if (after.title !== undefined && after.title !== before.title) {
    events.push(`${before.parent_id ? 'Subtask' : 'Main Task'} renamed: ${before.title} → ${after.title}`);
  }
  if (after.status !== undefined) pushChange('status', before.status, after.status);
  if (after.priority !== undefined) pushChange('priority', before.priority, after.priority);
  if (after.due_date !== undefined) pushChange('due date', before.due_date ?? null, after.due_date ?? null);
  if (after.is_focus !== undefined) pushChange('focus', before.is_focus ?? false, after.is_focus);
  if (after.progress_percent !== undefined) pushChange('progress', before.progress_percent ?? 0, after.progress_percent);
  if (after.round_number !== undefined) pushChange('round', before.round_number ?? 1, after.round_number);
  if (after.is_finished !== undefined) pushChange('finished', before.is_finished ?? false, after.is_finished);
  if (after.today_update !== undefined && after.today_update !== before.today_update) {
    events.push(`${targetLabel} Today Update edited`);
  }
  if (after.next_day_focus !== undefined && after.next_day_focus !== before.next_day_focus) {
    events.push(`${targetLabel} Next Day Focus edited`);
  }

  return events;
}

async function createAutoEventLog(params: {
  actorId: string | null | undefined;
  taskId: string;
  date?: string;
  event: string;
}) {
  if (!params.actorId || !params.event.trim()) return;
  const { error } = await supabase.from('log_entries').insert({
    task_id: params.taskId,
    date: params.date ?? getReportDate(),
    event: params.event,
    category: 'other',
    created_by: params.actorId,
  });
  if (error) throw error;
}

export async function createTaskEventLog(taskId: string, event: string, date?: string) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  await createAutoEventLog({
    actorId: userId,
    taskId,
    date,
    event,
  });
}

export async function updateTaskAssignees(taskId: string, assigneeIds: string[]) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const [{ data: task, error: taskError }, { data: currentAssignees, error: assigneeError }, { data: profiles, error: profilesError }] = await Promise.all([
    supabase.from('tasks').select('id, parent_id, title').eq('id', taskId).single(),
    supabase.from('task_assignees').select('user_id').eq('task_id', taskId),
    supabase.from('profiles').select('id, name'),
  ]);

  if (taskError || !task) throw taskError ?? new Error('Task not found');
  if (assigneeError) throw assigneeError;
  if (profilesError) throw profilesError;

  const previousIds = (currentAssignees ?? []).map((item: any) => item.user_id).sort();
  const nextIds = [...assigneeIds].sort();
  if (JSON.stringify(previousIds) === JSON.stringify(nextIds)) return;

  await supabase.from('task_assignees').delete().eq('task_id', taskId);
  if (assigneeIds.length > 0) {
    const { error: insertError } = await supabase.from('task_assignees').insert(
      assigneeIds.map((uid) => ({ task_id: taskId, user_id: uid })),
    );
    if (insertError) throw insertError;
  }

  const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile.name]));
  const previousNames = previousIds.map((id) => profileMap.get(id)).filter(Boolean).join(', ') || '—';
  const nextNames = nextIds.map((id) => profileMap.get(id)).filter(Boolean).join(', ') || '—';

  await createAutoEventLog({
    actorId: userId,
    taskId: task.parent_id ?? task.id,
    event: `${task.parent_id ? `Subtask ${task.title}` : `Main Task ${task.title}`} assignees: ${previousNames} → ${nextNames}`,
  });
}

async function attachProfilesToLogs(logs: LogEntry[]): Promise<LogEntry[]> {
  if (!logs.length) return logs;

  const userIds = [...new Set(logs.map(log => log.created_by).filter(Boolean))];
  if (!userIds.length) return logs;

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .in('id', userIds);

  if (error) throw error;

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile as Profile]));

  return logs.map((log) => ({
    ...log,
    created_by_profile: profileMap.get(log.created_by),
  }));
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .order('name');
  if (error) throw error;
  return (data ?? []) as Profile[];
}

function getEffectiveRound(task: { round_number?: number | null; status?: TaskStatus | null }): number {
  const explicitRound = task.round_number && task.round_number >= 1 ? task.round_number : 1;
  const status = task.status ?? 'todo';
  const statusRound = status.startsWith('round_3_') ? 3 : status.startsWith('round_2_') ? 2 : 1;
  return Math.max(explicitRound, statusRound);
}

function computeParentProgress(task: any, allTasks: any[]): { progress_percent: number; round_number: number; is_finished: boolean } {
  const subtasks = allTasks.filter(st => st.parent_id === task.id);
  if (subtasks.length === 0) {
    return {
      progress_percent: task.is_finished ? 100 : (task.progress_percent ?? 0),
      round_number: getEffectiveRound(task),
      is_finished: task.is_finished ?? false,
    };
  }

  const grouped = new Map<number, any[]>();
  subtasks.forEach((st) => {
    const round = getEffectiveRound(st);
    grouped.set(round, [...(grouped.get(round) ?? []), st]);
  });

  const rounds = [...grouped.keys()].sort((a, b) => a - b);
  const round1 = grouped.get(1) ?? [];
  const round2 = grouped.get(2) ?? [];
  const round3 = grouped.get(3) ?? [];
  const getItemProgress = (item: any) => item.is_finished ? 100 : (item.progress_percent ?? 0);
  const avg = (items: any[]) => items.length ? items.reduce((sum, item) => sum + getItemProgress(item), 0) / items.length : 0;
  let progress = 0;
  let currentRound = rounds[0] ?? 1;

  if (round1.length > 0) {
    const round1Avg = avg(round1);
    progress = Math.max(progress, Math.round((round1Avg / 100) * 70));
    currentRound = round1Avg >= 100 && round2.length > 0 ? 2 : 1;
  }

  if (round2.length > 0) {
    const round2Avg = avg(round2);
    progress = Math.max(progress, 70 + Math.round((round2Avg / 100) * 10));
    if (round2Avg > 0) currentRound = round2Avg >= 100 && round3.length > 0 ? 3 : 2;
  }

  if (round3.length > 0) {
    const round3Avg = avg(round3);
    progress = Math.max(progress, 80 + Math.round((round3Avg / 100) * 10));
    if (round3Avg > 0) currentRound = 3;
  }

  const calculatedProgress = Math.min(100, progress);
  const isFinished = (task.is_finished ?? false) && calculatedProgress >= 90;

  if (isFinished) {
    progress = 100;
  }

  return {
    progress_percent: isFinished ? 100 : calculatedProgress,
    round_number: isFinished ? Math.max(3, currentRound) : currentRound,
    is_finished: isFinished,
  };
}

export interface TodayLogDraft {
  todayWork: string;
  tomorrowWork: string;
  generatedAt: string;
}

export async function generateTodayLogs(userId?: string): Promise<TodayLogDraft> {
  const today = new Date().toISOString().slice(0, 10);

  // Load checked tasks from localStorage
  let checkedTaskIds: string[] = [];
  try {
    const savedChecked = localStorage.getItem('myTasks_checked');
    console.log('[GenLogs] localStorage raw:', savedChecked);
    if (savedChecked) {
      const parsed = JSON.parse(savedChecked);
      console.log('[GenLogs] parsed:', parsed);
      if (parsed.date === today) {
        checkedTaskIds = parsed.tasks || [];
      } else {
        console.log('[GenLogs] date mismatch:', parsed.date, '!=', today);
      }
    }
  } catch (e) {
    console.error('[GenLogs] localStorage parse error:', e);
  }
  console.log('[GenLogs] checkedTaskIds:', checkedTaskIds);

  // Fetch all tasks
  const { data: allTasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*');

  if (tasksError || !allTasks) {
    console.error('[GenLogs] fetch error:', tasksError);
    throw tasksError;
  }
  console.log('[GenLogs] total tasks:', allTasks.length);

  // Filter to user's tasks if userId provided
  let relevantTasks = allTasks;
  if (userId) {
    const { data: userAssignees } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('user_id', userId);
    const assignedTaskIds = new Set((userAssignees ?? []).map((a: any) => a.task_id));
    relevantTasks = allTasks.filter(t => assignedTaskIds.has(t.id) || t.created_by === userId);
    console.log('[GenLogs] user tasks:', relevantTasks.length);
  }

  const todayUpdates: string[] = [];
  const tomorrowItems: string[] = [];

  // Process main tasks (non-subtasks)
  const mainTasks = relevantTasks.filter(t => !t.parent_id);
  console.log('[GenLogs] main tasks:', mainTasks.length);

  for (const task of mainTasks) {
    const subtasks = allTasks.filter(st => st.parent_id === task.id);
    const taskTicked = checkedTaskIds.includes(task.id);
    const subtasksTicked = subtasks.filter(st => checkedTaskIds.includes(st.id));

    console.log('[GenLogs] task:', task.title, 'ticked:', taskTicked, 'subtasks ticked:', subtasksTicked.length);

    // Section A: done today
    if (taskTicked) {
      todayUpdates.push(`${task.title} is finished`);
    }
    for (const st of subtasksTicked) {
      todayUpdates.push(`${st.title} is finished`);
    }

    // Section B: tomorrow focus
    const isDone = taskTicked || (task.is_finished && task.updated_at?.startsWith(today));
    if (!isDone) {
      tomorrowItems.push(task.title);
    }
  }

  console.log('[GenLogs] todayUpdates:', todayUpdates);
  console.log('[GenLogs] tomorrowItems:', tomorrowItems);

  return {
    todayWork: todayUpdates.join('\n'),
    tomorrowWork: tomorrowItems.join('\n'),
    generatedAt: new Date().toISOString(),
  };
}

export async function fetchTasks(): Promise<TaskItem[]> {
  return withRetry(async () => {
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

  return tasks.map((t) => {
    const aggregate = computeParentProgress(t, tasks);
    return {
      id: t.id,
      parent_id: t.parent_id ?? null,
      is_focus: t.is_focus ?? false,
      title: t.title,
      description: t.description,
      today_update: t.today_update ?? null,
      next_day_focus: t.next_day_focus ?? null,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      created_by: t.created_by,
      updated_by: t.updated_by,
      created_at: t.created_at,
      updated_at: t.updated_at,
      progress_percent: aggregate.progress_percent,
      round_number: t.parent_id ? (t.round_number ?? 1) : aggregate.round_number,
      is_finished: aggregate.is_finished,
      assignees: assigneeMap.get(t.id) ?? [],
      tags: tagMap.get(t.id) ?? [],
      log_count: logCounts.get(t.id) ?? 0,
      subtask_count: tasks.filter(st => st.parent_id === t.id).length,
    };
  }) as TaskItem[];
  }); // close withRetry
}

export async function fetchTasksForCantonAi(): Promise<TaskItem[]> {
  return withRetry(async () => {
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select('id,parent_id,is_focus,title,description,today_update,next_day_focus,status,priority,due_date,created_by,updated_by,created_at,updated_at,progress_percent,round_number,is_finished')
      .order('due_date', { ascending: true });

    if (taskError || !tasks || tasks.length === 0) return [];

    const taskIds = tasks.map(t => t.id);
    const [{ data: assignees }, { data: profiles }] = await Promise.all([
      supabase.from('task_assignees').select('task_id, user_id').in('task_id', taskIds),
      supabase.from('profiles').select('id, name, email, role'),
    ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
    const assigneeMap = new Map<string, Profile[]>();

    (assignees ?? []).forEach((a: any) => {
      const profile = profileMap.get(a.user_id);
      if (!profile) return;
      const list = assigneeMap.get(a.task_id) ?? [];
      list.push(profile);
      assigneeMap.set(a.task_id, list);
    });

    return tasks.map((t) => {
      const aggregate = computeParentProgress(t, tasks);
      const taskSubtasks = tasks
        .filter(st => st.parent_id === t.id)
        .map(st => ({
          id: st.id,
          parent_id: st.parent_id,
          is_focus: st.is_focus ?? false,
          title: st.title,
          description: st.description,
          today_update: st.today_update ?? null,
          next_day_focus: st.next_day_focus ?? null,
          status: st.status,
          priority: st.priority,
          due_date: st.due_date,
          created_by: st.created_by,
          updated_by: st.updated_by,
          created_at: st.created_at,
          updated_at: st.updated_at,
          progress_percent: st.progress_percent ?? 0,
          round_number: st.round_number ?? 1,
          is_finished: st.is_finished ?? false,
          assignees: assigneeMap.get(st.id) ?? [],
          tags: [],
          log_count: 0,
        })) as TaskItem[];
      return {
        id: t.id,
        parent_id: t.parent_id ?? null,
        is_focus: t.is_focus ?? false,
        title: t.title,
        description: t.description,
        today_update: t.today_update ?? null,
        next_day_focus: t.next_day_focus ?? null,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        created_by: t.created_by,
        updated_by: t.updated_by,
        created_at: t.created_at,
        updated_at: t.updated_at,
        progress_percent: aggregate.progress_percent,
        round_number: t.parent_id ? (t.round_number ?? 1) : aggregate.round_number,
        is_finished: aggregate.is_finished,
        assignees: assigneeMap.get(t.id) ?? [],
        tags: [],
        log_count: 0,
        subtask_count: taskSubtasks.length,
        subtasks: taskSubtasks,
      };
    }) as TaskItem[];
  });
}

export async function fetchTask(taskId: string): Promise<TaskItem | null> {
  const { data: task, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();
  
  if (error || !task) return null;

  const [{ data: assignees }, { data: tags }, { data: logs }, { data: relatedTasks }] = await Promise.all([
    supabase.from('task_assignees').select('task_id, user_id').eq('task_id', taskId),
    supabase.from('tags').select('task_id, name').eq('task_id', taskId),
    supabase.from('log_entries').select('id, task_id').eq('task_id', taskId),
    supabase.from('tasks').select('id, parent_id, status, progress_percent, round_number, is_finished').or(`id.eq.${taskId},parent_id.eq.${taskId}`),
  ]);

  const aggregate = task.parent_id ? {
    progress_percent: task.is_finished ? 100 : (task.progress_percent ?? 0),
    round_number: task.round_number ?? 1,
    is_finished: task.is_finished ?? false,
  } : computeParentProgress(task, relatedTasks ?? [task]);

  const { data: profiles } = await supabase.from('profiles').select('id, name, email, role');
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
  
  const taskAssignees = (assignees ?? [])
    .map((a: any) => profileMap.get(a.user_id))
    .filter(Boolean) as Profile[];

  return {
    id: task.id,
    parent_id: task.parent_id ?? null,
    is_focus: task.is_focus ?? false,
    title: task.title,
    description: task.description,
    today_update: task.today_update ?? null,
    next_day_focus: task.next_day_focus ?? null,
    status: task.status,
    priority: task.priority,
    due_date: task.due_date,
    created_by: task.created_by,
    updated_by: task.updated_by,
    created_at: task.created_at,
    updated_at: task.updated_at,
    progress_percent: aggregate.progress_percent,
    round_number: aggregate.round_number,
    is_finished: aggregate.is_finished,
    assignees: taskAssignees,
    tags: (tags ?? []).map((t: any) => t.name),
    log_count: (logs ?? []).length,
    subtask_count: task.parent_id ? 0 : (relatedTasks ?? []).filter((item: any) => item.parent_id === task.id).length,
  } as TaskItem;
}

export async function fetchMyLogs(): Promise<LogEntry[]> {
  // Get current user first
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  
  if (!userId) return [];

  const { data, error } = await supabase
    .from('log_entries')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return attachProfilesToLogs((data ?? []) as LogEntry[]);
}

export async function fetchAllLogs(): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from('log_entries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return attachProfilesToLogs((data ?? []) as LogEntry[]);
}

export async function createTask(payload: {
  title: string;
  description: string;
  today_update?: string;
  next_day_focus?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  assignee_ids: string[];
  tags: string[];
  parent_id?: string | null;
  is_focus?: boolean;
  progress_percent?: number;
  round_number?: number;
  is_finished?: boolean;
}) {
  // Map 'finished' to 'done' for database compatibility
  const dbStatus = payload.status === 'finished' ? 'done' : payload.status;

  // Get current user
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      title: payload.title,
      description: payload.description,
      today_update: payload.today_update?.trim() || null,
      next_day_focus: payload.next_day_focus?.trim() || null,
      status: dbStatus,
      priority: payload.priority,
      due_date: payload.due_date ?? null,
      parent_id: payload.parent_id ?? null,
      is_focus: payload.is_focus ?? false,
      progress_percent: payload.progress_percent ?? 0,
      round_number: payload.round_number ?? 1,
      is_finished: payload.is_finished ?? false,
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  if (payload.assignee_ids.length > 0) {
    await supabase.from('task_assignees').insert(
      payload.assignee_ids.map((uid) => ({ task_id: task.id, user_id: uid }))
    );
  } else if (userId) {
    // Default assignee: creator
    await supabase.from('task_assignees').insert(
      [{ task_id: task.id, user_id: userId }]
    );
  }

  if (payload.tags.length > 0) {
    await supabase.from('tags').insert(
      payload.tags.map((name) => ({ task_id: task.id, name }))
    );
  }

  await createAutoEventLog({
    actorId: userId,
    taskId: task.parent_id ?? task.id,
    event: task.parent_id ? `Subtask created: ${task.title}` : 'Main Task created',
  });

  return task;
}

async function syncParentTaskAggregate(parentTaskId: string, userId?: string | null) {
  const { data: relatedTasks, error: relatedError } = await supabase
    .from('tasks')
    .select('id, parent_id, status, progress_percent, round_number, is_finished')
    .or(`id.eq.${parentTaskId},parent_id.eq.${parentTaskId}`);

  if (relatedError || !relatedTasks?.length) throw relatedError ?? new Error('Related tasks not found');

  const parentTask = relatedTasks.find((task: any) => task.id === parentTaskId);
  if (!parentTask) throw new Error('Parent task not found');

  const aggregate = computeParentProgress(parentTask, relatedTasks);
  const { error: updateError } = await supabase
    .from('tasks')
    .update({
      progress_percent: aggregate.progress_percent,
      round_number: aggregate.round_number,
      is_finished: aggregate.is_finished,
      updated_at: new Date().toISOString(),
      updated_by: userId ?? null,
    })
    .eq('id', parentTaskId);

  if (updateError) throw updateError;
}

export async function updateTask(
  taskId: string,
  payload: Partial<{
    title: string;
    description: string;
    today_update: string | null;
    next_day_focus: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
    parent_id: string | null;
    is_focus: boolean;
    progress_percent: number;
    round_number: number;
    is_finished: boolean;
  }>
) {
  // Map 'finished' to 'done' for database compatibility
  const dbPayload = { ...payload };
  if (dbPayload.status === 'finished') {
    (dbPayload as any).status = 'done';
  }

  // Get current user
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const { data: existingTask, error: existingError } = await supabase
    .from('tasks')
    .select('id, parent_id, title, status, priority, due_date, is_focus, progress_percent, round_number, is_finished, today_update, next_day_focus')
    .eq('id', taskId)
    .single();

  if (existingError || !existingTask) throw existingError ?? new Error('Task not found');

  const { error } = await supabase
    .from('tasks')
    .update({ ...dbPayload, updated_at: new Date().toISOString(), updated_by: userId })
    .eq('id', taskId);
  if (error) throw error;

  const events = buildTaskUpdateEvents(existingTask as TaskRecord, payload as Partial<TaskRecord>);
  for (const event of events) {
    await createAutoEventLog({
      actorId: userId,
      taskId: existingTask.parent_id ?? existingTask.id,
      event,
    });
  }

  if (existingTask.parent_id) {
    await syncParentTaskAggregate(existingTask.parent_id, userId);
  }
}

export async function fetchSubtasks(parentTaskId: string): Promise<TaskItem[]> {
  const allTasks = await fetchTasks();
  return allTasks.filter(task => task.parent_id === parentTaskId);
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
  // Get current user
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (!userId) {
    throw new Error('User not authenticated');
  }

  // Insert log entry with created_by
  const { error } = await supabase.from('log_entries').insert({
    task_id: payload.task_id,
    date: payload.date,
    event: payload.event,
    category: payload.category,
    time_spent: payload.time_spent ?? null,
    file_name: payload.file_name ?? null,
    created_by: userId,
  });
  if (error) throw error;

  // If status is provided, update the task's status
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
  return attachProfilesToLogs((data ?? []) as LogEntry[]);
}

export async function deleteLog(logId: string) {
  const { error } = await supabase.from('log_entries').delete().eq('id', logId);
  if (error) throw error;
}

export async function inviteMember(payload: {
  name: string;
  email: string;
  role: Role;
  tempPassword: string;
}): Promise<{ userId: string; tempPassword: string }> {
  // Create user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.tempPassword,
  });

  if (authError || !authData.user) {
    throw new Error(authError?.message || 'Failed to create user');
  }

  const userId = authData.user.id;

  // Create profile entry
  const { error: profileError } = await supabase.from('profiles').insert({
    id: userId,
    name: payload.name,
    email: payload.email,
    role: payload.role,
  });

  if (profileError) {
    throw new Error(`User created but profile failed: ${profileError.message}`);
  }

  return { userId, tempPassword: payload.tempPassword };
}

export async function updateLog(
  logId: string,
  payload: {
    event?: string;
    category?: string;
    time_spent?: string;
    file_name?: string;
  }
) {
  const { error } = await supabase
    .from('log_entries')
    .update(payload)
    .eq('id', logId);
  if (error) throw error;
}
