import type { LogEntry, TaskItem } from '../types';
import { getStatusMeta } from '../types';
import { addDays } from './date';

export type TrackerRow = {
  mainTaskId: string;
  subtaskId: string | null;
  member: string;
  mainTask: string;
  subtask: string;
  status: string;
  progress: string;
  dueDate: string;
  todayUpdate: string;
  nextDayFocus: string;
  blocker: string;
  mainTaskStatus?: string;
  mainTaskProgress?: string;
  mainTaskDueDate?: string;
};

function getRootTaskId(taskId: string, taskMap: Map<string, TaskItem>): string {
  const task = taskMap.get(taskId);
  if (!task) return taskId;
  return task.parent_id ?? task.id;
}

function getMergeKey(event: string, logId: string): string {
  const normalized = event.trim();
  const fieldMatch = normalized.match(/^([^\n:]+(?:\s[^\n:]+)*?):\s*.+$/);
  if (fieldMatch && normalized.includes('→')) return fieldMatch[1].trim().toLowerCase();
  return `log:${logId}`;
}

function buildDailyMyLogMap(logs: LogEntry[], tasks: TaskItem[], date: string, pattern?: RegExp, stripPattern?: RegExp): Map<string, string> {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const grouped = new Map<string, { order: string[]; lines: Map<string, string> }>();

  logs
    .filter((log) => log.date === date && (!pattern || pattern.test(log.event.trim())))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .forEach((log) => {
      const rootTaskId = getRootTaskId(log.task_id, taskMap);
      const group = grouped.get(rootTaskId) ?? { order: [], lines: new Map<string, string>() };
      const mergeKey = getMergeKey(log.event, log.id);
      const cleanText = stripPattern ? log.event.trim().replace(stripPattern, '').trim() : log.event.trim();
      if (group.lines.has(mergeKey)) {
        group.order = group.order.filter((key) => key !== mergeKey);
      }
      group.order.push(mergeKey);
      group.lines.set(mergeKey, cleanText);
      grouped.set(rootTaskId, group);
    });

  return new Map(
    Array.from(grouped.entries()).map(([rootTaskId, group]) => [
      rootTaskId,
      group.order.map((key) => group.lines.get(key)).filter(Boolean).join('\n'),
    ]),
  );
}

function buildFieldLogMap(logs: LogEntry[], tasks: TaskItem[], date: string, pattern: RegExp, stripPattern: RegExp): Map<string, string> {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const grouped = new Map<string, string>();

  logs
    .filter((log) => log.date === date && pattern.test(log.event.trim()))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .forEach((log) => {
      const rootTaskId = getRootTaskId(log.task_id, taskMap);
      grouped.set(rootTaskId, log.event.trim().replace(stripPattern, '').trim());
    });

  return grouped;
}

function getDescriptionBlocker(task: TaskItem): string {
  return task.description?.match(/Blocker:\s*([\s\S]*)/i)?.[1]?.trim() || '';
}

function matchesSelectedUser(task: TaskItem, selectedUser: string): boolean {
  if (selectedUser === 'all') return true;
  return task.assignees.some((assignee) => assignee.id === selectedUser);
}

function matchesSelectedUserOnTree(mainTask: TaskItem, subtasks: TaskItem[], selectedUser: string): boolean {
  if (selectedUser === 'all') return true;
  return matchesSelectedUser(mainTask, selectedUser) || subtasks.some((subtask) => matchesSelectedUser(subtask, selectedUser));
}

function formatProgress(task: TaskItem): string {
  return `${task.is_finished ? 100 : task.progress_percent ?? 0}%`;
}

