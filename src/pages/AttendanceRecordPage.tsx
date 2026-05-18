import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { BackButton } from '../components/BackButton';
import { AttendanceTrendChart } from '../components/AttendanceTrendChart';
import { deleteAttendanceRecord, fetchAttendanceRecords, fetchProfiles, updateAttendanceTime, updateTodayAttendanceTime } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { getHongKongDateString } from '../lib/horoscope';
import { getProfileColor, getProfileInitials, getProfileSoftColor } from '../lib/profileAppearance';
import type { AttendanceLog, Profile } from '../types';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Users } from 'lucide-react';

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
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return record.status.toUpperCase();
}

function shouldHideFromAttendancePicker(profile: Profile) {
  const normalized = profile.name.trim().toLowerCase();
  return normalized.includes('claire') || normalized.includes('shani');
}

export function AttendanceRecordPage() {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [records, setRecords] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTime, setDraftTime] = useState('09:30');
  const timePickerRef = useRef<HTMLInputElement | null>(null);
  const [month, setMonth] = useState(() => getHongKongDateString().slice(0, 7));
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showUserPicker, setShowUserPicker] = useState(false);

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
  }, [month, targetUserId]);

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

  useEffect(() => {
    if (!editingId) return;
    window.setTimeout(() => timePickerRef.current?.showPicker?.(), 50);
  }, [editingId]);

  const isSelf = targetUserId === (profile?.id ?? user?.id);
  const pageTitle = isSelf ? '我的記錄' : (targetProfile?.name ?? 'User');

  return (
    <AppShell>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a', fontWeight: 900, marginBottom: 14 }}><CalendarDays size={16} /> Daily record</div>
          {loading ? <div style={{ color: '#64748b', fontWeight: 700 }}>Loading…</div> : records.length === 0 ? <div style={{ color: '#94a3b8' }}>No attendance record yet.</div> : (
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
          )}
        </section>
      </div>
    </AppShell>
  );
}
