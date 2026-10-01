"use client";

import { useEffect, useRef } from "react";
import type { Label, Row } from "@/lib/config";
import { rocPoints, type Metrics, type ScoreSummary } from "@/lib/metrics";

export const LABELS: Label[] = ["ham", "spam"];
export const SERIES_VAR: Record<Label, string> = { ham: "var(--ham)", spam: "var(--spam)" };
export const SERIES_NAME: Record<Label, string> = { ham: "Ham (legitimate)", spam: "Spam" };

const pretty = (c: string) => c.replace(/_/g, " ");

function niceMax(v: number): [number, number] {
  for (const step of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500]) {
    if (v <= step * 5) return [step * Math.max(1, Math.ceil(v / step)), step];
  }
  return [v, Math.max(1, Math.floor(v / 5))];
}

/** Bar with a 4px rounded data-end and a square baseline end. */
function barPath(x: number, y: number, w: number, h: number, horizontal = false, r = 4) {
  if (h <= 0 || w <= 0) return "";
  if (horizontal) {
    r = Math.min(r, w, h / 2);
    return `M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`;
  }
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/** One tooltip for the whole page: any element with data-tip shows it on hover. */
export function Tooltip() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const el = ref.current!;
      const t = (e.target as Element)?.closest?.("[data-tip]");
      if (!t) { el.style.opacity = "0"; return; }
      el.textContent = t.getAttribute("data-tip");
      el.style.opacity = "1";
      el.style.left = Math.min(e.clientX + 14, window.innerWidth - el.offsetWidth - 8) + "px";
      el.style.top = e.clientY + 14 + "px";
    };
    document.addEventListener("mousemove", move);
    return () => document.removeEventListener("mousemove", move);
  }, []);
  return <div ref={ref} id="tip" role="tooltip" />;
}

export function Legend() {
  return (
    <div className="legend">
      {LABELS.map((l) => (
        <span key={l}><span className="sw" style={{ background: SERIES_VAR[l] }} />{SERIES_NAME[l]}</span>
      ))}
    </div>
  );
}

export function Confusion({ m }: { m: Metrics }) {
  const cells: [Label, Label, number, string][] = [
    ["spam", "spam", m.tp, "true positive"], ["spam", "ham", m.fn, "missed spam"],
    ["ham", "spam", m.fp, "false alarm"], ["ham", "ham", m.tn, "true negative"],
  ];
  const rowsum = { spam: m.tp + m.fn, ham: m.fp + m.tn };
  return (
    <div className="cm">
      <div /><div className="h">JEV says spam</div><div className="h">JEV says ham</div>
      {cells.map(([actual, pred, v, name], i) => {
        const share = rowsum[actual] ? v / rowsum[actual] : 0;
        // soft single-hue tint (5% → 30%) so dark text always reads; shade = share of the row
        const bg = `color-mix(in srgb, var(--ham) ${Math.round(5 + share * 25)}%, var(--surface))`;
        return [
          i % 2 === 0 ? <div key={`h${i}`} className="rh">Actually {actual}</div> : null,
          <div key={i} className="cell" style={{ background: bg, color: "var(--text-primary)" }}
            data-tip={`${name}: ${v} of ${rowsum[actual]} actual ${actual}`}>
            <b>{v}</b><small>{Math.round(share * 100)}% · {actual === pred ? "✓" : "✗"} {name}</small>
          </div>,
        ];
      })}
    </div>
  );
}

