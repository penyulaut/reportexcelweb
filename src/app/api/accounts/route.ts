import { NextRequest } from "next/server";
import { initDatabase, getAllAccounts, createAccount, getAccountById } from "@/lib/turso";

export const runtime = "nodejs";

export async function GET() {
  try {
    await initDatabase();
    const accounts = await getAllAccounts();
    return Response.json(accounts);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/accounts] GET Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = await createAccount({ name: body.name, password: body.password });
    const account = await getAccountById(id);
    return Response.json(account, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/accounts] POST Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
