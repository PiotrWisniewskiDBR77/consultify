/**
 * M14/F6 — execution report cron handlers (cadence + distribution).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbAll, findDueReports, processReportDistributions } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  findDueReports: vi.fn(),
  processReportDistributions: vi.fn(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({ all: (...a: any[]) => dbAll(...a) }));
vi.mock('../../../server/src/services/reportCadenceService.js', () => ({
  findDueReports: (...a: any[]) => findDueReports(...a),
}));
vi.mock('../../../server/src/services/executionDistributionService.js', () => ({
  default: { processReportDistributions: (...a: any[]) => processReportDistributions(...a) },
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import {
  runReportCadenceScan,
  runReportDistributionScan,
} from '../../../server/src/cron/ExecutionReportCron.js';

beforeEach(() => {
  vi.clearAllMocks();
  dbAll.mockResolvedValue([{ organization_id: 'org-1' }, { organization_id: 'org-2' }]);
});

describe('runReportCadenceScan', () => {
  it('aggregates due reports across orgs', async () => {
    findDueReports.mockResolvedValueOnce([{}, {}]).mockResolvedValueOnce([{}]);
    const r = await runReportCadenceScan(new Date());
    expect(r.orgs).toBe(2);
    expect(r.due).toBe(3);
    expect(r.errors).toBe(0);
  });
  it('fail-safe: one org error does not abort the run', async () => {
    findDueReports.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([{}]);
    const r = await runReportCadenceScan(new Date());
    expect(r.errors).toBe(1);
    expect(r.due).toBe(1);
  });
});

describe('runReportDistributionScan', () => {
  it('aggregates sent/failed across orgs', async () => {
    processReportDistributions
      .mockResolvedValueOnce({ sent: 2, failed: 0 })
      .mockResolvedValueOnce({ sent: 1, failed: 1 });
    const r = await runReportDistributionScan();
    expect(r.sent).toBe(3);
    expect(r.failed).toBe(1);
  });
});
