import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown, ChevronUp, Filter, CheckCircle2, Clock, AlertCircle, Circle, AlertTriangle, Inbox, User, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTasks } from '../lib/api';
import { readWorkbookFromFile, sheetToJsonRows } from '../lib/xlsx';
import { STATUS_CONFIG, TASK_STATUS_OPTIONS, type TaskItem, type TaskStatus } from '../types';
import { AppShell } from '../components/AppShell';
import { TaskFormModal } from '../components/TaskFormModal';
import { TaskCard } from '../components/TaskCard';
import { useAuth } from '../contexts/AuthContext';

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

// Sort by due date (nulls last, then by date)
function sortByDueDate(a: TaskItem, b: TaskItem): number {
  if (!a.due_date && !b.due_date) return 0;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
}

export function TaskListPage() {
  const { profile, session, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'status' | null>(null);
  
  // Section expand/collapse state - default: Only Tomorrow expanded
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Focus': true,
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

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
  };

  useEffect(() => {
    if (authLoading || !session) return;
    void loadTasks();
  }, [authLoading, session, profile?.id]);

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
    if (focusTasks.length > 0) groups['Focus'] = focusTasks;
    if (overdueTasks.length > 0) groups['Overdue'] = overdueTasks;
    if (otherTasks.length > 0) groups['Other'] = otherTasks;
    if (doneTasks.length > 0) groups['Done'] = doneTasks;
    
    return groups;
  }, [filtered]);

  // Stats for compact cards - use filtered tasks to match list
  const rootTasks = filtered.filter(t => !t.parent_id);
  const focusCount = rootTasks.filter(t => t.is_focus).length;
  const overdueCount = rootTasks.filter(t => isOverdue(t.due_date) && t.status !== 'done' && !t.is_focus).length;
  const otherCount = rootTasks.filter(t => !isOverdue(t.due_date) && t.status !== 'done' && !t.is_focus).length;

  return (
    <AppShell onAddTask={() => setShowModal(true)}>
      <div style={{ maxWidth: '1200px' }}>
        {/* Header with User */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
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
          paddingBottom: '6px',
          marginBottom: '8px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          <CompactCard 
            icon={<AlertTriangle size={20} color="#7c3aed" />}
            label="Focus" 
            count={focusCount}
            bgColor="#ede9fe"
            iconBgColor="#ddd6fe"
            active={expandedSections['Focus']}
            onToggle={() => toggleSection('Focus')}
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
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
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
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>{query || statusFilter !== 'all' ? 'No matching tasks found' : 'No tasks found'}</p>
              <p style={{ fontSize: '14px', color: '#94a3b8' }}>{query || statusFilter !== 'all' ? 'Try clearing filters or search with another keyword' : 'Create your first task to get started'}</p>
            </div>
          ) : (
            Object.entries(groupedTasks).map(([groupName, groupTasks]) => {
              const isExpanded = expandedSections[groupName] ?? true;
              const isFocusSection = groupName === 'Focus';
              
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
                      {groupName} {groupTasks.length}
                    </span>
                  </div>
                  
                  {isExpanded && groupTasks.map((task, taskIndex) => (
                    <TaskCard 
                      key={task.id}
                      task={task}
                      showAssignees={true}
                      isFocusSection={isFocusSection}
                      isEvenIndex={taskIndex % 2 === 0}
                      subtasks={filtered.filter(st => st.parent_id === task.id)}
                    />
                  ))}
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
      const wb = await readWorkbookFromFile(file);
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

    sheetToJsonRows(wb, sheetName).then((data: any) => {
      
      // Parse rows
      const parsed: ImportRow[] = [];
      let startRow = 0;
      let lastMember = '';
      let format: 'A' | 'B' | null = null; // A = Member,Date; B = Date,Member
      
      // Detect header row and format
      for (let i = 0; i < Math.min(data.length, 15); i++) {
        const row = data[i] as any[];
        if (!row || row.length < 3) continue;
        
        const col0 = String(row[0] || '').toLowerCase().trim();
        const col1 = String(row[1] || '').toLowerCase().trim();
        
        // Format B: Date, Member, Task ID, Task Name, Status
        if (col0.includes('date') && (col1.includes('member') || col1.includes('name'))) {
          startRow = i + 1;
          format = 'B';
          break;
        }
        
        // Format A: Member/Name, Date, Task Name, Update
        if ((col0.includes('name') || col0.includes('member')) && col1.includes('date')) {
          startRow = i + 1;
          format = 'A';
          break;
        }
        
        // Also detect by data pattern if no clear header
        if (i > 2 && !format) {
          const prevRow = data[i-1] as any[];
          if (prevRow && prevRow[0] != null && prevRow[0] instanceof Date) {
            format = 'B'; // First col is date
            startRow = i - 1;
            break;
          }
          if (prevRow && prevRow[0] != null && typeof prevRow[0] === 'string' && prevRow[0].length > 0) {
            // Could be member name in format A
            if (prevRow[1] != null && (prevRow[1] instanceof Date || String(prevRow[1] || '').match(/^\d{4}-/))) {
              format = 'A';
              startRow = i - 1;
              break;
            }
          }
        }
      }
      
      // Default to format B if not detected
      if (!format) format = 'B';
      
      console.log('Detected format:', format, 'starting at row', startRow);
      
      for (let i = startRow; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row || row.length < 3) continue;
        
        let date: string | null = null;
        let member = '';
        let taskId = '';
        let taskName = '';
        let update = '';
        let status = 'New';
        
        if (format === 'B') {
          // Format B: Date, Member, Task ID, Task Name, Status, [Detailed Progress / Milestone]
          const dateCell = row[0];
          member = String(row[1] || '').trim();
          taskId = String(row[2] || '').trim();
          taskName = String(row[3] || '').trim();
          const statusCell = row[4];
          const detailCell = row[5]; // Detailed Progress / Milestone (optional)
          
          if (dateCell instanceof Date) {
            date = dateCell.toISOString().slice(0, 10);
          } else {
            date = parseDate(dateCell);
          }
          
          if (statusCell !== undefined) {
            status = String(statusCell).trim() || 'New';
          }
          
          // Update = detailed progress if available, else task name
          update = detailCell !== undefined ? String(detailCell || '').trim() : taskName;
        } else {
          // Format A: Member, Date, Task Name, Update, Size
          member = String(row[0] || '').trim();
          const dateCell = row[1];
          taskName = String(row[2] || '').trim();
          update = String(row[3] || '').trim();
          
          if (dateCell instanceof Date) {
            date = dateCell.toISOString().slice(0, 10);
          } else if (String(dateCell || '').toLowerCase().includes('today')) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            date = tomorrow.toISOString().slice(0, 10);
          } else {
            date = parseDate(dateCell);
          }
          
          // Extract Task ID from task name
          taskId = extractTaskId(taskName) || '';
          
          // Infer status from update text
          const updateLower = update.toLowerCase();
          if (updateLower.includes('completed') || updateLower.includes('done') || updateLower.includes('finish')) {
            status = 'Done';
          } else if (updateLower.includes('progress') || updateLower.includes('working') || updateLower.includes('wip')) {
            status = 'In Progress';
          } else if (updateLower.includes('waiting') || updateLower.includes('pending') || updateLower.includes('hold')) {
            status = 'Waiting';
          }
          
          // Merged cells: use previous member
          const currentMember = member || lastMember;
          if (member) lastMember = member;
          member = currentMember;
        }
        
        // Skip empty rows
        if (!taskName && !update) continue;
        if (!taskName) taskName = taskId || 'Untitled';
        
        parsed.push({
          rowIndex: i,
          taskId: taskId || null,
          title: taskName,
          status: status,
          assigneeNames: member ? [member] : [],
          dueDate: date || null,
          description: update || taskName,
        });
      }
      
      if (parsed.length === 0) {
        setError('No valid data found in sheet. Expected format: Date, Member, Task ID, Task Name, Status OR Member, Date, Task Name, Update');
        setPreviewData(null);
      } else {
        // Auto-detect Day 2: compare all dates, later dates = Day 2 (focus)
        const allDates = [...new Set(parsed.map(r => r.dueDate).filter(Boolean) as string[])].sort();
        console.log('All dates:', allDates);
        if (allDates.length >= 2) {
          const day1Date = allDates[0]; // earliest date
          parsed.forEach(row => {
            if (row.dueDate && row.dueDate !== day1Date) {
              row.status = 'in_progress';
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

  const normalizeImportedDate = (date: Date): string | null => {
    if (isNaN(date.getTime())) return null;

    const currentYear = new Date().getFullYear();
    if (date.getFullYear() < currentYear - 1) {
      const normalized = new Date(currentYear, date.getMonth(), date.getDate());
      if (!isNaN(normalized.getTime())) {
        return normalized.toISOString().slice(0, 10);
      }
    }

    return date.toISOString().slice(0, 10);
  };

  const parseDate = (dateVal: any): string | null => {
    // Handle Date object (from XLSX cellDates)
    if (dateVal instanceof Date) {
      return normalizeImportedDate(dateVal);
    }
    
    // Handle Excel serial number (number of days since 1899-12-30)
    if (typeof dateVal === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + dateVal * 24 * 60 * 60 * 1000);
      return normalizeImportedDate(date);
    }

    const dateStr = String(dateVal || '').trim();
    if (!dateStr) return null;

    if (/^today$/i.test(dateStr)) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().slice(0, 10);
    }
    
    // Handle DD-MMM format (e.g., "21-Apr", "20-Apr")
    const dddMmmMatch = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})$/);
    if (dddMmmMatch) {
      const day = parseInt(dddMmmMatch[1], 10);
      const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      const monthIndex = monthNames.indexOf(dddMmmMatch[2].toLowerCase());
      if (monthIndex >= 0 && day >= 1 && day <= 31) {
        const year = new Date().getFullYear(); // Use current year
        const date = new Date(year, monthIndex, day);
        const normalized = normalizeImportedDate(date);
        if (normalized) return normalized;
      }
    }
    
    // Try to parse various date formats
    const formats = [
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
          const normalized = normalizeImportedDate(date);
          if (normalized) return normalized;
        } catch {
          // Continue to next format
        }
      }
    }
    
    // Default: try direct parsing
    try {
      const date = new Date(dateStr);
      const normalized = normalizeImportedDate(date);
      if (normalized) return normalized;
    } catch {
      return null;
    }
    
    return null;
  };

  // Extract Task ID from title (e.g., CRCE-2523, CR-109)
  const extractTaskId = (title: string): string | null => {
    const match = title.match(/^([A-Z]{2,6}-\d{2,6})/i);
    return match ? match[1].toUpperCase() : null;
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
              Date, Member, Task ID, Task Name, Status
            </code>
            <code style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
              or: Member, Date, Task Name, Update
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
