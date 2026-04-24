import { NextRequest } from "next/server";
import { getAllBatches } from "@/lib/turso";

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  try {
    const batches = await getAllBatches();
    return Response.json({ batches });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/batches] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
