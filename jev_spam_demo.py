"""
Showcase: classify a PUBLIC email dataset with Jev (TypeSafe AI System One decision model).

Dataset: Enron-Spam (Metsis et al., 2006) via Hugging Face "SetFit/enron_spam".
Every email carries a ground-truth spam/ham label, so we can score Jev's spam answer.

For each email, ONE Jev call asks two questions at once:
  1. Noul (binary)  -> probability the email is spam          (scored against ground truth)
  2. Choice         -> which topical category the email is in (no ground truth; reported as distribution)
  3. Score          -> where the email sits on an ordered rubric (default: urgency, levels 0-4)

Setup (once):
  pip install httpx
  set TYPESAFE_API_KEY=your_key            (Windows)   | export TYPESAFE_API_KEY=... (mac/linux)

Run:
  python jev_spam_demo.py                  # 50 spam + 50 ham from the test split, prints metrics + saves CSV
  python jev_spam_demo.py -n 200 --seed 7  # 200 spam + 200 ham
  python jev_spam_demo.py --download-only  # just cache the dataset locally (no Jev calls)
  python jev_spam_demo.py --report jev_spam_results_X.csv   # rebuild the HTML report from saved results (no Jev calls)

Each run writes: <name>.csv (per email), <name>_summary.json (metrics), <name>.html (visual report).
"""

import argparse
import csv
import json
import os
import random
import sys
from collections import Counter, defaultdict
from datetime import datetime

import httpx

from jev_report import build_html_report, load_meta, load_results_csv

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
JEV_URL = "https://api.typesafe.ai/v1/systemone"
JEV_MODEL = "jev-latest"

DATASET = "SetFit/enron_spam"
SPLIT = "test"  # 2,000 emails (~half spam)
ROWS_URL = "https://datasets-server.huggingface.co/rows"
CACHE_FILE = "enron_spam_test.jsonl"

SPAM_QUESTION = {
    "type": "noul",
    "instructions": "Is this email spam?",
    "criteria": {
        "true": "Unsolicited bulk or commercial email: promotions, pharmacy, stock tips, loans, adult content, "
        "software deals, phishing, scams, or messages sent to many recipients without a prior relationship.",
        "false": "Legitimate email the recipient would expect: colleagues, business partners, internal "
        "announcements, newsletters or notifications they subscribed to, personal correspondence.",
    },
}

CATEGORY_QUESTION = {
    "type": "choice",
    "instructions": "Which category best describes the topic of this email? Pick the single most specific fit.",
    "criteria": {
        "marketing": "Promotions, advertising, newsletters, campaigns, product announcements, offers and discounts",
        "finance": "Invoices, payments, budgets, accounting, banking, investments, trading, financial reports",
        "sales": "Deals, quotes, pricing, contracts, prospects, purchase orders, partnerships, business development",
        "customer_support": "Help or support requests, account or technical issues, complaints, service follow-ups, questions",
        "other": "Anything that does not clearly fit marketing, finance, sales or customer support: "
        "internal updates, meetings, HR, legal, personal or social messages",
    },
}

# Score: JEV places the email on an ordered rubric (2-10 levels, lowest first) and returns a fractional
# score = sum(level * probability), plus a probability per level. Set to None to skip it.
SCORE_NAME = "urgency"
SCORE_QUESTION = {
    "type": "score",
    "instructions": "How urgently does this email need a response or action from the recipient?",
    "criteria": [
        "No action needed: informational, automated, promotional or spam",
        "Low: can wait a week or more",
        "Normal: respond within a few days",
        "High: needs attention within 24 hours",
        "Critical: needs immediate action (outage, security issue, deadline today)",
    ],
}

SPAM_THRESHOLD = 0.5
MAX_BODY_CHARS = 4000


