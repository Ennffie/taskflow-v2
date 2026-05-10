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

function buildDailyMyLogMap(logs: LogEntry[], tasks: TaskItem[], date: string): Map<string, string> {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const grouped = new Map<string, { order: string[]; lines: Map<string, string> }>();

  logs
    .filter((log) => log.date === date)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .forEach((log) => {
      const rootTaskId = getRootTaskId(log.task_id, taskMap);
      const group = grouped.get(rootTaskId) ?? { order: [], lines: new Map<string, string>() };
      const mergeKey = getMergeKey(log.event, log.id);
      if (group.lines.has(mergeKey)) {
        group.order = group.order.filter((key) => key !== mergeKey);
      }
      group.order.push(mergeKey);
      group.lines.set(mergeKey, log.event.trim());
      grouped.set(rootTaskId, group);
    });

  return new Map(
    Array.from(grouped.entries()).map(([rootTaskId, group]) => [
      rootTaskId,
      group.order.map((key) => group.lines.get(key)).filter(Boolean).join('\n'),
    ]),
  );
}

function matchesSelectedUser(task: TaskItem, selectedUser: string): boolean {
  if (selectedUser === 'all') return true;
  return task.assignees.some((assignee) => assignee.id === selectedUser);
}

function formatProgress(task: TaskItem): string {
  return `${task.is_finished ? 100 : task.progress_percent ?? 0}%`;
}

export function buildTrackerRows(tasks: TaskItem[], logs: LogEntry[], reportDate: string, selectedUser: string): TrackerRow[] {
  const nextFocusDate = addDays(reportDate, 1);
  const rootTasks = tasks.filter((task) => !task.parent_id);
  const todayMyLogs = buildDailyMyLogMap(logs, tasks, reportDate);
  const nextDayMyLogs = buildDailyMyLogMap(logs, tasks, nextFocusDate);
  const tasksWithUpdateToday = new Set(
    logs
      .filter((log) => log.date === reportDate)
      .map((log) => getRootTaskId(log.task_id, new Map(tasks.map((task) => [task.id, task])))),
  );

  return rootTasks.flatMap<TrackerRow>((mainTask) => {
    const subtasks = tasks.filter((task) => task.parent_id === mainTask.id);
    const relevantSubtasks = subtasks.filter((subtask) => matchesSelectedUser(subtask, selectedUser));
    const today = todayMyLogs.get(mainTask.id)?.trim() || '';
    const next = nextDayMyLogs.get(mainTask.id)?.trim() || ((mainTask.is_focus && (!mainTask.is_finished || tasksWithUpdateToday.has(mainTask.id))) ? 'Continues tomorrow' : '');

    if (!today && !next) return [];

    if (subtasks.length > 0 && relevantSubtasks.length === 0 && selectedUser !== 'all') {
      return [];
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
      mainTaskStatus: getStatusMeta(mainTask.status).label,
      mainTaskProgress: formatProgress(mainTask),
      mainTaskDueDate: mainTask.due_date?.trim() || 'TBC',
    }));
  });
}
