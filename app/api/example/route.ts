import { readFile, writeFile } from "fs/promises";
import path from "path";
import { JEV_MODEL, type ExampleRun } from "@/lib/config";

export const runtime = "nodejs";

const FILE = path.join(process.cwd(), "data", "example-run.json");
const MAX_BYTES = 8 * 1024 * 1024;

/** The saved example run for the Example tab. */
export async function GET() {
  try {
    return new Response(await readFile(FILE, "utf-8"), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "No example run saved yet." }, { status: 404 });
  }
}

/**
 * Save the current run as the example. Only while running locally (`next dev`), so a deployed
 * demo cannot be overwritten. Traces never contain the key (it is masked in /api/classify).
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Saving the example is only available when running the app locally." }, { status: 403 });
  }
  const text = await req.text();
  if (text.length > MAX_BYTES) return Response.json({ error: "Run is too large to save as the example." }, { status: 413 });
  let body: Partial<ExampleRun>;
  try { body = JSON.parse(text); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (!Array.isArray(body.rows) || !body.rows.length || !Array.isArray(body.samples)) {
    return Response.json({ error: "Expected non-empty rows and a samples list." }, { status: 400 });
  }
  const run: ExampleRun = {
    source: "recorded",
    recordedAt: new Date().toISOString(),
    model: body.model || JEV_MODEL,
    note: body.note,
    scoreQuestion: body.scoreQuestion ?? null,
    samples: body.samples,
    rows: body.rows,
  };
  await writeFile(FILE, JSON.stringify(run));
  return Response.json({ ok: true, rows: run.rows.length, samples: run.samples.length });
}
