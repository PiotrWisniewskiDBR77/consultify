/**
 * R1 Smoke: V4-ENT-01,02,05,06,07,08 — Enterprise Platform Service
 * Verifies: connectors, queue, secrets, metrics, SLOs, DR drills
 */

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  queryRun: vi.fn().mockResolvedValue({ changes: 1 }),
}));
vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { enterprisePlatformService } from '../../../../server/src/services/enterprisePlatformService.js';

describe('V4-ENT: Enterprise Platform Service', () => {
  it('exports createConnector', () => {
    expect(typeof enterprisePlatformService.createConnector).toBe('function');
  });
  it('exports getConnectors', () => {
    expect(typeof enterprisePlatformService.getConnectors).toBe('function');
  });
  it('exports enqueueMessage', () => {
    expect(typeof enterprisePlatformService.enqueueMessage).toBe('function');
  });
  it('exports storeSecret', () => {
    expect(typeof enterprisePlatformService.storeSecret).toBe('function');
  });
  it('exports recordMetric', () => {
    expect(typeof enterprisePlatformService.recordMetric).toBe('function');
  });
  it('exports createSlo', () => {
    expect(typeof enterprisePlatformService.createSlo).toBe('function');
  });
  it('exports createDrDrill', () => {
    expect(typeof enterprisePlatformService.createDrDrill).toBe('function');
  });

  it('getConnectors() returns an array', async () => {
    const result = await enterprisePlatformService.getConnectors('org-1');
    expect(Array.isArray(result)).toBe(true);
  });
  it('getSlos() returns an array', async () => {
    const result = await enterprisePlatformService.getSlos('org-1');
    expect(Array.isArray(result)).toBe(true);
  });
  it('getDrDrills() returns an array', async () => {
    const result = await enterprisePlatformService.getDrDrills('org-1');
    expect(Array.isArray(result)).toBe(true);
  });
});
