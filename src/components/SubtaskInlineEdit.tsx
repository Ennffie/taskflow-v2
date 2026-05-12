import { useState, useRef, useEffect } from 'react';
import { getStatusMeta, type TaskItem, type TaskStatus, type Profile } from '../types';
import { updateSubtask, updateSubtaskAssignees } from '../lib/api';

interface SubtaskInlineEditProps {
  subtask: TaskItem;
  profiles: Profile[];
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: () => void;
  isReplying: boolean;
  onDelete?: (subtaskId: string) => void;
}

export function SubtaskInlineEdit({ subtask, profiles, isExpanded, onToggle, onUpdate, isReplying, onDelete }: SubtaskInlineEditProps) {
  const [title, setTitle] = useState(subtask.title);
  const [progress, setProgress] = useState(subtask.progress ?? subtask.progress_percent ?? 0);
  const [status, setStatus] = useState<TaskStatus>(subtask.status);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(subtask.assignees.map(a => a.id));
  const [isSaving, setIsSaving] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const expandRef = useRef<HTMLDivElement>(null);

  const statusMeta = getStatusMeta(status);
  const progressPercent = isExpanded ? progress : (subtask.progress ?? subtask.progress_percent ?? 0);

  useEffect(() => {
    if (isExpanded && expandRef.current) {
      setTimeout(() => {
        expandRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [isExpanded]);

  const handleDelete = async () => {
    if (isSaving || isReplying || !onDelete) return;
    setIsSaving(true);
    try {
      await onDelete(subtask.id);
    } catch (e) {
      console.error('Failed to delete subtask:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (isSaving || isReplying) return;
    setIsSaving(true);
    try {
      const updates: any = {};
      if (title !== subtask.title) updates.title = title;
      if (progress !== (subtask.progress ?? subtask.progress_percent ?? 0)) updates.progress = progress;
      if (status !== subtask.status) updates.status = status;

      if (Object.keys(updates).length > 0) {
        await updateSubtask(subtask.id, updates);
      }

      const currentAssigneeIds = subtask.assignees.map(a => a.id);
      const assigneesChanged = assigneeIds.length !== currentAssigneeIds.length ||
        !assigneeIds.every(id => currentAssigneeIds.includes(id));
      if (assigneesChanged) {
        await updateSubtaskAssignees(subtask.id, assigneeIds);
      }

      onUpdate();
    } catch (e) {
      console.error('Failed to update subtask:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAssignee = (profileId: string) => {
    setAssigneeIds(prev =>
      prev.includes(profileId)
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };

  const getAvatarColor = (name: string, id?: string) => {
    const normalized = `${id ?? ''}:${name}`.toLowerCase();
    if (normalized.includes('enfield')) return '#6366F1';
    const palette = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6'];
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
      hash |= 0;
    }
    return palette[Math.abs(hash) % palette.length];
  };

  return (
    <div style={{ borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      {/* Collapsed view */}
      <div
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: '18px minmax(0,1fr) auto',
          gap: '8px',
          alignItems: 'center',
          padding: '8px 10px',
          cursor: 'pointer',
          background: isExpanded ? '#f1f5f9' : 'transparent',
        }}
      >
        {/* Status dot */}
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: statusMeta.color,
          flexShrink: 0,
        }} />

        {/* Title */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#334155',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {subtask.title}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 2, alignItems: 'center' }}>
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              color: statusMeta.color,
              background: statusMeta.bg,
              padding: '1px 5px',
              borderRadius: 999,
            }}>
              {statusMeta.label}
            </span>
            {subtask.assignees.length > 0 && (
              <span style={{ fontSize: 9, color: '#64748b' }}>
                {subtask.assignees.map(a => a.name.split(' ')[0]).join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Progress */}
        <div style={{ display: 'grid', gap: 2, justifyItems: 'end', minWidth: '44px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569' }}>{progressPercent}%</div>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
            <div style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: progressPercent >= 100 ? '#10b981' : '#7c3aed',
              borderRadius: 999,
            }} />
          </div>
        </div>
      </div>

      {/* Expanded edit area */}
      {isExpanded && (
        <div ref={expandRef} style={{ padding: '12px 10px', borderTop: '1px solid #e2e8f0', background: '#fff' }}>
          {/* Title input */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
              名稱
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                fontWeight: 600,
                color: '#1e293b',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Progress slider */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
              進度: {progress}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#7c3aed' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Status dropdown */}
          <div style={{ marginBottom: 12, position: 'relative' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
              Status
            </label>
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <span style={{
                fontSize: 13,
                fontWeight: 700,
                color: statusMeta.color,
                background: statusMeta.bg,
                padding: '3px 10px',
                borderRadius: 999,
              }}>
                {statusMeta.label}
              </span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>▼</span>
            </button>
            {showStatusDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: '#fff',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 100,
                maxHeight: 240,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}>
                {(['todo', 'planning', 'in_progress', 'internal_review', 'round_1_wip', 'round_1_review', 'round_2_wip', 'round_2_review', 'round_3_wip', 'round_3_review', 'pending_mpfa_pc_nfc', 'finished', 'cancelled'] as TaskStatus[]).map((s) => {
                  const meta = getStatusMeta(s);
                  const isSelected = status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        setStatus(s);
                        setPendingDelete(s === 'cancelled');
                        setShowStatusDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        borderBottom: '1px solid #f1f5f9',
                        background: isSelected ? meta.bg : '#fff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: meta.color,
                      }} />
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: isSelected ? meta.color : '#475569',
                      }}>
                        {meta.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assignee picker - icons only */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
              負責人
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {profiles.map((profile) => {
                const isSelected = assigneeIds.includes(profile.id);
                const avatarColor = getAvatarColor(profile.name, profile.id);
                return (
                  <button
                    key={profile.id}
                    onClick={() => toggleAssignee(profile.id)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      border: isSelected ? '2px solid ' + avatarColor : '2px solid transparent',
                      background: avatarColor,
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isSelected ? 1 : 0.4,
                      transition: 'opacity 0.2s',
                    }}
                    title={profile.name}
                  >
                    {profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main action button */}
          <button
            onClick={async () => {
              if (pendingDelete) {
                await handleDelete();
                onToggle();
                return;
              }
              await handleSave();
              onToggle(); // collapse after save
            }}
            disabled={isSaving || isReplying}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 10,
              border: 'none',
              background: pendingDelete ? '#ef4444' : '#0f172a',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 900,
              cursor: isSaving || isReplying ? 'default' : 'pointer',
              opacity: isSaving || isReplying ? 0.6 : 1,
            }}
          >
            {isSaving ? '...' : pendingDelete ? 'Delete' : 'OK'}
          </button>
        </div>
      )}
    </div>
  );
}
