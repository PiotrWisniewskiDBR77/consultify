/**
 * RN-G3 lane (KPI full tool, klasa L) — unit tests for the pure
 * `deviationErrorDetail` helper in
 * `src/components/ResultsVNext/kpiTool/kpiDeviationApi.ts`, used by
 * `KpiDeviationCaseSubview.tsx` to render the exact server error (self-
 * approval denial, NOT_PLAN_REQUIRED, EFFECTIVENESS_NOT_VERIFIED, ...)
 * instead of a generic message.
 */
import { describe, expect, it } from 'vitest';
import { deviationErrorDetail } from '../../../src/components/ResultsVNext/kpiTool/kpiDeviationApi';

describe('deviationErrorDetail', () => {
  it('extracts code/message/details from an HTTP-shaped error (the real shape services/api.ts throws)', () => {
    const err = Object.assign(new Error('fallback message'), {
      status: 403,
      data: { code: 'SELF_APPROVAL_DENIED', error: 'Cannot approve your own plan', details: { caseId: 'c1' } },
    });
    const detail = deviationErrorDetail(err);
    expect(detail.code).toBe('SELF_APPROVAL_DENIED');
    expect(detail.message).toBe('Cannot approve your own plan');
    expect(detail.details).toEqual({ caseId: 'c1' });
  });

  it('falls back to err.message when there is no data.error (plain network failure)', () => {
    const err = new Error('network down');
    const detail = deviationErrorDetail(err);
    expect(detail.message).toBe('network down');
    expect(detail.code).toBeUndefined();
  });

  it('falls back to String(err) for a non-Error thrown value', () => {
    const detail = deviationErrorDetail('a raw string throw');
    expect(detail.message).toBe('a raw string throw');
  });

  it('NOT_PLAN_REQUIRED / NO_CORRECTIVE_ACTIONS / EFFECTIVENESS_NOT_VERIFIED codes all pass through verbatim (workflow rules, not ABAC denials — D06 general-reason constraint does not apply)', () => {
    for (const code of ['NOT_PLAN_REQUIRED', 'NO_CORRECTIVE_ACTIONS', 'EFFECTIVENESS_NOT_VERIFIED']) {
      const err = Object.assign(new Error('x'), { status: 409, data: { code, error: `server says ${code}` } });
      expect(deviationErrorDetail(err).code).toBe(code);
      expect(deviationErrorDetail(err).message).toBe(`server says ${code}`);
    }
  });
});
