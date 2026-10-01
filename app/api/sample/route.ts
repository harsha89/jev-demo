import { readFileSync } from "fs";
import path from "path";
import type { Email } from "@/lib/config";

export const runtime = "nodejs";

let cache: Email[] | null = null;

function loadDataset(): Email[] {
  if (!cache) {
    const file = path.join(process.cwd(), "data", "enron_spam_test.jsonl");
    cache = readFileSync(file, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
      .filter((r: Email) => r.subject || r.body);
  }
  return cache!;
}

// Small seeded PRNG so the same seed gives the same sample.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const n = Math.max(1, Math.min(500, Number(url.searchParams.get("n")) || 25));
  const seed = Number(url.searchParams.get("seed")) || 42;
  const rnd = mulberry32(seed);
  const data = loadDataset();
  const pick = (label: string) => shuffle(data.filter((r) => r.label === label), rnd).slice(0, n);
  const sample = shuffle([...pick("spam"), ...pick("ham")], rnd);
  return Response.json({ total: data.length, emails: sample });
}
