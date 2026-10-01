"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, AppBar, Box, Button, Card, CardContent, Chip, Collapse, Container, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControlLabel, Grid, IconButton, InputAdornment, LinearProgress, MenuItem, Paper, Slider,
  Stack, Switch, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField,
  ToggleButton, ToggleButtonGroup, Toolbar, Tooltip as MuiTooltip, Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SaveIcon from "@mui/icons-material/SaveOutlined";
import InsightsIcon from "@mui/icons-material/Insights";
import KeyIcon from "@mui/icons-material/Key";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ScienceIcon from "@mui/icons-material/Science";
import SettingsIcon from "@mui/icons-material/Settings";
import StopIcon from "@mui/icons-material/Stop";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { DEFAULT_SCORE_QUESTION, JEV_MODEL, type Email, type ExampleRun, type JevResult, type JevTrace, type Row, type ScoreQuestion } from "@/lib/config";
import { toCsv } from "@/lib/metrics";
import { EXAMPLE_KINDS, generateExample, type ExampleKind } from "@/lib/examples";
import { Tooltip } from "@/components/Charts";
import ResultsView, { Block, LabelChip } from "@/components/ResultsView";
import CallInspector, { QTYPES, QTypeChip } from "@/components/CallInspector";
import AnswerCards from "@/components/AnswerCards";
import { ScoreQuestionEditor } from "@/components/ScoreView";

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
const isKeyError = (msg: string) => /HTTP 40[13]|No TypeSafe API key/.test(msg);

