import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { AttendanceTrendChart } from '../components/AttendanceTrendChart';
import { fetchAttendanceRecords, fetchProfiles } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { getProfileBorderColor, getProfileColor, getProfileInitials, getProfileSoftColor } from '../lib/profileAppearance';
import type { AttendanceLog, Profile } from '../types';
import { ArrowLeft, Users } from 'lucide-react';

function getMinutes(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function formatMinutes(total: number | null) {
  if (total === null) return '—';
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function AdminAttendancePage() {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [records, setRecords] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    const month = new Date().toISOString().slice(0, 7);
    Promise.all([fetchProfiles(), fetchAttendanceRecords({ month })])
      .then(([profilesData, recordsData]) => {
        setProfiles(profilesData);
        setRecords(recordsData);
        setSelectedUserId((prev) => prev ?? profilesData[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const summaries = useMemo(() => profiles.map((member) => {
    const mine = records.filter((r) => r.user_id === member.id);
    const present = mine.filter((r) => r.status === 'present' && r.check_in_at);
    const minutes = present.map((r) => getMinutes(r.check_in_at)).filter((v): v is number => v !== null);
    const lateCount = minutes.filter((m) => m > 570).length;
    return {
      member,
      records: mine,
      avg: minutes.length ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length) : null,
      lateCount,
      offCount: mine.filter((r) => r.status !== 'present').length,
    };
  }), [profiles, records]);

  const selectedProfile = profiles.find((p) => p.id === selectedUserId) ?? null;
  const selectedRecords = records.filter((r) => r.user_id === selectedUserId);

  if (profile?.role !== 'admin') {
    return <AppShell><div style={{ maxWidth: 720, margin: '0 auto', color: '#64748b', fontWeight: 800 }}>Admin only.</div></AppShell>;
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/canton-mode" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: '#64748b', fontWeight: 800 }}><ArrowLeft size={17} /> Back</Link>
        </div>
        <section style={{ borderRadius: 28, background: '#fff', border: '1px solid #e2e8f0', padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a', fontWeight: 950, fontSize: 28 }}><Users size={24} /> Team Record</div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#64748b', fontWeight: 700 }}>{new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
        </section>

        {loading ? <div style={{ color: '#64748b', fontWeight: 800 }}>Loading…</div> : (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {summaries.map((item) => {
                const color = getProfileColor(item.member);
                const soft = getProfileSoftColor(item.member);
                const border = getProfileBorderColor(item.member);
                return (
                  <button key={item.member.id} onClick={() => setSelectedUserId(item.member.id)} style={{ textAlign: 'left', borderRadius: 22, border: `1px solid ${border}`, background: selectedUserId === item.member.id ? soft : '#fff', padding: 16, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 16, background: color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900 }}>{getProfileInitials(item.member.name)}</div>
                      <div>
                        <div style={{ fontSize: 16, color: '#0f172a', fontWeight: 900 }}>{item.member.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{item.member.role}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
                      <MiniStat label="Avg" value={formatMinutes(item.avg)} color={color} />
                      <MiniStat label="Late" value={String(item.lateCount)} color={item.lateCount ? '#f97316' : color} />
                      <MiniStat label="Off" value={String(item.offCount)} color={color} />
                    </div>
                  </button>
                );
              })}
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 16 }}>
              <AttendanceTrendChart records={selectedRecords} profile={selectedProfile} />
              <div style={{ borderRadius: 24, background: '#fff', border: '1px solid #e2e8f0', padding: 14 }}>
                <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>Monthly grid</div>
                <div style={{ display: 'grid', gap: 8, maxHeight: 240, overflow: 'auto' }}>
                  {summaries.map((item) => {
                    const color = getProfileColor(item.member);
                    return (
                      <div key={item.member.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, alignItems: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.member.name}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {item.records.sort((a, b) => a.date.localeCompare(b.date)).map((record) => (
                            <div key={record.id} title={`${item.member.name} ${record.date} ${record.status}${record.note ? ` · ${record.note}` : ''}`} style={{ minWidth: 28, height: 28, borderRadius: 10, background: getProfileSoftColor(item.member), border: `1px solid ${getProfileBorderColor(item.member)}`, color, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 900, position: 'relative' }}>
                              {record.date.slice(-2)}
                              {record.status !== 'present' ? <span style={{ position: 'absolute', top: -4, right: -2, padding: '1px 4px', borderRadius: 999, background: '#111827', color: '#fff', fontSize: 8 }}>{record.status.toUpperCase()}</span> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return <div style={{ borderRadius: 14, background: '#fff', border: '1px solid #e2e8f0', padding: '10px 8px' }}><div style={{ fontSize: 10, color: '#64748b', fontWeight: 800 }}>{label}</div><div style={{ marginTop: 4, fontSize: 14, color, fontWeight: 900 }}>{value}</div></div>;
}
