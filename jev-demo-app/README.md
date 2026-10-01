# JEV spam & category demo (Next.js)

Classify public Enron-Spam emails with TypeSafe JEV — one call per email returns
a spam probability (noul) and a topic category (choice) — and see the results live.

## Run

```
npm install
npm run dev
```

Open http://localhost:3000, paste your TypeSafe key, click **Test key**, then **Run JEV**.

- Key: sent only to this app's `/api/classify` route, which forwards it to `api.typesafe.ai`.
  Alternatively leave the box blank and set `TYPESAFE_API_KEY` in `.env.local`.
- Dataset: `data/enron_spam_test.jsonl` (Enron-Spam test split, 2,000 emails, from Hugging Face `SetFit/enron_spam`).
- Questions/categories: `lib/config.ts` (kept in sync with `../jev_spam_demo.py`).
- The spam-threshold slider recomputes all metrics and charts client-side.
- `JEV_URL` env var overrides the API endpoint (useful for testing against a mock).
