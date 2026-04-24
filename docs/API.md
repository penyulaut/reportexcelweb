# API Documentation

## Endpoints

### 1. POST /api/generate
Konversi Excel ke Word dan simpan ke database.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `xlsx` (File XLSX, max 5MB)

**Response:**
- Content-Type: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Headers:
  - `X-Tickets`: Jumlah tiket yang terbaca
  - `X-Periode`: Periode laporan
  - `X-Batch-Id`: ID di Turso database

**Error Responses:**
- `400`: No file / Invalid format / File too large
- `500`: Server error

**Example:**
```bash
curl -X POST -F "xlsx=@202508-all SLA.xlsx" http://localhost:3000/api/generate -o output.docx
```

---

### 2. GET /api/batches
List semua konversi yang tersimpan di database.

**Query Parameters:**
- `year` - Filter by year (e.g., "2025")
- `month` - Filter by month name (e.g., "Agustus")
- `sortBy` - Sort by: `date` | `tickets` | `sla`
- `order` - Order: `asc` | `desc`

**Response:**
```json
{
  "batches": [
    {
      "id": 1,
      "periode": "Agustus 2025",
      "tanggal": "24 Agustus 2025",
      "total_tiket": 146,
      "total_pending": 0,
      "total_selesai": 146,
      "total_met_resp": 140,
      "total_met_resol": 138,
      "pct_met_resp": "95.89%",
      "pct_met_resol": "94.52%",
      "incident_count": 45,
      "sr_count": 101,
      "created_at": "2025-08-24T10:30:00Z"
    }
  ]
}
```

**Example with filters:**
```bash
curl "http://localhost:3000/api/batches?year=2025&sortBy=tickets&order=desc"
```

---

### 3. GET /api/batches/[id]
Detail batch dengan statistik tambahan.

**Response:**
```json
{
  "batch": { ... },
  "tickets": [...],
  "top5": [...],
  "picStats": [
    { "pic": "User1", "ticket_count": 25 },
    { "pic": "User2", "ticket_count": 20 }
  ],
  "slaStats": {
    "met_resp": 140,
    "met_resol": 138,
    "total": 146
  }
}
```

---

### 4. GET /api/stats
Dashboard stats dengan monthly aggregation dan trends.

**Query Parameters:**
- `year` - Filter by year
- `month` - Filter by month
- `groupBy` - Group by: `month` | `year` | `pic` | `type`
- `sortBy` - Sort by: `date` | `tickets` | `sla`
- `order` - Order: `asc` | `desc`

**Response:**
```json
{
  "batches": [...],
  "monthlyStats": [
    {
      "year": "2025",
      "month_num": "08",
      "month_name": "Agustus 2025",
      "total_tickets": 146,
      "total_incidents": 44,
      "total_sr": 102,
      "avg_met_resp": 95.89,
      "avg_met_resol": 94.52
    }
  ],
  "picPerformance": [
    {
      "pic": "User1",
      "periode": "Agustus 2025",
      "ticket_count": 25,
      "met_resp_count": 24,
      "met_resol_count": 23,
      "sla_percentage": 92.00
    }
  ],
  "categoryTrends": [
    {
      "category": "Printer Error",
      "count": 15,
      "periode": "Agustus 2025"
    }
  ],
  "filters": { "year": "2025", "month": null, ... }
}
```

**Example:**
```bash
curl "http://localhost:3000/api/stats?year=2025&sortBy=tickets"
```

---

### 5. GET /api/tickets/duplicates
Analyze duplicate tickets across all batches.

**Query Parameters:**
- `batchId` - Filter by specific batch
- `tiket` - Search specific ticket number

**Response:**
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
      "periods": ["Agustus 2025", "Agustus 2025"],
      "batch_ids": ["1", "1"],
      "first_seen": "2025-08-24T10:30:00Z",
      "last_seen": "2025-08-24T10:30:00Z",
      "instances": [
        { "batch_id": 1, "pic": "User1", ... },
        { "batch_id": 1, "pic": "User1", ... }
      ]
    }
  ],
  "totalDuplicates": 45
}
```

**Example:**
```bash
curl "http://localhost:3000/api/tickets/duplicates"
curl "http://localhost:3000/api/tickets/duplicates?tiket=INC000000000732"
```

---

## Frontend Integration

### Upload Excel
```typescript
const formData = new FormData();
formData.append('xlsx', file);

const response = await fetch('/api/generate', {
  method: 'POST',
  body: formData,
});

const blob = await response.blob();
const batchId = response.headers.get('X-Batch-Id');
const ticketCount = response.headers.get('X-Tickets');
```

### Fetch Batches (untuk Dashboard)
```typescript
const res = await fetch('/api/batches');
const { batches } = await res.json();
```

### Fetch Batch Detail
```typescript
const res = await fetch(`/api/batches/${batchId}`);
const data = await res.json();
// data.picStats, data.slaStats, data.tickets
```
