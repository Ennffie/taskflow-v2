import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createTask, fetchProfiles } from '../lib/api';
import type { Profile, TaskPriority, TaskStatus } from '../types';
import { notifyModalOpen, notifyModalClose } from './AppShell';

export function TaskFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> | void }) {
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

  useEffect(() => {
    fetchProfiles().then(setProfiles).catch(console.error);
    notifyModalOpen();
    return () => notifyModalClose();
  }, []);

  const toggleAssignee = (id: string) => {
    setAssigneeIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    try {
      setSaving(true);
      await createTask({
        title: title.trim(),
        description,
        status: isFocus ? 'focus' : status,
        priority,
        due_date: dueDate || undefined,
        assignee_ids: assigneeIds,
        tags: tagInput.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      await onCreated();
      onClose();
    } catch (error: any) {
      alert(`Create task failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalFrame title="Create task" onClose={onClose} isFocus={isFocus} onToggleFocus={() => setIsFocus(!isFocus)}>
      <div style={{ display: 'grid', gap: '18px' }}>
        <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="e.g. PMC portal redesign" /></Field>
        <Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: '110px', resize: 'vertical' }} placeholder="Context, scope, handoff details" /></Field>
        {/* Status + Priority in one row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} style={inputStyle}><option value="todo">Todo</option><option value="in_progress">In Progress</option><option value="review">Review</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select></Field>
          <Field label="Priority"><select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} style={inputStyle}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></Field>
        </div>
        {/* Due date - full width, same height as other fields */}
        <Field label="Due date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} /></Field>
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
          <button onClick={handleSubmit} disabled={saving} style={primaryButton}>{saving ? 'Creating...' : 'Create task'}</button>
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
              <span style={{ fontSize: '16px' }}>{isFocus ? '🎯' : '○'}</span>
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
