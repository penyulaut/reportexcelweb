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
  incidentCount: number;
  srCount: number;
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
  if (isNaN(f) || !isFinite(f)) return "0%";
  return `${Math.round(f <= 1 ? f * 100 : f)}%`;
}

/** Unwrap ExcelJS formula/rich-text cell values to their plain result. */
function cellVal(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object" && "result" in (v as object))
    return (v as { result: unknown }).result;
  if (typeof v === "object" && "richText" in (v as object))
    return (v as { richText: Array<{ text: string }> }).richText
      .map((r) => r.text)
      .join("");
  return v;
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

export async function readXlsx(buffer: any): Promise<ConversionData> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet("All");
  if (!ws) throw new Error('Sheet "All" tidak ditemukan dalam file XLSX');

  // Summary section: rows 3–10, label in col D (4), value in col E (5)
  const sumMap: Record<string, number> = {};
  for (let r = 3; r <= 10; r++) {
    const row = ws.getRow(r);
    const label = cellVal(row.getCell(4));
    let val = cellVal(row.getCell(5));
    if (typeof val === "string") val = parseFloat(val);
    if (label && val != null && !isNaN(val as number)) {
      sumMap[String(label)] = Number(val);
    }
  }

  // Detail section: rows 16+, col C (3) = sequential row number
  const tickets: Ticket[] = [];
  const dates: Date[] = [];

  ws.eachRow((row, rowNum) => {
    if (rowNum < 16) return;
    const noVal = cellVal(row.getCell(3));
    if (noVal == null || typeof noVal !== "number") return;

    const tglVal = cellVal(row.getCell(11));
    let tglStr = "";
    if (tglVal instanceof Date) {
      const d = tglVal;
      tglStr = `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1
      ).padStart(2, "0")}/${d.getFullYear()}`;
      dates.push(d);
    } else if (tglVal) {
      tglStr = String(tglVal);
    }

    tickets.push({
      no: Math.round(noVal as number),
      tiket: String(cellVal(row.getCell(4)) ?? ""),
      ringkasan: String(cellVal(row.getCell(5)) ?? ""),
      rincian: String(cellVal(row.getCell(6)) ?? ""),
      pemohon: String(cellVal(row.getCell(7)) ?? ""),
      penyebab: String(cellVal(row.getCell(8)) ?? ""),
      solusi: String(cellVal(row.getCell(9)) ?? ""),
      tipe: String(cellVal(row.getCell(10)) ?? ""),
      tanggal: tglStr,
      pic: String(cellVal(row.getCell(12)) ?? ""),
      vendor: String(cellVal(row.getCell(13)) ?? ""),
      status: String(cellVal(row.getCell(14)) ?? ""),
      slaRespon: String(cellVal(row.getCell(18)) ?? ""),
      slaResol: String(cellVal(row.getCell(19)) ?? ""),
    });
  });

  // Sort primary by PIC (worker id) then original ticket number, then re-number
  tickets.sort(
    (a, b) =>
      a.pic.toLowerCase().localeCompare(b.pic.toLowerCase()) || a.no - b.no
  );
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

  // Count incident vs Service Request / Work Order
  let incidentCount = 0;
  let srCount = 0;
  for (const t of tickets) {
    if (t.tipe.toLowerCase().includes("incident")) incidentCount++;
    else srCount++;
  }

  const today = new Date();
  const tanggal = `${today.getDate()} ${MONTHS_ID[today.getMonth() + 1]} ${today.getFullYear()}`;

  return {
    periode,
    tanggal,
    totalTiket: sumMap["Total Tiket"] ?? tickets.length,
    totalPending: sumMap["Total Pending"] ?? 0,
    totalSelesai: sumMap["Total Tiket Yang Selesai"] ?? 0,
    totalMetResp: sumMap["Total Met Response"] ?? 0,
    totalMetResol: sumMap["Total Met Resolution"] ?? 0,
    pctMetResp: fmtPct(sumMap["% Met Response"]),
    pctMetResol: fmtPct(sumMap["% Met Resolution"]),
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
