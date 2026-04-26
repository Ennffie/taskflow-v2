import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown, ChevronUp, Filter, CheckCircle2, Clock, AlertCircle, Circle, AlertTriangle, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTasks } from '../lib/api';
import { STATUS_CONFIG, TASK_STATUS_OPTIONS, type TaskItem, type TaskStatus } from '../types';
import { AppShell } from '../components/AppShell';
import { TaskFormModal } from '../components/TaskFormModal';
import { TaskCard } from '../components/TaskCard';
import { useAuth } from '../contexts/AuthContext';

function StatusIcon({ status }: { status: TaskStatus }) {
  const iconStyle = { width: '16px', height: '16px', borderRadius: '50%', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  switch (status) {
    case 'done':
      return <div style={{ ...iconStyle, borderColor: '#10b981', background: '#10b981' }}><CheckCircle2 size={12} color="#fff" /></div>;
    case 'in_progress':
    case 'round_1_wip':
    case 'round_2_wip':
    case 'round_3_wip':
      return <div style={{ ...iconStyle, borderColor: '#f59e0b', background: '#fef3c7' }}><Clock size={12} color="#f59e0b" /></div>;
    case 'internal_review':
    case 'round_1_review':
    case 'round_2_review':
    case 'round_3_review':
    case 'review':
      return <div style={{ ...iconStyle, borderColor: '#7c3aed', background: '#ede9fe' }}><AlertCircle size={12} color="#7c3aed" /></div>;
    case 'planning':
      return <div style={{ ...iconStyle, borderColor: '#0f766e', background: '#ccfbf1' }}><AlertCircle size={12} color="#0f766e" /></div>;
    default:
      return <div style={{ ...iconStyle, borderColor: '#94a3b8', background: 'transparent' }}><Circle size={12} color="#94a3b8" /></div>;
  }
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

// Sort by due date (nulls last, then by date)
function sortByDueDate(a: TaskItem, b: TaskItem): number {
  if (!a.due_date && !b.due_date) return 0;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
}

export function MyTasksPage() {
  const { user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'status' | null>(null);

  // Section expand/collapse state - default: Other collapsed, others expanded
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "Focus": true,
    'Overdue': true,
    'Other': false,
    'Done': true,
  });

  // Selected tasks for logging
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  const loadTasks = async () => {
    setLoading(true);
    try {
      const allTasks = await fetchTasks();
      // Filter to only show tasks assigned to current user
      const myTasks = allTasks.filter(t =>
        t.assignees.some(a => a.id === user?.id)
      );
      setTasks(myTasks);
    } catch (error: any) {
      alert(`Load tasks failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const toggleTaskSelection = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
  };

  const handleLogSelected = () => {
    const firstSelectedTaskId = Array.from(selectedTasks)[0];
    if (firstSelectedTaskId) {
      navigate(`/tasks/${firstSelectedTaskId}`);
    }
  };

  useEffect(() => {
    if (authLoading || !session || !user) return;
    void loadTasks();
  }, [authLoading, session, user?.id]);

  const filtered = useMemo(() => tasks.filter((task) => {
    const matchesQuery = `${task.title} ${task.description ?? ''}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesQuery && matchesStatus;
  }), [tasks, query, statusFilter]);

  const groupedTasks = useMemo(() => {
    const rootTasks = filtered.filter(t => !t.parent_id);
    const focusTasks = rootTasks.filter(t => t.is_focus).sort(sortByDueDate);
    const overdueTasks = rootTasks.filter(t => isOverdue(t.due_date) && t.status !== 'done' && !t.is_focus).sort(sortByDueDate);
    const otherTasks = rootTasks.filter(t => !isOverdue(t.due_date) && t.status !== 'done' && !t.is_focus).sort(sortByDueDate);
    const doneTasks = rootTasks.filter(t => t.status === 'done').sort(sortByDueDate);

    const groups: Record<string, TaskItem[]> = {};
    if (focusTasks.length > 0) groups["Focus"] = focusTasks;
    if (overdueTasks.length > 0) groups['Overdue'] = overdueTasks;
    if (otherTasks.length > 0) groups['Other'] = otherTasks;
    if (doneTasks.length > 0) groups['Done'] = doneTasks;

    return groups;
  }, [filtered]);

  // Stats for compact cards
  const rootTasks = filtered.filter(t => !t.parent_id);
  const focusCount = rootTasks.filter(t => t.is_focus).length;
  const overdueCount = rootTasks.filter(t => isOverdue(t.due_date) && t.status !== 'done' && !t.is_focus).length;
  const otherCount = rootTasks.filter(t => !isOverdue(t.due_date) && t.status !== 'done' && !t.is_focus).length;

  return (
    <AppShell onAddTask={() => setShowModal(true)}>
      <div style={{ maxWidth: '1200px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: 0 }}>My Tasks</h1>

          {/* Selected count badge */}
          {selectedTasks.size > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: '#7c3aed',
              borderRadius: '20px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600
            }}>
              <CheckCircle2 size={16} />
              {selectedTasks.size} selected for log
            </div>
          )}
        </div>

        {/* Horizontal Scrollable Compact Cards - 3 cards */}
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
            label="Focus"
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
                {(['all', ...TASK_STATUS_OPTIONS] as const).map((s) => (
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

        {(query || statusFilter !== 'all') && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <span style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>
              {filtered.length} result{filtered.length === 1 ? '' : 's'} found
            </span>
            <button
              onClick={clearFilters}
              style={{ border: 'none', background: 'transparent', color: '#7c3aed', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Task List */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>Loading tasks...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>{query || statusFilter !== 'all' ? 'No matching tasks' : 'No tasks assigned to you'}</p>
              <p style={{ fontSize: '14px', color: '#94a3b8' }}>{query || statusFilter !== 'all' ? 'Try clearing filters or search with another keyword' : 'Tasks assigned to you will appear here'}</p>
            </div>
          ) : (
            Object.entries(groupedTasks).map(([groupName, groupTasks]) => {
              const isExpanded = expandedSections[groupName] ?? true;
              const isFocusSection = groupName === "Focus";

              return (
                <div key={groupName} style={isFocusSection ? {
                  background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
                  borderLeft: '4px solid #7c3aed'
                } : {}}>
                  <div
                    onClick={() => toggleSection(groupName)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 20px',
                      background: isFocusSection ? 'rgba(124, 58, 237, 0.08)' : '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    {isExpanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: isFocusSection ? '#6d28d9' : '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {groupName}
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '4px' }}>{groupTasks.length}</span>
                    {isFocusSection && <span style={{ marginLeft: '8px', fontSize: '11px', padding: '2px 8px', background: '#7c3aed', color: '#fff', borderRadius: '10px', fontWeight: 600 }}>FOCUS</span>}
                  </div>

                  {isExpanded && groupTasks.map((task, taskIndex) => {
                    const isSelected = selectedTasks.has(task.id);
                    return (
                      <TaskCard 
                        key={task.id}
                        task={task}
                        showCheckbox={true}
                        isSelected={isSelected}
                        onToggleSelect={toggleTaskSelection}
                        showAssignees={false}
                        isFocusSection={isFocusSection}
                        isEvenIndex={taskIndex % 2 === 0}
                      />
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedTasks.size > 0 && (
        <div style={{
          position: 'fixed',
          left: '16px',
          right: '16px',
          bottom: '92px',
          zIndex: 90,
          display: 'flex',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 'min(560px, 100%)',
            background: '#111827',
            color: '#fff',
            borderRadius: '18px',
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.22)',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{selectedTasks.size} task{selectedTasks.size === 1 ? '' : 's'} selected</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', marginTop: '2px' }}>Open the first selected task and add your log</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
              <button
                onClick={() => setSelectedTasks(new Set())}
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'transparent',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
              <button
                onClick={handleLogSelected}
                style={{
                  padding: '10px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#8b5cf6',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Add log
              </button>
            </div>
          </div>
        </div>
      )}

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
