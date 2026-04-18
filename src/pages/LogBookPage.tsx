import { useEffect, useState } from 'react';
import { Calendar, Users, Tag, Plus, ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { LogFormModal } from '../components/LogFormModal';
import { fetchLogs, fetchTask } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/date';
import { PRIORITY_META, STATUS_META, type LogEntry, type TaskItem } from '../types';
import { panelStyle } from './TaskListPage';

function StatusIcon({ status }: { status: TaskStatus }) {
  const iconStyle = { width: '14px', height: '14px', borderRadius: '50%', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  
  switch (status) {
    case 'done':
      return <div style={{ ...iconStyle, borderColor: '#10b981', background: '#10b981' }}><CheckCircle2 size={10} color="#fff" /></div>;
    case 'in_progress':
      return <div style={{ ...iconStyle, borderColor: '#f59e0b', background: '#fef3c7' }}><Clock size={10} color="#f59e0b" /></div>;
    case 'review':
      return <div style={{ ...iconStyle, borderColor: '#7c3aed', background: '#ede9fe' }}><AlertCircle size={10} color="#7c3aed" /></div>;
    case 'focus':
      return <div style={{ ...iconStyle, borderColor: '#7c3aed', background: '#7c3aed' }}><AlertCircle size={10} color="#fff" /></div>;
    default:
      return <div style={{ ...iconStyle, borderColor: '#94a3b8', background: 'transparent' }}><Circle size={10} color="#94a3b8" /></div>;
  }
}

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
      <div style={{ display: 'grid', gap: '16px' }}>
        {/* Back link */}
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#6b7280', fontWeight: 600, fontSize: '14px' }}>
          <ArrowLeft size={16} /> Back to tasks
        </Link>

        {/* Compact Task Info Card */}
        <div style={{ 
          background: '#fff', 
          borderRadius: '16px', 
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
        }}>
          {/* Title Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 }}>{task.title}</h1>
            <div style={{ display: 'flex', gap: '6px' }}>
              <Badge bg={status.bg} color={status.color} text={status.label} />
              <Badge bg={priority.bg} color={priority.color} text={priority.label} />
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, margin: '0 0 14px 0' }}>
              {task.description}
            </p>
          )}

          {/* Info Grid - 3 columns */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
            gap: '12px',
            paddingTop: '14px',
            borderTop: '1px solid #f1f5f9',
          }}>
            {/* Due Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={14} color="#7c3aed" />
              <div>
                <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Due</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  {formatDate(task.due_date) || 'Not set'}
                </div>
              </div>
            </div>

            {/* Assignees */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={14} color="#7c3aed" />
              <div>
                <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Assignees</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  {task.assignees.length ? task.assignees.map(a => a.name.split(' ')[0]).join(', ') : 'Unassigned'}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag size={14} color="#7c3aed" />
              <div>
                <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Tags</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  {task.tags.length ? task.tags.slice(0, 2).join(', ') + (task.tags.length > 2 ? ` +${task.tags.length - 2}` : '') : 'None'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Log Button */}
        <button 
          onClick={() => setShowModal(true)} 
          style={{ 
            width: '100%',
            borderRadius: '12px', 
            border: 'none', 
            background: '#111827', 
            color: '#fff', 
            padding: '14px 20px', 
            fontWeight: 600, 
            fontSize: '15px',
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '8px', 
            cursor: 'pointer' 
          }}
        >
          <Plus size={18} /> Add Log
        </button>

        {/* Logs Section */}
        <section style={{ display: 'grid', gap: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#374151', margin: '8px 0 4px 0' }}>
            Activity ({logs.length})
          </h2>
          
          {logs.length === 0 ? (
            <div style={{ ...panelStyle, textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
              No logs yet. Add the first update for this task.
            </div>
          ) : logs.map((log) => (
            <article key={log.id} style={{ ...panelStyle, padding: '16px 18px' }}>
              {/* Log Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ 
                    borderRadius: '6px', 
                    background: '#ede9fe', 
                    color: '#6d28d9', 
                    padding: '4px 10px', 
                    fontSize: '11px', 
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                  }}>
                    {log.category}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>
                    {formatDate(log.date)}
                  </span>
                  {log.time_spent && (
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#9ca3af' }}>
                      {log.time_spent}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                    {log.created_by_profile?.name || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                    {formatDateTime(log.created_at)}
                  </div>
                </div>
              </div>

              {/* Log Content */}
              <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#111827', margin: '0 0 12px 0' }}>
                {log.event}
              </p>

              {/* Attachment */}
              {log.file_name && (
                <div style={{ 
                  marginTop: '12px', 
                  borderRadius: '8px', 
                  background: '#faf5ff', 
                  padding: '10px 14px', 
                  color: '#6d28d9', 
                  fontWeight: 600,
                  fontSize: '13px',
                }}>
                  📎 {log.file_name}
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
      {showModal && <LogFormModal taskId={taskId} onClose={() => setShowModal(false)} onCreated={loadData} />}
    </AppShell>
  );
}

function Badge({ bg, color, text }: { bg: string; color: string; text: string }) {
  return (
    <span style={{ 
      borderRadius: '6px', 
      background: bg, 
      color, 
      padding: '3px 8px', 
      fontSize: '11px', 
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
    }}>
      {text}
    </span>
  );
}
