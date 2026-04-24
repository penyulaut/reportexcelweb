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
| total_pending | INTEGER | Tiket pending (selalu 0) |
| total_selesai | INTEGER | Tiket selesai (= total_tiket) |
| total_met_resp | INTEGER | Tiket dengan SLA Response terpenuhi |
| total_met_resol | INTEGER | Tiket dengan SLA Resolution terpenuhi |
| pct_met_resp | TEXT | Persentase SLA Response (e.g., "95.89%") |
| pct_met_resol | TEXT | Persentase SLA Resolution |
| incident_count | INTEGER | Jumlah INC tickets |
| sr_count | INTEGER | Jumlah WO tickets |
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
| tipe | TEXT | Tipe tiket |
| tanggal | TEXT | Tanggal (DD/MM/YYYY) |
| pic | TEXT | PIC/Handler |
| vendor | TEXT | Vendor (jika ada) |
| status | TEXT | Status tiket |
| sla_respon | TEXT | SLA Response (Met/Missed/1/0) |
| sla_resol | TEXT | SLA Resolution (Met/Missed/1/0) |
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
