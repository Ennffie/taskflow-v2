import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, ChevronDown, Filter, CheckCircle2, Clock, AlertCircle, Circle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTasks } from '../lib/api';
import { STATUS_CONFIG, type TaskItem } from '../types';
import { AppShell } from '../components/AppShell';
import { TaskFormModal } from '../components/TaskFormModal';
import { useAuth } from '../contexts/AuthContext';
import type { TaskStatus } from '../types';

function isDueSoon(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  return diff >= 0 && diff <= 3;
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function StatusIcon({ status }: { status: TaskStatus }) {
  const iconStyle = { width: '16px', height: '16px', borderRadius: '50%', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  
  switch (status) {
    case 'done':
      return <div style={{ ...iconStyle, borderColor: '#10b981', background: '#10b981' }}><CheckCircle2 size={12} color="#fff" /></div>;
    case 'in_progress':
      return <div style={{ ...iconStyle, borderColor: '#f59e0b', background: '#fef3c7' }}><Clock size={12} color="#f59e0b" /></div>;
    case 'review':
      return <div style={{ ...iconStyle, borderColor: '#7c3aed', background: '#ede9fe' }}><AlertCircle size={12} color="#7c3aed" /></div>;
    default:
      return <div style={{ ...iconStyle, borderColor: '#94a3b8', background: 'transparent' }}><Circle size={12} color="#94a3b8" /></div>;
  }
}

export function MyTasksPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'status' | null>(null);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const allTasks = await fetchTasks();
      // Filter tasks assigned to current user
      const myTasks = allTasks.filter(task => 
        task.assignees.some(a => a.id === profile?.id)
      );
      setTasks(myTasks);
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

  const groupedTasks = useMemo(() => {
    const groups: Record<string, TaskItem[]> = {
      'Today': filtered.filter(t => !isOverdue(t.due_date) && t.status !== 'done'),
      'Overdue': filtered.filter(t => isOverdue(t.due_date) && t.status !== 'done'),
      'Done': filtered.filter(t => t.status === 'done'),
    };
    return groups;
  }, [filtered]);

  return (
    <AppShell>
      <div style={{ maxWidth: '1200px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: 0 }}>My Tasks</h1>
          <button onClick={() => setShowModal(true)} style={{ borderRadius: '8px', border: 'none', background: '#7c3aed', color: '#fff', padding: '10px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} /> New task
          </button>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <SummaryCard 
            icon={<CheckCircle2 size={18} color="#7c3aed" />}
            title="My Tasks" 
            value={tasks.length} 
            row2Data={[
              { label: 'Todo', value: String(tasks.filter(t => t.status === 'todo').length) },
              { label: 'In Progress', value: String(tasks.filter(t => t.status === 'in_progress').length) },
              { label: 'Done', value: String(tasks.filter(t => t.status === 'done').length) },
            ]}
            accentColor="#7c3aed"
          />
          <SummaryCard 
            icon={<Clock size={18} color="#f59e0b" />}
            title="In Progress" 
            value={tasks.filter(t => t.status === 'in_progress').length} 
            row2Data={[
              { label: 'High', value: String(tasks.filter(t => t.status === 'in_progress' && t.priority === 'high').length), color: '#ef4444' },
              { label: 'Medium', value: String(tasks.filter(t => t.status === 'in_progress' && t.priority === 'medium').length) },
              { label: 'Low', value: String(tasks.filter(t => t.status === 'in_progress' && t.priority === 'low').length) },
            ]}
            accentColor="#f59e0b"
          />
          <SummaryCard 
            icon={<AlertCircle size={18} color="#ef4444" />}
            title="Overdue" 
            value={tasks.filter(t => isOverdue(t.due_date) && t.status !== 'done').length} 
            row2Data={[
              { label: 'Urgent', value: String(tasks.filter(t => isOverdue(t.due_date) && t.status !== 'done' && t.priority === 'urgent').length), color: '#ef4444' },
              { label: 'High', value: String(tasks.filter(t => isOverdue(t.due_date) && t.status !== 'done' && t.priority === 'high').length) },
              { label: 'With Logs', value: String(tasks.filter(t => isOverdue(t.due_date) && t.status !== 'done' && t.log_count > 0).length) },
            ]}
            accentColor="#ef4444"
          />
        </div>

        {/* Search & Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              placeholder="Search my tasks..." 
              style={{ width: '100%', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px 14px 12px 42px', fontSize: '14px', outline: 'none', background: '#fff' }} 
            />
          </div>

          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '14px', color: '#475569', fontWeight: 500, cursor: 'pointer' }}
            >
              <Filter size={16} />
              <span>{statusFilter === 'all' ? 'All Status' : STATUS_CONFIG[statusFilter].label}</span>
              <ChevronDown size={14} />
            </button>
            {openDropdown === 'status' && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '6px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', minWidth: '180px', zIndex: 20, padding: '8px' }}>
                {(['all', 'todo', 'in_progress', 'review', 'done', 'cancelled'] as const).map((s) => (
                  <button 
                    key={s} 
                    onClick={() => { setStatusFilter(s); setOpenDropdown(null); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: 'none', background: 'transparent', fontSize: '14px', color: '#475569', cursor: 'pointer', fontWeight: 500 }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {s !== 'all' && <StatusIcon status={s} />}
                    <span>{s === 'all' ? 'All Statuses' : STATUS_CONFIG[s].label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Task List */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>Loading tasks...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>No tasks assigned to you</p>
              <p style={{ fontSize: '14px', color: '#94a3b8' }}>Tasks assigned to you will appear here</p>
            </div>
          ) : (
            Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
              groupTasks.length > 0 && (
                <div key={groupName}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <ChevronDown size={16} color="#64748b" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{groupName}</span>
                    <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '4px' }}>{groupTasks.length}</span>
                  </div>
                  
                  {groupTasks.map((task) => (
                    <div 
                      key={task.id}
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <StatusIcon status={task.status} />
                      
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {task.title}
                        </p>
                        {task.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                            {task.tags.slice(0, 3).map((tag) => (
                              <span key={tag} style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b' }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ minWidth: '100px', textAlign: 'right' }}>
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: 500,
                          color: isOverdue(task.due_date) ? '#ef4444' : isDueSoon(task.due_date) ? '#f59e0b' : '#64748b'
                        }}>
                          {task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'No date'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ))
          )}
        </div>
      </div>

      {showModal && <TaskFormModal onClose={() => setShowModal(false)} onCreated={loadTasks} />}
    </AppShell>
  );
}

interface SummaryCardProps {
  icon: React.ReactNode;
  title: string;
  value: number;
  row2Data: { label: string; value: string; color?: string }[];
  accentColor: string;
}

function SummaryCard({ icon, title, value, row2Data, accentColor }: SummaryCardProps) {
  return (
    <div style={{ 
      background: '#fff', 
      borderRadius: '16px', 
      border: '1px solid #e2e8f0',
      padding: '16px 20px',
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ 
            width: '36px', 
            height: '36px', 
            borderRadius: '10px', 
            background: `${accentColor}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {icon}
          </div>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#374151' }}>{title}</span>
        </div>
        <span style={{ fontSize: '28px', fontWeight: 700, color: accentColor }}>{value}</span>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        {row2Data.map((item, i) => (
          <div key={i} style={{ textAlign: i === 1 ? 'center' : i === 2 ? 'right' : 'left', flex: 1 }}>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>{item.label}</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: item.color || '#374151' }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
