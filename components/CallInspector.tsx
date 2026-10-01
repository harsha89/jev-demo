"use client";

import { useState } from "react";
import { Box, Grid, IconButton, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import type { JevTrace } from "@/lib/config";

// ---------------------------------------------------------------------------
// The three JEV question types, each with one colour used everywhere
// ---------------------------------------------------------------------------
type QType = "noul" | "choice" | "score";
export const QTYPES: Record<QType, { label: string; color: string; code: string; asks: string; returns: string }> = {
  noul: { label: "Noul", color: "var(--q-noul)", code: "var(--qc-noul)", asks: "a yes/no question", returns: "the probability that the answer is yes (0–1)" },
  choice: { label: "Choice", color: "var(--q-choice)", code: "var(--qc-choice)", asks: "pick one of named options", returns: "the chosen option, its confidence and a probability per option" },
  score: { label: "Score", color: "var(--q-score)", code: "var(--qc-score)", asks: "place it on an ordered rubric", returns: "a fractional score and a probability per level" },
};
export const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;
const isQType = (t: unknown): t is QType => t === "noul" || t === "choice" || t === "score";

/** Soft colour-coded pill for a question type. */
export function QTypeChip({ type }: { type: QType }) {
  const t = QTYPES[type];
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", gap: 0.75, px: 1, height: 22, borderRadius: "6px", flex: "none",
      bgcolor: tint(t.color, 12), color: "text.primary", fontSize: 12, fontWeight: 600, lineHeight: 1,
    }}>
      <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: t.color }} />{t.label}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// JSON rendering: pretty-print line by line so lines can be tinted by question
// ---------------------------------------------------------------------------
const TOKEN = /("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;

function Highlight({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0, i = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const cls = m[1] ? "j-key" : m[2] ? "j-str" : m[3] ? "j-num" : "j-lit";
    out.push(<span key={i++} className={cls}>{m[0]}</span>);
    last = m.index! + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

type Line = { text: string; type?: QType };
type TypeOf = (path: string[]) => QType | undefined;

/** Same layout as JSON.stringify(v, null, 2), but one entry per line tagged with the question type it belongs to. */
function toLines(v: unknown, typeOf: TypeOf, path: string[] = [], ind = 0, prefix = "", trailing = "", out: Line[] = []): Line[] {
  const pad = "  ".repeat(ind), type = typeOf(path);
  if (v && typeof v === "object") {
    const arr = Array.isArray(v);
    const entries: [string, unknown][] = arr ? (v as unknown[]).map((x, i) => [String(i), x]) : Object.entries(v as object);
    const [o, c] = arr ? ["[", "]"] : ["{", "}"];
    if (!entries.length) { out.push({ text: `${pad}${prefix}${o}${c}${trailing}`, type }); return out; }
    out.push({ text: `${pad}${prefix}${o}`, type });
    entries.forEach(([k, x], i) =>
      toLines(x, typeOf, [...path, k], ind + 1, arr ? "" : `${JSON.stringify(k)}: `, i < entries.length - 1 ? "," : "", out));
    out.push({ text: `${pad}${c}${trailing}`, type });
  } else out.push({ text: `${pad}${prefix}${JSON.stringify(v)}${trailing}`, type });
  return out;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Tooltip title={done ? "Copied" : "Copy JSON"}>
      <IconButton size="small" aria-label="Copy JSON" sx={{ color: "var(--code-muted)", "&:hover": { color: "var(--code-text)", bgcolor: "rgba(255,255,255,.06)" } }}
        onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }).catch(() => {}); }}>
        {done ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
      </IconButton>
    </Tooltip>
  );
}

const pretty = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));

/** Dark code panel: a slim header (label + copy) over syntax-coloured JSON. */
function CodePanel({ label, accent, value, typeOf = () => undefined, maxHeight = 420 }: {
  label: string; accent?: string; value: unknown; typeOf?: TypeOf; maxHeight?: number;
}) {
  const lines: Line[] = typeof value === "string" ? [{ text: value }] : toLines(value, typeOf);
  return (
    <Box sx={{ height: "100%", borderRadius: "12px", overflow: "hidden", bgcolor: "var(--code-bg)", display: "flex", flexDirection: "column",
      boxShadow: "0 0 0 1px rgba(255,255,255,.04) inset" }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, pl: 1.75, pr: 0.75, py: 0.5, bgcolor: "var(--code-head)", borderBottom: "1px solid var(--code-line)" }}>
        {accent && <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: accent }} />}
        <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: "var(--code-muted)", letterSpacing: "0.02em" }}>{label}</Typography>
        <Box sx={{ flexGrow: 1 }} /><CopyButton text={pretty(value)} />
      </Stack>
      <Box component="pre" className="json" sx={{ m: 0, py: 1.25, flexGrow: 1, overflow: "auto", maxHeight }}>
        {lines.map((l, i) => (
          <Box key={i} sx={{ px: 1.75, borderLeft: "2px solid", borderColor: l.type ? QTYPES[l.type].code : "transparent",
            bgcolor: l.type ? tint(QTYPES[l.type].code, 7) : undefined }}>
            <Highlight text={l.text} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// "By question" view
// ---------------------------------------------------------------------------
type Question = { type?: string; instructions?: string; criteria?: unknown };
type Answer = Record<string, unknown> | undefined;

/** One-line plain-English reading of an answer. */
function readAnswer(type: QType, a: Answer): string {
  if (!a) return "No answer returned";
  const n = (k: string) => Number(a[k]);
  if (type === "noul") return `${Math.round(n("noul") * 100)}% likely yes`;
  if (type === "choice") return `${String(a.choice).replace(/_/g, " ")} · ${n("confidence").toFixed(2)}`;
  const legend = (a.legend ?? {}) as Record<string, string>;
  const top = Math.max(0, Object.keys(legend).length - 1);
  const lvl = Math.round(n("score"));
  return `${n("score").toFixed(2)} of ${top} · ${legend[String(lvl)] ? legend[String(lvl)].split(":")[0] : `level ${lvl}`}`;
}

function QuestionRow({ name, type, question, answer }: { name: string; type: QType; question: Question; answer: Answer }) {
  const t = QTYPES[type];
  return (
    <Box sx={{ p: { xs: 1.5, md: 2 }, borderRadius: "14px", bgcolor: tint(t.color, 5), boxShadow: `inset 3px 0 0 ${t.color}` }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1.25, flexWrap: "wrap", mb: 1.5 }}>
        <QTypeChip type={type} />
        <Typography sx={{ fontFamily: "var(--font-mono), monospace", fontSize: 13, fontWeight: 600 }}>{name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ flex: "1 1 240px", minWidth: 0 }}>{question.instructions}</Typography>
        <Box sx={{ px: 1.25, py: 0.5, borderRadius: "8px", bgcolor: "background.paper", fontSize: 13, fontWeight: 600,
          boxShadow: "0 0 0 1px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.06)", textTransform: type === "choice" ? "capitalize" : "none" }}>
          {readAnswer(type, answer)}
        </Box>
      </Stack>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 6 }}><CodePanel label="ASKED · request" accent={t.code} value={{ [name]: question }} maxHeight={260} /></Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <CodePanel label="ANSWERED · response" accent={t.code} value={answer ? { [name]: answer } : "No answer for this question"} maxHeight={260} />
        </Grid>
      </Grid>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        {t.label}: {t.asks} → returns {t.returns}.
      </Typography>
    </Box>
  );
}

