import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { initDatabase, updateAccount, deleteAccount } from "@/lib/turso";

export const runtime = "nodejs";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    await initDatabase();
    const body = await request.json();
    const { id } = await params;
    const updated = await updateAccount(id, { name: body.name, password: body.password });
    return Response.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/accounts/:id] PUT Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    await initDatabase();
    const { id } = await params;
    await deleteAccount(id);
    return Response.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/accounts/:id] DELETE Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