# ----------------------------------------------------------------------------
# Dataset
# ----------------------------------------------------------------------------
def load_dataset() -> list:
    """Download the split once via the HF datasets-server API and cache it as JSONL."""
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, encoding="utf-8") as f:
            return [json.loads(line) for line in f]

    print(f"Downloading {DATASET} [{SPLIT}] ...")
    rows, offset = [], 0
    with httpx.Client(timeout=60) as hf:
        while True:
            r = hf.get(ROWS_URL, params={"dataset": DATASET, "config": "default", "split": SPLIT,
                                         "offset": offset, "length": 100})
            r.raise_for_status()
            batch = r.json()["rows"]
            if not batch:
                break
            for b in batch:
                row = b["row"]
                rows.append({
                    "message_id": row["message_id"],
                    "subject": (row.get("subject") or "").strip(),
                    "body": (row.get("message") or "").strip(),
                    "label": row["label_text"],  # "spam" | "ham"
                })
            offset += len(batch)
            print(f"  {offset} rows", end="\r")
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")
    print(f"\nCached {len(rows)} rows to {CACHE_FILE}")
    return rows


def balanced_sample(rows: list, n_per_class: int, seed: int) -> list:
    rng = random.Random(seed)
    by_label = defaultdict(list)
    for r in rows:
        if r["body"] or r["subject"]:
            by_label[r["label"]].append(r)
    sample = []
    for label in ("spam", "ham"):
        pool = by_label[label]
        sample += rng.sample(pool, min(n_per_class, len(pool)))
    rng.shuffle(sample)
    return sample


# ----------------------------------------------------------------------------
# Jev
# ----------------------------------------------------------------------------
def classify(client: httpx.Client, email: dict) -> dict:
    payload = {
        "model": JEV_MODEL,
        "state": {"subject": email["subject"], "body": email["body"][:MAX_BODY_CHARS]},
        "questions": {"is_spam": SPAM_QUESTION, "category": CATEGORY_QUESTION,
                      **({SCORE_NAME: SCORE_QUESTION} if SCORE_QUESTION else {})},
    }
    r = client.post(JEV_URL, json=payload)
    if r.status_code != 200:
        raise RuntimeError(f"Jev HTTP {r.status_code}: {r.text[:300]}")
    data = r.json()
    answers = data["answers"]
    p_spam = float(answers["is_spam"]["noul"])
    cat = answers["category"]
    return {
        "pred": "spam" if p_spam >= SPAM_THRESHOLD else "ham",
        "p_spam": round(p_spam, 3),
        "category": cat["choice"],
        "category_conf": round(float(cat.get("confidence", 0)), 3),
        **score_columns(answers.get(SCORE_NAME)),
    }


def score_columns(ans) -> dict:
    """Flatten JEV's Score answer: score, confidence, nearest level, and one probability column per level."""
    if not SCORE_QUESTION or not ans:
        return {}
    n = len(SCORE_QUESTION["criteria"])
    score = float(ans["score"])
    probs = ans.get("probabilities", {})
    return {
        SCORE_NAME: round(score, 3),
        f"{SCORE_NAME}_confidence": round(float(ans.get("confidence", 0)), 3),
        f"{SCORE_NAME}_level": min(n - 1, max(0, round(score))),
        **{f"{SCORE_NAME}_p{i}": round(float(probs.get(str(i), 0)), 3) for i in range(n)},
    }


