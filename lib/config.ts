// Mirrors jev_spam_demo.py so the web app and the Python script ask JEV the same questions.
export const JEV_URL = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-latest";
export const MAX_BODY_CHARS = 4000;

export const SPAM_QUESTION = {
  type: "noul",
  instructions: "Is this email spam?",
  criteria: {
    true:
      "Unsolicited bulk or commercial email: promotions, pharmacy, stock tips, loans, adult content, " +
      "software deals, phishing, scams, or messages sent to many recipients without a prior relationship.",
    false:
      "Legitimate email the recipient would expect: colleagues, business partners, internal " +
      "announcements, newsletters or notifications they subscribed to, personal correspondence.",
  },
};

export const CATEGORY_QUESTION = {
  type: "choice",
  instructions: "Which category best describes the topic of this email? Pick the single most specific fit.",
  criteria: {
    marketing: "Promotions, advertising, newsletters, campaigns, product announcements, offers and discounts",
    finance: "Invoices, payments, budgets, accounting, banking, investments, trading, financial reports",
    sales: "Deals, quotes, pricing, contracts, prospects, purchase orders, partnerships, business development",
    customer_support: "Help or support requests, account or technical issues, complaints, service follow-ups, questions",
    other: "Anything that does not clearly fit marketing, finance, sales or customer support: internal updates, meetings, HR, legal, personal or social messages",
  } as Record<string, string>,
};

/** Score question: JEV places the email on an ordered rubric (2–10 levels, low → high) and returns a fractional score. */
export type ScoreQuestion = { name: string; instructions: string; criteria: string[] };

export const DEFAULT_SCORE_QUESTION: ScoreQuestion = {
  name: "urgency",
  instructions: "How urgently does this email need a response or action from the recipient?",
  criteria: [
    "No action needed: informational, automated, promotional or spam",
    "Low: can wait a week or more",
    "Normal: respond within a few days",
    "High: needs attention within 24 hours",
    "Critical: needs immediate action (outage, security issue, deadline today)",
  ],
};

export const SCORE_LEVELS = { min: 2, max: 10 };

/** Valid question name for the request: lowercase letters, digits and underscores. */
export const scoreName = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "score";

export type Label = "spam" | "ham";

export type Email = { message_id: number; subject: string; body: string; label: Label };

/** Exactly what went to JEV and what came back (key masked). */
export type JevTrace = {
  request: { method: string; url: string; headers: Record<string, string>; body: unknown };
  response: { status: number; latency_ms: number; body: unknown };
};

/** JEV's answer to the Score question. Levels are numbered 0..n-1; `probabilities`/`legend` are keyed by level number. */
export type ScoreAnswer = {
  name: string; score: number; confidence: number; levels: number;
  probabilities: Record<string, number>; legend: Record<string, string>;
};

export type JevResult = {
  p_spam: number; category: string; category_conf: number;
  /** Choice probability for every category option. */
  category_probs?: Record<string, number>;
  score?: ScoreAnswer; trace?: JevTrace;
};

export type Row = Email & JevResult;

/**
 * A saved run shown on the Example tab (no API key needed). Stored in data/example-run.json.
 * "illustrative" = placeholder data that did not come from JEV; "recorded" = saved from a real run.
 */
export type ExampleRun = {
  source: "illustrative" | "recorded";
  recordedAt: string;
  model: string;
  note?: string;
  scoreQuestion: ScoreQuestion | null;
  /** A few emails shown with answer cards + request/response. */
  samples: Row[];
  /** The dataset run behind the charts. */
  rows: Row[];
};