function ByQuestion({ trace }: { trace: JevTrace }) {
  const body = (trace.request.body ?? {}) as { state?: unknown; model?: string; questions?: Record<string, Question> };
  const resp = (typeof trace.response.body === "object" && trace.response.body) ? trace.response.body as Record<string, unknown> : null;
  const answers = (resp?.answers ?? {}) as Record<string, Answer>;
  const { answers: _omit, ...envelope } = resp ?? {};
  const questions = Object.entries(body.questions ?? {});
  return (
    <Stack spacing={1.5}>
      <Box sx={{ p: { xs: 1.5, md: 2 }, borderRadius: "14px", bgcolor: "action.hover" }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1.25, flexWrap: "wrap", mb: 1.5 }}>
          <Box component="span" sx={{ px: 1, height: 22, display: "inline-flex", alignItems: "center", borderRadius: "6px", bgcolor: "background.paper", fontSize: 12, fontWeight: 600 }}>State</Box>
          <Typography variant="body2" color="text.secondary">
            The email is sent <b>once</b>. JEV answers all {questions.length} questions about it in parallel.
          </Typography>
        </Stack>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6 }}><CodePanel label="REQUEST · model + state" value={{ model: body.model, state: body.state }} maxHeight={240} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <CodePanel label="RESPONSE · envelope" maxHeight={240}
              value={resp ? { ...envelope, answers: `{ … ${Object.keys(answers).length} answers below … }` } : trace.response.body} />
          </Grid>
        </Grid>
      </Box>
      {questions.map(([name, q]) => isQType(q.type)
        ? <QuestionRow key={name} name={name} type={q.type} question={q} answer={answers[name]} />
        : null)}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Inspector
// ---------------------------------------------------------------------------
/** Request sent to JEV and the response it returned: by question (default) or as raw JSON side by side. */
export default function CallInspector({ trace }: { trace: JevTrace }) {
  const [view, setView] = useState<"question" | "raw">("question");
  const { request, response } = trace;
  const ok = response.status >= 200 && response.status < 300;
  const host = (() => { try { const u = new URL(request.url); return u.host + u.pathname; } catch { return request.url; } })();
  const questions = ((request.body as { questions?: Record<string, Question> })?.questions ?? {});
  const qType = (name?: string) => (name && isQType(questions[name]?.type) ? (questions[name].type as QType) : undefined);

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        {/* request line */}
        <Stack direction="row" sx={{ alignItems: "center", gap: 1.25, px: 1.25, height: 32, borderRadius: "8px", bgcolor: "action.hover", minWidth: 0,
          fontFamily: "var(--font-mono), monospace", fontSize: 12.5 }}>
          <Box component="span" sx={{ fontWeight: 700, color: "primary.main" }}>{request.method}</Box>
          <Box component="span" sx={{ color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{host}</Box>
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontWeight: 600, color: ok ? "success.main" : "error.main" }}>
            <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: ok ? "success.main" : "error.main" }} />
            {response.status || "network error"}
          </Box>
          <Box component="span" sx={{ color: "text.secondary" }}>{response.latency_ms} ms</Box>
        </Stack>
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)} sx={{ ml: "auto" }}>
          <ToggleButton value="question" sx={{ px: 1.5 }}>By question</ToggleButton>
          <ToggleButton value="raw" sx={{ px: 1.5 }}>Raw JSON</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {view === "question" ? <ByQuestion trace={trace} /> : (
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <CodePanel label="REQUEST" value={{ headers: request.headers, body: request.body }} maxHeight={560}
              typeOf={(p) => (p[0] === "body" && p[1] === "questions" ? qType(p[2]) : undefined)} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <CodePanel label="RESPONSE" value={response.body} maxHeight={560} typeOf={(p) => (p[0] === "answers" ? qType(p[1]) : undefined)} />
          </Grid>
        </Grid>
      )}
    </Stack>
  );
}
