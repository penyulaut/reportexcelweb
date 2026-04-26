import { NextRequest } from "next/server";
import { getTursoClient } from "@/lib/turso";

export const runtime = "nodejs";

/**
 * GET /api/tickets/duplicates
 * Analyze duplicate tickets across batches and within same batch
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId");
    const tiketNumber = searchParams.get("tiket");

    const db = getTursoClient();

    // Find duplicate tickets across all batches
    const duplicatesQuery = `
      SELECT 
        t.tiket,
        COUNT(*) as occurrence_count,
        GROUP_CONCAT(DISTINCT b.periode) as periods,
        GROUP_CONCAT(DISTINCT t.batch_id) as batch_ids,
        MIN(t.created_at) as first_seen,
        MAX(t.created_at) as last_seen
      FROM tickets t
      JOIN conversion_batches b ON t.batch_id = b.id
      ${tiketNumber ? "WHERE t.tiket = ?" : ""}
      ${batchId && !tiketNumber ? "WHERE t.batch_id = ?" : ""}
      GROUP BY t.tiket
      HAVING COUNT(*) > 1
      ORDER BY occurrence_count DESC, t.tiket
    `;

    const args: (string | number)[] = [];
    if (tiketNumber) args.push(tiketNumber);
    if (batchId && !tiketNumber) args.push(batchId);

    const [duplicates, stats] = await Promise.all([
      db.execute({ sql: duplicatesQuery, args }),
      db.execute(`
        SELECT 
          COUNT(DISTINCT t.tiket) as unique_tickets,
          COUNT(*) as total_records,
          (COUNT(*) - COUNT(DISTINCT t.tiket)) as duplicate_count
        FROM tickets t
      `),
    ]);

    // Build duplicate details in a single bulk query instead of N+1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let duplicateDetails: Array<{
      tiket: unknown;
      occurrence_count: unknown;
      periods: string[];
      batch_ids: string[];
      first_seen: unknown;
      last_seen: unknown;
      instances: Record<string, unknown>[];
    }> = [];

    if (duplicates.rows.length > 0) {
      const dupTicketIds = duplicates.rows.map(d => d.tiket as string);
      const placeholders = dupTicketIds.map(() => '?').join(', ');

      const allDetails = await db.execute({
        sql: `
          SELECT 
            t.tiket, t.no, t.ringkasan, t.pic, t.tanggal, t.sla_respon, t.sla_resol,
            t.batch_id, b.periode, b.created_at as batch_created
          FROM tickets t
          JOIN conversion_batches b ON t.batch_id = b.id
          WHERE t.tiket IN (${placeholders})
          ORDER BY t.tiket, b.created_at
        `,
        args: dupTicketIds,
      });

      // Group details by tiket in JS
      const detailsByTicket = new Map<string, Record<string, unknown>[]>();
      for (const row of allDetails.rows) {
        const key = row.tiket as string;
        if (!detailsByTicket.has(key)) detailsByTicket.set(key, []);
        detailsByTicket.get(key)!.push(row);
      }

      duplicateDetails = duplicates.rows.map(dup => ({
        tiket: dup.tiket,
        occurrence_count: dup.occurrence_count,
        periods: (dup.periods as string).split(","),
        batch_ids: (dup.batch_ids as string).split(","),
        first_seen: dup.first_seen,
        last_seen: dup.last_seen,
        instances: detailsByTicket.get(dup.tiket as string) || [],
      }));
    }

    return Response.json({
      summary: stats.rows[0],
      duplicates: duplicateDetails,
      totalDuplicates: duplicates.rows.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/tickets/duplicates] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
