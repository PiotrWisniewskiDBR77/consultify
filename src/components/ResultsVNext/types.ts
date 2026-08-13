/**
 * RN-G2 — shared types for the Results Next registry shell.
 * See docs/product/results-vnext/RN_G2_UI_SCOPE.md §D (required states).
 */

export type ResultsVNextDomain = 'kpi' | 'roi' | 'okr';

/**
 * The 3-way honest-missing domain used across the whole results-vnext
 * backend (KPI baseline/measurement fields, OKR progress/confidence, ROI
 * IRR/NPV/variance): a real value, `null` ("no data was ever entered" — the
 * TRIADA convention, renders as "—"), or `'not_calculable'` ("data exists but
 * the formula is structurally undefined", e.g. divide by zero, degenerate KR
 * geometry — renders as a visibly distinct muted chip, NEVER the same as
 * "—" and NEVER a fabricated `0`). See RN_G2_UI_SCOPE.md §D, EXECUTION_LEDGER
 * L132, ROI_E001_DESIGN.md L31 AC-03, OKR_E006_DESIGN.md L16 IO-5.
 */
export type HonestValue<T> = T | null | 'not_calculable';

/**
 * Closed set of ABAC DENY reasons a deep link to a visibility-denied resource
 * must render honestly (RN_G1_PLATFORM_DESIGN.md §B). `NO_VISIBILITY_RECORD`
 * is the fail-closed default — "no visibility row" is a DENY, not an ALLOW.
 */
export type ResultsVNextDenyReason =
  | 'CROSS_TENANT'
  | 'NO_VISIBILITY_RECORD'
  | 'PRIVATE_NOT_OWNER'
  | 'OUT_OF_SCOPE'
  | 'NOT_IN_CHAIN'
  | 'NOT_ON_ACL';

export interface ResultsVNextForbiddenDetail {
  reason: ResultsVNextDenyReason;
  /** Optional extra context appended after the reason's canonical copy. */
  detail?: string;
}
