import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { BackButton } from '../components/BackButton';
import { AttendanceTrendChart } from '../components/AttendanceTrendChart';
import { deleteAttendanceRecord, fetchAttendanceRecords, fetchProfiles, updateAttendanceStatus, updateAttendanceTime, updateTodayAttendanceTime } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { getHongKongDateString } from '../lib/horoscope';
import { getProfileColor, getProfileInitials, getProfileSoftColor } from '../lib/profileAppearance';
import { getPublicHolidayInfo } from '../lib/specialDays';
import type { AttendanceLog, AttendanceStatus, Profile } from '../types';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, List, Users } from 'lucide-react';

function formatMinutes(total: number | null) {
  if (total === null) return '—';
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function getMinutes(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function formatDay(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function shiftMonth(month: string, delta: number) {
  const [year, mm] = month.split('-').map(Number);
  const next = new Date(year, mm - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(month: string) {
  const [year, mm] = month.split('-').map(Number);
  return new Date(year, mm - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function statusLabel(record: AttendanceLog) {
  if (record.status === 'present' && record.check_in_at) {
    const d = new Date(record.check_in_at);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return record.status.toUpperCase();
}

function shouldHideFromAttendancePicker(profile: Profile) {
  const normalized = profile.name.trim().toLowerCase();
  return normalized.includes('claire') || normalized.includes('shani');
}

function buildMonthCalendar(month: string) {
  const [year, mm] = month.split('-').map(Number);
  const firstDay = new Date(year, mm - 1, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, mm, 0).getDate();
  const cells: Array<{ date: string | null; day: number | null }> = [];

  for (let i = 0; i < firstWeekday; i++) cells.push({ date: null, day: null });
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(mm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ date, day });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
  return cells;
}

export function AttendanceRecordPage() {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [records, setRecords] = useState<AttendanceLog[]>([]);
  const [allRecords, setAllRecords] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAll, setLoadingAll] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [leaveType, setLeaveType] = useState<AttendanceStatus>('al');
  const [leaveTime, setLeaveTime] = useState<'full' | 'am' | 'pm'>('full');
  const [savingLeave, setSavingLeave] = useState(false);
  const [flashDate, setFlashDate] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [draftTime, setDraftTime] = useState('09:30');
  const timePickerRef = useRef<HTMLInputElement | null>(null);
  const [month, setMonth] = useState(() => getHongKongDateString().slice(0, 7));
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const loadAllRecords = async () => {
    if (!isAdmin) return;
    setLoadingAll(true);
    try {
      setAllRecords(await fetchAttendanceRecords({ month, includeAllUsers: true }));
    } catch (e) {
      console.error('Failed to load all records:', e);
    } finally {
      setLoadingAll(false);
    }
  };

  const targetUserId = selectedUserId ?? profile?.id ?? user?.id ?? null;
  const targetProfile = profiles.find((p) => p.id === targetUserId) ?? profile;

  const loadRecords = async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      setRecords(await fetchAttendanceRecords({ month, userId: targetUserId }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      void fetchProfiles()
        .then((items) => setProfiles(items.filter((item) => !shouldHideFromAttendancePicker(item))))
        .catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadRecords();
    setEditingId(null);
    if (viewMode === 'calendar') {
      void loadAllRecords();
    }
  }, [month, targetUserId, viewMode]);

  const summary = useMemo(() => {
    const present = records.filter((r) => r.status === 'present' && r.check_in_at);
    const minutes = present.map((r) => getMinutes(r.check_in_at)).filter((v): v is number => v !== null);
    const offCount = records.filter((r) => r.status !== 'present').length;
    return {
      avg: minutes.length ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length) : null,
      earliest: minutes.length ? Math.min(...minutes) : null,
      latest: minutes.length ? Math.max(...minutes) : null,
      offCount,
    };
  }, [records]);

  const color = getProfileColor(targetProfile);
  const soft = getProfileSoftColor(targetProfile);
  const today = getHongKongDateString();
  const recordMap = useMemo(() => new Map(records.map((record) => [record.date, record])), [records]);
  const calendarCells = useMemo(() => buildMonthCalendar(month), [month]);

  useEffect(() => {
    if (!editingId) return;
    window.setTimeout(() => timePickerRef.current?.showPicker?.(), 50);
  }, [editingId]);

  useEffect(() => {
    if (!showDateSheet) return;
    let cancelled = false;
    const scroll = () => {
      if (cancelled) return;
      if (sheetRef.current) {
        sheetRef.current.scrollTo({ top: 200, behavior: 'smooth' });
      }
    };
    const raf = requestAnimationFrame(() => {
      setTimeout(scroll, 500);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [showDateSheet]);

  useEffect(() => {
    if (!flashDate) return;
    const el = document.querySelector(`[data-flash-date="${flashDate}"]`) as HTMLElement | null;
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = 'flashSuccess 0.7s ease-out';
    const onEnd = () => {
      el.style.animation = '';
      el.removeEventListener('animationend', onEnd);
    };
    el.addEventListener('animationend', onEnd);
    const fallbackTimer = window.setTimeout(() => {
      el.style.animation = '';
    }, 800);
    return () => {
      window.clearTimeout(fallbackTimer);
      el.removeEventListener('animationend', onEnd);
    };
  }, [flashDate]);

  const isSelf = targetUserId === (profile?.id ?? user?.id);
  const pageTitle = isSelf ? '我的記錄' : (targetProfile?.name ?? 'User');

  return (
    <AppShell>
      <style>{`@keyframes flashSuccess { 0% { background: rgba(168, 85, 247, 0.2); } 100% { background: transparent; } }`}</style>
      <div style={{ width: '100%', maxWidth: 780, minWidth: 0, margin: '0 auto', display: 'grid', gap: 16 }}>
        <section style={{ borderRadius: 28, background: '#fff', border: '1px solid #e2e8f0', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <BackButton to="/canton-mode" iconOnly style={{ flex: '0 0 auto', padding: 10 }} />
            <div style={{ width: 44, height: 44, borderRadius: 14, background: color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, flex: '0 0 auto' }}>{getProfileInitials(targetProfile?.name)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 950, color: '#0f172a', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pageTitle}
                </div>
                {isAdmin ? (
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setShowUserPicker((c) => !c)}
                      style={{ borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', padding: '6px 10px', fontSize: 12, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                    >
                      <Users size={13} /> 揀人
                    </button>
                    {showUserPicker ? (
                      <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 20, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 8, boxShadow: '0 10px 28px rgba(0,0,0,0.12)', minWidth: 160, maxHeight: 260, overflowY: 'auto' }}>
                        <button
                          onClick={() => { setSelectedUserId(null); setShowUserPicker(false); }}
                          style={{ width: '100%', textAlign: 'left', borderRadius: 10, border: 'none', background: selectedUserId === null ? '#f1f5f9' : 'transparent', color: '#0f172a', padding: '8px 10px', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}
                        >
                          自己 ({profile?.name ?? 'Me'})
                        </button>
                        {profiles.filter((p) => p.id !== profile?.id).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => { setSelectedUserId(p.id); setShowUserPicker(false); }}
                            style={{ width: '100%', textAlign: 'left', borderRadius: 10, border: 'none', background: selectedUserId === p.id ? '#f1f5f9' : 'transparent', color: '#0f172a', padding: '8px 10px', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                          >
                            <div style={{ width: 22, height: 22, borderRadius: 7, background: getProfileColor(p), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 900, flex: '0 0 auto' }}>{getProfileInitials(p.name)}</div>
                            {p.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              
            </div>
          </div>
        </section>

        <section style={{ width: '100%', minWidth: 0, borderRadius: 24, background: '#fff', border: '1px solid #e2e8f0', padding: 12, display: 'grid', gap: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => setMonth((current) => shiftMonth(current, -1))} style={{ width: 40, height: 40, borderRadius: 14, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', display: 'grid', placeItems: 'center', cursor: 'pointer' }} aria-label="Previous month">
              <ChevronLeft size={18} />
            </button>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', flex: '1 1 140px', textAlign: 'center' }}>{formatMonthLabel(month)}</div>
            <button onClick={() => setMonth((current) => shiftMonth(current, 1))} style={{ width: 40, height: 40, borderRadius: 14, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', display: 'grid', placeItems: 'center', cursor: 'pointer' }} aria-label="Next month">
              <ChevronRight size={18} />
            </button>
          </div>

          <AttendanceTrendChart records={records} profile={targetProfile} />
        </section>

        <section style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: '#64748b', fontSize: 13, fontWeight: 700 }}>
          {[
            ['平均', formatMinutes(summary.avg)],
            ['最早', formatMinutes(summary.earliest)],
            ['最遲', formatMinutes(summary.latest)],
            ['Off', String(summary.offCount)],
          ].map(([label, value], index, array) => (
            <div key={label} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ color: '#94a3b8', fontWeight: 700 }}>{label}</span>
              <span style={{ color: '#334155', fontWeight: 900 }}>{value}</span>
              {index < array.length - 1 ? <span style={{ color: '#cbd5e1' }}>·</span> : null}
            </div>
          ))}
        </section>

        <section style={{ borderRadius: 24, background: '#fff', border: '1px solid #e2e8f0', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a', fontWeight: 900 }}><CalendarDays size={16} /> Daily record</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: 4, borderRadius: 999, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <button onClick={() => setViewMode('list')} style={{ borderRadius: 999, border: 'none', background: viewMode === 'list' ? '#0f172a' : 'transparent', color: viewMode === 'list' ? '#fff' : '#64748b', padding: '8px 12px', fontSize: 12, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><List size={13} /> List</button>
              <button onClick={() => setViewMode('calendar')} style={{ borderRadius: 999, border: 'none', background: viewMode === 'calendar' ? '#0f172a' : 'transparent', color: viewMode === 'calendar' ? '#fff' : '#64748b', padding: '8px 12px', fontSize: 12, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><CalendarDays size={13} /> Calendar</button>
            </div>
          </div>
          {loading ? <div style={{ color: '#64748b', fontWeight: 700 }}>Loading…</div> : records.length === 0 && viewMode === 'list' ? <div style={{ color: '#94a3b8' }}>No attendance record yet.</div> : viewMode === 'list' ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {records.map((record) => {
                const canEditTime = (isAdmin || (isSelf && record.date === today)) && record.status === 'present';
                const currentTime = statusLabel(record);
                return (
                  <div key={record.id} style={{ display: 'grid', gap: 10, padding: '12px 14px', borderRadius: 18, background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>{formatDay(record.date)}</div>
                      {record.note ? <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{record.note}</div> : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {canEditTime ? (
                        <button
                          onClick={() => {
                            setEditingId((current) => current === record.id ? null : record.id);
                            setDraftTime(currentTime);
                          }}
                          disabled={savingId === record.id}
                          style={{ borderRadius: 999, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', padding: '7px 10px', fontSize: 12, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: savingId === record.id ? 'default' : 'pointer', opacity: savingId === record.id ? 0.6 : 1 }}
                        >
                          <Clock3 size={13} />改時間
                        </button>
                      ) : null}
                      <div
                        onClick={() => {
                          if (isAdmin && record.status === 'present') {
                            setEditingId((current) => current === record.id ? null : record.id);
                            setDraftTime(currentTime);
                          }
                        }}
                        style={{
                          padding: '7px 10px',
                          borderRadius: 999,
                          background: record.status === 'present' ? soft : '#e2e8f0',
                          color: record.status === 'present' ? color : '#475569',
                          fontSize: 12,
                          fontWeight: 900,
                          cursor: isAdmin && record.status === 'present' ? 'pointer' : 'default',
                        }}
                      >
                        {statusLabel(record)}
                      </div>
                    </div>
                  </div>
                  {editingId === record.id ? (
                    <div style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 16, background: '#fff', border: '1px solid #e2e8f0' }}>
                      <input
                        ref={timePickerRef}
                        type="time"
                        value={draftTime}
                        onChange={(event) => setDraftTime(event.target.value)}
                        style={{ width: '100%', borderRadius: 14, border: '1px solid #cbd5e1', padding: '12px 14px', fontSize: 16, fontWeight: 800, color: '#0f172a', background: '#fff' }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setEditingId(null)} style={{ flex: 1, borderRadius: 14, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', padding: '10px 12px', fontSize: 13, fontWeight: 900 }}>算啦</button>
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Delete ${formatDay(record.date)} attendance record?`)) return;
                            setSavingId(record.id);
                            try {
                              await deleteAttendanceRecord(record);
                              setRecords((current) => current.filter((item) => item.id !== record.id));
                              setEditingId(null);
                            } catch (error: any) {
                              alert(`Delete record failed: ${error?.message || 'Unknown error'}`);
                            } finally {
                              setSavingId(null);
                            }
                          }}
                          disabled={savingId === record.id}
                          style={{ flex: 1, borderRadius: 14, border: '1px solid #fecdd3', background: '#fff1f2', color: '#be123c', padding: '10px 12px', fontSize: 13, fontWeight: 900, opacity: savingId === record.id ? 0.7 : 1 }}
                        >删除</button>
                        <button onClick={async () => {
                          if (!draftTime || draftTime === currentTime) {
                            setEditingId(null);
                            return;
                          }
                          setSavingId(record.id);
                          try {
                            const next = isSelf && record.date === today
                              ? await updateTodayAttendanceTime(draftTime)
                              : await updateAttendanceTime(record.date, draftTime);
                            setRecords((current) => current.map((item) => item.id === record.id ? next : item));
                            setEditingId(null);
                          } catch (error: any) {
                            alert(`Update time failed: ${error?.message || 'Unknown error'}`);
                          } finally {
                            setSavingId(null);
                          }
                        }} disabled={savingId === record.id} style={{ flex: 1, borderRadius: 14, border: 'none', background: '#0f172a', color: '#fff', padding: '10px 12px', fontSize: 13, fontWeight: 900, opacity: savingId === record.id ? 0.7 : 1 }}>儲存</button>
                      </div>
                    </div>
                  ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 2 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2 }}>
                {['日','一','二','三','四','五','六'].map((label) => (
                  <div key={label} style={{ textAlign: 'center', fontSize: 8, fontWeight: 900, color: '#94a3b8', padding: '1px 0' }}>{label}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2 }}>
                {calendarCells.map((cell, index) => {
                  if (!cell.date || !cell.day) return <div key={`empty-${index}`} style={{ minHeight: 48, borderRadius: 10, background: '#f8fafc' }} />;
                  const record = recordMap.get(cell.date);
                  const holiday = getPublicHolidayInfo(new Date(`${cell.date}T00:00:00`));
                  const isToday = cell.date === today;
                  const hasRecord = !!record;
                  const isLeave = record?.status && record.status !== 'present';
                  return (
                    <div
                      key={cell.date}
                      data-flash-date={cell.date}
                      onClick={() => {
                        setSelectedDate(cell.date);
                        setShowDateSheet(true);
                        setLeaveTime('full');
                        setLeaveType('al');
                      }}
                      style={{ minHeight: 48, borderRadius: 10, border: isToday ? `1.5px solid ${color}` : '1px solid #e2e8f0', background: holiday ? '#fff7ed' : '#f8fafc', padding: '4px 0 4px 6px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 2, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                    >
                      <div style={{ fontSize: 8, fontWeight: 800, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.02em' }}>{cell.day}</div>
                      {holiday ? (
                        <div style={{ fontSize: 7, lineHeight: 1, color: '#c2410c', fontWeight: 800 }}>{holiday.name.slice(0,2)}</div>
                      ) : hasRecord ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                          {isLeave ? (
                            <div style={{ fontSize: 9, fontWeight: 900, color: '#9a3412', lineHeight: 1, padding: '1px 4px', borderRadius: 3, background: '#fee2e2' }}>
                              {record.status === 'al' ? 'AL' : record.status === 'sl' ? 'SL' : record.status === 'bl' ? 'BL' : 'OFF'}
                            </div>
                          ) : (
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                          )}
                        </div>
                      ) : null}
                      {isLeave && !holiday ? (
                        <div style={{ position: 'absolute', bottom: 1, left: '25%', right: '25%', height: 1.5, background: record.status === 'al' ? '#34C759' : record.status === 'sl' ? '#FFCC00' : record.status === 'bl' ? '#FF3B30' : '#FF9500', borderRadius: 1 }} />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showDateSheet && selectedDate ? (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowDateSheet(false);
              }}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }} />
              <div
                ref={sheetRef}
                style={{
                  position: 'relative',
                  background: '#fff',
                  borderRadius: '24px 24px 0 0',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                  boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
                  animation: 'slideUp 0.25s ease-out',
                  scrollBehavior: 'smooth',
                  paddingBottom: 120,
                }}
              >
                <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

                <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 950, color: '#0f172a' }}>
                      {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('zh-HK', { month: 'long', day: 'numeric', weekday: 'short' })}
                    </div>
                  </div>
                  <button onClick={() => setShowDateSheet(false)} style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', color: '#a855f7', padding: '8px 14px', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>關閉</button>
                </div>

                {(() => {
                  const myRecord = recordMap.get(selectedDate);
                  const dayRecords = allRecords.filter((r) => r.date === selectedDate && r.user_id !== (profile?.id ?? user?.id));
                  const leaveOptions: Array<{ status: AttendanceStatus; label: string; emoji: string; color: string; bg: string; lightBg: string }> = [
                    { status: 'al', label: '年假', emoji: '🌴', color: '#fff', bg: '#34C759', lightBg: '#ecfdf3' },
                    { status: 'sl', label: '病假', emoji: '🤒', color: '#fff', bg: '#FFCC00', lightBg: '#fefce8' },
                    { status: 'bl', label: '無薪假', emoji: '💸', color: '#fff', bg: '#FF3B30', lightBg: '#fef2f2' },
                    { status: 'other', label: '生日假', emoji: '🎂', color: '#fff', bg: '#FF9500', lightBg: '#fff7ed' },
                  ];
                  const timeOptions = [
                    { key: 'full', label: '全日' },
                    { key: 'am', label: '上午' },
                    { key: 'pm', label: '下午' },
                  ] as const;
                  return (
                    <div style={{ padding: '0 16px 24px', display: 'grid', gap: 16 }}>

                      <div style={{ textAlign: 'center', marginBottom: 4 }}>
                        <div style={{ fontSize: 12, color: '#a855f7', fontWeight: 700, marginBottom: 4 }}>預先請假 · {selectedDate}</div>
                        <div style={{ fontSize: 11, color: '#c084fc', fontWeight: 600 }}>撳一下就可以預先記低假期</div>
                      </div>

                      {myRecord && myRecord.status !== 'present' ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0', animation: 'fadeIn 0.3s ease' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: myRecord.status === 'al' ? '#34C759' : myRecord.status === 'sl' ? '#FFCC00' : myRecord.status === 'bl' ? '#FF3B30' : '#FF9500' }} />
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>{leaveOptions.find((o) => o.status === myRecord.status)?.label ?? myRecord.status.toUpperCase()}</div>
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{myRecord.note ?? '全日'}</div>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              if (!window.confirm('確定要删除呢筆記錄？')) return;
                              setSavingLeave(true);
                              try {
                                await deleteAttendanceRecord(myRecord);
                                setRecords((current) => current.filter((r) => r.id !== myRecord.id));
                                setAllRecords((current) => current.filter((r) => r.id !== myRecord.id));
                              } catch (error: any) {
                                alert(`Delete failed: ${error?.message || 'Unknown error'}`);
                              } finally {
                                setSavingLeave(false);
                              }
                            }}
                            disabled={savingLeave}
                            style={{ borderRadius: 10, border: '1px solid #fecdd3', background: '#fff1f2', color: '#be123c', padding: '6px 10px', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}
                          >
                            删除
                          </button>
                        </div>
                      ) : null}

                      {leaveOptions.map((opt) => (
                        <div key={opt.status} style={{ display: 'grid', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 900, color: '#0f172a' }}>
                            <span>{opt.emoji}</span>
                            {opt.label}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {timeOptions.map((t) => {
                              const isSelected = leaveType === opt.status && leaveTime === t.key;
                              return (
                                <button
                                  key={t.key}
                                  onClick={() => {
                                    setLeaveType(opt.status);
                                    setLeaveTime(t.key);
                                  }}
                                  style={{
                                    borderRadius: 14,
                                    border: isSelected ? 'none' : '1px solid #e2e8f0',
                                    background: isSelected ? opt.bg : '#fff',
                                    color: isSelected ? opt.color : '#475569',
                                    padding: '12px 8px',
                                    fontSize: 13,
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    flex: 1,
                                    transition: 'all 0.2s ease',
                                    transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                                    boxShadow: isSelected ? `0 2px 8px ${opt.bg}40` : 'none',
                                  }}
                                >
                                  {t.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={async () => {
                          setSavingLeave(true);
                          try {
                            const note = leaveTime === 'full' ? '全日' : leaveTime === 'am' ? '上午' : '下午';
                            const updated = await updateAttendanceStatus(selectedDate, leaveType, note);
                            setRecords((current) => {
                              const filtered = current.filter((r) => r.date !== selectedDate);
                              return [...filtered, updated];
                            });
                            setAllRecords((current) => {
                              const filtered = current.filter((r) => !(r.date === selectedDate && r.user_id === updated.user_id));
                              return [...filtered, updated];
                            });
                            setFlashDate(selectedDate);
                            setShowDateSheet(false);
                          } catch (error: any) {
                            alert(`更新失敗: ${error?.message || 'Unknown error'}`);
                          } finally {
                            setSavingLeave(false);
                          }
                        }}
                        disabled={savingLeave}
                        style={{
                          borderRadius: 16,
                          border: 'none',
                          background: 'linear-gradient(135deg, #a855f7, #c084fc)',
                          color: '#fff',
                          padding: '16px',
                          fontSize: 15,
                          fontWeight: 950,
                          cursor: savingLeave ? 'default' : 'pointer',
                          opacity: savingLeave ? 0.7 : 1,
                          marginTop: 8,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {savingLeave ? '儲存緊…' : '確認請假'}
                      </button>

                      {myRecord && myRecord.status !== 'present' ? (
                        <button
                          onClick={async () => {
                            if (!window.confirm('確定要清除此日記錄？')) return;
                            setSavingLeave(true);
                            try {
                              await deleteAttendanceRecord(myRecord);
                              setRecords((current) => current.filter((r) => r.id !== myRecord.id));
                              setAllRecords((current) => current.filter((r) => r.id !== myRecord.id));
                              setShowDateSheet(false);
                            } catch (error: any) {
                              alert(`Delete failed: ${error?.message || 'Unknown error'}`);
                            } finally {
                              setSavingLeave(false);
                            }
                          }}
                          disabled={savingLeave}
                          style={{
                            borderRadius: 16,
                            border: 'none',
                            background: 'transparent',
                            color: '#ef4444',
                            padding: '12px',
                            fontSize: 14,
                            fontWeight: 900,
                            cursor: 'pointer',
                          }}
                        >
                          清除此日記錄
                        </button>
                      ) : null}

                      {dayRecords.length > 0 ? (
                        <div style={{ display: 'grid', gap: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Users size={14} /> 團隊動態
                          </div>
                          <div style={{ display: 'grid', gap: 8 }}>
                            {dayRecords.map((r) => {
                              const p = profiles.find((prof) => prof.id === r.user_id);
                              const pColor = getProfileColor(p);
                              const pInitials = getProfileInitials(p?.name ?? '??');
                              return (
                                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 14, background: '#f8fafc' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 10, background: pColor, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 900, flex: '0 0 auto' }}>{pInitials}</div>
                                    <div>
                                      <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>{p?.name ?? 'Unknown'}</div>
                                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{r.note ?? '—'}</div>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.status === 'al' ? '#34C759' : r.status === 'sl' ? '#FFCC00' : r.status === 'bl' ? '#FF3B30' : '#FF9500' }} />
                                    <div style={{ fontSize: 12, fontWeight: 900, color: '#475569' }}>{leaveOptions.find((o) => o.status === r.status)?.label ?? r.status.toUpperCase()}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : loadingAll ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 700 }}>Loading 團隊動態…</div>
                      ) : null}

                      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
// force rebuild 1779214355
