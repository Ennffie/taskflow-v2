import type { TaskItem } from '../types';
import type { LocalDecisionContext } from './localOllamaChat';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isDone(task: TaskItem) {
  return task.is_finished || task.status === 'done' || task.status === 'cancelled';
}

function isRoot(task: TaskItem) {
  return !task.parent_id;
}

function isDueToday(task: TaskItem) {
  return !!task.due_date && task.due_date === todayStr();
}

function isOverdue(task: TaskItem) {
  return !!task.due_date && task.due_date < todayStr() && !isDone(task);
}

function reasonFor(task: TaskItem) {
  const reasons: string[] = [];
  if (isOverdue(task)) reasons.push('已過期');
  if (isDueToday(task)) reasons.push('今日到期');
  if (task.priority === 'urgent') reasons.push('urgent');
  else if (task.priority === 'high') reasons.push('high priority');
  if (task.is_focus) reasons.push('focus');
  if ((task.progress_percent ?? 0) === 0) reasons.push('未開始');
  return reasons.join('、') || '一般跟進';
}

function score(task: TaskItem) {
  let n = 0;
  if (isOverdue(task)) n += 100;
  if (task.priority === 'urgent') n += 40;
  else if (task.priority === 'high') n += 24;
  if (task.is_focus) n += 18;
  if (isDueToday(task)) n += 16;
  if ((task.progress_percent ?? 0) === 0) n += 6;
  return n;
}

export function buildDecisionContext(tasks: TaskItem[], currentUserName: string, profiles: Array<{ name: string }>): LocalDecisionContext {
  const openMain = tasks.filter((t) => isRoot(t) && !isDone(t));
  const dueToday = openMain.filter(isDueToday);
  const overdue = openMain.filter(isOverdue);
  const myOpen = openMain.filter((t) => t.assignees?.some((a) => a.name === currentUserName) || t.created_by === currentUserName);
  const topPriority = [...openMain]
    .sort((a, b) => score(b) - score(a) || (a.due_date || '9999-99-99').localeCompare(b.due_date || '9999-99-99'))
    .slice(0, 5)
    .map((task) => ({
      title: task.title,
      due_date: task.due_date,
      assignees: task.assignees.map((a) => a.name),
      progress: task.progress_percent ?? 0,
      reason: reasonFor(task),
    }));

  return {
    today: todayStr(),
    currentUserName,
    summary: {
      openMainCount: openMain.length,
      dueTodayCount: dueToday.length,
      overdueCount: overdue.length,
      myOpenCount: myOpen.length,
    },
    topPriority,
    tasks: openMain.slice(0, 18).map((task) => ({
      title: task.title,
      status: task.status,
      due_date: task.due_date,
      assignees: task.assignees.map((a) => a.name),
      progress: task.progress_percent ?? 0,
      is_focus: task.is_focus,
      priority: task.priority,
    })),
    profiles,
  };
}
