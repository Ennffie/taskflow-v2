import { useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, Search, ChevronDown, Filter, X, SlidersHorizontal } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchTasks, fetchProfiles } from '../lib/api';
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

  return (
    <AppShell>
      <div style={{ maxWidth: '1200px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>Tasks</h1>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0' }}>{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowModal(true)} style={{ borderRadius: '8px', border: 'none', background: '#111827', color: '#fff', padding: '10px 16px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> New task
          </button>
        </div>

        {/* Filters Bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              placeholder="Search tasks..." 
              style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '10px 12px 10px 40px', fontSize: '14px', outline: 'none' }} 
            />
          </div>

          {/* Status Dropdown */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '14px', color: '#475569', fontWeight: 500, cursor: 'pointer' }}
            >
              <Filter size={14} />
              <span>{statusFilter === 'all' ? 'Status' : STATUS_CONFIG[statusFilter].label}</span>
              <ChevronDown size={14} />
            </button>
            {openDropdown === 'status' && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: '160px', zIndex: 20, padding: '6px' }}>
                {(['all', 'todo', 'in_progress', 'review', 'done', 'cancelled'] as const).map((s) => (
                  <button 
                    key={s} 
                    onClick={() => { setStatusFilter(s); setOpenDropdown(null); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', border: 'none', background: 'transparent', fontSize: '14px', color: '#475569', cursor: 'pointer', fontWeight: 500 }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>{s === 'all' ? 'All Statuses' : STATUS_CONFIG[s].label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Priority Dropdown */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '14px', color: '#475569', fontWeight: 500, cursor: 'pointer' }}
            >
              <SlidersHorizontal size={14} />
              <span>{priorityFilter === 'all' ? 'Priority' : PRIORITY_CONFIG[priorityFilter].label}</span>
              <ChevronDown size={14} />
            </button>
            {openDropdown === 'priority' && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: '160px', zIndex: 20, padding: '6px' }}>
                {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((p) => (
                  <button 
                    key={p} 
                    onClick={() => { setPriorityFilter(p); setOpenDropdown(null); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', border: 'none', background: 'transparent', fontSize: '14px', color: '#475569', cursor: 'pointer', fontWeight: 500 }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {p !== 'all' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: PRIORITY_CONFIG[p].dot.replace('bg-', '') === 'red' ? '#ef4444' : PRIORITY_CONFIG[p].dot.replace('bg-', '') === 'orange' ? '#f97316' : PRIORITY_CONFIG[p].dot.replace('bg-', '') === 'yellow' ? '#eab308' : '#22c55e' }} />}
                    <span>{p === 'all' ? 'All Priorities' : PRIORITY_CONFIG[p].label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={loadTasks} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '14px', color: '#475569', fontWeight: 500, cursor: 'pointer' }}>Refresh</button>
        </div>

        {/* Active Filter Tags */}
        {(statusFilter !== 'all' || priorityFilter !== 'all') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Filters:</span>
            {statusFilter !== 'all' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, background: STATUS_CONFIG[statusFilter].bg, color: STATUS_CONFIG[statusFilter].color }}>
                {STATUS_CONFIG[statusFilter].label}
                <button onClick={() => setStatusFilter('all')} style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}><X size={12} /></button>
              </span>
            )}
            {priorityFilter !== 'all' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, background: 'rgba(123,104,238,0.1)', color: '#7c3aed' }}>
                {PRIORITY_CONFIG[priorityFilter].label}
                <button onClick={() => setPriorityFilter('all')} style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}><X size={12} /></button>
              </span>
            )}
            <button onClick={() => { setStatusFilter('all'); setPriorityFilter('all'); }} style={{ fontSize: '13px', color: '#64748b', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 500 }}>Clear all</button>
          </div>
        )}

        {/* Task Table */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                {['Task', 'Assignee', 'Status', 'Priority', 'Due Date', 'Logs'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading tasks...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No tasks yet. Create the first one.</td></tr>
              ) : filtered.map((task) => {
                const sc = STATUS_CONFIG[task.status];
                const pc = PRIORITY_META[task.priority];
                return (
                  <tr 
                    key={task.id}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                    style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>{task.title}</p>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                        {task.tags.slice(0, 3).map((tag) => (
                          <span key={tag} style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b' }}>
                            {tag}
                          </span>
                        ))}
                        {task.tags.length > 3 && (
                          <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b' }}>+{task.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {task.assignees.length > 0 ? (
                          <>
                            <div style={{ display: 'flex', gap: '-4px' }}>
                              {task.assignees.slice(0, 2).map((a) => (
                                <div key={a.id} style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#111827', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, marginLeft: '-4px', border: '2px solid #fff' }}>
                                  {a.name.split(' ').map(n => n[0]).join('')}
                                </div>
                              ))}
                            </div>
                            {task.assignees.length === 1 && (
                              <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>{task.assignees[0].name.split(' ')[0]}</span>
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#94a3b8' }}>—</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: pc.color }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: pc.dot }} />
                        {pc.label}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '13px', color: isOverdue(task.due_date) ? '#ef4444' : isDueSoon(task.due_date) ? '#f97316' : '#64748b', fontWeight: isOverdue(task.due_date) || isDueSoon(task.due_date) ? 600 : 400 }}>
                        {task.due_date || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {task.log_count > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: 'rgba(123,104,238,0.1)', color: '#7c3aed' }}>
                          {task.log_count}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <TaskFormModal onClose={() => setShowModal(false)} onCreated={loadTasks} />}
    </AppShell>
  );
}
