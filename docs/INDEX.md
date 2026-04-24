# Documentation Index

## For Frontend Developers

### Quick Start
1. [README.md](./README.md) - Overview aplikasi
2. [API.md](./API.md) - Cara pakai API endpoints
3. [DATABASE.md](./DATABASE.md) - Query untuk visualisasi
4. [AUTH.md](./AUTH.md) - Google OAuth setup

### Integration Guide
```typescript
// 1. Upload Excel → Get DOCX + Batch ID
const response = await fetch('/api/generate', {
  method: 'POST',
  body: formData, // xlsx file
});
const batchId = response.headers.get('X-Batch-Id');

// 2. Fetch data untuk dashboard
const batches = await fetch('/api/batches').then(r => r.json());

// 3. Fetch detail untuk report
const detail = await fetch(`/api/batches/${batchId}`).then(r => r.json());
// detail.picStats → Chart PIC performance
// detail.slaStats → Gauge SLA
// detail.tickets → Table detail
```

## For Backend Developers

### Core Logic
1. [CONVERTER.md](./CONVERTER.md) - Excel parsing logic
2. [DATABASE.md](./DATABASE.md) - Turso schema & functions
3. [CHANGES.md](./CHANGES.md) - Semua perubahan
4. [AUTH.md](./AUTH.md) - Google OAuth setup

### File Structure
```
/src
  /lib
    converter.ts    ← [CONVERTER.md]
    turso.ts        ← [DATABASE.md]
    auth.ts         ← [AUTH.md]
  /app
    /api
      /generate     ← [API.md]
      /batches      ← [API.md]
      /auth         ← [AUTH.md]
  middleware.ts     ← [AUTH.md]
/docs
  INDEX.md          ← You are here
  README.md
  API.md
  DATABASE.md
  CONVERTER.md
  CHANGES.md
  AUTH.md           ← Google OAuth
```

## API Reference Quick Links

| Endpoint | Method | Purpose | Doc |
|----------|--------|---------|-----|
| `/api/generate` | POST | Convert XLSX → DOCX + Save DB | [API.md](./API.md#1-post-apigenerate) |
| `/api/batches` | GET | List all conversions | [API.md](./API.md#2-get-apibatches) |
| `/api/batches/[id]` | GET | Detail + stats | [API.md](./API.md#3-get-apibatchesid) |
| `/api/auth/*` | ALL | Google OAuth | [AUTH.md](./AUTH.md) |

## Database Quick Links

| Function | Purpose | Doc |
|----------|---------|-----|
| `saveConversionBatch()` | Save conversion result | [DATABASE.md](./DATABASE.md#saveconversionbatch) |
| `getAllBatches()` | List for dashboard | [DATABASE.md](./DATABASE.md#getallbatches) |
| `getBatchById()` | Detail view | [DATABASE.md](./DATABASE.md#getbatchbyid) |
| `getTicketsByPIC()` | Chart: PIC performance | [DATABASE.md](./DATABASE.md#getticketsbypic) |
| `getSLAStats()` | Gauge: SLA metrics | [DATABASE.md](./DATABASE.md#getslastats) |

## Recent Changes

**2025-04-24:**
- ✅ Turso Database Integration
- ✅ Dynamic Excel Header Detection
- ✅ Strict Ticket Validation
- ✅ Duplicate Detection
- ✅ Summary Calculation Fix

See [CHANGES.md](./CHANGES.md) for full details.

## Need Help?

1. Check [API.md](./API.md) for endpoint details
2. Check [DATABASE.md](./DATABASE.md) for query examples
3. Check [CONVERTER.md](./CONVERTER.md) for Excel parsing logic
