import { useState } from 'react';
import { STATUS_META, TASK_STATUS_OPTIONS } from '../types';
import type { LogCategory, TaskStatus } from '../types';
import { createLog } from '../lib/api';
import { ghostButton, inputStyle, primaryButton } from './TaskFormModal';

export function LogFormModal({ taskId, onClose, onCreated }: { taskId: string; onClose: () => void; onCreated: () => Promise<void> | void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [event, setEvent] = useState('');
  const [category, setCategory] = useState<LogCategory>('design');
  const [timeSpent, setTimeSpent] = useState('');
  const [fileName, setFileName] = useState('');
  const [nextStatus, setNextStatus] = useState<TaskStatus | ''>('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!event.trim()) return;
    try {
      setSaving(true);
      await createLog({ task_id: taskId, date, event: event.trim(), category, time_spent: timeSpent, file_name: fileName, next_status: nextStatus });
      await onCreated();
      onClose();
    } catch (error: any) {
      alert(`Add log failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.55)', display: 'grid', placeItems: 'center', padding: '24px', zIndex: 300 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(680px, 100%)', maxHeight: '85vh', overflow: 'auto', background: '#fff', borderRadius: '28px', padding: '28px', zIndex: 301, marginBottom: '80px' }}>
        <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827', marginBottom: '24px' }}>Add log entry</div>
        <div style={{ display: 'grid', gap: '18px' }}>
          {/* Row 1: Date + Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} /></Field>
            <Field label="Category"><select value={category} onChange={(e) => setCategory(e.target.value as LogCategory)} style={inputStyle}><option value="design">Design</option><option value="research">Research</option><option value="meeting">Meeting</option><option value="review">Review</option><option value="other">Other</option></select></Field>
          </div>
          
          {/* Row 2: Update */}
          <Field label="Update"><textarea value={event} onChange={(e) => setEvent(e.target.value)} style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} placeholder="What changed, what was decided, and what happens next" /></Field>
          
          {/* Row 3: File name (full width) */}
          <Field label="File name"><input value={fileName} onChange={(e) => setFileName(e.target.value)} style={inputStyle} placeholder="Optional" /></Field>
          
          {/* Row 4: Time spent + Next status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Field label="Time spent"><input value={timeSpent} onChange={(e) => setTimeSpent(e.target.value)} style={inputStyle} placeholder="e.g. 1.5h" /></Field>
            <Field label="Status"><select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as TaskStatus | '')} style={inputStyle}><option value="">No change</option>{TASK_STATUS_OPTIONS.map((value) => <option key={value} value={value}>{STATUS_META[value].label}</option>)}</select></Field>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button onClick={onClose} style={ghostButton}>Cancel</button>
            <button onClick={handleSubmit} disabled={saving} style={primaryButton}>{saving ? 'Saving...' : 'Save log'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>{label}{children}</label>;
}
