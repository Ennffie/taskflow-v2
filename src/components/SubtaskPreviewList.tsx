import { useNavigate } from 'react-router-dom';
import { formatDate } from '../lib/date';
import { getStatusMeta, type TaskItem } from '../types';

function getAvatarColor(name: string, id?: string) {
  const normalized = `${id ?? ''}:${name}`.toLowerCase();
  if (normalized.includes('enfield')) return '#6366F1';
  const palette = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6'];
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

const initials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

interface SubtaskPreviewListProps {
  subtasks: TaskItem[];
  limit?: number;
  showCheckbox?: boolean;
  checkedTaskIds?: Set<string>;
  onToggleSelect?: (taskId: string, e: React.MouseEvent) => void;
  embedded?: boolean;
}

export function SubtaskPreviewList({ subtasks, limit = 99, showCheckbox = false, checkedTaskIds, onToggleSelect, embedded = true }: SubtaskPreviewListProps) {
  const navigate = useNavigate();
  const visible = subtasks.slice(0, limit);
  const remaining = subtasks.length - visible.length;

  if (subtasks.length === 0) return null;

  return (
    <div style={{ marginTop: embedded ? '1px' : '0', paddingTop: embedded ? '4px' : '0', borderTop: embedded ? '1px solid #eef2f7' : 'none', display: 'grid', gap: '3px' }}>
      {visible.map((subtask) => {
        const assignee = subtask.assignees[0];
        const progress = subtask.is_finished ? 100 : (subtask.progress_percent ?? 0);
        const due = formatDate(subtask.due_date);
        const statusMeta = getStatusMeta(subtask.status);
        const isOverdue = !!subtask.due_date && new Date(subtask.due_date) < new Date(new Date().setHours(0,0,0,0));
        const isSelected = checkedTaskIds?.has(subtask.id) ?? false;

        return (
          <div
            key={subtask.id}
            onClick={(e) => { e.stopPropagation(); navigate(`/tasks/${subtask.id}`); }}
            style={{
              display: 'grid',
              gridTemplateColumns: showCheckbox ? '28px 18px minmax(0,1fr) auto' : '18px minmax(0,1fr) auto',
              gap: '6px',
              alignItems: 'center',
              background: '#f8fafc',
              borderRadius: '7px',
              padding: '4px 6px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {showCheckbox && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.(subtask.id, e);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '5px',
                    border: isSelected ? '2px solid #7c3aed' : '2px solid #94a3b8',
                    background: isSelected ? '#7c3aed' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                  }}
                >
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </div>
            )}
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: assignee ? getAvatarColor(assignee.name, assignee.id) : '#E2E8F0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700 }}>
              {assignee ? initials(assignee.name) : '—'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.15, minWidth: 0 }}>{subtask.title}</div>
                <span style={{ fontSize: '8px', fontWeight: 700, color: statusMeta.color, background: statusMeta.bg, padding: '2px 5px', borderRadius: '999px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {statusMeta.label}
                </span>
              </div>
              <div style={{ fontSize: '9px', color: isOverdue ? '#dc2626' : '#94a3b8', marginTop: '0px', lineHeight: 1.1 }}>{due === '—' ? 'No due date' : due}</div>
            </div>
            <div style={{ display: 'grid', gap: '2px', justifyItems: 'end', minWidth: '48px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#475569' }}>{progress}%</div>
              <div style={{ width: '44px', height: '4px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: progress >= 100 ? '#10b981' : '#7c3aed', borderRadius: '999px' }} />
              </div>
            </div>
          </div>
        );
      })}
      {remaining > 0 && (
        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, paddingLeft: showCheckbox ? '52px' : '24px' }}>+{remaining} more sub-task{remaining === 1 ? '' : 's'}</div>
      )}
    </div>
  );
}
