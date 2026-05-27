import { useEffect, useMemo, useState } from 'react';
import { Plus, Calendar, Users, Tag, MoreVertical, Pencil, Trash2, User, FileText, GitBranch } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { BackButton } from '../components/BackButton';
import { LogFormModal } from '../components/LogFormModal';
import { fetchLogs, fetchTask, deleteTask, updateLog, deleteLog, fetchSubtasks, updateTask } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/date';
import { useAuth } from '../contexts/AuthContext';
import { PRIORITY_META, getStatusMeta, FOCUS_META, type LogEntry, type TaskItem, type LogCategory, type TaskStatus } from '../types';
import { panelStyle } from './TaskListPage';
import { TaskFormModal } from '../components/TaskFormModal';
import { TaskCard } from '../components/TaskCard';

function parseStructuredDescription(description: string | null | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!description) return result;
  description.split('\n').forEach((line) => {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (!match) return;
    result[match[1].trim()] = match[2].trim();
  });
  return result;
}

function getTagValue(tags: string[], prefix: string): string | null {
  const match = tags.find((tag) => tag.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function getTagValues(tags: string[], prefix: string): string[] {
  return tags.filter((tag) => tag.startsWith(prefix)).map((tag) => tag.slice(prefix.length));
}

function getEffectiveRound(task: { round_number?: number | null; status?: TaskStatus | null }): number {
  const explicitRound = task.round_number && task.round_number >= 1 ? task.round_number : 1;
  const status = task.status ?? 'todo';
  const statusRound = status.startsWith('round_3_') ? 3 : status.startsWith('round_2_') ? 2 : 1;
  return Math.max(explicitRound, statusRound);
}

export function LogBookPage() {
  const { taskId = '' } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [progressSaving, setProgressSaving] = useState(false);
  const [task, setTask] = useState<TaskItem | null>(null);
  const [draftTaskProgress, setDraftTaskProgress] = useState(0);
  const [draftSubtaskProgress, setDraftSubtaskProgress] = useState<Record<string, number>>({});
  const [progressStatus, setProgressStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [subtasks, setSubtasks] = useState<TaskItem[]>([]);
  const [showSubtaskModal, setShowSubtaskModal] = useState(false);
  const [parentTask, setParentTask] = useState<TaskItem | null>(null);
  
  const [deleting, setDeleting] = useState(false);

  // Log Edit state
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null);
  const [showLogEditModal, setShowLogEditModal] = useState(false);
  const [editLogEvent, setEditLogEvent] = useState('');
  const [editLogCategory, setEditLogCategory] = useState<LogCategory>('design');
  const [editLogTimeSpent, setEditLogTimeSpent] = useState('');
  const [editLogFileName, setEditLogFileName] = useState('');
  const [savingLog, setSavingLog] = useState(false);
  const [deletingLog, setDeletingLog] = useState(false);

  const loadData = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const [nextTask, nextLogs] = await Promise.all([
        fetchTask(taskId), 
        fetchLogs(taskId)
      ]);
      setTask(nextTask);
      setDraftTaskProgress(nextTask?.progress_percent ?? 0);
      setLogs(nextLogs);
      const nextSubtasks = nextTask ? await fetchSubtasks(nextTask.id) : [];
      setSubtasks(nextSubtasks);
      setDraftSubtaskProgress(Object.fromEntries(nextSubtasks.map((subtask) => [subtask.id, subtask.is_finished ? 100 : (subtask.progress_percent ?? 0)])));
      setParentTask(nextTask?.parent_id ? await fetchTask(nextTask.parent_id) : null);
    } catch (error: any) {
      alert(`Load log book failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, [taskId]);

  const canEditTask = useMemo(() => {
    if (!profile || !task) return false;
    if (profile.role === 'admin') return true;
    return task.assignees.some(a => a.id === profile.id);
  }, [profile, task]);

  const canEditSubtask = (subtask: TaskItem): boolean => {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    return subtask.assignees.some(a => a.id === profile.id);
  };

  const derivedParentState = useMemo(() => {
    if (!task || task.parent_id || subtasks.length === 0) {
      return {
        progress: task?.is_finished ? 100 : (task?.progress_percent ?? 0),
        isFinished: task?.is_finished ?? false,
      };
    }

    const getItemProgress = (item: TaskItem) => item.is_finished ? 100 : (item.progress_percent ?? 0);
    const grouped = new Map<number, TaskItem[]>();

    subtasks.forEach((subtask) => {
      const round = getEffectiveRound(subtask);
      grouped.set(round, [...(grouped.get(round) ?? []), subtask]);
    });

    const avg = (items: TaskItem[]) => items.length ? items.reduce((sum, item) => sum + getItemProgress(item), 0) / items.length : 0;
    const round1 = grouped.get(1) ?? [];
    const round2 = grouped.get(2) ?? [];
    const round3 = grouped.get(3) ?? [];

    let progress = 0;
    if (round1.length > 0) progress = Math.max(progress, Math.round((avg(round1) / 100) * 70));
    if (round2.length > 0) progress = Math.max(progress, 70 + Math.round((avg(round2) / 100) * 10));
    if (round3.length > 0) progress = Math.max(progress, 80 + Math.round((avg(round3) / 100) * 10));

    const calculatedProgress = Math.min(100, progress);
    return {
      progress: task.is_finished && calculatedProgress >= 90 ? 100 : calculatedProgress,
      isFinished: (task.is_finished ?? false) && calculatedProgress >= 90,
    };
  }, [task, subtasks]);

  const canFinishParentTask = !task?.parent_id && (subtasks.length === 0 ? true : derivedParentState.progress >= 90);
  const canManuallyEditMainTaskProgress = !task?.parent_id && subtasks.length === 0 && canEditTask && !derivedParentState.isFinished;

  const saveTaskProgress = async (nextProgress: number, nextFinished?: boolean) => {
    if (!task || !canEditTask) return;
    setProgressSaving(true);
    setProgressStatus('saving');
    try {
      await updateTask(task.id, {
        progress_percent: nextFinished ? 100 : nextProgress,
        is_finished: nextFinished ?? false,
        status: nextFinished ? 'finished' : (task.status === 'finished' ? 'in_progress' : task.status),
      });
      const [nextTask, nextLogs] = await Promise.all([
        fetchTask(task.id),
        fetchLogs(task.parent_id ?? task.id),
      ]);
      if (nextTask) {
        setTask(nextTask);
        setDraftTaskProgress(nextTask.progress_percent ?? 0);
      }
      setLogs(nextLogs);
      setProgressStatus('saved');
      setTimeout(() => setProgressStatus('idle'), 1200);
    } catch (error: any) {
      alert(`Update progress failed: ${error?.message || 'Unknown error'}`);
      setProgressStatus('idle');
    } finally {
      setProgressSaving(false);
    }
  };

  const saveSubtaskProgress = async (subtask: TaskItem, nextProgress: number) => {
    if (!canEditSubtask(subtask)) return;
    setProgressSaving(true);
    setProgressStatus('saving');
    try {
      await updateTask(subtask.id, {
        progress_percent: nextProgress,
        is_finished: nextProgress >= 100,
        status: nextProgress >= 100 ? 'finished' : (subtask.status === 'finished' ? 'in_progress' : subtask.status),
      });
      const rootTaskId = subtask.parent_id ?? task?.id ?? subtask.id;
      const [nextSubtasks, nextTask, nextLogs] = await Promise.all([
        fetchSubtasks(rootTaskId),
        fetchTask(rootTaskId),
        fetchLogs(rootTaskId),
      ]);
      setSubtasks(nextSubtasks);
      setDraftSubtaskProgress(Object.fromEntries(nextSubtasks.map((item) => [item.id, item.is_finished ? 100 : (item.progress_percent ?? 0)])));
      if (nextTask) {
        setTask(nextTask);
        setDraftTaskProgress(nextTask.progress_percent ?? 0);
      }
      setLogs(nextLogs);
      setProgressStatus('saved');
      setTimeout(() => setProgressStatus('idle'), 1200);
    } catch (error: any) {
      alert(`Update sub-task progress failed: ${error?.message || 'Unknown error'}`);
      setProgressStatus('idle');
    } finally {
      setProgressSaving(false);
    }
  };

  // Check if user can edit a log
  const canEditLog = (log: LogEntry): boolean => {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    return log.created_by === profile.id;
  };

  const handleEditClick = () => {
    if (!task) return;
    setShowMenu(false);
    setShowEditModal(true);
  };

  const handleDelete = async () => {
    if (!task) return;
    setDeleting(true);
    try {
      await deleteTask(task.id);
      navigate('/');
    } catch (error: any) {
      alert(`Delete task failed: ${error?.message || 'Unknown error'}`);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleLogEditClick = (log: LogEntry) => {
    if (!canEditLog(log)) return;
    setEditingLog(log);
    setEditLogEvent(log.event);
    setEditLogCategory(log.category as LogCategory || 'design');
    setEditLogTimeSpent(log.time_spent || '');
    setEditLogFileName(log.file_name || '');
    setShowLogEditModal(true);
  };

  const handleLogSaveEdit = async () => {
    if (!editingLog) return;
    setSavingLog(true);
    try {
      await updateLog(editingLog.id, {
        event: editLogEvent.trim(),
        category: editLogCategory,
        time_spent: editLogTimeSpent,
        file_name: editLogFileName,
      });
      await loadData();
      setShowLogEditModal(false);
      setEditingLog(null);
      setEditLogEvent('');
      setEditLogCategory('design');
      setEditLogTimeSpent('');
      setEditLogFileName('');
    } catch (error: any) {
      alert(`Update log failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setSavingLog(false);
    }
  };

  const handleLogDelete = async () => {
    if (!editingLog) return;
    setDeletingLog(true);
    try {
      await deleteLog(editingLog.id);
      await loadData();
      setShowLogEditModal(false);
      setEditingLog(null);
      setEditLogEvent('');
      setEditLogCategory('design');
      setEditLogTimeSpent('');
      setEditLogFileName('');
    } catch (error: any) {
      alert(`Delete log failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setDeletingLog(false);
    }
  };

  // Helper functions for file name display
  const isValidUrl = (str: string): boolean => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  const getDisplayUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      // Return pathname for cleaner display, or full URL if pathname is just "/"
      const pathname = urlObj.pathname;
      if (pathname && pathname !== '/') {
        // Decode URL-encoded characters
        return decodeURIComponent(pathname.split('/').pop() || url);
      }
      return url;
    } catch {
      return url;
    }
  };

  if (loading) {
    return <AppShell><div style={panelStyle}>Loading log book...</div></AppShell>;
  }

  if (!task) {
    return <AppShell><div style={panelStyle}>Task not found.</div></AppShell>;
  }

  const effectiveStatusKey = (!task.parent_id && subtasks.length === 0 && derivedParentState.isFinished)
    ? 'finished'
    : task.status;
  const status = getStatusMeta(effectiveStatusKey);
  const priority = PRIORITY_META[task.priority];
  const structuredDescription = useMemo(() => parseStructuredDescription(task.description), [task.description]);
  const crceRole = getTagValue(task.tags, 'role:');
  const crcePortal = getTagValue(task.tags, 'portal:');
  const crcePortalOther = getTagValue(task.tags, 'portal-other:');
  const crceCopywriting = getTagValue(task.tags, 'copywriting:');
  const crceFeatures = getTagValues(task.tags, 'feature:');
  const crceFeatureOther = getTagValue(task.tags, 'feature-other:');
  const hasCrceDetails = Boolean(
    crceRole ||
    crcePortal ||
    crceCopywriting ||
    crceFeatures.length ||
    structuredDescription['Today update'] ||
    structuredDescription['Requestor'] ||
    structuredDescription['Received on'] ||
    structuredDescription['Requirement received'] ||
    structuredDescription['DEV start'] ||
    structuredDescription['Target CM completion'] ||
    structuredDescription['Target draft 1'] ||
    structuredDescription['Target draft 2'] ||
    structuredDescription['Target draft 3'] ||
    structuredDescription['Copywriting ready']
  );

  const inputStyle = {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    background: '#fff',
    boxSizing: 'border-box' as const,
  };

  return (
    <AppShell>
      <div style={{ display: 'grid', gap: '16px' }}>
        <BackButton to="/" label="Back to tasks" />

        {parentTask && (
          <div style={{ padding: '12px 14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569' }}>
            This is a sub-task under{' '}
            <button
              onClick={() => navigate(`/tasks/${parentTask.id}`)}
              style={{ border: 'none', background: 'transparent', padding: 0, color: '#7c3aed', fontWeight: 700, cursor: 'pointer' }}
            >
              {parentTask.title}
            </button>
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '16px 20px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
            <button onClick={() => setShowMenu(!showMenu)} style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: '#f3f4f6', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Task Options">
              <MoreVertical size={20} />
            </button>
            {showMenu && (
              <div style={{ position: 'absolute', top: '48px', right: 0, background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', minWidth: '160px', zIndex: 100, overflow: 'hidden' }}>
                <button onClick={handleEditClick} style={{ width: '100%', padding: '12px 16px', border: 'none', background: '#fff', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#374151' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
                  <Pencil size={16} color="#6b7280" /> Edit Task
                </button>
                <div style={{ height: '1px', background: '#e2e8f0' }} />
                <button onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }} style={{ width: '100%', padding: '12px 16px', border: 'none', background: '#fff', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#dc2626' }} onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'} onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
                  <Trash2 size={16} color="#dc2626" /> Delete Task
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', paddingRight: '50px' }}>
            {task.parent_id && (
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#fff', background: '#7c3aed', padding: '6px 10px', borderRadius: '999px', letterSpacing: '0.3px' }}>
                SUB-TASK
              </span>
            )}
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 }}>{task.title}</h1>
            <span style={{ fontSize: '12px', fontWeight: 700, color: derivedParentState.isFinished ? '#10b981' : '#7c3aed', background: derivedParentState.isFinished ? '#ecfdf5' : '#f3e8ff', padding: '4px 8px', borderRadius: '999px' }}>
              {derivedParentState.isFinished ? '100% Finished' : `${derivedParentState.progress}%`}
            </span>
            {!task.parent_id && <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', background: '#f8fafc', padding: '4px 8px', borderRadius: '999px' }}>Round {getEffectiveRound(task)}</span>}
            <div style={{ display: 'flex', gap: '6px' }}>
              {task.is_focus && <Badge bg={FOCUS_META.bg} color={FOCUS_META.color} text={FOCUS_META.label} />}
              <Badge bg={status.bg} color={status.color} text={status.label} />
              <Badge bg={priority.bg} color={priority.color} text={priority.label} />
            </div>
          </div>

          <div style={{ display: 'grid', gap: '14px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>Progress</div>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#6d28d9', background: '#ede9fe', padding: '6px 10px', borderRadius: '999px', minWidth: '52px', textAlign: 'center' }}>
                    {task.parent_id ? draftTaskProgress : (canManuallyEditMainTaskProgress ? draftTaskProgress : derivedParentState.progress)}%
                  </span>
                  {progressStatus !== 'idle' && (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: progressStatus === 'saving' ? '#6d28d9' : '#047857' }}>
                      {progressStatus === 'saving' ? 'Saving...' : 'Saved'}
                    </span>
                  )}
                </div>
                {canEditTask && !task.parent_id && !derivedParentState.isFinished && (
                  <button
                    onClick={() => void saveTaskProgress(100, true)}
                    disabled={progressSaving || !canFinishParentTask}
                    title={canFinishParentTask ? 'Mark main task as finished' : 'Finish is available only after all sub-tasks reach 100%'}
                    style={{ border: 'none', background: canFinishParentTask ? '#111827' : '#cbd5e1', color: '#fff', borderRadius: '999px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: progressSaving || !canFinishParentTask ? 'not-allowed' : 'pointer', opacity: progressSaving ? 0.6 : 1 }}
                  >
                    Finish
                  </button>
                )}
              </div>
              {task.parent_id ? (
                canEditTask ? (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <input
                      className="progress-range"
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={draftTaskProgress}
                      onInput={(e) => setDraftTaskProgress(Number((e.target as HTMLInputElement).value))}
                      onChange={(e) => setDraftTaskProgress(Number(e.target.value))}
                      onMouseUp={() => void saveTaskProgress(draftTaskProgress, draftTaskProgress >= 100)}
                      onTouchEnd={() => void saveTaskProgress(draftTaskProgress, draftTaskProgress >= 100)}
                      style={{ width: '100%' }}
                    />
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Sub-task progress can be edited here.</div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Progress is editable by this sub-task assignee or admin only.</div>
                )
              ) : canManuallyEditMainTaskProgress ? (
                <div style={{ display: 'grid', gap: '8px' }}>
                  <input
                    className="progress-range"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={draftTaskProgress}
                    onInput={(e) => setDraftTaskProgress(Number((e.target as HTMLInputElement).value))}
                    onChange={(e) => setDraftTaskProgress(Number(e.target.value))}
                    onMouseUp={() => void saveTaskProgress(draftTaskProgress, draftTaskProgress >= 100)}
                    onTouchEnd={() => void saveTaskProgress(draftTaskProgress, draftTaskProgress >= 100)}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>No sub-task yet — drag to update main task progress directly.</div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>{subtasks.length > 0 ? (canFinishParentTask ? 'Parent progress is calculated from sub-tasks and rounds. You can finish this main task now.' : 'Parent progress is calculated from sub-tasks and rounds. Finish unlocks only at the final round.') : 'Main task progress can be updated if you are assigned to this task.'}</div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={14} color="#7c3aed" />
              <div>
                <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Due</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{formatDate(task.due_date) || 'Not set'}</div>
              </div>
            </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={14} color="#7c3aed" />
              <div>
                <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Assignees</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{task.assignees.length ? task.assignees.map(a => a.name.split(' ')[0]).join(', ') : 'Unassigned'}</div>
              </div>
            </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag size={14} color="#7c3aed" />
              <div>
                <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Tags</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{task.tags.length ? task.tags.slice(0, 2).join(', ') + (task.tags.length > 2 ? ` +${task.tags.length - 2}` : '') : 'None'}</div>
              </div>
              </div>
            </div>

            {hasCrceDetails && (
              <div style={{ display: 'grid', gap: '10px', padding: '14px', borderRadius: '12px', background: '#fafafa', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  CRCE Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  {crceRole && <MetaItem label="Role" value={crceRole} />}
                  {crcePortal && <MetaItem label="Portal" value={crcePortalOther ? `${crcePortal} (${crcePortalOther})` : crcePortal} />}
                  {crceCopywriting && <MetaItem label="Copywriting" value={crceCopywriting} />}
                  {structuredDescription['Requestor'] && <MetaItem label="Requestor" value={structuredDescription['Requestor']} />}
                  {structuredDescription['Received on'] && <MetaItem label="Received on" value={structuredDescription['Received on']} />}
                  {structuredDescription['Requirement received'] && <MetaItem label="Requirement received" value={structuredDescription['Requirement received']} />}
                  {structuredDescription['DEV start'] && <MetaItem label="DEV start" value={structuredDescription['DEV start']} />}
                  {structuredDescription['Target CM completion'] && <MetaItem label="Target CM completion" value={structuredDescription['Target CM completion']} />}
                  {structuredDescription['Target draft 1'] && <MetaItem label="Target draft 1" value={structuredDescription['Target draft 1']} />}
                  {structuredDescription['Target draft 2'] && <MetaItem label="Target draft 2" value={structuredDescription['Target draft 2']} />}
                  {structuredDescription['Target draft 3'] && <MetaItem label="Target draft 3" value={structuredDescription['Target draft 3']} />}
                  {structuredDescription['Copywriting ready'] && <MetaItem label="Copywriting ready" value={structuredDescription['Copywriting ready']} />}
                </div>
                {(crceFeatures.length > 0 || crceFeatureOther) && (
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 700 }}>Features</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {crceFeatures.map((feature) => (
                        <span key={feature} style={{ fontSize: '12px', fontWeight: 700, color: '#475569', background: '#eef2ff', padding: '6px 10px', borderRadius: '999px' }}>
                          {feature}
                        </span>
                      ))}
                      {crceFeatureOther && (
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '6px 10px', borderRadius: '999px' }}>
                          Other: {crceFeatureOther}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {structuredDescription['Today update'] && (
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 700 }}>Today&apos;s update</div>
                    <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#111827', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px' }}>
                      {structuredDescription['Today update']}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {!task.parent_id && (
            <>
              <div style={{ height: '1px', background: '#e2e8f0', margin: '18px -20px 0' }} />
              <div style={{ display: 'grid', gap: '12px', paddingTop: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#374151', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GitBranch size={16} color="#7c3aed" />
                    {subtasks.length === 0 ? 'No Sub-task' : subtasks.length === 1 ? '1 Sub-task' : `${subtasks.length} Sub-tasks`}
                  </h2>
                  <button onClick={() => setShowSubtaskModal(true)} style={{ borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#374151', padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>
                    + Add sub-task
                  </button>
                </div>

                {subtasks.length === 0 ? (
                  <div style={{ padding: '20px', borderRadius: '12px', background: '#f8fafc', color: '#64748b', fontSize: '14px', textAlign: 'center' }}>
                    No sub-tasks yet. Break this task into smaller actions when it helps execution.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {[1, 2, 3].filter((round) => subtasks.some(st => getEffectiveRound(st) === round)).map((round) => (
                      <div key={round} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 700, color: '#475569' }}>Round {round}</div>
                        {subtasks.filter(st => getEffectiveRound(st) === round).map((subtask, index) => (
                          <div key={subtask.id} style={{ borderTop: index === 0 ? 'none' : '1px solid #f1f5f9' }}>
                            <TaskCard task={subtask} showAssignees={true} isEvenIndex={index % 2 === 0} />
                            <div style={{ padding: '0 18px 14px 66px' }}>
                              {canEditSubtask(subtask) ? (
                                <div style={{ display: 'grid', gap: '6px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Progress</span>
                                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#6d28d9', background: '#ede9fe', padding: '4px 8px', borderRadius: '999px', minWidth: '48px', textAlign: 'center' }}>
                                      {draftSubtaskProgress[subtask.id] ?? (subtask.is_finished ? 100 : (subtask.progress_percent ?? 0))}%
                                    </span>
                                  </div>
                                  <input
                                    className="progress-range"
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={draftSubtaskProgress[subtask.id] ?? (subtask.is_finished ? 100 : (subtask.progress_percent ?? 0))}
                                    onInput={(e) => setDraftSubtaskProgress((prev) => ({ ...prev, [subtask.id]: Number((e.target as HTMLInputElement).value) }))}
                                    onChange={(e) => setDraftSubtaskProgress((prev) => ({ ...prev, [subtask.id]: Number(e.target.value) }))}
                                    onMouseUp={() => void saveSubtaskProgress(subtask, draftSubtaskProgress[subtask.id] ?? (subtask.is_finished ? 100 : (subtask.progress_percent ?? 0)))}
                                    onTouchEnd={() => void saveSubtaskProgress(subtask, draftSubtaskProgress[subtask.id] ?? (subtask.is_finished ? 100 : (subtask.progress_percent ?? 0)))}
                                    style={{ width: '100%' }}
                                  />
                                  <div style={{ fontSize: '11px', color: progressStatus === 'saving' ? '#6d28d9' : progressStatus === 'saved' ? '#047857' : '#64748b', fontWeight: progressStatus === 'idle' ? 600 : 700 }}>{progressStatus === 'saving' ? 'Saving...' : progressStatus === 'saved' ? 'Saved' : (subtask.is_finished ? 'Finished' : 'Drag to update progress')}</div>
                                </div>
                              ) : (
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Only assigned member or admin can edit this sub-task progress.</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <button onClick={() => setShowModal(true)} style={{ width: '100%', borderRadius: '12px', border: 'none', background: '#111827', color: '#fff', padding: '14px 20px', fontWeight: 600, fontSize: '15px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
          <Plus size={18} /> Add Log
        </button>

        <section style={{ display: 'grid', gap: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#374151', margin: '8px 0 4px 0' }}>{logs.length === 0 ? 'No Log' : logs.length === 1 ? '1 Log' : `${logs.length} Logs`}</h2>
          {logs.length === 0 ? (
            <div style={{ ...panelStyle, textAlign: 'center', color: '#9ca3af', padding: '40px' }}>No logs yet. Add the first update for this task.</div>
          ) : logs.map((log) => (
            <article key={log.id} style={{ ...panelStyle, padding: '16px 18px', position: 'relative' }}>
              {canEditLog(log) && (
                <button onClick={() => handleLogEditClick(log)} style={{ position: 'absolute', top: '12px', right: '12px', width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0.7, transition: 'opacity 0.15s, background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = '#f3f4f6'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'transparent'; }} title="Edit Log">
                  <Pencil size={16} />
                </button>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', paddingRight: canEditLog(log) ? '40px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ borderRadius: '6px', background: '#ede9fe', color: '#6d28d9', padding: '4px 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{log.category}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>{formatDate(log.date)}</span>
                  {log.time_spent && <span style={{ fontSize: '12px', fontWeight: 500, color: '#9ca3af' }}>{log.time_spent}</span>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>{formatDateTime(log.created_at)}</div>
                </div>
              </div>
              <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#111827', margin: '0 0 12px 0' }}>{log.event}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={14} color="#fff" />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{log.created_by_profile?.name || 'Unknown'}</span>
              </div>
              {log.file_name && (
                <div style={{ marginTop: '12px', borderRadius: '8px', background: '#faf5ff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} color="#6d28d9" />
                  {isValidUrl(log.file_name) ? (
                    <a 
                      href={log.file_name} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#6d28d9', fontWeight: 600, fontSize: '13px', textDecoration: 'underline', wordBreak: 'break-all' }}
                    >
                      {getDisplayUrl(log.file_name)}
                    </a>
                  ) : (
                    <span style={{ color: '#6d28d9', fontWeight: 600, fontSize: '13px', wordBreak: 'break-all' }}>{log.file_name}</span>
                  )}
                </div>
              )}
            </article>
          ))}
        </section>
      </div>

      {showEditModal && task && (
        <TaskFormModal
          mode="edit"
          initialTask={task}
          onClose={() => setShowEditModal(false)}
          onCreated={loadData}
        />
      )}

      {showLogEditModal && editingLog && (
        <div onClick={() => setShowLogEditModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '28px', padding: '28px', width: '100%', maxWidth: '600px', maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 800 }}>Edit Log</div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>Task: <strong>{task?.title || 'Unknown Task'}</strong></div>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '14px' }}>
                <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151', minWidth: 0 }}>
                  Category
                  <select value={editLogCategory} onChange={(e) => setEditLogCategory(e.target.value as LogCategory)} style={inputStyle}>
                    <option value="design">Design</option>
                    <option value="research">Research</option>
                    <option value="meeting">Meeting</option>
                    <option value="review">Review</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>
              <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                Update
                <textarea value={editLogEvent} onChange={(e) => setEditLogEvent(e.target.value)} placeholder="What changed, what was decided, and what happens next" style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} />
              </label>
              <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                File name
                <input value={editLogFileName} onChange={(e) => setEditLogFileName(e.target.value)} placeholder="Optional" style={inputStyle} />
              </label>
              <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                Time spent
                <input value={editLogTimeSpent} onChange={(e) => setEditLogTimeSpent(e.target.value)} placeholder="e.g. 1.5h" style={inputStyle} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setShowLogEditModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleLogSaveEdit} disabled={savingLog || !editLogEvent.trim()} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#111827', color: '#fff', fontWeight: 600, opacity: (savingLog || !editLogEvent.trim()) ? 0.6 : 1, cursor: (savingLog || !editLogEvent.trim()) ? 'not-allowed' : 'pointer' }}>{savingLog ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div onClick={() => setShowDeleteConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px', padding: '28px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={28} color="#dc2626" />
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Delete Task?</div>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px', lineHeight: 1.5 }}>Are you sure you want to delete <strong>"{task.title}"</strong>?<br />This action cannot be undone and all logs will be lost.</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, opacity: deleting ? 0.6 : 1, cursor: deleting ? 'not-allowed' : 'pointer' }}>{deleting ? 'Deleting...' : 'Yes, Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {showModal && <LogFormModal taskId={taskId} onClose={() => setShowModal(false)} onCreated={loadData} />}
      {showSubtaskModal && task && (
        <TaskFormModal
          onClose={() => setShowSubtaskModal(false)}
          onCreated={loadData}
          parentTaskId={task.id}
          parentTaskTitle={task.title}
        />
      )}
    </AppShell>
  );
}

function Badge({ bg, color, text }: { bg: string; color: string; text: string }) {
  return (
    <span style={{ borderRadius: '6px', background: bg, color, padding: '3px 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
      {text}
    </span>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginTop: '2px', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}