export function Histogram({ rows, threshold, bins = 10 }: { rows: Row[]; threshold: number; bins?: number }) {
  const counts: Record<Label, number[]> = { ham: Array(bins).fill(0), spam: Array(bins).fill(0) };
  for (const r of rows) counts[r.label][Math.min(Math.floor(r.p_spam * bins), bins - 1)]++;
  const [ymax, ystep] = niceMax(Math.max(1, ...counts.ham, ...counts.spam));
  const W = 1000, H = 300, L = 36, R = 8, T = 10, B = 40;
  const pw = W - L - R, ph = H - T - B, band = pw / bins;
  const bw = Math.min(24, (band - 10) / 2);
  const tx = L + threshold * pw;
  const yt: number[] = [];
  for (let v = 0; v <= ymax; v += ystep) yt.push(v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Histogram of spam probability by true label">
      {yt.map((v) => {
        const y = T + ph - (v / ymax) * ph;
        return <g key={v}><line className="grid" x1={L} x2={W - R} y1={y} y2={y} /><text x={L - 6} y={y + 4} textAnchor="end">{v}</text></g>;
      })}
      {Array.from({ length: bins }, (_, i) => {
        const cx = L + band * i + band / 2;
        return (
          <g key={i}>
            {LABELS.map((l, j) => {
              const c = counts[l][i], x = cx - bw - 1 + j * (bw + 2), h = (c / ymax) * ph;
              return (
                <g key={l} data-tip={`${SERIES_NAME[l]} · p_spam ${(i / bins).toFixed(1)}–${((i + 1) / bins).toFixed(1)}: ${c} emails`}>
                  <rect className="hit" x={x - 1} y={T} width={bw + 2} height={ph} />
                  <path d={barPath(x, T + ph - h, bw, h)} fill={SERIES_VAR[l]} />
                </g>
              );
            })}
            <text x={L + band * i} y={H - B + 16} textAnchor="middle">{(i / bins).toFixed(1)}</text>
          </g>
        );
      })}
      <text x={W - R} y={H - B + 16} textAnchor="end">1.0</text>
      <line x1={tx} x2={tx} y1={T} y2={T + ph} stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="4 4" />
      <text x={tx + 4} y={T + 10} className="val">threshold {threshold.toFixed(2)}</text>
      <line x1={L} x2={W - R} y1={T + ph} y2={T + ph} stroke="var(--border)" />
      <text className="axis-title" x={L + pw / 2} y={H - 6} textAnchor="middle">JEV spam probability (p_spam)</text>
    </svg>
  );
}

