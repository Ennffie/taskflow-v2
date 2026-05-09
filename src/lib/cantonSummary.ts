import type { TaskItem } from '../types';

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

function score(task: TaskItem) {
  let n = 0;
  if (isOverdue(task)) n += 100;
  if (task.priority === 'urgent') n += 40;
  else if (task.priority === 'high') n += 24;
  if (task.is_focus) n += 18;
  if (task.due_date === todayStr()) n += 16;
  n += Math.min(task.progress_percent ?? 0, 100) < 100 ? 4 : 0;
  return n;
}

function rootOpenTasks(tasks: TaskItem[]) {
  return tasks.filter((t) => isRoot(t) && !isDone(t));
}

function topTasks(tasks: TaskItem[], limit = 4) {
  return [...tasks]
    .sort((a, b) => score(b) - score(a) || (a.due_date || '9999-99-99').localeCompare(b.due_date || '9999-99-99'))
    .slice(0, limit);
}

function line(task: TaskItem) {
  const assignees = task.assignees?.map((a) => a.name).join('、') || '未指派';
  const due = task.due_date || '未設 deadline';
  const progress = task.progress_percent ?? 0;
  return `• ${task.title}（${due}｜${assignees}｜${progress}%）`;
}

export function tryBuildDeterministicSummary(input: string, tasks: TaskItem[], currentUserName: string) {
  const text = input.trim().toLowerCase();

  const allFocus = tasks.filter((t) => t.is_focus === true);
  const openRoot = rootOpenTasks(tasks);
  const dueToday = openRoot.filter(isDueToday);
  const overdue = openRoot.filter(isOverdue);
  const myTasks = openRoot.filter((t) => t.assignees?.some((a) => a.name === currentUserName) || t.created_by === currentUserName);
  const urgent = topTasks(openRoot, 4);

  if (/(focus|foucs|今日focus|show focus|focus有啲咩|focus有d咩)/.test(text)) {
    return allFocus.length
      ? `而家 Focus task 總共有 ${allFocus.length} 個：\n\n${allFocus.slice(0, 10).map(line).join('\n')}`
      : '暫時未見有 Focus task。';
  }

  if (/(今日focus|focus task|focus tasks|今日有咩做|今日做咩|我今日有啲乜嘢做|今日重點|today|而家我有啲乜嘢做|有乜嘢我可以做|我依家有咩做)/.test(text)) {
    const top = topTasks([...dueToday, ...overdue, ...openRoot], 4);
    return [
      `Bro，你而家要留意嘅 main task 有 ${openRoot.length} 個。今日到期 ${dueToday.length} 個，overdue ${overdue.length} 個。`,
      top.length ? top.map(line).join('\n') : '暫時未見有要即刻跟進嘅 main task。',
    ].join('\n\n');
  }

  if (/(今日到期|due today|today due)/.test(text)) {
    return dueToday.length
      ? `今日到期有 ${dueToday.length} 個：\n\n${topTasks(dueToday, 6).map(line).join('\n')}`
      : '今日暫時冇 main task 到期。';
  }

  if (/(我有咩未做|我有啲咩未做|my task|my tasks|我嘅task|我既task)/.test(text)) {
    return myTasks.length
      ? `你而家手上未完成 main task 有 ${myTasks.length} 個：\n\n${topTasks(myTasks, 6).map(line).join('\n')}`
      : '你而家名下暫時未見有未完成 main task。';
  }

  if (/(有咩未交|overdue|risk|風險|過期)/.test(text)) {
    return overdue.length
      ? `而家 overdue main task 有 ${overdue.length} 個：\n\n${topTasks(overdue, 6).map(line).join('\n')}`
      : '暫時未見有 overdue main task。';
  }

  if (/(最 urgent|最緊急|最重要|priority)/.test(text)) {
    return urgent.length
      ? `我會建議你而家先睇呢幾個：\n\n${urgent.map(line).join('\n')}`
      : '暫時未見有特別 urgent 嘅 main task。';
  }

  return null;
}
