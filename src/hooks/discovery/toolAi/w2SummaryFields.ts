/**
 * Shared, ADDITIVE extraction of the CONCLUSION_LAYER_STANDARD variant-W2
 * finishing fields (verdict / tradeoffs / expectedEffect) from a parsed AI
 * `summary` object (OXFORD #102 — tool output quality).
 *
 * Every tool applier builds its persisted `summary` explicitly, so before this
 * helper the W2 fields the conclusion prompts request were silently dropped —
 * the Conclusions bridge (server/src/services/conclusions/toolConclusionBridge)
 * reads `answers.summary.verdict` and found nothing for 18 of 19 tools.
 *
 * Strictly additive and fail-safe: returns `{}` for anything malformed, so
 * legacy responses (no W2 fields) parse exactly as before.
 */

export interface W2SummaryFields {
  verdict?: string;
  tradeoffs?: { chosen: string; rejected: string; why: string }[];
  expectedEffect?: { text: string; horizon: string };
}

const nonEmpty = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

export function pickW2SummaryFields(summaryObj: unknown): W2SummaryFields {
  if (!summaryObj || typeof summaryObj !== 'object' || Array.isArray(summaryObj)) return {};
  const source = summaryObj as Record<string, unknown>;
  const fields: W2SummaryFields = {};

  const verdict = nonEmpty(source.verdict);
  if (verdict) fields.verdict = verdict;

  if (Array.isArray(source.tradeoffs)) {
    const tradeoffs = source.tradeoffs
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const t = entry as Record<string, unknown>;
        const chosen = nonEmpty(t.chosen);
        const rejected = nonEmpty(t.rejected);
        if (!chosen || !rejected) return null;
        return { chosen, rejected, why: nonEmpty(t.why) || '' };
      })
      .filter((t): t is { chosen: string; rejected: string; why: string } => t !== null);
    if (tradeoffs.length > 0) fields.tradeoffs = tradeoffs;
  }

  const effect =
    source.expectedEffect && typeof source.expectedEffect === 'object'
      ? (source.expectedEffect as Record<string, unknown>)
      : null;
  const effectText = effect ? nonEmpty(effect.text) : null;
  if (effectText) {
    fields.expectedEffect = { text: effectText, horizon: (effect && nonEmpty(effect.horizon)) || '' };
  }

  return fields;
}