def summarise_score(rows: list):
    """Mean score overall/by label/by category, emails per level by label, and AUC of the score vs the spam label."""
    scored = [r for r in rows if isinstance(r.get(SCORE_NAME), (int, float))]
    if not SCORE_QUESTION or not scored:
        return None
    n = len(SCORE_QUESTION["criteria"])
    mean = lambda xs: sum(xs) / len(xs) if xs else None
    by_level = {lbl: [0] * n for lbl in ("ham", "spam")}
    for r in scored:
        by_level[r["label"]][int(r[f"{SCORE_NAME}_level"])] += 1
    cats = sorted({r["category"] for r in scored})
    return {
        "name": SCORE_NAME, "levels": n, "legend": SCORE_QUESTION["criteria"], "n": len(scored),
        "mean": mean([r[SCORE_NAME] for r in scored]),
        "mean_ham": mean([r[SCORE_NAME] for r in scored if r["label"] == "ham"]),
        "mean_spam": mean([r[SCORE_NAME] for r in scored if r["label"] == "spam"]),
        "mean_confidence": mean([r[f"{SCORE_NAME}_confidence"] for r in scored]),
        "auc_vs_spam": roc_auc([r["label"] == "spam" for r in scored], [r[SCORE_NAME] for r in scored]),
        "by_level": by_level,
        "by_category": {c: mean([r[SCORE_NAME] for r in scored if r["category"] == c]) for c in cats},
    }


# ----------------------------------------------------------------------------
# Metrics
# ----------------------------------------------------------------------------
def roc_auc(y_true: list, scores: list) -> float:
    """Mann-Whitney AUC (ties count half); no sklearn needed."""
    pos = [s for y, s in zip(y_true, scores) if y]
    neg = [s for y, s in zip(y_true, scores) if not y]
    if not pos or not neg:
        return float("nan")
    wins = sum((p > n) + 0.5 * (p == n) for p in pos for n in neg)
    return wins / (len(pos) * len(neg))


def report(rows: list):
    y = [r["label"] == "spam" for r in rows]
    yhat = [r["pred"] == "spam" for r in rows]
    tp = sum(a and b for a, b in zip(y, yhat))
    tn = sum(not a and not b for a, b in zip(y, yhat))
    fp = sum(not a and b for a, b in zip(y, yhat))
    fn = sum(a and not b for a, b in zip(y, yhat))
    n = len(rows)
    acc = (tp + tn) / n
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    auc = roc_auc(y, [r["p_spam"] for r in rows])

    print("\n" + "=" * 64)
    print(f"SPAM DETECTION vs ground truth  (n={n}, threshold={SPAM_THRESHOLD})")
    print("=" * 64)
    print(f"  Accuracy  {acc:.3f}    Precision {prec:.3f}    Recall {rec:.3f}")
    print(f"  F1        {f1:.3f}    ROC-AUC   {auc:.3f}")
    print("\n  Confusion matrix      pred=spam  pred=ham")
    print(f"    actual=spam        {tp:>9}  {fn:>8}")
    print(f"    actual=ham         {fp:>9}  {tn:>8}")

    print("\n" + "=" * 64)
    print("CATEGORY DISTRIBUTION by ground-truth label")
    print("=" * 64)
    by = {lbl: Counter(r["category"] for r in rows if r["label"] == lbl) for lbl in ("spam", "ham")}
    cats = sorted(set(by["spam"]) | set(by["ham"]), key=lambda c: -(by["spam"][c] + by["ham"][c]))
    print(f"  {'category':<22}{'spam':>6}{'ham':>6}")
    for c in cats:
        print(f"  {c:<22}{by['spam'][c]:>6}{by['ham'][c]:>6}")

    errors = [r for r in rows if r["label"] != r["pred"]]
    if errors:
        print("\n" + "=" * 64)
        print(f"MISCLASSIFIED ({len(errors)}) - worth eyeballing; Enron labels are not perfect")
        print("=" * 64)
        for r in errors[:15]:
            print(f"  true={r['label']:<4} p_spam={r['p_spam']:.2f} {r['category']:<20} | {r['subject'][:60]}")

    sc = summarise_score(rows)
    if sc:
        f = lambda v: "-" if v is None else f"{v:.2f}"
        print("\n" + "=" * 64)
        print(f"SCORE: {sc['name'].upper()} (levels 0-{sc['levels'] - 1})")
        print("=" * 64)
        print(f"  mean {f(sc['mean'])}  ham {f(sc['mean_ham'])}  spam {f(sc['mean_spam'])}  "
              f"confidence {f(sc['mean_confidence'])}  AUC vs spam {f(sc['auc_vs_spam'])}")
        print(f"  {'level':<44}{'spam':>6}{'ham':>6}")
        for i, text in enumerate(sc["legend"]):
            print(f"  {i} {text[:42]:<42}{sc['by_level']['spam'][i]:>6}{sc['by_level']['ham'][i]:>6}")
        print("  mean by category: " + ", ".join(f"{c} {f(v)}" for c, v in sc["by_category"].items()))

    return {"n": n, "accuracy": acc, "precision": prec, "recall": rec, "f1": f1, "roc_auc": auc,
            "tp": tp, "tn": tn, "fp": fp, "fn": fn,
            "categories": {lbl: dict(c) for lbl, c in by.items()}, "score": sc}


