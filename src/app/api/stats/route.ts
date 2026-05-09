import { NextRequest } from "next/server";
import { getTursoClient } from "@/lib/turso";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const month = searchParams.get("month");
    const groupBy = searchParams.get("groupBy") || "month"; // month | year | pic | type
    const sortBy = searchParams.get("sortBy") || "date"; // date | tickets | sla
    const order = searchParams.get("order") || "desc"; // asc | desc

    const db = getTursoClient();

    // Base query for batches with filters
    let batchQuery = "SELECT * FROM conversion_batches WHERE 1=1";
    const args: (string | number)[] = [];

    if (year) {
      batchQuery += " AND periode LIKE ?";
      args.push(`%${year}%`);
    }

    if (startDate) {
      batchQuery += " AND created_at >= ?";
      args.push(startDate);
    }

    if (endDate) {
      batchQuery += " AND created_at <= ?";
      args.push(endDate);
    }

    // Sorting
    const sortMap: Record<string, string> = {
      date: "created_at",
      tickets: "total_tiket",
      sla: "pct_met_resol",
    };
    batchQuery += ` ORDER BY ${sortMap[sortBy] || "created_at"} ${order.toUpperCase()}`;

    // Run all queries in parallel for maximum speed
    const monthlyFilters: string[] = [];
    const monthlyArgs: (string | number)[] = [];
    if (year) {
      monthlyFilters.push("periode LIKE ?");
      monthlyArgs.push(`%${year}%`);
    }
    if (startDate) {
      monthlyFilters.push("created_at >= ?");
      monthlyArgs.push(startDate);
    }
    if (endDate) {
      monthlyFilters.push("created_at <= ?");
      monthlyArgs.push(endDate);
    }
    const monthlyWhere = monthlyFilters.length > 0 ? ` WHERE ${monthlyFilters.join(" AND ")}` : "";

    const ticketFilters: string[] = [];
    const ticketArgs: (string | number)[] = [];
    if (year) {
      ticketFilters.push("b.periode LIKE ?");
      ticketArgs.push(`%${year}%`);
    }
    if (startDate) {
      ticketFilters.push("b.created_at >= ?");
      ticketArgs.push(startDate);
    }
    if (endDate) {
      ticketFilters.push("b.created_at <= ?");
      ticketArgs.push(endDate);
    }
    const ticketWhere = ticketFilters.length > 0 ? ` AND ${ticketFilters.join(" AND ")}` : "";

    const [batchesResult, monthlyStats, picPerformance, categoryTrends] = await Promise.all([
      // 1. Batches with filters
      db.execute({ sql: batchQuery, args }),

      // 2. Monthly aggregation for chart
      db.execute({
        sql: `SELECT 
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
          SUM(total_pending) as total_pending,
          SUM(total_selesai) as total_selesai,
          SUM(incident_count) as total_incidents,
          SUM(sr_count) as total_sr,
          AVG(CAST(REPLACE(pct_met_resp, '%', '') AS REAL)) as avg_met_resp,
          AVG(CAST(REPLACE(pct_met_resol, '%', '') AS REAL)) as avg_met_resol
        FROM conversion_batches${monthlyWhere}
        GROUP BY periode
        ORDER BY year DESC, month_num DESC`,
        args: monthlyArgs,
      }),

      // 3. PIC performance (filtered by year if provided)
      db.execute({
        sql: `SELECT 
          t.pic,
          COUNT(*) as ticket_count,
          SUM(CASE WHEN t.sla_respon IN ('met', '1', 'terpenuhi', 'Met', 'MET') THEN 1 ELSE 0 END) as met_resp_count,
          SUM(CASE WHEN t.sla_resol IN ('met', '1', 'terpenuhi', 'Met', 'MET') THEN 1 ELSE 0 END) as met_resol_count,
          b.periode
        FROM tickets t
        JOIN conversion_batches b ON t.batch_id = b.id
        WHERE 1=1${ticketWhere}
        GROUP BY t.pic, b.periode
        ORDER BY ticket_count DESC`,
        args: ticketArgs,
      }),

      // 4. Category trends (filtered by year if provided)
      db.execute({
        sql: `SELECT 
          r.ringkasan,
          r.count,
          b.periode
        FROM top_ringkasan r
        JOIN conversion_batches b ON r.batch_id = b.id
        WHERE 1=1${ticketWhere}
        ORDER BY b.created_at DESC, r.count DESC`,
        args: ticketArgs,
      }),
    ]);

    return Response.json({
      batches: batchesResult.rows,
      monthlyStats: monthlyStats.rows,
      picPerformance: picPerformance.rows,
      categoryTrends: categoryTrends.rows,
      filters: { year, startDate, endDate, month, groupBy, sortBy, order },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/stats] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
