"use client";

import { Box, Button, Chip, IconButton, Stack, Switch, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { DEFAULT_SCORE_QUESTION, SCORE_LEVELS, scoreName, type ScoreQuestion } from "@/lib/config";

/** Editor for the Score question asked with every email. `value === null` means the question is switched off. */
export function ScoreQuestionEditor({ value, onChange, disabled }: {
  value: ScoreQuestion | null; onChange: (q: ScoreQuestion | null) => void; disabled?: boolean;
}) {
  const q = value ?? DEFAULT_SCORE_QUESTION;
  const off = disabled || !value;
  const set = (patch: Partial<ScoreQuestion>) => onChange({ ...q, ...patch });
  const setLevel = (i: number, text: string) => set({ criteria: q.criteria.map((c, j) => (j === i ? text : c)) });
  const valid = q.criteria.filter((c) => c.trim()).length >= SCORE_LEVELS.min;
  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          JEV places each email on an ordered rubric ({SCORE_LEVELS.min}–{SCORE_LEVELS.max} levels, lowest first) and returns a score
          = Σ level × probability, so it can fall between two levels.
        </Typography>
        <Switch checked={!!value} disabled={disabled} onChange={(e) => onChange(e.target.checked ? q : null)}
          slotProps={{ input: { "aria-label": "Ask the Score question" } }} />
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField size="small" label="Name" value={q.name} disabled={off} sx={{ width: { sm: 180 } }}
          onChange={(e) => set({ name: e.target.value })} helperText={`Sent as "${scoreName(q.name)}"`} />
        <TextField size="small" fullWidth label="Question" value={q.instructions} disabled={off}
          onChange={(e) => set({ instructions: e.target.value })} />
      </Stack>
      <Stack spacing={1}>
        {q.criteria.map((c, i) => (
          <Stack key={i} direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Chip size="small" label={i} sx={{ minWidth: 32 }} />
            <TextField size="small" fullWidth value={c} placeholder={`Describe level ${i}`} disabled={off}
              onChange={(e) => setLevel(i, e.target.value)} />
            <IconButton aria-label={`Remove level ${i}`} disabled={off || q.criteria.length <= SCORE_LEVELS.min}
              onClick={() => set({ criteria: q.criteria.filter((_, j) => j !== i) })}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Button startIcon={<AddIcon />} variant="outlined" disabled={off || q.criteria.length >= SCORE_LEVELS.max}
          onClick={() => set({ criteria: [...q.criteria, ""] })}>Add level</Button>
        <Button startIcon={<RestartAltIcon />} disabled={off} onClick={() => onChange(DEFAULT_SCORE_QUESTION)}>Reset to urgency</Button>
        {!valid && value && <Typography variant="body2" color="error">Needs at least {SCORE_LEVELS.min} non-empty levels.</Typography>}
      </Box>
    </Stack>
  );
}
