import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { readXlsx, fillDocx } from "@/lib/converter";

export const runtime = "nodejs";

// Template is committed in public/templates/ so it's always available in Vercel
const TEMPLATE_PATH = path.join(process.cwd(), "public", "templates", "LogDTE.docx");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const xlsxFile = formData.get("xlsx") as File | null;

    if (!xlsxFile) {
      return Response.json({ error: "No xlsx file provided" }, { status: 400 });
    }

    // Convert uploaded File → Node.js Buffer
    const xlsxBuffer = Buffer.from(await xlsxFile.arrayBuffer());

    // Read template docx
    if (!fs.existsSync(TEMPLATE_PATH)) {
      return Response.json(
        { error: `Template tidak ditemukan: ${TEMPLATE_PATH}` },
        { status: 500 }
      );
    }
    const templateBuffer = fs.readFileSync(TEMPLATE_PATH);

    // Parse xlsx → structured data
    const data = await readXlsx(xlsxBuffer);

    // Fill docx template → output buffer
    const outputBuffer = fillDocx(templateBuffer, data);

    const filename = `LogDTE_${data.periode.replace(/\s+/g, "")}.docx`;

    return new Response(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Tickets": String(data.tickets.length),
        "X-Periode": data.periode,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/generate] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
