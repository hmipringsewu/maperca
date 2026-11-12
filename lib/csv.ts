// Spreadsheet apps execute cells that start with = + - @ as formulas, and
// these values are typed into a public form by strangers. A leading quote
// makes the app treat the cell as plain text.
function escapeCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: string[][]) {
  // The BOM is what makes Excel read the file as UTF-8.
  return "﻿" + [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
}
