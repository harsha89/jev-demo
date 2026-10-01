"use client";

import { useMemo, useState } from "react";
import {
  Box, Card, CardContent, Chip, Grid, MenuItem, Slider, Stack, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { Label, Row } from "@/lib/config";
import { isSpam, metrics, summariseScore } from "@/lib/metrics";
import { CategoryBars, Confidence, Confusion, Histogram, LABELS, Legend, Roc, ScoreByCategory, ScoreLevels, SERIES_VAR } from "./Charts";
import { QTYPES } from "./CallInspector";

const prettyCat = (c: string) => c.replace(/_/g, " ");
const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());
const pct = (v: number) => (Number.isNaN(v) ? "–" : `${(v * 100).toFixed(1)}%`);

/** ham / spam as a coloured dot + text. */
export function LabelChip({ label }: { label: string }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, fontSize: 13, fontWeight: 500 }}>
      <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: SERIES_VAR[label as Label] }} />{label}
    </Box>
  );
}

/** A titled block inside a card: no extra border, just a heading, a caption and the content. */
export function Block({ title, caption, children, action }: { title: string; caption?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" sx={{ alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>{title}</Typography>
          {caption && <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{caption}</Typography>}
        </Box>
        {action}
      </Stack>
      {children}
    </Box>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Box sx={{ px: { xs: 1, md: 2.5 }, py: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{hint}</Typography>
    </Box>
  );
}

/** Tab label with the question-type colour dot. */
const TypeTab = (label: string, type?: keyof typeof QTYPES) => (
  <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
    {type && <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: QTYPES[type].color }} />}
    {label}
  </Stack>
);

