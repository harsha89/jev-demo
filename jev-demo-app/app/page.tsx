"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, AppBar, Box, Button, Card, CardContent, CardHeader, Chip, Collapse, Container, Divider,
  FormControlLabel, Grid, IconButton, InputAdornment, LinearProgress, MenuItem, Paper, Slider, Stack,
  Switch, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField,
  Toolbar, Tooltip as MuiTooltip, Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DownloadIcon from "@mui/icons-material/Download";
import InsightsIcon from "@mui/icons-material/Insights";
import KeyIcon from "@mui/icons-material/Key";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ScienceIcon from "@mui/icons-material/Science";
import StopIcon from "@mui/icons-material/Stop";
import TuneIcon from "@mui/icons-material/Tune";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CloseIcon from "@mui/icons-material/Close";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { Dialog, DialogContent, DialogTitle } from "@mui/material";
import { CATEGORY_QUESTION, DEFAULT_SCORE_QUESTION, JEV_MODEL, type Email, type JevResult, type JevTrace, type Label, type Row, type ScoreQuestion } from "@/lib/config";
import { isSpam, metrics, summariseScore, toCsv } from "@/lib/metrics";
import { ScoreQuestionEditor, ScoreResult } from "@/components/ScoreView";
import SpeedIcon from "@mui/icons-material/Speed";
import {
  CategoryBars, Confidence, Confusion, Histogram, LABELS, Legend, Roc, ScoreByCategory, ScoreLevels, SERIES_VAR, Tooltip,
} from "@/components/Charts";
import CallInspector from "@/components/CallInspector";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { EXAMPLE_KINDS, generateExample, type ExampleKind } from "@/lib/examples";
import { RADIUS } from "./theme";

const CARD = { borderRadius: `${RADIUS.card}px` };
// Tonal (soft-filled) chip so result tags read as status, not as buttons.
const tonal = (c: "primary" | "secondary") => ({
  bgcolor: `rgba(var(--mui-palette-${c}-mainChannel) / 0.12)`, color: `${c}.main`, border: 0,
});

const KEY_STORE = "jev-demo-key";

class JevError extends Error {
  constructor(message: string, public trace?: JevTrace) { super(message); }
}

/** `scoreQuestion`: the rubric to send (null = do not ask a Score question). */
async function classify(key: string, email: { subject: string; body: string }, scoreQuestion: ScoreQuestion | null): Promise<JevResult> {
  const r = await fetch("/api/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { "x-typesafe-key": key } : {}) },
    body: JSON.stringify({ subject: email.subject, body: email.body,
      scoreQuestion: scoreQuestion && { ...scoreQuestion, criteria: scoreQuestion.criteria.filter((c) => c.trim()) } }),
  });
  const data = await r.json();
  if (!r.ok) throw new JevError(data.error || `HTTP ${r.status}`, data.trace);
  return data;
}

const prettyCat = (c: string) => c.replace(/_/g, " ");

const pct = (v: number) => (Number.isNaN(v) ? "–" : `${(v * 100).toFixed(1)}%`);

function LabelChip({ label }: { label: string }) {
  return (
    <Chip size="small" variant="outlined" label={label}
      icon={<Box component="span" className="sw" sx={{ background: SERIES_VAR[label as Label], ml: "8px !important", mr: "-2px !important" }} />} />
  );
}

function SectionCard({ title, subheader, children, action }: { title: string; subheader?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardHeader title={title} subheader={subheader} action={action}
        slotProps={{ title: { variant: "h6" }, subheader: { variant: "body2" } }} sx={{ pb: 0 }} />
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h4" sx={{ my: 0.5 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{hint}</Typography>
      </CardContent>
    </Card>
  );
}

