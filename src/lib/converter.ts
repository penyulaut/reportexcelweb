/**
 * converter.ts — Pure TypeScript XLSX → DOCX conversion (Vercel-compatible)
 * Uses exceljs (read xlsx) + pizzip (manipulate docx zip/xml)
 * No Python, no child_process.
 */
import ExcelJS from "exceljs";
import PizZip from "pizzip";

// ── Constants ────────────────────────────────────────────────────────────────

const MONTHS_ID: Record<number, string> = {
  1: "Januari", 2: "Februari", 3: "Maret", 4: "April",
  5: "Mei", 6: "Juni", 7: "Juli", 8: "Agustus",
  9: "September", 10: "Oktober", 11: "November", 12: "Desember",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Ticket {
  no: number;
  tiket: string;
  ringkasan: string;
  rincian: string;
  pemohon: string;
  penyebab: string;
  solusi: string;
  tipe: string;
  tanggal: string;
  pic: string;
  vendor: string;
  status: string;
  slaRespon: string;
  slaResol: string;
  statusRespon?: string;
  statusResol?: string;
}

export interface ConversionData {
  periode: string;
  tanggal: string;
  totalTiket: number;
  totalPending: number;
  totalSelesai: number;
  totalMetResp: number;
  totalMetResol: number;
  pctMetResp: string;
  pctMetResol: string;
  incidentCount: number | string;
  srCount: number | string;
  top5: Array<[string, number]>;
  tickets: Ticket[];
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

function escXml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtPct(v: unknown): string {
  const f = Number(v);
  if (isNaN(f) || !isFinite(f)) return "0.00%";
  const pct = f <= 1 ? f * 100 : f;
  return `${pct.toFixed(2)}%`;
}

/** Unwrap ExcelJS formula/rich-text cell values to their plain result. */
function cellVal(cell: ExcelJS.Cell | undefined): unknown {
  if (!cell) return null;
  const v = cell.value;
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return (v as any).result;
    if ("richText" in v) return (v as any).richText.map((r: any) => r.text).join("");
    if ("text" in v) return (v as any).text;
    if ("hyperlink" in v) return (v as any).hyperlink;
  }
  return v;
}

/** Safely format cell content to a displayable string */
function formatCellStr(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return "";
  const v = cellVal(cell);
  if (v == null) return "";

  if (v instanceof Date) {
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const dd = String(v.getDate()).padStart(2, "0");
    const yyyy = v.getFullYear();
    const hh = String(v.getHours()).padStart(2, "0");
    const min = String(v.getMinutes()).padStart(2, "0");
    return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
  }

  if (typeof v === "object") {
    return cell.text || "";
  }

  return String(v).trim();
}

// ── XML helpers ───────────────────────────────────────────────────────────────

type Range = { start: number; end: number };

/** Return ranges of all top-level `<w:tbl>` tables inside `xml`. */
function extractTables(xml: string): Range[] {
  const tables: Range[] = [];
  let i = 0;
  let nestDepth = 0;
  while (i < xml.length) {
    if (xml.startsWith("<w:tbl>", i) || xml.startsWith("<w:tbl ", i)) {
      if (nestDepth === 0) {
        const start = i;
        let j = i;
        let d = 0;
        while (j < xml.length) {
          if (xml.startsWith("<w:tbl>", j) || xml.startsWith("<w:tbl ", j)) {
            d++;
          } else if (xml.startsWith("</w:tbl>", j)) {
            d--;
            if (d === 0) {
              tables.push({ start, end: j + 8 });
              i = j + 8;
              break;
            }
          }
          j++;
        }
      } else {
        nestDepth++;
      }
    }
    i++;
  }
  return tables;
}

/**
 * Return ranges of all top-level `<w:tr>` rows inside `tblXml`.
 * Correctly skips rows that belong to nested tables.
 */
function rowRanges(tblXml: string): Range[] {
  const rows: Range[] = [];
  let i = 0;
  let nestDepth = 0; // depth relative to the outer table (already inside it)

  while (i < tblXml.length) {
    if (tblXml.startsWith("<w:tbl>", i) || tblXml.startsWith("<w:tbl ", i)) {
      if (i > 0) nestDepth++;
      i++; continue;
    }
    if (tblXml.startsWith("</w:tbl>", i)) {
      if (i < tblXml.length - 8) nestDepth--;
      i++; continue;
    }
    // Top-level row start
    if (
      nestDepth === 0 &&
      (tblXml.startsWith("<w:tr>", i) || tblXml.startsWith("<w:tr ", i))
    ) {
      const rowStart = i;
      let depth = 1;
      i = tblXml.indexOf(">", i) + 1;
      while (depth > 0 && i < tblXml.length) {
        const nc = tblXml.indexOf("</w:tr>", i);
        if (nc === -1) { i = tblXml.length; break; }
        const no1 = tblXml.indexOf("<w:tr>", i);
        const no2 = tblXml.indexOf("<w:tr ", i);
        let nextOpen = Infinity;
        if (no1 !== -1) nextOpen = Math.min(nextOpen, no1);
        if (no2 !== -1) nextOpen = Math.min(nextOpen, no2);
        if (nextOpen < nc) {
          depth++;
          i = tblXml.indexOf(">", nextOpen) + 1;
        } else {
          depth--;
          i = nc + 7;
        }
      }
      rows.push({ start: rowStart, end: i });
      continue;
    }
    i++;
  }
  return rows;
}

/** Return ranges of `<w:tc>` cells in a row (cells don't nest). */
function cellRanges(rowXml: string): Range[] {
  const cells: Range[] = [];
  let i = 0;
  while (i < rowXml.length) {
    const s1 = rowXml.indexOf("<w:tc>", i);
    const s2 = rowXml.indexOf("<w:tc ", i);
    let start = Infinity;
    if (s1 !== -1) start = Math.min(start, s1);
    if (s2 !== -1) start = Math.min(start, s2);
    if (start === Infinity) break;
    const end = rowXml.indexOf("</w:tc>", start);
    if (end === -1) break;
    cells.push({ start, end: end + 7 });
    i = end + 7;
  }
  return cells;
}

/** Extract the first occurrence of `<tag>...</tag>` from xml. */
function extractFirst(xml: string, tag: string): string {
  const open = `<${tag}`;
  const close = `</${tag}>`;
  const s = xml.indexOf(open);
  if (s === -1) return "";
  const e = xml.indexOf(close, s);
  if (e === -1) return "";
  return xml.slice(s, e + close.length);
}

/**
 * Replace the text content in a `<w:tc>` cell XML while keeping
 * cell/paragraph/run properties (column width, borders, font, etc.).
 */
function setCellText(cellXml: string, text: string): string {
  const tcPr = extractFirst(cellXml, "w:tcPr");
  const pPr = extractFirst(cellXml, "w:pPr");
  const rPr = extractFirst(cellXml, "w:rPr");
  const escaped = escXml(text);
  const run = escaped
    ? `<w:r>${rPr}<w:t xml:space="preserve">${escaped}</w:t></w:r>`
    : `<w:r>${rPr}</w:r>`; // empty run to preserve height
  return `<w:tc>${tcPr}<w:p>${pPr}${run}</w:p></w:tc>`;
}

/**
 * Build a new `<w:tr>` row by filling ticket values into the
 * template row's cells (preserving all formatting/widths).
 */
function buildDetailRow(templateRowXml: string, ticket: Ticket): string {
  const trPr = extractFirst(templateRowXml, "w:trPr");
  const crng = cellRanges(templateRowXml);
  const values: (string | number)[] = [
    ticket.no, ticket.tiket, ticket.ringkasan, ticket.rincian,
    ticket.pemohon, ticket.solusi, ticket.tipe, ticket.tanggal,
    ticket.pic, ticket.slaRespon, ticket.slaResol,
  ];
  let cells = "";
  for (let i = 0; i < crng.length; i++) {
    const originalCell = templateRowXml.slice(crng[i].start, crng[i].end);
    cells += setCellText(originalCell, String(values[i] ?? ""));
  }
  return `<w:tr>${trPr}${cells}</w:tr>`;
}

/**
 * Return updated table XML with a specific cell replaced.
 * `rrng` must correspond to the current `tableXml` (call rowRanges() each time).
 */
function updateCell(
  tableXml: string,
  rowIdx: number,
  colIdx: number,
  text: string,
  rrng: Range[]
): string {
  if (rowIdx >= rrng.length) return tableXml;
  const rowXml = tableXml.slice(rrng[rowIdx].start, rrng[rowIdx].end);
  const crng = cellRanges(rowXml);
  if (colIdx >= crng.length) return tableXml;
  const cellXml = rowXml.slice(crng[colIdx].start, crng[colIdx].end);
  const newCell = setCellText(cellXml, text);
  const newRow =
    rowXml.slice(0, crng[colIdx].start) + newCell + rowXml.slice(crng[colIdx].end);
  return (
    tableXml.slice(0, rrng[rowIdx].start) +
    newRow +
    tableXml.slice(rrng[rowIdx].end)
  );
}

// ── XLSX Reading ──────────────────────────────────────────────────────────────

/** Normalize string for comparison: trim, lowercase, remove extra spaces */
function normalizeStr(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Detect header row by searching for known column headers */
function findHeaderRow(ws: ExcelJS.Worksheet): { rowNum: number; colMap: Record<string, number> } | null {
  const knownHeaders = [
    "no", "tiket", "nomor tiket", "ticket", "no. tiket",
    "ringkasan", "summary", "keterangan", "uraian",
    "rincian", "detail", "komentar",
    "pemohon", "requester", "user", "pengguna",
    "penyebab", "cause", "alasan",
    "solusi", "resolution", "jawaban",
    "tipe", "type", "kategori", "category",
    "tanggal", "date", "tanggal tiket", "ticket date",
    "pic", "assignee", "handler", "penanggung jawab",
    "vendor", "supplier", "third party",
    "status",
    "sla respon", "sla response", "responsiveness", "respon",
    "sla resolusi", "sla resolution", "resolution time", "resolusi"
  ];

  for (let r = 1; r <= Math.min(20, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const colMap: Record<string, number> = {};
    let matchedCount = 0;

    // Check each cell in this row
    for (let c = 1; c <= 20; c++) {
      const cellVal_raw = cellVal(row.getCell(c));
      const normalized = normalizeStr(cellVal_raw);

      for (const header of knownHeaders) {
        if (normalized === header || normalized.includes(header)) {
          // Map to standard key - BE SPECIFIC to avoid conflicts
          // "No" or "#" = sequential number (1,2,3), NOT the ticket number
          // "Tiket", "Ticket", "Nomor Tiket" = actual ticket ID (WO000..., INC000...)
          if (normalized === "no" || normalized === "no." || normalized === "#" || normalized === "nomor") {
            colMap["seqNo"] = c; // Sequential number (1, 2, 3...)
          } else if (normalized.includes("tiket") || normalized.includes("ticket") || normalized.includes("nomor tiket")) {
            if (!colMap["tiket"]) colMap["tiket"] = c; // Ticket ID (WO..., INC...)
          } else if (normalized.includes("ringkasan") || normalized.includes("summary") || normalized.includes("keterangan")) {
            colMap["ringkasan"] = c;
          } else if (normalized.includes("rincian") || normalized.includes("detail") || normalized.includes("komentar")) {
            colMap["rincian"] = c;
          } else if (normalized.includes("pemohon") || normalized.includes("requester") || normalized.includes("user")) {
            colMap["pemohon"] = c;
          } else if (normalized.includes("penyebab") || normalized.includes("cause") || normalized.includes("alasan")) {
            colMap["penyebab"] = c;
          } else if (normalized === "resolusi" || (normalized.includes("sla") && (normalized.includes("resol") || normalized.includes("resolut")))) {
            let parentHeader = "";
            if (r > 1) {
              const above1 = normalizeStr(cellVal(ws.getRow(r - 1).getCell(c)));
              const above2 = c > 1 ? normalizeStr(cellVal(ws.getRow(r - 1).getCell(c - 1))) : "";
              const above3 = c > 2 ? normalizeStr(cellVal(ws.getRow(r - 1).getCell(c - 2))) : "";
              const above4 = c > 3 ? normalizeStr(cellVal(ws.getRow(r - 1).getCell(c - 3))) : "";
              parentHeader = above1 || above2 || above3 || above4;
            }
            if (parentHeader.includes("waktu")) colMap["waktuResol"] = c;
            else if (parentHeader.includes("sla")) colMap["slaResol"] = c;
            else {
              if (!colMap["waktuResol"]) colMap["waktuResol"] = c;
              else colMap["slaResol"] = c;
            }
          } else if (normalized === "solusi" || (normalized.includes("solusi") && !normalized.includes("resolusi")) || (normalized.includes("resolution") && !normalized.includes("sla")) || normalized.includes("jawaban")) {
            colMap["solusi"] = c;
          } else if (normalized.includes("tipe") || normalized.includes("type") || normalized.includes("kategori")) {
            colMap["tipe"] = c;
          } else if (normalized.includes("tanggal") || normalized.includes("date")) {
            colMap["tanggal"] = c;
          } else if (normalized.includes("pic") || normalized.includes("assignee") || normalized.includes("handler")) {
            colMap["pic"] = c;
          } else if (normalized.includes("vendor") || normalized.includes("supplier")) {
            colMap["vendor"] = c;
          } else if (normalized === "status") {
            colMap["status"] = c;
          } else if (normalized === "respon" || (normalized.includes("sla") && (normalized.includes("respon") || normalized.includes("response")))) {
            let parentHeader = "";
            if (r > 1) {
              const above1 = normalizeStr(cellVal(ws.getRow(r - 1).getCell(c)));
              const above2 = c > 1 ? normalizeStr(cellVal(ws.getRow(r - 1).getCell(c - 1))) : "";
              const above3 = c > 2 ? normalizeStr(cellVal(ws.getRow(r - 1).getCell(c - 2))) : "";
              const above4 = c > 3 ? normalizeStr(cellVal(ws.getRow(r - 1).getCell(c - 3))) : "";
              parentHeader = above1 || above2 || above3 || above4;
            }
            if (parentHeader.includes("waktu")) colMap["waktuRespon"] = c;
            else if (parentHeader.includes("sla")) colMap["slaRespon"] = c;
            else {
              if (!colMap["waktuRespon"]) colMap["waktuRespon"] = c;
              else colMap["slaRespon"] = c;
            }
          }
          matchedCount++;
          break;
        }
      }
    }

    // If we found at least 3 matching headers, this is likely the header row
    if (matchedCount >= 3) {
      // Sub-headers (like Respon/Resolusi) might be in the next row due to merged cells
      const nextRow = ws.getRow(r + 1);
      for (let c = 1; c <= 20; c++) {
        const cellVal_raw = cellVal(nextRow.getCell(c));
        const normalized = normalizeStr(cellVal_raw);

        if (normalized === "respon" || normalized === "resolusi" || normalized.includes("sla")) {
          let parentHeader = "";
          const above1 = normalizeStr(cellVal(row.getCell(c)));
          const above2 = c > 1 ? normalizeStr(cellVal(row.getCell(c - 1))) : "";
          const above3 = c > 2 ? normalizeStr(cellVal(row.getCell(c - 2))) : "";
          const above4 = c > 3 ? normalizeStr(cellVal(row.getCell(c - 3))) : "";
          parentHeader = above1 || above2 || above3 || above4;

          if (normalized === "respon" || (normalized.includes("sla") && (normalized.includes("respon") || normalized.includes("response")))) {
            if (parentHeader.includes("waktu")) colMap["waktuRespon"] = c;
            else if (parentHeader.includes("sla")) colMap["slaRespon"] = c;
            else {
              if (!colMap["waktuRespon"]) colMap["waktuRespon"] = c;
              else colMap["slaRespon"] = c;
            }
          } else if (normalized === "resolusi" || (normalized.includes("sla") && (normalized.includes("resol") || normalized.includes("resolut")))) {
            if (parentHeader.includes("waktu")) colMap["waktuResol"] = c;
            else if (parentHeader.includes("sla")) colMap["slaResol"] = c;
            else {
              if (!colMap["waktuResol"]) colMap["waktuResol"] = c;
              else colMap["slaResol"] = c;
            }
          }
        }
      }
      return { rowNum: r, colMap };
    }
  }
  return null;
}

export async function readXlsx(buffer: any): Promise<ConversionData> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // Find worksheet: priority exact "All", then any containing "All" (case insensitive)
  let ws = wb.getWorksheet("All");
  if (!ws) {
    for (const sheet of wb.worksheets) {
      if (sheet.name.toLowerCase() === "all") {
        ws = sheet;
        break;
      }
    }
  }
  if (!ws) {
    for (const sheet of wb.worksheets) {
      if (sheet.name.toLowerCase().includes("all")) {
        ws = sheet;
        break;
      }
    }
  }
  if (!ws) throw new Error('Sheet "All" tidak ditemukan dalam file XLSX');

  // Find header row dynamically
  const headerInfo = findHeaderRow(ws);
  if (!headerInfo) {
    throw new Error("Tidak dapat menemukan baris header di file Excel. Pastikan file memiliki kolom seperti: No, Tiket, Ringkasan, dll.");
  }

  const headerRow = headerInfo.rowNum;
  const col = headerInfo.colMap;

  // Default column positions if not found
  const colSeqNo = col["seqNo"] || 3;  // Sequential number (1, 2, 3...)
  const colTiket = col["tiket"] || 4;  // Ticket ID (WO000..., INC000...)
  const colRingkasan = col["ringkasan"] || 5;
  const colRincian = col["rincian"] || 6;
  const colPemohon = col["pemohon"] || 7;
  const colPenyebab = col["penyebab"] || 8;
  const colSolusi = col["solusi"] || 9;
  const colTipe = col["tipe"] || 10;
  const colTanggal = col["tanggal"] || 11;
  const colPic = col["pic"] || 12;
  const colVendor = col["vendor"] || 13;
  const colStatus = col["status"] || 14;
  const colWaktuRespon = col["waktuRespon"] || 15;
  const colWaktuResol = col["waktuResol"] || 16;
  const colSlaRespon = col["slaRespon"] || 17;
  const colSlaResol = col["slaResol"] || 18;

  // Summary section: scan first 15 rows for summary labels
  const sumMap: Record<string, number> = {};
  const summaryLabels = ["total", "pending", "selesai", "completed", "finished", "incident", "service", "work order"];

  for (let r = 1; r <= Math.min(15, headerRow - 1); r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 10; c++) {
      const label = String(cellVal(row.getCell(c)) ?? "").trim();
      const normalizedLabel = label.toLowerCase();

      // Check if this looks like a summary label
      const isSummaryLabel = summaryLabels.some(sl => normalizedLabel.includes(sl));

      if (isSummaryLabel && label) {
        // Look for value in adjacent columns
        for (let vc = c + 1; vc <= c + 3 && vc <= 15; vc++) {
          let val = cellVal(row.getCell(vc));
          if (typeof val === "string") val = parseFloat(val);
          if (val != null && !isNaN(val as number)) {
            sumMap[label] = Number(val);
            break;
          }
        }
      }
    }
  }

  // Detail section: read from header row + 1 onwards
  const tickets: Ticket[] = [];
  const dates: Date[] = [];
  const seenTickets = new Set<string>(); // Track duplicates
  let sequentialNo = 1;
  const MAX_EMPTY_ROWS = 5; // Stop after 5 consecutive empty rows
  let emptyRowCount = 0;

  console.log(`[Converter] Starting read from row ${headerRow + 1}, rowCount=${ws.rowCount}`);

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);

    // Get ticket number (required field)
    const tiketVal = String(cellVal(row.getCell(colTiket)) ?? "").trim();
    const picVal = String(cellVal(row.getCell(colPic)) ?? "").trim();
    const statusVal = String(cellVal(row.getCell(colStatus)) ?? "").trim();

    // Check if this is a ghost/empty row (multiple empty fields)
    if (!tiketVal && !picVal && !statusVal) {
      emptyRowCount++;
      if (emptyRowCount >= MAX_EMPTY_ROWS) {
        console.log(`[Converter] Stopping at row ${r} after ${MAX_EMPTY_ROWS} empty rows`);
        break;
      }
      continue;
    }
    emptyRowCount = 0; // Reset counter when we find valid data

    // Skip if no ticket number
    if (!tiketVal) continue;

    // STRICT validation: Must be WO or INC or CRQ followed by numbers
    // Pattern: WO followed by 10-15 digits, INC/CRQ followed by 7-15 digits
    const tiketUpper = tiketVal.toUpperCase();
    const isValidWO = /^WO\d{10,15}$/.test(tiketUpper);
    const isValidINC = /^INC\d{7,15}$/.test(tiketUpper);
    const isValidCRQ = /^CRQ\d{7,15}$/.test(tiketUpper);

    if (!isValidWO && !isValidINC && !isValidCRQ) {
      console.log(`[Converter] Row ${r}: Skipping invalid ticket format: "${tiketVal}"`);
      continue;
    }

    // Check for duplicates
    if (seenTickets.has(tiketUpper)) {
      console.log(`[Converter] Row ${r}: Skipping duplicate ticket: "${tiketVal}"`);
      continue;
    }
    seenTickets.add(tiketUpper);

    const tglVal = cellVal(row.getCell(colTanggal));
    let tglStr = "";
    if (tglVal instanceof Date) {
      const d = tglVal;
      tglStr = `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1
      ).padStart(2, "0")}/${d.getFullYear()}`;
      dates.push(d);
    } else if (tglVal) {
      tglStr = String(tglVal).trim();
    }

    tickets.push({
      no: sequentialNo++,
      tiket: tiketVal,
      ringkasan: formatCellStr(row.getCell(colRingkasan)),
      rincian: formatCellStr(row.getCell(colRincian)),
      pemohon: formatCellStr(row.getCell(colPemohon)),
      penyebab: formatCellStr(row.getCell(colPenyebab)),
      solusi: formatCellStr(row.getCell(colSolusi)),
      tipe: formatCellStr(row.getCell(colTipe)),
      tanggal: tglStr,
      pic: formatCellStr(row.getCell(colPic)),
      vendor: formatCellStr(row.getCell(colVendor)),
      status: formatCellStr(row.getCell(colStatus)),
      slaRespon: formatCellStr(row.getCell(colWaktuRespon)),
      slaResol: formatCellStr(row.getCell(colWaktuResol)),
      statusRespon: formatCellStr(row.getCell(colSlaRespon)),
      statusResol: formatCellStr(row.getCell(colSlaResol)),
    });
  }

  console.log(`[Converter] Total valid tickets: ${tickets.length}`);
  console.log(`[Converter] Summary map:`, sumMap);

  // Sort by original ticket number (Excel row order)
  tickets.sort((a, b) => a.no - b.no);
  tickets.forEach((t, i) => { t.no = i + 1; });

  // Top 5 ringkasan by frequency
  const freq: Record<string, number> = {};
  for (const t of tickets) {
    if (t.ringkasan) freq[t.ringkasan] = (freq[t.ringkasan] ?? 0) + 1;
  }
  const top5 = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5) as Array<[string, number]>;

  // Derive Periode from earliest ticket date
  let periode = "Agustus 2025";
  if (dates.length > 0) {
    const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
    periode = `${MONTHS_ID[earliest.getMonth() + 1]} ${earliest.getFullYear()}`;
  }

  // Count incident vs Service Request based on "tipe" field
  // IN = Incident, SR = Service Request
  let incidentCount = 0;
  let srCount = 0;

  for (const t of tickets) {
    const tipeCode = t.tipe.trim().toUpperCase();
    if (tipeCode === "IN" || tipeCode.includes("INCIDENT")) {
      incidentCount++;
    } else if (tipeCode === "SR" || tipeCode.includes("SERVICE REQUEST")) {
      srCount++;
    }
  }

  // Manually calculate SLA based on tickets data (1/Terpenuhi/Met = 1, otherwise 0/Missed)
  let totalMetResp = 0;
  let totalMetResol = 0;
  let totalPending = 0;

  for (const t of tickets) {
    const respon = t.statusRespon?.trim().toLowerCase() || "";
    const resol = t.statusResol?.trim().toLowerCase() || "";

    // Check pending condition: respon exists but resol is empty, or explicitly "pending"
    let isPending = false;
    if (respon !== "" && resol === "") {
      isPending = true;
    } else if (resol === "pending" || respon === "pending") {
      isPending = true;
    }

    if (isPending) {
      totalPending++;
      if (t.slaResol.trim() === "") {
        t.slaResol = "Pending";
      }
    }

    if (respon === "met" || respon === "1" || respon === "terpenuhi") {
      totalMetResp++;
    }
    if (resol === "met" || resol === "1" || resol === "terpenuhi") {
      totalMetResol++;
    }
  }

  const validTickets = tickets.length;

  // Calculate totals from actual data
  const totalSelesai = validTickets - totalPending;
  const denominator = totalSelesai > 0 ? totalSelesai : 1;

  const pctMetResp = totalMetResp / denominator;
  const pctMetResol = totalMetResol / denominator;

  const today = new Date();
  const tanggal = `${today.getDate()} ${MONTHS_ID[today.getMonth() + 1]} ${today.getFullYear()}`;

  console.log(`[Converter] Summary: total=${validTickets}, incident=${incidentCount}, sr=${srCount}, metResp=${totalMetResp}, metResol=${totalMetResol}`);

  return {
    periode,
    tanggal,
    totalTiket: validTickets,
    totalPending: totalPending,
    totalSelesai: totalSelesai,
    totalMetResp: totalMetResp,    // Counted from actual ticket data
    totalMetResol: totalMetResol,  // Counted from actual ticket data
    pctMetResp: fmtPct(pctMetResp),
    pctMetResol: fmtPct(pctMetResol),
    incidentCount,
    srCount,
    top5,
    tickets,
  };
}

