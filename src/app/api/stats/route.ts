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

    const batchesResult = await db.execute({ sql: batchQuery, args });

    if (batchesResult.rows.length === 0) {
      return Response.json({
        batches: [],
        monthlyStats: [],
        picPerformance: [],
        categoryTrends: [],
        filters: { year, startDate, endDate, month, groupBy, sortBy, order },
      });
    }

    const batchIds = batchesResult.rows.map(r => r.id as number);

    // Fetch tickets and deduplicate (same logic as export)
    const ticketsQuery = `
      SELECT t.*, b.periode, b.created_at as batch_created_at 
      FROM tickets t
      JOIN conversion_batches b ON t.batch_id = b.id
      WHERE t.batch_id IN (${batchIds.map(() => "?").join(",")})
      ORDER BY t.batch_id DESC, t.no ASC
    `;
    const ticketsResult = await db.execute({
      sql: ticketsQuery,
      args: batchIds
    });

    const uniqueTicketsMap = new Map<string, typeof ticketsResult.rows[0]>();
    for (const ticket of ticketsResult.rows) {
      const ticketNo = ticket.tiket as string;
      if (!uniqueTicketsMap.has(ticketNo)) {
        uniqueTicketsMap.set(ticketNo, ticket);
      }
    }
    const deduplicatedTickets = Array.from(uniqueTicketsMap.values());

    const hasStatusColumns = deduplicatedTickets.some(
      (t) => (t.status_respon as string || "") !== "" || (t.status_resol as string || "") !== ""
    );

    const monthlyMap = new Map<string, any>();
    const picMap = new Map<string, any>();
    const categoryMap = new Map<string, any>();

    const getMonthNum = (periode: string) => {
      const p = periode.toLowerCase();
      if (p.includes('januari')) return '01';
      if (p.includes('februari')) return '02';
      if (p.includes('maret')) return '03';
      if (p.includes('april')) return '04';
      if (p.includes('mei')) return '05';
      if (p.includes('juni')) return '06';
      if (p.includes('juli')) return '07';
      if (p.includes('agustus')) return '08';
      if (p.includes('september')) return '09';
      if (p.includes('oktober')) return '10';
      if (p.includes('november')) return '11';
      if (p.includes('desember')) return '12';
      return '00';
    };

    const getYearStr = (periode: string) => {
      const parts = periode.split(' ');
      return parts.length > 1 ? parts[parts.length - 1] : '';
    };

    for (const t of deduplicatedTickets) {
      const periode = t.periode as string;
      
      if (!monthlyMap.has(periode)) {
        monthlyMap.set(periode, {
          month_name: periode,
          year: getYearStr(periode),
          month_num: getMonthNum(periode),
          total_tickets: 0,
          total_pending: 0,
          total_selesai: 0,
          total_incidents: 0,
          total_sr: 0,
          met_resp: 0,
          met_resol: 0,
          avg_met_resp: 0,
          avg_met_resol: 0
        });
      }
      const mStat = monthlyMap.get(periode);

      mStat.total_tickets++;

      const tipeCode = (t.tipe as string || "").trim().toUpperCase();
      if (tipeCode === "IN" || tipeCode.includes("INCIDENT")) {
        mStat.total_incidents++;
      } else if (tipeCode === "SR" || tipeCode.includes("SERVICE REQUEST")) {
        mStat.total_sr++;
      }

      const picName = (t.pic as string || "Unknown").trim();
      const picKey = `${picName}-${periode}`;
      if (!picMap.has(picKey)) {
        picMap.set(picKey, {
          pic: picName,
          periode: periode,
          ticket_count: 0,
          met_resp_count: 0,
          met_resol_count: 0
        });
      }
      const pStat = picMap.get(picKey);
      pStat.ticket_count++;

      const categoryName = (t.ringkasan as string || "No Category").trim();
      const catKey = `${categoryName}-${periode}`;
      if (!categoryMap.has(catKey)) {
        categoryMap.set(catKey, {
          ringkasan: categoryName,
          periode: periode,
          count: 0,
          batch_created_at: t.batch_created_at
        });
      }
      const cStat = categoryMap.get(catKey);
      cStat.count++;

      let respon = "";
      let resol = "";

      if (hasStatusColumns) {
        respon = ((t.status_respon as string) || "").trim().toLowerCase();
        resol = ((t.status_resol as string) || "").trim().toLowerCase();
      } else {
        respon = ((t.sla_respon as string) || "").trim().toLowerCase();
        resol = ((t.sla_resol as string) || "").trim().toLowerCase();
      }

      let isPending = false;
      if (respon !== "" && resol === "") {
        isPending = true;
      } else if (resol === "pending" || respon === "pending") {
        isPending = true;
      }

      if (isPending) {
        mStat.total_pending++;
      }

      const isMetResp = respon === "met" || respon === "1" || respon === "terpenuhi";
      const isMetResol = resol === "met" || resol === "1" || resol === "terpenuhi";

      if (isMetResp) {
        mStat.met_resp++;
        pStat.met_resp_count++;
      }
      if (isMetResol) {
        mStat.met_resol++;
        pStat.met_resol_count++;
      }
    }

    const monthlyStats = Array.from(monthlyMap.values()).map(m => {
      m.total_selesai = m.total_tickets - m.total_pending;
      const denominator = m.total_selesai > 0 ? m.total_selesai : 1;
      m.avg_met_resp = Number(((m.met_resp / denominator) * 100).toFixed(2));
      m.avg_met_resol = Number(((m.met_resol / denominator) * 100).toFixed(2));
      return m;
    });

    monthlyStats.sort((a, b) => {
      if (b.year !== a.year) return Number(b.year) - Number(a.year);
      return Number(b.month_num) - Number(a.month_num);
    });

    const picPerformance = Array.from(picMap.values());
    picPerformance.sort((a, b) => b.ticket_count - a.ticket_count);

    const categoryTrends = Array.from(categoryMap.values());
    categoryTrends.sort((a, b) => {
      if (b.batch_created_at !== a.batch_created_at) {
        return new Date(b.batch_created_at as string).getTime() - new Date(a.batch_created_at as string).getTime();
      }
      return b.count - a.count;
    });

    return Response.json({
      batches: batchesResult.rows,
      monthlyStats: monthlyStats,
      picPerformance: picPerformance,
      categoryTrends: categoryTrends,
      filters: { year, startDate, endDate, month, groupBy, sortBy, order },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/stats] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
