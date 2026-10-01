import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API routes read these files at runtime; make sure they ship with the serverless functions (Netlify).
  outputFileTracingIncludes: {
    "/api/sample": ["./data/enron_spam_test.jsonl"],
    "/api/example": ["./data/example-run.json"],
  },
  // Project guidance lives in the root CLAUDE.md; don't let `next dev` generate its own AGENTS.md/CLAUDE.md.
  agentRules: false,
};

export default nextConfig;
