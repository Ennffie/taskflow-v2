import { useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, Search, SquareArrowOutUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchTasks } from '../lib/api';
import { PRIORITY_META, STATUS_META, type TaskItem } from '../types';
import { AppShell } from '../components/AppShell';
import { TaskFormModal } from '../components/TaskFormModal';

export function TaskListPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);

  const loadTasks = async () => {
    setLoading(true);
    try {
      setTasks(await fetchTasks());
    } catch (error: any) {
      alert(`Load tasks failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadTasks(); }, []);

  const filtered = useMemo(() => tasks.filter((task) => {
    const matchesQuery = `${task.title} ${task.description ?? ''}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesQuery && matchesStatus;
  }), [tasks, query, statusFilter]);

  const summary = {
    total: tasks.length,
    todo: tasks.filter((task) => task.status === 'todo').length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
    done: tasks.filter((task) => task.status === 'done').length,
  };

  return (
    <AppShell>
      <div style={{ display: 'grid', gap: '22px' }}>
        <section style={heroCardStyle}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#7c3aed' }}>Desktop-first team workflow</div>
            <h1 style={{ fontSize: '42px', lineHeight: 1.05, margin: '10px 0 14px', color: '#111827' }}>Tasks, owners, and logs in one clean place.</h1>
            <p style={{ fontSize: '16px', color: '#6b7280', maxWidth: '720px', lineHeight: 1.7 }}>Keep the team aligned with simple task cards, readable history, and a calmer workspace.</p>
          </div>
          <button onClick={() => setShowModal(true)} style={{ borderRadius: '22px', border: 'none', background: '#111827', color: '#fff', padding: '16px 22px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '10px' }}><Plus size={18} /> New task</button>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }} className="summary-grid">
          <SummaryCard label="All tasks" value={summary.total} />
          <SummaryCard label="Todo" value={summary.todo} />
          <SummaryCard label="In progress" value={summary.inProgress} />
          <SummaryCard label="Done" value={summary.done} />
        </section>

        <section style={panelStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '14px' }} className="toolbar-grid">
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '15px', color: '#9ca3af' }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks" style={{ width: '100%', borderRadius: '18px', border: '1px solid #e5e7eb', padding: '14px 16px 14px 44px', fontSize: '14px' }} />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={filterStyle}>
              <option value="all">All status</option>
              <option value="todo">Todo</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button onClick={loadTasks} style={filterStyle}>Refresh</button>
          </div>
        </section>

        <section style={{ display: 'grid', gap: '16px' }}>
          {loading ? <EmptyState text="Loading tasks..." /> : filtered.length === 0 ? <EmptyState text="No tasks yet. Create the first one." /> : filtered.map((task) => <TaskCard key={task.id} task={task} />)}
        </section>
      </div>

      {showModal && <TaskFormModal onClose={() => setShowModal(false)} onCreated={loadTasks} />}
    </AppShell>
  );
}

function TaskCard({ task }: { task: TaskItem }) {
  const status = STATUS_META[task.status];
  const priority = PRIORITY_META[task.priority];
  return (
    <article style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }} className="task-card-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: 0 }}>{task.title}</h2>
            <Badge bg={status.bg} color={status.color} text={status.label} />
            <Badge bg={priority.bg} color={priority.color} text={priority.label} />
          </div>
          <p style={{ fontSize: '15px', color: '#6b7280', lineHeight: 1.7, marginTop: '12px', marginBottom: 0 }}>{task.description || 'No description yet.'}</p>
        </div>
        <Link to={`/tasks/${task.id}`} style={{ borderRadius: '18px', background: '#111827', color: '#fff', textDecoration: 'none', padding: '14px 18px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap' }}><SquareArrowOutUpRight size={16} /> Open log book</Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '24px' }} className="task-meta-grid">
        <MetaBlock label="Due date" value={task.due_date || 'Not set'} icon={<Calendar size={16} />} />
        <MetaBlock label="Assignees" value={task.assignees.length ? task.assignees.map((assignee) => assignee.name).join(', ') : 'Unassigned'} />
        <MetaBlock label="Tags" value={task.tags.length ? task.tags.join(', ') : 'None'} />
        <MetaBlock label="Log entries" value={String(task.log_count)} />
      </div>
    </article>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div style={panelStyle}><div style={{ fontSize: '13px', color: '#6b7280', fontWeight: 700 }}>{label}</div><div style={{ fontSize: '34px', fontWeight: 800, color: '#111827', marginTop: '8px' }}>{value}</div></div>;
}

function MetaBlock({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return <div style={{ padding: '18px', background: '#faf5ff', borderRadius: '20px', border: '1px solid #ede9fe' }}><div style={{ fontSize: '12px', color: '#7c3aed', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>{icon}{label}</div><div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginTop: '10px', lineHeight: 1.5 }}>{value}</div></div>;
}

function Badge({ bg, color, text }: { bg: string; color: string; text: string }) {
  return <span style={{ borderRadius: '999px', background: bg, color, padding: '8px 12px', fontSize: '12px', fontWeight: 800 }}>{text}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div style={{ ...panelStyle, textAlign: 'center', color: '#6b7280', padding: '56px 24px' }}>{text}</div>;
}

export const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.94)',
  borderRadius: '28px',
  padding: '24px',
  border: '1px solid rgba(255,255,255,0.8)',
  boxShadow: '0 18px 60px rgba(91,33,182,0.08)',
};

const heroCardStyle: React.CSSProperties = {
  ...panelStyle,
  padding: '30px',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: '20px',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(245,243,255,0.98))',
};

const filterStyle: React.CSSProperties = {
  borderRadius: '18px',
  border: '1px solid #e5e7eb',
  background: '#fff',
  padding: '14px 16px',
  fontSize: '14px',
  fontWeight: 600,
  color: '#374151',
};
