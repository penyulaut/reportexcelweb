import { createClient, Client } from "@libsql/client";

// Support both libsql:// and https:// formats
// Turso requires https:// for remote connections
const rawUrl = process.env.TURSO_DATABASE_URL || "libsql://axonz-axonz.aws-ap-northeast-1.turso.io";
const TURSO_URL = rawUrl.replace("libsql://", "https://");
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzcwNDkxNjEsImlkIjoiMDE5ZGMwNTUtMWMwMS03YjM5LWI4ZWYtZmRlZTcwMmUzNjY5IiwicmlkIjoiOTY5YmJlYjYtN2U2Yy00N2M2LTllNjEtNDA1MDk1NjQwMDUxIn0.lKGl3D8rQYLha-RcfT38USjtPtGwEYWq-W50_XTYktDigVnZk1JO-c3cPwOQTCAmnJvv8IhpPPNtNJfm4iUECQ";

let client: Client | null = null;

export function getTursoClient(): Client {
  if (!client) {
    console.log(`[Turso] Connecting to: ${TURSO_URL}`);
    console.log(`[Turso] Token (first 50 chars): ${TURSO_TOKEN.substring(0, 50)}...`);
    client = createClient({
      url: TURSO_URL,
      authToken: TURSO_TOKEN,
    });
  }
  return client;
}

