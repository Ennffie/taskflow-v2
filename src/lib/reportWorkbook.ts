import { buildTaskReportFilename } from './date';
import type { TrackerRow } from './report';
import { loadXlsx, writeWorkbookFile } from './xlsx';

export async function exportTrackerWorkbook(rows: TrackerRow[], reportDate: string) {
  const XLSX = await loadXlsx();
  const workbook = XLSX.utils.book_new();

  const byMember = rows.reduce<Record<string, TrackerRow[]>>((acc, row) => {
    const key = row.member || 'Unassigned';
    acc[key] = acc[key] ?? [];
    acc[key].push(row);
    return acc;
  }, {});

  const memberSheetData: (string | number)[][] = [['Tracker by Member'], [], ['Member', 'Main Task', 'Subtask', 'Status', 'Progress', 'Due Date', 'Today Update', 'Next Day Focus', 'Blocker']];
  Object.entries(byMember).forEach(([member, memberRows]) => {
    memberSheetData.push([member, '', '', '', '', '', '', '', '']);
    memberRows.forEach((row) => {
      memberSheetData.push(['', row.mainTask, row.subtask, row.status, row.progress, row.dueDate, row.todayUpdate, row.nextDayFocus, row.blocker]);
    });
  });
  const memberSheet = XLSX.utils.aoa_to_sheet(memberSheetData);
  memberSheet['!merges'] = [XLSX.utils.decode_range('A1:I1')];
  memberSheet['!cols'] = [
    { wch: 16 },
    { wch: 24 },
    { wch: 24 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 34 },
    { wch: 34 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(workbook, memberSheet, 'Tracker by Member');

  const byTask = rows.reduce<Record<string, TrackerRow[]>>((acc, row) => {
    acc[row.mainTask] = acc[row.mainTask] ?? [];
    acc[row.mainTask].push(row);
    return acc;
  }, {});

  const taskSheetData: (string | number)[][] = [['Tracker by Task'], [], ['Order', 'Main Task', 'Main Task Status', 'Main Task Progress', 'Main Task Due Date', 'Subtask', 'Member', 'Subtask Status', 'Subtask Progress', 'Subtask Due Date', 'Today Update', 'Next Day Focus', 'Blocker']];
  Object.entries(byTask).forEach(([mainTask, taskRows], index) => {
    const first = taskRows[0];
    taskSheetData.push([String(index + 1).padStart(2, '0'), mainTask, first.mainTaskStatus ?? '', first.mainTaskProgress ?? '', first.mainTaskDueDate ?? '', '', '', '', '', '', '', '', '']);
    taskRows.forEach((row) => {
      taskSheetData.push(['', '', '', '', '', row.subtask, row.member, row.status, row.progress, row.dueDate, row.todayUpdate, row.nextDayFocus, row.blocker]);
    });
  });
  const taskSheet = XLSX.utils.aoa_to_sheet(taskSheetData);
  taskSheet['!merges'] = [XLSX.utils.decode_range('A1:M1')];
  taskSheet['!cols'] = [
    { wch: 8 },
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 24 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 34 },
    { wch: 34 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(workbook, taskSheet, 'Tracker by Task');

  await writeWorkbookFile(workbook, buildTaskReportFilename(reportDate));
}
