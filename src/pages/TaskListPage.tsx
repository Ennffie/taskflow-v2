import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown, ChevronUp, Filter, CheckCircle2, Clock, AlertCircle, Circle, AlertTriangle, Inbox, User, Download, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTasks } from '../lib/api';
import { formatDate } from '../lib/date';
import { STATUS_CONFIG, type TaskItem } from '../types';
import { AppShell } from '../components/AppShell';
import { TaskFormModal } from '../components/TaskFormModal';
import { useAuth } from '../contexts/AuthContext';
import type { TaskStatus } from '../types';

export const panelStyle = {
  background: '#fff',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  padding: '20px',
};

interface ImportRow {
  rowIndex: number;
  taskId: string | null;
  title: string;
  status: string;
  assigneeNames: string[];
  dueDate: string | null;
  description: string;
}

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
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'status' | null>(null);
  
  // Section expand/collapse state - default: Only Focus expanded
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "Today's Focus": true,
    'Overdue': false,
    'Other': false,
    'Done': false,
  });
  
  const userName = profile?.name || 'User';
  const isAdmin = profile?.role === 'admin';

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

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
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

  // Stats for compact cards - use filtered tasks to match list
  const focusCount = filtered.filter(t => t.status === 'focus').length;
  const overdueCount = filtered.filter(t => isOverdue(t.due_date) && t.status !== 'done' && t.status !== 'focus').length;
  const otherCount = filtered.filter(t => !isOverdue(t.due_date) && t.status !== 'done' && t.status !== 'focus').length;

  return (
    <AppShell onAddTask={() => setShowModal(true)}>
      <div style={{ maxWidth: '1200px' }}>
        {/* Header with User */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: 0 }}>All Tasks</h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Import Tasks Button - Admin only */}
            {isAdmin && (
              <button
                onClick={() => setShowImportModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#475569',
                }}
              >
                <Download size={16} />
                Import Tasks
              </button>
            )}
            
            {/* User Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={16} color="#fff" />
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>{userName}</span>
            </div>
          </div>
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
            bgColor="#ede9fe"
            iconBgColor="#ddd6fe"
            active={expandedSections["Today's Focus"]}
            onToggle={() => toggleSection("Today's Focus")}
          />
          <CompactCard 
            icon={<AlertTriangle size={20} color="#ef4444" />}
            label="Overdue" 
            count={overdueCount}
            bgColor="#fef2f2"
            iconBgColor="#fee2e2"
            active={expandedSections['Overdue']}
            onToggle={() => toggleSection('Overdue')}
          />
          <CompactCard 
            icon={<Inbox size={20} color="#3b82f6" />}
            label="Other" 
            count={otherCount}
            bgColor="#eff6ff"
            iconBgColor="#dbeafe"
            active={expandedSections['Other']}
            onToggle={() => toggleSection('Other')}
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
            Object.entries(groupedTasks).map(([groupName, groupTasks]) => {
              const isExpanded = expandedSections[groupName] ?? true;
              const isFocusSection = groupName === "Today's Focus";
              
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
                    // Alternate background colors for tasks within the same group
                    const isEvenIndex = taskIndex % 2 === 0;
                    const baseBgColor = isFocusSection 
                      ? (isEvenIndex ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)')
                      : (isEvenIndex ? '#ffffff' : '#f8fafc');
                    const hoverBgColor = isFocusSection 
                      ? (isEvenIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)')
                      : (isEvenIndex ? '#f1f5f9' : '#e2e8f0');
                    
                    return (
                    <div 
                      key={task.id}
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '12px', 
                        padding: '14px 20px', 
                        borderBottom: '1px solid #f1f5f9', 
                        cursor: 'pointer',
                        background: baseBgColor,
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = hoverBgColor}
                      onMouseLeave={(e) => e.currentTarget.style.background = baseBgColor}
                    >
                    <div style={{ marginTop: '2px' }}>
                      <StatusIcon status={task.status} />
                    </div>
                    
                    {/* Middle: Title + Tags + Log Count */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Task Title + Log Count inline */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                          flex: 1,
                        }}>
                          {task.title}
                        </p>
                        {/* Log Count - inline with title */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <MessageSquare size={14} color="#94a3b8" />
                          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                            {task.log_count}
                          </span>
                        </div>
                      </div>
                      
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
                        {formatDate(task.due_date)}
                      </span>
                    </div>
                  </div>
                );
              })}
                </div>
              );
            })
          )}
        </div>
      </div>

      {showModal && <TaskFormModal onClose={() => setShowModal(false)} onCreated={loadTasks} />}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} />}
    </AppShell>
  );
}

