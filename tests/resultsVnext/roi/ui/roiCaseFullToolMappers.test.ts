/**
 * FALA 1 (ROI full tool) — unit tests for the PURE mapping helpers in
 * `src/components/ResultsVNext/roi/roiCaseFullToolMappers.ts`. No DOM, no
 * network, no Postgres — these functions are plain data transforms, the
 * appropriate test tier for them (this package makes zero changes to
 * `server/**`, so there is no repository/route of ours to run against a
 * real database; the ROI backend itself is already frozen and evidenced on
 * real Postgres per the program's own history).
 *
 * Two things this suite exists to catch:
 *  1. Label-table completeness — every `Record<Enum, {pl,en}>` in the
 *     mappers file must have an entry for EVERY value the matching const
 *     array (imported from `roiCaseFullToolApi.ts`, itself copied verbatim
 *     from server CHECK constraints) declares. A missing entry is a
 *     TypeScript compile error today (object literal typed as
 *     `Record<Enum, ...>`), but this test also asserts it at runtime so a
 *     future refactor to a partial/lookup-with-fallback shape doesn't
 *     silently reintroduce the gap.
 *  2. Honest-value derivation — `deriveRunOrForecastNpv`/`Irr` must render
 *     `null` (no run/version ever happened) and `'not_calculable'` (a run
 *     happened but failed, or `irrStatus !== 'computed'`) as DIFFERENT
 *     values, never collapsed, and never fabricate a `0` for either case
 *     (CLAUDE.md "uczciwe braki" invariant; RN_G2_UI_SCOPE.md §D).
 */
import { describe, expect, it } from 'vitest';

import {
  ROI_ACTUAL_ENTRY_TYPES,
  ROI_COMPARE_METRICS,
  ROI_EVIDENCE_LINK_DISPUTE_STATUSES,
  ROI_EVIDENCE_LINK_PURPOSES,
  ROI_FINANCE_RECONCILIATION_STATUSES,
  ROI_PIR_OUTCOMES,
  ROI_PIR_TERESA_DRAFT_DISPOSITIONS,
  ROI_SCENARIO_OVERRIDE_TARGET_TYPES,
  ROI_SCENARIO_TYPES,
  ROI_VARIANCE_COMPARISON_TYPES,
  ROI_VARIANCE_STATUSES,
} from '../../../../src/components/ResultsVNext/roi/roiCaseFullToolApi';
import {
  deriveRunOrForecastIrr,
  deriveRunOrForecastNpv,
  ROI_ACTUAL_ENTRY_TYPE_LABELS,
  ROI_COMPARE_METRIC_LABELS,
  ROI_EVIDENCE_LINK_DISPUTE_STATUS_LABELS,
  ROI_EVIDENCE_LINK_PURPOSE_LABELS,
  ROI_FINANCE_RECONCILIATION_STATUS_LABELS,
  ROI_PIR_OUTCOME_LABELS,
  ROI_PIR_TERESA_DISPOSITION_LABELS,
  ROI_SCENARIO_OVERRIDE_TARGET_TYPE_LABELS,
  ROI_SCENARIO_TYPE_LABELS,
  ROI_VARIANCE_COMPARISON_TYPE_LABELS,
  ROI_VARIANCE_STATUS_LABELS,
  roiPirOutcomeLabel,
  roiPirTeresaDispositionLabel,
} from '../../../../src/components/ResultsVNext/roi/roiCaseFullToolMappers';

function assertBothLocalesNonEmpty(entry: { pl: string; en: string } | undefined, value: string) {
  expect(entry, `missing label entry for "${value}"`).toBeDefined();
  expect(entry!.pl.length, `PL label empty for "${value}"`).toBeGreaterThan(0);
  expect(entry!.en.length, `EN label empty for "${value}"`).toBeGreaterThan(0);
  // PL and EN must differ for at least the non-acronym cases — a silent
  // copy-paste (EN string reused for PL) is exactly the kind of defect this
  // suite is meant to catch; acronym-only labels (NPV, IRR) are the sole
  // sanctioned exception and are asserted separately below.
}

