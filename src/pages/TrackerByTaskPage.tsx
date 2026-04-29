import { useEffect, useMemo, useState } from 'react';
import { Calendar, Edit3, FileSpreadsheet, FolderKanban } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { fetchAllLogs, fetchProfiles, fetchTasks, updateTask, updateTaskAssignees } from '../lib/api';
import { formatDate, getReportDate } from '../lib/date';
import { buildTrackerRows } from '../lib/report';
import type { LogEntry, Profile, TaskItem } from '../types';
import { panelStyle } from './TaskListPage';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export function TrackerByTaskPage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate] = useState<string>(getReportDate());
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [savingRowKey, setSavingRowKey] = useState<string | null>(null);
  const [draftTodayUpdate, setDraftTodayUpdate] = useState('');
  const [draftNextDayFocus, setDraftNextDayFocus] = useState('');
  const [draftDueDate, setDraftDueDate] = useState('');
  const [draftAssigneeId, setDraftAssigneeId] = useState('');

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    Promise.all([fetchAllLogs(), fetchTasks(), fetchProfiles()])
      .then(([logsData, tasksData, profilesData]) => {
        setLogs(logsData);
        setTasks(tasksData);
        setProfiles(profilesData);
      })
      .catch((error) => alert(`Load tracker failed: ${error.message}`))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const grouped = useMemo(() => {
    const rows = buildTrackerRows(tasks, logs, selectedDate, 'all');
    return rows.reduce<Record<string, typeof rows>>((acc, row) => {
      acc[row.mainTask] = acc[row.mainTask] ?? [];
      acc[row.mainTask].push(row);
      return acc;
    }, {});
  }, [tasks, logs, selectedDate]);

  if (!isAdmin) {
    return <AppShell><div style={panelStyle}>Only admins can access Tracker by Task.</div></AppShell>;
  }

  const startEdit = (row: ReturnType<typeof buildTrackerRows>[number], index: number) => {
    const key = `${row.mainTaskId}-${row.subtaskId ?? 'main'}-${index}`;
    setEditingRowKey(key);
    setDraftTodayUpdate(row.todayUpdate || '');
    setDraftNextDayFocus(row.nextDayFocus || '');
    setDraftDueDate(row.dueDate || '');
    const matchedProfile = profiles.find((item) => item.name === row.member);
    setDraftAssigneeId(matchedProfile?.id || '');
  };

  const cancelEdit = () => {
    setEditingRowKey(null);
    setSavingRowKey(null);
    setDraftTodayUpdate('');
    setDraftNextDayFocus('');
    setDraftDueDate('');
    setDraftAssigneeId('');
  };

  const saveEdit = async (row: ReturnType<typeof buildTrackerRows>[number], index: number) => {
    const key = `${row.mainTaskId}-${row.subtaskId ?? 'main'}-${index}`;
    const targetId = row.subtaskId ?? row.mainTaskId;
    setSavingRowKey(key);
    try {
      await updateTask(targetId, {
        today_update: draftTodayUpdate.trim() || null,
        next_day_focus: draftNextDayFocus.trim() || null,
        due_date: draftDueDate.trim() || null,
      });
      await updateTaskAssignees(targetId, draftAssigneeId ? [draftAssigneeId] : []);
      const [logsData, tasksData, profilesData] = await Promise.all([fetchAllLogs(), fetchTasks(), fetchProfiles()]);
      setLogs(logsData);
      setTasks(tasksData);
      setProfiles(profilesData);
      cancelEdit();
    } catch (error: any) {
      alert(`Save tracker edit failed: ${error?.message || 'Unknown error'}`);
      setSavingRowKey(null);
    }
  };

  return (
    <AppShell>
      <div style={{ display: 'grid', gap: '18px' }}>
        <section style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FolderKanban size={24} color="#7c3aed" /> Tracker by Task
              </div>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '8px 0 0 0' }}>
                Main task group view for {formatDate(selectedDate)}.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Calendar size={16} color="#7c3aed" />
              <span style={{ fontSize: '14px', fontWeight: 700 }}>{formatDate(selectedDate)}</span>
            </div>
            <Link to="/review-export" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: '#111827', color: '#fff', textDecoration: 'none', fontWeight: 700 }}>
              <FileSpreadsheet size={16} /> Final Review
            </Link>
          </div>
        </section>

        {loading ? (
          <div style={panelStyle}>Loading tracker...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={{ ...panelStyle, color: '#6b7280', textAlign: 'center' }}>No tracker data for this date.</div>
        ) : (
          Object.entries(grouped).map(([mainTask, rows], index) => {
            const first = rows[0];
            return (
              <section key={mainTask} style={panelStyle}>
                <div style={{ borderRadius: '16px', padding: '16px 18px', background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', marginBottom: '4px' }}>Order {String(index + 1).padStart(2, '0')}</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>{mainTask}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <MetaBadge label={first.mainTaskStatus || ''} tone={first.mainTaskStatus === 'At Risk' ? 'danger' : 'neutral'} />
                      <MetaBadge label={first.mainTaskProgress || ''} />
                      {first.mainTaskDueDate ? <MetaBadge label={`Due ${formatDate(first.mainTaskDueDate)}`} /> : null}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '10px' }}>
                  {rows.map((row, rowIndex) => (
                    <div key={`${mainTask}-${row.subtask}-${rowIndex}`} style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 16px', background: '#fff' }}>
                      {(() => {
                        const rowKey = `${row.mainTaskId}-${row.subtaskId ?? 'main'}-${rowIndex}`;
                        const isEditing = editingRowKey === rowKey;
                        const isSaving = savingRowKey === rowKey;
                        return (
                          <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{row.subtask || 'Main task level'}</div>
                          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{row.member}</div>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                              <select value={draftAssigneeId} onChange={(e) => setDraftAssigneeId(e.target.value)} style={inlineSelectStyle}>
                                <option value="">Unassigned</option>
                                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                              </select>
                              <input type="date" value={draftDueDate} onChange={(e) => setDraftDueDate(e.target.value)} style={inlineDateStyle} />
                            </div>
                          ) : null}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <MetaBadge label={row.status} tone={row.status === 'Overdue' ? 'danger' : row.status === 'Review' ? 'warning' : 'neutral'} />
                          <MetaBadge label={row.progress} />
                          {row.dueDate ? <MetaBadge label={`Due ${formatDate(row.dueDate)}`} /> : null}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <SummaryCard title="Today Update" content={row.todayUpdate} tone="default" isEditing={isEditing} draftValue={draftTodayUpdate} onDraftChange={setDraftTodayUpdate} />
                        <SummaryCard title="Next Day Focus" content={row.nextDayFocus} tone="purple" isEditing={isEditing} draftValue={draftNextDayFocus} onDraftChange={setDraftNextDayFocus} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        {isEditing ? (
                          <>
                            <button onClick={cancelEdit} style={inlineGhostButtonStyle}>Cancel</button>
                            <button onClick={() => saveEdit(row, rowIndex)} disabled={isSaving} style={inlinePrimaryButtonStyle}>{isSaving ? 'Saving...' : 'Save'}</button>
                          </>
                        ) : (
                          <button onClick={() => startEdit(row, rowIndex)} style={inlineGhostButtonStyle}><Edit3 size={14} /> Inline Edit</button>
                        )}
                      </div>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </AppShell>
  );
}

function SummaryCard({ title, content, tone = 'default', isEditing = false, draftValue = '', onDraftChange }: { title: string; content: string; tone?: 'default' | 'purple'; isEditing?: boolean; draftValue?: string; onDraftChange?: (value: string) => void }) {
  return (
    <div style={{ borderRadius: '12px', padding: '12px 14px', background: tone === 'purple' ? '#faf5ff' : '#f8fafc', border: tone === 'purple' ? '1px solid #e9d5ff' : '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '12px', fontWeight: 800, color: tone === 'purple' ? '#7c3aed' : '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>{title}</div>
      {isEditing ? (
        <textarea value={draftValue} onChange={(e) => onDraftChange?.(e.target.value)} style={inlineTextareaStyle} />
      ) : (
        <div style={{ fontSize: '14px', color: content ? '#111827' : '#94a3b8', whiteSpace: 'pre-wrap' }}>{content || '—'}</div>
      )}
    </div>
  );
}

function MetaBadge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'warning' | 'danger' }) {
  const bg = tone === 'danger' ? '#fee2e2' : tone === 'warning' ? '#fef3c7' : '#f3f4f6';
  const color = tone === 'danger' ? '#b91c1c' : tone === 'warning' ? '#92400e' : '#475569';
  return <span style={{ padding: '6px 10px', borderRadius: '999px', background: bg, color, fontSize: '12px', fontWeight: 700 }}>{label}</span>;
}

const inlineTextareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '90px',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid #d8b4fe',
  fontSize: '13px',
  resize: 'vertical',
  boxSizing: 'border-box',
};

const inlineSelectStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '10px',
  border: '1px solid #d8b4fe',
  background: '#fff',
  fontSize: '12px',
  fontWeight: 600,
};

const inlineDateStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '10px',
  border: '1px solid #d8b4fe',
  background: '#fff',
  fontSize: '12px',
  fontWeight: 600,
};

const inlineGhostButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 10px',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  background: '#fff',
  color: '#111827',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
};

const inlinePrimaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 10px',
  borderRadius: '10px',
  border: 'none',
  background: '#111827',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
};
