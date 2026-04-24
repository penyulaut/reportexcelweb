# Changelog

## 2025-04-24 - Major Update

### 🎯 Features Added

#### 1. Turso Database Integration
**Files:**
- `src/lib/turso.ts` (NEW)
- `src/app/api/batches/route.ts` (NEW)
- `src/app/api/batches/[id]/route.ts` (NEW)

**Description:**
- Auto-save hasil konversi ke Turso DB
- API endpoints untuk query data:
  - `GET /api/batches` - List semua konversi
  - `GET /api/batches/[id]` - Detail batch + stats
- Tables: `conversion_batches`, `tickets`, `top_ringkasan`
- Functions: `saveConversionBatch()`, `getAllBatches()`, `getBatchById()`, `getTicketsByPIC()`, `getSLAStats()`

**Modified:**
- `src/app/api/generate/route.ts` - Tambah save ke DB setelah konversi

---

#### 2. Dynamic Excel Header Detection
**File:** `src/lib/converter.ts`

**Description:**
- Auto-detect baris header (tidak hardcoded row 15)
- Auto-mapping kolom berdasarkan header name
- Support berbagai nama kolom:
  - "No", "#", "Nomor" → seqNo
  - "Tiket", "Ticket", "Nomor Tiket" → tiket
  - "Ringkasan", "Summary" → ringkasan
  - "PIC", "Assignee", "Handler" → pic

**Why:**
- Excel dari berbagai sumber bisa punya struktur berbeda
- Kolom bisa bergeser posisi

---

#### 3. Strict Ticket Validation
**File:** `src/lib/converter.ts`

**Before:**
```typescript
if (tiketUpper.startsWith("INC") || tiketUpper.startsWith("WO"))
```

**After:**
```typescript
const isValidWO = /^WO\d{10,15}$/.test(tiketUpper);
const isValidINC = /^INC\d{7,15}$/.test(tiketUpper);
```

**Why:**
- Mencegah header text masuk sebagai data (e.g., "No Tiket")
- Validasi format ticket number

---

#### 4. Duplicate Detection
**File:** `src/lib/converter.ts`

**Description:**
- Track tiket yang sudah diproses dengan `Set<string>`
- Skip duplicate tickets
- Log: `"[Converter] Row 119: Skipping duplicate ticket: INC000000000732"`

**Why:**
- Excel "All" sheet punya 2 section (detail + summary) dengan data berulang
- Mencegah double-count (190 → 146)

---

#### 5. Ghost Row Prevention
**File:** `src/lib/converter.ts`

**Description:**
- Stop membaca setelah 5 baris kosong berturut-turut
- Cek 3 field: tiket, pic, status

**Why:**
- Excel menyimpan "jejak" row sampai row 205 meskipun data hanya sampai 161

---

#### 6. Summary Calculation Fix
**File:** `src/lib/converter.ts`

**Before:**
```typescript
totalTiket: sumMap["Total Tiket"] ?? validTickets,  // 190 dari Excel
```

**After:**
```typescript
totalTiket: validTickets,  // 146 dari data valid
```

**Why:**
- Excel punya summary section dengan angka yang salah (termasuk duplikat)
- Sekarang hitung dari actual data (146 tickets)

---

#### 7. Sheet Selection Improvement
**File:** `src/lib/converter.ts`

**Priority:**
1. Exact: `"All"`
2. Case-insensitive: `"all"`, `"ALL"`
3. Contains: `"All1"`, `"All_DATA"`

**Why:**
- Support berbagai nama sheet ("All", "All1", "ALL_2025")

---

### 🐛 Bug Fixes

#### Excel Parsing Issues (5 masalah sekaligus)

| Issue | Cause | Solution |
|-------|-------|----------|
| Row Offset | Excel punya 13 baris header | Dynamic header detection |
| Sheet Targeting | Multiple sheets (WO2508, INC2508, All) | Priority "All" sheet |
| Whitespace | "Met " vs "MET" vs "met" | `.trim().toLowerCase()` |
| Hardcoded Columns | Kolom Status pindah ke D | Dynamic column mapping |
| Ghost Rows | Excel cache sampai row 205 | Stop after 5 empty rows |

