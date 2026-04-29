import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, Download, Edit3, Save } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { fetchAllLogs, fetchProfiles, fetchTasks, updateTask, updateTaskAssignees } from '../lib/api';
import { buildTaskReportFilename, formatDate, getReportDate } from '../lib/date';
import { buildTrackerRows } from '../lib/report';
import { buildReviewWarnings, filterRowsByWarning, type ReviewWarningKind } from '../lib/review';
import type { LogEntry, Profile, TaskItem } from '../types';
import { panelStyle } from './TaskListPage';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

type ReviewTab = 'member' | 'task' | 'issues';

export function ReviewBeforeExportPage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRowKey, setSavingRowKey] = useState<string | null>(null);
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [draftTodayUpdate, setDraftTodayUpdate] = useState('');
  const [draftNextDayFocus, setDraftNextDayFocus] = useState('');
  const [draftDueDate, setDraftDueDate] = useState('');
  const [draftAssigneeId, setDraftAssigneeId] = useState('');
  const [reportDate, setReportDate] = useState<string>(getReportDate());
  const [tab, setTab] = useState<ReviewTab>('issues');
  const [activeWarning, setActiveWarning] = useState<ReviewWarningKind | 'all'>('all');

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
      .catch((error) => alert(`Load review failed: ${error.message}`))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const rows = useMemo(() => buildTrackerRows(tasks, logs, reportDate, 'all'), [tasks, logs, reportDate]);
  const warnings = useMemo(() => buildReviewWarnings(rows), [rows]);
  const issueRowsWithReasons = useMemo(() => {
    const getReasons = (row: (typeof rows)[number]) => {
      const reasons: string[] = [];
      if (!row.member || row.member === 'Unassigned') reasons.push('Missing assignee');
      if (row.status === 'Overdue') reasons.push('Overdue');
      return reasons;
    };

    return rows
      .map((row, index) => ({ row, index, reasons: getReasons(row) }))
      .filter((item) => item.reasons.length > 0);
  }, [rows]);

  const issueRows = useMemo(() => {
    if (activeWarning === 'all') return issueRowsWithReasons;
    const filtered = filterRowsByWarning(rows, activeWarning);
    const allowedKeys = new Set(filtered.map((row, index) => `${row.mainTaskId}-${row.subtaskId ?? 'main'}-${index}`));
    return issueRowsWithReasons.filter(({ row, index }) => allowedKeys.has(`${row.mainTaskId}-${row.subtaskId ?? 'main'}-${index}`));
  }, [rows, activeWarning, issueRowsWithReasons]);
  const groupedByMember = useMemo(() => rows.reduce<Record<string, typeof rows>>((acc, row) => {
    const key = row.member || 'Unassigned';
    acc[key] = acc[key] ?? [];
    acc[key].push(row);
    return acc;
  }, {}), [rows]);
  const groupedByTask = useMemo(() => rows.reduce<Record<string, typeof rows>>((acc, row) => {
    acc[row.mainTask] = acc[row.mainTask] ?? [];
    acc[row.mainTask].push(row);
    return acc;
  }, {}), [rows]);

  if (!isAdmin) {
    return <AppShell><div style={panelStyle}>Only admins can access Review Before Export.</div></AppShell>;
  }

  const handleStartEdit = (row: (typeof rows)[number], index: number) => {
    const key = `${row.mainTaskId}-${row.subtaskId ?? 'main'}-${index}`;
    setEditingRowKey(key);
    setDraftTodayUpdate(row.todayUpdate || '');
    setDraftNextDayFocus(row.nextDayFocus || '');
    setDraftDueDate(row.dueDate || '');
    const matchedProfile = profiles.find((item) => item.name === row.member);
    setDraftAssigneeId(matchedProfile?.id || '');
  };

  const handleSaveEdit = async (row: (typeof rows)[number], index: number) => {
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
      setEditingRowKey(null);
      setDraftTodayUpdate('');
      setDraftNextDayFocus('');
      setDraftDueDate('');
      setDraftAssigneeId('');
    } catch (error: any) {
      alert(`Save quick edit failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setSavingRowKey(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingRowKey(null);
    setDraftTodayUpdate('');
    setDraftNextDayFocus('');
    setDraftDueDate('');
    setDraftAssigneeId('');
  };

  return (
    <AppShell>
      <div style={{ display: 'grid', gap: '18px' }}>
        <section style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#111827' }}>Review Before Export</div>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '8px 0 0 0' }}>Final cleanup before generating the xlsx report.</p>
            </div>
            <div style={{ display: 'grid', gap: '8px', justifyItems: 'end' }}>
              <label htmlFor="review-export-date" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                <Calendar size={16} color="#7c3aed" />
                <span style={{ fontSize: '14px', fontWeight: 700 }}>{formatDate(reportDate)}</span>
              </label>
              <input
                id="review-export-date"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value || getReportDate())}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
              />
              <div style={{ fontSize: '13px', color: '#475569' }}>File: <strong>{buildTaskReportFilename(reportDate)}</strong></div>
            </div>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827', marginBottom: '12px' }}>Warnings</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button onClick={() => setActiveWarning('all')} style={warningChip(activeWarning === 'all')}>All Issues ({issueRowsWithReasons.length})</button>
            {warnings.map((warning) => (
              <button key={warning.kind} onClick={() => { setActiveWarning(warning.kind); setTab('issues'); }} style={warningChip(activeWarning === warning.kind, warning.kind === 'overdue' ? 'danger' : 'warning')}>
                <AlertTriangle size={14} /> {warning.count} · {warning.message}
              </button>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <TabButton active={tab === 'member'} onClick={() => setTab('member')}>By Member</TabButton>
            <TabButton active={tab === 'task'} onClick={() => setTab('task')}>By Task</TabButton>
            <TabButton active={tab === 'issues'} onClick={() => setTab('issues')}>Issues Only</TabButton>
          </div>

          {loading ? <div>Loading review…</div> : tab === 'member' ? (
            <div style={{ display: 'grid', gap: '14px' }}>
              {Object.entries(groupedByMember).map(([member, memberRows]) => (
                <div key={member} style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827', marginBottom: '10px' }}>{member}</div>
                  <MiniRows rows={memberRows} profiles={profiles} />
                </div>
              ))}
            </div>
          ) : tab === 'task' ? (
            <div style={{ display: 'grid', gap: '14px' }}>
              {Object.entries(groupedByTask).map(([taskName, taskRows]) => (
                <div key={taskName} style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827', marginBottom: '10px' }}>{taskName}</div>
                  <MiniRows rows={taskRows} profiles={profiles} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {issueRows.length === 0 ? <div style={{ color: '#6b7280' }}>No issues in this filter. Nice ✨</div> : <MiniRows rows={issueRows.map((item) => item.row)} issueReasons={issueRows.map((item) => item.reasons)} profiles={profiles} showTask showActions editingRowKey={editingRowKey} savingRowKey={savingRowKey} draftTodayUpdate={draftTodayUpdate} draftNextDayFocus={draftNextDayFocus} draftDueDate={draftDueDate} draftAssigneeId={draftAssigneeId} onDraftTodayUpdateChange={setDraftTodayUpdate} onDraftNextDayFocusChange={setDraftNextDayFocus} onDraftDueDateChange={setDraftDueDate} onDraftAssigneeIdChange={setDraftAssigneeId} onStartEdit={handleStartEdit} onSaveEdit={handleSaveEdit} onCancelEdit={handleCancelEdit} />}
            </div>
          )}
        </section>

        <section style={{ ...panelStyle, display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>Quick links: <Link to="/tracker/member">Tracker by Member</Link> · <Link to="/tracker/task">Tracker by Task</Link></div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Link to="/tracker/member" style={secondaryLinkStyle}><Save size={16} /> Save Changes in Tracker</Link>
            <Link to="/team-logs" state={{ selectedDate: reportDate }} style={primaryLinkStyle}><Download size={16} /> Export from Team Logs</Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ padding: '10px 14px', borderRadius: '10px', border: 'none', background: active ? '#111827' : '#f3f4f6', color: active ? '#fff' : '#475569', fontWeight: 700, cursor: 'pointer' }}>{children}</button>;
}

function MiniRows({ rows, issueReasons, profiles, showTask = false, showActions = false, editingRowKey, savingRowKey, draftTodayUpdate, draftNextDayFocus, draftDueDate, draftAssigneeId, onDraftTodayUpdateChange, onDraftNextDayFocusChange, onDraftDueDateChange, onDraftAssigneeIdChange, onStartEdit, onSaveEdit, onCancelEdit }: { rows: ReturnType<typeof buildTrackerRows>; issueReasons?: string[][]; profiles: Profile[]; showTask?: boolean; showActions?: boolean; editingRowKey?: string | null; savingRowKey?: string | null; draftTodayUpdate?: string; draftNextDayFocus?: string; draftDueDate?: string; draftAssigneeId?: string; onDraftTodayUpdateChange?: (value: string) => void; onDraftNextDayFocusChange?: (value: string) => void; onDraftDueDateChange?: (value: string) => void; onDraftAssigneeIdChange?: (value: string) => void; onStartEdit?: (row: ReturnType<typeof buildTrackerRows>[number], index: number) => void; onSaveEdit?: (row: ReturnType<typeof buildTrackerRows>[number], index: number) => void; onCancelEdit?: () => void; }) {
  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {rows.map((row, index) => (
        <div key={`${row.mainTask}-${row.subtask}-${index}`} style={{ padding: '12px 14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          {(() => {
            const rowKey = `${row.mainTaskId}-${row.subtaskId ?? 'main'}-${index}`;
            const isEditing = editingRowKey === rowKey;
            const isSaving = savingRowKey === rowKey;
            return (
              <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <div>
              {showTask ? <div style={{ fontSize: '12px', color: '#7c3aed', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>{row.mainTask}</div> : null}
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{row.subtask || row.mainTask}</div>
              {issueReasons?.[index]?.length ? (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {issueReasons[index].map((reason) => (
                    <span key={reason} style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '3px 7px', borderRadius: '999px' }}>{reason}</span>
                  ))}
                </div>
              ) : null}
              {isEditing ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  <select value={draftAssigneeId} onChange={(e) => onDraftAssigneeIdChange?.(e.target.value)} style={quickInlineSelectStyle}>
                    <option value="">Unassigned</option>
                    {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                  </select>
                  <input type="date" value={draftDueDate} onChange={(e) => onDraftDueDateChange?.(e.target.value)} style={quickInlineDateStyle} />
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{row.member} · {row.status} · {row.progress}{row.dueDate ? ` · Due ${formatDate(row.dueDate)}` : ''}</div>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Today Update</div>
              {isEditing ? (
                <textarea value={draftTodayUpdate} onChange={(e) => onDraftTodayUpdateChange?.(e.target.value)} style={quickEditTextareaStyle} />
              ) : (
                <div style={{ fontSize: '13px', color: row.todayUpdate ? '#111827' : '#94a3b8', whiteSpace: 'pre-wrap' }}>{row.todayUpdate || '—'}</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', marginBottom: '4px' }}>Next Day Focus</div>
              {isEditing ? (
                <textarea value={draftNextDayFocus} onChange={(e) => onDraftNextDayFocusChange?.(e.target.value)} style={quickEditTextareaStyle} />
              ) : (
                <div style={{ fontSize: '13px', color: row.nextDayFocus ? '#111827' : '#94a3b8', whiteSpace: 'pre-wrap' }}>{row.nextDayFocus || '—'}</div>
              )}
            </div>
          </div>
          {showActions ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', gap: '10px', flexWrap: 'wrap' }}>
              <Link to={`/tasks/${row.subtaskId ?? row.mainTaskId}`} style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
                Open task to fix →
              </Link>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {isEditing ? (
                  <>
                    <button onClick={() => onCancelEdit?.()} style={quickGhostButtonStyle}>Cancel</button>
                    <button onClick={() => onSaveEdit?.(row, index)} disabled={isSaving} style={quickPrimaryButtonStyle}>{isSaving ? 'Saving...' : 'Save Quick Edit'}</button>
                  </>
                ) : (
                  <button onClick={() => onStartEdit?.(row, index)} style={quickGhostButtonStyle}><Edit3 size={14} /> Quick Edit</button>
                )}
              </div>
            </div>
          ) : null}
              </>
            );
          })()}
        </div>
      ))}
    </div>
  );
}

function warningChip(active: boolean, tone: 'warning' | 'danger' | 'neutral' = 'neutral') {
  const background = active ? '#111827' : tone === 'danger' ? '#fee2e2' : tone === 'warning' ? '#fef3c7' : '#f3f4f6';
  const color = active ? '#fff' : tone === 'danger' ? '#b91c1c' : tone === 'warning' ? '#92400e' : '#475569';
  return {
    display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '999px', border: 'none', background, color, fontWeight: 700, cursor: 'pointer', fontSize: '13px'
  } as const;
}

const primaryLinkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: '#111827', color: '#fff', textDecoration: 'none', fontWeight: 700,
};

const secondaryLinkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: '#fff', color: '#111827', textDecoration: 'none', fontWeight: 700, border: '1px solid #e2e8f0',
};

const quickEditTextareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '88px',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid #d8b4fe',
  fontSize: '13px',
  resize: 'vertical',
  boxSizing: 'border-box',
};

const quickGhostButtonStyle: React.CSSProperties = {
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

const quickPrimaryButtonStyle: React.CSSProperties = {
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

const quickInlineSelectStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '10px',
  border: '1px solid #d8b4fe',
  background: '#fff',
  fontSize: '12px',
  fontWeight: 600,
};

const quickInlineDateStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '10px',
  border: '1px solid #d8b4fe',
  background: '#fff',
  fontSize: '12px',
  fontWeight: 600,
};
