import type { AttendanceStatus } from '../types';

export type LeavePeriod = 'full_day' | 'am' | 'pm';
export type LeaveStatus = Exclude<AttendanceStatus, 'present'>;

const EMBEDDED_LEAVE_PREFIX = 'leave_meta:';

export function getLeaveLabel(status: AttendanceStatus | null | undefined) {
  if (status === 'al') return '年假';
  if (status === 'sl') return '病假';
  if (status === 'bl') return '生日假';
  if (status === 'other') return '其他假';
  return '';
}

export function getLeavePeriodLabel(period: LeavePeriod | null | undefined) {
  if (period === 'am') return '上午';
  if (period === 'pm') return '下午';
  return '全日';
}

export function parseLeaveNote(note: string | null | undefined): { period: LeavePeriod | null; detail: string } {
  const value = (note ?? '').trim();
  if (!value) return { period: null, detail: '' };
  if (value === '全日') return { period: 'full_day', detail: '' };
  if (value === '上午') return { period: 'am', detail: '' };
  if (value === '下午') return { period: 'pm', detail: '' };
  if (value.startsWith('全日｜')) return { period: 'full_day', detail: value.slice(3) };
  if (value.startsWith('上午｜')) return { period: 'am', detail: value.slice(3) };
  if (value.startsWith('下午｜')) return { period: 'pm', detail: value.slice(3) };
  return { period: null, detail: value };
}

export function buildLeaveNote(period: LeavePeriod, detail?: string | null) {
  const periodLabel = getLeavePeriodLabel(period);
  const trimmed = detail?.trim();
  return trimmed ? `${periodLabel}｜${trimmed}` : periodLabel;
}

export function buildEmbeddedLeaveNote(status: LeaveStatus, period: Exclude<LeavePeriod, 'full_day'>, detail?: string | null) {
  const trimmed = detail?.trim();
  return `${EMBEDDED_LEAVE_PREFIX}${status}:${period}${trimmed ? `|${trimmed}` : ''}`;
}

export function parseEmbeddedLeaveNote(note: string | null | undefined): { status: LeaveStatus; period: Exclude<LeavePeriod, 'full_day'>; detail: string } | null {
  const value = (note ?? '').trim();
  if (!value.startsWith(EMBEDDED_LEAVE_PREFIX)) return null;
  const payload = value.slice(EMBEDDED_LEAVE_PREFIX.length);
  const [meta, detail = ''] = payload.split('|', 2);
  const [status, period] = meta.split(':');
  if (!status || !period) return null;
  if (!['al', 'sl', 'bl', 'other'].includes(status)) return null;
  if (period !== 'am' && period !== 'pm') return null;
  return {
    status: status as LeaveStatus,
    period,
    detail: detail.trim(),
  };
}

export function getAttendanceLeaveInfo(status: AttendanceStatus | null | undefined, note: string | null | undefined): { status: LeaveStatus; period: LeavePeriod; detail: string; embedded: boolean } | null {
  if (!status) return null;
  if (status === 'present') {
    const embedded = parseEmbeddedLeaveNote(note);
    if (!embedded) return null;
    return { ...embedded, embedded: true };
  }

  const parsed = parseLeaveNote(note);
  return {
    status,
    period: parsed.period ?? 'full_day',
    detail: parsed.detail,
    embedded: false,
  };
}

export function getLeaveDisplayLabel(status: AttendanceStatus | null | undefined, note?: string | null) {
  const leave = getAttendanceLeaveInfo(status, note);
  if (!leave) return '';
  return `${getLeaveLabel(leave.status)}（${getLeavePeriodLabel(leave.period)}）`;
}

export function formatAttendanceNote(status: AttendanceStatus | null | undefined, note: string | null | undefined): string | null {
  const leave = getAttendanceLeaveInfo(status, note);
  if (leave) {
    const label = `${getLeaveLabel(leave.status)}（${getLeavePeriodLabel(leave.period)}）`;
    return leave.detail ? `${label} · ${leave.detail}` : label;
  }

  const trimmed = note?.trim();
  return trimmed ? trimmed : null;
}
