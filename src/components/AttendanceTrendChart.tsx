import type { AttendanceLog, Profile } from '../types';
import { getProfileColor, getProfileSoftColor } from '../lib/profileAppearance';

interface AttendanceTrendChartProps {
  records: AttendanceLog[];
  profile?: Profile | null;
  baselineMinutes?: number;
  height?: number;
}

function toMinutes(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function formatMinutes(total: number) {
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function AttendanceTrendChart({ records, profile, baselineMinutes = 570, height = 220 }: AttendanceTrendChartProps) {
  const presentRecords = [...records]
    .filter((r) => r.status === 'present' && r.check_in_at)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (presentRecords.length === 0) {
    return <div style={{ height, display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 13, borderRadius: 20, background: '#fff' }}>No present record yet.</div>;
  }

  const points = presentRecords.map((record, index) => {
    const minutes = toMinutes(record.check_in_at) ?? baselineMinutes;
    return { index, date: record.date.slice(-2), minutes, note: record.note };
  });

  const minMinutes = Math.min(...points.map((p) => p.minutes), baselineMinutes) - 20;
  const maxMinutes = Math.max(...points.map((p) => p.minutes), baselineMinutes) + 20;
  const width = 100;
  const padX = 8;
  const padY = 18;
  const innerHeight = 100 - padY * 2;
  const step = points.length === 1 ? 0 : (width - padX * 2) / (points.length - 1);
  const yFor = (minutes: number) => padY + (1 - ((minutes - minMinutes) / Math.max(1, maxMinutes - minMinutes))) * innerHeight;
  const baselineY = yFor(baselineMinutes);
  const polyline = points.map((p) => `${padX + p.index * step},${yFor(p.minutes)}`).join(' ');
  const lineColor = getProfileColor(profile);
  const fillColor = getProfileSoftColor(profile);

  return (
    <div style={{ borderRadius: 24, background: '#fff', border: '1px solid #e2e8f0', padding: 14 }}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', height }}>
        <line x1={padX} x2={100 - padX} y1={baselineY} y2={baselineY} stroke="#cbd5e1" strokeDasharray="2 2" strokeWidth="1" />
        <text x={100 - padX} y={baselineY - 2} textAnchor="end" fontSize="4" fill="#64748b">09:30</text>
        <polyline fill="none" stroke={lineColor} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" points={polyline} />
        {points.map((p) => {
          const late = p.minutes > baselineMinutes;
          return (
            <g key={`${p.date}-${p.index}`}>
              <circle cx={padX + p.index * step} cy={yFor(p.minutes)} r="2.8" fill={late ? '#f97316' : lineColor} stroke="#fff" strokeWidth="1.1" />
              <text x={padX + p.index * step} y={96} textAnchor="middle" fontSize="4" fill="#64748b">{p.date}</text>
            </g>
          );
        })}
        <rect x={0} y={0} width={0} height={0} fill={fillColor} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: -4, color: '#64748b', fontSize: 12, fontWeight: 700 }}>
        <span>Trend</span>
        <span>{formatMinutes(points[points.length - 1].minutes)}</span>
      </div>
    </div>
  );
}
