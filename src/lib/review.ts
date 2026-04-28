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

  return warnings;
}

export function filterRowsByWarning(rows: TrackerRow[], kind: ReviewWarningKind | 'all'): TrackerRow[] {
  switch (kind) {
    case 'overdue':
      return rows.filter((row) => row.status === 'Overdue');
    case 'missing_member':
      return rows.filter((row) => !row.member || row.member === 'Unassigned');
    case 'missing_due_date':
    case 'empty_today_update':
    case 'empty_next_day_focus':
      return [];
    default:
      return rows;
  }
}
