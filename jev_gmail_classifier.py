"""
Quick Gmail email classifier using Jev (TypeSafe AI System One decision model).

For each email, ONE Jev call asks two questions at once:
  1. Noul (binary)  -> probability the email needs action/reply from you
  2. Choice         -> which category the email belongs to

Setup (once):
  pip install google-api-python-client google-auth-oauthlib httpx
  set TYPESAFE_API_KEY=your_key            (Windows)   | export TYPESAFE_API_KEY=... (mac/linux)
  Put your Google OAuth "Desktop app" client file next to this script as credentials.json
  (Google Cloud Console > APIs & Services > enable Gmail API > Credentials > OAuth client ID > Desktop app)

Run:
  python jev_gmail_classifier.py                         # last 20 inbox emails, prints + saves CSV
  python jev_gmail_classifier.py -n 50 -q "is:unread"    # any Gmail search query
  python jev_gmail_classifier.py --label                 # also apply Gmail labels (Jev/<category>, Jev/Action)
"""

import argparse
import base64
import csv
import html
import os
import re
import sys
from datetime import datetime

import httpx
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# ----------------------------------------------------------------------------
# Config: edit the binary question and the categories to suit your inbox
# ----------------------------------------------------------------------------
JEV_URL = "https://api.typesafe.ai/v1/systemone"
JEV_MODEL = "jev-latest"

BINARY_QUESTION = {
    "type": "noul",
    "instructions": "Does this email require a personal reply or a concrete action from the recipient?",
    "criteria": {
        "true": "A real person or system is asking the recipient to reply, decide, approve, submit, attend or fix something.",
        "false": "Informational only: newsletters, notifications, receipts, FYI messages, marketing, automated alerts.",
    },
}

CATEGORY_QUESTION = {
    "type": "choice",
    "instructions": "Which category best describes this email? Pick the single most specific fit.",
    "criteria": {
        "teaching": "Students, subjects, assessments, grading, LMS, timetables, course coordination",
        "research": "Papers, reviews, journals, conferences, grants, collaborators, HDR supervision",
        "admin": "University or HR administration, policies, forms, IT, compliance, approvals",
        "meetings": "Meeting invites, scheduling, calendar changes, agendas",
        "business": "Clients, consulting, company or startup matters, partnerships, sales",
        "finance": "Invoices, payments, receipts, reimbursements, banking, subscriptions",
        "newsletter": "Newsletters, digests, announcements, marketing, promotions",
        "personal": "Friends, family, personal errands, travel, bookings",
        "spam": "Unsolicited, suspicious, phishing or irrelevant bulk email",
    },
}

ACTION_THRESHOLD = 0.5
MAX_BODY_CHARS = 4000
SCOPES_READ = ["https://www.googleapis.com/auth/gmail.readonly"]
SCOPES_MODIFY = ["https://www.googleapis.com/auth/gmail.modify"]


# ----------------------------------------------------------------------------
# Gmail
# ----------------------------------------------------------------------------
def gmail_service(write: bool):
    scopes = SCOPES_MODIFY if write else SCOPES_READ
    token_file = "token_modify.json" if write else "token_read.json"
    creds = None
    if os.path.exists(token_file):
        creds = Credentials.from_authorized_user_file(token_file, scopes)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists("credentials.json"):
                sys.exit("credentials.json not found. See setup notes at the top of this file.")
            creds = InstalledAppFlow.from_client_secrets_file("credentials.json", scopes).run_local_server(port=0)
        with open(token_file, "w") as f:
            f.write(creds.to_json())
    return build("gmail", "v1", credentials=creds)


def _decode(data: str) -> str:
    return base64.urlsafe_b64decode(data.encode()).decode("utf-8", errors="replace")


def _extract_body(payload) -> str:
    """Prefer text/plain; fall back to stripped text/html."""
    plain, htm = [], []

    def walk(part):
        mime = part.get("mimeType", "")
        data = part.get("body", {}).get("data")
        if data and mime == "text/plain":
            plain.append(_decode(data))
        elif data and mime == "text/html":
            htm.append(_decode(data))
        for p in part.get("parts", []) or []:
            walk(p)

    walk(payload)
    if plain:
        text = "\n".join(plain)
    else:
        text = re.sub(r"<(script|style).*?</\1>", " ", "\n".join(htm), flags=re.S | re.I)
        text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    return re.sub(r"\s+", " ", text).strip()


