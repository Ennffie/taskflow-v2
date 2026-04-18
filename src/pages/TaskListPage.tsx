import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown, Filter, CheckCircle2, Clock, AlertCircle, Circle, AlertTriangle, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTasks } from '../lib/api';
import { STATUS_CONFIG, type TaskItem } from '../types';
import { AppShell } from '../components/AppShell';
import { TaskFormModal } from '../components/TaskFormModal';
import type { TaskStatus } from '../types';

export const panelStyle = {
  background: '#fff',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  padding: '20px',
};

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
    case 'focus':
      return <div style={{ ...iconStyle, borderColor: '#7c3aed', background: '#7c3aed' }}><AlertCircle size={12} color="#fff" /></div>;
    default:
      return <div style={{ ...iconStyle, borderColor: '#94a3b8', background: 'transparent' }}><Circle size={12} color="#94a3b8" /></div>;
  }
}

// Sort by due date (nulls last, then by date)
function sortByDueDate(a: TaskItem, b: TaskItem): number {
  if (!a.due_date && !b.due_date) return 0;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
}

export function TaskListPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'status' | null>(null);

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

  const groupedTasks = useMemo(() => {
    const focusTasks = filtered.filter(t => t.status === 'focus').sort(sortByDueDate);
    const overdueTasks = filtered.filter(t => isOverdue(t.due_date) && t.status !== 'done' && t.status !== 'focus').sort(sortByDueDate);
    const otherTasks = filtered.filter(t => !isOverdue(t.due_date) && t.status !== 'done' && t.status !== 'focus').sort(sortByDueDate);
    const doneTasks = filtered.filter(t => t.status === 'done').sort(sortByDueDate);
    
    const groups: Record<string, TaskItem[]> = {};
    if (focusTasks.length > 0) groups["Today's Focus"] = focusTasks;
    if (overdueTasks.length > 0) groups['Overdue'] = overdueTasks;
    if (otherTasks.length > 0) groups['Other'] = otherTasks;
    if (doneTasks.length > 0) groups['Done'] = doneTasks;
    
    return groups;
  }, [filtered]);

  // Stats for compact cards (only show non-empty groups)
  const focusCount = tasks.filter(t => t.status === 'focus').length;
  const overdueCount = tasks.filter(t => isOverdue(t.due_date) && t.status !== 'done' && t.status !== 'focus').length;
  const otherCount = tasks.filter(t => !isOverdue(t.due_date) && t.status !== 'done' && t.status !== 'focus').length;

  return (
    <AppShell onAddTask={() => setShowModal(true)}>
      <div style={{ maxWidth: '1200px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: 0 }}>All Tasks</h1>
        </div>

        {/* Horizontal Scrollable Compact Cards - 3 cards only */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          overflowX: 'auto', 
          paddingBottom: '12px',
          marginBottom: '24px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          <CompactCard 
            icon={<AlertTriangle size={20} color="#7c3aed" />}
            label="Today's Focus" 
            count={focusCount}
            subLabel="priority"
            bgColor="#ede9fe"
            iconBgColor="#ddd6fe"
            active
          />
          <CompactCard 
            icon={<AlertTriangle size={20} color="#ef4444" />}
            label="Overdue" 
            count={overdueCount}
            subLabel="needs attention"
            bgColor="#fef2f2"
            iconBgColor="#fee2e2"
          />
          <CompactCard 
            icon={<Inbox size={20} color="#3b82f6" />}
            label="Other" 
            count={otherCount}
            subLabel="remaining"
            bgColor="#eff6ff"
            iconBgColor="#dbeafe"
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
                {(['all', 'todo', 'in_progress', 'review', 'done', 'cancelled', 'focus'] as const).map((s) => (
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
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>No tasks found</p>
              <p style={{ fontSize: '14px', color: '#94a3b8' }}>Create your first task to get started</p>
            </div>
          ) : (
            Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
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
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 20px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ marginTop: '2px' }}>
                      <StatusIcon status={task.status} />
                    </div>
                    
                    {/* Middle: Title + Tags */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Task Title - 2 lines */}
                      <p style={{ 
                        fontSize: '14px', 
                        fontWeight: 500, 
                        color: '#111827', 
                        margin: 0, 
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {task.title}
                      </p>
                      
                      {/* Tags - below title, left aligned */}
                      {task.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {task.tags.slice(0, 3).map((tag) => (
                            <span key={tag} style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b' }}>
                              {tag}
                            </span>
                          ))}
                          {task.tags.length > 3 && (
                            <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b' }}>
                              +{task.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right side: Assignees + Due Date */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '80px' }}>
                      {/* Assignees */}
                      {task.assignees.length > 0 ? (
                        <div style={{ display: 'flex' }}>
                          {task.assignees.slice(0, 2).map((a, i) => (
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
                                marginLeft: i === 0 ? 0 : '-6px', 
                                border: '2px solid #fff',
                                zIndex: task.assignees.length - i
                              }}
                              title={a.name}
                            >
                              {a.name.split(' ').map(n => n[0]).join('')}
                            </div>
                          ))}
                          {task.assignees.length > 2 && (
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
                              +{task.assignees.length - 2}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ height: '28px' }} />
                      )}

                      {/* Due Date */}
                      <span style={{ 
                        fontSize: '12px', 
                        fontWeight: 500,
                        color: isOverdue(task.due_date) ? '#ef4444' : isDueSoon(task.due_date) ? '#f59e0b' : '#64748b'
                      }}>
                        {task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && <TaskFormModal onClose={() => setShowModal(false)} onCreated={loadTasks} />}
    </AppShell>
  );
}

// Compact Card Component - like the reference image
interface CompactCardProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  subLabel: string;
  bgColor: string;
  iconBgColor: string;
  active?: boolean;
}

function CompactCard({ icon, label, count, subLabel, bgColor, iconBgColor, active }: CompactCardProps) {
  return (
    <div style={{ 
      background: active ? bgColor : '#f8fafc',
      borderRadius: '16px',
      padding: '16px',
      minWidth: '140px',
      width: '140px',
      height: '100px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      cursor: 'pointer',
      flexShrink: 0,
      border: active ? '2px solid #7c3aed' : '2px solid transparent',
    }}>
      <div style={{ 
        width: '32px', 
        height: '32px', 
        borderRadius: '8px', 
        background: iconBgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>{label}</span>
          <span style={{ fontSize: '20px', fontWeight: 700, color: active ? '#7c3aed' : '#111827' }}>{count}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
          {subLabel}
        </div>
      </div>
    </div>
  );
}
