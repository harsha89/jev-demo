import {
  CATEGORY_QUESTION, DEFAULT_SCORE_QUESTION, JEV_MODEL, JEV_URL, MAX_BODY_CHARS, SCORE_LEVELS, SPAM_QUESTION,
  scoreName, type JevTrace, type ScoreAnswer, type ScoreQuestion,
} from "@/lib/config";

export const runtime = "nodejs";

const mask = (key: string) => `Bearer ••••${key.slice(-4)}`;

/** Accept the score question from the browser, falling back to the default; `null` turns it off. */
function readScoreQuestion(raw: unknown): ScoreQuestion | null {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return DEFAULT_SCORE_QUESTION;
  const q = raw as Partial<ScoreQuestion>;
  const criteria = (Array.isArray(q.criteria) ? q.criteria : []).map((c) => String(c).trim()).filter(Boolean);
  if (criteria.length < SCORE_LEVELS.min || criteria.length > SCORE_LEVELS.max) return DEFAULT_SCORE_QUESTION;
  return {
    name: scoreName(String(q.name ?? DEFAULT_SCORE_QUESTION.name)),
    instructions: String(q.instructions || DEFAULT_SCORE_QUESTION.instructions),
    criteria,
  };
}

// The server's own key is only a fallback locally, or when explicitly allowed. On a public deployment
// it would otherwise let every visitor spend the owner's key.
const serverKeyAllowed = process.env.NODE_ENV === "development" || process.env.ALLOW_SERVER_KEY === "true";

// Proxies one email to JEV. The key comes from the browser (x-typesafe-key header) or,
// if allowed and left blank, from the server's TYPESAFE_API_KEY env var. It is never logged or stored.
// Every reply includes a `trace` (request sent + raw response) so the UI can show both side by side.
export async function POST(req: Request) {
  const key = req.headers.get("x-typesafe-key") || (serverKeyAllowed ? process.env.TYPESAFE_API_KEY : undefined);
  if (!key) return Response.json({ error: "No TypeSafe API key provided." }, { status: 401 });

  const { subject = "", body = "", scoreQuestion } = await req.json();
  const sq = readScoreQuestion(scoreQuestion);
  if (sq && ["is_spam", "category"].includes(sq.name)) sq.name = `${sq.name}_score`;

  const url = process.env.JEV_URL || JEV_URL;
  const payload = {
    model: JEV_MODEL,
    state: { subject, body: String(body).slice(0, MAX_BODY_CHARS) },
    questions: {
      is_spam: SPAM_QUESTION,
      category: CATEGORY_QUESTION,
      ...(sq ? { [sq.name]: { type: "score", instructions: sq.instructions, criteria: sq.criteria } } : {}),
    },
  };
  const request: JevTrace["request"] = {
    method: "POST", url,
    headers: { "Content-Type": "application/json", Authorization: mask(key) },
    body: payload,
  };

  const t0 = Date.now();
  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const trace = { request, response: { status: 0, latency_ms: Date.now() - t0, body: String((e as Error).message) } };
    return Response.json({ error: `Could not reach JEV: ${(e as Error).message}`, trace }, { status: 502 });
  }
  const text = await r.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch {}
  const trace: JevTrace = { request, response: { status: r.status, latency_ms: Date.now() - t0, body: parsed } };

  if (!r.ok) return Response.json({ error: `JEV HTTP ${r.status}: ${text.slice(0, 300)}`, trace }, { status: r.status });

  try {
    const answers = (parsed as { answers: Record<string, Record<string, unknown>> }).answers;
    const cat = answers.category;
    let score: ScoreAnswer | undefined;
    if (sq && answers[sq.name]) {
      const a = answers[sq.name];
      score = {
        name: sq.name,
        score: Number(a.score),
        confidence: Number(a.confidence ?? 0),
        levels: sq.criteria.length,
        probabilities: (a.probabilities as Record<string, number>) ?? {},
        legend: (a.legend as Record<string, string>) ?? Object.fromEntries(sq.criteria.map((c, i) => [String(i), c])),
      };
    }
    return Response.json({
      p_spam: Number(answers.is_spam.noul),
      category: String(cat.choice),
      category_conf: Number(cat.confidence ?? 0),
      category_probs: (cat.probabilities as Record<string, number>) ?? undefined,
      score,
      trace,
    });
  } catch {
    return Response.json({ error: `Unexpected JEV response: ${text.slice(0, 300)}`, trace }, { status: 502 });
  }
}