def fetch_emails(svc, query: str, n: int):
    ids, token = [], None
    while len(ids) < n:
        resp = svc.users().messages().list(
            userId="me", q=query, maxResults=min(100, n - len(ids)), pageToken=token
        ).execute()
        ids += [m["id"] for m in resp.get("messages", [])]
        token = resp.get("nextPageToken")
        if not token:
            break
    for mid in ids:
        msg = svc.users().messages().get(userId="me", id=mid, format="full").execute()
        headers = {h["name"].lower(): h["value"] for h in msg["payload"].get("headers", [])}
        yield {
            "id": mid,
            "from": headers.get("from", ""),
            "subject": headers.get("subject", "(no subject)"),
            "date": headers.get("date", ""),
            "body": _extract_body(msg["payload"]) or msg.get("snippet", ""),
        }


# ----------------------------------------------------------------------------
# Jev
# ----------------------------------------------------------------------------
def classify(client: httpx.Client, email: dict) -> dict:
    state = {
        "from": email["from"],
        "subject": email["subject"],
        "body": email["body"][:MAX_BODY_CHARS],
    }
    payload = {
        "model": JEV_MODEL,
        "state": state,
        "questions": {"needs_action": BINARY_QUESTION, "category": CATEGORY_QUESTION},
    }
    r = client.post(JEV_URL, json=payload)
    if r.status_code != 200:
        raise RuntimeError(f"Jev HTTP {r.status_code}: {r.text[:300]}")
    answers = r.json()["answers"]
    p_action = float(answers["needs_action"]["noul"])
    cat = answers["category"]
    return {
        "needs_action": p_action >= ACTION_THRESHOLD,
        "p_action": round(p_action, 3),
        "category": cat["choice"],
        "category_conf": round(float(cat.get("confidence", 0)), 3),
    }


# ----------------------------------------------------------------------------
# Optional: apply Gmail labels
# ----------------------------------------------------------------------------
def label_ids(svc, names):
    existing = {l["name"]: l["id"] for l in svc.users().labels().list(userId="me").execute()["labels"]}
    out = {}
    for name in names:
        if name not in existing:
            existing[name] = svc.users().labels().create(
                userId="me", body={"name": name, "labelListVisibility": "labelShow", "messageListVisibility": "show"}
            ).execute()["id"]
        out[name] = existing[name]
    return out


def main():
    ap = argparse.ArgumentParser(description="Classify Gmail emails with Jev (binary + category).")
    ap.add_argument("-q", "--query", default="in:inbox", help='Gmail search query, e.g. "is:unread newer_than:7d"')
    ap.add_argument("-n", "--num", type=int, default=20, help="Number of emails to classify")
    ap.add_argument("--label", action="store_true", help="Apply Gmail labels Jev/<category> and Jev/Action")
    ap.add_argument("-o", "--out", default=None, help="CSV output path")
    args = ap.parse_args()

    key = os.environ.get("TYPESAFE_API_KEY")
    if not key:
        sys.exit("Set TYPESAFE_API_KEY first.")

    svc = gmail_service(write=args.label)
    labels = {}
    if args.label:
        names = [f"Jev/{c}" for c in CATEGORY_QUESTION["criteria"]] + ["Jev/Action"]
        labels = label_ids(svc, names)

    out = args.out or f"jev_classified_{datetime.now():%Y%m%d_%H%M}.csv"
    rows = []
    with httpx.Client(timeout=60, headers={"Authorization": f"Bearer {key}"}) as jev:
        for i, email in enumerate(fetch_emails(svc, args.query, args.num), 1):
            try:
                res = classify(jev, email)
            except Exception as e:  # keep going on a single failure
                print(f"[{i}] ERROR {email['subject'][:60]!r}: {e}")
                continue
            row = {**{k: email[k] for k in ("id", "date", "from", "subject")}, **res}
            rows.append(row)
            flag = "ACTION" if res["needs_action"] else "  -   "
            print(f"[{i:>3}] {flag} {res['p_action']:.2f} | {res['category']:<10} {res['category_conf']:.2f} | {email['subject'][:70]}")

            if args.label:
                add = [labels[f"Jev/{res['category']}"]] + ([labels["Jev/Action"]] if res["needs_action"] else [])
                svc.users().messages().modify(userId="me", id=email["id"], body={"addLabelIds": add}).execute()

    if rows:
        with open(out, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        n_act = sum(r["needs_action"] for r in rows)
        print(f"\n{len(rows)} emails classified, {n_act} need action. Saved to {out}")


if __name__ == "__main__":
    main()
