import { useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, Search, ChevronDown, Filter, X, SlidersHorizontal, CheckCircle2, Clock, AlertCircle, Circle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchTasks } from '../lib/api';
import { PRIORITY_META, STATUS_META, type TaskItem } from '../types';
import { AppShell } from '../components/AppShell';
import { TaskFormModal } from '../components/TaskFormModal';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../types';
import type { TaskStatus, TaskPriority } from '../types';

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

// ClickUp-style status icon
function StatusIcon({ status }: { status: TaskStatus }) {
  const config = STATUS_CONFIG[status];
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

export function TaskListPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'status' | 'priority' | null>(null);

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
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    return matchesQuery && matchesStatus && matchesPriority;
  }), [tasks, query, statusFilter, priorityFilter]);

  // Group tasks by status for ClickUp-style list
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

        {/* ClickUp Style Summary Cards */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <SummaryCard 
            icon="📋"
            label="All Tasks" 
            value={tasks.length} 
            color="#7c3aed"
            subtext={`${tasks.filter(t => t.status === 'todo').length} todo`}
          />
          <SummaryCard 
            icon="🟡"
            label="In Progress" 
            value={tasks.filter(t => t.status === 'in_progress').length} 
            color="#f59e0b"
            subtext="active"
          />
          <SummaryCard 
            icon="🟢"
            label="Completed" 
            value={tasks.filter(t => t.status === 'done').length} 
            color="#10b981"
            subtext="this week"
          />
          <SummaryCard 
            icon="🔴"
            label="Overdue" 
            value={tasks.filter(t => isOverdue(t.due_date) && t.status !== 'done').length} 
            color="#ef4444"
            subtext="urgent"
          />
        </div>

        {/* Search & Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              placeholder="Search tasks by name..." 
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

        {/* ClickUp Style Task List */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>Loading tasks...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>No tasks found</p>
              <p style={{ fontSize: '14px', color: '#94a3b8' }}>Create your first task to get started</p>
            </div>
          ) : (
            Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
              groupTasks.length > 0 && (
                <div key={groupName}>
                  {/* Group Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <ChevronDown size={16} color="#64748b" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{groupName}</span>
                    <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '4px' }}>{groupTasks.length}</span>
                  </div>
                  
                  {/* Task Items */}
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

                      {/* Assignees */}
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {task.assignees.length > 0 ? (
                          <div style={{ display: 'flex', marginLeft: '-6px' }}>
                            {task.assignees.slice(0, 3).map((a, i) => (
                              <div 
                                key={a.id} 
                                style={{ 
                                  width: '28px', 
                                  height: '28px', 
                                  borderRadius: '50%', 
                                  background: ['#7c3aed', '#ec4899', '#f59e0b', '#10b981'][i % 4], 
                                  color: '#fff', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  fontSize: '11px', 
                                  fontWeight: 600, 
                                  marginLeft: '-6px', 
                                  border: '2px solid #fff',
                                  zIndex: task.assignees.length - i
                                }}
                                title={a.name}
                              >
                                {a.name.split(' ').map(n => n[0]).join('')}
                              </div>
                            ))}
                            {task.assignees.length > 3 && (
                              <div style={{ 
                                width: '28px', 
                                height: '28px', 
                                borderRadius: '50%', 
                                background: '#e2e8f0', 
                                color: '#64748b', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontSize: '10px', 
                                fontWeight: 600, 
                                marginLeft: '-6px', 
                                border: '2px solid #fff' 
                              }}>
                                +{task.assignees.length - 3}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Unassigned</span>
                        )}
                      </div>

                      {/* Due Date */}
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

function SummaryCard({ icon, label, value, color, subtext }: { icon: string; label: string; value: number; color: string; subtext: string }) {
  return (
    <div style={{ 
      flex: 1, 
      minWidth: '140px',
      background: '#fff', 
      borderRadius: '12px', 
      border: '1px solid #e2e8f0',
      padding: '16px',
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px' }}>{icon}</span>
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>{label}</span>
      </div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: color, marginBottom: '4px' }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{subtext}</div>
    </div>
  );
}
