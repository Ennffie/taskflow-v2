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
  if (max - min < 60) max = Math.min(24 * 60, min + 60);

  return { min, max, span: max - min };
}

function getTickStep(span: number) {
  if (span <= 60) return 15;
  if (span <= 120) return 30;
  if (span <= 240) return 60;
  return 120;
}

function getLeaveLabel(status: AttendanceLog['status']) {
  if (status === 'al') return 'AL';
  if (status === 'sl') return 'SL';
  if (status === 'bl') return 'BL';
  if (status === 'other') return 'OFF';
  return '';
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const prev = points[i - 1] ?? current;
    const after = points[i + 2] ?? next;
    const cp1x = current.x + (next.x - prev.x) / 6;
    const cp1y = current.y + (next.y - prev.y) / 6;
    const cp2x = next.x - (after.x - current.x) / 6;
    const cp2y = next.y - (after.y - current.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }
  return d;
}

export function AttendanceTrendChart({ records, profile, baselineMinutes = 570, height = 300 }: AttendanceTrendChartProps) {
  const monthRecords = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const presentRecords = monthRecords.filter((record) => record.status === 'present' && record.check_in_at);

  if (monthRecords.length === 0) {
    return <div style={{ height, display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 13, borderRadius: 20, background: '#fff' }}>No attendance record yet.</div>;
  }

  if (presentRecords.length === 0) {
    return <div style={{ height, display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 13, borderRadius: 20, background: '#fff' }}>No present record yet.</div>;
  }

  const items = monthRecords.map((record, index) => ({
    index,
    date: record.date.slice(-2),
    fullDate: record.date,
    status: record.status,
    label: getLeaveLabel(record.status),
    minutes: record.status === 'present' ? (toMinutes(record.check_in_at) ?? baselineMinutes) : null,
  }));

  const domain = buildTimeDomain(presentRecords.map((record) => toMinutes(record.check_in_at) ?? baselineMinutes), baselineMinutes);
  const tickStep = getTickStep(domain.span);
  const ticks: number[] = [];
  for (let value = domain.min; value <= domain.max; value += tickStep) ticks.push(value);
  if (ticks[ticks.length - 1] !== domain.max) ticks.push(domain.max);

  const dayWidth = 42;
  const svgWidth = Math.max(640, 76 + items.length * dayWidth);
  const chartHeight = height;
  const padLeft = 42;
  const padRight = 12;
  const padTop = 18;
  const padBottom = 34;
  const innerWidth = svgWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;
  const step = items.length === 1 ? 0 : innerWidth / Math.max(1, items.length - 1);
  const xFor = (index: number) => padLeft + index * step;
  const yFor = (minutes: number) => padTop + (1 - ((minutes - domain.min) / Math.max(1, domain.max - domain.min))) * innerHeight;
  const baselineY = yFor(baselineMinutes);
  const presentPoints = items.filter((item) => item.minutes !== null).map((item) => ({ x: xFor(item.index), y: yFor(item.minutes as number), key: item.fullDate, minutes: item.minutes as number }));
  const pathD = buildSmoothPath(presentPoints.map((point) => ({ x: point.x, y: point.y })));
  const lineColor = getProfileColor(profile);

  return (
    <div style={{ borderRadius: 24, background: '#fff', border: '1px solid #e2e8f0', padding: '12px 10px' }}>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, marginBottom: 8 }}>← 左右移動睇全月 →</div>
      <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
        <div style={{ width: svgWidth, minWidth: svgWidth, display: 'inline-block', flex: 'none' }}>
          <svg width={svgWidth} height={chartHeight} style={{ display: 'block', maxWidth: 'none' }}>
          {ticks.map((tick) => {
            const y = yFor(tick);
            return (
              <g key={tick}>
                <line x1={padLeft} x2={svgWidth - padRight} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
                <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize="12" fill="#94a3b8">{formatMinutes(tick)}</text>
              </g>
            );
          })}

          <line x1={padLeft} x2={svgWidth - padRight} y1={baselineY} y2={baselineY} stroke="#94a3b8" strokeDasharray="5 4" strokeWidth="1.2" />
          <text x={svgWidth - padRight} y={baselineY - 6} textAnchor="end" fontSize="12" fill="#94a3b8">09:30</text>

          {items.map((item) => {
            const x = xFor(item.index);
            return (
              <g key={`grid-${item.fullDate}`}>
                <line x1={x} x2={x} y1={padTop} y2={chartHeight - padBottom} stroke="#f1f5f9" strokeWidth="1" />
                <text x={x} y={chartHeight - 10} textAnchor="middle" fontSize="12" fill="#64748b">{item.date}</text>
              </g>
            );
          })}

          {items.filter((item) => item.status !== 'present').map((item) => {
            const x = xFor(item.index);
            return (
              <g key={`leave-${item.fullDate}`}>
                <rect x={x - 5} y={padTop} width={10} height={innerHeight} rx={5} fill="#e5e7eb" opacity="0.9" />
                <text x={x} y={padTop + 14} textAnchor="middle" fontSize="10" fontWeight="700" fill="#6b7280">{item.label}</text>
              </g>
            );
          })}

          <path d={pathD} fill="none" stroke={lineColor} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

          {presentPoints.map((point) => {
            const late = point.minutes > baselineMinutes;
            return (
              <g key={`dot-${point.key}`}>
                <circle cx={point.x} cy={point.y} r="4.5" fill={late ? '#f97316' : lineColor} stroke="#fff" strokeWidth="2" />
              </g>
            );
          })}
          </svg>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, color: '#94a3b8', fontSize: 11, fontWeight: 700 }}>
        <span>{items.length} records</span>
        <span>{formatMinutes(presentPoints[presentPoints.length - 1].minutes)}</span>
      </div>
    </div>
  );
}