---

### 📦 Dependencies Added
```json
"@libsql/client": "^0.14.0"
```

---

### 📝 Documentation
Created folder `docs/`:
- `README.md` - Overview
- `API.md` - API endpoints
- `DATABASE.md` - Turso schema & queries
- `CONVERTER.md` - Excel parsing logic
- `CHANGES.md` - This file

---

### 🔧 Config Files
- `.env.local` - Environment variables (Turso credentials)
- `.env.example` - Template for env vars

---

### 8. Database Insert Optimization
**File:** `src/lib/turso.ts`

**Before:**
```typescript
for (const ticket of tickets) {
  await db.execute({...}); // 146 serial round-trips = 17s
}
```

**After:**
```typescript
const CHUNK_SIZE = 10;
for (let i = 0; i < tickets.length; i += CHUNK_SIZE) {
  const chunk = tickets.slice(i, i + CHUNK_SIZE);
  await Promise.all(chunk.map(...)); // ~15 parallel batches = ~2s
}
```

**Result:** ~8x faster (17s → 2s)

---

### 9. Visualization API Endpoints
**Files:**
- `src/app/api/stats/route.ts` (NEW)
- `src/app/api/tickets/duplicates/route.ts` (NEW)
- `src/lib/turso.ts` (updated)

**New Endpoints:**

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats?year=2025&month=Agustus` | Dashboard stats with filters |
| `GET /api/tickets/duplicates` | Analyze duplicate tickets |

**Query Functions Added:**
- `getMonthlyStats(year?)` - Monthly aggregation for charts
- `getPICPerformanceOverTime(pic?, year?)` - PIC trends
- `getCategoryTrends(category?, limit?)` - Category trends over time
- `analyzeDuplicates(minOccurrences?)` - Duplicate analysis
- `getBatchesWithFilters(filters, sortBy, order)` - Filtered batch list
- `getSLATrends(year?)` - SLA trends over months

**Filters & Sorting:**
- Filter by: `year`, `month`, `minTickets`, `maxTickets`
- Sort by: `date`, `tickets`, `sla`
- Order: `asc`, `desc`

---

### 10. Google OAuth Authentication
**Files:**
- `src/auth.ts` (NEW)
- `src/middleware.ts` (NEW)
- `src/app/api/auth/[...nextauth]/route.ts` (NEW)
- `src/components/auth/GoogleSignInButton.tsx` (NEW)
- `src/components/providers/NextAuthProvider.tsx` (NEW)
- `src/app/layout.tsx` (updated)
- `src/app/(full-width-pages)/(auth)/signin/page.tsx` (updated)

**Features:**
- Google OAuth via NextAuth.js v5
- Route protection with middleware
- Session management with JWT
- Redirect to signin for unauthenticated users

**Protected Routes:**
- All routes except `/`, `/signin`, `/error`, `/api/*`
- Automatic redirect to `/signin`

**Setup:**
1. Get credentials from Google Cloud Console
2. Set environment variables:
   ```bash
   GOOGLE_CLIENT_ID=xxx
   GOOGLE_CLIENT_SECRET=xxx
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=xxx
   ```

See [AUTH.md](./AUTH.md) for detailed setup guide.

---

### 📊 Stats Perubahan
| Metric | Before | After |
|--------|--------|-------|
| Total Tickets | 190 (wrong) | 146 (correct) |
| Header Row | Hardcoded 16 | Auto-detect |
| Column Mapping | Static | Dynamic |
| Duplicate Handling | None | Auto-skip |
| Database Storage | None | Turso DB |
| API for Visualization | None | 5 endpoints |
| DB Insert Time | 17s (serial) | ~2s (parallel) |
| Visualization Queries | None | 6 functions |
| Authentication | None | Google OAuth |
