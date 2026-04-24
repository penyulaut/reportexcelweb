# Ticket Input Web - Documentation

## Overview
Aplikasi untuk konversi file Excel (SLA Report) ke dokumen Word (Log DTE) dengan penyimpanan data ke Turso Database untuk visualisasi.

## Fitur Utama
1. **Excel to Word Converter** - Konversi XLSX ke DOCX
2. **Turso Database Integration** - Simpan data untuk visualisasi
3. **Dynamic Header Detection** - Auto-detect kolom di Excel
4. **Duplicate Detection** - Hindari double-count tiket

## Struktur Folder
```
/src
  /app
    /api
      /generate        - POST: Convert Excel to Word + save to DB
      /batches         - GET: List all conversion batches
      /batches/[id]    - GET: Batch detail with stats
  /lib
    converter.ts       - Excel parsing & DOCX generation
    turso.ts           - Database client & functions
/docs
  README.md            - Dokumen ini
  API.md               - API endpoints documentation
  DATABASE.md          - Database schema & queries
  CONVERTER.md         - Converter logic documentation
  CHANGES.md           - Changelog perubahan
```

## Quick Start
1. Install dependencies: `npm install`
2. Setup environment variables di `.env.local`:
   ```
   TURSO_DATABASE_URL=libsql://...
   TURSO_AUTH_TOKEN=eyJ...
   ```
3. Run dev: `npm run dev`
4. Build: `npm run build`

## Teknologi
- Next.js 16.2.4
- TypeScript
- Tailwind CSS
- Turso (LibSQL)
- ExcelJS
- PizZip / DocxTemplater
