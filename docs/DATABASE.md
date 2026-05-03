# Database Documentation (Turso)

## Connection
```typescript
import { getTursoClient, initDatabase } from "@/lib/turso";

// Initialize tables
await initDatabase();

// Get client
const db = getTursoClient();
```

## Environment Variables
```bash
TURSO_DATABASE_URL=libsql://axonz-axonz.aws-ap-northeast-1.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

## Schema

### 1. conversion_batches
Summary setiap konversi Excel ke Word.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| periode | TEXT | Periode laporan (e.g., "Agustus 2025") |
| tanggal | TEXT | Tanggal konversi |
| total_tiket | INTEGER | Total tiket valid |
| total_pending | INTEGER | Tiket pending |
| total_selesai | INTEGER | Tiket selesai (= total_tiket - pending) |
| total_met_resp | INTEGER | Tiket dengan SLA Response terpenuhi |
| total_met_resol | INTEGER | Tiket dengan SLA Resolution terpenuhi |
| pct_met_resp | TEXT | Persentase SLA Response (e.g., "95.89%") |
| pct_met_resol | TEXT | Persentase SLA Resolution |
| incident_count | INTEGER | Jumlah INC tickets |
| sr_count | INTEGER | Jumlah WO tickets |
| top_5 | TEXT | JSON array top 5 ringkasan |
| created_at | DATETIME | Timestamp |

### 2. tickets
Detail setiap tiket.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| batch_id | INTEGER FK | Reference ke conversion_batches |
| no | INTEGER | Nomor urut (1, 2, 3...) |
| tiket | TEXT | Nomor tiket (WO000..., INC000...) |
| ringkasan | TEXT | Ringkasan masalah |
| rincian | TEXT | Detail masalah |
| pemohon | TEXT | Nama pemohon |
| penyebab | TEXT | Penyebab masalah |
| solusi | TEXT | Solusi yang diberikan |
| tipe | TEXT | Tipe tiket (IN/SR) |
| tanggal | TEXT | Tanggal (DD/MM/YYYY) |
| pic | TEXT | PIC/Handler |
| vendor | TEXT | Vendor (jika ada) |
| status | TEXT | Status tiket |
| sla_respon | TEXT | Waktu SLA Response (timestamp) |
| sla_resol | TEXT | Waktu SLA Resolution (timestamp) |
| status_respon | TEXT | Status SLA Respon (Met/Missed/Pending) |
| status_resol | TEXT | Status SLA Resolusi (Met/Missed/Pending) |
| created_at | DATETIME | Timestamp |

### 3. top_ringkasan
Top 5 kategori masalah.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| batch_id | INTEGER FK | Reference ke conversion_batches |
| ringkasan | TEXT | Kategori masalah |
| count | INTEGER | Frekuensi |
| created_at | DATETIME | Timestamp |

## Functions

### saveConversionBatch(data, tickets, top5)
Simpan hasil konversi ke database.

```typescript
const batchId = await saveConversionBatch(
  {
    periode: "Agustus 2025",
    tanggal: "24 Agustus 2025",
    totalTiket: 146,
    totalPending: 0,
    totalSelesai: 146,
    totalMetResp: 140,
    totalMetResol: 138,
    pctMetResp: "95.89%",
    pctMetResol: "94.52%",
    incidentCount: 45,
    srCount: 101,
  },
  tickets,  // Ticket[]
  top5      // Array<[string, number]>
);
```

### getAllBatches()
Ambil semua batch (untuk dashboard list).

```typescript
const batches = await getAllBatches();
```

### getBatchById(batchId)
Ambil detail batch + tiket + top5.

```typescript
const { batch, tickets, top5 } = await getBatchById(1);
```

### getTicketsByPIC(batchId)
Statistik tiket per PIC (untuk chart).

```typescript
const picStats = await getTicketsByPIC(1);
// [{ pic: "User1", ticket_count: 25 }, ...]
```

### getSLAStats(batchId)
Statistik SLA (untuk gauge chart).

```typescript
const slaStats = await getSLAStats(1);
// { met_resp: 140, met_resol: 138, total: 146 }
```

## Query Examples

### PIC Performance Chart
```sql
SELECT pic, COUNT(*) as ticket_count 
FROM tickets 
WHERE batch_id = ? 
GROUP BY pic 
ORDER BY ticket_count DESC
```

### SLA Calculation
```sql
SELECT 
  SUM(CASE WHEN sla_respon IN ('met', '1', 'terpenuhi') THEN 1 ELSE 0 END) as met_resp,
  SUM(CASE WHEN sla_resol IN ('met', '1', 'terpenuhi') THEN 1 ELSE 0 END) as met_resol,
  COUNT(*) as total
