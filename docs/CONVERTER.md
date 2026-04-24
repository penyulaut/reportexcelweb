# Converter Logic Documentation

## Overview
File: `@/src/lib/converter.ts`

Fungsi untuk membaca Excel (XLSX) dan mengisi template Word (DOCX).

## Flow Diagram
```
XLSX File → readXlsx() → ConversionData → fillDocx() → DOCX File
                ↓
            Turso DB (saveConversionBatch)
```

## Key Features

### 1. Dynamic Header Detection
Auto-detect baris header dan mapping kolom.

```typescript
const headerInfo = findHeaderRow(ws);
// Returns: { rowNum: 15, colMap: { tiket: 4, ringkasan: 5, ... } }
```

**Known Headers:**
| Excel Header | Mapped Key | Description |
|--------------|------------|-------------|
| No, #, Nomor | seqNo | Nomor urut (1, 2, 3) |
| Tiket, Ticket, Nomor Tiket | tiket | ID Tiket (WO..., INC...) |
| Ringkasan, Summary | ringkasan | Deskripsi masalah |
| PIC, Assignee, Handler | pic | Penanggung jawab |
| Status | status | Status tiket |
| SLA Respon | slaRespon | SLA Response |
| SLA Resolusi | slaResol | SLA Resolution |

### 2. Sheet Selection Priority
1. Exact match: `"All"`
2. Case-insensitive: `"all"`, `"ALL"`
3. Contains: `"All1"`, `"ALL_DATA"`, `"Data_All_2025"`

### 3. Ticket Validation
**Format yang diterima:**
- WO + 10-15 digit: `WO0000000002678` ✅
- INC + 7-15 digit: `INC000000000732` ✅

**Format yang ditolak:**
- `"No Tiket"` (header text) ❌
- `"WO123"` (terlalu pendek) ❌
- `"ABC123"` (prefix tidak dikenal) ❌

### 4. Duplicate Detection
Track tiket yang sudah diproses untuk menghindari double-count.

```typescript
const seenTickets = new Set<string>();
if (seenTickets.has(tiketUpper)) {
  // Skip duplicate
}
```

### 5. Ghost Row Prevention
Stop membaca setelah 5 baris kosong berturut-turut.

```typescript
const MAX_EMPTY_ROWS = 5;
if (emptyRowCount >= MAX_EMPTY_ROWS) break;
```

## Data Interface

### Ticket
```typescript
interface Ticket {
  no: number;           // Sequential (1, 2, 3...)
  tiket: string;      // WO000..., INC000...
  ringkasan: string;  // Problem summary
  rincian: string;    // Problem detail
  pemohon: string;    // Requester name
  penyebab: string;   // Root cause
  solusi: string;     // Solution
  tipe: string;       // Ticket type
  tanggal: string;    // DD/MM/YYYY
  pic: string;        // Handler
  vendor: string;     // Vendor
  status: string;     // Status
  slaRespon: string;  // Met/Missed
  slaResol: string;   // Met/Missed
}
```

### ConversionData
```typescript
interface ConversionData {
  periode: string;      // "Agustus 2025"
  tanggal: string;      // "24 Agustus 2025"
  totalTiket: number;   // 146 (actual count)
  totalPending: number; // 0
  totalSelesai: number; // 146
  totalMetResp: number; // Count from data
  totalMetResol: number; // Count from data
  pctMetResp: string;   // "95.89%"
  pctMetResol: string;  // "94.52%"
  incidentCount: number; // INC tickets
  srCount: number;       // WO tickets
  top5: Array<[string, number]>;
  tickets: Ticket[];
}
```

## Summary Calculation
**Important:** Summary sekarang dihitung dari data valid, bukan dari Excel.

```typescript
const validTickets = tickets.length;  // 146 (bukan 190 dari Excel)
const totalSelesai = validTickets;
const pctMetResp = totalMetResp / totalSelesai;
```

## DOCX Template Filling
Template placeholders di `public/templates/LogDTE.docx`:

| Placeholder | Value |
|-------------|-------|
| {{periode}} | "Agustus 2025" |
| {{tanggal}} | "24 Agustus 2025" |
| {{totalTiket}} | 146 |
| {{totalPending}} | 0 |
| {{totalSelesai}} | 146 |
| {{incidentCount}} | 45 |
| {{srCount}} | 101 |
| {{totalMetResp}} | 140 |
| {{totalMetResol}} | 138 |
| {{pctMetResp}} | "95.89%" |
| {{pctMetResol}} | "94.52%" |

Table rows di-render secara dinamis dari `data.tickets`.

---

## Duplicate Ticket Handling

### Masalah
File Excel "All" sheet punya 2 section:
1. **Detail Table** (row 15-118): Data asli tiket
2. **Summary Table** (row 119-205): Ringkasan dengan tiket yang sama

### Solusi
**Duplicate Detection** di `readXlsx()`:

```typescript
const seenTickets = new Set<string>();

for (const ticket of tickets) {
  if (seenTickets.has(tiketUpper)) {
    console.log(`Skipping duplicate: ${tiketUpper}`);
    continue; // Skip duplicate
  }
  seenTickets.add(tiketUpper);
}
```

### API untuk Analysis
**GET /api/tickets/duplicates**
- List semua tiket yang muncul multiple times
- Cross-batch analysis (jika upload berbulan-bulan)
- Details per occurrence

### Contoh Output
```json
{
  "summary": {
    "unique_tickets": 146,
    "total_records": 292,
    "duplicate_count": 146
  },
  "duplicates": [
    {
      "tiket": "INC000000000732",
      "occurrence_count": 2,
      "periods": ["Agustus 2025"],
      "instances": [...]
    }
  ]
}
```

### Untuk Visualisasi
Duplicate di-skip saat insert ke DB, jadi data di database sudah bersih.
Dashboard menampilkan data unik saja.
