import { useEffect, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { LogFormModal } from '../components/LogFormModal';
import { fetchLogs, fetchTask } from '../lib/api';
import { PRIORITY_META, STATUS_META, type LogEntry, type TaskItem } from '../types';
import { panelStyle } from './TaskListPage';

export function LogBookPage() {
  const { taskId = '' } = useParams();
  const [task, setTask] = useState<TaskItem | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadData = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const [nextTask, nextLogs] = await Promise.all([fetchTask(taskId), fetchLogs(taskId)]);
      setTask(nextTask);
      setLogs(nextLogs);
    } catch (error: any) {
      alert(`Load log book failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, [taskId]);

  if (loading) {
    return <AppShell><div style={panelStyle}>Loading log book...</div></AppShell>;
  }

  if (!task) {
    return <AppShell><div style={panelStyle}>Task not found.</div></AppShell>;
  }

  const status = STATUS_META[task.status];
  const priority = PRIORITY_META[task.priority];

  return (
    <AppShell>
      <div style={{ display: 'grid', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '18px' }} className="page-head-stack">
          <div>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#6b7280', fontWeight: 700, marginBottom: '14px' }}><ArrowLeft size={16} /> Back to tasks</Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '34px', fontWeight: 800, color: '#111827', margin: 0 }}>{task.title}</h1>
              <Badge bg={status.bg} color={status.color} text={status.label} />
              <Badge bg={priority.bg} color={priority.color} text={priority.label} />
            </div>
            <p style={{ fontSize: '15px', color: '#6b7280', lineHeight: 1.8, marginTop: '12px', maxWidth: '900px' }}>{task.description || 'No description yet.'}</p>
          </div>
          <button onClick={() => setShowModal(true)} style={{ borderRadius: '22px', border: 'none', background: '#111827', color: '#fff', padding: '16px 20px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}><Plus size={18} /> Add log</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="summary-grid">
          <MiniCard label="Due date" value={task.due_date || 'Not set'} />
          <MiniCard label="Assignees" value={task.assignees.length ? task.assignees.map((item) => item.name).join(', ') : 'Unassigned'} />
          <MiniCard label="Tags" value={task.tags.length ? task.tags.join(', ') : 'None'} />
        </div>

        <section style={{ display: 'grid', gap: '16px' }}>
          {logs.length === 0 ? <div style={panelStyle}>No logs yet. Add the first update for this task.</div> : logs.map((log) => (
            <article key={log.id} style={{ ...panelStyle, padding: '22px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }} className="task-card-head">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ borderRadius: '999px', background: '#ede9fe', color: '#6d28d9', padding: '8px 12px', fontSize: '12px', fontWeight: 800 }}>{log.category}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>{log.date}</span>
                    {log.time_spent && <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>{log.time_spent}</span>}
                  </div>
                  <p style={{ fontSize: '15px', lineHeight: 1.8, color: '#111827', marginTop: '14px', marginBottom: 0 }}>{log.event}</p>
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{log.created_by_profile?.name || 'Unknown'}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>{new Date(log.created_at).toLocaleString()}</div>
                </div>
              </div>
              {log.file_name && <div style={{ marginTop: '16px', borderRadius: '18px', background: '#faf5ff', padding: '14px 16px', color: '#6d28d9', fontWeight: 700 }}>Attachment: {log.file_name}</div>}
            </article>
          ))}
        </section>
      </div>
      {showModal && <LogFormModal taskId={taskId} onClose={() => setShowModal(false)} onCreated={loadData} />}
    </AppShell>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return <div style={panelStyle}><div style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed' }}>{label}</div><div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginTop: '10px', lineHeight: 1.6 }}>{value}</div></div>;
}

function Badge({ bg, color, text }: { bg: string; color: string; text: string }) {
  return <span style={{ borderRadius: '999px', background: bg, color, padding: '8px 12px', fontSize: '12px', fontWeight: 800 }}>{text}</span>;
}
