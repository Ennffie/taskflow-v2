import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createTask, fetchProfiles, updateTask } from '../lib/api';
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
}

export function TaskFormModal({ onClose, onCreated, parentTaskId, parentTaskTitle, mode = 'create', initialTask }: TaskFormModalProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [isFocus, setIsFocus] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);

  useEffect(() => {
    fetchProfiles().then(setProfiles).catch(console.error);
    notifyModalOpen();
    return () => notifyModalClose();
  }, []);

  useEffect(() => {
    if (!initialTask) return;
    const cleanDescription = initialTask.description?.split(/\n\n\[\d{4}-\d{2}-\d{2}\]/)[0] || '';
    setTitle(initialTask.title);
    setDescription(cleanDescription);
    setStatus(initialTask.status);
    setPriority(initialTask.priority);
    setDueDate(initialTask.due_date || '');
    setAssigneeIds(initialTask.assignees.map(a => a.id));
    setTagInput(initialTask.tags.join(', '));
    setIsFocus(initialTask.is_focus ?? false);
    setRoundNumber(initialTask.round_number ?? 1);
  }, [initialTask]);

  const toggleAssignee = (id: string) => {
    setAssigneeIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  const setDueDateToToday = () => {
    setDueDate(new Date().toISOString().slice(0, 10));
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    try {
      setSaving(true);
      const finalStatus = status;
      const nextTags = tagInput.split(',').map((tag) => tag.trim()).filter(Boolean);

      if (mode === 'edit' && initialTask) {
        const logMatch = initialTask.description?.match(/\n\n(\[\d{4}-\d{2}-\d{2}\].*)/s);
        const logEntries = logMatch ? '\n\n' + logMatch[1] : '';
        const finalDescription = description.trim() + logEntries;

        await updateTask(initialTask.id, {
          title: title.trim(),
          description: finalDescription,
          status: finalStatus,
          priority,
          due_date: dueDate || null,
          is_focus: isFocus,
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
      } else {
        await createTask({
          title: title.trim(),
          description,
          status: finalStatus,
          priority,
          due_date: dueDate || undefined,
          assignee_ids: assigneeIds,
          tags: nextTags,
          parent_id: parentTaskId ?? null,
          is_focus: isFocus,
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
    <ModalFrame title={mode === 'edit' ? 'Edit Task' : parentTaskId ? 'Create sub-task' : 'Create task'} onClose={onClose} isFocus={isFocus} onToggleFocus={() => setIsFocus(!isFocus)}>
      <div style={{ display: 'grid', gap: '18px' }}>
        {parentTaskId && parentTaskTitle && (
          <div style={{ padding: '12px 14px', borderRadius: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569' }}>
            Parent task: <strong style={{ color: '#111827' }}>{parentTaskTitle}</strong>
          </div>
        )}
        <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="e.g. PMC portal redesign" /></Field>
        <Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: '110px', resize: 'vertical' }} placeholder="Context, scope, handoff details" /></Field>
        {/* Status + Priority in one row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} style={inputStyle}>{TASK_STATUS_OPTIONS.map((value) => <option key={value} value={value}>{STATUS_META[value].label}</option>)}</select></Field>
          <Field label="Priority"><select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} style={inputStyle}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></Field>
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
        <Field label="Due date">
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
                Today
              </button>
            </div>
          </div>
        </Field>
        <Field label="Assignees">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {profiles.map((profile) => (
              <button key={profile.id} type="button" onClick={() => toggleAssignee(profile.id)} style={{ borderRadius: '999px', border: assigneeIds.includes(profile.id) ? 'none' : '1px solid #e5e7eb', background: assigneeIds.includes(profile.id) ? '#111827' : '#fff', color: assigneeIds.includes(profile.id) ? '#fff' : '#374151', padding: '10px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>{profile.name}</button>
            ))}
          </div>
        </Field>
        <Field label="Tags"><input value={tagInput} onChange={(e) => setTagInput(e.target.value)} style={inputStyle} placeholder="comma separated, e.g. UX, PMC, urgent" /></Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
          <button onClick={onClose} style={ghostButton}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={primaryButton}>{saving ? (mode === 'edit' ? 'Saving...' : 'Creating...') : (mode === 'edit' ? 'Save Changes' : 'Create task')}</button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>{label}{children}</label>;
}

function ModalFrame({ title, onClose, isFocus, onToggleFocus, children }: { title: string; onClose: () => void; isFocus?: boolean; onToggleFocus?: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.55)', display: 'grid', placeItems: 'center', padding: '24px', zIndex: 300 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px, 100%)', maxHeight: '85vh', overflow: 'auto', background: '#fff', borderRadius: '28px', padding: '28px', boxShadow: '0 28px 80px rgba(15,23,42,0.22)', zIndex: 301, marginBottom: '80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827' }}>{title}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Focus Toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFocus?.(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '20px',
                border: isFocus ? '2px solid #7c3aed' : '2px solid #e5e7eb',
                background: isFocus ? '#ede9fe' : '#fff',
                color: isFocus ? '#7c3aed' : '#6b7280',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: '16px' }}>🎯</span>
              Focus
            </button>
            <button onClick={onClose} style={{ border: 'none', background: '#f3f4f6', width: '42px', height: '42px', borderRadius: '14px', cursor: 'pointer' }}><X size={18} /></button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
