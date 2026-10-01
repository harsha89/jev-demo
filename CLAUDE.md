# JEV showcase project

Demos of **JEV** (TypeSafe AI "System One" decision model) for research and teaching at La Trobe.
The main demo classifies public emails: spam or not (scored against ground truth) plus a topic category.

## Layout

- `jev_spam_demo.py` — CLI: runs JEV on a balanced Enron-Spam sample, prints metrics, writes CSV + `_summary.json` + HTML report.
- `jev_report.py` — builds the self-contained HTML report (inline SVG charts, no dependencies). `--report <csv>` rebuilds it without calling JEV.
- `jev_gmail_classifier.py` — the user's original Gmail classifier (reference for the JEV call shape).
- `enron_spam_test.jsonl` — cached Enron-Spam test split (2,000 emails, HF `SetFit/enron_spam`).
- `jev-demo-app/` — Next.js 16 + MUI v9 web app: enter the TypeSafe key, run on the dataset, live charts, request/response inspector, "Try your own email" with an example generator.
  - `lib/config.ts` — JEV URL, model, the two questions and category criteria.
  - `lib/examples.ts` — template generator for example emails (one template set per category + spam).
  - `lib/metrics.ts` — accuracy/precision/recall/F1/AUC/ROC, CSV export.
  - `app/api/classify/route.ts` — server proxy to JEV; returns the result plus a `trace` (request sent, key masked; raw response, status, latency).
  - `app/api/sample/route.ts` — seeded balanced sample from `data/enron_spam_test.jsonl`.
  - `app/theme.ts` — MUI theme and the shared radius scale; `components/Charts.tsx` — SVG charts (incl. `ScoreLevels`, `ScoreByCategory`); `components/CallInspector.tsx` — side-by-side request/response viewer; `components/ScoreView.tsx` — Score result (per-level probabilities) and the Score question editor.

## Commands

```
python jev_spam_demo.py [-n 50] [--seed 42]          # needs TYPESAFE_API_KEY
python jev_spam_demo.py --report results.csv         # rebuild HTML report offline
cd jev-demo-app && npm run dev                       # http://localhost:3000
cd jev-demo-app && npx tsc --noEmit && npx next build
```

## JEV API

- `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer <TYPESAFE_API_KEY>`.
- Docs: https://docs.typesafe.ai (primitives: `/primitives/noul`, `/primitives/choice`, `/primitives/score`). Three question types can be mixed in one call:
  - **noul**: yes/no → `answers.<q>.noul` (probability 0–1, no separate confidence). Optional `criteria: {true, false}`.
  - **choice**: `criteria` = `{option: description}` → `choice`, `confidence`, `probabilities` per option.
  - **score**: `criteria` = **ordered array** of 2–10 level descriptions (lowest first, levels numbered 0..n-1) → `score` (fractional, Σ level × probability), `confidence`, `probabilities` and `legend` keyed by level number as a string.
- Response envelope: `{ model, usage, answers: { <question name>: {...} } }`. The app's parsing matches the docs; still not run against the live API from here.
- The demo asks all three per email: `is_spam` (noul), `category` (choice), and a Score question (default `urgency`, 5 levels in `DEFAULT_SCORE_QUESTION` / `SCORE_QUESTION`). In the app the score rubric is editable (or switched off) in the "3 · Score question" panel and sent per request as `scoreQuestion`.
- `JEV_URL` env var overrides the endpoint (used for testing against a mock).

## Rules

- **Keep categories in sync** between `jev-demo-app/lib/config.ts`, `jev_spam_demo.py` and `jev-demo-app/lib/examples.ts`. Current set: marketing, finance, sales, customer_support, other.
- **Never log or store the API key** server-side. The browser sends it per request (`x-typesafe-key`); traces show only the last 4 characters.
- **Never present mock or synthetic numbers as JEV results.** Without a real key, test against a local mock JEV and say clearly that the numbers are not JEV's.
- Enron-Spam has spam/ham labels only. Category answers have no ground truth, so don't report category "accuracy" on Enron.

## UI preferences (user feedback)

- The user wants a polished, Google Material look, using MUI components rather than hand-rolled HTML controls.
- **Corners must be consistent.** Use the radius scale in `app/theme.ts`: controls 8px (buttons, inputs, chips, menus), small tags 6px, nested panels 12px, cards 16px, dialogs 20px. Don't mix pill and rounded-rectangle shapes, and don't hard-code other radii.
- Result/status chips use the soft tonal style so they don't look like buttons.
- Charts: ham = blue (`--ham`), spam = orange (`--spam`), used consistently. Light and dark mode both follow the OS, and both must look right.
- **Check UI changes visually before reporting done.** Screenshot light, dark and phone width (390px), including high-DPI close-ups of buttons and edges.

## Testing setup (Windows)

- Shell: PowerShell or Git Bash on Windows; Python 3.9, Node 24.
- UI checks: `playwright-core` driving the installed Edge (`chromium.launch({ channel: "msedge" })`), against `next start -p 3123` with `JEV_URL` pointing at a small mock JEV on port 4010.
- Stopping a background task can leave its `node` process running. Free ports with
  `Get-NetTCPConnection -LocalPort <port> -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`.
- `next dev` regenerates `jev-demo-app/AGENTS.md` and `jev-demo-app/CLAUDE.md`. Leave them alone; this file is the real project guide.

## Ideas not yet built

Category scoring on generated examples (5×5 confusion matrix), save/replay runs for offline demos, editable questions in the UI, Naive Bayes baseline, calibration plot, latency/cost panel, retry with backoff on HTTP 429.
