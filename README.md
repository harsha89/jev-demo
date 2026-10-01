# JEV email classification demo

A showcase of **JEV**, TypeSafe AI's System One decision model, on the public
[Enron-Spam](https://huggingface.co/datasets/SetFit/enron_spam) dataset. Each email gets **one JEV call** that asks
all three JEV question types at once:

| Question | JEV type | Returns |
|---|---|---|
| Is this email spam? | **Noul** | probability 0–1 (scored against the dataset's spam labels) |
| Which category? (marketing, finance, sales, customer support, other) | **Choice** | category, confidence, probability per option |
| How urgent is it? (5-level rubric, editable) | **Score** | fractional score + probability per level |

The web app has three views:

- **Try an email**: write or generate an email and see JEV's three answers, plus the exact request and response, question by question.
- **Run on dataset**: classify a balanced sample of Enron-Spam emails and explore accuracy, categories and urgency.
- **Example (no key needed)**: a saved run for visitors without an API key.

## Project layout

```
app/                 Next.js App Router (page, layout, theme, API routes)
  api/classify/      server proxy to JEV (key never logged; returns a request/response trace)
  api/sample/        seeded balanced sample from data/enron_spam_test.jsonl
  api/example/       serves data/example-run.json (saving a new one is local-only)
components/          UI: answer cards, request/response inspector, charts, results view, score editor
lib/                 JEV questions/config, metrics, example email generator
data/                Enron-Spam test split + the Example tab's saved run
python/              stand-alone Python script + HTML report (same questions as the app)
netlify.toml         Netlify build settings
```

## Run locally

```
npm install
npm run dev        # http://localhost:3000
```

Add your TypeSafe key in **Settings** (gear icon). It goes only to the app's own server route, which forwards it to
`api.typesafe.ai`. Locally you can instead put `TYPESAFE_API_KEY=...` in `.env.local`.

### Replacing the example data

`data/example-run.json` ships with **illustrative** placeholder data (clearly labelled in the app, not JEV output).
To replace it with a real run: run locally with your key, open **Run on dataset**, run it, then click **Save as example**.
Commit the updated `data/example-run.json` and redeploy. The Example tab then shows "Recorded JEV run" with the date.

## Deploy to Netlify

1. Push this repository to GitHub.
2. In Netlify: **Add new site → Import an existing project → GitHub** and pick the repo.
   Netlify reads `netlify.toml` (build `npm run build`, Node 22) and deploys with its Next.js runtime.
   No base directory is needed: the app is at the repository root.
3. Deploy. No environment variables are required: visitors enter their own key, or use the Example tab.

**Do not set `TYPESAFE_API_KEY` on a public site** unless you also set `ALLOW_SERVER_KEY=true` on purpose:
with both set, every visitor would be using your key.

## Python script

```
cd python
pip install httpx
set TYPESAFE_API_KEY=your_key                        # Windows (export ... on macOS/Linux)
python jev_spam_demo.py -n 50                        # 50 spam + 50 ham: metrics, CSV and an HTML report
python jev_spam_demo.py --report results.csv         # rebuild the HTML report without calling JEV
```

## References

- TypeSafe docs: https://docs.typesafe.ai (question types: `/primitives/noul`, `/primitives/choice`, `/primitives/score`)
- Dataset: Metsis, Androutsopoulos & Paliouras (2006), *Spam Filtering with Naive Bayes – Which Naive Bayes?*, via Hugging Face `SetFit/enron_spam`
