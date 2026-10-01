"use client";

import { useState } from "react";
import { Box, Chip, Grid, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import CallMadeIcon from "@mui/icons-material/CallMade";
import CallReceivedIcon from "@mui/icons-material/CallReceived";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import type { JevTrace } from "@/lib/config";

// Minimal JSON syntax colouring: keys, strings, numbers, booleans/null.
const TOKEN = /("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;

function JsonCode({ value }: { value: unknown }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const out: React.ReactNode[] = [];
  let last = 0, i = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const cls = m[1] ? "j-key" : m[2] ? "j-str" : m[3] ? "j-num" : "j-lit";
    out.push(<span key={i++} className={cls}>{m[0]}</span>);
    last = m.index! + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Tooltip title={done ? "Copied" : "Copy JSON"}>
      <IconButton size="small" aria-label="Copy JSON"
        onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }).catch(() => {}); }}>
        {done ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}

function Panel({ title, icon, meta, value, copy }: { title: string; icon: React.ReactNode; meta: React.ReactNode; value: unknown; copy: string }) {
  return (
    <Paper variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, px: 1.5, py: 1, borderBottom: 1, borderColor: "divider", flexWrap: "wrap" }}>
        {icon}
        <Typography variant="subtitle2">{title}</Typography>
        <Box sx={{ flexGrow: 1, display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>{meta}</Box>
        <CopyButton text={copy} />
      </Stack>
      <Box component="pre" className="json" sx={{ m: 0, p: 1.5, flexGrow: 1, overflow: "auto", maxHeight: 440, fontSize: 12.5, lineHeight: 1.55 }}>
        <JsonCode value={value} />
      </Box>
    </Paper>
  );
}

/** Request sent to JEV (left) and the raw response it returned (right). */
export default function CallInspector({ trace }: { trace: JevTrace }) {
  const { request, response } = trace;
  const ok = response.status >= 200 && response.status < 300;
  const host = (() => { try { return new URL(request.url).host + new URL(request.url).pathname; } catch { return request.url; } })();
  const reqView = { headers: request.headers, body: request.body };
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Panel title="Request" icon={<CallMadeIcon fontSize="small" color="primary" />}
          meta={<><Chip size="small" label={request.method} color="primary" variant="outlined" />
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>{host}</Typography></>}
          value={reqView} copy={JSON.stringify(request.body, null, 2)} />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Panel title="Response" icon={<CallReceivedIcon fontSize="small" color={ok ? "success" : "error"} />}
          meta={<><Chip size="small" label={response.status || "network error"} color={ok ? "success" : "error"} variant="outlined" />
            <Typography variant="caption" color="text.secondary">{response.latency_ms} ms</Typography></>}
          value={response.body} copy={typeof response.body === "string" ? response.body : JSON.stringify(response.body, null, 2)} />
      </Grid>
    </Grid>
  );
}
