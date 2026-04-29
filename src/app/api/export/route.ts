import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/turso";
import { generateDocxFromData, type ConversionData } from "@/lib/converter";

export const runtime = "nodejs";

// POST /api/export - Export berdasarkan filter periode
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      year,
      month,
      startDate,
      endDate,
      batchId,
      periode,
    }: {
      year?: string;
      month?: string;
      startDate?: string; // YYYY-MM-DD
      endDate?: string; // YYYY-MM-DD
      batchId?: number;
      periode?: string; // Format: "Januari 2025"
    } = body;

    const db = getTursoClient();
    let query = `SELECT id, periode, total_tiket, total_pending, total_selesai,
                        total_met_resp, total_met_resol, pct_met_resp, pct_met_resol,
                        incident_count, sr_count, top_5, created_at
                 FROM conversion_batches WHERE 1=1`;
    const args: (string | number)[] = [];

    // Filter by batchId (prioritas tertinggi)
    if (batchId) {
      query += " AND id = ?";
      args.push(batchId);
    }
    // Filter by periode (e.g., "Januari 2025")
    else if (periode) {
      query += " AND periode = ?";
      args.push(periode);
    }
    // Filter by year
    else if (year && !month) {
      query += " AND periode LIKE ?";
      args.push(`%${year}%`);
    }
    // Filter by year and month
    else if (year && month) {
      const monthNames = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
      ];
      const monthName = monthNames[parseInt(month) - 1];
      query += " AND periode = ?";
      args.push(`${monthName} ${year}`);
    }
    // Filter by date range
    else if (startDate && endDate) {
      query += " AND created_at BETWEEN ? AND ?";
      args.push(startDate, endDate);
    }

    query += " ORDER BY created_at DESC";

    // Get batches
    const batchResult = await db.execute({
      sql: query,
      args,
    });

    if (batchResult.rows.length === 0) {
      return NextResponse.json(
        { error: "No batches found for the selected filters" },
        { status: 404 }
      );
    }

    // Ambil semua batch IDs
    const batchIds = batchResult.rows.map((row) => row.id as number);

    // Get tickets untuk semua batches (only needed columns)
    const ticketsQuery = `SELECT batch_id, no, tiket, ringkasan, rincian, pemohon, penyebab,
                                 solusi, tipe, tanggal, pic, vendor, status, sla_respon, sla_resol
                          FROM tickets WHERE batch_id IN (${batchIds.map(() => "?").join(", ")}) ORDER BY batch_id DESC, no ASC`;
    const ticketsResult = await db.execute({
      sql: ticketsQuery,
      args: batchIds,
    });

    // Deduplicate tickets berdasarkan NO TIKET (primary key)
    const uniqueTicketsMap = new Map<string, typeof ticketsResult.rows[0]>();
    for (const ticket of ticketsResult.rows) {
      const ticketNo = ticket.tiket as string;
      // Keep the first occurrence (oldest by batch created_at karena ORDER BY DESC)
      if (!uniqueTicketsMap.has(ticketNo)) {
        uniqueTicketsMap.set(ticketNo, ticket);
      }
    }
    const uniqueTickets = Array.from(uniqueTicketsMap.values());

    // Group tickets by batch untuk processing
    const ticketsByBatch = new Map<number, typeof ticketsResult.rows>();
    for (const ticket of uniqueTickets) {
      const bid = ticket.batch_id as number;
      if (!ticketsByBatch.has(bid)) {
        ticketsByBatch.set(bid, []);
      }
      ticketsByBatch.get(bid)!.push(ticket);
    }

    // Recalculate totals setelah deduplication
    const totalUniqueTickets = uniqueTickets.length;

    // Jika multiple batches, aggregate jadi satu report
    // Jika single batch, pakai data asli
    let conversionData: ConversionData;

    if (batchResult.rows.length === 1) {
      // Single batch - pakai data langsung
      const batch = batchResult.rows[0];
      const tickets = ticketsByBatch.get(batch.id as number) || [];

      conversionData = {
        periode: batch.periode as string,
        tanggal: new Date().toLocaleDateString("id-ID"),
        totalTiket: totalUniqueTickets, // Use deduplicated count
        totalPending: batch.total_pending as number,
        totalSelesai: batch.total_selesai as number,
        totalMetResp: batch.total_met_resp as number,
        totalMetResol: batch.total_met_resol as number,
        pctMetResp: batch.pct_met_resp as string,
        pctMetResol: batch.pct_met_resol as string,
        incidentCount: batch.incident_count as number,
        srCount: batch.sr_count as number,
        top5: JSON.parse((batch.top_5 as string) || "[]"),
        tickets: tickets.map((t, idx) => ({
          no: idx + 1,
          tiket: t.tiket as string,
          ringkasan: t.ringkasan as string,
          rincian: t.rincian as string,
          pemohon: t.pemohon as string,
          penyebab: t.penyebab as string,
          solusi: t.solusi as string,
          tipe: t.tipe as string,
          tanggal: t.tanggal as string,
          pic: t.pic as string,
          vendor: t.vendor as string,
          status: t.status as string,
          slaRespon: t.sla_respon as string,
          slaResol: t.sla_resol as string,
        })),
      };
    } else {
      // Multiple batches - aggregate
      let totalTiket = 0;
      let totalPending = 0;
      let totalSelesai = 0;
      let totalMetResp = 0;
      let totalMetResol = 0;
      let incidentCount = 0;
      let srCount = 0;
      const allTickets: ConversionData["tickets"] = [];
      const top5Map = new Map<string, number>();

      for (const batch of batchResult.rows) {
        totalTiket += (batch.total_tiket as number) || 0;
        totalPending += (batch.total_pending as number) || 0;
        totalSelesai += (batch.total_selesai as number) || 0;
        totalMetResp += (batch.total_met_resp as number) || 0;
        totalMetResol += (batch.total_met_resol as number) || 0;
        incidentCount += (batch.incident_count as number) || 0;
        srCount += (batch.sr_count as number) || 0;

        // Aggregate top5
        const batchTop5 = JSON.parse((batch.top_5 as string) || "[]") as Array<
          [string, number]
        >;
        for (const [category, count] of batchTop5) {
          top5Map.set(category, (top5Map.get(category) || 0) + count);
        }

        // Aggregate tickets are mapped later with sequential numbers
        const tickets = ticketsByBatch.get(batch.id as number) || [];
        allTickets.push(
          ...tickets.map((t) => ({
            no: 0, // Will be re-assigned below
            tiket: t.tiket as string,
            ringkasan: t.ringkasan as string,
            rincian: t.rincian as string,
            pemohon: t.pemohon as string,
            penyebab: t.penyebab as string,
            solusi: t.solusi as string,
            tipe: t.tipe as string,
            tanggal: t.tanggal as string,
            pic: t.pic as string,
            vendor: t.vendor as string,
            status: t.status as string,
            slaRespon: t.sla_respon as string,
            slaResol: t.sla_resol as string,
          }))
        );
      }
      
      // Sort combined tickets by date ascending (parsing DD/MM/YYYY)
      allTickets.sort((a, b) => {
        const [d1, m1, y1] = a.tanggal.split('/');
        const [d2, m2, y2] = b.tanggal.split('/');
        
        if (!y1 || !y2) return a.tanggal.localeCompare(b.tanggal);
        
        const dateA = new Date(Number(y1), Number(m1) - 1, Number(d1));
        const dateB = new Date(Number(y2), Number(m2) - 1, Number(d2));
        
        return dateA.getTime() - dateB.getTime();
      });

      // Re-number all tickets sequentially
      allTickets.forEach((t, idx) => {
        t.no = idx + 1;
      });

      // Calculate percentages
      const pctMetResp =
        totalTiket > 0 ? `${((totalMetResp / totalTiket) * 100).toFixed(2)}%` : "0.00%";
      const pctMetResol =
        totalTiket > 0 ? `${((totalMetResol / totalTiket) * 100).toFixed(2)}%` : "0.00%";

      // Sort and get top5
      const sortedTop5 = Array.from(top5Map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      // Generate periode label
      let periodeLabel = "Multiple Periods";
      if (year && month) {
        const monthNames = [
          "Januari",
          "Februari",
          "Maret",
          "April",
          "Mei",
          "Juni",
          "Juli",
          "Agustus",
          "September",
          "Oktober",
          "November",
          "Desember",
        ];
        periodeLabel = `${monthNames[parseInt(month) - 1]} ${year}`;
      } else if (year) {
        periodeLabel = `Tahun ${year}`;
      }

      conversionData = {
        periode: periodeLabel,
        tanggal: new Date().toLocaleDateString("id-ID"),
        totalTiket,
        totalPending,
        totalSelesai,
        totalMetResp,
        totalMetResol,
        pctMetResp,
        pctMetResol,
        incidentCount,
        srCount,
        top5: sortedTop5,
        tickets: allTickets,
      };
    }

    // Generate DOCX
    const docxBuffer = await generateDocxFromData(conversionData);

    // Create filename berdasarkan filter
    let filename = "Report";
    if (batchId) {
      filename = `Batch_${batchId}`;
    } else if (periode) {
      filename = periode.replace(/\s+/g, "_");
    } else if (year && month) {
      const monthNames = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
      ];
      filename = `${monthNames[parseInt(month) - 1]}_${year}`;
    } else if (year) {
      filename = `Tahun_${year}`;
    }

    // Return DOCX file
    // Convert Buffer to Uint8Array untuk NextResponse
    const uint8Array = new Uint8Array(docxBuffer);
    
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
        "X-Tickets": conversionData.totalTiket.toString(),
        "X-Periode": conversionData.periode,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      {
        error: "Export failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// GET /api/export - Get preview, years, periods, or batches
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const db = getTursoClient();

    // Preview endpoint - /api/export?type=preview&year=2025&month=1
    // atau /api/export?type=preview&startDate=2025-01-01&endDate=2025-01-31
    if (type === "preview") {
      // Build query untuk batches
      let batchQuery = `SELECT id, periode, created_at
                        FROM conversion_batches WHERE 1=1`;
      const args: (string | number)[] = [];

      // Filter by date range (priority)
      if (startDate && endDate) {
        batchQuery += " AND DATE(created_at) BETWEEN ? AND ?";
        args.push(startDate, endDate);
      }
      // Filter by year and month
      else if (year && month) {
        const monthNames = [
          "Januari", "Februari", "Maret", "April", "Mei", "Juni",
          "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ];
        const monthName = monthNames[parseInt(month) - 1];
        batchQuery += " AND periode = ?";
        args.push(`${monthName} ${year}`);
      }
      // Filter by year only
      else if (year) {
        batchQuery += " AND periode LIKE ?";
        args.push(`%${year}%`);
      }
      else {
        return NextResponse.json(
          { error: "Pilih tahun, atau gunakan startDate & endDate" },
          { status: 400 }
        );
      }

      batchQuery += " ORDER BY created_at DESC";

      const batchResult = await db.execute({ sql: batchQuery, args });

      if (batchResult.rows.length === 0) {
        return NextResponse.json({
          periode: year && month ? `${month}/${year}` : year || "Unknown",
          totalTiket: 0,
          tickets: []
        });
      }

      // Get batch IDs
      const batchIds = batchResult.rows.map((row) => row.id as number);

      // Get all tickets untuk deduplication (ambil semua dulu, deduplicate, lalu limit)
      const ticketsQuery = `SELECT no, tiket, ringkasan, rincian, pemohon, solusi, tipe, tanggal, pic, sla_respon, sla_resol
                            FROM tickets WHERE batch_id IN (${batchIds.map(() => "?").join(", ")}) ORDER BY batch_id DESC, no ASC`;
      const ticketsResult = await db.execute({
        sql: ticketsQuery,
        args: batchIds,
      });

      // Deduplicate berdasarkan NO TIKET (primary key)
      const uniqueTicketsMap = new Map<string, typeof ticketsResult.rows[0]>();
      for (const ticket of ticketsResult.rows) {
        const ticketNo = ticket.tiket as string;
        if (!uniqueTicketsMap.has(ticketNo)) {
          uniqueTicketsMap.set(ticketNo, ticket);
        }
      }
      const uniqueTickets = Array.from(uniqueTicketsMap.values());
      const totalUniqueTickets = uniqueTickets.length;

      // Format periode label
      let periodeLabel = "Unknown";
      if (startDate && endDate) {
        periodeLabel = `${startDate} s/d ${endDate}`;
      } else if (year && month) {
        const monthNames = [
          "Januari", "Februari", "Maret", "April", "Mei", "Juni",
          "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ];
        periodeLabel = `${monthNames[parseInt(month) - 1]} ${year}`;
      } else if (year) {
        periodeLabel = `Tahun ${year}`;
      }

      // Ambil 5 pertama untuk preview
      const previewTickets = uniqueTickets.slice(0, 5).map((t, idx) => ({
        no: idx + 1,
        tiket: t.tiket as string,
        ringkasan: t.ringkasan as string,
        rincian: t.rincian as string,
        pemohon: t.pemohon as string,
        solusi: t.solusi as string,
        tipe: t.tipe as string,
        tanggal: t.tanggal as string,
        pic: t.pic as string,
        slaRespon: t.sla_respon as string,
        slaResol: t.sla_resol as string,
      }));

      return NextResponse.json({
        periode: periodeLabel,
        totalTiket: totalUniqueTickets, // Total setelah deduplicate
        tickets: previewTickets,
        duplicateCount: ticketsResult.rows.length - totalUniqueTickets, // Info jumlah duplikat
      });
    }

    // Get available years
    if (type === "years") {
      const result = await db.execute({
        sql: `SELECT DISTINCT 
                CAST(SUBSTR(periode, INSTR(periode, ' ') + 1) AS INTEGER) as year 
              FROM conversion_batches 
              ORDER BY year DESC`,
        args: [],
      });

      const years = result.rows
        .map((r) => r.year)
        .filter((y): y is number => y !== null);

      return NextResponse.json({ years });
    }

    // Get periods for year
    if (type === "periods") {
      const result = await db.execute({
        sql: `SELECT DISTINCT periode FROM conversion_batches WHERE periode LIKE ? ORDER BY created_at DESC`,
        args: [`%${year}%`],
      });

      const periods = result.rows.map((r) => r.periode as string);
      return NextResponse.json({ periods });
    }

    // Get batches
    if (type === "batches") {
      let sql = `SELECT id, periode, total_tiket, created_at FROM conversion_batches WHERE 1=1`;
      const args: string[] = [];

      if (year && month) {
        const monthNames = [
          "Januari", "Februari", "Maret", "April", "Mei", "Juni",
          "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ];
        sql += ` AND periode = ?`;
        args.push(`${monthNames[parseInt(month) - 1]} ${year}`);
      } else if (year) {
        sql += ` AND periode LIKE ?`;
        args.push(`%${year}%`);
      }

      sql += ` ORDER BY created_at DESC`;

      const result = await db.execute({ sql, args });

      const batches = result.rows.map((r) => ({
        id: r.id as number,
        periode: r.periode as string,
        totalTiket: r.total_tiket as number,
        createdAt: r.created_at as string,
      }));

      return NextResponse.json({ batches });
    }

    // Default response
    return NextResponse.json({
      message: "Use ?type=preview&year=2025&month=1, ?type=years, ?type=periods&year=2025, or ?type=batches",
    });
  } catch (error) {
    console.error("Export API error:", error);
    return NextResponse.json(
      { error: "Failed to process request", details: String(error) },
      { status: 500 }
    );
  }
}