// Initialize database tables
export async function initDatabase() {
  const db = getTursoClient();
  
  try {
    // Table for conversion batches/sessions
    await db.execute(`
      CREATE TABLE IF NOT EXISTS conversion_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        periode TEXT NOT NULL,
        tanggal TEXT NOT NULL,
        total_tiket INTEGER NOT NULL,
        total_pending INTEGER NOT NULL,
        total_selesai INTEGER NOT NULL,
        total_met_resp INTEGER NOT NULL,
        total_met_resol INTEGER NOT NULL,
        pct_met_resp TEXT NOT NULL,
        pct_met_resol TEXT NOT NULL,
        incident_count INTEGER NOT NULL,
        sr_count INTEGER NOT NULL,
        top_5 TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add top_5 column if it doesn't exist (migration for existing DBs)
    try {
      await db.execute(`ALTER TABLE conversion_batches ADD COLUMN top_5 TEXT DEFAULT '[]'`);
    } catch {
      // Column already exists, ignore
    }

    // Table for users (authentication)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  
  // Table for individual tickets
  await db.execute(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      no INTEGER NOT NULL,
      tiket TEXT NOT NULL,
      ringkasan TEXT,
      rincian TEXT,
      pemohon TEXT,
      penyebab TEXT,
      solusi TEXT,
      tipe TEXT,
      tanggal TEXT,
      pic TEXT,
      vendor TEXT,
      status TEXT,
      sla_respon TEXT,
      sla_resol TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES conversion_batches(id)
    )
  `);
  
  // Table for top 5 ringkasan
  await db.execute(`
    CREATE TABLE IF NOT EXISTS top_ringkasan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      ringkasan TEXT NOT NULL,
      count INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES conversion_batches(id)
    )
  `);

  // Performance indexes
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_tickets_batch_id ON tickets(batch_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_tickets_tiket ON tickets(tiket)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_tickets_pic ON tickets(pic)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_batches_periode ON conversion_batches(periode)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_batches_created_at ON conversion_batches(created_at)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_top_ringkasan_batch_id ON top_ringkasan(batch_id)`);
  
  console.log("[Turso] Database initialized successfully");
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    if (error.code === 'SERVER_ERROR' && error.message?.includes('404')) {
      console.error("[Turso] ERROR: Database not found (404)");
      console.error("[Turso] Please check:");
      console.error("  1. Database URL is correct");
      console.error("  2. Database exists in Turso dashboard");
      console.error("  3. Auth token is valid");
      console.error("[Turso] Current URL:", TURSO_URL);
    }
    throw err;
  }
}

export interface ConversionBatch {
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
}

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

export async function saveConversionBatch(
  data: ConversionBatch,
  tickets: Ticket[],
  top5: Array<[string, number]>
): Promise<number> {
  const db = getTursoClient();
  
  // Insert batch summary (including top_5 JSON)
  const top5Json = JSON.stringify(top5);
  const batchResult = await db.execute({
    sql: `
      INSERT INTO conversion_batches 
      (periode, tanggal, total_tiket, total_pending, total_selesai, 
       total_met_resp, total_met_resol, pct_met_resp, pct_met_resol, 
       incident_count, sr_count, top_5)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      data.periode,
      data.tanggal,
      data.totalTiket,
      data.totalPending,
      data.totalSelesai,
      data.totalMetResp,
      data.totalMetResol,
      data.pctMetResp,
      data.pctMetResol,
      data.incidentCount,
      data.srCount,
      top5Json,
    ],
  });
  
  const batchId = Number(batchResult.lastInsertRowid);
  
  // Insert all tickets + top5 in a single db.batch() call (one HTTP round-trip)
  console.log(`[Turso] Inserting ${tickets.length} tickets via batch()...`);
  const insertStart = Date.now();
  
  const statements = tickets.map(ticket => ({
    sql: `INSERT INTO tickets 
          (batch_id, no, tiket, ringkasan, rincian, pemohon, penyebab, 
           solusi, tipe, tanggal, pic, vendor, status, sla_respon, sla_resol)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      batchId,
      ticket.no,
      ticket.tiket,
      ticket.ringkasan,
      ticket.rincian,
      ticket.pemohon,
      ticket.penyebab,
      ticket.solusi,
      ticket.tipe,
      ticket.tanggal,
      ticket.pic,
      ticket.vendor,
      ticket.status,
      ticket.slaRespon,
      ticket.slaResol,
    ],
  }));

  // Add top5 ringkasan inserts to the same batch
  for (const [ringkasan, count] of top5) {
    statements.push({
      sql: `INSERT INTO top_ringkasan (batch_id, ringkasan, count) VALUES (?, ?, ?)`,
      args: [batchId, ringkasan, count],
    });
  }

  await db.batch(statements, "write");
  console.log(`[Turso] All ${tickets.length} tickets + ${top5.length} top5 inserted in ${Date.now() - insertStart}ms`);
  
  return batchId;
}

// Query functions for visualization
export async function getAllBatches() {
  const db = getTursoClient();
  const result = await db.execute(
    `SELECT id, periode, tanggal, total_tiket, total_pending, total_selesai,
            incident_count, sr_count, pct_met_resp, pct_met_resol, created_at
     FROM conversion_batches ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function getUserByUsername(username: string) {
  const db = getTursoClient();
  const result = await db.execute({
    sql: "SELECT id, username, password FROM users WHERE username = ?",
    args: [username],
  });
  return result.rows[0];
}

export async function getBatchById(batchId: number) {
  const db = getTursoClient();
  // Run all 3 queries in parallel
  const [batch, tickets, top5] = await Promise.all([
    db.execute({
      sql: "SELECT * FROM conversion_batches WHERE id = ?",
      args: [batchId],
    }),
    db.execute({
      sql: `SELECT no, tiket, ringkasan, rincian, pemohon, penyebab, solusi,
                   tipe, tanggal, pic, vendor, status, sla_respon, sla_resol
            FROM tickets WHERE batch_id = ? ORDER BY no`,
      args: [batchId],
    }),
    db.execute({
      sql: "SELECT ringkasan, count FROM top_ringkasan WHERE batch_id = ? ORDER BY count DESC",
      args: [batchId],
    }),
  ]);
  return {
    batch: batch.rows[0],
    tickets: tickets.rows,
    top5: top5.rows,
  };
}

export async function getTicketsByPIC(batchId: number) {
  const db = getTursoClient();
  const result = await db.execute({
    sql: `
      SELECT pic, COUNT(*) as ticket_count 
      FROM tickets 
      WHERE batch_id = ? 
      GROUP BY pic 
      ORDER BY ticket_count DESC
    `,
    args: [batchId],
  });
  return result.rows;
}

export async function getSLAStats(batchId: number) {
  const db = getTursoClient();
  const result = await db.execute({
    sql: `
      SELECT 
        SUM(CASE WHEN sla_respon IN ('met', '1', 'terpenuhi', 'Met', 'MET') THEN 1 ELSE 0 END) as met_resp,
        SUM(CASE WHEN sla_resol IN ('met', '1', 'terpenuhi', 'Met', 'MET') THEN 1 ELSE 0 END) as met_resol,
        COUNT(*) as total
      FROM tickets 
      WHERE batch_id = ?
    `,
    args: [batchId],
  });
  return result.rows[0];
}

// ============ VISUALIZATION QUERIES ============

/**
 * Get monthly aggregated stats for charts
 */
export async function getMonthlyStats(year?: string) {
  const db = getTursoClient();
  
  let sql = `
    SELECT 
      substr(periode, -4) as year,
      CASE 
        WHEN periode LIKE '%Januari%' THEN '01'
        WHEN periode LIKE '%Februari%' THEN '02'
        WHEN periode LIKE '%Maret%' THEN '03'
        WHEN periode LIKE '%April%' THEN '04'
        WHEN periode LIKE '%Mei%' THEN '05'
        WHEN periode LIKE '%Juni%' THEN '06'
        WHEN periode LIKE '%Juli%' THEN '07'
        WHEN periode LIKE '%Agustus%' THEN '08'
        WHEN periode LIKE '%September%' THEN '09'
        WHEN periode LIKE '%Oktober%' THEN '10'
        WHEN periode LIKE '%November%' THEN '11'
        WHEN periode LIKE '%Desember%' THEN '12'
      END as month_num,
      periode as month_name,
      SUM(total_tiket) as total_tickets,
      SUM(incident_count) as total_incidents,
      SUM(sr_count) as total_sr,
      ROUND(AVG(CAST(REPLACE(pct_met_resp, '%', '') AS REAL)), 2) as avg_met_resp,
      ROUND(AVG(CAST(REPLACE(pct_met_resol, '%', '') AS REAL)), 2) as avg_met_resol
    FROM conversion_batches
  `;
  
  const args: string[] = [];
  if (year) {
    sql += " WHERE periode LIKE ?";
    args.push(`%${year}%`);
  }
  
  sql += ` GROUP BY periode ORDER BY year DESC, month_num DESC`;
  
  const result = await db.execute({ sql, args });
  return result.rows;
}

/**
 * Get PIC performance over time
 */
export async function getPICPerformanceOverTime(pic?: string, year?: string) {
  const db = getTursoClient();
  
  let sql = `
    SELECT 
      t.pic,
      b.periode,
      COUNT(*) as ticket_count,
      SUM(CASE WHEN t.sla_respon IN ('met', '1', 'terpenuhi', 'Met', 'MET') THEN 1 ELSE 0 END) as met_resp_count,
      SUM(CASE WHEN t.sla_resol IN ('met', '1', 'terpenuhi', 'Met', 'MET') THEN 1 ELSE 0 END) as met_resol_count,
      ROUND(
        (SUM(CASE WHEN t.sla_resol IN ('met', '1', 'terpenuhi', 'Met', 'MET') THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 
        2
      ) as sla_percentage
    FROM tickets t
    JOIN conversion_batches b ON t.batch_id = b.id
    WHERE 1=1
  `;
  
  const args: string[] = [];
  if (pic) {
    sql += " AND t.pic = ?";
    args.push(pic);
  }
  if (year) {
    sql += " AND b.periode LIKE ?";
    args.push(`%${year}%`);
  }
  
  sql += ` GROUP BY t.pic, b.periode ORDER BY b.created_at, t.pic`;
  
  const result = await db.execute({ sql, args });
  return result.rows;
}

/**
 * Get category trends over time
 */
export async function getCategoryTrends(category?: string, limit: number = 10) {
  const db = getTursoClient();
  
  let sql = `
    SELECT 
      r.ringkasan as category,
      r.count,
      b.periode,
      b.created_at
    FROM top_ringkasan r
    JOIN conversion_batches b ON r.batch_id = b.id
  `;
  
  const args: (string | number)[] = [];
  if (category) {
    sql += " WHERE r.ringkasan = ?";
    args.push(category);
  }
  
  sql += ` ORDER BY b.created_at DESC, r.count DESC LIMIT ?`;
  args.push(limit);
  
  const result = await db.execute({ sql, args });
  return result.rows;
}

/**
 * Analyze duplicate tickets across batches
 */
export async function analyzeDuplicates(minOccurrences: number = 2) {
  const db = getTursoClient();
  
  // Find tickets that appear in multiple batches
  const result = await db.execute({
    sql: `
      SELECT 
        t.tiket,
        COUNT(*) as occurrence_count,
        COUNT(DISTINCT t.batch_id) as batch_count,
        GROUP_CONCAT(DISTINCT b.periode) as periods,
        MIN(b.created_at) as first_appearance,
        MAX(b.created_at) as last_appearance,
        (
          SELECT pic FROM tickets t2 
          WHERE t2.tiket = t.tiket 
          ORDER BY t2.created_at DESC LIMIT 1
        ) as latest_pic
      FROM tickets t
      JOIN conversion_batches b ON t.batch_id = b.id
      GROUP BY t.tiket
      HAVING occurrence_count >= ?
      ORDER BY occurrence_count DESC, t.tiket
    `,
    args: [minOccurrences],
  });
  
  return result.rows;
}

/**
 * Get batches with filters and sorting
 */
export async function getBatchesWithFilters(
  filters: {
    year?: string;
    month?: string;
    minTickets?: number;
    maxTickets?: number;
  },
  sortBy: 'date' | 'tickets' | 'sla' = 'date',
  order: 'asc' | 'desc' = 'desc'
) {
  const db = getTursoClient();
  
  let sql = `SELECT * FROM conversion_batches WHERE 1=1`;
  const args: (string | number)[] = [];
  
  if (filters.year) {
    sql += " AND periode LIKE ?";
    args.push(`%${filters.year}%`);
  }
  if (filters.month) {
    sql += " AND periode LIKE ?";
    args.push(`%${filters.month}%`);
  }
  if (filters.minTickets !== undefined) {
    sql += " AND total_tiket >= ?";
    args.push(filters.minTickets);
  }
  if (filters.maxTickets !== undefined) {
    sql += " AND total_tiket <= ?";
    args.push(filters.maxTickets);
  }
  
  // Sorting
  const sortMap: Record<string, string> = {
    date: "created_at",
    tickets: "total_tiket",
    sla: "CAST(REPLACE(pct_met_resol, '%', '') AS REAL)",
  };
  sql += ` ORDER BY ${sortMap[sortBy]} ${order.toUpperCase()}`;
  
  const result = await db.execute({ sql, args });
  return result.rows;
}

/**
 * Get SLA trends over months
 */
export async function getSLATrends(year?: string) {
  const db = getTursoClient();
  
  let sql = `
    SELECT 
      periode,
      total_tiket,
      pct_met_resp,
      pct_met_resol,
      incident_count,
      sr_count,
      CAST(REPLACE(pct_met_resp, '%', '') AS REAL) as met_resp_num,
      CAST(REPLACE(pct_met_resol, '%', '') AS REAL) as met_resol_num
    FROM conversion_batches
  `;
  
  const args: string[] = [];
  if (year) {
    sql += " WHERE periode LIKE ?";
    args.push(`%${year}%`);
  }
  
  sql += ` ORDER BY created_at`;
  
  const result = await db.execute({ sql, args });
  return result.rows;
}
