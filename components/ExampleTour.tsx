"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Button, ButtonBase, Card, CardContent, Collapse, IconButton, LinearProgress, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import MailOutlineIcon from "@mui/icons-material/MailOutlined";
import ReplayIcon from "@mui/icons-material/Replay";
import type { Label, Row, ScoreQuestion } from "@/lib/config";
import { RADIUS } from "@/app/theme";
import AnswerCards from "./AnswerCards";
import CallInspector, { tint } from "./CallInspector";
import { SERIES_VAR } from "./Charts";
import { LabelChip } from "./ResultsView";

const NAME: Record<Label, string> = { spam: "Spam", ham: "Not spam" };

/** Coloured verdict pill: spam (orange) or not spam (blue). */
function Verdict({ label }: { label: Label }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, px: 1.25, height: 28, borderRadius: `${RADIUS.control}px`,
      fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", bgcolor: tint(SERIES_VAR[label], 12) }}>
      <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: SERIES_VAR[label] }} />{NAME[label]}
    </Box>
  );
}

/**
 * The Example tab's sample emails as a short tour: an inbox list, a reading pane, JEV's three answers
 * and the exact request/response for the selected email. ← / → step through the emails.
 */
export default function ExampleTour({ samples, threshold, scoreQuestion }: {
  samples: Row[]; threshold: number; scoreQuestion: ScoreQuestion | null;
}) {
  const [idx, setIdx] = useState(0);
  const [showCall, setShowCall] = useState(true);
  const stripRef = useRef<HTMLDivElement>(null);

  const n = samples.length;
  const i = Math.min(idx, n - 1);
  const s = samples[i];
  const jevOf = (r: Row): Label => (r.p_spam >= threshold ? "spam" : "ham");
  const hasTruth = (r: Row) => r.message_id >= 0; // emails typed into "Try an email" have no dataset label

  const go = (d: number) => setIdx((v) => Math.max(0, Math.min(n - 1, Math.min(v, n - 1) + d)));

  // ← / → step through the emails
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // keep the active email visible in the phone strip (horizontal scroll only, never moves the page)
  useEffect(() => {
    const strip = stripRef.current, item = strip?.children[i] as HTMLElement | undefined;
    if (!strip || !item || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: item.offsetLeft - strip.offsetLeft - 16, behavior: "smooth" });
  }, [i]);

  if (!s) return null;
  const jevSays = jevOf(s);

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1">Sample emails</Typography>
          <Typography variant="body2" color="text.secondary">
            Pick an email to see JEV&apos;s three answers and the exact request and response. Use ← / → to step through.
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={((i + 1) / n) * 100} sx={{ height: 4, mb: 2.5 }} aria-label={`Email ${i + 1} of ${n}`} />

        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "280px minmax(0, 1fr)" } }}>
          {/* inbox: vertical list on desktop, swipeable strip on phones */}
          <Box ref={stripRef} role="tablist" aria-label="Sample emails" sx={{ display: "flex", flexDirection: { xs: "row", md: "column" }, gap: 1,
            overflowX: { xs: "auto", md: "visible" }, mx: { xs: -2, md: 0 }, px: { xs: 2, md: 0 }, pb: { xs: 0.5, md: 0 },
            scrollSnapType: { xs: "x mandatory", md: "none" }, "&::-webkit-scrollbar": { display: "none" } }}>
            {samples.map((r, k) => {
              const active = k === i;
              return (
                <ButtonBase key={k} role="tab" aria-selected={active} onClick={() => setIdx(k)}
                  sx={{ display: "block", textAlign: "left", flex: { xs: "0 0 220px", md: "none" }, minWidth: 0, width: { xs: 220, md: "auto" },
                    scrollSnapAlign: "start", p: 1.5, borderRadius: `${RADIUS.panel}px`, transition: "background-color .15s, box-shadow .15s",
                    bgcolor: active ? "background.paper" : "action.hover",
                    boxShadow: (t) => active ? `0 0 0 1.5px ${t.vars?.palette.primary.main}` : "none",
                    "&:hover": { bgcolor: active ? "background.paper" : "action.selected" } }}>
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.25 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{k + 1}</Typography>
                    <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: active ? 600 : 500 }}>{r.subject || "(no subject)"}</Typography>
                    <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", flex: "none", bgcolor: SERIES_VAR[jevOf(r)] }} title={`JEV: ${NAME[jevOf(r)]}`} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">{r.body.replace(/\s+/g, " ").slice(0, 80)}</Typography>
                </ButtonBase>
              );
            })}
          </Box>

          {/* reading pane */}
          <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ p: { xs: 2, md: 2.5 }, borderRadius: `${RADIUS.panel}px`, bgcolor: "action.hover" }}>
              <Stack direction="row" sx={{ gap: 1.25, alignItems: "center", mb: 1 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center", flex: "none", bgcolor: "background.paper", color: "text.secondary" }}>
                  <MailOutlineIcon sx={{ fontSize: 18 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Email {i + 1} of {n}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {hasTruth(s) ? "From the Enron-Spam test set" : "Typed into “Try an email”"}
                  </Typography>
                </Box>
                <Stack direction="row" sx={{ flex: "none" }}>
                  <IconButton size="small" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous email"><ArrowBackIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => go(1)} disabled={i === n - 1} aria-label="Next email"><ArrowForwardIcon fontSize="small" /></IconButton>
                </Stack>
              </Stack>
              {/* subject and body as separate fields, like the request JEV receives */}
              <Box sx={{ mt: 1.5, borderRadius: `${RADIUS.control}px`, bgcolor: "background.paper", overflow: "hidden" }}>
                <Box sx={{ px: 1.75, py: 1.25, borderBottom: 1, borderColor: "divider" }}>
                  <Typography variant="overline" color="text.secondary" component="div" sx={{ lineHeight: 1.6 }}>Subject</Typography>
                  <Typography variant="subtitle2" sx={{ lineHeight: 1.35, overflowWrap: "anywhere", color: s.subject ? "text.primary" : "text.disabled" }}>
                    {s.subject || "(no subject)"}
                  </Typography>
                </Box>
                <Box sx={{ px: 1.75, py: 1.25 }}>
                  <Typography variant="overline" color="text.secondary" component="div" sx={{ lineHeight: 1.6 }}>Body</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto", color: "text.secondary", overflowWrap: "anywhere" }}>{s.body}</Typography>
                </Box>
              </Box>
            </Box>

            {/* verdict */}
            <Stack key={i} direction="row" sx={{ gap: { xs: 1.5, sm: 3 }, flexWrap: "wrap", alignItems: "center", p: 2, borderRadius: `${RADIUS.panel}px`,
              bgcolor: tint(SERIES_VAR[jevSays], 7), animation: "tourIn .35s ease both", "@keyframes tourIn": { from: { opacity: 0, transform: "translateY(4px)" } } }}>
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">JEV says · {Math.round(s.p_spam * 100)}% spam</Typography>
                <Stack direction="row" sx={{ gap: 0.75, alignItems: "center" }}>
                  <Verdict label={jevSays} />
                  {hasTruth(s) && (jevSays === s.label
                    ? <CheckCircleIcon sx={{ fontSize: 18 }} color="success" titleAccess="matches the dataset label" />
                    : <CancelIcon sx={{ fontSize: 18 }} color="error" titleAccess="does not match the dataset label" />)}
                </Stack>
              </Stack>
              {hasTruth(s) ? (
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">Dataset label</Typography>
                  <Box sx={{ height: 28, display: "flex", alignItems: "center" }}><LabelChip label={s.label} /></Box>
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 220 }}>Typed in by hand, so there is no dataset label to compare with.</Typography>
              )}
              <Box sx={{ flex: 1 }} />
              {i < n - 1
                ? <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => go(1)}>Next email</Button>
                : <Button variant="outlined" startIcon={<ReplayIcon />} onClick={() => setIdx(0)}>Back to the first</Button>}
            </Stack>
          </Box>
        </Box>

        <Box sx={{ mt: 2.5 }}>
          <AnswerCards result={s} threshold={threshold} scoreQuestion={scoreQuestion} />
        </Box>

        {s.trace && (
          <Box sx={{ mt: 2.5 }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" sx={{ flex: 1 }}>What was sent, and what came back</Typography>
              <Button size="small" color="inherit" onClick={() => setShowCall(!showCall)} sx={{ color: "text.secondary" }}>{showCall ? "Hide" : "Show"}</Button>
            </Stack>
            <Collapse in={showCall}><CallInspector trace={s.trace} /></Collapse>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
