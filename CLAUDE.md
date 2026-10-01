# JEV showcase project

Demos of **JEV** (TypeSafe AI "System One" decision model) for research and teaching at La Trobe.
One email → one JEV call → three answers (noul: spam?, choice: category, score: urgency), on the public Enron-Spam dataset.
Repo: https://github.com/harsha89/jev-demo (public). Target host: **Netlify**.

## Layout

The Next.js 16 + MUI v9 app is at the **repository root** (Netlify needs no base directory).

- `app/page.tsx` — the page. Top bar (key-status chip + Settings dialog: API key, Score rubric, parallel calls) and a segmented control with three views:
  "Try an email" (compose → three answer cards → request/response), "Run on dataset" (run bar → `ResultsView`), "Example · no key needed" (saved run: 1 sample-email tour → 2 dataset charts → 3 call-to-action).
  New visitors land on Example; a remembered key starts on Try. **Keep new features inside this structure** (user asked for less clutter).
- `app/api/classify/route.ts` — server proxy to JEV; returns the result + `trace` (request with key masked; raw response, status, latency).
- `app/api/sample/route.ts` — seeded balanced sample from `data/enron_spam_test.jsonl`.
- `app/api/example/route.ts` — GET serves `data/example-run.json`; POST (save as example) works **only in `next dev`**.
- `app/theme.ts` (theme, radius scale), `app/globals.css` (chart, code-panel and question-type tokens).
- `components/` — `ExampleTour` (Example tab sample emails: inbox list, reading pane, JEV verdict vs dataset label, answer cards + inspector, ←/→ keys; user did not want a guess-first quiz), `AnswerCards` (three answer cards), `CallInspector` (request/response: "By question" default + "Raw JSON"; exports `QTYPES`, `QTypeChip`, `tint`),
  `ResultsView` (Spam / Category / Score / Emails tabs; exports `Block`, `LabelChip`), `Charts` (SVG charts), `ScoreView` (Score rubric editor).
- `lib/config.ts` (JEV URL/model, questions, types incl. `ExampleRun`), `lib/metrics.ts`, `lib/examples.ts` (template email generator).
- `data/enron_spam_test.jsonl` (2,000 emails), `data/example-run.json` (Example tab data).
- `python/` — `jev_spam_demo.py` + `jev_report.py`: CLI run with CSV/JSON/HTML report (run from inside `python/`).
- `next.config.ts` — `outputFileTracingIncludes` ships the data files with the API functions; `agentRules: false` stops `next dev` writing AGENTS.md/CLAUDE.md.
- `netlify.toml` — build `npm run build`, publish `.next`, Node 22.

## Commands

```
npm run dev                                          # http://localhost:3000
npx tsc --noEmit && npx next build
cd python && python jev_spam_demo.py [-n 50] [--seed 42]   # needs TYPESAFE_API_KEY
cd python && python jev_spam_demo.py --report results.csv  # rebuild HTML report offline
```

## JEV API

- `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer <key>`. Docs: https://docs.typesafe.ai (`/primitives/noul`, `/primitives/choice`, `/primitives/score`).
  - **noul**: yes/no → `answers.<q>.noul` (probability 0–1, no separate confidence). Optional `criteria: {true, false}`.
  - **choice**: `criteria` = `{option: description}` → `choice`, `confidence`, `probabilities` per option.
  - **score**: `criteria` = **ordered array** of 2–10 levels (lowest first, numbered 0..n-1) → `score` (fractional, Σ level × probability), `confidence`, `probabilities`/`legend` keyed by level as string.
- Envelope: `{ model, usage, answers: { <question name>: {...} } }`. Parsing matches the docs; **not yet run against the live API from here**.
- Questions per email: `is_spam` (noul), `category` (choice), Score (default `urgency`, editable in Settings, sent per request as `scoreQuestion`).
- `JEV_URL` env var overrides the endpoint (testing against a mock).
- Visitors get a key at https://console.typesafe.ai (`KEY_URL` in `app/page.tsx`; linked from Settings and the Example call-to-action).

## Rules

- **Keep categories in sync** between `lib/config.ts`, `lib/examples.ts` and `python/jev_spam_demo.py`: marketing, finance, sales, customer_support, other.
- **Never log or store the API key** server-side. Traces show only the last 4 characters.
- **Server key fallback is off in production** unless `ALLOW_SERVER_KEY=true`; never suggest setting `TYPESAFE_API_KEY` on the public Netlify site.
- **Never present mock or synthetic numbers as JEV results.** `data/example-run.json` currently holds **illustrative** data (`source: "illustrative"`, response `model: "illustrative-not-jev"`), and the Example tab says so. Replace it via "Save as example" after a real run, never by hand-editing numbers.
- Example samples should be classroom-friendly: the "date a lonely housewife" sample was swapped (by the user's request) for an existing row ("epson inkjet cartridges"), reusing that row's saved answers and trace, and removed from the illustrative rows (now 49 emails). "Save as example" picks samples automatically, so check them after saving.
- Enron-Spam has spam/ham labels only; don't report category "accuracy" on Enron.

## UI preferences (user feedback)

- Polished, sleek Material look with MUI components. Font Inter (+ JetBrains Mono for code). Cards are borderless with a hairline ring + soft shadow; avoid stacking outlines.
- **Consistent corners** from `RADIUS` in `app/theme.ts`: controls 8px, small tags 6px, nested panels 12px, cards 16px, dialogs 20px.
- Question-type colours everywhere a type appears: noul = aqua, choice = violet, score = magenta (`--q-*`; brighter `--qc-*` on dark code panels). Ham = blue, spam = orange.
- Request/response JSON uses dark code panels in both themes. The user likes the "By question" inspector; keep it central.
- **Check UI changes visually before reporting done**: light, dark and 390px phone width.

## Testing setup (Windows)

- PowerShell or Git Bash; Python 3.9, Node 24. UI checks: `playwright-core` with the installed Edge (`chromium.launch({ channel: "msedge" })`) against `next start -p 3123` with `JEV_URL` → a local mock JEV.
- Stopping a background task can leave `node` running. Free ports with `Get-NetTCPConnection -LocalPort <port> -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`.
- GitHub CLI is not installed system-wide; a portable copy was used once for the first push.

## Ideas not yet built

Category scoring on generated examples (5×5 confusion matrix), Naive Bayes baseline, calibration plot, latency/cost panel, retry with backoff on HTTP 429.
