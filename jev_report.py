"""
Self-contained HTML report for jev_spam_demo.py results (inline SVG, no external dependencies).

Used automatically by jev_spam_demo.py, or standalone:
  python jev_spam_demo.py --report jev_spam_results_YYYYMMDD_HHMM.csv
"""

import html
import json
from collections import Counter, defaultdict

esc = html.escape

# Fixed series identity across every chart: ham = slot 1 (blue), spam = slot 2 (orange)
LABELS = ("ham", "spam")
SERIES_VAR = {"ham": "var(--ham)", "spam": "var(--spam)"}
SERIES_NAME = {"ham": "Ham (legitimate)", "spam": "Spam"}

CSS = """
:root {
  color-scheme: light;
  --surface: #fcfcfb; --surface-2: #f3f2ef; --border: #e2e1dc; --grid: #e6e5e0;
  --text-primary: #0b0b0b; --text-secondary: #52514e; --text-muted: #77766f;
  --ham: #2a78d6; --spam: #eb6834; --ham-wash: rgba(42,120,214,.10);
  --seq-0: #f0efec; --seq-1: #cde2fb; --seq-2: #86b6ef; --seq-3: #2a78d6; --seq-4: #184f95;
  --good: #0ca30c; --critical: #d03b3b;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --surface: #1a1a19; --surface-2: #232321; --border: #383835; --grid: #2e2e2c;
    --text-primary: #ffffff; --text-secondary: #c3c2b7; --text-muted: #96958d;
    --ham: #3987e5; --spam: #d95926; --ham-wash: rgba(57,135,229,.14);
    --seq-0: #2a2a28; --seq-1: #104281; --seq-2: #1c5cab; --seq-3: #3987e5; --seq-4: #86b6ef;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --surface: #1a1a19; --surface-2: #232321; --border: #383835; --grid: #2e2e2c;
  --text-primary: #ffffff; --text-secondary: #c3c2b7; --text-muted: #96958d;
  --ham: #3987e5; --spam: #d95926; --ham-wash: rgba(57,135,229,.14);
  --seq-0: #2a2a28; --seq-1: #104281; --seq-2: #1c5cab; --seq-3: #3987e5; --seq-4: #86b6ef;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--surface); color: var(--text-primary);
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 1080px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -.01em; }
h2 { font-size: 18px; margin: 0 0 2px; }
.sub { color: var(--text-secondary); margin: 0 0 12px; font-size: 14px; }
.meta { color: var(--text-muted); font-size: 13px; margin-bottom: 20px; }
.flow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 16px 0 28px;
  font-size: 13px; color: var(--text-secondary); }
.flow span.box { border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; background: var(--surface-2); color: var(--text-primary); }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 28px; }
.tile { border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; background: var(--surface); }
.tile .label { color: var(--text-secondary); font-size: 13px; }
.tile .value { font-size: 30px; font-weight: 600; margin-top: 2px; }
.tile .hint { color: var(--text-muted); font-size: 12px; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr)); gap: 16px; margin-bottom: 16px; }
.card { border: 1px solid var(--border); border-radius: 12px; padding: 18px; background: var(--surface); min-width: 0; }
.legend { display: flex; gap: 16px; font-size: 13px; color: var(--text-secondary); margin: 8px 0 4px; flex-wrap: wrap; }
.sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
svg { width: 100%; height: auto; display: block; overflow: visible; }
svg text { fill: var(--text-secondary); font-size: 11px; font-variant-numeric: tabular-nums; }
svg .axis-title { fill: var(--text-muted); font-size: 11px; }
svg .val { fill: var(--text-primary); font-size: 11px; }
svg .grid { stroke: var(--grid); stroke-width: 1; }
svg [data-tip] { cursor: default; }
svg .hit { fill: transparent; }
.cm { display: grid; grid-template-columns: auto 1fr 1fr; gap: 2px; margin-top: 12px; font-size: 13px; }
.cm .h { color: var(--text-secondary); padding: 6px 8px; text-align: center; }
.cm .rh { color: var(--text-secondary); padding: 6px 8px; display: flex; align-items: center; }
.cm .cell { border-radius: 6px; padding: 18px 8px; text-align: center; }
.cm .cell b { display: block; font-size: 26px; font-weight: 600; }
.cm .cell small { font-size: 12px; opacity: .85; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { color: var(--text-secondary); font-weight: 600; position: sticky; top: 0; background: var(--surface); }
td.num { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
td .snip { color: var(--text-muted); font-size: 12px; display: block; margin-top: 2px; }
.pill { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.ok { color: var(--good); } .bad { color: var(--critical); }
.scroll { max-height: 520px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; }
.filters { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; font-size: 13px; color: var(--text-secondary); }
select { font: inherit; color: var(--text-primary); background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; }
details { margin-top: 10px; font-size: 13px; color: var(--text-secondary); }
section { margin-top: 28px; }
#tip { position: fixed; pointer-events: none; z-index: 10; background: var(--text-primary); color: var(--surface);
  padding: 6px 9px; border-radius: 6px; font-size: 12px; line-height: 1.4; opacity: 0; transition: opacity .08s; max-width: 260px; }
"""

