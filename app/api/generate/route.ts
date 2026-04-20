import { NextRequest } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

export const runtime = "nodejs";

// Path to template docx (committed in repo under dump/)
const TEMPLATE_PATH = path.join(process.cwd(), "dump", "LogDTE202508.docx");
const SCRIPT_PATH = path.join(process.cwd(), "scripts", "convert.py");

export async function POST(request: NextRequest) {
  let xlsxTmpPath = "";
  let outputTmpPath = "";

  try {
    const formData = await request.formData();
    const xlsxFile = formData.get("xlsx") as File | null;

    if (!xlsxFile) {
      return Response.json({ error: "No xlsx file provided" }, { status: 400 });
    }

    // Write uploaded xlsx to a temp file
    const tmpDir = os.tmpdir();
    xlsxTmpPath = path.join(tmpDir, `sla_input_${Date.now()}.xlsx`);
    outputTmpPath = path.join(tmpDir, `sla_output_${Date.now()}.docx`);

    const xlsxBuffer = Buffer.from(await xlsxFile.arrayBuffer());
    fs.writeFileSync(xlsxTmpPath, xlsxBuffer);

    // Run the Python conversion script
    const cmd = `python "${SCRIPT_PATH}" --xlsx "${xlsxTmpPath}" --template "${TEMPLATE_PATH}" --output "${outputTmpPath}"`;
    const { stdout, stderr } = await execAsync(cmd);

    if (stderr && !stdout) {
      return Response.json({ error: stderr }, { status: 500 });
    }

    // Parse Python script output
    let scriptResult: { success: boolean; tickets: number; periode: string } | null = null;
    try {
      scriptResult = JSON.parse(stdout.trim());
    } catch {
      return Response.json({ error: `Script error: ${stderr || stdout}` }, { status: 500 });
    }

    if (!scriptResult?.success) {
      return Response.json({ error: "Conversion failed" }, { status: 500 });
    }

    // Read output docx and return as download
    const docxBuffer = fs.readFileSync(outputTmpPath);
    const periode = scriptResult.periode ?? "Output";
    const filename = `LogDTE_${periode.replace(/\s+/g, "")}.docx`;

    return new Response(docxBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Tickets": String(scriptResult.tickets),
        "X-Periode": scriptResult.periode,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  } finally {
    // Cleanup temp files
    if (xlsxTmpPath && fs.existsSync(xlsxTmpPath)) {
      fs.unlinkSync(xlsxTmpPath);
    }
    if (outputTmpPath && fs.existsSync(outputTmpPath)) {
      fs.unlinkSync(outputTmpPath);
    }
  }
}
