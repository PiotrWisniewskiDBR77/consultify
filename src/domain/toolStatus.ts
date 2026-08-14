/**
 * ONE canonical backend -> domain -> UI status mapping for Discovery Tools.
 *
 * ROOT CAUSE this file closes (docs/program/METHOD_TOOLS_2026-08-13/STATUS_CANON.md
 * has the full inventory with citations): `src/components/Discovery/DiscoveryToolsHub.tsx`
 * hand-rolled at least three separate `Record<string, ItemStatus>` status maps
 * (`transformToolSession`, `transformAssessmentSession`, `mapOutputStatus`) — each one
 * listed a SUBSET of the real backend vocabulary and silently fell back to
 * `'DRAFT'` for anything not in that subset. Backend emits `IN_PROGRESS`,
 * `FINALIZED`, `FAILED` (server/src/controllers/ToolController.ts, e.g. lines
 * 1561 `SET status = 'APPROVED'`, 1910 `SET status = 'GENERATED'`, 1883
 * `SET status = 'FAILED'`, 2633 `SET status = 'IN_PROGRESS'`) and
 * `tool_outputs.status` emits `superseded` (src/toolOutputs/types.ts) — none of
 * these were in every local map, so an approved/generated/finalized/failed/
 * superseded row rendered as "Draft" in the list view. A user could not tell
 * an approved, frozen result from an untouched draft — a trust-destroying bug
 * in a consulting product.
 *
 * This module is now the single source of truth for tool-session
 * (`tool_sessions.status`) and tool-output (`tool_outputs.status`) status
 * handling. No other file should hand-roll a status -> label/tone map for
 * these two entities; route through `resolveToolStatus()` instead.
 *
 * An UNKNOWN raw value is NEVER silently coerced to "draft" — it resolves to
 * the explicit `unknown` domain and a label that names the raw value
 * (`nieznany status: <raw>` / `unknown status: <raw>`), so a genuinely new or
 * malformed backend value is visible instead of masquerading as a draft.
 */

/** Canonical domain bucket every raw backend status resolves into. */
export type ToolStatusDomain =
  | 'draft'
  | 'in_progress'
  | 'in_review'
  | 'approved'
  | 'generated'
  | 'finalized'
  | 'superseded'
  | 'failed'
  | 'unknown';

export interface ToolStatusInfo {
  /** Original raw value exactly as received (not normalized). */
  raw: string;
  /** Canonical domain bucket. */
  domain: ToolStatusDomain;
  /** True when `raw` didn't match any known vocabulary entry. */
  isUnknown: boolean;
  labelPl: string;
  labelEn: string;
}

/**
 * Backend raw value -> domain, keyed UPPERCASE so both `tool_sessions.status`
 * casing (`APPROVED`, `GENERATED` — see ToolController.ts normalizeStatus())
 * and `tool_outputs.status` casing (`approved`, `superseded` — lowercase,
 * src/toolOutputs/types.ts) resolve through the same lookup after
 * normalization. Aliases cover the legacy/synonym spellings seen across the
 * codebase (`COMPLETED`/`DONE` for `finalized`, `IN_REVIEW`/`PENDING_REVIEW`
 * for `in_review`, `EXECUTING`/`GENERATING` for `in_progress`, `REJECTED`/
 * `CANCELLED` for `failed`) — including the output-lifecycle vocabulary used
 * by assessment reports / report-builder reports / presentation decks in
 * `DiscoveryToolsHub.tsx`'s `mapOutputStatus`, which is now a thin wrapper
 * around this table rather than a second, independently-maintained map.
 */
const RAW_TO_DOMAIN: Record<string, ToolStatusDomain> = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  EXECUTING: 'in_progress',
  GENERATING: 'in_progress',
  REVIEW: 'in_review',
  IN_REVIEW: 'in_review',
  PENDING_REVIEW: 'in_review',
  PENDING_APPROVAL: 'in_review',
  APPROVED: 'approved',
  GENERATED: 'generated',
  FINALIZED: 'finalized',
  COMPLETED: 'finalized',
  DONE: 'finalized',
  FINAL: 'finalized',
  UTILIZED: 'finalized',
  SUPERSEDED: 'superseded',
  ARCHIVED: 'superseded',
  FAILED: 'failed',
  REJECTED: 'failed',
  ERROR: 'failed',
  CANCELLED: 'failed',
};

const DOMAIN_LABELS: Record<ToolStatusDomain, { pl: string; en: string }> = {
  draft: { pl: 'Szkic', en: 'Draft' },
  in_progress: { pl: 'W trakcie', en: 'In progress' },
  in_review: { pl: 'Do akceptacji', en: 'In review' },
  approved: { pl: 'Zatwierdzone', en: 'Approved' },
  generated: { pl: 'Wygenerowane', en: 'Generated' },
  finalized: { pl: 'Zakończone', en: 'Finalized' },
  superseded: { pl: 'Zastąpione', en: 'Superseded' },
  failed: { pl: 'Błąd', en: 'Failed' },
  // Placeholder only — never used directly, see resolveToolStatus() which
  // always builds the unknown label from the raw value instead.
  unknown: { pl: 'Nieznany status', en: 'Unknown status' },
};

function normalizeRaw(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase();
}

/**
 * Resolve any raw backend status (tool_sessions or tool_outputs, any casing)
 * to its canonical domain bucket + localized labels. Unknown input produces
 * an EXPLICIT fallback that names the raw value — never a silent "Draft".
 */
export function resolveToolStatus(raw: string | null | undefined): ToolStatusInfo {
  const rawString = raw == null ? '' : String(raw);
  const normalized = normalizeRaw(raw);
  const domain = normalized ? RAW_TO_DOMAIN[normalized] : undefined;

  if (domain) {
    const labels = DOMAIN_LABELS[domain];
    return { raw: rawString, domain, isUnknown: false, labelPl: labels.pl, labelEn: labels.en };
  }

  const shown = rawString.trim() || '(brak)';
  return {
    raw: rawString,
    domain: 'unknown',
    isUnknown: true,
    labelPl: `nieznany status: ${shown}`,
    labelEn: `unknown status: ${shown}`,
  };
}

/** Convenience accessor for just the localized label. */
export function toolStatusLabel(raw: string | null | undefined, lang: 'pl' | 'en'): string {
  const info = resolveToolStatus(raw);
  return lang === 'pl' ? info.labelPl : info.labelEn;
}

/** Every raw value this module recognizes — used for exhaustive round-trip tests. */
export const KNOWN_TOOL_STATUS_RAW_VALUES: string[] = Object.keys(RAW_TO_DOMAIN);
