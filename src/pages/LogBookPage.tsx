import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Calendar, Users, Tag, MoreVertical, Pencil, Trash2, X } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { LogFormModal } from '../components/LogFormModal';
import { fetchLogs, fetchTask, updateTask, deleteTask, fetchProfiles } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/date';
import { PRIORITY_META, STATUS_META, type LogEntry, type TaskItem, type Profile, type TaskStatus, type TaskPriority } from '../types';
import { panelStyle } from './TaskListPage';

export function LogBookPage() {
  const { taskId = '' } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskItem | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<TaskStatus>('todo');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
  const [editTags, setEditTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const [nextTask, nextLogs, allProfiles] = await Promise.all([
        fetchTask(taskId), 
        fetchLogs(taskId),
        fetchProfiles()
      ]);
      setTask(nextTask);
      setLogs(nextLogs);
      setProfiles(allProfiles);
    } catch (error: any) {
      alert(`Load log book failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, [taskId]);

  const handleEditClick = () => {
    if (!task) return;
    
    // Extract clean description (without log entries)
    // Log entries start with [YYYY-MM-DD] pattern
    const cleanDescription = task.description?.split(/\n\n\[\d{4}-\d{2}-\d{2}\]/)[0] || '';
    
    setEditTitle(task.title);
    setEditDescription(cleanDescription);
    setEditStatus(task.status);
    setEditPriority(task.priority);
    setEditDueDate(task.due_date || '');
    setEditAssigneeIds(task.assignees.map(a => a.id));
    setEditTags(task.tags.join(', '));
    setShowMenu(false);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!task) return;
    setSaving(true);
    try {
      // Extract log entries from current description (anything after [YYYY-MM-DD] pattern)
      const logMatch = task.description?.match(/\n\n(\[\d{4}-\d{2}-\d{2}\].*)/s);
      const logEntries = logMatch ? '\n\n' + logMatch[1] : '';
      
      // Combine clean description with log entries
      const finalDescription = editDescription.trim() + logEntries;
      
      await updateTask(task.id, {
        title: editTitle.trim(),
        description: finalDescription,
        status: editStatus,
        priority: editPriority,
        due_date: editDueDate || null,
      });
      
      // Update assignees
      const { supabase } = await import('../lib/supabase');
      // Remove existing assignees
      await supabase.from('task_assignees').delete().eq('task_id', task.id);
      // Add new assignees
      if (editAssigneeIds.length > 0) {
        await supabase.from('task_assignees').insert(
          editAssigneeIds.map((uid) => ({ task_id: task.id, user_id: uid }))
        );
      }
      
      // Update tags
      await supabase.from('tags').delete().eq('task_id', task.id);
      const newTags = editTags.split(',').map(t => t.trim()).filter(Boolean);
      if (newTags.length > 0) {
        await supabase.from('tags').insert(
          newTags.map((name) => ({ task_id: task.id, name }))
        );
      }
      
      await loadData();
      setShowEditModal(false);
    } catch (error: any) {
      alert(`Update task failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
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

  if (loading) {
    return <AppShell><div style={panelStyle}>Loading log book...</div></AppShell>;
  }

  if (!task) {
    return <AppShell><div style={panelStyle}>Task not found.</div></AppShell>;
  }

  const status = STATUS_META[task.status];
  const priority = PRIORITY_META[task.priority];

  return (
    <AppShell>
      <div style={{ display: 'grid', gap: '16px' }}>
        {/* Back link */}
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#6b7280', fontWeight: 600, fontSize: '14px' }}>
          <ArrowLeft size={16} /> Back to tasks
        </Link>

        {/* Compact Task Info Card with Edit Menu button */}
        <div style={{ 
          background: '#fff', 
          borderRadius: '16px', 
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          position: 'relative',
        }}>
          {/* Edit Menu Button - Top Right */}
          <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: 'none',
                background: '#f3f4f6',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Task Options"
            >
              <MoreVertical size={20} />
            </button>
            
            {/* Dropdown Menu */}
            {showMenu && (
              <div style={{
                position: 'absolute',
                top: '48px',
                right: 0,
                background: '#fff',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                border: '1px solid #e2e8f0',
                minWidth: '160px',
                zIndex: 100,
                overflow: 'hidden',
              }}>
                <button 
                  onClick={handleEditClick}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#374151',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                  <Pencil size={16} color="#6b7280" /> Edit Task
                </button>
                <div style={{ height: '1px', background: '#e2e8f0' }} />
                <button 
                  onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#dc2626',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                  <Trash2 size={16} color="#dc2626" /> Delete Task
                </button>
              </div>
            )}
          </div>

          {/* Title Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', paddingRight: '50px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 }}>{task.title}</h1>
            <div style={{ display: 'flex', gap: '6px' }}>
              <Badge bg={status.bg} color={status.color} text={status.label} />
              <Badge bg={priority.bg} color={priority.color} text={priority.label} />
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, margin: '0 0 14px 0' }}>
              {task.description}
            </p>
          )}

          {/* Info Grid - 3 columns */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
            gap: '12px',
            paddingTop: '14px',
            borderTop: '1px solid #f1f5f9',
          }}>
            {/* Due Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={14} color="#7c3aed" />
              <div>
                <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Due</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  {formatDate(task.due_date) || 'Not set'}
                </div>
              </div>
            </div>

            {/* Assignees */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={14} color="#7c3aed" />
              <div>
                <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Assignees</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  {task.assignees.length ? task.assignees.map(a => a.name.split(' ')[0]).join(', ') : 'Unassigned'}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag size={14} color="#7c3aed" />
              <div>
                <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Tags</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  {task.tags.length ? task.tags.slice(0, 2).join(', ') + (task.tags.length > 2 ? ` +${task.tags.length - 2}` : '') : 'None'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Log Button (Full width - kept for clarity) */}
        <button 
          onClick={() => setShowModal(true)} 
          style={{ 
            width: '100%',
            borderRadius: '12px', 
            border: 'none', 
            background: '#111827', 
            color: '#fff', 
            padding: '14px 20px', 
            fontWeight: 600, 
            fontSize: '15px',
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '8px', 
            cursor: 'pointer' 
          }}
        >
          <Plus size={18} /> Add Log
        </button>

        {/* Logs Section */}
        <section style={{ display: 'grid', gap: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#374151', margin: '8px 0 4px 0' }}>
            Activity ({logs.length})
          </h2>
          
          {logs.length === 0 ? (
            <div style={{ ...panelStyle, textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
              No logs yet. Add the first update for this task.
            </div>
          ) : logs.map((log) => (
            <article key={log.id} style={{ ...panelStyle, padding: '16px 18px' }}>
              {/* Log Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ 
                    borderRadius: '6px', 
                    background: '#ede9fe', 
                    color: '#6d28d9', 
                    padding: '4px 10px', 
                    fontSize: '11px', 
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                  }}>
                    {log.category}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>
                    {formatDate(log.date)}
                  </span>
                  {log.time_spent && (
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#9ca3af' }}>
                      {log.time_spent}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                    {log.created_by_profile?.name || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                    {formatDateTime(log.created_at)}
                  </div>
                </div>
              </div>

              {/* Log Content */}
              <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#111827', margin: '0 0 12px 0' }}>
                {log.event}
              </p>

              {/* Attachment */}
              {log.file_name && (
                <div style={{ 
                  marginTop: '12px', 
                  borderRadius: '8px', 
                  background: '#faf5ff', 
                  padding: '10px 14px', 
                  color: '#6d28d9', 
                  fontWeight: 600,
                  fontSize: '13px',
                }}>
                  📎 {log.file_name}
                </div>
              )}
            </article>
          ))}
        </section>
      </div>

      {/* Edit Task Modal */}
      {showEditModal && (
        <div onClick={() => setShowEditModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '28px', padding: '28px', width: '100%', maxWidth: '600px', maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontSize: '24px', fontWeight: 800 }}>Edit Task</div>
              <button 
                onClick={() => setShowEditModal(false)}
                style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={20} color="#374151" />
              </button>
            </div>

            <div style={{ display: 'grid', gap: '16px' }}>
              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Title *</label>
                <input 
                  value={editTitle} 
                  onChange={(e) => setEditTitle(e.target.value)} 
                  placeholder="Task title..."
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Description</label>
                <textarea 
                  value={editDescription} 
                  onChange={(e) => setEditDescription(e.target.value)} 
                  placeholder="Task description..."
                  rows={3}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', resize: 'vertical' }}
                />
              </div>

              {/* Status & Priority Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Status</label>
                  <select 
                    value={editStatus} 
                    onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', background: '#fff' }}
                  >
                    {Object.entries(STATUS_META).map(([key, meta]) => (
                      <option key={key} value={key}>{meta.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Priority</label>
                  <select 
                    value={editPriority} 
                    onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', background: '#fff' }}
                  >
                    {Object.entries(PRIORITY_META).map(([key, meta]) => (
                      <option key={key} value={key}>{meta.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Due Date</label>
                <input 
                  type="date"
                  value={editDueDate} 
                  onChange={(e) => setEditDueDate(e.target.value)} 
                  style={{ 
                    padding: '12px 14px', 
                    borderRadius: '10px', 
                    border: '1px solid #e2e8f0', 
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    minWidth: '140px'
                  }}
                />
              </div>

              {/* Assignees */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Assignees</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                  {profiles.map((profile) => (
                    <label key={profile.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: editAssigneeIds.includes(profile.id) ? '#ede9fe' : '#f3f4f6', cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={editAssigneeIds.includes(profile.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditAssigneeIds([...editAssigneeIds, profile.id]);
                          } else {
                            setEditAssigneeIds(editAssigneeIds.filter(id => id !== profile.id));
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 500, color: editAssigneeIds.includes(profile.id) ? '#6d28d9' : '#374151' }}>{profile.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Tags (comma separated)</label>
                <input 
                  value={editTags} 
                  onChange={(e) => setEditTags(e.target.value)} 
                  placeholder="design, urgent, frontend..."
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button 
                onClick={() => setShowEditModal(false)} 
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit} 
                disabled={saving || !editTitle.trim()} 
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#111827', color: '#fff', fontWeight: 600, opacity: (saving || !editTitle.trim()) ? 0.6 : 1, cursor: (saving || !editTitle.trim()) ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div onClick={() => setShowDeleteConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px', padding: '28px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={28} color="#dc2626" />
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Delete Task?</div>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>"{task.title}"</strong>?<br />
              This action cannot be undone and all logs will be lost.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete} 
                disabled={deleting} 
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, opacity: deleting ? 0.6 : 1, cursor: deleting ? 'not-allowed' : 'pointer' }}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && <LogFormModal taskId={taskId} onClose={() => setShowModal(false)} onCreated={loadData} />}
    </AppShell>
  );
}

function Badge({ bg, color, text }: { bg: string; color: string; text: string }) {
  return (
    <span style={{ 
      borderRadius: '6px', 
      background: bg, 
      color, 
      padding: '3px 8px', 
      fontSize: '11px', 
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
    }}>
      {text}
    </span>
  );
}