// Import Modal Component
function ImportModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<any>(null);
  const [previewData, setPreviewData] = useState<ImportRow[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        setError(null);
        parseFile(file);
      } else {
        setError('Please upload XLSX, XLS, or CSV file');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.name.endsWith('.xlsx') || selected.name.endsWith('.xls') || selected.name.endsWith('.csv')) {
        setError(null);
        parseFile(selected);
      } else {
        setError('Please upload XLSX, XLS, or CSV file');
      }
    }
  };

  const parseFile = async (file: File) => {
    setParsing(true);
    setError(null);
    
    try {
      const buffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      setWorkbook(wb);
      
      const sheets = wb.SheetNames;
      setAvailableSheets(sheets);
      
      if (sheets.length === 1) {
        // Only one sheet, auto-select
        setSelectedSheet(sheets[0]);
        parseSheet(wb, sheets[0]);
      } else {
        // Multiple sheets, wait for user selection
        setParsing(false);
      }
    } catch (err) {
      setError('Failed to parse file: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setParsing(false);
    }
  };

  const parseSheet = (wb: any, sheetName: string) => {
    setParsing(true);
    
    import('xlsx').then(XLSX => {
      const worksheet = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Parse rows
      const parsed: ImportRow[] = [];
      let startRow = 0;
      
      // Detect header row
      for (let i = 0; i < Math.min(data.length, 10); i++) {
        const row = data[i] as any[];
        if (row && row.length >= 5) {
          const firstCol = String(row[0] || '').toLowerCase();
          if (firstCol.includes('date') || firstCol.includes('member') || firstCol.includes('task')) {
            startRow = i + 1;
            break;
          }
        }
      }
      
      for (let i = startRow; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row || row.length < 4) continue;
        
        const date = parseDate(row[0]);
        const member = String(row[1] || '').trim();
        const taskId = String(row[2] || '').trim();
        const taskName = String(row[3] || '').trim();
        const update = String(row[4] || '').trim();
        const statusCell = row[5];
        const status = String(statusCell !== undefined ? statusCell : 'New').trim();
        
        // Skip empty rows
        if (!taskName && !update) continue;
        
        parsed.push({
          rowIndex: i,
          taskId: taskId || null,
          title: taskName || taskId || 'Untitled',
          status: status,
          assigneeNames: member ? [member] : [],
          dueDate: date || null,
          description: update,
        });
      }
      
      if (parsed.length === 0) {
        setError('No valid data found in sheet. Expected format: Date, Member, Task ID, Task Name, Update, Status');
        setPreviewData(null);
      } else {
        // Auto-detect Day 2: compare all dates, later dates = Day 2 (focus)
        const allDates = [...new Set(parsed.map(r => r.dueDate).filter(Boolean) as string[])].sort();
        if (allDates.length >= 2) {
          const day1Date = allDates[0]; // earliest date
          parsed.forEach(row => {
            if (row.dueDate && row.dueDate !== day1Date) {
              row.status = 'focus'; // Later dates = Day 2 = focus
            }
          });
        }
        
        setPreviewData(parsed);
        setError(null);
      }
      setParsing(false);
    }).catch(err => {
      setError('Failed to parse sheet: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setParsing(false);
    });
  };

  const parseDate = (dateVal: any): string | null => {
    // Handle Date object (from XLSX cellDates)
    if (dateVal instanceof Date) {
      if (!isNaN(dateVal.getTime())) {
        return dateVal.toISOString().slice(0, 10);
      }
      return null;
    }
    
    // Handle Excel serial number (number of days since 1899-12-30)
    if (typeof dateVal === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + dateVal * 24 * 60 * 60 * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
      return null;
    }
    
    const dateStr = String(dateVal || '').trim();
    if (!dateStr) return null;
    
    // Try to parse various date formats
    const formats = [
      // DD-MMM (e.g., 20-Apr)
      /^(\d{1,2})-([A-Za-z]{3})/,
      // DD/MM/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      // YYYY-MM-DD
      /^(\d{4})-(\d{2})-(\d{2})/,
    ];
    
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        try {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date.toISOString().slice(0, 10);
          }
        } catch {
          // Continue to next format
        }
      }
    }
    
    // Default: try direct parsing
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    } catch {
      return null;
    }
    
    return null;
  };

  const handleSheetSelect = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbook) {
      parseSheet(workbook, sheetName);
    }
  };

  const handleProceed = () => {
    if (previewData && previewData.length > 0) {
      navigate('/import-review', { state: { importData: previewData } });
      onClose();
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>Import Tasks</h2>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
            Upload Excel/CSV file with daily report format
          </p>
        </div>
        
        {/* Content */}
        <div style={{ padding: '20px 24px' }}>
          {/* Upload Area - Initial State */}
          {!previewData && availableSheets.length === 0 && (
            <div
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: isDragging ? '2px dashed #7c3aed' : '2px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '40px 24px',
                textAlign: 'center',
                background: isDragging ? '#faf5ff' : '#f8fafc',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
            >
              <Download size={40} color={isDragging ? '#7c3aed' : '#94a3b8'} style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 8px 0' }}>
                {isDragging ? 'Drop file here!' : 'Drop XLS/XLSX/CSV file here'}
              </p>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 16px 0' }}>
                Or click to browse
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="import-file-input"
              />
              <label
                htmlFor="import-file-input"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: '#111827',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Choose File
              </label>
            </div>
          )}
          
          {/* Sheet Selection */}
          {!previewData && availableSheets.length > 1 && (
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 12px 0' }}>
                📑 This file has {availableSheets.length} sheets. Please select one:
              </p>
              <div style={{ display: 'grid', gap: '8px' }}>
                {availableSheets.map((sheetName) => (
                  <button
                    key={sheetName}
                    onClick={() => handleSheetSelect(sheetName)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      border: selectedSheet === sheetName ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                      background: selectedSheet === sheetName ? '#faf5ff' : '#fff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: selectedSheet === sheetName ? 600 : 500,
                      color: selectedSheet === sheetName ? '#6d28d9' : '#374151',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{sheetName}</span>
                    {selectedSheet === sheetName && <CheckCircle2 size={18} color="#7c3aed" />}
                  </button>
                ))}
              </div>
              
              {selectedSheet && parsing && (
                <div style={{ marginTop: '16px', textAlign: 'center', color: '#64748b' }}>
                  <p>Parsing sheet "{selectedSheet}"...</p>
                </div>
              )}
            </div>
          )}
          
          {/* Error */}
          {error && (
            <div style={{ 
              marginTop: '16px', 
              padding: '12px 16px', 
              background: '#fef2f2', 
              borderRadius: '8px',
              border: '1px solid #fecaca',
            }}>
              <p style={{ fontSize: '13px', color: '#dc2626', margin: 0 }}>{error}</p>
            </div>
          )}
          
          {/* Preview */}
          {previewData && (
            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '12px' 
              }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                  📄 Sheet: {selectedSheet} ({previewData.length} tasks)
                </span>
                <button
                  onClick={() => { 
                    setPreviewData(null); 
                    setSelectedSheet(null);
                    setAvailableSheets([]);
                    setError(null); 
                  }}
                  style={{
                    fontSize: '13px',
                    color: '#64748b',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Change file
                </button>
              </div>
              
              <div style={{ 
                maxHeight: '200px', 
                overflow: 'auto', 
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}>
                {previewData.slice(0, 5).map((row, i) => (
                  <div 
                    key={i}
                    style={{
                      padding: '12px 16px',
                      borderBottom: i < 4 ? '1px solid #f1f5f9' : 'none',
                      fontSize: '13px',
                    }}
                  >
                    <span style={{ color: '#64748b', marginRight: '8px' }}>#{row.rowIndex}</span>
                    <span style={{ color: '#111827', fontWeight: 500 }}>{row.title || 'Untitled'}</span>
                    {row.assigneeNames.length > 0 && (
                      <span style={{ color: '#94a3b8', marginLeft: '8px' }}>• {row.assigneeNames[0]}</span>
                    )}
                  </div>
                ))}
                {previewData.length > 5 && (
                  <div style={{ padding: '8px 16px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
                    +{previewData.length - 5} more...
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Expected format info */}
          <div style={{ marginTop: '20px', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151', margin: '0 0 8px 0' }}>
              Expected format:
            </p>
            <code style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
              Date, Member, Task ID, Task Name, Update, Status
            </code>
          </div>
        </div>
        
        {/* Footer */}
        <div style={{ 
          padding: '16px 24px', 
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#fff',
              fontSize: '14px',
              fontWeight: 500,
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleProceed}
            disabled={!previewData || parsing}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: previewData ? '#111827' : '#e2e8f0',
              color: previewData ? '#fff' : '#94a3b8',
              fontSize: '14px',
              fontWeight: 600,
              cursor: previewData ? 'pointer' : 'not-allowed',
            }}
          >
            {parsing ? 'Parsing...' : 'Proceed to Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Compact Card Component
interface CompactCardProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  bgColor: string;
  iconBgColor: string;
  active?: boolean;
  onToggle?: () => void;
}

function CompactCard({ icon, label, count, bgColor, iconBgColor, active, onToggle }: CompactCardProps) {
  return (
    <div 
      onClick={onToggle}
      style={{ 
        background: active ? bgColor : '#f8fafc',
        borderRadius: '16px',
        padding: '16px',
        minWidth: '140px',
        width: '140px',
        height: '80px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        flexShrink: 0,
        border: active ? '2px solid #7c3aed' : '2px solid transparent',
      }}
    >
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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: '20px', fontWeight: 700, color: active ? '#7c3aed' : '#111827' }}>{count}</span>
      </div>
    </div>
  );
}
