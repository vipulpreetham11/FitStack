export type ExportRow = Record<string, string | number | boolean | null | undefined>
/** Neutralize spreadsheet formulas in untrusted text; numbers remain numeric. */
export function safeExportRows(rows: ExportRow[]) {
  return rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(value) ? "'" + value : value ?? ''])))
}
export async function exportData(rows: ExportRow[], filename: string, format: 'csv' | 'xlsx' = 'xlsx') {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.json_to_sheet(safeExportRows(rows))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Export')
  XLSX.writeFile(workbook, filename.replace(/[^a-zA-Z0-9_-]/g, '_') + '.' + format, { bookType: format })
}