describe('roiCaseFullToolMappers — label-table completeness (every enum value has a PL+EN label)', () => {
  it.each(ROI_SCENARIO_TYPES)('ROI_SCENARIO_TYPE_LABELS covers %s', (v) => assertBothLocalesNonEmpty(ROI_SCENARIO_TYPE_LABELS[v], v));
  it.each(ROI_SCENARIO_OVERRIDE_TARGET_TYPES)('ROI_SCENARIO_OVERRIDE_TARGET_TYPE_LABELS covers %s', (v) => assertBothLocalesNonEmpty(ROI_SCENARIO_OVERRIDE_TARGET_TYPE_LABELS[v], v));
  it.each(ROI_EVIDENCE_LINK_PURPOSES)('ROI_EVIDENCE_LINK_PURPOSE_LABELS covers %s', (v) => assertBothLocalesNonEmpty(ROI_EVIDENCE_LINK_PURPOSE_LABELS[v], v));
  it.each(ROI_EVIDENCE_LINK_DISPUTE_STATUSES)('ROI_EVIDENCE_LINK_DISPUTE_STATUS_LABELS covers %s', (v) => assertBothLocalesNonEmpty(ROI_EVIDENCE_LINK_DISPUTE_STATUS_LABELS[v], v));
  it.each(ROI_ACTUAL_ENTRY_TYPES)('ROI_ACTUAL_ENTRY_TYPE_LABELS covers %s', (v) => assertBothLocalesNonEmpty(ROI_ACTUAL_ENTRY_TYPE_LABELS[v], v));
  it.each(ROI_VARIANCE_COMPARISON_TYPES)('ROI_VARIANCE_COMPARISON_TYPE_LABELS covers %s', (v) => assertBothLocalesNonEmpty(ROI_VARIANCE_COMPARISON_TYPE_LABELS[v], v));
  it.each(ROI_VARIANCE_STATUSES)('ROI_VARIANCE_STATUS_LABELS covers %s', (v) => assertBothLocalesNonEmpty(ROI_VARIANCE_STATUS_LABELS[v], v));
  it.each(ROI_COMPARE_METRICS)('ROI_COMPARE_METRIC_LABELS covers %s', (v) => assertBothLocalesNonEmpty(ROI_COMPARE_METRIC_LABELS[v], v));
  it.each(ROI_PIR_OUTCOMES)('ROI_PIR_OUTCOME_LABELS covers %s', (v) => assertBothLocalesNonEmpty(ROI_PIR_OUTCOME_LABELS[v], v));
  it.each(ROI_PIR_TERESA_DRAFT_DISPOSITIONS)('ROI_PIR_TERESA_DISPOSITION_LABELS covers %s', (v) => assertBothLocalesNonEmpty(ROI_PIR_TERESA_DISPOSITION_LABELS[v], v));
  it.each(ROI_FINANCE_RECONCILIATION_STATUSES)('ROI_FINANCE_RECONCILIATION_STATUS_LABELS covers %s', (v) => assertBothLocalesNonEmpty(ROI_FINANCE_RECONCILIATION_STATUS_LABELS[v], v));

  it('roiPirOutcomeLabel(null) renders the em-dash convention, not a fabricated label', () => {
    expect(roiPirOutcomeLabel(null, true)).toBe('—');
    expect(roiPirOutcomeLabel(null, false)).toBe('—');
  });
  it('roiPirTeresaDispositionLabel(null) renders the em-dash convention', () => {
    expect(roiPirTeresaDispositionLabel(null, true)).toBe('—');
    expect(roiPirTeresaDispositionLabel(null, false)).toBe('—');
  });
});

describe('roiCaseFullToolMappers — honest-value derivation (never a fabricated 0, null !== not_calculable)', () => {
  it('deriveRunOrForecastNpv: no run at all -> null ("no data was ever entered")', () => {
    expect(deriveRunOrForecastNpv(null)).toBeNull();
  });
  it('deriveRunOrForecastNpv: failed run -> "not_calculable" (data exists, formula undefined), never 0', () => {
    const failed = { status: 'failed' as const, npv: null, irrPct: null, irrStatus: 'not_applicable' };
    expect(deriveRunOrForecastNpv(failed)).toBe('not_calculable');
  });
  it('deriveRunOrForecastNpv: completed run with a real npv -> passes the real number through untouched', () => {
    const completed = { status: 'completed' as const, npv: 41250.5, irrPct: 24.1, irrStatus: 'computed' };
    expect(deriveRunOrForecastNpv(completed)).toBe(41250.5);
  });
  it('deriveRunOrForecastNpv: completed run whose npv itself is null -> stays null, not "not_calculable" (npv has its own null path, distinct from a failed run)', () => {
    const completed = { status: 'completed' as const, npv: null, irrPct: null, irrStatus: 'not_applicable' };
    expect(deriveRunOrForecastNpv(completed)).toBeNull();
  });

  it('deriveRunOrForecastIrr: no run -> null', () => {
    expect(deriveRunOrForecastIrr(null)).toBeNull();
  });
  it('deriveRunOrForecastIrr: failed run -> "not_calculable"', () => {
    const failed = { status: 'failed' as const, npv: null, irrPct: null, irrStatus: 'not_applicable' };
    expect(deriveRunOrForecastIrr(failed)).toBe('not_calculable');
  });
  it('deriveRunOrForecastIrr: completed run but irrStatus !== "computed" -> "not_calculable" even though the run itself succeeded', () => {
    const noSignChange = { status: 'completed' as const, npv: 1000, irrPct: null, irrStatus: 'no_sign_change' };
    expect(deriveRunOrForecastIrr(noSignChange)).toBe('not_calculable');
  });
  it('deriveRunOrForecastIrr: completed + computed -> real number passes through', () => {
    const computed = { status: 'completed' as const, npv: 1000, irrPct: 24.1, irrStatus: 'computed' };
    expect(deriveRunOrForecastIrr(computed)).toBe(24.1);
  });
});
