import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createTask, createTaskEventLog, fetchProfiles, updateTask } from '../lib/api';
import { supabase } from '../lib/supabase';
import { STATUS_META, TASK_STATUS_OPTIONS } from '../types';
import type { Profile, TaskItem, TaskPriority, TaskStatus } from '../types';
import { notifyModalOpen, notifyModalClose } from './AppShell';

interface TaskFormModalProps {
  onClose: () => void;
  onCreated: () => Promise<void> | void;
  parentTaskId?: string;
  parentTaskTitle?: string;
  mode?: 'create' | 'edit';
  initialTask?: TaskItem | null;
  variant?: 'default' | 'canton';
}

export function TaskFormModal({ onClose, onCreated, parentTaskId, parentTaskTitle, mode = 'create', initialTask, variant = 'default' }: TaskFormModalProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [todayUpdate, setTodayUpdate] = useState('');
  const [nextDayFocus, setNextDayFocus] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [isFocus, setIsFocus] = useState(false);
  const [focusSaving, setFocusSaving] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);

  useEffect(() => {
    fetchProfiles().then(setProfiles).catch(console.error);
    notifyModalOpen();
    return () => notifyModalClose();
  }, []);

  useEffect(() => {
    if (!initialTask) return;
    const cleanDescription = initialTask.description?.split(/\n\n\[\d{4}-\d{2}-\d{2}\]/)[0] || '';
    // Map legacy 'done' status to 'finished'
    const normalizedStatus = (initialTask.status as any) === 'done' ? 'finished' : initialTask.status;
    setTitle(initialTask.title);
    setDescription(cleanDescription);
    setTodayUpdate(initialTask.today_update || '');
    setNextDayFocus(initialTask.next_day_focus || '');
    setStatus(normalizedStatus as TaskStatus);
    setPriority(initialTask.priority);
    setDueDate(initialTask.due_date || '');
    setAssigneeIds(initialTask.assignees.map(a => a.id));
    setTagInput(initialTask.tags.join(', '));
    setIsFocus(initialTask.is_focus ?? false);
    setIsFinished(initialTask.is_finished ?? false);
    setRoundNumber(initialTask.round_number ?? 1);
  }, [initialTask]);

  const toggleAssignee = (id: string) => {
    setAssigneeIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  const setDueDateToToday = () => {
    setDueDate(new Date().toISOString().slice(0, 10));
  };

  const setDueDateOffset = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setDueDate(date.toISOString().slice(0, 10));
  };

  const isCanton = variant === 'canton';
  const copy = isCanton ? {
    title: mode === 'edit' ? '改一改 task' : parentTaskId ? '加 sub-task' : '加新 task',
    parent: '屬於：',
    titleLabel: 'Task 名',
    titlePlaceholder: '例如：SC Poster & Pull up Banner',
    descriptionLabel: '有咩要記低？',
    descriptionPlaceholder: 'Context、scope、handoff、reference…',
    todayUpdate: '今日做到咩',
    todayPlaceholder: '今日進度 / 最新情況',
    nextFocus: '下一步搞咩',
    nextPlaceholder: '下一個 working day focus',
    status: '狀態',
    priority: '重要度',
    due: 'Deadline',
    assignees: '邊個跟',
    tags: 'Tags / 分類',
    tagsPlaceholder: '例如：UX, urgent, handoff',
    cancel: '唔改住',
    submit: mode === 'edit' ? '儲存更改' : '加落去',
    saving: mode === 'edit' ? '儲存中...' : '加入中...',
    today: 'Today',
    tomorrow: 'Tomorrow',
    noDate: '未定',
  } : null;

  const handleToggleFocus = async () => {
    const nextFocus = !isFocus;
    setIsFocus(nextFocus);
    if (nextFocus && isFinished) {
      setIsFinished(false);
      setStatus('todo');
    }

    if (mode !== 'edit' || !initialTask) return;

    try {
      setFocusSaving(true);
      await updateTask(initialTask.id, { is_focus: nextFocus });
      const logTaskId = initialTask.parent_id ?? initialTask.id;
      const taskLabel = `${initialTask.parent_id ? 'Subtask' : 'Main Task'} ${title.trim() || initialTask.title}`;
      await createTaskEventLog(logTaskId, `${taskLabel} focus: ${isFocus ? 'Yes' : 'No'} → ${nextFocus ? 'Yes' : 'No'}`);
      await onCreated();
    } catch (error: any) {
      setIsFocus(isFocus);
      alert(`Update focus failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setFocusSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    try {
      setSaving(true);
      const finalStatus = status;
      const nextTags = tagInput.split(',').map((tag) => tag.trim()).filter(Boolean);

      if (mode === 'edit' && initialTask) {
        const logTaskId = initialTask.parent_id ?? initialTask.id;
        const taskLabel = `${initialTask.parent_id ? 'Subtask' : 'Main Task'} ${title.trim()}`;
        const previousAssigneeIds = initialTask.assignees.map((assignee) => assignee.id).sort();
        const nextAssigneeIds = [...assigneeIds].sort();
        const previousAssigneeNames = initialTask.assignees.map((assignee) => assignee.name).sort();
        const nextAssigneeNames = profiles.filter((profile) => assigneeIds.includes(profile.id)).map((profile) => profile.name).sort();
        const previousTags = [...initialTask.tags].sort();
        const sortedNextTags = [...nextTags].sort();

        const logMatch = initialTask.description?.match(/\n\n(\[\d{4}-\d{2}-\d{2}\].*)/s);
        const logEntries = logMatch ? '\n\n' + logMatch[1] : '';
        const finalDescription = description.trim() + logEntries;

        await updateTask(initialTask.id, {
          title: title.trim(),
          description: finalDescription,
          today_update: todayUpdate.trim() || null,
          next_day_focus: nextDayFocus.trim() || null,
          status: finalStatus,
          priority,
          due_date: dueDate || null,
          is_focus: isFocus,
          is_finished: isFinished,
          round_number: roundNumber,
        });

        await supabase.from('task_assignees').delete().eq('task_id', initialTask.id);
        if (assigneeIds.length > 0) {
          await supabase.from('task_assignees').insert(
            assigneeIds.map((uid) => ({ task_id: initialTask.id, user_id: uid }))
          );
        }

        await supabase.from('tags').delete().eq('task_id', initialTask.id);
        if (nextTags.length > 0) {
          await supabase.from('tags').insert(
            nextTags.map((name) => ({ task_id: initialTask.id, name }))
          );
        }

        if (JSON.stringify(previousAssigneeIds) !== JSON.stringify(nextAssigneeIds)) {
          await createTaskEventLog(logTaskId, `${taskLabel} assignees: ${previousAssigneeNames.join(', ') || '—'} → ${nextAssigneeNames.join(', ') || '—'}`);
        }

        if (JSON.stringify(previousTags) !== JSON.stringify(sortedNextTags)) {
          await createTaskEventLog(logTaskId, `${taskLabel} tags: ${previousTags.join(', ') || '—'} → ${sortedNextTags.join(', ') || '—'}`);
        }
      } else {
        await createTask({
          title: title.trim(),
          description,
          today_update: todayUpdate,
          next_day_focus: nextDayFocus,
          status: finalStatus,
          priority,
          due_date: dueDate || undefined,
          assignee_ids: assigneeIds,
          tags: nextTags,
          parent_id: parentTaskId ?? null,
          is_focus: isFocus,
          is_finished: isFinished,
          round_number: roundNumber,
        });
      }

      await onCreated();
      onClose();
    } catch (error: any) {
      alert(`${mode === 'edit' ? 'Update' : 'Create'} task failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalFrame title={copy?.title ?? (mode === 'edit' ? 'Edit Task' : parentTaskId ? 'Create sub-task' : 'Create task')} onClose={onClose} isFinished={isFinished} isFocus={isFocus} onToggleFinish={() => { const next = !isFinished; setIsFinished(next); if (next) { setStatus('finished'); setIsFocus(false); } else if (status === 'finished') setStatus('todo'); }} onToggleFocus={handleToggleFocus} focusSaving={focusSaving}>
      <div style={{ display: 'grid', gap: '18px' }}>
        {parentTaskId && parentTaskTitle && (
          <div style={{ padding: '12px 14px', borderRadius: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569' }}>
            {copy?.parent ?? 'Parent task: '}<strong style={{ color: '#111827' }}>{parentTaskTitle}</strong>
          </div>
        )}
        <Field label={copy?.titleLabel ?? 'Title'}><input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder={copy?.titlePlaceholder ?? 'e.g. PMC portal redesign'} /></Field>
        <Field label={copy?.descriptionLabel ?? 'Description'}><textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: '110px', resize: 'vertical' }} placeholder={copy?.descriptionPlaceholder ?? 'Context, scope, handoff details'} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label={copy?.todayUpdate ?? 'Today Update'}><textarea value={todayUpdate} onChange={(e) => setTodayUpdate(e.target.value)} style={{ ...inputStyle, minHeight: '110px', resize: 'vertical' }} placeholder={copy?.todayPlaceholder ?? 'What was done today'} /></Field>
          <Field label={copy?.nextFocus ?? 'Next Day Focus'}><textarea value={nextDayFocus} onChange={(e) => setNextDayFocus(e.target.value)} style={{ ...inputStyle, minHeight: '110px', resize: 'vertical' }} placeholder={copy?.nextPlaceholder ?? 'Next working day focus'} /></Field>
        </div>
        {/* Status + Priority in one row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label={copy?.status ?? 'Status'}><select value={status} onChange={(e) => { const s = e.target.value as TaskStatus; setStatus(s); setIsFinished(s === 'finished'); }} style={inputStyle}>{TASK_STATUS_OPTIONS.map((value) => <option key={value} value={value}>{(STATUS_META as any)[value]?.label ?? value}</option>)}</select></Field>
          <Field label={copy?.priority ?? 'Priority'}><select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} style={inputStyle}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></Field>
        </div>
        {parentTaskId && (
          <Field label="Round">
            <select value={roundNumber} onChange={(e) => setRoundNumber(Number(e.target.value))} style={inputStyle}>
              <option value={1}>Round 1</option>
              <option value={2}>Round 2</option>
              <option value={3}>Round 3</option>
            </select>
          </Field>
        )}
        <Field label={copy?.due ?? 'Due date'}>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ ...inputStyle, WebkitAppearance: 'none', appearance: 'none', paddingRight: dueDate ? '54px' : '16px' }} />
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#f3f4f6',
                    color: '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '18px',
                    fontWeight: 700,
                  }}
                  aria-label="Clear due date"
                  title="Clear due date"
                >
                  ×
                </button>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button
                type="button"
                onClick={setDueDateToToday}
                style={{
                  borderRadius: '999px',
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  color: '#374151',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {copy?.today ?? 'Today'}
              </button>
              {isCanton && <button type="button" onClick={() => setDueDateOffset(1)} style={{ ...ghostPill, marginLeft: 8 }}>{copy?.tomorrow}</button>}
              {isCanton && <button type="button" onClick={() => setDueDate('')} style={{ ...ghostPill, marginLeft: 8 }}>{copy?.noDate}</button>}
            </div>
          </div>
        </Field>
        <Field label={copy?.assignees ?? 'Assignees'}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {profiles.map((profile) => (
              <button key={profile.id} type="button" onClick={() => toggleAssignee(profile.id)} style={{ borderRadius: '999px', border: assigneeIds.includes(profile.id) ? 'none' : '1px solid #e5e7eb', background: assigneeIds.includes(profile.id) ? '#111827' : '#fff', color: assigneeIds.includes(profile.id) ? '#fff' : '#374151', padding: '10px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>{profile.name}</button>
            ))}
          </div>
        </Field>
        <Field label={copy?.tags ?? 'Tags'}><input value={tagInput} onChange={(e) => setTagInput(e.target.value)} style={inputStyle} placeholder={copy?.tagsPlaceholder ?? 'comma separated, e.g. UX, PMC, urgent'} /></Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
          <button onClick={onClose} style={ghostButton}>{copy?.cancel ?? 'Cancel'}</button>
          <button onClick={handleSubmit} disabled={saving} style={primaryButton}>{saving ? (copy?.saving ?? (mode === 'edit' ? 'Saving...' : 'Creating...')) : (copy?.submit ?? (mode === 'edit' ? 'Save Changes' : 'Create task'))}</button>
        </div>
      </div>
    </ModalFrame>
  );
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: '18px',
  border: '1px solid #e5e7eb',
  background: '#fff',
  padding: '14px 16px',
  fontSize: '14px',
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
};

export const primaryButton: React.CSSProperties = {
  borderRadius: '18px',
  border: 'none',
  background: '#111827',
  color: '#fff',
  padding: '14px 18px',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
};

export const ghostButton: React.CSSProperties = {
  borderRadius: '18px',
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#374151',
  padding: '14px 18px',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
};

const ghostPill: React.CSSProperties = {
  borderRadius: '999px',
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#374151',
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>{label}{children}</label>;
}

function ModalFrame({ title, onClose, isFinished, isFocus, onToggleFinish, onToggleFocus, focusSaving = false, children }: { title: string; onClose: () => void; isFinished?: boolean; isFocus?: boolean; onToggleFinish?: () => void; onToggleFocus?: () => void; focusSaving?: boolean; children: React.ReactNode }) {
  const isMobileViewport = typeof window !== 'undefined' ? window.innerWidth < 640 : false;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.55)', display: 'grid', placeItems: 'center', padding: isMobileViewport ? '12px' : '24px', zIndex: 300 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px, 100%)', maxHeight: '85vh', overflow: 'auto', background: '#fff', borderRadius: '28px', padding: isMobileViewport ? '18px' : '28px', boxShadow: '0 28px 80px rgba(15,23,42,0.22)', zIndex: 301, marginBottom: isMobileViewport ? '12px' : '80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: isMobileViewport ? '18px' : '24px', lineHeight: 1.15, fontWeight: 800, color: '#0D8A9C', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>{title}</div>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: '#f3f4f6', width: '42px', height: '42px', borderRadius: '14px', cursor: 'pointer', flexShrink: 0 }}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Finish Toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFinish?.(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: isMobileViewport ? '8px 12px' : '8px 14px',
                minHeight: '42px',
                borderRadius: '20px',
                border: isFinished ? '2px solid #059669' : '2px solid #e5e7eb',
                background: isFinished ? '#d1fae5' : '#fff',
                color: isFinished ? '#059669' : '#6b7280',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: '16px' }}>{isFinished ? '✅' : '⬜'}</span>
              {isFinished ? 'Finished' : 'Mark Finished'}
            </button>
            {/* Focus Toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFocus?.(); }}
              disabled={focusSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: isMobileViewport ? '8px 12px' : '8px 14px',
                minHeight: '42px',
                borderRadius: '20px',
                border: isFocus ? '2px solid #7c3aed' : '2px solid #e5e7eb',
                background: isFocus ? '#ede9fe' : '#fff',
                color: isFocus ? '#7c3aed' : '#6b7280',
                fontSize: '13px',
                fontWeight: 700,
                cursor: focusSaving ? 'wait' : 'pointer',
                opacity: focusSaving ? 0.68 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: '16px' }}>🎯</span>
              {focusSaving ? 'Saving' : 'Focus'}
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