/** Results of a dataset run: Spam (noul) · Category (choice) · Score · Emails. Used for live runs and the saved example. */
export default function ResultsView({ rows, threshold, onThreshold, onSelect }: {
  rows: Row[]; threshold: number; onThreshold: (t: number) => void; onSelect: (r: Row) => void;
}) {
  const [section, setSection] = useState<"spam" | "category" | "score" | "emails">("spam");
  const [emailList, setEmailList] = useState<"all" | "wrong">("all");
  const [fLabel, setFLabel] = useState("");
  const [fPred, setFPred] = useState("");
  const [fCat, setFCat] = useState("");

  const m = useMemo(() => metrics(rows, threshold), [rows, threshold]);
  const scoreSummary = useMemo(() => summariseScore(rows), [rows]);
  const cats = useMemo(() => Array.from(new Set(rows.map((r) => r.category))).sort(), [rows]);
  const predOf = (r: Row): Label => (isSpam(r, threshold) ? "spam" : "ham");
  const mistakes = rows.filter((r) => predOf(r) !== r.label).sort((a, b) => Math.abs(b.p_spam - threshold) - Math.abs(a.p_spam - threshold));
  const listed = (emailList === "wrong" ? mistakes : rows).filter((r) => (!fLabel || r.label === fLabel)
    && (!fPred || predOf(r) === fPred) && (!fCat || r.category === fCat));
  const active = section === "score" && !scoreSummary ? "spam" : section;

  return (
    <Card>
      <Tabs value={active} onChange={(_, v) => setSection(v)} variant="scrollable" allowScrollButtonsMobile
        sx={{ px: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Tab value="spam" label={TypeTab("Spam", "noul")} />
        <Tab value="category" label={TypeTab("Category", "choice")} />
        {scoreSummary && <Tab value="score" label={TypeTab(cap(prettyCat(scoreSummary.name)), "score")} />}
        <Tab value="emails" label={TypeTab(`Emails (${rows.length})`)} />
      </Tabs>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        {active === "spam" && (
          <Stack spacing={3}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 2, flexWrap: "wrap" }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>Spam threshold</Typography>
              <Slider value={threshold} min={0.05} max={0.95} step={0.01} onChange={(_, v) => onThreshold(v as number)}
                marks={[{ value: 0.5 }]} valueLabelDisplay="auto" aria-label="Spam threshold" sx={{ flex: "1 1 220px", maxWidth: 420 }} />
              <Chip size="small" color="primary" label={threshold.toFixed(2)} />
              <Typography variant="caption" color="text.secondary">Above this probability JEV&apos;s answer counts as spam.</Typography>
            </Stack>
            <Grid container sx={{ py: 1.5, borderRadius: "12px", bgcolor: "action.hover",
              "& > div:not(:first-of-type)": { borderLeft: { md: 1 }, borderColor: { md: "divider" } } }}>
              {[
                ["Accuracy", pct(m.accuracy), `${m.tp + m.tn} of ${m.n} correct`],
                ["Precision", pct(m.precision), "flagged spam that is spam"],
                ["Recall", pct(m.recall), "spam that JEV caught"],
                ["F1 score", m.f1.toFixed(3), "precision × recall balance"],
                ["ROC-AUC", Number.isNaN(m.auc) ? "–" : m.auc.toFixed(3), "ranking, any threshold"],
              ].map(([l, v, h]) => <Grid key={l} size={{ xs: 6, sm: 4, md: "grow" }}><Stat label={l} value={v} hint={h} /></Grid>)}
            </Grid>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Block title="Confusion matrix" caption="JEV's call vs the dataset's label."><Confusion m={m} /></Block>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Block title="ROC curve" caption="Spam caught vs ham flagged at every threshold."><Roc rows={rows} auc={m.auc} threshold={threshold} /></Block>
              </Grid>
            </Grid>
            <Block title="Spam probability by true label" caption="Good separation: ham on the left, spam on the right.">
              <Legend /><Histogram rows={rows} threshold={threshold} />
            </Block>
          </Stack>
        )}

        {active === "category" && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Block title="Category by true label" caption="The dataset has no category labels, so this shows whether JEV's choices make sense.">
                <Legend /><CategoryBars rows={rows} />
              </Block>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Block title="Confidence per category" caption="Mean (dot) and min–max range (line).">
                <Confidence rows={rows} />
              </Block>
            </Grid>
          </Grid>
        )}

        {active === "score" && scoreSummary && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Block title={`Emails per ${prettyCat(scoreSummary.name)} level`}
                caption={`Score rounded to the nearest level. Mean ${scoreSummary.mean.toFixed(2)} · ham ${scoreSummary.meanHam?.toFixed(2) ?? "–"} · spam ${scoreSummary.meanSpam?.toFixed(2) ?? "–"}`}>
                <Legend /><ScoreLevels summary={scoreSummary} />
              </Block>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Block title={cap(`${prettyCat(scoreSummary.name)} by category`)}
                caption={`Mean (dot) and range (line). Mean confidence ${scoreSummary.meanConfidence.toFixed(2)}.`}>
                <ScoreByCategory rows={rows} levels={scoreSummary.levels} legend={scoreSummary.legend} />
              </Block>
            </Grid>
          </Grid>
        )}

        {active === "emails" && (
          <>
            <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap", alignItems: "center", mb: 1.5 }}>
              <ToggleButtonGroup size="small" exclusive value={emailList} onChange={(_, v) => v && setEmailList(v)}>
                <ToggleButton value="all" sx={{ px: 1.5 }}>All ({rows.length})</ToggleButton>
                <ToggleButton value="wrong" sx={{ px: 1.5 }}>Misclassified ({mistakes.length})</ToggleButton>
              </ToggleButtonGroup>
              {([["True label", fLabel, setFLabel, LABELS], ["JEV says", fPred, setFPred, LABELS], ["Category", fCat, setFCat, cats]] as
                [string, string, (v: string) => void, string[]][]).map(([lbl, val, set, opts]) => (
                <TextField key={lbl} select size="small" label={lbl} value={val} onChange={(e) => set(e.target.value)} sx={{ minWidth: lbl === "Category" ? 170 : 120 }}
                  slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
                  <MenuItem value="">All</MenuItem>
                  {opts.map((o) => <MenuItem key={o} value={o}>{prettyCat(o)}</MenuItem>)}
                </TextField>
              ))}
              <Typography variant="caption" color="text.secondary" sx={{ ml: { md: "auto" } }}>{listed.length} shown · click a row to see JEV&apos;s request and response</Typography>
            </Stack>
            <TableContainer sx={{ maxHeight: 560, border: 1, borderColor: "divider", borderRadius: "12px" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Subject</TableCell>
                    <TableCell>True</TableCell><TableCell>JEV</TableCell>
                    <TableCell align="right">p_spam</TableCell>
                    <TableCell>Category</TableCell>
                    {scoreSummary && <TableCell align="right">{scoreSummary.name}</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {listed.length === 0 && (
                    <TableRow><TableCell colSpan={7}><Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Nothing here.</Typography></TableCell></TableRow>
                  )}
                  {listed.map((r) => {
                    const ok = predOf(r) === r.label;
                    return (
                      <TableRow key={r.message_id} hover onClick={() => onSelect(r)} sx={{ cursor: "pointer" }}>
                        <TableCell padding="checkbox" sx={{ pl: 1.5 }}>
                          {ok ? <CheckCircleIcon fontSize="small" color="success" titleAccess="correct" /> : <CancelIcon fontSize="small" color="error" titleAccess="wrong" />}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 420 }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>{r.subject || "(no subject)"}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap component="div">{r.body.slice(0, 140)}</Typography>
                        </TableCell>
                        <TableCell><LabelChip label={r.label} /></TableCell>
                        <TableCell><LabelChip label={predOf(r)} /></TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{r.p_spam.toFixed(2)}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{prettyCat(r.category)}</TableCell>
                        {scoreSummary && <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{r.score ? r.score.score.toFixed(2) : "–"}</TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
