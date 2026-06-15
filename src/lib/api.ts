import { supabase } from './supabase';
import { getReportDate } from './date';
import { getHongKongDateString } from './horoscope';
import { buildEmbeddedLeaveNote, getAttendanceLeaveInfo, parseLeaveNote } from './attendanceLeave';
import type { AttendanceLog, AttendanceStatus, ExternalLeavePerson, ExternalLeaveRecord, ImportSnapshot, ImportedTaskRow, LogEntry, Profile, Role, TaskItem, TaskPriority, TaskStatus } from '../types';

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
      if (isSupabaseLockError(err)) {
        await new Promise(r => setTimeout(r, 200 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function isSupabaseLockError(error: any): boolean {
  const message = `${error?.message || ''}`.toLowerCase();
  return message.includes('lock') || message.includes('another request stole');
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

const ATTENDANCE_FALLBACK_STORAGE_KEY = 'taskflow_attendance_fallback_v1';

function isMissingAttendanceTableError(error: any): boolean {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return error?.code === '42P01' || message.includes('attendance_logs');
}

function isMissingExternalLeaveTableError(error: any): boolean {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return error?.code === '42P01' || message.includes('external_leave_');
}

function readAttendanceFallback(userId: string, date: string): AttendanceLog | null {
  try {
    const raw = localStorage.getItem(ATTENDANCE_FALLBACK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, AttendanceLog>;
    return parsed[`${userId}:${date}`] ?? null;
  } catch {
    return null;
  }
}

function writeAttendanceFallback(entry: AttendanceLog | null) {
  try {
    const raw = localStorage.getItem(ATTENDANCE_FALLBACK_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as Record<string, AttendanceLog> : {};
    if (entry) {
      parsed[`${entry.user_id}:${entry.date}`] = entry;
    } else {
      Object.keys(parsed).forEach((key) => {
        delete parsed[key];
      });
    }
    localStorage.setItem(ATTENDANCE_FALLBACK_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage failure
  }
}

function deleteAttendanceFallback(userId: string, date: string) {
  try {
    const raw = localStorage.getItem(ATTENDANCE_FALLBACK_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, AttendanceLog>;
    delete parsed[`${userId}:${date}`];
    localStorage.setItem(ATTENDANCE_FALLBACK_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage failure
  }
}

const attendanceNotifyUrl = (() => {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) return null;
  try {
    const url = new URL(base);
    return `https://${url.hostname.replace('.supabase.co', '.functions.supabase.co')}/attendance-notify`;
  } catch {
    return null;
  }
})();

function normalizeAttendanceNote(note?: string | null): string | null {
  const trimmed = note?.trim();
  return trimmed ? trimmed.slice(0, 120) : null;
}

function buildAttendanceFallbackEntry(params: {
  userId: string;
  date: string;
  status: AttendanceStatus;
  checkInAt: string | null;
  note?: string | null;
  source?: string;
  existingId?: string;
  createdAt?: string;
}): AttendanceLog {
  const nowIso = params.checkInAt ?? new Date().toISOString();
  return {
    id: params.existingId ?? `local-${params.userId}-${params.date}`,
    user_id: params.userId,
    date: params.date,
    status: params.status,
    check_in_at: params.checkInAt,
    note: normalizeAttendanceNote(params.note),
    source: `${params.source ?? 'manual'}:local_fallback`,
    created_at: params.createdAt ?? nowIso,
    updated_at: nowIso,
  };
}

async function getCurrentUserId(): Promise<string | null> {
  return getCachedCurrentUserId();
}

let currentUserIdPromise: Promise<string | null> | null = null;

async function getCachedCurrentUserId(): Promise<string | null> {
  if (!currentUserIdPromise) {
    currentUserIdPromise = withRetry(async () => {
      const { data: userData, error } = await supabase.auth.getUser();
      if (error) throw error;
      return userData.user?.id ?? null;
    });

    currentUserIdPromise.finally(() => {
      window.setTimeout(() => {
        if (currentUserIdPromise) currentUserIdPromise = null;
      }, 150);
    });
  }

  return currentUserIdPromise;
}

function getMonthBounds(month: string): { start: string; end: string } {
  const [year, mm] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mm, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(daysInMonth).padStart(2, '0')}`,
  };
}

const IMPORT_SNAPSHOT_RETENTION_DAYS = 14;

function buildImportSnapshotExpiry(days = IMPORT_SNAPSHOT_RETENTION_DAYS): string {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt.toISOString();
}

async function fetchAttendanceByDate(userId: string, date: string): Promise<AttendanceLog | null> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    if (error) {
      if (isMissingAttendanceTableError(error)) {
        return readAttendanceFallback(userId, date);
      }
      throw error;
    }

    return (data as AttendanceLog | null) ?? readAttendanceFallback(userId, date);
  });
}

async function sendAttendanceNotification(params: {
  kind: 'status' | 'note' | 'clear' | 'update' | 'add' | 'time_edit';
  record: AttendanceLog;
  previous?: AttendanceLog | null;
}) {
  if (!attendanceNotifyUrl) return;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    await fetch(attendanceNotifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        kind: params.kind,
        record: params.record,
        previous: params.previous ? {
          status: params.previous.status,
          note: params.previous.note,
          check_in_at: params.previous.check_in_at,
        } : null,
      }),
    });
  } catch (error) {
    console.error('[attendance-notify] failed', error);
  }
}

async function upsertAttendanceForDate(params: {
  date: string;
  status: AttendanceStatus;
  checkInAt: string | null;
  note?: string | null;
  source?: string;
  userId?: string;
}): Promise<AttendanceLog> {
  const userId = params.userId ?? await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const date = params.date;
  const note = normalizeAttendanceNote(params.note);
  const existing = await fetchAttendanceByDate(userId, date);
  const requestedLeave = params.status === 'present' ? null : parseLeaveNote(note);
  const isHalfDayLeaveRequest = Boolean(requestedLeave?.period && requestedLeave.period !== 'full_day');
  const existingLeave = existing ? getAttendanceLeaveInfo(existing.status, existing.note) : null;
  const nextStatus: AttendanceStatus = params.status !== 'present' && isHalfDayLeaveRequest && existing?.status === 'present'
    ? 'present'
    : params.status;
  const nextCheckInAt = params.status !== 'present' && isHalfDayLeaveRequest && existing?.status === 'present'
    ? existing.check_in_at
    : params.checkInAt;
  const nextNote = params.status === 'present'
    ? (existingLeave && existingLeave.period !== 'full_day'
      ? buildEmbeddedLeaveNote(existingLeave.status, existingLeave.period, existingLeave.detail)
      : note)
    : (isHalfDayLeaveRequest && requestedLeave?.period && requestedLeave.period !== 'full_day'
      ? buildEmbeddedLeaveNote(params.status, requestedLeave.period, requestedLeave.detail)
      : note);
  const payload = {
    user_id: userId,
    date,
    status: nextStatus,
    check_in_at: nextCheckInAt,
    note: nextNote,
    source: params.source ?? 'manual',
  };

  const existingFallback = readAttendanceFallback(userId, date);
  const { data, error } = await supabase
    .from('attendance_logs')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select('*')
    .single();

  if (error || !data) {
    if (isMissingAttendanceTableError(error)) {
      const fallbackEntry = buildAttendanceFallbackEntry({
        userId,
        date,
        status: nextStatus,
        checkInAt: nextCheckInAt,
        note: nextNote,
        source: params.source ?? 'manual',
        existingId: existingFallback?.id,
        createdAt: existingFallback?.created_at,
      });
      writeAttendanceFallback(fallbackEntry);
      if (!existing || existing.status !== fallbackEntry.status || existing.note !== fallbackEntry.note || existing.check_in_at !== fallbackEntry.check_in_at) {
        void sendAttendanceNotification({ kind: 'status', record: fallbackEntry, previous: existing });
      }
      return fallbackEntry;
    }
    throw error ?? new Error('Attendance update failed');
  }

  const record = data as AttendanceLog;
  if (!existing || existing.status !== record.status || existing.note !== record.note || existing.check_in_at !== record.check_in_at) {
    void sendAttendanceNotification({ kind: 'status', record, previous: existing });
  }
  return record;
}

async function upsertAttendanceForToday(params: {
  status: AttendanceStatus;
  checkInAt: string | null;
  note?: string | null;
  source?: string;
}): Promise<AttendanceLog> {
  return upsertAttendanceForDate({
    date: getHongKongDateString(),
    status: params.status,
    checkInAt: params.checkInAt,
    note: params.note,
    source: params.source,
  });
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
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .order('name');
    if (error) throw error;
    return (data ?? []) as Profile[];
  });
}

export async function fetchExternalLeavePeople(): Promise<ExternalLeavePerson[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('external_leave_people')
      .select('id, name, linked_user_id, sort_order, active, created_at, updated_at')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      if (isMissingExternalLeaveTableError(error)) return [];
      throw error;
    }

    return (data ?? []) as ExternalLeavePerson[];
  });
}

export async function ensureExternalLeavePeople(people: Array<{
  name: string;
  sortOrder: number;
  linkedUserId?: string | null;
}>): Promise<ExternalLeavePerson[]> {
  if (!people.length) return [];

  return withRetry(async () => {
    const rows = people.map((person) => ({
      name: person.name,
      sort_order: person.sortOrder,
      linked_user_id: person.linkedUserId ?? null,
      active: true,
    }));

    const { data, error } = await supabase
      .from('external_leave_people')
      .upsert(rows, { onConflict: 'name' })
      .select('id, name, linked_user_id, sort_order, active, created_at, updated_at');

    if (error) {
      if (isMissingExternalLeaveTableError(error)) return [];
      throw error;
    }

    return (data ?? []) as ExternalLeavePerson[];
  });
}

export async function fetchExternalLeaveRecords(options?: {
  month?: string;
  date?: string;
}): Promise<ExternalLeaveRecord[]> {
  return withRetry(async () => {
    let query = supabase
      .from('external_leave_records')
      .select('id, person_id, date, status, note, source, created_at, updated_at')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (options?.month) {
      const { start, end } = getMonthBounds(options.month);
      query = query.gte('date', start).lte('date', end);
    }

    if (options?.date) {
      query = query.eq('date', options.date);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingExternalLeaveTableError(error)) return [];
      throw error;
    }

    const records = (data ?? []) as ExternalLeaveRecord[];
    const deduped = new Map<string, ExternalLeaveRecord>();
    for (const record of records) {
      const key = `${record.person_id}:${record.date}`;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, record);
        continue;
      }
      const existingTime = new Date(existing.updated_at ?? existing.created_at).getTime();
      const recordTime = new Date(record.updated_at ?? record.created_at).getTime();
      if (recordTime > existingTime) deduped.set(key, record);
    }
    return Array.from(deduped.values());
  });
}

export async function upsertExternalLeaveRecord(params: {
  personId: string;
  date: string;
  status: Exclude<AttendanceStatus, 'present'>;
  note?: string | null;
  source?: string;
}): Promise<ExternalLeaveRecord> {
  const normalizedNote = normalizeAttendanceNote(params.note);

  const existing = await withRetry(async () => {
    const { data, error } = await supabase
      .from('external_leave_records')
      .select('id, person_id, date, status, note, source, created_at, updated_at')
      .eq('person_id', params.personId)
      .eq('date', params.date)
      .maybeSingle();

    if (error) {
      if (isMissingExternalLeaveTableError(error)) return null;
      throw error;
    }
    return (data as ExternalLeaveRecord | null) ?? null;
  });

  if (existing) {
    const { data, error } = await supabase
      .from('external_leave_records')
      .update({ status: params.status, note: normalizedNote, source: params.source ?? 'admin_external' })
      .eq('id', existing.id)
      .select('id, person_id, date, status, note, source, created_at, updated_at')
      .single();

    if (error || !data) {
      if (isMissingExternalLeaveTableError(error)) throw new Error('External leave table is not ready yet');
      throw error ?? new Error('External leave update failed');
    }
    return data as ExternalLeaveRecord;
  }

  const { data, error } = await supabase
    .from('external_leave_records')
    .insert({
      person_id: params.personId,
      date: params.date,
      status: params.status,
      note: normalizedNote,
      source: params.source ?? 'admin_external',
    })
    .select('id, person_id, date, status, note, source, created_at, updated_at')
    .single();

  if (error || !data) {
    if (isMissingExternalLeaveTableError(error)) throw new Error('External leave table is not ready yet');
    throw error ?? new Error('External leave create failed');
  }
  return data as ExternalLeaveRecord;
}

export async function clearExternalLeaveRecord(date: string, personId: string): Promise<void> {
  const { error } = await supabase
    .from('external_leave_records')
    .delete()
    .eq('person_id', personId)
    .eq('date', date);

  if (error) {
    if (isMissingExternalLeaveTableError(error)) return;
    throw error;
  }
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
      progress: t.progress ?? t.progress_percent ?? 0, // Independent progress for subtasks
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
      status: payload.status,
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
    .update({ ...payload, updated_at: new Date().toISOString(), updated_by: userId })
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
  return allTasks
    .filter(task => task.parent_id === parentTaskId)
    .sort((a, b) => {
      const roundDiff = (a.round_number ?? 1) - (b.round_number ?? 1);
      if (roundDiff !== 0) return roundDiff;

      const createdDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (createdDiff !== 0) return createdDiff;

      return a.id.localeCompare(b.id);
    });
}

// Update subtask independently (does not affect parent task status)
export async function updateSubtask(
  subtaskId: string,
  payload: {
    title?: string;
    status?: TaskStatus;
    progress?: number;
    due_date?: string | null;
  }
) {
  const { data: before, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', subtaskId)
    .single();
  if (fetchError) throw fetchError;

  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.title !== undefined) updatePayload.title = payload.title;
  if (payload.due_date !== undefined) updatePayload.due_date = payload.due_date;
  if (payload.status !== undefined) updatePayload.status = payload.status;
  if (payload.progress !== undefined) {
    updatePayload.progress_percent = payload.progress;
    updatePayload.is_finished = payload.progress >= 100;
    if (payload.status === undefined) {
      updatePayload.status = payload.progress >= 100
        ? 'finished'
        : (before.status === 'done' || before.status === 'finished' ? 'in_progress' : before.status);
    }
  }

  const { error } = await supabase.from('tasks').update(updatePayload).eq('id', subtaskId);
  if (error) throw error;

  // Create auto event log for subtask changes
  const events: string[] = [];
  if (payload.title !== undefined && payload.title !== before.title) {
    events.push(`Subtask renamed: ${before.title} → ${payload.title}`);
  }
  if (payload.status !== undefined && payload.status !== before.status) {
    events.push(`Subtask status: ${before.status} → ${payload.status}`);
  }
  if (payload.progress !== undefined && payload.progress !== (before.progress ?? before.progress_percent ?? 0)) {
    events.push(`Subtask progress: ${before.progress ?? before.progress_percent ?? 0}% → ${payload.progress}%`);
  }

  for (const event of events) {
    await createTaskEventLog(subtaskId, event);
  }

  return { success: true };
}

// Update subtask assignees independently
export async function updateSubtaskAssignees(subtaskId: string, assigneeIds: string[]) {
  const { error: deleteError } = await supabase
    .from('task_assignees')
    .delete()
    .eq('task_id', subtaskId);
  if (deleteError) throw deleteError;

  if (assigneeIds.length > 0) {
    const { error: insertError } = await supabase
      .from('task_assignees')
      .insert(assigneeIds.map((id) => ({ task_id: subtaskId, user_id: id })));
    if (insertError) throw insertError;
  }

  return { success: true };
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

export async function fetchTodayAttendance(): Promise<AttendanceLog | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  return fetchAttendanceByDate(userId, getHongKongDateString());
}

export async function checkInToday(source = 'manual', note?: string | null): Promise<AttendanceLog> {
  return upsertAttendanceForToday({
    status: 'present',
    checkInAt: new Date().toISOString(),
    note,
    source,
  });
}

export async function markOffToday(status: Exclude<AttendanceStatus, 'present'>, note?: string | null, source = 'manual'): Promise<AttendanceLog> {
  return upsertAttendanceForToday({
    status,
    checkInAt: null,
    note,
    source,
  });
}

export async function markOffDate(date: string, status: Exclude<AttendanceStatus, 'present'>, note?: string | null, source = 'manual', targetUserId?: string): Promise<AttendanceLog> {
  return upsertAttendanceForDate({
    date,
    status,
    checkInAt: null,
    note,
    source,
    userId: targetUserId,
  });
}

export async function updateTodayAttendanceNote(note?: string | null): Promise<AttendanceLog> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const date = getHongKongDateString();
  const existing = await fetchAttendanceByDate(userId, date);
  if (!existing) throw new Error('No attendance record for today');

  const nextNote = normalizeAttendanceNote(note);
  if ((existing.note ?? null) === nextNote) return existing;

  const { data, error } = await supabase
    .from('attendance_logs')
    .update({ note: nextNote })
    .eq('id', existing.id)
    .eq('user_id', userId)
    .eq('date', date)
    .select('*')
    .single();

  if (error || !data) {
    if (isMissingAttendanceTableError(error)) {
      const fallbackEntry = {
        ...existing,
        note: nextNote,
        updated_at: new Date().toISOString(),
      } as AttendanceLog;
      writeAttendanceFallback(fallbackEntry);
      void sendAttendanceNotification({ kind: 'note', record: fallbackEntry, previous: existing });
      return fallbackEntry;
    }
    throw error ?? new Error('Attendance note update failed');
  }

  const record = data as AttendanceLog;
  void sendAttendanceNotification({ kind: 'note', record, previous: existing });
  return record;
}

export async function clearTodayAttendance(): Promise<void> {
  const date = getHongKongDateString();
  return clearAttendanceByDate(date);
}

export async function clearAttendanceByDate(date: string, targetUserId?: string): Promise<void> {
  const userId = targetUserId ?? await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const existing = await fetchAttendanceByDate(userId, date);
  if (!existing) return;

  const { error } = await supabase
    .from('attendance_logs')
    .delete()
    .eq('id', existing.id)
    .eq('user_id', userId)
    .eq('date', date);

  if (error) {
    if (isMissingAttendanceTableError(error)) {
      deleteAttendanceFallback(userId, date);
      void sendAttendanceNotification({ kind: 'clear', record: existing, previous: existing });
      return;
    }
    throw error;
  }

  deleteAttendanceFallback(userId, date);
  void sendAttendanceNotification({ kind: 'clear', record: existing, previous: existing });
}

export async function updateTodayAttendanceTime(timeHHMM: string): Promise<AttendanceLog> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const date = getHongKongDateString();
  const existing = await fetchAttendanceByDate(userId, date);
  if (!existing) throw new Error('No attendance record for today');
  if (existing.status !== 'present') throw new Error('Only present record can change time');

  const match = /^(\d{2}):(\d{2})$/.exec(timeHHMM.trim());
  if (!match) throw new Error('Invalid time format');
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh > 23 || mm > 59) throw new Error('Invalid time');

  const nextIso = new Date(`${date}T${match[1]}:${match[2]}:00+08:00`).toISOString();
  if (existing.check_in_at === nextIso) return existing;

  const { data, error } = await supabase
    .from('attendance_logs')
    .update({ check_in_at: nextIso })
    .eq('id', existing.id)
    .eq('user_id', userId)
    .eq('date', date)
    .eq('status', 'present')
    .select('*')
    .single();

    if (error || !data) {
      if (isMissingAttendanceTableError(error)) {
        const fallbackEntry = {
          ...existing,
          check_in_at: nextIso,
          updated_at: new Date().toISOString(),
        } as AttendanceLog;
        writeAttendanceFallback(fallbackEntry);
        void sendAttendanceNotification({ kind: 'time_edit', record: fallbackEntry, previous: existing });
        return fallbackEntry;
      }
      throw error ?? new Error('Attendance time update failed');
    }

  const record = data as AttendanceLog;
  void sendAttendanceNotification({ kind: 'time_edit', record, previous: existing });
  return record;
}

export async function updateAttendanceTime(date: string, timeHHMM: string, targetUserId?: string): Promise<AttendanceLog> {
  const userId = targetUserId ?? await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const match = /^(\d{2}):(\d{2})$/.exec(timeHHMM.trim());
  if (!match) throw new Error('Invalid time format');
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh > 23 || mm > 59) throw new Error('Invalid time');

  const nextIso = new Date(`${date}T${match[1]}:${match[2]}:00+08:00`).toISOString();
  const existing = await fetchAttendanceByDate(userId, date);
  if (!existing) {
    return upsertAttendanceForDate({
      date,
      status: 'present',
      checkInAt: nextIso,
      source: 'manual',
      userId,
    });
  }
  if (existing.status !== 'present') throw new Error('Only present record can change time');
  if (existing.check_in_at === nextIso) return existing;

  const { data, error } = await supabase
    .from('attendance_logs')
    .update({ check_in_at: nextIso })
    .eq('id', existing.id)
    .eq('user_id', userId)
    .eq('date', date)
    .eq('status', 'present')
    .select('*')
    .single();

  if (error || !data) {
    if (isMissingAttendanceTableError(error)) {
      const fallbackEntry = {
        ...existing,
        check_in_at: nextIso,
        updated_at: new Date().toISOString(),
      } as AttendanceLog;
      writeAttendanceFallback(fallbackEntry);
      void sendAttendanceNotification({ kind: 'time_edit', record: fallbackEntry, previous: existing });
      return fallbackEntry;
    }
    throw error ?? new Error('Attendance time update failed');
  }

  const record = data as AttendanceLog;
  void sendAttendanceNotification({ kind: 'time_edit', record, previous: existing });
  return record;
}

export async function deleteAttendanceRecord(record: AttendanceLog): Promise<void> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('attendance_logs')
    .delete()
    .eq('id', record.id)
    .eq('user_id', record.user_id)
    .eq('date', record.date);

  if (error) {
    if (isMissingAttendanceTableError(error)) {
      deleteAttendanceFallback(record.user_id, record.date);
      void sendAttendanceNotification({ kind: 'clear', record, previous: record });
      return;
    }
    throw error;
  }

  deleteAttendanceFallback(record.user_id, record.date);
  void sendAttendanceNotification({ kind: 'clear', record, previous: record });
}

export async function fetchAttendanceRecords(options?: {
  userId?: string;
  month?: string;
  includeAllUsers?: boolean;
}): Promise<AttendanceLog[]> {
  const currentUserId = options?.includeAllUsers
    ? await getCachedCurrentUserId()
    : (options?.userId ?? await getCachedCurrentUserId());
  if (!currentUserId) return [];

  return withRetry(async () => {
    let query = supabase
      .from('attendance_logs')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (options?.userId) {
      query = query.eq('user_id', options.userId);
    } else if (!options?.includeAllUsers) {
      query = query.eq('user_id', currentUserId);
    }

    if (options?.month) {
      const { start, end } = getMonthBounds(options.month);
      query = query.gte('date', start).lte('date', end);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingAttendanceTableError(error)) {
        const today = getHongKongDateString();
        const fallback = readAttendanceFallback(options?.userId ?? currentUserId, today);
        return fallback ? [fallback] : [];
      }
      throw error;
    }

    const records = (data ?? []) as AttendanceLog[];
    const deduped = new Map<string, AttendanceLog>();

    for (const record of records) {
      const key = `${record.user_id}:${record.date}`;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, record);
        continue;
      }

      const existingTime = new Date(existing.updated_at ?? existing.created_at).getTime();
      const recordTime = new Date(record.updated_at ?? record.created_at).getTime();
      if (recordTime > existingTime) deduped.set(key, record);
    }

    return Array.from(deduped.values());
  });
}

export async function updateAttendanceStatus(date: string, status: AttendanceStatus, note?: string | null, targetUserId?: string): Promise<AttendanceLog> {
  const userId = targetUserId ?? await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const existing = await fetchAttendanceByDate(userId, date);
  const normalizedNote = normalizeAttendanceNote(note);

  if (existing) {
    const { data, error } = await supabase
      .from('attendance_logs')
      .update({ status, note: normalizedNote, check_in_at: null })
      .eq('id', existing.id)
      .eq('user_id', userId)
      .eq('date', date)
      .select('*')
      .single();

    if (error || !data) {
      if (isMissingAttendanceTableError(error)) {
        const fallbackEntry = buildAttendanceFallbackEntry({ userId, date, status, checkInAt: null, note: normalizedNote, existingId: existing.id });
        writeAttendanceFallback(fallbackEntry);
        void sendAttendanceNotification({ kind: 'update', record: fallbackEntry, previous: existing });
        return fallbackEntry;
      }
      throw error;
    }
    void sendAttendanceNotification({ kind: 'update', record: data as AttendanceLog, previous: existing });
    return data as AttendanceLog;
  }

  const { data, error } = await supabase
    .from('attendance_logs')
    .insert({ user_id: userId, date, status, note: normalizedNote })
    .select('*')
    .single();

  if (error || !data) {
    if (isMissingAttendanceTableError(error)) {
      const fallbackEntry = buildAttendanceFallbackEntry({ userId, date, status, checkInAt: null, note: normalizedNote });
      writeAttendanceFallback(fallbackEntry);
      void sendAttendanceNotification({ kind: 'add', record: fallbackEntry });
      return fallbackEntry;
    }
    throw error;
  }
  void sendAttendanceNotification({ kind: 'add', record: data as AttendanceLog });
  return data as AttendanceLog;
}

export async function fetchAttendanceRecordsForDate(date: string): Promise<AttendanceLog[]> {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return [];

  return withRetry(async () => {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('date', date)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingAttendanceTableError(error)) {
        const fallback = readAttendanceFallback(currentUserId, date);
        return fallback ? [fallback] : [];
      }
      throw error;
    }

    const records = (data ?? []) as AttendanceLog[];
    const deduped = new Map<string, AttendanceLog>();

    for (const record of records) {
      const key = record.user_id;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, record);
        continue;
      }
      const existingTime = new Date(existing.updated_at ?? existing.created_at).getTime();
      const recordTime = new Date(record.updated_at ?? record.created_at).getTime();
      if (recordTime > existingTime) deduped.set(key, record);
    }

    return Array.from(deduped.values());
  });
}

export async function pruneExpiredImportSnapshots(nowIso = new Date().toISOString()) {
  const { error } = await supabase
    .from('import_snapshots')
    .delete()
    .lt('expires_at', nowIso);
  if (error) throw error;
}

export async function saveImportSnapshot(params: {
  sourceType: 'crce_tracker';
  sourceLabel: string;
  payload: ImportedTaskRow[];
  retentionDays?: number;
}) {
  const createdBy = await getCurrentUserId();
  if (!createdBy) throw new Error('User not authenticated');

  await pruneExpiredImportSnapshots();

  const expiresAt = buildImportSnapshotExpiry(params.retentionDays ?? IMPORT_SNAPSHOT_RETENTION_DAYS);
  const { data, error } = await supabase
    .from('import_snapshots')
    .insert({
      source_type: params.sourceType,
      source_label: params.sourceLabel,
      row_count: params.payload.length,
      payload: params.payload,
      created_by: createdBy,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('Failed to save import snapshot');
  return data as ImportSnapshot;
}

export async function fetchImportSnapshots(sourceType: 'crce_tracker' | 'all' = 'all'): Promise<ImportSnapshot[]> {
  await pruneExpiredImportSnapshots();

  let query = supabase
    .from('import_snapshots')
    .select('*')
    .order('created_at', { ascending: false });

  if (sourceType !== 'all') {
    query = query.eq('source_type', sourceType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ImportSnapshot[];
}

export async function deleteImportSnapshot(snapshotId: string) {
  const { error } = await supabase
    .from('import_snapshots')
    .delete()
    .eq('id', snapshotId);
  if (error) throw error;
}
