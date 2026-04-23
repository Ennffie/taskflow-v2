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

  return (
    <div 
      onClick={() => navigate(`/tasks/${task.id}`)}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        padding: '14px 20px', 
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
        width: '28px', 
        height: '28px', 
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
          fontSize: '14px', 
          fontWeight: 500, 
          color: '#111827', 
          margin: 0, 
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {task.title}
        </p>
        
        {/* Tags - below title */}
        {task.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            {task.tags.slice(0, 3).map((tag) => (
              <span key={tag} style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b' }}>
                {tag}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b' }}>
                +{task.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right side: Log Count + Assignees + Due Date */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        flexShrink: 0,
      }}>
        {/* Log Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '14px' }}>💬</span>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
            {task.log_count}
          </span>
        </div>

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
                {a.name.split(' ').map(n => n[0]).join('')}
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

        {/* Due Date - rightmost */}
        <span style={{ 
          fontSize: '12px', 
          fontWeight: 500,
          color: isOverdue(task.due_date) ? '#ef4444' : isDueSoon(task.due_date) ? '#f59e0b' : '#64748b',
          minWidth: '70px',
          textAlign: 'right',
        }}>
          {formatDate(task.due_date)}
        </span>
      </div>
    </div>
  );
}
