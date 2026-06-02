import { createClient } from '@supabase/supabase-js';
import { loadLocalEnv } from './load-env.mjs';

loadLocalEnv();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isMain(task) {
  return !task.parent_id;
}

function isOpen(task) {
  return !task.is_finished && task.status !== 'finished' && task.status !== 'cancelled';
}

function sortByDue(tasks) {
  return [...tasks].sort((a, b) => (a.due_date || '9999-99-99').localeCompare(b.due_date || '9999-99-99'));
}

async function fetchAll() {
  const { data: tasks, error: taskError } = await supabase.from('tasks').select('*').order('due_date', { ascending: true });
  if (taskError) throw taskError;
  const ids = (tasks || []).map(t => t.id);
  const [{ data: assignees, error: assigneeError }, { data: profiles, error: profileError }] = await Promise.all([
    supabase.from('task_assignees').select('task_id, user_id').in('task_id', ids),
    supabase.from('profiles').select('id, name, email, role')
  ]);
  if (assigneeError) throw assigneeError;
  if (profileError) throw profileError;
  const profileMap = new Map((profiles || []).map(p => [p.id, p]));
  const assigneeMap = new Map();
  for (const a of assignees || []) {
    const p = profileMap.get(a.user_id);
    if (!p) continue;
    const list = assigneeMap.get(a.task_id) || [];
    list.push(p);
    assigneeMap.set(a.task_id, list);
  }
  return (tasks || []).map(t => ({ ...t, assignees: assigneeMap.get(t.id) || [] }));
}

function audit(tasks) {
  const today = todayStr();
  const mainOpen = tasks.filter(t => isMain(t) && isOpen(t));
  const focus = sortByDue(mainOpen.filter(t => t.is_focus === true));
  const overdue = sortByDue(mainOpen.filter(t => t.due_date && t.due_date < today));
  const dueToday = sortByDue(mainOpen.filter(t => t.due_date === today));

  const findings = [];

  if (focus.some(t => t.parent_id)) findings.push('FAIL: focus list contains subtask');
  if (focus.some(t => !isOpen(t))) findings.push('FAIL: focus list contains done/cancelled/finished task');
  if (overdue.some(t => !t.due_date || t.due_date >= today)) findings.push('FAIL: overdue list contains non-overdue task');
  if (overdue.some(t => !isOpen(t))) findings.push('FAIL: overdue list contains done/cancelled/finished task');
  if (dueToday.some(t => t.due_date !== today)) findings.push('FAIL: dueToday list contains wrong date');

  return {
    today,
    counts: {
      mainOpen: mainOpen.length,
      focus: focus.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
    },
    samples: {
      focus: focus.slice(0, 5).map(t => ({ title: t.title, due_date: t.due_date, status: t.status })),
      overdue: overdue.slice(0, 5).map(t => ({ title: t.title, due_date: t.due_date, status: t.status })),
      dueToday: dueToday.slice(0, 5).map(t => ({ title: t.title, due_date: t.due_date, status: t.status })),
    },
    findings,
  };
}

const tasks = await fetchAll();
const report = audit(tasks);
console.log(JSON.stringify(report, null, 2));
if (report.findings.length) process.exit(2);
