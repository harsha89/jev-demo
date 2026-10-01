# JEV email classification demo

A showcase of **JEV**, TypeSafe AI's System One decision model, on the public
[Enron-Spam](https://huggingface.co/datasets/SetFit/enron_spam) dataset. Each email gets **one JEV call** that asks
all three JEV question types at once:

| Question | JEV type | Returns |
|---|---|---|
| Is this email spam? | **Noul** | probability 0–1 (scored against the dataset's spam labels) |
| Which category? (marketing, finance, sales, customer support, other) | **Choice** | category + confidence |
| How urgent is it? (5-level rubric, editable) | **Score** | fractional score + probability per level |

## Web app (`jev-demo-app/`)

Next.js 16 + Material UI. Enter your TypeSafe key, run JEV on a sample, and see live metrics and charts, the
request/response for every call, and a "Try your own email" panel with an example generator.

```
cd jev-demo-app
npm install
npm run dev        # http://localhost:3000
```

The key is sent only to the app's own server route, which forwards it to `api.typesafe.ai`. It is never logged or stored.
You can also leave the box blank and set `TYPESAFE_API_KEY` in `jev-demo-app/.env.local`.

## Python script

```
pip install httpx
set TYPESAFE_API_KEY=your_key                        # Windows (export ... on macOS/Linux)
python jev_spam_demo.py -n 50                        # 50 spam + 50 ham: metrics, CSV and an HTML report
python jev_spam_demo.py --report results.csv         # rebuild the HTML report without calling JEV
```

`jev_gmail_classifier.py` applies the same idea to your own Gmail inbox (see its docstring for setup).

## References

- TypeSafe docs: https://docs.typesafe.ai (question types: `/primitives/noul`, `/primitives/choice`, `/primitives/score`)
- Dataset: Metsis, Androutsopoulos & Paliouras (2006), *Spam Filtering with Naive Bayes – Which Naive Bayes?*, via Hugging Face `SetFit/enron_spam`
