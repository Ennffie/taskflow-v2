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
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null);
  const [editEvent, setEditEvent] = useState('');
  const [editCategory, setEditCategory] = useState<LogCategory>('design');
  const [editDate, setEditDate] = useState('');
  const [editTimeSpent, setEditTimeSpent] = useState('');
  const [editFileName, setEditFileName] = useState('');
  const [editNextStatus, setEditNextStatus] = useState<TaskStatus | ''>('');
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

  // For Tomorrow tab: get focus tasks with their latest log content
  const tomorrowData = useMemo(() => {
    const focusTasks = tasks.filter(t => t.is_focus);
    return focusTasks.map(task => {
      // Find latest log for this task
      const taskLogs = logs.filter(l => l.task_id === task.id).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latestLog = taskLogs[0];
      return {
        task,
        latestLog,
        content: latestLog?.event || task.description || ''
      };
    });
  }, [tasks, logs]);

  // Task name lookup map
  const taskMap = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach(task => map.set(task.id, task.title));
    return map;
  }, [tasks]);

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

  const handleEditClick = (log: LogEntry) => {
    setEditingLog(log);
    setEditEvent(log.event);
    setEditCategory(log.category as LogCategory || 'design');
    setEditDate(log.date || new Date().toISOString().slice(0, 10));
    setEditTimeSpent(log.time_spent || '');
    setEditFileName(log.file_name || '');
    // next_status not available in LogEntry type
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingLog) return;
    
    setSaving(true);
    try {
      await updateLog(editingLog.id, {
        event: editEvent.trim(),
        category: editCategory,
        time_spent: editTimeSpent,
        file_name: editFileName,
      });
      
      // Refresh logs
      const updatedLogs = await fetchMyLogs();
      setLogs(updatedLogs);
      
      setShowEditModal(false);
      setEditingLog(null);
      setEditEvent('');
      setEditCategory('design');
      setEditDate('');
      setEditTimeSpent('');
      setEditFileName('');
    } catch (error: any) {
      alert(`Update log failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleLogDelete = async () => {
    if (!editingLog) return;
    setDeletingLog(true);
    try {
      await deleteLog(editingLog.id);
      const updatedLogs = await fetchMyLogs();
      setLogs(updatedLogs);
      setShowEditModal(false);
      setEditingLog(null);
      setEditEvent('');
      setEditCategory('design');
      setEditDate('');
      setEditTimeSpent('');
      setEditFileName('');
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
            {activeTab === 'today' ? (
              <>
                <button onClick={goToPreviousDay} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <ChevronLeft size={18} color="#374151" />
                </button>
                <button onClick={() => setShowDatePicker(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: '2px solid #7c3aed', background: '#fff', cursor: 'pointer', fontSize: '16px', fontWeight: 700 }}>
                  <Calendar size={18} color="#7c3aed" />
                  {formatDate(selectedDate)}
                </button>
                <button onClick={goToNextDay} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <ChevronRight size={18} color="#374151" />
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: '2px solid #7c3aed', background: '#fff', fontSize: '16px', fontWeight: 700, color: '#7c3aed' }}>
                <Calendar size={18} color="#7c3aed" />
                {formatDate(tomorrowDate)}
              </div>
            )}
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
        {showEditModal && editingLog && (
          <div onClick={() => setShowEditModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '24px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '28px', padding: '28px', width: '100%', maxWidth: '600px', maxHeight: '85vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 800 }}>Edit Log</div>
                  <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                    Task: <strong>{taskMap.get(editingLog.task_id) || 'Unknown Task'}</strong>
                  </div>
                </div>
                <button 
                  onClick={handleLogDelete}
                  disabled={deletingLog}
                  style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '50%', 
                    border: 'none', 
                    background: '#fef2f2', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    cursor: deletingLog ? 'not-allowed' : 'pointer',
                    opacity: deletingLog ? 0.6 : 1,
                  }}
                  title="Delete Log"
                >
                  <Trash2 size={20} color="#dc2626" />
                </button>
              </div>

              <div style={{ display: 'grid', gap: '18px' }}>
                {/* Row 1: Date + Category */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                    Date
                    <input 
                      type="date" 
                      value={editDate} 
                      onChange={(e) => setEditDate(e.target.value)} 
                      style={inputStyle} 
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                    Category
                    <select 
                      value={editCategory} 
                      onChange={(e) => setEditCategory(e.target.value as LogCategory)}
                      style={inputStyle}
                    >
                      <option value="design">Design</option>
                      <option value="research">Research</option>
                      <option value="meeting">Meeting</option>
                      <option value="review">Review</option>
                      <option value="development">Development</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                </div>
                
                {/* Row 2: Update */}
                <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                  Update
                  <textarea 
                    value={editEvent} 
                    onChange={(e) => setEditEvent(e.target.value)} 
                    placeholder="What changed, what was decided, and what happens next"
                    style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} 
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                    Time spent
                    <input 
                      value={editTimeSpent} 
                      onChange={(e) => setEditTimeSpent(e.target.value)} 
                      placeholder="e.g. 1.5h"
                      style={inputStyle} 
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>
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
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#374151', margin: 0 }}>{filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} for {formatDate(selectedDate)}</h2>
            {loading ? <div style={panelStyle}>Loading...</div> : filteredLogs.length === 0 ? <div style={{ ...panelStyle, textAlign: 'center', color: '#9ca3af', padding: '40px' }}><p>No log entries for this date.</p></div> : filteredLogs.map((log) => (
              <article 
                key={log.id} 
                onClick={() => handleEditClick(log)}
                style={{ 
                  ...panelStyle, 
                  cursor: 'pointer',
                  transition: 'transform 0.1s ease, box-shadow 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Task Name + Category */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ 
                        fontSize: '14px', 
                        fontWeight: 700, 
                        color: '#111827'
                      }}>
                        {taskMap.get(log.task_id) || 'Unknown Task'}
                      </span>
                      <span style={{ 
                        fontSize: '12px', 
                        fontWeight: 600, 
                        color: '#7c3aed',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        padding: '2px 8px',
                        background: '#ede9fe',
                        borderRadius: '6px'
                      }}>
                        {log.category}
                      </span>
                    </div>
                    <div style={{ fontSize: '15px', color: '#374151', marginTop: '10px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{log.event}</div>
                  </div>
                  <div style={{ textAlign: 'right', color: '#6b7280', fontSize: '13px', whiteSpace: 'nowrap' }}>{formatDateTime(log.created_at)}</div>
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
