import type { TrackerRow } from './report';

export type ReviewWarningKind = 'overdue' | 'missing_member' | 'missing_due_date' | 'empty_today_update' | 'empty_next_day_focus';

export type ReviewWarning = {
  kind: ReviewWarningKind;
  message: string;
  count: number;
};

export function buildReviewWarnings(rows: TrackerRow[]): ReviewWarning[] {
  const warnings: ReviewWarning[] = [];

  const overdue = rows.filter((row) => row.status === 'Overdue');
  if (overdue.length) warnings.push({ kind: 'overdue', message: 'This item is overdue.', count: overdue.length });

  const missingMember = rows.filter((row) => !row.member || row.member === 'Unassigned');
  if (missingMember.length) warnings.push({ kind: 'missing_member', message: 'This item has no assigned member.', count: missingMember.length });

  const missingDueDate = rows.filter((row) => !row.dueDate?.trim());
  if (missingDueDate.length) warnings.push({ kind: 'missing_due_date', message: 'This active item has no due date.', count: missingDueDate.length });

  const emptyToday = rows.filter((row) => !row.todayUpdate?.trim());
  if (emptyToday.length) warnings.push({ kind: 'empty_today_update', message: 'Today Update is empty.', count: emptyToday.length });

  const emptyNext = rows.filter((row) => !row.nextDayFocus?.trim());
  if (emptyNext.length) warnings.push({ kind: 'empty_next_day_focus', message: 'Next Day Focus is empty.', count: emptyNext.length });

  return warnings;
}

export function filterRowsByWarning(rows: TrackerRow[], kind: ReviewWarningKind | 'all'): TrackerRow[] {
  switch (kind) {
    case 'overdue':
      return rows.filter((row) => row.status === 'Overdue');
    case 'missing_member':
      return rows.filter((row) => !row.member || row.member === 'Unassigned');
    case 'missing_due_date':
      return rows.filter((row) => !row.dueDate?.trim());
    case 'empty_today_update':
      return rows.filter((row) => !row.todayUpdate?.trim());
    case 'empty_next_day_focus':
      return rows.filter((row) => !row.nextDayFocus?.trim());
    default:
      return rows;
  }
}
