"use client";

import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, IconButton, LinearProgress, Paper, Stack,
  Switch, TextField, Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SpeedIcon from "@mui/icons-material/Speed";
import { DEFAULT_SCORE_QUESTION, SCORE_LEVELS, scoreName, type ScoreAnswer, type ScoreQuestion } from "@/lib/config";

/**
 * One email's Score answer: the fractional score on the rubric scale, plus JEV's probability for every level.
 * score = Σ level × probability, so it can sit between two levels.
 */
export function ScoreResult({ answer, dense = false }: { answer: ScoreAnswer; dense?: boolean }) {
  const top = Math.max(1, answer.levels - 1);
  const nearest = Math.min(top, Math.max(0, Math.round(answer.score)));
  const levels = Array.from({ length: answer.levels }, (_, i) => i);
  return (
    <Paper variant="outlined" sx={{ p: dense ? 1.5 : 2 }}>
      <Stack direction="row" sx={{ alignItems: "baseline", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
        <SpeedIcon fontSize="small" color="primary" sx={{ alignSelf: "center" }} />
        <Typography variant="subtitle2" sx={{ fontFamily: "monospace" }}>{answer.name}</Typography>
        <Typography variant="h5" sx={{ fontWeight: 500, ml: 0.5 }}>{answer.score.toFixed(2)}</Typography>
        <Typography variant="body2" color="text.secondary">/ {top}</Typography>
        <Chip size="small" variant="outlined" label={`≈ level ${nearest}`} sx={{ ml: 0.5 }} />
        <Typography variant="body2" color="text.secondary" sx={{ ml: "auto" }}>confidence {answer.confidence.toFixed(2)}</Typography>
      </Stack>

      {/* Position on the scale */}
      <Box sx={{ position: "relative", height: 18, mb: 1.5, mx: 0.5 }}>
        <Box sx={{ position: "absolute", top: 8, left: 0, right: 0, height: 2, bgcolor: "divider", borderRadius: 1 }} />
        {levels.map((l) => (
          <Box key={l} sx={{ position: "absolute", top: 4, left: `${(l / top) * 100}%`, width: 2, height: 10, ml: "-1px", bgcolor: "divider", borderRadius: 1 }} />
        ))}
        <Tooltip title={`score ${answer.score.toFixed(3)}`}>
          <Box sx={{ position: "absolute", top: 2, left: `${(Math.min(top, Math.max(0, answer.score)) / top) * 100}%`, width: 14, height: 14, ml: "-7px",
            borderRadius: "50%", bgcolor: "primary.main", border: 2, borderColor: "background.paper" }} />
        </Tooltip>
      </Box>

      <Stack spacing={0.75}>
        {levels.map((l) => {
          const p = Number(answer.probabilities[String(l)] ?? 0);
          return (
            <Stack key={l} direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
              <Typography variant="body2" sx={{ width: 18, textAlign: "right", fontWeight: l === nearest ? 600 : 400, fontVariantNumeric: "tabular-nums" }}>{l}</Typography>
              <Typography variant="body2" sx={{ flex: "1 1 0", minWidth: 0, fontWeight: l === nearest ? 600 : 400 }} noWrap title={answer.legend[String(l)]}>
                {answer.legend[String(l)] ?? ""}
              </Typography>
              <LinearProgress variant="determinate" value={p * 100} sx={{ width: { xs: 70, sm: 140 }, flex: "none" }} />
              <Typography variant="body2" color="text.secondary" sx={{ width: 40, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {Math.round(p * 100)}%
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Paper>
  );
}

/** Editor for the Score question asked with every email. `value === null` means the question is switched off. */
export function ScoreQuestionEditor({ value, onChange, disabled }: {
  value: ScoreQuestion | null; onChange: (q: ScoreQuestion | null) => void; disabled?: boolean;
}) {
  const q = value ?? DEFAULT_SCORE_QUESTION;
  const set = (patch: Partial<ScoreQuestion>) => onChange({ ...q, ...patch });
  const setLevel = (i: number, text: string) => set({ criteria: q.criteria.map((c, j) => (j === i ? text : c)) });
  const valid = q.criteria.filter((c) => c.trim()).length >= SCORE_LEVELS.min;
  return (
    <Accordion disableGutters variant="outlined" sx={{ borderRadius: "16px !important", "&:before": { display: "none" }, mb: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, "& .MuiAccordionSummary-content": { alignItems: "center", gap: 1.5, flexWrap: "wrap", my: 1.5 } }}>
        <SpeedIcon color="primary" />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6">3 · Score question</Typography>
          <Typography variant="body2" color="text.secondary">
            {value ? <>JEV places every email on a {q.criteria.length}-level rubric: <b>{scoreName(q.name)}</b> (0 = lowest, {q.criteria.length - 1} = highest)</> : "Off: only spam and category are asked"}
          </Typography>
        </Box>
        <Box sx={{ ml: "auto" }} onClick={(e) => e.stopPropagation()}>
          <Tooltip title={value ? "Turn the Score question off" : "Turn the Score question on"}>
            <Switch checked={!!value} disabled={disabled} onChange={(e) => onChange(e.target.checked ? q : null)} />
          </Tooltip>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2.5, pb: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField size="small" label="Name" value={q.name} disabled={disabled || !value} sx={{ width: { sm: 200 } }}
              onChange={(e) => set({ name: e.target.value })} helperText={`Sent as "${scoreName(q.name)}"`} />
            <TextField size="small" fullWidth label="Question" value={q.instructions} disabled={disabled || !value}
              onChange={(e) => set({ instructions: e.target.value })} />
          </Stack>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Levels, lowest first ({SCORE_LEVELS.min}–{SCORE_LEVELS.max}). JEV returns a probability for each level and a score
              = Σ level × probability, so the score can fall between two levels.
            </Typography>
            <Stack spacing={1}>
              {q.criteria.map((c, i) => (
                <Stack key={i} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Chip size="small" label={i} sx={{ minWidth: 32 }} />
                  <TextField size="small" fullWidth value={c} placeholder={`Describe level ${i}`} disabled={disabled || !value}
                    onChange={(e) => setLevel(i, e.target.value)} />
                  <IconButton aria-label={`Remove level ${i}`} disabled={disabled || !value || q.criteria.length <= SCORE_LEVELS.min}
                    onClick={() => set({ criteria: q.criteria.filter((_, j) => j !== i) })}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Button startIcon={<AddIcon />} variant="outlined" disabled={disabled || !value || q.criteria.length >= SCORE_LEVELS.max}
              onClick={() => set({ criteria: [...q.criteria, ""] })}>Add level</Button>
            <Button startIcon={<RestartAltIcon />} disabled={disabled || !value} onClick={() => onChange(DEFAULT_SCORE_QUESTION)}>Reset to urgency</Button>
            {!valid && value && <Typography variant="body2" color="error">Needs at least {SCORE_LEVELS.min} non-empty levels.</Typography>}
          </Stack>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