JS = """
const tip = document.getElementById('tip');
document.addEventListener('mousemove', e => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (!t) { tip.style.opacity = 0; return; }
  tip.innerHTML = t.getAttribute('data-tip');
  tip.style.opacity = 1;
  const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
  tip.style.left = x + 'px'; tip.style.top = (e.clientY + 14) + 'px';
});
const fl = document.getElementById('f-label'), fp = document.getElementById('f-pred'),
      fc = document.getElementById('f-cat'), fo = document.getElementById('f-outcome');
function applyFilters() {
  let shown = 0;
  document.querySelectorAll('#all-rows tr').forEach(tr => {
    const ok = (!fl.value || tr.dataset.label === fl.value) && (!fp.value || tr.dataset.pred === fp.value)
      && (!fc.value || tr.dataset.cat === fc.value) && (!fo.value || tr.dataset.outcome === fo.value);
    tr.style.display = ok ? '' : 'none'; shown += ok;
  });
  document.getElementById('f-count').textContent = shown + ' shown';
}
[fl, fp, fc, fo].forEach(s => s.addEventListener('change', applyFilters));
applyFilters();
"""


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def roc_points(rows):
    """(fpr, tpr, threshold) for each distinct p_spam threshold, from (0,0) to (1,1)."""
    pos = sum(r["label"] == "spam" for r in rows)
    neg = len(rows) - pos
    pts = [(0.0, 0.0, None)]
    for t in sorted({r["p_spam"] for r in rows}, reverse=True):
        tp = sum(r["label"] == "spam" and r["p_spam"] >= t for r in rows)
        fp = sum(r["label"] == "ham" and r["p_spam"] >= t for r in rows)
        pts.append((fp / neg if neg else 0.0, tp / pos if pos else 0.0, t))
    if pts[-1][:2] != (1.0, 1.0):
        pts.append((1.0, 1.0, None))
    return pts


