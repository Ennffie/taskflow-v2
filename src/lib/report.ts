import type { LogEntry, TaskItem } from '../types';
import { STATUS_META } from '../types';
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

function normalizeLogBody(event: string): string {
  return event
    .replace(/^\[(What I have done|What I will focus on|Next Day Focus)\]\s*/i, '')
    .trim();
}

function findUpdatesForTask(logs: LogEntry[], taskId: string, date: string) {
  const dayLogs = logs.filter((log) => log.task_id === taskId && log.date === date);
  const todayUpdate = dayLogs
    .filter((log) => /\[What I have done\]/i.test(log.event))
    .map((log) => normalizeLogBody(log.event))
    .filter(Boolean)
    .join('\n');

  const nextDayFocus = dayLogs
    .filter((log) => /\[(What I will focus on|Next Day Focus)\]/i.test(log.event))
    .map((log) => normalizeLogBody(log.event))
    .filter(Boolean)
    .join('\n');

  return { todayUpdate, nextDayFocus };
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

  return rootTasks.flatMap<TrackerRow>((mainTask) => {
    const subtasks = tasks.filter((task) => task.parent_id === mainTask.id);
    const relevantSubtasks = subtasks.filter((subtask) => matchesSelectedUser(subtask, selectedUser));

    if (subtasks.length > 0 && relevantSubtasks.length === 0 && selectedUser !== 'all') {
      return [];
    }

    if (subtasks.length === 0) {
      if (!matchesSelectedUser(mainTask, selectedUser)) return [];
      const fallbackToday = findUpdatesForTask(logs, mainTask.id, reportDate).todayUpdate;
      const fallbackNext = findUpdatesForTask(logs, mainTask.id, nextFocusDate).nextDayFocus;
      const today = mainTask.today_update?.trim() || fallbackToday;
      const next = mainTask.next_day_focus?.trim() || fallbackNext;
      return [{
        mainTaskId: mainTask.id,
        subtaskId: null,
        member: mainTask.assignees.map((item) => item.name).join(', ') || 'Unassigned',
        mainTask: mainTask.title,
        subtask: '',
        status: STATUS_META[mainTask.status]?.label ?? mainTask.status,
        progress: formatProgress(mainTask),
        dueDate: mainTask.due_date ?? '',
        todayUpdate: today,
        nextDayFocus: next,
        mainTaskStatus: STATUS_META[mainTask.status]?.label ?? mainTask.status,
        mainTaskProgress: formatProgress(mainTask),
        mainTaskDueDate: mainTask.due_date ?? '',
      }];
    }

    return relevantSubtasks.map((subtask) => {
      const fallbackToday = findUpdatesForTask(logs, subtask.id, reportDate).todayUpdate;
      const fallbackNext = findUpdatesForTask(logs, subtask.id, nextFocusDate).nextDayFocus;
      const today = subtask.today_update?.trim() || fallbackToday;
      const next = subtask.next_day_focus?.trim() || fallbackNext;

      return {
        mainTaskId: mainTask.id,
        subtaskId: subtask.id,
        member: subtask.assignees.map((item) => item.name).join(', ') || 'Unassigned',
        mainTask: mainTask.title,
        subtask: subtask.title,
        status: STATUS_META[subtask.status]?.label ?? subtask.status,
        progress: formatProgress(subtask),
        dueDate: subtask.due_date ?? '',
        todayUpdate: today,
        nextDayFocus: next,
        mainTaskStatus: STATUS_META[mainTask.status]?.label ?? mainTask.status,
        mainTaskProgress: formatProgress(mainTask),
        mainTaskDueDate: mainTask.due_date ?? '',
      };
    });
  });
}
