import type { AttendanceLog, Profile } from '../types';
import { formatThresholdLabel, getLateThresholdMinutes, isLateCheckIn } from '../lib/attendanceRules';
import { getProfileColor } from '../lib/profileAppearance';

interface AdminAttendanceMultiTrendChartProps {
  profiles: Profile[];
  records: AttendanceLog[];
  selectedUserId?: string | null;
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
  const rawMin = Math.min(...all) - 15;
  const rawMax = Math.max(...all) + 15;
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

export function AdminAttendanceMultiTrendChart({ profiles, records, selectedUserId = null, baselineMinutes = 570, height = 320 }: AdminAttendanceMultiTrendChartProps) {
  const singleProfileThreshold = selectedUserId ? getLateThresholdMinutes(profiles.find((profile) => profile.id === selectedUserId) ?? null) : baselineMinutes;
  const activeProfiles = selectedUserId ? profiles.filter((profile) => profile.id === selectedUserId) : profiles;
  const dates = Array.from(new Set(records.map((record) => record.date))).sort();
  const presentRecords = records.filter((record) => record.status === 'present' && record.check_in_at && activeProfiles.some((profile) => profile.id === record.user_id));

  if (dates.length === 0 || presentRecords.length === 0) {
    return <div style={{ height, display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 13, borderRadius: 20, background: '#fff', border: '1px solid #e2e8f0' }}>No attendance record yet.</div>;
  }

  const domain = buildTimeDomain(presentRecords.map((record) => toMinutes(record.check_in_at) ?? singleProfileThreshold), singleProfileThreshold);
  const tickStep = getTickStep(domain.span);
  const ticks: number[] = [];
  for (let value = domain.min; value <= domain.max; value += tickStep) ticks.push(value);
  if (ticks[ticks.length - 1] !== domain.max) ticks.push(domain.max);

  const dayWidth = 42;
  const svgWidth = Math.max(640, 76 + dates.length * dayWidth);
  const chartHeight = height;
  const padLeft = 42;
  const padRight = 12;
  const padTop = 26;
  const padBottom = 38;
  const innerWidth = svgWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;
  const step = dates.length === 1 ? 0 : innerWidth / Math.max(1, dates.length - 1);
  const xFor = (index: number) => padLeft + index * step;
  const yFor = (minutes: number) => padTop + (1 - ((minutes - domain.min) / Math.max(1, domain.max - domain.min))) * innerHeight;
  const baselineY = yFor(singleProfileThreshold);

  const lines = activeProfiles.map((profile) => {
    const myRecords = records.filter((record) => record.user_id === profile.id);
    const points = dates
      .map((date, index) => {
        const record = myRecords.find((item) => item.date === date && item.status === 'present' && item.check_in_at);
        const minutes = record ? (toMinutes(record.check_in_at) ?? baselineMinutes) : null;
        return minutes === null ? null : { x: xFor(index), y: yFor(minutes), minutes, key: `${profile.id}:${date}` };
      })
      .filter((point): point is { x: number; y: number; minutes: number; key: string } => point !== null);

    return {
      profile,
      color: getProfileColor(profile),
      path: buildSmoothPath(points.map((point) => ({ x: point.x, y: point.y }))),
      points,
      offDates: selectedUserId === profile.id ? myRecords.filter((record) => record.status !== 'present').map((record) => record.date) : [],
    };
  }).filter((line) => line.points.length > 0);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ width: '100%', minWidth: 0, borderRadius: 20, border: '1px solid #e2e8f0', background: '#fff', overflow: 'hidden' }}>
        <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x', overscrollBehaviorX: 'contain' }}>
          <div style={{ width: svgWidth, minWidth: svgWidth, display: 'block' }}>
            <svg width={svgWidth} height={chartHeight} style={{ display: 'block', maxWidth: 'none', background: '#fff' }}>
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
              <text x={svgWidth - padRight} y={baselineY - 6} textAnchor="end" fontSize="12" fill="#94a3b8">{formatThresholdLabel(singleProfileThreshold)}</text>

              {dates.map((date, index) => {
                const x = xFor(index);
                return (
                  <g key={date}>
                    <line x1={x} x2={x} y1={padTop} y2={chartHeight - padBottom} stroke="#f1f5f9" strokeWidth="1" />
                    <text x={x} y={chartHeight - 10} textAnchor="middle" fontSize="12" fill="#64748b">{date.slice(-2)}</text>
                  </g>
                );
              })}

              {selectedUserId ? lines.flatMap((line) => line.offDates.map((date) => {
                const index = dates.indexOf(date);
                if (index < 0) return null;
                const x = xFor(index);
                return <rect key={`leave-${line.profile.id}-${date}`} x={x - 5} y={padTop} width={10} height={innerHeight} rx={5} fill="#e5e7eb" opacity="0.9" />;
              })).filter(Boolean) : null}

              {lines.map((line) => {
                const isFocused = !selectedUserId || line.profile.id === selectedUserId;
                return (
                  <g key={line.profile.id}>
                    <path d={line.path} fill="none" stroke={line.color} strokeWidth={isFocused ? 3.5 : 2.2} strokeLinejoin="round" strokeLinecap="round" opacity={selectedUserId && !isFocused ? 0.22 : 0.96} />
                    {line.points.map((point) => {
                      const late = isLateCheckIn(point.minutes, line.profile);
                      return (
                        <circle key={point.key} cx={point.x} cy={point.y} r={isFocused ? 4.4 : 3.4} fill={late ? '#f97316' : line.color} stroke="#fff" strokeWidth={isFocused ? 2 : 1.4} opacity={selectedUserId && !isFocused ? 0.22 : 0.96} />
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>


    </div>
  );
}