export default function Page() {
  const [view, setView] = useState<"try" | "dataset" | "example">("example");

  // --- example (saved run, no key needed)
  const [example, setExample] = useState<ExampleRun | null>(null);
  const [exampleErr, setExampleErr] = useState("");
  const [sampleIdx, setSampleIdx] = useState(0);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  // --- settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsHint, setSettingsHint] = useState("");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [remember, setRemember] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [concurrency, setConcurrency] = useState(4);
  const [scoreQ, setScoreQ] = useState<ScoreQuestion | null>(DEFAULT_SCORE_QUESTION);

  // --- try an email
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [custom, setCustom] = useState<JevResult | null>(null);
  const [customErr, setCustomErr] = useState("");
  const [customTrace, setCustomTrace] = useState<JevTrace | null>(null);
  const [customBusy, setCustomBusy] = useState(false);
  const [genKind, setGenKind] = useState<ExampleKind | null>(null);
  const [autoClassify, setAutoClassify] = useState(true);

  // --- dataset run
  const [perClass, setPerClass] = useState(25);
  const [seed, setSeed] = useState(42);
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const stopRef = useRef(false);

  // --- dataset results
  const [threshold, setThreshold] = useState(0.5);
  const [selected, setSelected] = useState<Row | null>(null);

  useEffect(() => {
    try {
      const k = localStorage.getItem(KEY_STORE);
      if (k) { setKey(k); setRemember(true); setView("try"); }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (remember && key) localStorage.setItem(KEY_STORE, key);
      else localStorage.removeItem(KEY_STORE);
    } catch {}
  }, [remember, key]);

  useEffect(() => {
    if (view !== "example" || example) return;
    fetch("/api/example").then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setExample(d);
    }).catch((e) => setExampleErr((e as Error).message));
  }, [view, example]);

  /** Save this run (plus a few sample emails) as the Example tab's data. Local development only. */
  async function saveAsExample() {
    setSaveMsg(null);
    const pick = (f: (r: Row) => boolean) => rows.find((r) => f(r) && !!r.trace);
    const spamOk = pick((r) => r.label === "spam" && r.p_spam >= threshold);
    const hamOk = pick((r) => r.label === "ham" && r.p_spam < threshold);
    const wrong = pick((r) => (r.label === "spam") !== (r.p_spam >= threshold));
    const tried = custom?.trace ? [{ message_id: -1, label: (custom.p_spam >= threshold ? "spam" : "ham") as Row["label"], subject, body, ...custom }] : [];
    const samples = [...tried, spamOk, hamOk, wrong].filter((r): r is Row => !!r);
    try {
      const r = await fetch("/api/example", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: JEV_MODEL, scoreQuestion: scoreQ, samples, rows }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setSaveMsg({ ok: true, msg: `Saved ${d.rows} emails and ${d.samples} samples as the example (data/example-run.json).` });
      setExample(null); setSampleIdx(0);
    } catch (e) { setSaveMsg({ ok: false, msg: (e as Error).message }); }
  }

  function openSettings(hint = "") { setSettingsHint(hint); setSettingsOpen(true); }

  async function testKey() {
    setKeyStatus(null); setTesting(true);
    try {
      await classify(key, { subject: "Quote for 500 licences", body: "Hi, could you send pricing for 500 seats and your standard contract? Thanks." }, scoreQ);
      setKeyStatus({ ok: true, msg: "Key works. JEV answered a test email." });
    } catch (e) {
      setKeyStatus({ ok: false, msg: (e as Error).message });
    }
    setTesting(false);
  }

  async function tryOwn(s = subject, b = body) {
    setCustomBusy(true); setCustom(null); setCustomErr(""); setCustomTrace(null);
    try {
      const r = await classify(key, { subject: s, body: b }, scoreQ);
      setCustom(r); setCustomTrace(r.trace ?? null);
    } catch (e) {
      const msg = (e as Error).message;
      setCustomErr(msg); setCustomTrace((e as JevError).trace ?? null);
      if (isKeyError(msg)) openSettings("JEV needs a valid TypeSafe API key.");
    }
    setCustomBusy(false);
  }

  function generate(kind?: ExampleKind) {
    const ex = generateExample(kind);
    setSubject(ex.subject); setBody(ex.body); setGenKind(ex.kind);
    setCustom(null); setCustomErr(""); setCustomTrace(null);
    if (autoClassify) tryOwn(ex.subject, ex.body);
  }

  async function run() {
    setRunning(true); setRows([]); setErrors([]); setShowErrors(false); stopRef.current = false;
    let emails: Email[];
    try {
      const res = await fetch(`/api/sample?n=${perClass}&seed=${seed}`);
      emails = (await res.json()).emails;
    } catch (e) {
      setErrors([`Could not load dataset: ${(e as Error).message}`]); setRunning(false); return;
    }
    setTotal(emails.length);
    let next = 0, consecutiveFails = 0, keyFailed = false;
    const worker = async () => {
      while (!stopRef.current && next < emails.length) {
        const email = emails[next++];
        try {
          const res = await classify(key, email, scoreQ);
          consecutiveFails = 0;
          setRows((prev) => [...prev, { ...email, ...res }]);
        } catch (e) {
          const msg = (e as Error).message;
          setErrors((prev) => [...prev, `${email.subject.slice(0, 50) || "(no subject)"}: ${msg}`]);
          // stop early on auth problems instead of failing every email
          if (isKeyError(msg)) { keyFailed = true; stopRef.current = true; }
          else if (++consecutiveFails >= 5) stopRef.current = true;
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    setRunning(false);
    if (keyFailed) openSettings("JEV needs a valid TypeSafe API key.");
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(rows, threshold)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jev_results_seed${seed}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const done = rows.length + errors.length;

  // generated example: does JEV agree with the template it came from?
  const genMatch = !genKind || !custom ? null : genKind === "spam" ? custom.p_spam >= threshold
    : custom.p_spam < threshold && custom.category === genKind;

  const keyChip = keyStatus?.ok
    ? <Chip size="small" color="success" variant="outlined" icon={<CheckCircleIcon />} label="Key connected" onClick={() => openSettings()} />
    : key ? <Chip size="small" variant="outlined" icon={<KeyIcon />} label="Key added" onClick={() => openSettings()} />
      : <Chip size="small" color="primary" icon={<KeyIcon />} label="Add API key" onClick={() => openSettings()} />;

  // ------------------------------------------------------------------ views
  const tryView = (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", alignItems: "center", mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>Generate an example</Typography>
            <Chip icon={<AutoAwesomeIcon />} label="Surprise me" color="primary" onClick={() => generate()} disabled={customBusy} />
            {EXAMPLE_KINDS.map((k) => (
              <Chip key={k} label={prettyCat(k)} variant="outlined" onClick={() => generate(k)} disabled={customBusy} />
            ))}
          </Stack>
          <Stack spacing={1.5}>
            <TextField size="small" label="Subject" value={subject} onChange={(e) => { setSubject(e.target.value); setGenKind(null); }}
              placeholder="e.g. URGENT: verify your account" />
            <TextField label="Body" value={body} onChange={(e) => { setBody(e.target.value); setGenKind(null); }}
              placeholder="Paste an email, or generate one above" multiline minRows={4} maxRows={10} />
          </Stack>
          <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap", alignItems: "center", mt: 2 }}>
            <Button variant="contained" size="large" onClick={() => tryOwn()} disabled={customBusy || (!subject && !body)} startIcon={<MarkEmailReadIcon />}>
              {customBusy ? "Asking JEV…" : "Ask JEV"}
            </Button>
            <FormControlLabel control={<Switch size="small" checked={autoClassify} onChange={(e) => setAutoClassify(e.target.checked)} />}
              label={<Typography variant="body2" color="text.secondary">Ask automatically for generated examples</Typography>} />
            {genKind && (
              <MuiTooltip title="The template this example was generated from. Compare it with JEV's answers.">
                <Chip size="small" variant="outlined" sx={{ ml: "auto" }}
                  icon={genMatch === null ? <AutoAwesomeIcon /> : genMatch ? <CheckCircleIcon color="success" /> : <CancelIcon color="error" />}
                  label={`Generated as ${prettyCat(genKind)}`} />
              </MuiTooltip>
            )}
          </Stack>
          {customErr && <Alert severity="error" sx={{ mt: 2 }}>{customErr}</Alert>}
        </CardContent>
      </Card>

      <AnswerCards result={custom} threshold={threshold} scoreQuestion={scoreQ} busy={customBusy} />

      {customTrace && (
        <Card>
          <CardContent>
            <Block title="What was sent, and what came back"
              caption="One HTTP call to JEV. The email is the shared state; each question is answered separately, colour-coded by type.">
              <CallInspector trace={customTrace} />
            </Block>
          </CardContent>
        </Card>
      )}
    </Stack>
  );

  const runBar = (
    <Card>
      <CardContent>
        <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2, alignItems: { md: "center" } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>Enron-Spam test set</Typography>
            <Typography variant="body2" color="text.secondary">A balanced random sample of real emails with known spam labels. Same seed → same emails.</Typography>
          </Box>
          <Stack direction="row" sx={{ gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
            <TextField size="small" type="number" label="Emails per class" value={perClass} sx={{ width: 140 }} disabled={running}
              onChange={(e) => setPerClass(Math.max(1, Math.min(500, +e.target.value)))} slotProps={{ htmlInput: { min: 1, max: 500 } }} />
            <TextField size="small" type="number" label="Seed" value={seed} sx={{ width: 96 }} disabled={running} onChange={(e) => setSeed(+e.target.value)} />
            {!running
              ? <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={run}>Run on {perClass * 2} emails</Button>
              : <Button variant="outlined" color="error" startIcon={<StopIcon />} onClick={() => { stopRef.current = true; }}>Stop</Button>}
            {rows.length > 0 && !running && (
              <MuiTooltip title="Download results as CSV"><IconButton onClick={downloadCsv} aria-label="Download CSV"><DownloadIcon /></IconButton></MuiTooltip>
            )}
            {rows.length > 0 && !running && process.env.NODE_ENV === "development" && (
              <MuiTooltip title="Use this run as the Example tab (saved to data/example-run.json). Local only.">
                <Button variant="outlined" startIcon={<SaveIcon />} onClick={saveAsExample}>Save as example</Button>
              </MuiTooltip>
            )}
          </Stack>
        </Stack>
        {total > 0 && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={(done / total) * 100} />
            <Typography variant="caption" color="text.secondary">
              {rows.length} of {total} classified{errors.length ? ` · ${errors.length} failed` : ""}{running ? " · running…" : ""}
            </Typography>
          </Box>
        )}
        {saveMsg && <Alert severity={saveMsg.ok ? "success" : "error"} sx={{ mt: 1.5 }} onClose={() => setSaveMsg(null)}>{saveMsg.msg}</Alert>}
        {errors.length > 0 && (
          <Alert severity="error" sx={{ mt: 1.5 }}
            action={<Button color="inherit" size="small" onClick={() => setShowErrors(!showErrors)}>{showErrors ? "Hide" : "Details"}</Button>}>
            {errors.length} call{errors.length > 1 ? "s" : ""} failed{rows.length === 0 ? `: ${errors[0].split(": ").slice(1).join(": ")}` : ""}
            <Collapse in={showErrors}><Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>{errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}</Box></Collapse>
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  const datasetView = (
    <Stack spacing={2}>
      {runBar}
      {rows.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center", borderRadius: "16px" }}>
          <InsightsIcon sx={{ fontSize: 44 }} color="disabled" />
          <Typography variant="h6" sx={{ mt: 1 }}>{running ? "Waiting for the first answers…" : "Run JEV to see how it does"}</Typography>
          <Typography variant="body2" color="text.secondary">Results appear here live: spam accuracy, categories and {scoreQ ? prettyCat(scoreQ.name) : "scores"}.</Typography>
        </Paper>
      ) : <ResultsView rows={rows} threshold={threshold} onThreshold={setThreshold} onSelect={setSelected} />}
    </Stack>
  );

  const sample = example?.samples[Math.min(sampleIdx, Math.max(0, (example?.samples.length ?? 1) - 1))];
  const exampleView = !example ? (
    <Paper variant="outlined" sx={{ p: 6, textAlign: "center", borderRadius: "16px" }}>
      <Typography color="text.secondary">{exampleErr ? `Example not available: ${exampleErr}` : "Loading the example…"}</Typography>
    </Paper>
  ) : (
    <Stack spacing={2}>
      {example.source === "illustrative" ? (
        <Alert severity="warning" icon={<InfoOutlinedIcon />}>
          <b>Illustrative example.</b> These answers were generated to show how the demo works. They were not returned by JEV, so the
          numbers say nothing about JEV&apos;s accuracy. Add an API key to ask JEV for real.
        </Alert>
      ) : (
        <Alert severity="info" icon={<InfoOutlinedIcon />}>
          <b>Recorded JEV run</b> · {new Date(example.recordedAt).toLocaleString()} · model {example.model} · {example.rows.length} emails.
          Everything below is exactly what JEV returned. Add an API key to try your own emails.
        </Alert>
      )}

      {example.samples.length > 0 && sample && (
        <Card>
          <CardContent>
            <Block title="Sample emails" caption="Pick an email to see JEV's three answers and the exact request and response.">
              <ToggleButtonGroup exclusive size="small" value={Math.min(sampleIdx, example.samples.length - 1)} onChange={(_, v) => v !== null && setSampleIdx(v)}
                sx={{ flexWrap: "wrap", mb: 2.5, maxWidth: "100%" }}>
                {example.samples.map((r, i) => (
                  <ToggleButton key={i} value={i} sx={{ px: 1.5, maxWidth: 260 }}>
                    <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subject || "(no subject)"}</Box>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: "action.hover", borderColor: "transparent" }}>
                <Stack direction="row" sx={{ gap: 1.5, alignItems: "center", mb: 0.5, flexWrap: "wrap" }}>
                  <Typography variant="subtitle2">{sample.subject || "(no subject)"}</Typography>
                  {sample.message_id >= 0 && <><Typography variant="caption" color="text.secondary">dataset label</Typography><LabelChip label={sample.label} /></>}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto" }}>{sample.body}</Typography>
              </Paper>
              <AnswerCards result={sample} threshold={threshold} scoreQuestion={example.scoreQuestion} />
              {sample.trace && <Box sx={{ mt: 2 }}><CallInspector trace={sample.trace} /></Box>}
            </Block>
          </CardContent>
        </Card>
      )}

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1, mt: 1 }}>Dataset run · {example.rows.length} Enron-Spam emails</Typography>
        <ResultsView rows={example.rows} threshold={threshold} onThreshold={setThreshold} onSelect={setSelected} />
      </Box>
    </Stack>
  );

  // ------------------------------------------------------------------ page
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar sx={{ gap: 1.5 }}>
          <Box sx={{ width: 30, height: 30, borderRadius: "9px", display: "grid", placeItems: "center", color: "#fff",
            background: "linear-gradient(135deg, var(--q-noul), var(--q-choice) 55%, var(--q-score))" }}>
            <MarkEmailReadIcon sx={{ fontSize: 18 }} />
          </Box>
          <Typography sx={{ flexGrow: 1, fontWeight: 650, letterSpacing: "-0.01em" }}>
            JEV <Box component="span" sx={{ color: "text.secondary", fontWeight: 500 }}>email demo</Box>
          </Typography>
          {keyChip}
          <MuiTooltip title="Settings"><IconButton onClick={() => openSettings()} aria-label="Settings"><SettingsIcon /></IconButton></MuiTooltip>
        </Toolbar>
        {running && <LinearProgress variant="determinate" value={total ? (done / total) * 100 : 0} sx={{ borderRadius: 0, height: 3 }} />}
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
        <Box sx={{ mb: 3.5, mt: { md: 1 } }}>
          <Typography variant="overline" color="primary">TypeSafe JEV · System One</Typography>
          <Typography variant="h4" sx={{ mt: 0.5, mb: 1 }}>One email, one JEV call, three answers</Typography>
          <Typography color="text.secondary" sx={{ mb: 2, maxWidth: 640 }}>
            JEV answers typed questions with calibrated probabilities. Each email gets one call that asks all three question types at once.
          </Typography>
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            {([["noul", "Is it spam?"], ["choice", "Which category?"], ["score", scoreQ ? `How much ${prettyCat(scoreQ.name)}? (0–${scoreQ.criteria.length - 1})` : "Off (see Settings)"]] as
              [keyof typeof QTYPES, string][]).map(([t, q]) => (
              <Stack key={t} direction="row" sx={{ alignItems: "center", gap: 1, pl: 0.5, pr: 1.5, py: 0.5, borderRadius: "10px",
                bgcolor: "background.paper", boxShadow: "0 0 0 1px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)" }}>
                <QTypeChip type={t} /><Typography variant="body2" noWrap>{q}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <ToggleButtonGroup exclusive value={view} onChange={(_, v) => v && setView(v)} sx={{ mb: 2.5 }}>
          <ToggleButton value="try" sx={{ px: 2.5 }}>Try an email</ToggleButton>
          <ToggleButton value="dataset" sx={{ px: 2.5 }}>{rows.length ? `Run on dataset · ${rows.length}` : "Run on dataset"}</ToggleButton>
          <ToggleButton value="example" sx={{ px: 2.5 }}>Example · no key needed</ToggleButton>
        </ToggleButtonGroup>

        {view === "try" ? tryView : view === "dataset" ? datasetView : exampleView}

        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 4, textAlign: "center" }}>
          Dataset: Enron-Spam (Metsis et al., 2006) via Hugging Face SetFit/enron_spam · Model: TypeSafe {JEV_MODEL}
        </Typography>
      </Container>

      {/* Settings: API key, Score question, run options */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="md" fullWidth scroll="paper">
        <DialogTitle sx={{ pr: 7 }}>
          Settings
          <IconButton aria-label="Close" onClick={() => setSettingsOpen(false)} sx={{ position: "absolute", right: 12, top: 12 }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            {settingsHint && <Alert severity="info">{settingsHint}</Alert>}
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>TypeSafe API key</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Sent only to this app&apos;s server, which forwards it to api.typesafe.ai. Never logged or stored on the server. No key? The Example tab shows a full run.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
                <TextField fullWidth size="small" label="API key" type={showKey ? "text" : "password"} value={key} autoComplete="off"
                  onChange={(e) => { setKey(e.target.value.trim()); setKeyStatus(null); }}
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
                <Button variant="outlined" onClick={testKey} disabled={running || testing} startIcon={<ScienceIcon />} sx={{ whiteSpace: "nowrap", flexShrink: 0 }}>{testing ? "Testing…" : "Test key"}</Button>
              </Stack>
              <FormControlLabel sx={{ mt: 0.5 }} control={<Switch size="small" checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
                label={<Typography variant="body2">Remember in this browser</Typography>} />
              {keyStatus && <Alert severity={keyStatus.ok ? "success" : "error"} sx={{ mt: 1, wordBreak: "break-word" }}>{keyStatus.msg}</Alert>}
            </Box>
            <Divider />
            <Box>
              <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>Score question</Typography><QTypeChip type="score" />
              </Stack>
              <ScoreQuestionEditor value={scoreQ} onChange={setScoreQ} disabled={running} />
            </Box>
            <Divider />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1 }}>Dataset runs</Typography>
              <TextField size="small" type="number" label="Parallel calls" value={concurrency} sx={{ width: 140 }} disabled={running}
                onChange={(e) => setConcurrency(Math.max(1, Math.min(10, +e.target.value)))} slotProps={{ htmlInput: { min: 1, max: 10 } }}
                helperText="Emails sent to JEV at the same time" />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button variant="contained" onClick={() => setSettingsOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>

      {/* One dataset email: JEV's answers + request/response */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="lg" fullWidth scroll="paper">
        {selected && (
          <>
            <DialogTitle sx={{ pr: 7 }}>
              {selected.subject || "(no subject)"}
              <IconButton aria-label="Close" onClick={() => setSelected(null)} sx={{ position: "absolute", right: 12, top: 12 }}><CloseIcon /></IconButton>
              <Stack direction="row" sx={{ gap: 1, mt: 1, alignItems: "center" }}>
                <Typography variant="body2" color="text.secondary">True label</Typography><LabelChip label={selected.label} />
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <AnswerCards result={selected} threshold={threshold} scoreQuestion={scoreQ} />
                {selected.trace && <CallInspector trace={selected.trace} />}
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>
      <Tooltip />
    </Box>
  );
}