FROM tickets 
WHERE batch_id = ?
```

### Top Issues
```sql
SELECT ringkasan, COUNT(*) as count 
FROM tickets 
WHERE batch_id = ? 
GROUP BY ringkasan 
ORDER BY count DESC 
LIMIT 5
```

---

## Menghapus Data (Cleanup)

> Jalankan query-query berikut di **Turso Dashboard (Shell/Studio)** atau via **Turso CLI**:
> ```bash
> turso db shell nama-database
> ```

### ⚠️ PENTING: Selalu Preview Dulu Sebelum Hapus

Sebelum menjalankan `DELETE`, gunakan `SELECT` untuk memastikan data yang akan dihapus sudah benar.

---

### 1. Lihat Semua Data yang Tersimpan

```sql
-- Lihat semua batch (ringkasan upload)
SELECT id, periode, total_tiket, created_at 
FROM conversion_batches 
ORDER BY created_at DESC;
```

```sql
-- Hitung total baris per tabel
SELECT 'conversion_batches' as tabel, COUNT(*) as jumlah FROM conversion_batches
UNION ALL
SELECT 'tickets', COUNT(*) FROM tickets
UNION ALL
SELECT 'top_ringkasan', COUNT(*) FROM top_ringkasan;
```

---

### 2. Hapus Berdasarkan Bulan & Tahun Tertentu

Format periode: `"NamaBulan Tahun"` (contoh: `"Januari 2025"`, `"Maret 2026"`)

```sql
-- Preview: lihat data bulan tertentu
SELECT id, periode, total_tiket, created_at 
FROM conversion_batches 
WHERE periode = 'Januari 2025';

-- HAPUS data Januari 2025
DELETE FROM top_ringkasan WHERE batch_id IN (
  SELECT id FROM conversion_batches WHERE periode = 'Januari 2025'
);
DELETE FROM tickets WHERE batch_id IN (
  SELECT id FROM conversion_batches WHERE periode = 'Januari 2025'
);
DELETE FROM conversion_batches WHERE periode = 'Januari 2025';
```

---

### 3. Hapus Berdasarkan Tahun

```sql
-- Preview: lihat semua data tahun 2025
SELECT id, periode, total_tiket, created_at 
FROM conversion_batches 
WHERE periode LIKE '%2025%';

-- HAPUS semua data tahun 2025
DELETE FROM top_ringkasan WHERE batch_id IN (
  SELECT id FROM conversion_batches WHERE periode LIKE '%2025%'
);
DELETE FROM tickets WHERE batch_id IN (
  SELECT id FROM conversion_batches WHERE periode LIKE '%2025%'
);
DELETE FROM conversion_batches WHERE periode LIKE '%2025%';
```

---

### 4. Hapus Berdasarkan Rentang Bulan (dalam Satu Tahun)

Contoh: hapus dari **Januari 2025** sampai **Juni 2025**.

```sql
-- Preview: lihat data Januari - Juni 2025
SELECT id, periode, total_tiket, created_at 
FROM conversion_batches 
WHERE periode IN (
  'Januari 2025', 'Februari 2025', 'Maret 2025', 
  'April 2025', 'Mei 2025', 'Juni 2025'
);

-- HAPUS data Januari - Juni 2025
DELETE FROM top_ringkasan WHERE batch_id IN (
  SELECT id FROM conversion_batches WHERE periode IN (
    'Januari 2025', 'Februari 2025', 'Maret 2025', 
    'April 2025', 'Mei 2025', 'Juni 2025'
  )
);
DELETE FROM tickets WHERE batch_id IN (
  SELECT id FROM conversion_batches WHERE periode IN (
    'Januari 2025', 'Februari 2025', 'Maret 2025', 
    'April 2025', 'Mei 2025', 'Juni 2025'
  )
);
DELETE FROM conversion_batches WHERE periode IN (
  'Januari 2025', 'Februari 2025', 'Maret 2025', 
  'April 2025', 'Mei 2025', 'Juni 2025'
);
```

---

### 5. Hapus Berdasarkan Rentang Bulan (Lintas Tahun)

Contoh: hapus dari **Oktober 2025** sampai **Maret 2026**.

```sql
-- Preview
SELECT id, periode, total_tiket, created_at 
FROM conversion_batches 
WHERE periode IN (
  'Oktober 2025', 'November 2025', 'Desember 2025',
  'Januari 2026', 'Februari 2026', 'Maret 2026'
);

