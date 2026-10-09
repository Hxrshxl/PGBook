// CSV that opens correctly in Excel and Google Sheets (UTF-8 BOM, quoted fields).
// Cells starting with = + - @ are prefixed so a spreadsheet never runs them as formulas.

function cell(value) {
  if (value === null || value === undefined) return ''
  let s = value instanceof Date ? value.toISOString() : typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** columns: [[header, row => value], …] */
export function toCsv(rows, columns) {
  const lines = [columns.map(([h]) => cell(h)).join(',')]
  for (const row of rows) lines.push(columns.map(([, get]) => cell(get(row))).join(','))
  return '﻿' + lines.join('\r\n') + '\r\n'
}
