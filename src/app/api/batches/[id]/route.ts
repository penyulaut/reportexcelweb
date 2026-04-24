import { NextRequest } from "next/server";
import { getBatchById, getTicketsByPIC, getSLAStats } from "@/lib/turso";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const batchId = parseInt(id, 10);
    
    if (isNaN(batchId)) {
      return Response.json({ error: "Invalid batch ID" }, { status: 400 });
    }
    
    const [batch, picStats, slaStats] = await Promise.all([
      getBatchById(batchId),
      getTicketsByPIC(batchId),
      getSLAStats(batchId),
    ]);
    
    if (!batch.batch) {
      return Response.json({ error: "Batch not found" }, { status: 404 });
    }
    
    return Response.json({
      ...batch,
      picStats,
      slaStats,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/batches/[id]] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
