/**
 * M15/W1 (G1 bridge) — promoteBenefitToKpi: benefits_register → initiative_kpis.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbAll, dbGet, dbRun } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...a: any[]) => dbAll(...a),
  get: (...a: any[]) => dbGet(...a),
  run: (...a: any[]) => dbRun(...a),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { promoteBenefitToKpi } from '../../../server/src/services/benefitsRegisterService.js';

const ORG = 'org-1';
const benefit = {
  id: 'b1',
  organization_id: ORG,
  initiative_id: 'i1',
  name: 'Skrócenie czasu cyklu',
  owner_id: 'u1',
  kpi_name: 'Czas cyklu (dni)',
  baseline_value: 10,
  target_value: 6,
  current_value: null,
  cadence: 'monthly',
  status: 'tracking',
  source: 'M14_CLOSURE_HANDOFF',
  promoted_kpi_id: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  dbRun.mockResolvedValue(undefined);
});

describe('promoteBenefitToKpi', () => {
  it('inserts an initiative_kpis row and marks the benefit promoted (org-scoped)', async () => {
    dbGet.mockResolvedValueOnce({ ...benefit });
    const r = await promoteBenefitToKpi(ORG, 'b1');
    expect(r.alreadyPromoted).toBe(false);
    expect(r.kpiId).toBeTruthy();
    const insert = dbRun.mock.calls[0];
    expect(String(insert[0])).toMatch(/INSERT INTO initiative_kpis/);
    expect(insert[1]).toContain(ORG);
    expect(insert[1]).toContain('Czas cyklu (dni)');
    expect(insert[1]).toContain(10);
    expect(insert[1]).toContain(6);
    const update = dbRun.mock.calls[1];
    expect(String(update[0])).toMatch(/UPDATE benefits_register SET promoted_kpi_id/);
    expect(update[1]).toContain('b1');
    expect(update[1]).toContain(ORG);
  });

  it('is idempotent — already-promoted benefit returns its existing KPI without insert', async () => {
    dbGet.mockResolvedValueOnce({ ...benefit, promoted_kpi_id: 'kpi-existing' });
    const r = await promoteBenefitToKpi(ORG, 'b1');
    expect(r.alreadyPromoted).toBe(true);
    expect(r.kpiId).toBe('kpi-existing');
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('throws benefit_not_found when the benefit is missing / cross-org', async () => {
    dbGet.mockResolvedValueOnce(undefined);
    await expect(promoteBenefitToKpi(ORG, 'nope')).rejects.toThrow('benefit_not_found');
  });

  it('maps cadence to KPI measurement frequency', async () => {
    dbGet.mockResolvedValueOnce({ ...benefit, cadence: 'weekly' });
    await promoteBenefitToKpi(ORG, 'b1');
    expect(dbRun.mock.calls[0][1]).toContain('WEEKLY');
  });
});