// ── DOCX Filling ──────────────────────────────────────────────────────────────

export function fillDocx(templateBuffer: any, data: ConversionData): any {
  const zip = new PizZip(templateBuffer);


  // 1. Update header XML files
  for (const filename of Object.keys(zip.files)) {
    if (!/^word\/header\d+\.xml$/.test(filename)) continue;
    let xml = zip.files[filename].asText();

    // Header relies on table cells. The first table is the header block.
    // Row 1, Col 6 = Periode
    // Row 2, Col 6 = Tanggal
    const tables = extractTables(xml);
    if (tables.length > 0) {
      const htPos = tables[0];
      let htXml = xml.slice(htPos.start, htPos.end);

      let hrng = rowRanges(htXml);
      if (hrng.length > 2) {
        htXml = updateCell(htXml, 1, 6, data.periode, hrng);
        hrng = rowRanges(htXml); // refresh
        htXml = updateCell(htXml, 2, 6, data.tanggal, hrng);

        xml = xml.slice(0, htPos.start) + htXml + xml.slice(htPos.end);
        zip.file(filename, xml);
      }
    }
  }

  // 2. Manipulate document.xml (detail table + summary table)
  let docXml = zip.files["word/document.xml"].asText();
  const docTables = extractTables(docXml);

  // ── 2a. Detail table (Table 0) ──────────────────────────────────────────
  if (docTables.length > 0) {
    const dtPos = docTables[0];
    const dtXml = docXml.slice(dtPos.start, dtPos.end);
    const rrng = rowRanges(dtXml);
    const HEADER_ROWS = 2; // Rows 0 and 1 are headers

    if (rrng.length > HEADER_ROWS) {
      // Use first empty row (row 2) as format template
      const templateRow = dtXml.slice(rrng[HEADER_ROWS].start, rrng[HEADER_ROWS].end);
      const newRows = data.tickets.map((t) => buildDetailRow(templateRow, t)).join("");

      const beforeData = dtXml.slice(0, rrng[HEADER_ROWS].start);
      const afterData = dtXml.slice(rrng[rrng.length - 1].end); // trim remaining empty rows
      const newDtXml = beforeData + newRows + afterData;

      docXml = docXml.slice(0, dtPos.start) + newDtXml + docXml.slice(dtPos.end);
    }
  }

  // Need to re-extract tables since docXml length changed
  const updatedDocTables = extractTables(docXml);

  // ── 2b. Summary table (Table 1) ─────────────────────────────────────────
  if (updatedDocTables.length > 1) {
    const sumPos = updatedDocTables[1];
    let sumXml = docXml.slice(sumPos.start, sumPos.end);

    // [rowIdx, colIdx, value]
    const updates: Array<[number, number, string]> = [
      [0, 3, String(data.totalTiket)],
      [1, 3, String(data.totalPending)],
      [2, 3, String(data.totalSelesai)],
      [3, 3, String(data.incidentCount)],
      [4, 3, String(data.srCount)],
      [5, 3, String(data.totalMetResp)],
      [6, 3, String(data.totalMetResol)],
      [7, 3, data.pctMetResp],
      [8, 3, data.pctMetResol],
    ];

    // Top 5 Ringkasan (rows 1–5, cols 5–8)
    for (let rank = 1; rank <= 5; rank++) {
      const top = data.top5[rank - 1];
      // In the summary table: row 1 to 5.
      // Top 5 slots are located at: rank 1 is row 1, etc...
      // Col indices: 5=Rank, 6=Ringkasan, 7=Colon, 8=Count
      // NOTE: Our rowRanges starts at row 0 (which is "Total tiket")
      // Row 1 is "Tiket pending", but also holds rank 1 on the right side!
      if (top) {
        updates.push([rank, 5, String(rank)]);
        updates.push([rank, 6, top[0]]);
        updates.push([rank, 7, ":"]);
        updates.push([rank, 8, String(top[1])]);
      } else {
        updates.push([rank, 5, ""], [rank, 6, ""], [rank, 7, ""], [rank, 8, ""]);
      }
    }

    // Sort descending by row/col so we update from back to front,
    // avoiding range index shifts for previous cells within the same iteration
    updates.sort((a, b) => b[0] - a[0] || b[1] - a[1]);

    for (const [rowIdx, colIdx, value] of updates) {
      const rrng = rowRanges(sumXml);
      sumXml = updateCell(sumXml, rowIdx, colIdx, value, rrng);
    }

    docXml = docXml.slice(0, sumPos.start) + sumXml + docXml.slice(sumPos.end);
  }

  zip.file("word/document.xml", docXml);

  return zip.generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;
}

// Export function untuk API route (Log Export feature)
export async function generateDocxFromData(data: ConversionData): Promise<Buffer> {
  // Load template file
  const fs = require('fs');
  const path = require('path');

  const templatePath = path.join(process.cwd(), 'public', 'templates', 'LogDTE.docx');

  if (!fs.existsSync(templatePath)) {
    throw new Error('Template file not found: public/templates/LogDTE.docx');
  }

  const templateBuffer = fs.readFileSync(templatePath);
  return fillDocx(templateBuffer, data);
}
