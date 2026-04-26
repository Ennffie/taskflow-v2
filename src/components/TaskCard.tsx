import { useNavigate } from 'react-router-dom';
import { formatDate } from '../lib/date';
import { type TaskItem } from '../types';
import { SubtaskPreviewList } from './SubtaskPreviewList';

const AVATAR_COLOR_PALETTE = [
  '#6366F1', // indigo
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EF4444', // red
  '#14B8A6', // teal
];

function getAvatarColor(name: string, id?: string) {
  const normalized = `${id ?? ''}:${name}`.toLowerCase();

  if (normalized.includes('enfield')) {
    return '#6366F1';
  }

  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    hash |= 0;
  }

  return AVATAR_COLOR_PALETTE[Math.abs(hash) % AVATAR_COLOR_PALETTE.length];
}

interface TaskCardProps {
  task: TaskItem;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (taskId: string, e: React.MouseEvent) => void;
  showAssignees?: boolean;
  isFocusSection?: boolean;
  isEvenIndex?: boolean;
  subtasks?: TaskItem[];
}

export function TaskCard({ 
  task, 
  showCheckbox = false,
  isSelected = false,
  onToggleSelect,
  showAssignees: _showAssignees = true,
  isFocusSection = false,
  isEvenIndex = true,
  subtasks = [],
}: TaskCardProps) {
  const navigate = useNavigate();

  const isDueSoon = (dueDate: string | null): boolean => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
    return diff >= 0 && diff <= 3;
  };

  const isOverdue = (dueDate: string | null): boolean => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  // Background colors
  const baseBgColor = isFocusSection 
    ? (isEvenIndex ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)')
    : (isEvenIndex ? '#ffffff' : '#f8fafc');
  const hoverBgColor = isFocusSection 
    ? (isEvenIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)')
    : (isEvenIndex ? '#f1f5f9' : '#e2e8f0');

  const dueDateLabel = formatDate(task.due_date);
  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const primaryAssignee = task.assignees[0];
  const progress = task.is_finished ? 100 : (task.progress_percent ?? 0);

  return (
    <div 
      onClick={() => navigate(`/tasks/${task.id}`)}
      style={{ 
        display: 'grid', 
        gap: '6px', 
        padding: '12px 14px', 
        borderBottom: '1px solid #f1f5f9', 
        cursor: 'pointer',
        background: baseBgColor,
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = hoverBgColor}
      onMouseLeave={(e) => e.currentTarget.style.background = baseBgColor}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        {/* Checkbox (My Tasks only) */}
        {showCheckbox && (
          <div 
            onClick={(e) => onToggleSelect?.(task.id, e)}
            style={{ 
              width: '20px', 
              height: '20px', 
              borderRadius: '6px',
              border: isSelected ? '2px solid #7c3aed' : '2px solid #e2e8f0',
              background: isSelected ? '#7c3aed' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {isSelected && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        )}

        {/* Primary Assignee Avatar */}
        <div style={{ 
          width: '32px', 
          height: '32px', 
          borderRadius: '50%', 
          background: primaryAssignee ? getAvatarColor(primaryAssignee.name, primaryAssignee.id) : '#E2E8F0',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: primaryAssignee ? '12px' : '14px',
          fontWeight: 700,
          flexShrink: 0,
          border: '2px solid #fff',
        }}>
          {primaryAssignee ? initials(primaryAssignee.name) : '—'}
        </div>
        
        {/* Middle: Title + Tags */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {/* Task Title */}
        <p style={{ 
          fontSize: '15px', 
          fontWeight: 700, 
          color: '#111827', 
          margin: 0, 
          lineHeight: 1.3,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {task.title}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: progress >= 100 ? '#10b981' : '#7c3aed', background: progress >= 100 ? '#ecfdf5' : '#f3e8ff', padding: '3px 7px', borderRadius: '999px' }}>
            {progress}%
          </span>
          <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600, background: '#f8fafc', padding: '3px 7px', borderRadius: '999px' }}>
            {task.log_count} log{task.log_count <= 1 ? '' : 's'}
          </span>

          <span style={{ 
            fontSize: '11px', 
            fontWeight: 600,
            color: isOverdue(task.due_date) ? '#dc2626' : isDueSoon(task.due_date) ? '#d97706' : '#64748b',
            background: isOverdue(task.due_date) ? '#fef2f2' : isDueSoon(task.due_date) ? '#fffbeb' : '#f8fafc',
            padding: '3px 7px',
            borderRadius: '999px',
          }}>
            {dueDateLabel === '—' ? 'No due date' : dueDateLabel}
          </span>

          {task.tags.length > 0 && (
            <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 7px', borderRadius: '999px', background: '#f1f5f9', color: '#64748b', maxWidth: '88px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.tags[0]}{task.tags.length > 1 ? ` +${task.tags.length - 1}` : ''}
            </span>
          )}
        </div>
        </div>
      </div>

      {subtasks.length > 0 && (
        <div onClick={(e) => e.stopPropagation()} style={{ marginLeft: showCheckbox ? '28px' : '42px' }}>
          <SubtaskPreviewList subtasks={subtasks} />
        </div>
      )}
    </div>
  );
}