-- HAPUS data Oktober 2025 - Maret 2026
DELETE FROM top_ringkasan WHERE batch_id IN (
  SELECT id FROM conversion_batches WHERE periode IN (
    'Oktober 2025', 'November 2025', 'Desember 2025',
    'Januari 2026', 'Februari 2026', 'Maret 2026'
  )
);
DELETE FROM tickets WHERE batch_id IN (
  SELECT id FROM conversion_batches WHERE periode IN (
    'Oktober 2025', 'November 2025', 'Desember 2025',
    'Januari 2026', 'Februari 2026', 'Maret 2026'
  )
);
DELETE FROM conversion_batches WHERE periode IN (
  'Oktober 2025', 'November 2025', 'Desember 2025',
  'Januari 2026', 'Februari 2026', 'Maret 2026'
);
```

---

### 6. Hapus Berdasarkan Tanggal Upload (created_at)

Berguna jika ingin hapus berdasarkan kapan data di-upload, bukan berdasarkan periode laporan.

```sql
-- Preview: data yang di-upload sebelum tanggal tertentu
SELECT id, periode, total_tiket, created_at 
FROM conversion_batches 
WHERE DATE(created_at) < '2025-07-01';

-- HAPUS data yang di-upload sebelum 1 Juli 2025
DELETE FROM top_ringkasan WHERE batch_id IN (
  SELECT id FROM conversion_batches WHERE DATE(created_at) < '2025-07-01'
);
DELETE FROM tickets WHERE batch_id IN (
  SELECT id FROM conversion_batches WHERE DATE(created_at) < '2025-07-01'
);
DELETE FROM conversion_batches WHERE DATE(created_at) < '2025-07-01';
```

```sql
-- HAPUS data yang di-upload antara 2 tanggal tertentu
-- Contoh: upload antara 1 Januari 2025 dan 31 Maret 2025
DELETE FROM top_ringkasan WHERE batch_id IN (
  SELECT id FROM conversion_batches 
  WHERE DATE(created_at) BETWEEN '2025-01-01' AND '2025-03-31'
);
DELETE FROM tickets WHERE batch_id IN (
  SELECT id FROM conversion_batches 
  WHERE DATE(created_at) BETWEEN '2025-01-01' AND '2025-03-31'
);
DELETE FROM conversion_batches 
WHERE DATE(created_at) BETWEEN '2025-01-01' AND '2025-03-31';
```

---

### 7. Hapus Batch Tertentu (by ID)

```sql
-- Preview: lihat batch tertentu
SELECT id, periode, total_tiket, created_at 
FROM conversion_batches WHERE id = 5;

-- HAPUS batch ID 5
DELETE FROM top_ringkasan WHERE batch_id = 5;
DELETE FROM tickets WHERE batch_id = 5;
DELETE FROM conversion_batches WHERE id = 5;
```

```sql
-- HAPUS beberapa batch sekaligus (ID 3, 5, 7)
DELETE FROM top_ringkasan WHERE batch_id IN (3, 5, 7);
DELETE FROM tickets WHERE batch_id IN (3, 5, 7);
DELETE FROM conversion_batches WHERE id IN (3, 5, 7);
```

---

### 8. Hapus SEMUA Data (Reset Database)

```sql
-- ⚠️ HATI-HATI: Ini menghapus SELURUH data!
DELETE FROM top_ringkasan;
DELETE FROM tickets;
DELETE FROM conversion_batches;
```

---

### 9. Hapus Tiket Duplikat (Pertahankan yang Terbaru)

Jika ada tiket yang sama muncul di beberapa batch, pertahankan yang paling baru saja.

```sql
-- Preview: lihat tiket duplikat
SELECT tiket, COUNT(*) as jumlah, GROUP_CONCAT(batch_id) as batch_ids
FROM tickets
GROUP BY tiket
HAVING COUNT(*) > 1
ORDER BY jumlah DESC;

-- HAPUS duplikat (pertahankan yang batch_id terbesar / terbaru)
DELETE FROM tickets 
WHERE id NOT IN (
  SELECT MAX(id) FROM tickets GROUP BY tiket
);
```

---

### Referensi Nama Bulan

Gunakan nama bulan bahasa Indonesia berikut untuk query:

| Nomor | Nama Bulan |
|-------|------------|
| 1 | Januari |
| 2 | Februari |
| 3 | Maret |
| 4 | April |
| 5 | Mei |
| 6 | Juni |
| 7 | Juli |
| 8 | Agustus |
| 9 | September |
| 10 | Oktober |
| 11 | November |
| 12 | Desember |

> **Format periode di database**: `"NamaBulan Tahun"` → contoh: `"Agustus 2025"`, `"Januari 2026"`

