import { NextRequest } from "next/server";
import { initDatabase, getAccountById, updateAccount, deleteAccount } from "@/lib/turso";

export const runtime = "nodejs";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await initDatabase();
    const body = await request.json();
    const updated = await updateAccount(params.id, { name: body.name, password: body.password });
    return Response.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/accounts/:id] PUT Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteAccount(params.id);
    return Response.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/accounts/:id] DELETE Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