def nice_max(v):
    for step in (1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000):
        if v <= step * 5:
            return step * max(1, -(-v // step)), step
    return v, max(1, v // 5)


def bar_path(x, y, w, h, r=4, horizontal=False):
    """Bar with a 4px rounded data-end and a square baseline end."""
    if h <= 0 or w <= 0:
        return ""
    if horizontal:  # grows left -> right, rounded on the right
        r = min(r, w, h / 2)
        return (f"M{x},{y} H{x + w - r} Q{x + w},{y} {x + w},{y + r} V{y + h - r} "
                f"Q{x + w},{y + h} {x + w - r},{y + h} H{x} Z")
    r = min(r, h, w / 2)  # grows bottom -> top, rounded on top
    return (f"M{x},{y + h} V{y + r} Q{x},{y} {x + r},{y} H{x + w - r} "
            f"Q{x + w},{y} {x + w},{y + r} V{y + h} Z")


def legend():
    return ('<div class="legend">' + "".join(
        f'<span><span class="sw" style="background:{SERIES_VAR[l]}"></span>{SERIES_NAME[l]}</span>'
        for l in LABELS) + "</div>")


# ----------------------------------------------------------------------------
# Charts
# ----------------------------------------------------------------------------
def histogram_svg(rows, threshold, bins=10):
    counts = {l: [0] * bins for l in LABELS}
    for r in rows:
        counts[r["label"]][min(int(r["p_spam"] * bins), bins - 1)] += 1
    ymax, ystep = nice_max(max(max(c) for c in counts.values()) or 1)
    W, H, L, R, T, B = 1000, 300, 36, 8, 10, 40
    pw, ph = W - L - R, H - T - B
    band = pw / bins
    bw = min(24, (band - 10) / 2)
    out = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Histogram of spam probability by true label">']
    for v in range(0, int(ymax) + 1, int(ystep)):
        y = T + ph - v / ymax * ph
        out.append(f'<line class="grid" x1="{L}" x2="{W - R}" y1="{y:.1f}" y2="{y:.1f}"/>'
                   f'<text x="{L - 6}" y="{y + 4:.1f}" text-anchor="end">{v}</text>')
    for i in range(bins):
        cx = L + band * i + band / 2
        for j, l in enumerate(LABELS):
            c = counts[l][i]
            x = cx - bw - 1 + j * (bw + 2)  # 2px surface gap between the pair
            h = c / ymax * ph
            lo, hi = i / bins, (i + 1) / bins
            tipt = f"<b>{SERIES_NAME[l]}</b><br>p_spam {lo:.1f}–{hi:.1f}: {c} emails"
            out.append(f'<g data-tip="{esc(tipt)}"><rect class="hit" x="{x - 1}" y="{T}" width="{bw + 2}" height="{ph}"/>'
                       f'<path d="{bar_path(x, T + ph - h, bw, h)}" fill="{SERIES_VAR[l]}"/></g>')
        if i % 2 == 0 or bins <= 10:
            out.append(f'<text x="{L + band * i:.1f}" y="{H - B + 16}" text-anchor="middle">{i / bins:.1f}</text>')
    out.append(f'<text x="{W - R}" y="{H - B + 16}" text-anchor="end">1.0</text>')
    tx = L + threshold * pw
    out.append(f'<line x1="{tx:.1f}" x2="{tx:.1f}" y1="{T}" y2="{T + ph}" stroke="var(--text-muted)" stroke-width="1.5" stroke-dasharray="4 4"/>'
               f'<text x="{tx + 4:.1f}" y="{T + 10}" class="val">threshold {threshold}</text>')
    out.append(f'<line x1="{L}" x2="{W - R}" y1="{T + ph}" y2="{T + ph}" stroke="var(--border)"/>')
    out.append(f'<text class="axis-title" x="{L + pw / 2}" y="{H - 6}" text-anchor="middle">JEV spam probability (p_spam)</text></svg>')
    return "".join(out)


def roc_svg(rows, auc):
    pts = roc_points(rows)
    W, H, L, R, T, B = 420, 320, 40, 12, 10, 40
    pw, ph = W - L - R, H - T - B
    X = lambda f: L + f * pw
    Y = lambda t: T + ph - t * ph
    out = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="ROC curve, AUC {auc:.3f}">']
    for v in (0, .25, .5, .75, 1):
        out.append(f'<line class="grid" x1="{L}" x2="{W - R}" y1="{Y(v):.1f}" y2="{Y(v):.1f}"/>'
                   f'<text x="{L - 6}" y="{Y(v) + 4:.1f}" text-anchor="end">{v:g}</text>'
                   f'<text x="{X(v):.1f}" y="{T + ph + 16}" text-anchor="middle">{v:g}</text>')
    out.append(f'<line x1="{X(0)}" y1="{Y(0)}" x2="{X(1)}" y2="{Y(1)}" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="3 4"/>'
               f'<text x="{X(.62):.1f}" y="{Y(.55):.1f}" class="axis-title" transform="rotate(-37 {X(.62):.1f} {Y(.55):.1f})">random guess</text>')
    line = " ".join(f"{X(f):.1f},{Y(t):.1f}" for f, t, _ in pts)
    area = f"{X(0)},{Y(0)} {line} {X(1)},{Y(0)}"
    out.append(f'<polygon points="{area}" fill="var(--ham-wash)"/>'
               f'<polyline points="{line}" fill="none" stroke="var(--ham)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>')
    for f, t, thr in pts:
        if thr is None:
            continue
        tipt = f"threshold ≥ {thr:.2f}<br>true-positive rate {t:.2f}<br>false-positive rate {f:.2f}"
        out.append(f'<circle cx="{X(f):.1f}" cy="{Y(t):.1f}" r="7" class="hit" data-tip="{esc(tipt)}"/>')
    out.append(f'<text x="{X(.97):.1f}" y="{Y(.06):.1f}" text-anchor="end" class="val" style="font-size:14px;font-weight:600">AUC {auc:.3f}</text>')
    out.append(f'<text class="axis-title" x="{L + pw / 2}" y="{H - 6}" text-anchor="middle">False-positive rate (ham flagged as spam)</text>'
               f'<text class="axis-title" transform="rotate(-90)" x="{-(T + ph / 2)}" y="11" text-anchor="middle">True-positive rate (spam caught)</text></svg>')
    return "".join(out)


def category_svg(rows):
    by = {l: Counter(r["category"] for r in rows if r["label"] == l) for l in LABELS}
    cats = sorted({r["category"] for r in rows}, key=lambda c: -(by["ham"][c] + by["spam"][c]))
    xmax, xstep = nice_max(max(max(by[l].values(), default=0) for l in LABELS) or 1)
    bh, gap_row = 12, 14
    row_h = bh * 2 + 2 + gap_row
    W, L, R, T = 460, 135, 30, 22
    H = T + row_h * len(cats) + 8
    pw = W - L - R
    out = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Categories assigned by JEV, split by true label">']
    for v in range(0, int(xmax) + 1, int(xstep)):
        x = L + v / xmax * pw
        out.append(f'<line class="grid" x1="{x:.1f}" x2="{x:.1f}" y1="{T - 4}" y2="{H - 8}"/>'
                   f'<text x="{x:.1f}" y="{T - 8}" text-anchor="middle">{v}</text>')
    for i, c in enumerate(cats):
        y0 = T + i * row_h
        total = by["ham"][c] + by["spam"][c]
        out.append(f'<text x="{L - 8}" y="{y0 + bh + 5}" text-anchor="end" style="font-size:12px;fill:var(--text-primary)">{esc(c.replace("_", " "))}</text>')
        for j, l in enumerate(LABELS):
            v = by[l][c]
            y = y0 + j * (bh + 2)
            w = v / xmax * pw
            share = v / total if total else 0
            tipt = f"<b>{esc(c)}</b><br>{SERIES_NAME[l]}: {v} ({share:.0%} of this category)"
            out.append(f'<g data-tip="{esc(tipt)}"><rect class="hit" x="{L}" y="{y - 1}" width="{pw}" height="{bh + 2}"/>'
                       f'<path d="{bar_path(L, y, w, bh, horizontal=True)}" fill="{SERIES_VAR[l]}"/>'
                       f'<text class="val" x="{L + w + 5:.1f}" y="{y + bh - 2}">{v if v else ""}</text></g>')
    out.append(f'<line x1="{L}" x2="{L}" y1="{T - 4}" y2="{H - 8}" stroke="var(--border)"/></svg>')
    return "".join(out)


def confidence_svg(rows):
    conf = defaultdict(list)
    for r in rows:
        conf[r["category"]].append(r["category_conf"])
    cats = sorted(conf, key=lambda c: -sum(conf[c]) / len(conf[c]))
    W, L, R, T, rh = 420, 150, 40, 22, 24
    H = T + rh * len(cats) + 6
    pw = W - L - R
    out = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Mean JEV category confidence per category">']
    for v in (0, .25, .5, .75, 1):
        x = L + v * pw
        out.append(f'<line class="grid" x1="{x:.1f}" x2="{x:.1f}" y1="{T - 4}" y2="{H - 4}"/>'
                   f'<text x="{x:.1f}" y="{T - 8}" text-anchor="middle">{v:g}</text>')
    for i, c in enumerate(cats):
        vals = conf[c]
        m = sum(vals) / len(vals)
        y = T + i * rh + rh / 2
        tipt = f"<b>{esc(c)}</b><br>mean confidence {m:.2f}<br>range {min(vals):.2f}–{max(vals):.2f} · n={len(vals)}"
        out.append(f'<g data-tip="{esc(tipt)}"><rect class="hit" x="{L}" y="{y - rh / 2}" width="{pw}" height="{rh}"/>'
                   f'<text x="{L - 8}" y="{y + 4}" text-anchor="end" style="font-size:12px;fill:var(--text-primary)">{esc(c.replace("_", " "))}</text>'
                   f'<line x1="{L + min(vals) * pw:.1f}" x2="{L + max(vals) * pw:.1f}" y1="{y}" y2="{y}" stroke="var(--seq-2)" stroke-width="2" stroke-linecap="round"/>'
                   f'<circle cx="{L + m * pw:.1f}" cy="{y}" r="5" fill="var(--ham)" stroke="var(--surface)" stroke-width="2"/>'
                   f'<text class="val" x="{W - R + 6}" y="{y + 4}">{m:.2f}</text></g>')
    out.append("</svg>")
    return "".join(out)


def confusion_html(s):
    cells = [("spam", "spam", s["tp"]), ("spam", "ham", s["fn"]), ("ham", "spam", s["fp"]), ("ham", "ham", s["tn"])]
    rowsum = {"spam": s["tp"] + s["fn"], "ham": s["fp"] + s["tn"]}
    out = ['<div class="cm"><div></div><div class="h">JEV says spam</div><div class="h">JEV says ham</div>']
    for i, (actual, pred, v) in enumerate(cells):
        if i % 2 == 0:
            out.append(f'<div class="rh">Actually {actual}</div>')
        share = v / rowsum[actual] if rowsum[actual] else 0
        step = 0 if share == 0 else 1 if share < .25 else 2 if share < .5 else 3 if share < .8 else 4
        ink = "var(--text-primary)" if step <= 2 else "#ffffff"
        if step == 4:
            ink = "var(--surface)"
        correct = actual == pred
        name = {("spam", "spam"): "true positive", ("spam", "ham"): "missed spam",
                ("ham", "spam"): "false alarm", ("ham", "ham"): "true negative"}[(actual, pred)]
        out.append(f'<div class="cell" style="background:var(--seq-{step});color:{ink}" '
                   f'data-tip="{esc(f"{name}: {v} of {rowsum[actual]} actual {actual}")}">'
                   f'<b>{v}</b><small>{share:.0%} · {"✓ " if correct else "✗ "}{name}</small></div>')
    out.append("</div>")
    return "".join(out)


def tile(label, value, hint):
    return f'<div class="tile"><div class="label">{label}</div><div class="value">{value}</div><div class="hint">{hint}</div></div>'


def row_html(r):
    correct = r["label"] == r["pred"]
    outcome = "correct" if correct else "wrong"
    mark = '<span class="ok">✓</span>' if correct else '<span class="bad">✗</span>'
    snip = f'<span class="snip">{esc(r.get("body", "")[:220])}</span>' if r.get("body") else ""
    dot = lambda l: f'<span class="pill"><span class="sw" style="background:{SERIES_VAR[l]}"></span>{l}</span>'
    return (f'<tr data-label="{r["label"]}" data-pred="{r["pred"]}" data-cat="{esc(r["category"])}" data-outcome="{outcome}">'
            f'<td>{mark}</td><td>{dot(r["label"])}</td><td>{dot(r["pred"])}</td>'
            f'<td class="num">{r["p_spam"]:.2f}</td><td>{esc(r["category"])}</td><td class="num">{r["category_conf"]:.2f}</td>'
            f'<td>{esc(r["subject"] or "(no subject)")}{snip}</td></tr>')


TABLE_HEAD = ('<thead><tr><th></th><th>True</th><th>JEV</th><th>p_spam</th><th>Category</th>'
              '<th>Conf.</th><th>Subject / body</th></tr></thead>')


# ----------------------------------------------------------------------------
# Page
# ----------------------------------------------------------------------------
def build_html_report(rows, summary, path, meta=None):
    meta = meta or {}
    s = summary
    thr = meta.get("threshold", 0.5)
    n_spam = sum(r["label"] == "spam" for r in rows)
    errors = sorted((r for r in rows if r["label"] != r["pred"]), key=lambda r: -abs(r["p_spam"] - thr))
    cats = sorted({r["category"] for r in rows})
    by = {l: Counter(r["category"] for r in rows if r["label"] == l) for l in LABELS}

    opt = lambda vals: "".join(f'<option value="{esc(v)}">{esc(v)}</option>' for v in vals)
    cat_table = "".join(
        f'<tr><td>{esc(c)}</td><td class="num">{by["spam"][c]}</td><td class="num">{by["ham"][c]}</td></tr>'
        for c in sorted(cats, key=lambda c: -(by["spam"][c] + by["ham"][c])))

    body = f"""
<main>
  <h1>JEV spam &amp; category demo</h1>
  <p class="sub">{len(rows)} public emails from the Enron-Spam corpus ({n_spam} spam, {len(rows) - n_spam} ham), each classified by JEV in a single call.</p>
  <div class="meta">Model {esc(str(meta.get("model", "jev-latest")))} · dataset {esc(str(meta.get("dataset", "SetFit/enron_spam")))} [{esc(str(meta.get("split", "test")))}]
    · seed {esc(str(meta.get("seed", "n/a")))} · spam threshold {thr}{" · generated " + esc(str(meta["generated"])) if meta.get("generated") else ""}</div>

  <div class="flow"><span class="box">Email (subject + body)</span> → <span class="box"><b>One JEV call</b></span> →
    <span class="box">Q1 · noul: is it spam? → probability</span> + <span class="box">Q2 · choice: which category? → label + confidence</span></div>

  <div class="tiles">
    {tile("Accuracy", f"{s['accuracy']:.1%}", f"{s['tp'] + s['tn']} of {s['n']} correct")}
    {tile("Precision", f"{s['precision']:.1%}", "flagged spam that really is spam")}
    {tile("Recall", f"{s['recall']:.1%}", "real spam that JEV caught")}
    {tile("F1 score", f"{s['f1']:.3f}", "balance of precision and recall")}
    {tile("ROC-AUC", f"{s['roc_auc']:.3f}", "ranking quality, threshold-free")}
  </div>

  <div class="grid2">
    <div class="card"><h2>Confusion matrix</h2><p class="sub">JEV's spam call vs the dataset's ground-truth label. Shade = share of the row.</p>{confusion_html(s)}</div>
    <div class="card"><h2>ROC curve</h2><p class="sub">How well JEV's spam probability ranks spam above ham at every threshold.</p>{roc_svg(rows, s["roc_auc"])}</div>
  </div>

  <div class="card" style="margin-bottom:16px"><h2>How confident is JEV?</h2>
    <p class="sub">Distribution of JEV's spam probability, split by the true label. Good separation = ham piled up on the left, spam on the right.</p>
    {legend()}{histogram_svg(rows, thr)}</div>

  <div class="grid2">
    <div class="card"><h2>What JEV thinks each email is about</h2>
      <p class="sub">JEV's category answer, split by the true spam label. No ground truth for topics: this shows whether the categories make sense.</p>
      {legend()}{category_svg(rows)}
      <details><summary>Table view</summary><table><thead><tr><th>Category</th><th>Spam</th><th>Ham</th></tr></thead><tbody>{cat_table}</tbody></table></details></div>
    <div class="card"><h2>Category confidence</h2>
      <p class="sub">Mean JEV confidence per category (dot) and min–max range (line).</p>{confidence_svg(rows)}</div>
  </div>

  <div class="card"><h2>Score: {esc(str((s.get("score") or {}).get("name", "score")))}</h2>
    <p class="sub">JEV's Score answer: where each email sits on an ordered rubric (rounded to the nearest level).</p>
    {score_html(s.get("score"))}</div>

  <section><h2>Misclassified emails ({len(errors)})</h2>
    <p class="sub">Most confident mistakes first. Enron-Spam labels are not perfect, so some of these may be JEV being right.</p>
    <div class="scroll"><table>{TABLE_HEAD}<tbody>{"".join(row_html(r) for r in errors) or '<tr><td colspan="7">None 🎉</td></tr>'}</tbody></table></div>
  </section>

  <section><h2>All results</h2>
    <div class="filters">
      <label>True <select id="f-label"><option value="">all</option>{opt(LABELS)}</select></label>
      <label>JEV <select id="f-pred"><option value="">all</option>{opt(LABELS)}</select></label>
      <label>Category <select id="f-cat"><option value="">all</option>{opt(cats)}</select></label>
      <label>Outcome <select id="f-outcome"><option value="">all</option>{opt(["correct", "wrong"])}</select></label>
      <span id="f-count"></span>
    </div>
    <div class="scroll"><table>{TABLE_HEAD}<tbody id="all-rows">{"".join(row_html(r) for r in rows)}</tbody></table></div>
  </section>
</main>
<div id="tip" role="tooltip"></div>
"""
    page = (f'<!doctype html><html lang="en"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width, initial-scale=1">'
            f'<title>JEV Spam Demo</title><style>{CSS}</style></head><body>{body}'
            f'<script>{JS}</script></body></html>')
    with open(path, "w", encoding="utf-8") as f:
        f.write(page)
    return path


def load_results_csv(path):
    import csv
    with open(path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["p_spam"] = float(r["p_spam"])
        r["category_conf"] = float(r.get("category_conf") or 0)
        for k in [k for k in r if k == "urgency" or k.startswith("urgency_")]:  # score columns
            r[k] = float(r[k]) if r[k] not in ("", None) else None
    return rows


def score_html(sc):
    """Score section: mean by label, emails per level (spam vs ham), mean by category."""
    if not sc:
        return '<p class="sub">No Score question was asked in this run.</p>'
    f = lambda v: "–" if v is None else f"{v:.2f}"
    top = max(1, max(max(sc["by_level"]["spam"]), max(sc["by_level"]["ham"])))
    bar = lambda v, lbl: (f'<span class="pill"><span class="sw" style="background:{SERIES_VAR[lbl]};width:{max(2, 120 * v / top):.0f}px"></span>{v}</span>')
    levels = "".join(
        f'<tr><td class="num">{i}</td><td>{esc(text)}</td><td>{bar(sc["by_level"]["spam"][i], "spam")}</td>'
        f'<td>{bar(sc["by_level"]["ham"][i], "ham")}</td></tr>' for i, text in enumerate(sc["legend"]))
    cats = " · ".join(f"{esc(c)} <b>{f(v)}</b>" for c, v in sc["by_category"].items())
    return (f'<p class="sub">Mean {f(sc["mean"])} · ham {f(sc["mean_ham"])} · spam {f(sc["mean_spam"])} · '
            f'mean confidence {f(sc["mean_confidence"])} · AUC vs spam {f(sc["auc_vs_spam"])}</p>'
            f'<table><thead><tr><th>Level</th><th>Description</th><th>Spam</th><th>Ham</th></tr></thead><tbody>{levels}</tbody></table>'
            f'<p class="sub" style="margin-top:10px">Mean by category: {cats}</p>')


def load_meta(summary_path):
    try:
        with open(summary_path, encoding="utf-8") as f:
            return json.load(f).get("meta", {})
    except (OSError, ValueError):
        return {}