export function buildTrackerRows(tasks: TaskItem[], logs: LogEntry[], reportDate: string, selectedUser: string, options?: { mainTasksOnly?: boolean }): TrackerRow[] {
  const nextFocusDate = addDays(reportDate, 1);
  const rootTasks = tasks.filter((task) => !task.parent_id);
  const todayMyLogs = buildDailyMyLogMap(logs, tasks, reportDate);
  const nextDayMyLogs = buildDailyMyLogMap(logs, tasks, nextFocusDate, /^\[Next Day Focus\]/i, /^\[Next Day Focus\]\s*/i);
  const blockerLogs = buildFieldLogMap(logs, tasks, reportDate, /^\[Blocker\]/i, /^\[Blocker\]\s*/i);

  return rootTasks.flatMap<TrackerRow>((mainTask) => {
    const subtasks = tasks.filter((task) => task.parent_id === mainTask.id);
    const relevantSubtasks = subtasks.filter((subtask) => matchesSelectedUser(subtask, selectedUser));
    const today = todayMyLogs.get(mainTask.id)?.trim() || '';
    const next = nextDayMyLogs.get(mainTask.id)?.trim() || '';
    const blocker = blockerLogs.get(mainTask.id)?.trim() || (reportDate === new Date().toISOString().slice(0, 10) ? getDescriptionBlocker(mainTask) : '');
    const hasFocus = (!!mainTask.is_focus && !mainTask.is_finished) || subtasks.some((subtask) => !!subtask.is_focus && !subtask.is_finished);
    const matchesTree = matchesSelectedUserOnTree(mainTask, subtasks, selectedUser);

    if (!today && !next && !hasFocus) return [];
    if (!matchesTree) return [];

    if (options?.mainTasksOnly) {
      return [{
        mainTaskId: mainTask.id,
        subtaskId: null,
        member: mainTask.assignees.map((item) => item.name).join(', ') || 'Unassigned',
        mainTask: mainTask.title,
        subtask: '',
        status: getStatusMeta(mainTask.status).label,
        progress: formatProgress(mainTask),
        dueDate: mainTask.due_date?.trim() || 'TBC',
        todayUpdate: today,
        nextDayFocus: next,
        blocker,
        mainTaskStatus: getStatusMeta(mainTask.status).label,
        mainTaskProgress: formatProgress(mainTask),
        mainTaskDueDate: mainTask.due_date?.trim() || 'TBC',
      }];
    }

    if (subtasks.length > 0 && relevantSubtasks.length === 0 && selectedUser !== 'all') {
      return [{
        mainTaskId: mainTask.id,
        subtaskId: null,
        member: mainTask.assignees.map((item) => item.name).join(', ') || 'Unassigned',
        mainTask: mainTask.title,
        subtask: '',
        status: getStatusMeta(mainTask.status).label,
        progress: formatProgress(mainTask),
        dueDate: mainTask.due_date?.trim() || 'TBC',
        todayUpdate: today,
        nextDayFocus: next,
        blocker,
        mainTaskStatus: getStatusMeta(mainTask.status).label,
        mainTaskProgress: formatProgress(mainTask),
        mainTaskDueDate: mainTask.due_date?.trim() || 'TBC',
      }];
    }

    if (subtasks.length === 0) {
      if (!matchesSelectedUser(mainTask, selectedUser)) return [];
      return [{
        mainTaskId: mainTask.id,
        subtaskId: null,
        member: mainTask.assignees.map((item) => item.name).join(', ') || 'Unassigned',
        mainTask: mainTask.title,
        subtask: '',
        status: getStatusMeta(mainTask.status).label,
        progress: formatProgress(mainTask),
        dueDate: mainTask.due_date?.trim() || 'TBC',
        todayUpdate: today,
        nextDayFocus: next,
        blocker,
        mainTaskStatus: getStatusMeta(mainTask.status).label,
        mainTaskProgress: formatProgress(mainTask),
        mainTaskDueDate: mainTask.due_date?.trim() || 'TBC',
      }];
    }

    return relevantSubtasks.map((subtask) => ({
      mainTaskId: mainTask.id,
      subtaskId: subtask.id,
      member: subtask.assignees.map((item) => item.name).join(', ') || 'Unassigned',
      mainTask: mainTask.title,
      subtask: subtask.title,
      status: getStatusMeta(subtask.status).label,
      progress: formatProgress(subtask),
      dueDate: subtask.due_date?.trim() || 'TBC',
      todayUpdate: today,
      nextDayFocus: next,
      blocker,
      mainTaskStatus: getStatusMeta(mainTask.status).label,
      mainTaskProgress: formatProgress(mainTask),
      mainTaskDueDate: mainTask.due_date?.trim() || 'TBC',
    }));
  });
}