export function Roc({ rows, auc, threshold }: { rows: Row[]; auc: number; threshold: number }) {
  const pts = rocPoints(rows);
  const W = 420, H = 320, L = 52, R = 12, T = 10, B = 40;
  const pw = W - L - R, ph = H - T - B;
  const X = (f: number) => L + f * pw, Y = (t: number) => T + ph - t * ph;
  const line = pts.map(([f, t]) => `${X(f).toFixed(1)},${Y(t).toFixed(1)}`).join(" ");
  // operating point at the current threshold
  const pos = rows.filter((r) => r.label === "spam").length, neg = rows.length - pos;
  const op = [neg ? rows.filter((r) => r.label === "ham" && r.p_spam >= threshold).length / neg : 0,
    pos ? rows.filter((r) => r.label === "spam" && r.p_spam >= threshold).length / pos : 0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`ROC curve, AUC ${auc.toFixed(3)}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line className="grid" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} />
          <text x={L - 6} y={Y(v) + 4} textAnchor="end">{v}</text>
          <text x={X(v)} y={T + ph + 16} textAnchor="middle">{v}</text>
        </g>
      ))}
      <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke="var(--text-muted)" strokeDasharray="3 4" />
      <polygon points={`${X(0)},${Y(0)} ${line} ${X(1)},${Y(0)}`} fill="var(--ham-wash)" />
      <polyline points={line} fill="none" stroke="var(--ham)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([f, t, thr], i) => thr === null ? null : (
        <circle key={i} cx={X(f)} cy={Y(t)} r={7} className="hit"
          data-tip={`threshold ≥ ${thr.toFixed(2)} · catches ${(t * 100).toFixed(0)}% of spam · flags ${(f * 100).toFixed(0)}% of ham`} />
      ))}
      <circle cx={X(op[0])} cy={Y(op[1])} r={5} fill="var(--spam)" stroke="var(--surface)" strokeWidth={2}
        data-tip={`Current threshold ${threshold.toFixed(2)}`} />
      <text x={X(0.97)} y={Y(0.06)} textAnchor="end" className="val" style={{ fontSize: 14, fontWeight: 600 }}>
        AUC {Number.isNaN(auc) ? "–" : auc.toFixed(3)}
      </text>
      <text className="axis-title" x={L + pw / 2} y={H - 6} textAnchor="middle">False-positive rate (ham flagged as spam)</text>
      <text className="axis-title" transform="rotate(-90)" x={-(T + ph / 2)} y={11} textAnchor="middle">True-positive rate (spam caught)</text>
    </svg>
  );
}

export function CategoryBars({ rows }: { rows: Row[] }) {
  const by: Record<Label, Record<string, number>> = { ham: {}, spam: {} };
  for (const r of rows) by[r.label][r.category] = (by[r.label][r.category] || 0) + 1;
  const total = (c: string) => (by.ham[c] || 0) + (by.spam[c] || 0);
  const cats = Array.from(new Set(rows.map((r) => r.category))).sort((a, b) => total(b) - total(a));
  const [xmax, xstep] = niceMax(Math.max(1, ...Object.values(by.ham), ...Object.values(by.spam)));
  const bh = 12, rowH = bh * 2 + 2 + 14;
  const W = 460, L = 135, R = 30, T = 22, H = T + rowH * cats.length + 8, pw = W - L - R;
  const xt: number[] = [];
  for (let v = 0; v <= xmax; v += xstep) xt.push(v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Categories assigned by JEV, split by true label">
      {xt.map((v) => {
        const x = L + (v / xmax) * pw;
        return <g key={v}><line className="grid" x1={x} x2={x} y1={T - 4} y2={H - 8} /><text x={x} y={T - 8} textAnchor="middle">{v}</text></g>;
      })}
      {cats.map((c, i) => {
        const y0 = T + i * rowH;
        return (
          <g key={c}>
            <text x={L - 8} y={y0 + bh + 5} textAnchor="end" className="cat">{pretty(c)}</text>
            {LABELS.map((l, j) => {
              const v = by[l][c] || 0, y = y0 + j * (bh + 2), w = (v / xmax) * pw;
              return (
                <g key={l} data-tip={`${c} · ${SERIES_NAME[l]}: ${v} (${Math.round((v / total(c)) * 100)}% of this category)`}>
                  <rect className="hit" x={L} y={y - 1} width={pw} height={bh + 2} />
                  <path d={barPath(L, y, w, bh, true)} fill={SERIES_VAR[l]} />
                  {v > 0 && <text className="val" x={L + w + 5} y={y + bh - 2}>{v}</text>}
                </g>
              );
            })}
          </g>
        );
      })}
      <line x1={L} x2={L} y1={T - 4} y2={H - 8} stroke="var(--border)" />
    </svg>
  );
}

export function Confidence({ rows }: { rows: Row[] }) {
  const conf: Record<string, number[]> = {};
  for (const r of rows) (conf[r.category] ||= []).push(r.category_conf);
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const cats = Object.keys(conf).sort((a, b) => mean(conf[b]) - mean(conf[a]));
  const W = 420, L = 150, R = 40, T = 22, rh = 24, H = T + rh * cats.length + 6, pw = W - L - R;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mean JEV category confidence per category">
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}><line className="grid" x1={L + v * pw} x2={L + v * pw} y1={T - 4} y2={H - 4} />
          <text x={L + v * pw} y={T - 8} textAnchor="middle">{v}</text></g>
      ))}
      {cats.map((c, i) => {
        const vals = conf[c], m = mean(vals), y = T + i * rh + rh / 2;
        const lo = Math.min(...vals), hi = Math.max(...vals);
        return (
          <g key={c} data-tip={`${c} · mean ${m.toFixed(2)} · range ${lo.toFixed(2)}–${hi.toFixed(2)} · n=${vals.length}`}>
            <rect className="hit" x={L} y={y - rh / 2} width={pw} height={rh} />
            <text x={L - 8} y={y + 4} textAnchor="end" className="cat">{pretty(c)}</text>
            <line x1={L + lo * pw} x2={L + hi * pw} y1={y} y2={y} stroke="var(--seq-2)" strokeWidth={2} strokeLinecap="round" />
            <circle cx={L + m * pw} cy={y} r={5} fill="var(--ham)" stroke="var(--surface)" strokeWidth={2} />
            <text className="val" x={W - R + 6} y={y + 4}>{m.toFixed(2)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Short label for a rubric level: text before the first ":" (or the first few words). */
export const levelLabel = (text: string | undefined, max = 26) => {
  const t = (text ?? "").split(":")[0].trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
};

/** Emails per Score level (score rounded to the nearest level), split by true label. */
export function ScoreLevels({ summary }: { summary: ScoreSummary }) {
  const { levels, legend, byLevel } = summary;
  const [xmax, xstep] = niceMax(Math.max(1, ...byLevel.ham, ...byLevel.spam));
  const bh = 12, rowH = bh * 2 + 2 + 14;
  const W = 460, L = 150, R = 30, T = 22, H = T + rowH * levels + 8, pw = W - L - R;
  const xt: number[] = [];
  for (let v = 0; v <= xmax; v += xstep) xt.push(v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Emails per ${summary.name} level, split by true label`}>
      {xt.map((v) => {
        const x = L + (v / xmax) * pw;
        return <g key={v}><line className="grid" x1={x} x2={x} y1={T - 4} y2={H - 8} /><text x={x} y={T - 8} textAnchor="middle">{v}</text></g>;
      })}
      {Array.from({ length: levels }, (_, lvl) => {
        const y0 = T + lvl * rowH;
        const total = byLevel.ham[lvl] + byLevel.spam[lvl];
        return (
          <g key={lvl}>
            <text x={L - 8} y={y0 + bh + 5} textAnchor="end" className="cat">{lvl} · {levelLabel(legend[String(lvl)], 18)}</text>
            {LABELS.map((l, j) => {
              const v = byLevel[l][lvl], y = y0 + j * (bh + 2), w = (v / xmax) * pw;
              return (
                <g key={l} data-tip={`Level ${lvl}: ${legend[String(lvl)] ?? ""} · ${SERIES_NAME[l]}: ${v}${total ? ` (${Math.round((v / total) * 100)}% of this level)` : ""}`}>
                  <rect className="hit" x={L} y={y - 1} width={pw} height={bh + 2} />
                  <path d={barPath(L, y, w, bh, true)} fill={SERIES_VAR[l]} />
                  {v > 0 && <text className="val" x={L + w + 5} y={y + bh - 2}>{v}</text>}
                </g>
              );
            })}
          </g>
        );
      })}
      <line x1={L} x2={L} y1={T - 4} y2={H - 8} stroke="var(--border)" />
    </svg>
  );
}

