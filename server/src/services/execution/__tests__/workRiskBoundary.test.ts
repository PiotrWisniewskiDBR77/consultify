import { describe, expect, it } from 'vitest';
import {
  buildWorkRiskReadModel,
  classifyWorkRisk,
  type WorkRiskObservation,
} from '../workRiskBoundary.js';
const scope = { organizationId: 'org-a', projectId: 'project-a' };
const observation: WorkRiskObservation = {
  ...scope,
  sourceType: 'task',
  sourceId: 'task-1',
  initiativeId: 'ini-1',
  workState: 'active',
  baselineImpact: 'task',
  measuredLevel: 0,
  reasonCode: 'within_tolerance',
  observedAt: '2026-09-18T13:00:00Z',
  evidenceRef: 'snapshot:1',
  generatedBy: 'system',
};
describe('DEC-485 work/risk boundary', () => {
  it.each([
    [0, 'none'],
    [1, 'watch'],
    [2, 'amber'],
    [3, 'red'],
  ] as const)('preserves measured level %s as %s', (level, state) => {
    expect(classifyWorkRisk(scope, { ...observation, measuredLevel: level }).riskState).toBe(state);
  });
  it.each([
    ['task', 1],
    ['within_initiative', 2],
    ['approved_baseline', 3],
    ['unknown', null],
  ] as const)('routes %s to decision level %s', (impact, level) => {
    expect(classifyWorkRisk(scope, { ...observation, baselineImpact: impact }).decisionLevel).toBe(
      level
    );
  });
  it('never turns missing measurements into a green record or invents a threshold', () => {
    const result = classifyWorkRisk(scope, {
      ...observation,
      measuredLevel: null,
      observedAt: null,
    });
    expect(result.riskState).toBe('UNKNOWN');
    expect(result.missingEvidence).toEqual(['measured_level', 'observed_at']);
  });
  it('does not treat a completed task as evidence that its risk disappeared', () => {
    expect(
      classifyWorkRisk(scope, { ...observation, workState: 'done', measuredLevel: 3 }).riskState
    ).toBe('red');
  });
  it('keeps an AI suggestion unverified until a human review is supplied', () => {
    expect(
      classifyWorkRisk(scope, { ...observation, generatedBy: 'ai', measuredLevel: 3 }).riskState
    ).toBe('UNKNOWN');
    expect(
      classifyWorkRisk(scope, {
        ...observation,
        generatedBy: 'ai',
        measuredLevel: 3,
        acceptedByUserId: 'reviewer',
      }).riskState
    ).toBe('red');
  });
  it('filters both tenant and project before exposing records and denominator', () => {
    const result = buildWorkRiskReadModel(scope, [
      observation,
      { ...observation, organizationId: 'org-b' },
      { ...observation, projectId: 'project-b' },
      { ...observation, sourceId: 'unknown', measuredLevel: null },
    ]);
    expect(result.records.map((r) => r.sourceId)).toEqual(['task-1', 'unknown']);
    expect(result.total).toBe(2);
    expect(result.measured).toBe(1);
  });
  it('refuses unscoped reads and direct foreign classification', () => {
    expect(() => buildWorkRiskReadModel({ ...scope, projectId: '' }, [])).toThrow(
      'WORK_RISK_SCOPE_REQUIRED'
    );
    expect(() => classifyWorkRisk(scope, { ...observation, organizationId: 'org-b' })).toThrow(
      'WORK_RISK_SCOPE_MISMATCH'
    );
  });
});