export default function Page() {
  // --- setup
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [remember, setRemember] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [perClass, setPerClass] = useState(25);
  const [seed, setSeed] = useState(42);
  const [concurrency, setConcurrency] = useState(4);

  // --- run
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const stopRef = useRef(false);

  // --- results view
  const [threshold, setThreshold] = useState(0.5);
  const [tab, setTab] = useState(0);
  const [fLabel, setFLabel] = useState("");
  const [fPred, setFPred] = useState("");
  const [fCat, setFCat] = useState("");
  const [fOutcome, setFOutcome] = useState("");

  // --- try your own
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [custom, setCustom] = useState<JevResult | null>(null);
  const [customErr, setCustomErr] = useState("");
  const [customTrace, setCustomTrace] = useState<JevTrace | null>(null);
  const [customBusy, setCustomBusy] = useState(false);
  const [genKind, setGenKind] = useState<ExampleKind | null>(null);
  const [autoClassify, setAutoClassify] = useState(true);

  // --- Score question asked with every email (null = off)
  const [scoreQ, setScoreQ] = useState<ScoreQuestion | null>(DEFAULT_SCORE_QUESTION);

  // --- request/response inspection
  const [lastCall, setLastCall] = useState<{ label: string; trace: JevTrace } | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);

  useEffect(() => {
    try {
      const k = localStorage.getItem(KEY_STORE);
      if (k) { setKey(k); setRemember(true); }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (remember && key) localStorage.setItem(KEY_STORE, key);
      else localStorage.removeItem(KEY_STORE);
    } catch {}
  }, [remember, key]);

  async function testKey() {
    setKeyStatus(null); setTesting(true);
    try {
      const r = await classify(key, { subject: "Quote for 500 licences", body: "Hi, could you send pricing for 500 seats and your standard contract? Thanks." }, scoreQ);
      setKeyStatus({ ok: true, msg: `Key works. Test email → p_spam ${r.p_spam.toFixed(2)}, category ${prettyCat(r.category)}.` });
      if (r.trace) setLastCall({ label: "Key test", trace: r.trace });
    } catch (e) {
      setKeyStatus({ ok: false, msg: (e as Error).message });
      const t = (e as JevError).trace;
      if (t) setLastCall({ label: "Key test (failed)", trace: t });
    }
    setTesting(false);
  }

  async function run() {
    setRunning(true); setRows([]); setErrors([]); stopRef.current = false;
    let emails: Email[];
    try {
      const res = await fetch(`/api/sample?n=${perClass}&seed=${seed}`);
      emails = (await res.json()).emails;
    } catch (e) {
      setErrors([`Could not load dataset: ${(e as Error).message}`]); setRunning(false); return;
    }
    setTotal(emails.length);
    let next = 0;
    let consecutiveFails = 0;
    const worker = async () => {
      while (!stopRef.current && next < emails.length) {
        const email = emails[next++];
        try {
          const res = await classify(key, email, scoreQ);
          consecutiveFails = 0;
          setRows((prev) => [...prev, { ...email, ...res }]);
          if (res.trace) setLastCall({ label: email.subject || "(no subject)", trace: res.trace });
        } catch (e) {
          const msg = (e as Error).message;
          const t = (e as JevError).trace;
          if (t) setLastCall({ label: `${email.subject || "(no subject)"} (failed)`, trace: t });
          setErrors((prev) => [...prev, `${email.subject.slice(0, 50) || "(no subject)"}: ${msg}`]);
          // stop early on auth problems instead of failing every email
          if (/HTTP 40[13]|No TypeSafe API key/.test(msg) || ++consecutiveFails >= 5) stopRef.current = true;
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    setRunning(false);
  }

  function generate(kind?: ExampleKind) {
    const ex = generateExample(kind);
    setSubject(ex.subject); setBody(ex.body); setGenKind(ex.kind);
    setCustom(null); setCustomErr(""); setCustomTrace(null);
    if (autoClassify) tryOwn(ex.subject, ex.body);
  }

  async function tryOwn(s = subject, b = body) {
    setCustomBusy(true); setCustom(null); setCustomErr(""); setCustomTrace(null);
    try {
      const r = await classify(key, { subject: s, body: b }, scoreQ);
      setCustom(r); setCustomTrace(r.trace ?? null);
    } catch (e) {
      setCustomErr((e as Error).message); setCustomTrace((e as JevError).trace ?? null);
    }
    setCustomBusy(false);
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(rows, threshold)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jev_spam_results_seed${seed}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const m = useMemo(() => metrics(rows, threshold), [rows, threshold]);
  const done = rows.length + errors.length;
  const cats = useMemo(() => Array.from(new Set(rows.map((r) => r.category))).sort(), [rows]);
  const predOf = (r: Row): Label => (isSpam(r, threshold) ? "spam" : "ham");
  const mistakes = rows.filter((r) => predOf(r) !== r.label).sort((a, b) => Math.abs(b.p_spam - threshold) - Math.abs(a.p_spam - threshold));
  const filtered = rows.filter((r) => (!fLabel || r.label === fLabel) && (!fPred || predOf(r) === fPred)
    && (!fCat || r.category === fCat) && (!fOutcome || (predOf(r) === r.label) === (fOutcome === "correct")));
  const nCats = Object.keys(CATEGORY_QUESTION.criteria).length;
  const scoreSummary = useMemo(() => summariseScore(rows), [rows]);

  const resultsTable = (list: Row[]) => (
    <TableContainer sx={{ maxHeight: 560 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" />
            <TableCell>True</TableCell><TableCell>JEV</TableCell>
            <TableCell align="right">p_spam</TableCell><TableCell>Category</TableCell>
            <TableCell align="right">Conf.</TableCell>
            {scoreSummary && <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{scoreSummary.name}</TableCell>}
            <TableCell sx={{ minWidth: 320 }}>Subject / body</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {list.length === 0 && (
            <TableRow><TableCell colSpan={scoreSummary ? 8 : 7}><Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Nothing here.</Typography></TableCell></TableRow>
          )}
          {list.map((r) => {
            const ok = predOf(r) === r.label;
            return (
              <TableRow key={r.message_id} hover onClick={() => setSelected(r)} sx={{ cursor: "pointer" }}>
                <TableCell padding="checkbox" sx={{ pl: 1.5 }}>
                  {ok ? <CheckCircleIcon fontSize="small" color="success" titleAccess="correct" />
                    : <CancelIcon fontSize="small" color="error" titleAccess="wrong" />}
                </TableCell>
                <TableCell><LabelChip label={r.label} /></TableCell>
                <TableCell><LabelChip label={predOf(r)} /></TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{r.p_spam.toFixed(2)}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{prettyCat(r.category)}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{r.category_conf.toFixed(2)}</TableCell>
                {scoreSummary && <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{r.score ? r.score.score.toFixed(2) : "–"}</TableCell>}
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{r.subject || "(no subject)"}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {r.body.slice(0, 260)}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar sx={{ gap: 1.5 }}>
          <MarkEmailReadIcon color="primary" />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>JEV spam &amp; category demo</Typography>
          <Chip size="small" label={JEV_MODEL} variant="outlined" sx={{ display: { xs: "none", sm: "inline-flex" } }} />
        </Toolbar>
        {running && <LinearProgress variant="determinate" value={total ? (done / total) * 100 : 0} sx={{ borderRadius: 0, height: 3 }} />}
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Intro */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" gutterBottom>Spam detection and topic classification with JEV</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 760, mb: 2 }}>
            Public emails from the Enron-Spam corpus are sent to TypeSafe JEV. Each email gets one call that answers
            two questions at once, and the spam answer is scored against the dataset&apos;s ground-truth labels.
          </Typography>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}>
            <Chip label="Email: subject + body" />
            <ArrowForwardIcon fontSize="small" color="action" />
            <Chip color="primary" label="One JEV call" />
            <ArrowForwardIcon fontSize="small" color="action" />
            <Chip variant="outlined" label="Q1 · noul: is it spam? → probability" />
            <Chip variant="outlined" label={`Q2 · choice: which of ${nCats} categories? → label + confidence`} />
            {scoreQ && <Chip variant="outlined" label={`Q3 · score: ${scoreQ.name} on ${scoreQ.criteria.length} levels → score + level probabilities`} />}
          </Stack>
        </Box>

        {/* Setup */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <SectionCard title="1 · TypeSafe API key" subheader="Forwarded by this app's server to api.typesafe.ai, never logged.">
              <Stack spacing={1.5}>
                <TextField fullWidth size="small" label="API key" type={showKey ? "text" : "password"} value={key} autoComplete="off"
                  onChange={(e) => { setKey(e.target.value.trim()); setKeyStatus(null); }}
                  helperText="Leave blank to use the server's TYPESAFE_API_KEY"
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start"><KeyIcon fontSize="small" /></InputAdornment>,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" edge="end" onClick={() => setShowKey(!showKey)} aria-label={showKey ? "Hide key" : "Show key"}>
                            {showKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }} />
                <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                  <FormControlLabel control={<Switch checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
                    label={<Typography variant="body2">Remember in this browser</Typography>} />
                  <Button variant="outlined" onClick={testKey} disabled={running || testing} startIcon={<ScienceIcon />}>
                    {testing ? "Testing…" : "Test key"}
                  </Button>
                </Stack>
                {keyStatus && <Alert severity={keyStatus.ok ? "success" : "error"} sx={{ wordBreak: "break-word" }}>{keyStatus.msg}</Alert>}
              </Stack>
            </SectionCard>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            <SectionCard title="2 · Run on the dataset" subheader="Balanced random sample from the Enron-Spam test split (2,000 emails). Same seed → same emails.">
              <Stack spacing={2}>
                <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap" }}>
                  <TextField size="small" type="number" label="Emails per class" value={perClass} sx={{ width: 150 }}
                    onChange={(e) => setPerClass(Math.max(1, Math.min(500, +e.target.value)))} slotProps={{ htmlInput: { min: 1, max: 500 } }} />
                  <TextField size="small" type="number" label="Seed" value={seed} sx={{ width: 110 }} onChange={(e) => setSeed(+e.target.value)} />
                  <TextField size="small" type="number" label="Parallel calls" value={concurrency} sx={{ width: 130 }}
                    onChange={(e) => setConcurrency(Math.max(1, Math.min(10, +e.target.value)))} slotProps={{ htmlInput: { min: 1, max: 10 } }} />
                </Stack>
                <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
                  {!running
                    ? <Button variant="contained" size="large" startIcon={<PlayArrowIcon />} onClick={run}>Run JEV on {perClass * 2} emails</Button>
                    : <Button variant="outlined" color="error" size="large" startIcon={<StopIcon />} onClick={() => { stopRef.current = true; }}>Stop</Button>}
                  {rows.length > 0 && !running && <Button startIcon={<DownloadIcon />} onClick={downloadCsv}>Download CSV</Button>}
                </Stack>
                {total > 0 && (
                  <Box>
                    <LinearProgress variant="determinate" value={(done / total) * 100} sx={{ mb: 0.75 }} />
                    <Typography variant="caption" color="text.secondary">
                      {rows.length} classified{errors.length ? ` · ${errors.length} failed` : ""} · {done}/{total}{running ? " · running…" : ""}
                    </Typography>
                  </Box>
                )}
                {errors.length > 0 && (
                  <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setShowErrors(!showErrors)}>{showErrors ? "Hide" : "Details"}</Button>}>
                    {errors.length} call{errors.length > 1 ? "s" : ""} failed{rows.length === 0 ? `: ${errors[0].split(": ").slice(1).join(": ")}` : ""}
                    <Collapse in={showErrors}>
                      <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>{errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}</Box>
                    </Collapse>
                  </Alert>
                )}
              </Stack>
            </SectionCard>
          </Grid>
        </Grid>

        <ScoreQuestionEditor value={scoreQ} onChange={setScoreQ} disabled={running} />

        {/* Latest request / response */}
        {lastCall && (
          <Card sx={{ mb: 2 }}>
            <CardHeader avatar={<SwapHorizIcon color="primary" />}
              title={running ? "Live JEV call" : "Latest JEV call"}
              subheader={<>Exactly what this app sent to JEV and what JEV returned · <b>{lastCall.label}</b></>}
              slotProps={{ title: { variant: "h6" }, subheader: { variant: "body2", noWrap: true } }}
              sx={{ pb: 0, "& .MuiCardHeader-content": { minWidth: 0 } }} />
            <CardContent><CallInspector trace={lastCall.trace} /></CardContent>
          </Card>
        )}

        {/* Results */}
        {rows.length === 0 ? (
          <Paper variant="outlined" sx={{ ...CARD, p: 6, textAlign: "center", mb: 2 }}>
            <InsightsIcon sx={{ fontSize: 48 }} color="disabled" />
            <Typography variant="h6" sx={{ mt: 1 }}>{running ? "Waiting for the first answers…" : "Results will appear here"}</Typography>
            <Typography variant="body2" color="text.secondary">Add your key, then run JEV on the dataset to see metrics and charts update live.</Typography>
          </Paper>
        ) : (
          <>
            <Paper variant="outlined" sx={{ ...CARD, px: 2.5, py: 1.5, mb: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0, sm: 3 }} sx={{ alignItems: { sm: "center" } }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 170 }}>
                  <TuneIcon color="action" />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Spam threshold</Typography>
                  <Chip size="small" color="primary" label={threshold.toFixed(2)} />
                </Stack>
                <Slider value={threshold} min={0.05} max={0.95} step={0.01} onChange={(_, v) => setThreshold(v as number)}
                  marks={[{ value: 0.5, label: "0.5" }]} valueLabelDisplay="auto" aria-label="Spam threshold" sx={{ flex: 1 }} />
                <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 220 }}>
                  Trade missed spam against false alarms. Everything below updates.
                </Typography>
              </Stack>
            </Paper>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              {[
                ["Accuracy", pct(m.accuracy), `${m.tp + m.tn} of ${m.n} correct`],
                ["Precision", pct(m.precision), "flagged spam that really is spam"],
                ["Recall", pct(m.recall), "real spam that JEV caught"],
                ["F1 score", m.f1.toFixed(3), "balance of precision and recall"],
                ["ROC-AUC", Number.isNaN(m.auc) ? "–" : m.auc.toFixed(3), "ranking quality, threshold-free"],
              ].map(([l, v, h]) => (
                <Grid key={l} size={{ xs: 6, sm: 4, md: "grow" }}><Stat label={l} value={v} hint={h} /></Grid>
              ))}
            </Grid>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <SectionCard title="Confusion matrix" subheader="JEV's spam call vs the ground-truth label. Shade = share of the row.">
                  <Confusion m={m} />
                </SectionCard>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <SectionCard title="ROC curve" subheader="How well JEV ranks spam above ham at every threshold. Orange dot = current threshold.">
                  <Roc rows={rows} auc={m.auc} threshold={threshold} />
                </SectionCard>
              </Grid>
              <Grid size={12}>
                <SectionCard title="How confident is JEV?" subheader="JEV's spam probability split by the true label. Good separation = ham on the left, spam on the right.">
                  <Legend /><Histogram rows={rows} threshold={threshold} />
                </SectionCard>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <SectionCard title="What JEV thinks each email is about" subheader="Category answer split by the true label. No topic ground truth: this shows whether categories make sense.">
                  <Legend /><CategoryBars rows={rows} />
                </SectionCard>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <SectionCard title="Category confidence" subheader="Mean JEV confidence per category (dot) and min–max range (line).">
                  <Confidence rows={rows} />
                </SectionCard>
              </Grid>
            </Grid>

            {scoreSummary && (
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <SectionCard title={`Score: ${scoreSummary.name} per level`}
                    subheader={`JEV's score rounded to the nearest of ${scoreSummary.levels} levels, split by the true label. Mean ${scoreSummary.mean.toFixed(2)} · ham ${scoreSummary.meanHam?.toFixed(2) ?? "–"} · spam ${scoreSummary.meanSpam?.toFixed(2) ?? "–"} · mean confidence ${scoreSummary.meanConfidence.toFixed(2)}`}
                    action={<MuiTooltip title="ROC-AUC of the score against the true spam label. 0.5 = no relation; below 0.5 = spam scores lower.">
                      <Chip size="small" icon={<SpeedIcon />} label={`AUC vs spam ${Number.isNaN(scoreSummary.auc) ? "–" : scoreSummary.auc.toFixed(2)}`} sx={{ mt: 1, mr: 1 }} />
                    </MuiTooltip>}>
                    <Legend /><ScoreLevels summary={scoreSummary} />
                  </SectionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <SectionCard title={`Score: ${scoreSummary.name} by category`} subheader="Mean score per JEV category (dot) and min–max range (line). Hover the scale for level descriptions.">
                    <ScoreByCategory rows={rows} levels={scoreSummary.levels} legend={scoreSummary.legend} />
                  </SectionCard>
                </Grid>
              </Grid>
            )}

            <Card sx={{ mb: 2 }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}>
                <Tab label={`Misclassified (${mistakes.length})`} />
                <Tab label={`All results (${rows.length})`} />
              </Tabs>
              {tab === 0 && (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ px: 2, pt: 1.5, pb: 1 }}>
                    Most confident mistakes first. Enron-Spam labels are not perfect, so some of these may be JEV being right.
                    Click any row to see JEV&apos;s request and response.
                  </Typography>
                  {resultsTable(mistakes)}
                </>
              )}
              {tab === 1 && (
                <>
                  <Stack direction="row" sx={{ px: 2, py: 1.5, gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
                    {([["True", fLabel, setFLabel, LABELS], ["JEV", fPred, setFPred, LABELS], ["Category", fCat, setFCat, cats],
                      ["Outcome", fOutcome, setFOutcome, ["correct", "wrong"]]] as [string, string, (v: string) => void, string[]][])
                      .map(([lbl, val, set, opts]) => (
                        <TextField key={lbl} select size="small" label={lbl} value={val} onChange={(e) => set(e.target.value)} sx={{ minWidth: lbl === "Category" ? 200 : 120 }}>
                          <MenuItem value="">All</MenuItem>
                          {opts.map((o) => <MenuItem key={o} value={o}>{o.replace(/_/g, " ")}</MenuItem>)}
                        </TextField>
                      ))}
                    <Typography variant="caption" color="text.secondary">{filtered.length} shown · click a row to inspect the JEV call</Typography>
                  </Stack>
                  {resultsTable(filtered)}
                </>
              )}
            </Card>
          </>
        )}

        {/* Try your own */}
        <SectionCard title="Try your own email" subheader="Paste any email, or generate a realistic example, and see JEV's two answers live.">
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover", borderColor: "transparent" }}>
              <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                <Typography variant="body2" sx={{ fontWeight: 500, mr: 0.5 }}>Generate an example:</Typography>
                <Chip icon={<AutoAwesomeIcon />} label="Surprise me" color="primary" onClick={() => generate()} disabled={customBusy} />
                {EXAMPLE_KINDS.map((k) => (
                  <Chip key={k} label={prettyCat(k)} variant="outlined" onClick={() => generate(k)} disabled={customBusy}
                    color={k === "spam" ? "secondary" : "default"} />
                ))}
                <Box sx={{ flexGrow: 1 }} />
                <FormControlLabel sx={{ mr: 0 }} control={<Switch size="small" checked={autoClassify} onChange={(e) => setAutoClassify(e.target.checked)} />}
                  label={<Typography variant="body2">Classify automatically</Typography>} />
              </Stack>
            </Paper>
            <TextField size="small" label="Subject" value={subject} onChange={(e) => { setSubject(e.target.value); setGenKind(null); }} placeholder="e.g. URGENT: verify your account" />
            <TextField label="Body" value={body} onChange={(e) => { setBody(e.target.value); setGenKind(null); }} placeholder="Paste the email body…" multiline minRows={3} />
            <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="contained" onClick={() => tryOwn()} disabled={customBusy || (!subject && !body)} startIcon={<MarkEmailReadIcon />}>
                {customBusy ? "Asking JEV…" : "Classify"}
              </Button>
              {custom && (
                <>
                  <Divider orientation="vertical" flexItem />
                  <MuiTooltip title={`p_spam ${custom.p_spam.toFixed(3)} vs threshold ${threshold.toFixed(2)}`}>
                    <Chip sx={tonal(custom.p_spam >= threshold ? "secondary" : "primary")}
                      label={`${custom.p_spam >= threshold ? "Spam" : "Not spam"} · p_spam ${custom.p_spam.toFixed(2)}`} />
                  </MuiTooltip>
                  <Chip variant="outlined" label={`Category: ${prettyCat(custom.category)} · confidence ${custom.category_conf.toFixed(2)}`} />
                </>
              )}
              {genKind && (() => {
                const match = !custom ? null : genKind === "spam" ? custom.p_spam >= threshold
                  : custom.p_spam < threshold && custom.category === genKind;
                return (
                  <MuiTooltip title="The template this example was generated from. Compare it with JEV's answer.">
                    <Chip size="small" variant="outlined" sx={{ ml: "auto" }}
                      icon={match === null ? <AutoAwesomeIcon /> : match ? <CheckCircleIcon color="success" /> : <CancelIcon color="error" />}
                      label={`Generated as: ${prettyCat(genKind)}`} />
                  </MuiTooltip>
                );
              })()}
            </Stack>
            {custom?.score && <ScoreResult answer={custom.score} />}
            {customErr && <Alert severity="error">{customErr}</Alert>}
            {customTrace && <CallInspector trace={customTrace} />}
          </Stack>
        </SectionCard>

        {/* Row detail: email + JEV request/response side by side */}
        <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="lg" fullWidth scroll="paper">
          {selected && (
            <>
              <DialogTitle sx={{ pr: 7 }}>
                {selected.subject || "(no subject)"}
                <IconButton aria-label="Close" onClick={() => setSelected(null)} sx={{ position: "absolute", right: 12, top: 12 }}><CloseIcon /></IconButton>
                <Stack direction="row" sx={{ gap: 1, mt: 1, flexWrap: "wrap", alignItems: "center" }}>
                  <Typography variant="body2" color="text.secondary">True label</Typography><LabelChip label={selected.label} />
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>JEV</Typography><LabelChip label={predOf(selected)} />
                  <Chip size="small" label={`p_spam ${selected.p_spam.toFixed(2)}`} />
                  <Chip size="small" color="primary" variant="outlined" label={`Category: ${prettyCat(selected.category)} · ${selected.category_conf.toFixed(2)}`} />
                </Stack>
              </DialogTitle>
              <DialogContent dividers>
                {selected.score && <Box sx={{ mb: 2 }}><ScoreResult answer={selected.score} dense /></Box>}
                {selected.trace
                  ? <CallInspector trace={selected.trace} />
                  : <Typography color="text.secondary">No request/response recorded for this email.</Typography>}
              </DialogContent>
            </>
          )}
        </Dialog>

        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 3, textAlign: "center" }}>
          Dataset: Enron-Spam (Metsis et al., 2006) via Hugging Face SetFit/enron_spam · Model: TypeSafe {JEV_MODEL}
        </Typography>
      </Container>
      <Tooltip />
    </Box>
  );
}
