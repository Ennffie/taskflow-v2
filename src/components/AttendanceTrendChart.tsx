import type { AttendanceLog, Profile } from '../types';
import { getProfileColor } from '../lib/profileAppearance';

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

function buildTimeDomain(values: number[], baselineMinutes: number) {
  const all = [...values, baselineMinutes];
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const rawSpan = Math.max(0, rawMax - rawMin);
  const targetSpan = Math.max(60, Math.ceil(rawSpan / 60) * 60);
  const center = (rawMin + rawMax) / 2;

  let min = Math.floor((center - targetSpan / 2) / 15) * 15;
  let max = min + targetSpan;

  if (min < 0) {
    max += -min;
    min = 0;
  }
  if (max > 24 * 60) {
    min -= max - 24 * 60;
    max = 24 * 60;
  }
  min = Math.max(0, min);
  max = Math.min(24 * 60, max);

  if (max - min < 60) {
    max = Math.min(24 * 60, min + 60);
  }

  return { min, max, span: max - min };
}

function getTickStep(span: number) {
  if (span <= 60) return 15;
  if (span <= 120) return 30;
  if (span <= 240) return 60;
  return 120;
}

export function AttendanceTrendChart({ records, profile, baselineMinutes = 570, height = 260 }: AttendanceTrendChartProps) {
  const presentRecords = [...records]
    .filter((r) => r.status === 'present' && r.check_in_at)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (presentRecords.length === 0) {
    return <div style={{ height, display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 13, borderRadius: 20, background: '#fff' }}>No present record yet.</div>;
  }

  const points = presentRecords.map((record, index) => ({
    index,
    date: record.date.slice(-2),
    fullDate: record.date,
    minutes: toMinutes(record.check_in_at) ?? baselineMinutes,
    note: record.note,
  }));

  const domain = buildTimeDomain(points.map((point) => point.minutes), baselineMinutes);
  const tickStep = getTickStep(domain.span);
  const ticks: number[] = [];
  for (let value = domain.min; value <= domain.max; value += tickStep) {
    ticks.push(value);
  }
  if (ticks[ticks.length - 1] !== domain.max) {
    ticks.push(domain.max);
  }

  const width = 100;
  const padLeft = 14;
  const padRight = 6;
  const padTop = 8;
  const padBottom = 12;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = 100 - padTop - padBottom;
  const rowStep = points.length === 1 ? 0 : innerHeight / (points.length - 1);
  const xFor = (minutes: number) => padLeft + ((minutes - domain.min) / Math.max(1, domain.max - domain.min)) * innerWidth;
  const yFor = (index: number) => padTop + index * rowStep;
  const baselineX = xFor(baselineMinutes);
  const polyline = points.map((point) => `${xFor(point.minutes)},${yFor(point.index)}`).join(' ');
  const lineColor = getProfileColor(profile);

  return (
    <div style={{ borderRadius: 24, background: '#fff', border: '1px solid #e2e8f0', padding: 14 }}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', height }}>
        {ticks.map((tick) => {
          const x = xFor(tick);
          return (
            <g key={tick}>
              <line x1={x} x2={x} y1={padTop} y2={100 - padBottom} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 2" />
              <text x={x} y={98} textAnchor="middle" fontSize="4" fill="#64748b">{formatMinutes(tick)}</text>
            </g>
          );
        })}

        <line x1={baselineX} x2={baselineX} y1={padTop} y2={100 - padBottom} stroke="#94a3b8" strokeDasharray="3 2" strokeWidth="1.1" />
        <text x={baselineX} y={6} textAnchor="middle" fontSize="4" fill="#64748b">09:30</text>

        {points.map((point) => {
          const y = yFor(point.index);
          return (
            <g key={`${point.fullDate}-${point.index}`}>
              <line x1={padLeft} x2={100 - padRight} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="0.8" />
              <text x={padLeft - 2} y={y + 1.4} textAnchor="end" fontSize="4" fill="#64748b">{point.date}</text>
            </g>
          );
        })}

        <polyline fill="none" stroke={lineColor} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" points={polyline} />

        {points.map((point) => {
          const late = point.minutes > baselineMinutes;
          return (
            <g key={`dot-${point.fullDate}-${point.index}`}>
              <circle cx={xFor(point.minutes)} cy={yFor(point.index)} r="2.8" fill={late ? '#f97316' : lineColor} stroke="#fff" strokeWidth="1.1" />
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: -2, color: '#64748b', fontSize: 12, fontWeight: 700 }}>
        <span>{points.length} days</span>
        <span>{formatMinutes(points[points.length - 1].minutes)}</span>
      </div>
    </div>
  );
}
