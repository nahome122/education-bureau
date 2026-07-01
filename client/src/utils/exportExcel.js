/**
 * exportExcel.js — Browser-compatible Excel export with green header styling.
 *
 * Uses SheetJS (xlsx) which works in Vite/browser environments.
 * Cell styles are applied by building the worksheet cells manually,
 * then injecting an OpenXML styles part into the zip that xlsx writes.
 *
 * Green theme:
 *   Header row  → dark green background  (#1A7A4A) + white bold text
 *   Odd rows    → white
 *   Even rows   → light green tint       (#E8F5EE)
 */
import * as XLSX from 'xlsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = () => new Date().toISOString().split('T')[0];

const cellAddr = (col, row) => XLSX.utils.encode_cell({ r: row, c: col });

/**
 * Build a minimal but complete OpenXML styles XML string.
 * Only two fills are needed: header (dark green) + alt-row (light green).
 * Index 0 = none, 1 = gray (reserved by Excel), 2 = header green, 3 = alt green.
 */
function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><sz val="10"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1A7A4A"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8F5EE"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFA8D5B5"/></left>
      <right style="thin"><color rgb="FFA8D5B5"/></right>
      <top style="thin"><color rgb="FFA8D5B5"/></top>
      <bottom style="thin"><color rgb="FFA8D5B5"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1">
      <alignment vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1">
      <alignment vertical="center"/>
    </xf>
  </cellXfs>
</styleSheet>`;
}

// Style index constants (match cellXfs above)
const S_DEFAULT = 0;  // no style
const S_HEADER  = 1;  // dark green bg, white bold, centered
const S_ROW_ODD = 2;  // white bg, thin green border
const S_ROW_ALT = 3;  // light green bg, thin green border

// ── Core export ───────────────────────────────────────────────────────────────

/**
 * Export an array of objects to a styled .xlsx file and trigger browser download.
 *
 * @param {object[]} rows      - Data rows
 * @param {string[]} headers   - Column header labels
 * @param {string[]} keys      - Object keys matching each header
 * @param {string}   filename  - Output filename (without extension)
 * @param {string}   sheetName - Worksheet tab name
 */
export function exportToExcel({ rows, headers, keys, filename = 'export', sheetName = 'Sheet1' }) {
  const wb = XLSX.utils.book_new();
  const ws = {};

  // ── Column widths ──────────────────────────────────────────────────────────
  ws['!cols'] = headers.map((h, i) => {
    const maxLen = rows.reduce((max, row) => {
      const v = row[keys[i]];
      const len = Array.isArray(v) ? v.join(', ').length : String(v ?? '').length;
      return Math.max(max, len);
    }, 0);
    return { wch: Math.min(Math.max(h.length + 2, maxLen + 2), 42) };
  });

  // ── Row heights ────────────────────────────────────────────────────────────
  ws['!rows'] = [
    { hpt: 22 },          // header row height
    ...rows.map(() => ({ hpt: 18 })),
  ];

  // ── Header row (row 0) ─────────────────────────────────────────────────────
  headers.forEach((h, c) => {
    ws[cellAddr(c, 0)] = { v: h, t: 's', s: S_HEADER };
  });

  // ── Data rows ──────────────────────────────────────────────────────────────
  rows.forEach((row, rowIdx) => {
    const style = rowIdx % 2 === 0 ? S_ROW_ODD : S_ROW_ALT;
    keys.forEach((k, c) => {
      let v = row[k];
      if (v === null || v === undefined) v = '';
      if (Array.isArray(v)) v = v.join(', ');

      const t = typeof v === 'number' ? 'n' : 's';
      ws[cellAddr(c, rowIdx + 1)] = { v, t, s: style };
    });
  });

  // Worksheet range
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rows.length, c: headers.length - 1 },
  });

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // ── Write workbook with styles ─────────────────────────────────────────────
  // XLSX.write returns a zip buffer; we inject our custom styles.xml into it.
  const wbout = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
    cellStyles: true,
  });

  // Patch the styles part inside the zip using JSZip (bundled with xlsx)
  // xlsx uses a built-in zip writer — we re-open with JSZip to swap styles.xml
  _injectStylesAndDownload(wbout, buildStylesXml(), filename);
}

/**
 * Re-open the xlsx zip buffer, replace xl/styles.xml, and trigger download.
 * xlsx bundles its own zip via CFB; we use a DataURL trick to avoid JSZip dep.
 * Instead, we do it the simple way: use xlsx's own book write but with
 * the worksheet cell `s` property mapped to our custom style indices,
 * then rely on xlsx's built-in style writer that IS triggered by cellStyles:true.
 *
 * Since xlsx CE does write styles.xml when cellStyles is true and `s` is set
 * as a numeric index, we just need to ensure our styles XML overrides it.
 * We achieve this with a Blob manipulation approach.
 */
async function _injectStylesAndDownload(wbout, stylesXml, filename) {
  try {
    // Dynamically import JSZip — it's bundled inside xlsx's own deps
    // Fall back to direct download if zip manipulation fails
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(wbout);
    zip.file('xl/styles.xml', stylesXml);
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    _downloadBlob(blob, `${filename}.xlsx`);
  } catch {
    // JSZip not available — fall back to direct xlsx output (no custom styles)
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    _downloadBlob(blob, `${filename}.xlsx`);
  }
}

function _downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Presets ───────────────────────────────────────────────────────────────────

export const exportTeachersExcel = (teachers) =>
  exportToExcel({
    rows:      teachers,
    headers:   ['Teacher ID', 'Full Name', 'Gender', 'Date of Birth', 'Phone', 'Email',
                 'Qualification', 'Position', 'Type', 'Department', 'School',
                 'Salary (ETB)', 'Experience (yrs)', 'Joining Date', 'Status'],
    keys:      ['tid', 'name', 'gender', 'dob', 'phone', 'email',
                 'qualification', 'position', 'type', 'department_name', 'school_name',
                 'salary', 'experience', 'joining', 'status'],
    filename:  `Teachers_Export_${formatDate()}`,
    sheetName: 'Teachers',
  });

export const exportStaffExcel = (staff) =>
  exportToExcel({
    rows:      staff,
    headers:   ['Staff ID', 'Full Name', 'Gender', 'Phone', 'Email',
                 'Position', 'Department', 'School',
                 'Salary (ETB)', 'Joining Date', 'Status'],
    keys:      ['sid', 'name', 'gender', 'phone', 'email',
                 'position', 'department_name', 'school_name',
                 'salary', 'joining', 'status'],
    filename:  `Staff_Export_${formatDate()}`,
    sheetName: 'Staff',
  });
