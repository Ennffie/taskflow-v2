import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Trash2, Target } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { generateTodayLogs, fetchMyLogs, fetchTasks, createLog, updateTask, updateLog, deleteLog } from '../lib/api';
import { addDays, formatDate, formatDateTime, getReportDate } from '../lib/date';
import type { LogEntry, TaskItem, LogCategory, TaskStatus } from '../types';
import { panelStyle } from './TaskListPage';

export function MyLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'tomorrow'>('today');
  const [selectedDate, setSelectedDate] = useState<string>(getReportDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTaskSelector, setShowTaskSelector] = useState(false);
  const [showDailyLogModal, setShowDailyLogModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null);
  const [nextDayDeleteLog, setNextDayDeleteLog] = useState<LogEntry | null>(null);
  const [editEvent, setEditEvent] = useState('');
  const [editCategory, setEditCategory] = useState<LogCategory>('design');
  const [editTimeSpent, setEditTimeSpent] = useState('');
  const [editFileName, setEditFileName] = useState('');
  const [editNextStatus, setEditNextStatus] = useState<TaskStatus | ''>('');
  const [editNextDayFocus, setEditNextDayFocus] = useState('');
  const [todayWork, setTodayWork] = useState('');
  const [tomorrowWork, setTomorrowWork] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [genSummary, setGenSummary] = useState<{todayCount: number; tomorrowCount: number} | null>(null);

  const handleGenTodayLogs = async () => {
    setGenLoading(true);
    try {
      const draft = await generateTodayLogs();
      setTodayWork(draft.todayWork);
      setTomorrowWork(draft.tomorrowWork);
      const todayCount = draft.todayWork ? draft.todayWork.split('\n').filter(Boolean).length : 0;
      const tomorrowCount = draft.tomorrowWork ? draft.tomorrowWork.split('\n').filter(Boolean).length : 0;
      setGenSummary({ todayCount, tomorrowCount });
      // Auto-select first focus task or first task for the log
      const focusTasks = tasks.filter(t => t.is_focus);
      const targetTask = focusTasks[0] || tasks[0];
      if (targetTask) {
        setSelectedTask(targetTask);
      }
    } catch (error: any) {
      alert(`Generate today's logs failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setGenLoading(false);
    }
  };

  const [saving, setSaving] = useState(false);
  const [deletingLog, setDeletingLog] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchMyLogs().then(setLogs),
      fetchTasks().then(setTasks),
    ]).catch((error) => alert(`Load data failed: ${error.message}`)).finally(() => setLoading(false));
  }, []);

  // Load tasks for selector
  useEffect(() => {
    if (showTaskSelector) {
      fetchTasks().then(setTasks).catch((error) => alert(`Load tasks failed: ${error.message}`));
    }
  }, [showTaskSelector]);

  // Get all dates that have logs
  const datesWithLogs = useMemo(() => {
    const dates = new Set<string>();
    logs.forEach(log => {
      if (log.date) dates.add(log.date);
    });
    return dates;
  }, [logs]);

  // Filter logs for selected date
  const filteredLogs = useMemo(() => {
    return logs.filter(log => log.date === selectedDate);
  }, [logs, selectedDate]);

  // Get tomorrow's date
  const tomorrowDate = useMemo(() => {
    return addDays(selectedDate, 1);
  }, [selectedDate]);

  const taskById = useMemo(() => {
    const map = new Map<string, TaskItem>();
    tasks.forEach(task => map.set(task.id, task));
    return map;
  }, [tasks]);

  // For Next Day tab: prefer the saved next-day list for that calendar day
  const tomorrowData = useMemo(() => {
    const normalizeNextDayContent = (event: string) => event.replace(/^\[Next Day Focus\]\s*/i, '').trim();
    const getRootTask = (taskId: string) => {
      const task = taskById.get(taskId);
      if (!task) return null;
      return task.parent_id ? (taskById.get(task.parent_id) ?? task) : task;
    };

    const savedNextDayLogs = logs
      .filter((log) => log.date === tomorrowDate && /^\[Next Day Focus\]/i.test(log.event.trim()))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const savedMap = new Map<string, { task: TaskItem; content: string; sourceLog: LogEntry }>();
    savedNextDayLogs.forEach((log) => {
      const rootTask = getRootTask(log.task_id);
      if (!rootTask) return;
      savedMap.set(rootTask.id, {
        task: rootTask,
        content: normalizeNextDayContent(log.event),
        sourceLog: log,
      });
    });

    if (savedMap.size > 0) {
      return Array.from(savedMap.values());
    }

    const isViewingToday = selectedDate === getReportDate();
    if (!isViewingToday) {
      return [];
    }

    const focusTasks = tasks.filter(t => t.is_focus);

    const hasRelatedChangeToday = (task: TaskItem) => {
      return logs.some((log) => {
        if (log.date !== selectedDate) return false;
        const relatedTask = taskById.get(log.task_id);
        if (!relatedTask) return log.task_id === task.id;
        return relatedTask.id === task.id || relatedTask.parent_id === task.id;
      });
    };

    return focusTasks.map(task => {
      const taskLogs = logs
        .filter(l => l.task_id === task.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const latestLog = taskLogs[0];
      const shouldShowContinueTomorrow = !task.is_finished || hasRelatedChangeToday(task);

      return {
        task,
        sourceLog: null,
        content: shouldShowContinueTomorrow ? 'Continues tomorrow' : (task.next_day_focus?.trim() || latestLog?.event || task.description || ''),
      };
    });
  }, [tasks, logs, selectedDate, tomorrowDate, taskById]);

  // Task name lookup map
  const taskMap = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach(task => map.set(task.id, task.title));
    return map;
  }, [tasks]);

  const todayLogGroups = useMemo(() => {
    const getRootTaskId = (taskId: string) => {
      const task = taskById.get(taskId);
      if (!task) return taskId;
      return task.parent_id ?? task.id;
    };

    const getMergeKey = (event: string, logId: string) => {
      const normalized = event.trim();
      const fieldMatch = normalized.match(/^([^\n:]+(?:\s[^\n:]+)*?):\s*.+$/);
      if (fieldMatch && normalized.includes('→')) {
        return fieldMatch[1].trim().toLowerCase();
      }
      return `log:${logId}`;
    };

    const grouped = new Map<string, {
      rootTaskId: string;
      title: string;
      latestAt: string;
      lineOrder: string[];
      linesByKey: Map<string, { key: string; text: string; log: LogEntry; createdAt: string }>;
    }>();

    [...filteredLogs]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach((log) => {
        const rootTaskId = getRootTaskId(log.task_id);
        const group = grouped.get(rootTaskId) ?? {
          rootTaskId,
          title: taskMap.get(rootTaskId) || taskMap.get(log.task_id) || 'Unknown Task',
          latestAt: log.created_at,
          lineOrder: [] as string[],
          linesByKey: new Map<string, { key: string; text: string; log: LogEntry; createdAt: string }>(),
        };

        const mergeKey = getMergeKey(log.event, log.id);
        if (group.linesByKey.has(mergeKey)) {
          group.lineOrder = group.lineOrder.filter((key) => key !== mergeKey);
        }
        group.lineOrder.push(mergeKey);
        group.linesByKey.set(mergeKey, {
          key: mergeKey,
          text: log.event,
          log,
          createdAt: log.created_at,
        });
        group.latestAt = log.created_at;
        grouped.set(rootTaskId, group);
      });

    return Array.from(grouped.values())
      .map((group) => ({
        rootTaskId: group.rootTaskId,
        title: group.title,
        latestAt: group.latestAt,
        lines: group.lineOrder.map((key) => group.linesByKey.get(key)).filter(Boolean) as { key: string; text: string; log: LogEntry; createdAt: string }[],
      }))
      .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
  }, [filteredLogs, taskById, taskMap]);

  // Navigation
  const goToPreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().slice(0, 10));
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().slice(0, 10));
  };

  const goToToday = () => {
    setSelectedDate(getReportDate());
  };

  const getRootTask = (taskId: string) => {
    const currentTask = taskById.get(taskId);
    if (!currentTask) return null;
    return currentTask.parent_id ? (taskById.get(currentTask.parent_id) ?? currentTask) : currentTask;
  };

  const shouldHideMyLogLine = (text: string) => {
    const normalized = text.trim();
    return /(?:^|\s)Today Update edited$/i.test(normalized)
      || /(?:^|\s)Next Day Focus edited$/i.test(normalized);
  };

  const formatMyLogLineText = (text: string, rootTaskId: string, lineTaskId: string) => {
    if (rootTaskId !== lineTaskId) return text;

    const rootTitle = taskMap.get(rootTaskId)?.trim();
    if (!rootTitle) return text;

    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const normalized = text.trim();
    const prefixPattern = new RegExp(`^Main Task\\s+${escapeRegExp(rootTitle)}\\s*`, 'i');
    const trimmed = normalized.replace(prefixPattern, '').trim();

    return trimmed || normalized;
  };

  const handleEditClick = (log: LogEntry) => {
    const rootTask = getRootTask(log.task_id);
    setEditingLog(log);
    setNextDayDeleteLog(null);
    setEditingTask(rootTask);
    setEditEvent(log.event);
    setEditCategory(log.category as LogCategory || 'design');
    setEditTimeSpent(log.time_spent || '');
    setEditFileName(log.file_name || '');
    setEditNextDayFocus(rootTask?.next_day_focus?.trim() || '');
    // next_status not available in LogEntry type
    setShowEditModal(true);
  };

  const handleNextDayEditClick = (task: TaskItem) => {
    const rootTask = getRootTask(task.id) ?? task;
    const matchedNextDayLog = logs
      .filter((log) => log.date === tomorrowDate && /^\[Next Day Focus\]/i.test(log.event.trim()))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .find((log) => getRootTask(log.task_id)?.id === rootTask.id) ?? null;

    setEditingLog(null);
    setNextDayDeleteLog(matchedNextDayLog);
    setEditingTask(rootTask);
    setEditEvent(rootTask.today_update?.trim() || '');
    setEditCategory('design');
    setEditTimeSpent('');
    setEditFileName('');
    setEditNextStatus('');
    setEditNextDayFocus(rootTask.next_day_focus?.trim() || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingLog && !editingTask) return;
    
    setSaving(true);
    try {
      if (editingLog) {
        await updateLog(editingLog.id, {
          event: editEvent.trim(),
          category: editCategory,
          time_spent: editTimeSpent,
          file_name: editFileName,
        });
      }

      const rootTask = editingLog ? getRootTask(editingLog.task_id) : editingTask;
      if (rootTask) {
        await updateTask(rootTask.id, {
          today_update: editEvent.trim() || null,
          next_day_focus: editNextDayFocus.trim() || null,
        });
      }
      
      // Refresh logs + tasks
      const [updatedLogs, updatedTasks] = await Promise.all([fetchMyLogs(), fetchTasks()]);
      setLogs(updatedLogs);
      setTasks(updatedTasks);
      
      setShowEditModal(false);
      setEditingLog(null);
      setNextDayDeleteLog(null);
      setEditingTask(null);
      setEditEvent('');
      setEditCategory('design');
      setEditTimeSpent('');
      setEditFileName('');
      setEditNextDayFocus('');
    } catch (error: any) {
      alert(`Update log failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleLogDelete = async () => {
    if (!editingLog && !editingTask) return;
    setDeletingLog(true);
    try {
      if (editingLog) {
        await deleteLog(editingLog.id);
      } else if (editingTask) {
        if (nextDayDeleteLog) {
          await deleteLog(nextDayDeleteLog.id);
        }
        await updateTask(editingTask.id, {
          next_day_focus: null,
          is_focus: false,
        });
      }

      const [updatedLogs, updatedTasks] = await Promise.all([fetchMyLogs(), fetchTasks()]);
      setLogs(updatedLogs);
      setTasks(updatedTasks);
      setShowEditModal(false);
      setEditingLog(null);
      setNextDayDeleteLog(null);
      setEditingTask(null);
      setEditEvent('');
      setEditCategory('design');
      setEditTimeSpent('');
      setEditFileName('');
      setEditNextDayFocus('');
    } catch (error: any) {
      alert(`Delete log failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setDeletingLog(false);
    }
  };

  const handleSelectTask = (task: TaskItem) => {
    setSelectedTask(task);
    setShowTaskSelector(false);
    setShowDailyLogModal(true);
    setTodayWork('');
    setTomorrowWork('');
  };

  // Save daily log
  const handleSaveDailyLog = async () => {
    if (!selectedTask) return;
    
    setSaving(true);
    const today = getReportDate();
    const tomorrow = addDays(today, 1);
    
    try {
      // 1. Create log for today's work
      if (todayWork.trim()) {
        await createLog({
          task_id: selectedTask.id,
          date: today,
          event: `[What I have done]\n${todayWork.trim()}`,
          category: 'other',
          time_spent: '',
          file_name: '',
          next_status: ''
        });
        await updateTask(selectedTask.id, { today_update: todayWork.trim() });
      }

      // 2. Create log for next day focus and mark task as focus
      if (tomorrowWork.trim()) {
        await createLog({
          task_id: selectedTask.id,
          date: tomorrow,
          event: `[Next Day Focus]\n${tomorrowWork.trim()}`,
          category: 'other',
          time_spent: '',
          file_name: '',
          next_status: ''
        });
        await updateTask(selectedTask.id, { is_focus: true });
        await updateTask(selectedTask.id, { next_day_focus: tomorrowWork.trim() });
      }

      // 3. Update task description
      const currentDesc = selectedTask.description || '';
      const todayEntry = todayWork.trim() ? `[${today}] What I have done:\n${todayWork.trim()}` : '';
      const tomorrowEntry = tomorrowWork.trim() ? `[${tomorrow}] Next Day Focus:\n${tomorrowWork.trim()}` : '';
      const newDesc = [currentDesc, todayEntry, tomorrowEntry].filter(Boolean).join('\n\n');
      
      if (todayWork.trim() || tomorrowWork.trim()) {
        await updateTask(selectedTask.id, { description: newDesc.trim() });
      }

      // Refresh
      const updatedLogs = await fetchMyLogs();
      setLogs(updatedLogs);
      
      setShowDailyLogModal(false);
      setSelectedTask(null);
      setTodayWork('');
      setTomorrowWork('');
      
    } catch (error: any) {
      alert(`Save daily log failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  // Calendar
  const generateCalendarDays = () => {
    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days: { date: string; hasLog: boolean; isSelected: boolean; isToday: boolean }[] = [];
    
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ date: '', hasLog: false, isSelected: false, isToday: false });
    }
    
    const today = new Date().toISOString().slice(0, 10);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        date: dateStr,
        hasLog: datesWithLogs.has(dateStr),
        isSelected: dateStr === selectedDate,
        isToday: dateStr === today,
      });
    }
    return days;
  };

  const calendarDays = generateCalendarDays();
  const currentMonthYear = new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Input style matching LogFormModal
  const inputStyle = {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    height: '56px',
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    background: '#fff',
    boxSizing: 'border-box' as const,
  };

  return (
    <AppShell onAddTask={() => setShowTaskSelector(true)}>
      <div style={{ display: 'grid', gap: '18px' }}>
        {/* Header */}
        <section style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#111827' }}>My logs</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowTaskSelector(true)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#111827',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + Daily Log
              </button>
              <button
                onClick={handleGenTodayLogs}
                disabled={genLoading}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#7c3aed',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: genLoading ? 0.6 : 1,
                }}
              >
                {genLoading ? 'Generating...' : "Generate Today's Logs"}
              </button>
            </div>
          </div>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px 0' }}>
            A clean list of updates you have posted across the workspace.
          </p>
          
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              onClick={() => setActiveTab('today')}
              style={{
                flex: 1,
                padding: '12px 20px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'today' ? '#111827' : '#f3f4f6',
                color: activeTab === 'today' ? '#fff' : '#6b7280',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              📋 Today
            </button>
            <button
              onClick={() => setActiveTab('tomorrow')}
              style={{
                flex: 1,
                padding: '12px 20px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'tomorrow' ? '#7c3aed' : '#f3f4f6',
                color: activeTab === 'tomorrow' ? '#fff' : '#6b7280',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              🎯 Next Day
            </button>
          </div>
          
          {/* Date Navigation - show for both tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '12px 16px', background: '#f8fafc', borderRadius: '12px' }}>
            <button onClick={goToPreviousDay} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronLeft size={18} color="#374151" />
            </button>
            {activeTab === 'today' ? (
              <button onClick={() => setShowDatePicker(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: '2px solid #7c3aed', background: '#fff', cursor: 'pointer', fontSize: '16px', fontWeight: 700 }}>
                <Calendar size={18} color="#7c3aed" />
                {formatDate(selectedDate)}
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: '2px solid #7c3aed', background: '#fff', fontSize: '16px', fontWeight: 700, color: '#7c3aed' }}>
                <Calendar size={18} color="#7c3aed" />
                {formatDate(tomorrowDate)}
              </div>
            )}
            <button onClick={goToNextDay} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronRight size={18} color="#374151" />
            </button>
          </div>
          {activeTab === 'today' && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
              <button onClick={goToToday} style={{ fontSize: '12px', fontWeight: 600, color: '#7c3aed', background: 'transparent', border: 'none', cursor: 'pointer' }}>Go to Today</button>
            </div>
          )}
        </section>

        {/* Task Selector */}
        {showTaskSelector && (
          <div onClick={() => setShowTaskSelector(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '24px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '400px', maxHeight: '80vh', overflow: 'auto' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Select Task for Daily Log</div>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>Choose a task to add your daily update:</p>
              <div style={{ display: 'grid', gap: '10px' }}>
                {tasks.map((task) => (
                  <button key={task.id} onClick={() => handleSelectTask(task)} style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', textAlign: 'left', cursor: 'pointer' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>{task.title}</div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>{task.status} • {task.log_count} logs</div>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowTaskSelector(false)} style={{ width: '100%', marginTop: '16px', padding: '12px', borderRadius: '10px', border: 'none', background: '#f3f4f6', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Gen Summary Modal */}
        {genSummary && (
          <div onClick={() => setGenSummary(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '24px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>✨ Logs Generated</div>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>Based on your today's activity</div>
              
              <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
                <div style={{ padding: '14px 16px', background: '#f3e8ff', borderRadius: '12px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#7c3aed' }}>{genSummary.todayCount}</div>
                  <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>Today updates</div>
                </div>
                <div style={{ padding: '14px 16px', background: '#ede9fe', borderRadius: '12px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#6d28d9' }}>{genSummary.tomorrowCount}</div>
                  <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>Next Day Focus</div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gap: '10px' }}>
                <button
                  onClick={() => { setGenSummary(null); setShowDailyLogModal(true); }}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: '#111827', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Review & Edit
                </button>
                <button
                  onClick={async () => {
                    setGenSummary(null);
                    if (!selectedTask) {
                      alert('No task selected. Please try again.');
                      return;
                    }
                    setSaving(true);
                    try {
                      const today = getReportDate();
                      const tomorrow = addDays(today, 1);
                      if (todayWork.trim()) {
                        await createLog({
                          task_id: selectedTask.id,
                          date: today,
                          event: `[What I have done]\n${todayWork.trim()}`,
                          category: 'other',
                          time_spent: '',
                          file_name: '',
                          next_status: ''
                        });
                        await updateTask(selectedTask.id, { today_update: todayWork.trim() });
                      }
                      if (tomorrowWork.trim()) {
                        await createLog({
                          task_id: selectedTask.id,
                          date: tomorrow,
                          event: `[Next Day Focus]\n${tomorrowWork.trim()}`,
                          category: 'other',
                          time_spent: '',
                          file_name: '',
                          next_status: ''
                        });
                        await updateTask(selectedTask.id, { is_focus: true });
                        await updateTask(selectedTask.id, { next_day_focus: tomorrowWork.trim() });
                      }
                      const updatedLogs = await fetchMyLogs();
                      setLogs(updatedLogs);
                      setTodayWork('');
                      setTomorrowWork('');
                      setSelectedTask(null);
                      alert('Logs saved successfully!');
                    } catch (error: any) {
                      alert(`Save failed: ${error?.message || 'Unknown error'}`);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', color: '#111827', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Saving...' : 'Save Directly'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Daily Log Modal */}
        {showDailyLogModal && selectedTask && (
          <div onClick={() => setShowDailyLogModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '24px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '28px', padding: '28px', width: '100%', maxWidth: '600px', maxHeight: '85vh', overflow: 'auto' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>Daily Log</div>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>Task: <strong>{selectedTask.title}</strong></p>

              <div style={{ display: 'grid', gap: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>What I have done today:</label>
                  <textarea value={todayWork} onChange={(e) => setTodayWork(e.target.value)} placeholder={`Example:\n- Completed Login page design\n- Reviewed PR #123`} style={{ width: '100%', minHeight: '120px', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', resize: 'vertical' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Next Day Focus:</label>
                  <textarea value={tomorrowWork} onChange={(e) => setTomorrowWork(e.target.value)} placeholder={`Example:\n- Start on Dashboard\n- Client meeting at 2pm`} style={{ width: '100%', minHeight: '120px', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', resize: 'vertical' }} />
                  <p style={{ fontSize: '12px', color: '#7c3aed', marginTop: '6px' }}>💡 Next Day Focus 會自動將呢個 task 標記做 Focus</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button onClick={() => setShowDailyLogModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600 }}>Cancel</button>
                <button onClick={handleSaveDailyLog} disabled={saving || (!todayWork.trim() && !tomorrowWork.trim())} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#111827', color: '#fff', fontWeight: 600, opacity: (saving || (!todayWork.trim() && !tomorrowWork.trim())) ? 0.6 : 1 }}>
                  {saving ? 'Saving...' : 'Save Daily Log'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Date Picker */}
        {showDatePicker && (
          <div onClick={() => setShowDatePicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '24px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '340px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <button onClick={() => { const d = new Date(selectedDate); d.setMonth(d.getMonth() - 1); setSelectedDate(d.toISOString().slice(0, 10)); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><ChevronLeft size={20} /></button>
                <span style={{ fontSize: '16px', fontWeight: 700 }}>{currentMonthYear}</span>
                <button onClick={() => { const d = new Date(selectedDate); d.setMonth(d.getMonth() + 1); setSelectedDate(d.toISOString().slice(0, 10)); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><ChevronRight size={20} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <div key={day} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#9ca3af', padding: '8px 0' }}>{day}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {calendarDays.map((day, idx) => (
                  <button key={idx} disabled={!day.date} onClick={() => { if (day.date) { setSelectedDate(day.date); setShowDatePicker(false); } }} style={{ aspectRatio: '1', borderRadius: '10px', border: 'none', background: day.isSelected ? '#7c3aed' : day.isToday ? '#ede9fe' : 'transparent', cursor: day.date ? 'pointer' : 'default', position: 'relative', fontSize: '14px', fontWeight: day.isSelected || day.isToday ? 700 : 500, color: day.isSelected ? '#fff' : day.isToday ? '#7c3aed' : day.date ? '#374151' : 'transparent' }}>
                    {day.date ? new Date(day.date).getDate() : ''}
                    {day.hasLog && !day.isSelected && <div style={{ position: 'absolute', bottom: '4px', width: '4px', height: '4px', borderRadius: '50%', background: '#7c3aed' }} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Edit Log Modal - Updated to match LogFormModal */}
        {showEditModal && (editingLog || editingTask) && (
          <div onClick={() => { setShowEditModal(false); setEditingLog(null); setNextDayDeleteLog(null); setEditingTask(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '24px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '28px', padding: '28px', width: '100%', maxWidth: '600px', maxHeight: '85vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 800 }}>Edit Log</div>
                  <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                    Task: <strong>{editingTask?.title || (editingLog ? (taskMap.get(editingLog.task_id) || 'Unknown Task') : 'Unknown Task')}</strong>
                  </div>
                </div>
                <button 
                  onClick={handleLogDelete}
                  disabled={deletingLog || (!editingLog && !editingTask)}
                  style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '50%', 
                    border: 'none', 
                    background: '#fef2f2', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    cursor: (deletingLog || (!editingLog && !editingTask)) ? 'not-allowed' : 'pointer',
                    opacity: (deletingLog || (!editingLog && !editingTask)) ? 0.35 : 1,
                  }}
                  title="Delete Log"
                >
                  <Trash2 size={20} color="#dc2626" />
                </button>
              </div>

              <div style={{ display: 'grid', gap: '18px' }}>
                {/* Row 1: Today's Update */}
                <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                  Today’s Update
                  <textarea 
                    value={editEvent} 
                    onChange={(e) => setEditEvent(e.target.value)} 
                    placeholder="What I have done today"
                    style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', height: 'auto' }} 
                  />
                </label>

                <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                  Next Day Focus
                  <textarea 
                    value={editNextDayFocus}
                    onChange={(e) => setEditNextDayFocus(e.target.value)}
                    placeholder="What to focus on next day"
                    style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', height: 'auto' }} 
                  />
                </label>
                
                {/* Row 3: File name */}
                <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                  File name
                  <input 
                    value={editFileName} 
                    onChange={(e) => setEditFileName(e.target.value)} 
                    placeholder="Optional"
                    style={inputStyle} 
                  />
                </label>
                
                {/* Row 4: Time spent + Next status */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '14px' }}>
                  <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151', minWidth: 0 }}>
                    Time spent
                    <input 
                      value={editTimeSpent} 
                      onChange={(e) => setEditTimeSpent(e.target.value)} 
                      placeholder="e.g. 1.5h"
                      style={inputStyle} 
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151', minWidth: 0 }}>
                    Status
                    <select 
                      value={editNextStatus} 
                      onChange={(e) => setEditNextStatus(e.target.value as TaskStatus | '')}
                      style={inputStyle}
                    >
                      <option value="">No change</option>
                      <option value="todo">Todo</option>
                      <option value="planning">Planning</option>
                      <option value="in_progress">In Progress</option>
                      <option value="internal_review">Internal Review</option>
                      <option value="round_1_wip">Round 1 WIP</option>
                      <option value="round_1_review">Round 1 Review</option>
                      <option value="round_2_wip">Round 2 WIP</option>
                      <option value="round_2_review">Round 2 Review</option>
                      <option value="round_3_wip">Round 3 WIP</option>
                      <option value="round_3_review">Round 3 Review</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button 
                  onClick={() => setShowEditModal(false)} 
                  style={{ 
                    flex: 1, 
                    padding: '14px', 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0', 
                    background: '#fff', 
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEdit} 
                  disabled={saving || !editEvent.trim()} 
                  style={{ 
                    flex: 1, 
                    padding: '14px', 
                    borderRadius: '12px', 
                    border: 'none', 
                    background: '#111827', 
                    color: '#fff', 
                    fontWeight: 600, 
                    opacity: (saving || !editEvent.trim()) ? 0.6 : 1,
                    cursor: (saving || !editEvent.trim()) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logs List - Today Tab */}
        {activeTab === 'today' && (
          <section style={{ display: 'grid', gap: '14px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#374151', margin: 0 }}>{todayLogGroups.filter((group) => group.lines.some((line) => !shouldHideMyLogLine(line.text))).length} main task log{todayLogGroups.filter((group) => group.lines.some((line) => !shouldHideMyLogLine(line.text))).length !== 1 ? 's' : ''} for {formatDate(selectedDate)}</h2>
            {loading ? <div style={panelStyle}>Loading...</div> : todayLogGroups.filter((group) => group.lines.some((line) => !shouldHideMyLogLine(line.text))).length === 0 ? <div style={{ ...panelStyle, textAlign: 'center', color: '#9ca3af', padding: '40px' }}><p>No log entries for this date.</p></div> : todayLogGroups.filter((group) => group.lines.some((line) => !shouldHideMyLogLine(line.text))).map((group) => (
              <article 
                key={group.rootTaskId}
                style={{ 
                  ...panelStyle,
                  display: 'grid',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '10px 16px', alignItems: 'start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                        {group.title}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '2px 8px', background: '#ede9fe', borderRadius: '6px' }}>
                        My Log
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', color: '#6b7280', fontSize: '13px', whiteSpace: 'nowrap' }}>{formatDateTime(group.latestAt)}</div>
                </div>

                <div style={{ display: 'grid', gap: '10px' }}>
                  {group.lines.filter((line) => !shouldHideMyLogLine(line.text)).map((line, index) => (
                    <button
                      key={line.key}
                      onClick={() => handleEditClick(line.log)}
                      style={{
                        border: 'none',
                        background: index % 2 === 0 ? '#f8fafc' : '#fff',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '8px 12px', alignItems: 'start' }}>
                        <div style={{ fontSize: '15px', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{formatMyLogLineText(line.text, group.rootTaskId, line.log.task_id)}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{formatDateTime(line.createdAt).split(' ').slice(-1)[0]}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </section>
        )}

        {/* Tomorrow Tasks Tab */}
        {activeTab === 'tomorrow' && (
          <section style={{ display: 'grid', gap: '14px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#374151', margin: 0 }}>
              <Target size={16} style={{ display: 'inline', marginRight: '8px', color: '#7c3aed' }} />
              {tomorrowData.length} task{tomorrowData.length !== 1 ? 's' : ''} for tomorrow
            </h2>
            {loading ? <div style={panelStyle}>Loading...</div> : tomorrowData.length === 0 ? (
              <div style={{ ...panelStyle, textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
                <p>No tasks planned for tomorrow.</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>Import tomorrow's tasks to see them here.</p>
              </div>
            ) : tomorrowData.map(({ task, content }) => (
              <article 
                key={task.id}
                style={{ 
                  ...panelStyle,
                  borderLeft: '4px solid #7c3aed',
                  background: '#faf5ff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Task Name */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                          {task.title}
                        </span>
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: 600,
                          color: '#7c3aed',
                          background: '#ede9fe',
                          padding: '2px 8px',
                          borderRadius: '6px'
                        }}>
                          Focus
                        </span>
                      </div>
                      <button
                        onClick={() => handleNextDayEditClick(task)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid #d8b4fe',
                          background: '#fff',
                          color: '#7c3aed',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        Edit
                      </button>
                    </div>
                    {/* Log Content / Description */}
                    {content && (
                      <div style={{ fontSize: '15px', color: '#374151', marginTop: '10px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {content}
                      </div>
                    )}
                    {/* Assignees */}
                    {task.assignees.length > 0 && (
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                        {task.assignees.map(a => a.name).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