/** Mean Score per category (dot) with min–max range (line), on the rubric's 0..levels-1 scale. */
export function ScoreByCategory({ rows, levels, legend }: { rows: Row[]; levels: number; legend: Record<string, string> }) {
  const vals: Record<string, number[]> = {};
  for (const r of rows) if (r.score && Number.isFinite(r.score.score)) (vals[r.category] ||= []).push(r.score.score);
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const cats = Object.keys(vals).sort((a, b) => mean(vals[b]) - mean(vals[a]));
  const top = Math.max(1, levels - 1);
  const W = 420, L = 150, R = 40, T = 22, rh = 24, H = T + rh * cats.length + 6, pw = W - L - R;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mean score per category">
      {Array.from({ length: levels }, (_, v) => (
        <g key={v}>
          <line className="grid" x1={L + (v / top) * pw} x2={L + (v / top) * pw} y1={T - 4} y2={H - 4} />
          <text x={L + (v / top) * pw} y={T - 8} textAnchor="middle" data-tip={`${v}: ${legend[String(v)] ?? ""}`}>{v}</text>
        </g>
      ))}
      {cats.map((c, i) => {
        const v = vals[c], m = mean(v), y = T + i * rh + rh / 2;
        const lo = Math.min(...v), hi = Math.max(...v);
        return (
          <g key={c} data-tip={`${c} · mean ${m.toFixed(2)} (≈ ${levelLabel(legend[String(Math.round(m))], 40)}) · range ${lo.toFixed(2)}–${hi.toFixed(2)} · n=${v.length}`}>
            <rect className="hit" x={L} y={y - rh / 2} width={pw} height={rh} />
            <text x={L - 8} y={y + 4} textAnchor="end" className="cat">{pretty(c)}</text>
            <line x1={L + (lo / top) * pw} x2={L + (hi / top) * pw} y1={y} y2={y} stroke="var(--seq-2)" strokeWidth={2} strokeLinecap="round" />
            <circle cx={L + (m / top) * pw} cy={y} r={5} fill="var(--ham)" stroke="var(--surface)" strokeWidth={2} />
            <text className="val" x={W - R + 6} y={y + 4}>{m.toFixed(2)}</text>
          </g>
        );
      })}
    </svg>
  );
}
