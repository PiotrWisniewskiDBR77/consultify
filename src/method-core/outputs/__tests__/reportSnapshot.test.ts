/**
 * Covers canon test 10: Report renders from the snapshot (the frozen
 * AssessmentOutput), not from a live session. `buildReportSnapshot` only
 * ever accepts an `AssessmentOutput` — there is no session/workspace
 * parameter it could read live state from, so a later "change" can only be
 * simulated by building a SECOND, different Output and confirming the first
 * report is untouched.
 */
import { describe, expect, it } from 'vitest';
import { buildReportSnapshot } from '../reportSnapshot';
import { makeFinding, makeOutput } from './testFixtures';

describe('ReportSnapshot — renders from snapshot, not live session (test 10)', () => {
  it('buildReportSnapshot signature only accepts an AssessmentOutput — no session/live-state parameter exists', () => {
    expect(buildReportSnapshot.length).toBe(2); // (output, input) — no third "session" argument
  });

  it('a report built from one Output version is unaffected by a later, different Output version', () => {
    const findingV1 = makeFinding({ id: 'f-1', currentLevel: 2, gap: 2 });
    const outputV1 = makeOutput({ id: 'output-1', version: 1, findings: [findingV1] });

    const reportV1 = buildReportSnapshot(outputV1, {
      id: 'report-1',
      executiveSummary: 'Initial assessment summary.',
      participants: ['alice'],
      strengths: ['Strong leadership sponsorship'],
      initiativeCandidates: [],
      appendices: [],
      createdAt: '2026-08-13T13:00:00.000Z',
    });

    // Simulate "the session changed after freeze" — a reopen produces a
    // DIFFERENT Output object (per the kernel's own frozen->active->reopen
    // semantics tested in MethodSessionService). The old report must not see it.
    const findingV2 = makeFinding({ id: 'f-1', currentLevel: 4, gap: 0 });
    const outputV2 = makeOutput({
      id: 'output-2',
      version: 2,
      findings: [findingV2],
      lineage: {
        sourceSessionId: 'session-1',
        sourceRevisionOfSessionId: 'session-1-rev',
        revisionOfOutputId: outputV1.id,
        supersededByOutputId: null,
      },
    });
    void outputV2; // constructing it must not retroactively affect reportV1

    expect(reportV1.outputId).toBe('output-1');
    expect(reportV1.outputVersion).toBe(1);
    expect(reportV1.current['axis-1.criterion-1']).toBe(2);
    expect(reportV1.gap['axis-1.criterion-1']).toBe(2);
  });

  it('the report content is frozen once built', () => {
    const output = makeOutput();
    const report = buildReportSnapshot(output, {
      id: 'report-1',
      executiveSummary: 'Summary.',
      participants: [],
      strengths: [],
      initiativeCandidates: [],
      appendices: [],
      createdAt: '2026-08-13T13:00:00.000Z',
    });
    expect(() => {
      (report as { executiveSummary: string }).executiveSummary = 'tampered';
    }).toThrow(TypeError);
  });

  it('carries methodology/version and limitations from the Output verbatim (10_ASSESSMENT_REVIEW.md §15)', () => {
    const output = makeOutput({
      methodology: { methodPackId: 'siri', version: '2.1.0' },
      limitations: ['Axis 6 self-reported only.'],
    });
    const report = buildReportSnapshot(output, {
      id: 'report-1',
      executiveSummary: 'Summary.',
      participants: [],
      strengths: [],
      initiativeCandidates: [],
      appendices: [],
      createdAt: '2026-08-13T13:00:00.000Z',
    });
    expect(report.methodology).toEqual({ methodPackId: 'siri', version: '2.1.0' });
    expect(report.limitations).toEqual(['Axis 6 self-reported only.']);
  });
});
