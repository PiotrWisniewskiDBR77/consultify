/**
 * R1 Smoke: V4-FINC-01..07 — Finance Enterprise Service
 * Verifies: model versions, budgets, forecasts, connectors, valuations, AI assumptions, ROI
 */

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  queryRun: vi.fn().mockResolvedValue({ changes: 1 }),
}));
vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import financeEnterpriseService from '../../../../server/src/services/financeEnterpriseService.js';

describe('V4-FINC: Finance Enterprise Service', () => {
  it('exports createModelVersion', () => {
    expect(typeof financeEnterpriseService.createModelVersion).toBe('function');
  });
  it('exports getModelVersions', () => {
    expect(typeof financeEnterpriseService.getModelVersions).toBe('function');
  });
  it('exports createBudgetVersion', () => {
    expect(typeof financeEnterpriseService.createBudgetVersion).toBe('function');
  });
  it('exports createForecastCycle', () => {
    expect(typeof financeEnterpriseService.createForecastCycle).toBe('function');
  });
  it('exports createConnector', () => {
    expect(typeof financeEnterpriseService.createConnector).toBe('function');
  });
  it('exports createValuationSnapshot', () => {
    expect(typeof financeEnterpriseService.createValuationSnapshot).toBe('function');
  });
  it('exports createAIAssumption', () => {
    expect(typeof financeEnterpriseService.createAIAssumption).toBe('function');
  });
  it('exports createROILink', () => {
    expect(typeof financeEnterpriseService.createROILink).toBe('function');
  });
  it('exports captureRealizedValue', () => {
    expect(typeof financeEnterpriseService.captureRealizedValue).toBe('function');
  });

  it('getModelVersions() returns an array', async () => {
    const result = await financeEnterpriseService.getModelVersions('org-1', 'model-1');
    expect(Array.isArray(result)).toBe(true);
  });
});
