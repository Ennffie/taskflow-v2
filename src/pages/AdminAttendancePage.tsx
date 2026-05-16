import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { BackButton } from '../components/BackButton';
import { AdminAttendanceMultiTrendChart } from '../components/AdminAttendanceMultiTrendChart';
import { fetchAttendanceRecords, fetchProfiles } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { getProfileBorderColor, getProfileColor, getProfileInitials, getProfileSoftColor } from '../lib/profileAppearance';
import type { AttendanceLog, Profile } from '../types';
import { Users } from 'lucide-react';

function getMinutes(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function formatMinutes(total: number | null) {
  if (total === null) return '—';
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function formatStatus(status: AttendanceLog['status']) {
  if (status === 'al') return 'AL';
  if (status === 'sl') return 'SL';
  if (status === 'bl') return 'BL';
  if (status === 'other') return 'OFF';
  return 'Present';
}

export function AdminAttendancePage() {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [records, setRecords] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    const month = new Date().toISOString().slice(0, 7);
    Promise.all([fetchProfiles(), fetchAttendanceRecords({ month, includeAllUsers: true })])
      .then(([profilesData, recordsData]) => {
        setProfiles(profilesData);
        setRecords(recordsData);
      })
      .finally(() => setLoading(false));
  }, []);

  const summaries = useMemo(() => profiles.map((member) => {
    const mine = records.filter((r) => r.user_id === member.id).sort((a, b) => a.date.localeCompare(b.date));
    const present = mine.filter((r) => r.status === 'present' && r.check_in_at);
    const minutes = present.map((r) => getMinutes(r.check_in_at)).filter((v): v is number => v !== null);
    const lateCount = minutes.filter((m) => m > 570).length;
    return {
      member,
      records: mine,
      avg: minutes.length ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length) : null,
      earliest: minutes.length ? Math.min(...minutes) : null,
      latest: minutes.length ? Math.max(...minutes) : null,
      lateCount,
      offCount: mine.filter((r) => r.status !== 'present').length,
    };
  }), [profiles, records]);

  const visibleSummaries = useMemo(() => {
    if (!selectedUserId) return summaries;
    return summaries.filter((item) => item.member.id === selectedUserId);
  }, [selectedUserId, summaries]);

  if (profile?.role !== 'admin') {
    return <AppShell><div style={{ maxWidth: 720, margin: '0 auto', color: '#64748b', fontWeight: 800 }}>Admin only.</div></AppShell>;
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 16 }}>
        <section style={{ borderRadius: 28, background: '#fff', border: '1px solid #e2e8f0', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <BackButton to="/canton-mode" iconOnly style={{ flex: '0 0 auto', padding: 10 }} />
            <div style={{ width: 44, height: 44, borderRadius: 14, background: '#0f172a', color: '#fff', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}><Users size={22} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 950, color: '#0f172a', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Team Record</div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
            </div>
          </div>
        </section>

        {loading ? <div style={{ color: '#64748b', fontWeight: 800 }}>Loading…</div> : (
          <>
            <section style={{ borderRadius: 24, background: '#fff', border: '1px solid #e2e8f0', padding: 12, display: 'grid', gap: 12, overflow: 'hidden' }}>
              <AdminAttendanceMultiTrendChart profiles={profiles} records={records} selectedUserId={selectedUserId} />

              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2, WebkitOverflowScrolling: 'touch' }}>
                <button
                  onClick={() => setSelectedUserId(null)}
                  style={{
                    flex: '0 0 auto',
                    borderRadius: 999,
                    border: '1px solid #e2e8f0',
                    background: selectedUserId === null ? '#0f172a' : '#fff',
                    color: selectedUserId === null ? '#fff' : '#475569',
                    padding: '10px 14px',
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  ALL
                </button>

                {summaries.map((item) => {
                  const color = getProfileColor(item.member);
                  const soft = getProfileSoftColor(item.member);
                  const active = selectedUserId === item.member.id;
                  return (
                    <button
                      key={item.member.id}
                      onClick={() => setSelectedUserId((current) => current === item.member.id ? null : item.member.id)}
                      style={{
                        flex: '0 0 auto',
                        width: 48,
                        height: 48,
                        borderRadius: 18,
                        border: active ? `2px solid ${color}` : '1px solid #e2e8f0',
                        background: active ? soft : '#fff',
                        color,
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 900,
                        cursor: 'pointer',
                        boxShadow: active ? '0 8px 18px rgba(15,23,42,0.08)' : 'none',
                      }}
                      title={item.member.name}
                    >
                      {getProfileInitials(item.member.name)}
                    </button>
                  );
                })}
              </div>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {visibleSummaries.map((item) => {
                const color = getProfileColor(item.member);
                const soft = getProfileSoftColor(item.member);
                const border = getProfileBorderColor(item.member);
                const recent = [...item.records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
                return (
                  <div key={item.member.id} style={{ borderRadius: 22, border: `1px solid ${border}`, background: '#fff', padding: 16, display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 16, background: color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900 }}>{getProfileInitials(item.member.name)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 16, color: '#0f172a', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.member.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{item.member.role}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: '#64748b', fontSize: 13, fontWeight: 700 }}>
                      {[
                        ['平均', formatMinutes(item.avg)],
                        ['最早', formatMinutes(item.earliest)],
                        ['最遲', formatMinutes(item.latest)],
                        ['Off', String(item.offCount)],
                        ['Late', String(item.lateCount)],
                      ].map(([label, value], index, array) => (
                        <div key={label} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ color: '#94a3b8' }}>{label}</span>
                          <span style={{ color: '#334155', fontWeight: 900 }}>{value}</span>
                          {index < array.length - 1 ? <span style={{ color: '#cbd5e1' }}>·</span> : null}
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {recent.map((record) => (
                        <div key={record.id} style={{ padding: '7px 10px', borderRadius: 999, background: record.status === 'present' ? soft : '#f3f4f6', border: `1px solid ${record.status === 'present' ? border : '#e5e7eb'}`, color: record.status === 'present' ? color : '#6b7280', fontSize: 11, fontWeight: 900 }}>
                          {record.date.slice(5)} · {record.status === 'present' ? formatMinutes(getMinutes(record.check_in_at)) : formatStatus(record.status)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
