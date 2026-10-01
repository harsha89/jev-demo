import type { Row } from "./config";

export type Metrics = {
  n: number; tp: number; tn: number; fp: number; fn: number;
  accuracy: number; precision: number; recall: number; f1: number; auc: number;
};

export const isSpam = (r: Row, threshold: number) => r.p_spam >= threshold;

export function metrics(rows: Row[], threshold: number): Metrics {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (const r of rows) {
    const y = r.label === "spam", yhat = isSpam(r, threshold);
    if (y && yhat) tp++; else if (!y && !yhat) tn++; else if (!y && yhat) fp++; else fn++;
  }
  const n = rows.length;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return {
    n, tp, tn, fp, fn,
    accuracy: n ? (tp + tn) / n : 0,
    precision, recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    auc: rocAuc(rows),
  };
}

/** Mann-Whitney AUC (ties count half) of p_spam, or of any numeric score taken from each row. */
export function rocAuc(rows: Row[], score: (r: Row) => number | undefined = (r) => r.p_spam): number {
  const valid = rows.filter((r) => typeof score(r) === "number" && Number.isFinite(score(r)));
  const pos = valid.filter((r) => r.label === "spam").map((r) => score(r)!);
  const neg = valid.filter((r) => r.label === "ham").map((r) => score(r)!);
  if (!pos.length || !neg.length) return NaN;
  let wins = 0;
  for (const p of pos) for (const q of neg) wins += p > q ? 1 : p === q ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

/** [fpr, tpr, threshold] for each distinct p_spam, from (0,0) to (1,1). */
export function rocPoints(rows: Row[]): [number, number, number | null][] {
  const pos = rows.filter((r) => r.label === "spam").length;
  const neg = rows.length - pos;
  const pts: [number, number, number | null][] = [[0, 0, null]];
  const ts = Array.from(new Set(rows.map((r) => r.p_spam))).sort((a, b) => b - a);
  for (const t of ts) {
    let tp = 0, fp = 0;
    for (const r of rows) if (r.p_spam >= t) r.label === "spam" ? tp++ : fp++;
    pts.push([neg ? fp / neg : 0, pos ? tp / pos : 0, t]);
  }
  const last = pts[pts.length - 1];
  if (last[0] !== 1 || last[1] !== 1) pts.push([1, 1, null]);
  return pts;
}

export function toCsv(rows: Row[], threshold: number): string {
  const name = rows.find((r) => r.score)?.score?.name;
  const cols = ["message_id", "label", "pred", "p_spam", "category", "category_conf",
    ...(name ? [name, `${name}_confidence`, `${name}_level`] : []), "subject", "body"];
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.map(q).join(","), ...rows.map((r) =>
    [r.message_id, r.label, isSpam(r, threshold) ? "spam" : "ham", r.p_spam, r.category, r.category_conf,
      ...(name ? [r.score?.score, r.score?.confidence, r.score ? r.score.legend[String(Math.round(r.score.score))] : ""] : []),
      r.subject, r.body.slice(0, 300)].map(q).join(","))].join("\n");
}

export type ScoreSummary = {
  name: string; levels: number; legend: Record<string, string>; n: number;
  mean: number; meanHam?: number; meanSpam?: number; auc: number; meanConfidence: number;
  /** Emails per level (score rounded to the nearest level), split by true label. */
  byLevel: { ham: number[]; spam: number[] };
};

/** Summary of the Score answers across a run (uses the rubric of the first scored row). */
export function summariseScore(rows: Row[]): ScoreSummary | null {
  const first = rows.find((r) => r.score)?.score;
  if (!first) return null;
  const scored = rows.filter((r) => r.score && r.score.name === first.name && r.score.levels === first.levels && Number.isFinite(r.score.score));
  if (!scored.length) return null;
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
  const byLevel = { ham: Array(first.levels).fill(0), spam: Array(first.levels).fill(0) };
  for (const r of scored) {
    const lvl = Math.min(first.levels - 1, Math.max(0, Math.round(r.score!.score)));
    byLevel[r.label][lvl]++;
  }
  return {
    name: first.name, levels: first.levels, legend: first.legend, n: scored.length,
    mean: mean(scored.map((r) => r.score!.score))!,
    meanHam: mean(scored.filter((r) => r.label === "ham").map((r) => r.score!.score)),
    meanSpam: mean(scored.filter((r) => r.label === "spam").map((r) => r.score!.score)),
    auc: rocAuc(scored, (r) => r.score!.score),
    meanConfidence: mean(scored.map((r) => r.score!.confidence))!,
    byLevel,
  };
}
