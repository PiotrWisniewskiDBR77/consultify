import { describe, expect, it } from 'vitest';

import { extractUnknownReasonBreakdown, isPlausibleRawOutput, toAssessmentOutput } from '../outputAdapter';
import type { RawAssessmentOutputRecord } from '../rawOutputTypes';

function makeRaw(overrides: Partial<RawAssessmentOutputRecord> = {}): RawAssessmentOutputRecord {
  return {
    id: 'output-1',
    organizationId: 'org-1',
    sessionId: 'session-1',
    snapshotId: 'snapshot-1',
    module: 'assessment',
    methodPackId: 'drd',
    methodPackVersion: '1.0.0',
    outputVersion: 1,
    revisionOfOutputId: null,
    scope: 'Full DRD assessment.',
    current: { 'u-1': 2 },
    target: { 'u-1': 4 },
    gap: { 'u-1': 2 },
    aggregation: {
      byGroup: { d1: 2 },
      mappingVersion: '1.0.0',
      rule: 'weighted-mean',
      excluded: {},
    },
    evidenceCompleteness: {
      totalUnits: 1,
      unitsWithAcceptedEvidence: 1,
      unitsMissingEvidence: 0,
      completenessRatio: 1,
    },
    limitations: ['Only self-reported evidence.'],
    findings: [
      {
        id: 'finding-1',
        unitId: 'u-1',
        unitName: 'Data ownership',
        currentLevel: 2,
        targetLevel: 4,
        gap: 2,
        supportingEvidence: [{ evidenceId: 'ev-1', evidenceType: 'document', strength: 'E2', locator: 'x' }],
        contradictingEvidence: [],
        businessMeaning: 'Ownership is unclear.',
        rootCauseHypothesis: null,
        riskOrOpportunity: null,
        recommendation: 'Assign an owner.',
        prerequisite: null,
        expectedOutcome: null,
        kpiProposal: null,
        confidence: 'medium',
        priorityRationale: null,
        sourceLocators: [],
      },
    ],
    contentHash: 'sha256-x',
    createdAt: '2026-08-01T10:00:00.000Z',
    frozenAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('toAssessmentOutput', () => {
  it('nests methodPackId/methodPackVersion into methodology, and outputVersion into version', () => {
    const output = toAssessmentOutput(makeRaw());
    expect(output.methodology).toEqual({ methodPackId: 'drd', version: '1.0.0' });
    expect(output.version).toBe(1);
  });

  it('copies current/target/gap/limitations/evidenceCompleteness verbatim', () => {
    const raw = makeRaw();
    const output = toAssessmentOutput(raw);
    expect(output.current).toEqual(raw.current);
    expect(output.target).toEqual(raw.target);
    expect(output.gap).toEqual(raw.gap);
    expect(output.limitations).toEqual(raw.limitations);
    expect(output.evidenceCompleteness).toEqual(raw.evidenceCompleteness);
  });

  it('defaults null text fields on a Finding to empty string, never a fabricated sentence', () => {
    const output = toAssessmentOutput(makeRaw());
    const [finding] = output.findings;
    expect(finding.rootCauseHypothesis).toBe('');
    expect(finding.riskOrOpportunity).toBe('');
    expect(finding.expectedOutcome).toBe('');
    expect(finding.priorityRationale).toBe('');
  });

  it('synthesizes lineage from sessionId/revisionOfOutputId without inventing a supersededByOutputId', () => {
    const output = toAssessmentOutput(makeRaw({ sessionId: 'session-42', revisionOfOutputId: 'output-0' }));
    expect(output.lineage.sourceSessionId).toBe('session-42');
    expect(output.lineage.revisionOfOutputId).toBe('output-0');
    expect(output.lineage.supersededByOutputId).toBeNull();
  });
});

describe('isPlausibleRawOutput', () => {
  it('accepts a well-shaped raw record', () => {
    expect(isPlausibleRawOutput(makeRaw())).toBe(true);
  });

  it('rejects null/undefined/non-object values', () => {
    expect(isPlausibleRawOutput(null)).toBe(false);
    expect(isPlausibleRawOutput(undefined)).toBe(false);
    expect(isPlausibleRawOutput('output-1')).toBe(false);
  });

  it('rejects an object missing required fields (e.g. no aggregation)', () => {
    const { aggregation: _aggregation, ...rest } = makeRaw();
    expect(isPlausibleRawOutput(rest)).toBe(false);
  });

  it('rejects an object whose findings is not an array', () => {
    expect(isPlausibleRawOutput({ ...makeRaw(), findings: {} })).toBe(false);
  });
});

describe('extractUnknownReasonBreakdown', () => {
  it('returns undefined when the field is absent (today\'s real Output contract)', () => {
    expect(extractUnknownReasonBreakdown(makeRaw())).toBeUndefined();
  });

  it('returns the breakdown when present and well-shaped', () => {
    const raw = makeRaw({
      evidenceCompleteness: {
        totalUnits: 10,
        unitsWithAcceptedEvidence: 6,
        unitsMissingEvidence: 4,
        completenessRatio: 0.6,
        unitsMissingEvidenceBreakdown: { dontKnow: 3, noEvidence: 1 },
      },
    });
    expect(extractUnknownReasonBreakdown(raw)).toEqual({ dontKnow: 3, noEvidence: 1 });
  });

  it('returns undefined when the field is present but malformed', () => {
    const raw = makeRaw({
      evidenceCompleteness: {
        totalUnits: 10,
        unitsWithAcceptedEvidence: 6,
        unitsMissingEvidence: 4,
        completenessRatio: 0.6,
        // @ts-expect-error deliberately malformed for the defensive-parse test
        unitsMissingEvidenceBreakdown: { dontKnow: 'three' },
      },
    });
    expect(extractUnknownReasonBreakdown(raw)).toBeUndefined();
  });
});