def main():
    ap = argparse.ArgumentParser(description="Jev spam + category demo on the public Enron-Spam dataset.")
    ap.add_argument("-n", "--per-class", type=int, default=50, help="Emails per class (spam and ham)")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("-o", "--out", default=None, help="CSV output path")
    ap.add_argument("--download-only", action="store_true", help="Only download/cache the dataset")
    ap.add_argument("--report", metavar="CSV", help="Rebuild the HTML report from an existing results CSV")
    args = ap.parse_args()

    if args.report:
        base = args.report.rsplit(".", 1)[0]
        rows = load_results_csv(args.report)
        summary = report(rows)
        meta = load_meta(base + "_summary.json")
        print(f"\nReport: {build_html_report(rows, summary, base + '.html', meta)}")
        return

    data = load_dataset()
    if args.download_only:
        return

    key = os.environ.get("TYPESAFE_API_KEY")
    if not key:
        sys.exit("Set TYPESAFE_API_KEY first.")

    sample = balanced_sample(data, args.per_class, args.seed)
    stamp = f"{datetime.now():%Y%m%d_%H%M}"
    out = args.out or f"jev_spam_results_{stamp}.csv"

    rows = []
    with httpx.Client(timeout=60, headers={"Authorization": f"Bearer {key}"}) as jev:
        for i, email in enumerate(sample, 1):
            try:
                res = classify(jev, email)
            except Exception as e:  # keep going on a single failure
                print(f"[{i}] ERROR {email['subject'][:60]!r}: {e}")
                continue
            row = {"message_id": email["message_id"], "label": email["label"], **res, "subject": email["subject"],
                   "body": " ".join(email["body"].split())[:300]}
            rows.append(row)
            mark = "ok " if res["pred"] == email["label"] else "XX "
            print(f"[{i:>4}] {mark} true={email['label']:<4} p_spam={res['p_spam']:.2f} | "
                  f"{res['category']:<20} {res['category_conf']:.2f} | "
                  + (f"{SCORE_NAME} {res[SCORE_NAME]:.2f} | " if SCORE_NAME in res else "") + email["subject"][:50])

    if not rows:
        sys.exit("No emails classified.")

    with open(out, "w", newline="", encoding="utf-8") as f:
        # union of keys: score columns are missing when a response has no Score answer
        w = csv.DictWriter(f, fieldnames=list(dict.fromkeys(k for r in rows for k in r)))
        w.writeheader()
        w.writerows(rows)

    summary = report(rows)
    summary["meta"] = {"model": JEV_MODEL, "dataset": DATASET, "split": SPLIT, "seed": args.seed,
                       "per_class": args.per_class, "threshold": SPAM_THRESHOLD,
                       "generated": f"{datetime.now():%Y-%m-%d %H:%M}"}
    summary_file = out.rsplit(".", 1)[0] + "_summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    html_file = build_html_report(rows, summary, out.rsplit(".", 1)[0] + ".html", summary["meta"])
    print(f"\nSaved per-email results to {out}, metrics to {summary_file}, visual report to {html_file}")


if __name__ == "__main__":
    main()
