/**
 * R1 Smoke: V4-AI-01..08 — AI Governance Service
 * Verifies: metering, eval datasets, evaluations, policies, enforcement
 */

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  queryRun: vi.fn().mockResolvedValue({ changes: 1 }),
}));
vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as aiGov from '../../../../server/src/services/aiGovernanceService.js';

describe('V4-AI: AI Governance Service', () => {
  it('exports getMeteringDashboard', () => {
    expect(typeof aiGov.getMeteringDashboard).toBe('function');
  });
  it('exports getMeteringByPurpose', () => {
    expect(typeof aiGov.getMeteringByPurpose).toBe('function');
  });
  it('exports listEvalDatasets', () => {
    expect(typeof aiGov.listEvalDatasets).toBe('function');
  });
  it('exports createEvalDataset', () => {
    expect(typeof aiGov.createEvalDataset).toBe('function');
  });
  it('exports runEvaluation', () => {
    expect(typeof aiGov.runEvaluation).toBe('function');
  });
  it('exports getGovernancePolicies', () => {
    expect(typeof aiGov.getGovernancePolicies).toBe('function');
  });
  it('exports createGovernancePolicy', () => {
    expect(typeof aiGov.createGovernancePolicy).toBe('function');
  });
  it('exports enforcePolicy', () => {
    expect(typeof aiGov.enforcePolicy).toBe('function');
  });
});
