import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { AttendanceTrendChart } from '../components/AttendanceTrendChart';
import { fetchAttendanceRecords, updateTodayAttendanceTime } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { getProfileBorderColor, getProfileColor, getProfileInitials, getProfileSoftColor } from '../lib/profileAppearance';
import type { AttendanceLog } from '../types';
import { ArrowLeft, CalendarDays, Clock3 } from 'lucide-react';

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

function statusLabel(record: AttendanceLog) {
  if (record.status === 'present' && record.check_in_at) {
    const d = new Date(record.check_in_at);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return record.status.toUpperCase();
}

export function AttendanceRecordPage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTime, setDraftTime] = useState('09:30');
  const timePickerRef = useRef<HTMLInputElement | null>(null);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const month = new Date().toISOString().slice(0, 7);
      setRecords(await fetchAttendanceRecords({ month }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

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

  const color = getProfileColor(profile);
  const soft = getProfileSoftColor(profile);
  const border = getProfileBorderColor(profile);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!editingId) return;
    window.setTimeout(() => timePickerRef.current?.showPicker?.(), 50);
  }, [editingId]);

  return (
    <AppShell>
      <div style={{ maxWidth: 780, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/canton-mode" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: '#64748b', fontWeight: 800 }}><ArrowLeft size={17} /> Back</Link>
        </div>
        <section style={{ borderRadius: 28, background: '#fff', border: '1px solid #e2e8f0', padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 18, background: color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900 }}>{getProfileInitials(profile?.name)}</div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 950, color: '#0f172a' }}>記錄</div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 700 }}>{new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
            </div>
          </div>
        </section>

        <AttendanceTrendChart records={records} profile={profile} />

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
          {[
            ['平均', formatMinutes(summary.avg)],
            ['最早', formatMinutes(summary.earliest)],
            ['最遲', formatMinutes(summary.latest)],
            ['Off', String(summary.offCount)],
          ].map(([label, value]) => (
            <div key={label} style={{ borderRadius: 20, background: soft, border: `1px solid ${border}`, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 800 }}>{label}</div>
              <div style={{ fontSize: 20, color: '#0f172a', fontWeight: 950, marginTop: 6 }}>{value}</div>
            </div>
          ))}
        </section>

        <section style={{ borderRadius: 24, background: '#fff', border: '1px solid #e2e8f0', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a', fontWeight: 900, marginBottom: 14 }}><CalendarDays size={16} /> Daily record</div>
          {loading ? <div style={{ color: '#64748b', fontWeight: 700 }}>Loading…</div> : records.length === 0 ? <div style={{ color: '#94a3b8' }}>No attendance record yet.</div> : (
            <div style={{ display: 'grid', gap: 10 }}>
              {records.map((record) => {
                const canEditTime = record.date === today && record.status === 'present';
                const currentTime = statusLabel(record);
                return (
                  <div key={record.id} style={{ display: 'grid', gap: 10, padding: '12px 14px', borderRadius: 18, background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>{formatDay(record.date)}</div>
                      {record.note ? <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{record.note}</div> : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {canEditTime ? <button onClick={() => {
                        setEditingId((current) => current === record.id ? null : record.id);
                        setDraftTime(currentTime);
                      }} disabled={savingId === record.id} style={{ borderRadius: 999, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', padding: '7px 10px', fontSize: 12, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: savingId === record.id ? 'default' : 'pointer', opacity: savingId === record.id ? 0.6 : 1 }}><Clock3 size={13} />改時間</button> : null}
                      <div style={{ padding: '7px 10px', borderRadius: 999, background: record.status === 'present' ? soft : '#e2e8f0', color: record.status === 'present' ? color : '#475569', fontSize: 12, fontWeight: 900 }}>{statusLabel(record)}</div>
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
                        <button onClick={async () => {
                          if (!draftTime || draftTime === currentTime) {
                            setEditingId(null);
                            return;
                          }
                          setSavingId(record.id);
                          try {
                            const next = await updateTodayAttendanceTime(draftTime);
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
