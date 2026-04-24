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

    const duplicates = await db.execute({
      sql: duplicatesQuery,
      args,
    });

    // Get details for each duplicate
    const duplicateDetails = [];
    for (const dup of duplicates.rows) {
      const details = await db.execute({
        sql: `
          SELECT 
            t.*,
            b.periode,
            b.created_at as batch_created
          FROM tickets t
          JOIN conversion_batches b ON t.batch_id = b.id
          WHERE t.tiket = ?
          ORDER BY b.created_at
        `,
        args: [dup.tiket],
      });

      duplicateDetails.push({
        tiket: dup.tiket,
        occurrence_count: dup.occurrence_count,
        periods: (dup.periods as string).split(","),
        batch_ids: (dup.batch_ids as string).split(","),
        first_seen: dup.first_seen,
        last_seen: dup.last_seen,
        instances: details.rows,
      });
    }

    // Summary statistics
    const stats = await db.execute(`
      SELECT 
        COUNT(DISTINCT t.tiket) as unique_tickets,
        COUNT(*) as total_records,
        (COUNT(*) - COUNT(DISTINCT t.tiket)) as duplicate_count
      FROM tickets t
    `);

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
