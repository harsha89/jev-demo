"use client";

import { Box, Card, CardContent, Grid, Skeleton, Stack, Typography } from "@mui/material";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import RuleIcon from "@mui/icons-material/Rule";
import SpeedIcon from "@mui/icons-material/Speed";
import type { JevResult, ScoreQuestion } from "@/lib/config";
import { CATEGORY_QUESTION, SPAM_QUESTION } from "@/lib/config";
import { QTYPES, QTypeChip, tint } from "./CallInspector";
import { SERIES_VAR } from "./Charts";

type QType = keyof typeof QTYPES;
const pretty = (s: string) => s.replace(/_/g, " ");
const ICON: Record<QType, React.ReactNode> = {
  noul: <RuleIcon sx={{ fontSize: 18 }} />, choice: <CategoryOutlinedIcon sx={{ fontSize: 18 }} />, score: <SpeedIcon sx={{ fontSize: 18 }} />,
};

/** One labelled probability bar, filled with the question type's colour. */
function Bar({ label, value, color, strong, title }: { label: string; value: number; color: string; strong?: boolean; title?: string }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1.25 }} title={title}>
      <Typography noWrap sx={{ width: { xs: 112, sm: 128 }, flex: "none", fontSize: 13, color: strong ? "text.primary" : "text.secondary", fontWeight: strong ? 600 : 400, textTransform: "capitalize" }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: tint(color, 14), overflow: "hidden" }}>
        <Box sx={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: "100%", borderRadius: 2, bgcolor: color, opacity: strong ? 1 : 0.55,
          transition: "width .4s ease" }} />
      </Box>
      <Typography sx={{ width: 34, textAlign: "right", fontSize: 12, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
        {Math.round(value * 100)}%
      </Typography>
    </Stack>
  );
}

function AnswerCard({ type, name, question, children }: { type: QType; name: string; question: string; children: React.ReactNode }) {
  const color = QTYPES[type].color;
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1.25, mb: 1.5 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: "9px", display: "grid", placeItems: "center", bgcolor: tint(color, 13), color }}>{ICON[type]}</Box>
          <QTypeChip type={type} />
          <Typography sx={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, color: "text.secondary" }}>{name}</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, minHeight: 40 }}>{question}</Typography>
        {children}
      </CardContent>
    </Card>
  );
}

/** Before anything is classified: what each question type will return. */
function Placeholder({ type, busy }: { type: QType; busy: boolean }) {
  return busy ? (
    <Stack spacing={1.25}><Skeleton variant="text" width="40%" height={52} /><Skeleton variant="rounded" height={4} /><Skeleton variant="rounded" height={4} width="70%" /></Stack>
  ) : (
    <Box sx={{ p: 1.5, borderRadius: "10px", border: "1px dashed", borderColor: "divider" }}>
      <Typography variant="body2" color="text.secondary">Returns {QTYPES[type].returns}.</Typography>
    </Box>
  );
}

const Big = ({ children }: { children: React.ReactNode }) => (
  <Typography sx={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{children}</Typography>
);

/**
 * JEV's three answers for one email, one card per question type:
 * Noul (spam probability), Choice (category + probability per option), Score (rubric level + probability per level).
 */
export default function AnswerCards({ result, threshold, scoreQuestion, busy = false }: {
  result: JevResult | null; threshold: number; scoreQuestion: ScoreQuestion | null; busy?: boolean;
}) {
  const color = (t: QType) => QTYPES[t].color;
  const spam = result ? result.p_spam >= threshold : false;
  const probs = result?.category_probs ?? (result ? { [result.category]: result.category_conf } : {});
  const sortedCats = Object.entries(probs).sort((a, b) => b[1] - a[1]);
  const sc = result?.score;
  const nearest = sc ? Math.min(sc.levels - 1, Math.max(0, Math.round(sc.score))) : 0;

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <AnswerCard type="noul" name="is_spam" question={SPAM_QUESTION.instructions}>
          {!result ? <Placeholder type="noul" busy={busy} /> : (
            <>
              <Stack direction="row" sx={{ alignItems: "baseline", gap: 1, mb: 2 }}>
                <Big>{Math.round(result.p_spam * 100)}<Box component="span" sx={{ fontSize: 26, ml: 0.25 }}>%</Box></Big>
                <Typography variant="body2" color="text.secondary">chance of spam</Typography>
              </Stack>
              {/* probability with the decision threshold marked */}
              <Box sx={{ position: "relative", height: 6, borderRadius: 3, bgcolor: tint(color("noul"), 14), mb: 2 }}>
                <Box sx={{ width: `${result.p_spam * 100}%`, height: "100%", borderRadius: 3, bgcolor: color("noul"), transition: "width .4s ease" }} />
                <Box title={`threshold ${threshold.toFixed(2)}`} sx={{ position: "absolute", top: -4, left: `${threshold * 100}%`, width: 2, height: 14, ml: "-1px", bgcolor: "text.primary", borderRadius: 1, opacity: 0.6 }} />
              </Box>
              <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, px: 1.25, height: 28, borderRadius: "8px", fontSize: 13, fontWeight: 600,
                  bgcolor: tint(SERIES_VAR[spam ? "spam" : "ham"], 12) }}>
                  <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: SERIES_VAR[spam ? "spam" : "ham"] }} />
                  {spam ? "Spam" : "Not spam"}
                </Box>
                <Typography variant="caption" color="text.secondary">threshold {threshold.toFixed(2)}</Typography>
              </Stack>
            </>
          )}
        </AnswerCard>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <AnswerCard type="choice" name="category" question={CATEGORY_QUESTION.instructions.split("?")[0] + "?"}>
          {!result ? <Placeholder type="choice" busy={busy} /> : (
            <>
              <Stack direction="row" sx={{ alignItems: "baseline", gap: 1, mb: 2, flexWrap: "wrap" }}>
                <Typography sx={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.1, textTransform: "capitalize" }}>{pretty(result.category)}</Typography>
                <Typography variant="body2" color="text.secondary">{Math.round(result.category_conf * 100)}% confident</Typography>
              </Stack>
              <Stack spacing={1}>
                {sortedCats.map(([c, p]) => <Bar key={c} label={pretty(c)} value={p} color={color("choice")} strong={c === result.category} />)}
              </Stack>
            </>
          )}
        </AnswerCard>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <AnswerCard type="score" name={sc?.name ?? scoreQuestion?.name ?? "score"}
          question={scoreQuestion ? scoreQuestion.instructions : "The Score question is switched off in Settings."}>
          {!scoreQuestion && !sc ? <Typography variant="body2" color="text.disabled">Turn it on in Settings to ask a third question.</Typography>
            : !sc ? <Placeholder type="score" busy={busy} /> : (
            <>
              <Stack direction="row" sx={{ alignItems: "baseline", gap: 1, mb: 2 }}>
                <Big>{sc.score.toFixed(2)}</Big>
                <Typography variant="body2" color="text.secondary">
                  of {sc.levels - 1} · <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>{(sc.legend[String(nearest)] ?? "").split(":")[0]}</Box>
                </Typography>
              </Stack>
              <Stack spacing={1}>
                {Array.from({ length: sc.levels }, (_, i) => (
                  <Bar key={i} label={`${i} · ${(sc.legend[String(i)] ?? "").split(":")[0]}`} title={sc.legend[String(i)]}
                    value={Number(sc.probabilities[String(i)] ?? 0)} color={color("score")} strong={i === nearest} />
                ))}
              </Stack>
            </>
          )}
        </AnswerCard>
      </Grid>
    </Grid>
  );
}
