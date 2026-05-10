import { performance } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';

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

function isOpenMain(task) {
  return !task.parent_id && !task.is_finished && task.status !== 'done' && task.status !== 'cancelled';
}

async function fetchAll() {
  const t0 = performance.now();
  const { data: tasks, error: taskError } = await supabase.from('tasks').select('*').order('due_date', { ascending: true });
  if (taskError) throw taskError;
  const ids = (tasks || []).map(t => t.id);
  const t1 = performance.now();
  const { data: assignees, error: assigneeError } = await supabase.from('task_assignees').select('task_id, user_id').in('task_id', ids);
  if (assigneeError) throw assigneeError;
  const t2 = performance.now();
  return {
    tasks: tasks || [],
    assignees: assignees || [],
    timings: {
      fetchTasksMs: +(t1 - t0).toFixed(1),
      fetchAssigneesMs: +(t2 - t1).toFixed(1),
      totalFetchMs: +(t2 - t0).toFixed(1),
    }
  };
}

function benchmarkQueries(tasks) {
  const today = todayStr();
  const iterations = 200;

  const run = (label, fn) => {
    const t0 = performance.now();
    let last;
    for (let i = 0; i < iterations; i++) last = fn();
    const t1 = performance.now();
    return {
      label,
      totalMs: +(t1 - t0).toFixed(3),
      avgMs: +(((t1 - t0) / iterations).toFixed(4)),
      size: Array.isArray(last) ? last.length : (typeof last === 'number' ? last : null),
    };
  };

  return [
    run('todayFocus', () => tasks.filter(t => isOpenMain(t) && t.is_focus === true)),
    run('overdue', () => tasks.filter(t => isOpenMain(t) && t.due_date && t.due_date < today)),
    run('dueToday', () => tasks.filter(t => isOpenMain(t) && t.due_date === today)),
    run('dateCount_2026_05_10', () => tasks.filter(t => isOpenMain(t) && t.due_date === '2026-05-10').length),
  ];
}

const fetchResult = await fetchAll();
const queryResults = benchmarkQueries(fetchResult.tasks);
console.log(JSON.stringify({ fetch: fetchResult.timings, queries: queryResults }, null, 2));
