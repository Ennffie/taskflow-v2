import { useNavigate } from 'react-router-dom';
import { formatDate } from '../lib/date';
import { type TaskItem, type TaskStatus } from '../types';

// Status to Emoji mapping
const STATUS_EMOJI: Record<TaskStatus, string> = {
  todo: '⭕',
  in_progress: '🔄',
  done: '✅',
  review: '👀',
  cancelled: '❌',
  focus: '🎯',
};

// Status color for emoji background
const STATUS_EMOJI_BG: Record<TaskStatus, string> = {
  todo: '#f1f5f9',
  in_progress: '#fef3c7',
  done: '#d1fae5',
  review: '#ede9fe',
  cancelled: '#fee2e2',
  focus: '#ede9fe',
};

interface TaskCardProps {
  task: TaskItem;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (taskId: string, e: React.MouseEvent) => void;
  showAssignees?: boolean;
  isFocusSection?: boolean;
  isEvenIndex?: boolean;
}

export function TaskCard({ 
  task, 
  showCheckbox = false,
  isSelected = false,
  onToggleSelect,
  showAssignees = true,
  isFocusSection = false,
  isEvenIndex = true,
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

  return (
    <div 
      onClick={() => navigate(`/tasks/${task.id}`)}
      style={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        gap: '12px', 
        padding: '16px 18px', 
        borderBottom: '1px solid #f1f5f9', 
        cursor: 'pointer',
        background: baseBgColor,
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = hoverBgColor}
      onMouseLeave={(e) => e.currentTarget.style.background = baseBgColor}
    >
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

      {/* Status Emoji */}
      <div style={{ 
        width: '30px', 
        height: '30px', 
        borderRadius: '50%', 
        background: STATUS_EMOJI_BG[task.status],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        flexShrink: 0,
      }}>
        {STATUS_EMOJI[task.status]}
      </div>
      
      {/* Middle: Title + Tags */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {/* Task Title */}
        <p style={{ 
          fontSize: '15px', 
          fontWeight: 600, 
          color: '#111827', 
          margin: 0, 
          lineHeight: 1.4,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {task.title}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '13px' }}>💬</span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              {task.log_count} log{task.log_count === 1 ? '' : 's'}
            </span>
          </div>

          {(task.subtask_count ?? 0) > 0 && (
            <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600, background: '#eef2ff', padding: '4px 8px', borderRadius: '999px' }}>
              {task.subtask_count} sub-task{task.subtask_count === 1 ? '' : 's'}
            </span>
          )}

          <span style={{ 
            fontSize: '12px', 
            fontWeight: 600,
            color: isOverdue(task.due_date) ? '#dc2626' : isDueSoon(task.due_date) ? '#d97706' : '#64748b',
            background: isOverdue(task.due_date) ? '#fef2f2' : isDueSoon(task.due_date) ? '#fffbeb' : '#f8fafc',
            padding: '4px 8px',
            borderRadius: '999px',
          }}>
            {dueDateLabel === '—' ? 'No due date' : dueDateLabel}
          </span>

          {task.tags.length > 0 && (
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: '999px', background: '#f1f5f9', color: '#64748b', maxWidth: '96px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.tags[0]}{task.tags.length > 1 ? ` +${task.tags.length - 1}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Right side: Log Count + Assignees + Due Date */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        flexShrink: 0,
        minHeight: '30px',
      }}>
        {/* Assignees (All Tasks only) */}
        {showAssignees && task.assignees.length > 0 && (
          <div style={{ display: 'flex' }}>
            {task.assignees.slice(0, 2).map((a, i) => (
              <div 
                key={a.id} 
                style={{ 
                  width: '28px', 
                  height: '28px', 
                  borderRadius: '50%', 
                  background: ['#7c3aed', '#ec4899', '#f59e0b', '#10b981'][i % 4], 
                  color: '#fff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '11px', 
                  fontWeight: 600, 
                  marginLeft: i === 0 ? 0 : '-6px', 
                  border: '2px solid #fff',
                  zIndex: task.assignees.length - i,
                  cursor: 'default',
                }}
                title={a.name}
                onClick={(e) => e.stopPropagation()}
              >
                {initials(a.name)}
              </div>
            ))}
            {task.assignees.length > 2 && (
              <div style={{ 
                width: '28px', 
                height: '28px', 
                borderRadius: '50%', 
                background: '#e2e8f0', 
                color: '#64748b', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '10px', 
                fontWeight: 600, 
                marginLeft: '-6px', 
                border: '2px solid #fff',
                cursor: 'default',
              }}
              onClick={(e) => e.stopPropagation()}
              >
                +{task.assignees.length - 2}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
