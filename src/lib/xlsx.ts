let xlsxModulePromise: Promise<typeof import('xlsx')> | null = null;

export async function loadXlsx() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import('xlsx');
  }
  return xlsxModulePromise;
}

export async function readWorkbookFromFile(file: File) {
  const buffer = await file.arrayBuffer();
  const XLSX = await loadXlsx();
  return XLSX.read(buffer, { type: 'array', cellDates: true });
}

export async function sheetToJsonRows(workbook: any, sheetName: string) {
  const XLSX = await loadXlsx();
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet, { header: 1 });
}

export async function writeWorkbookFile(workbook: any, filename: string) {
  const XLSX = await loadXlsx();
  XLSX.writeFile(workbook, filename);
}
