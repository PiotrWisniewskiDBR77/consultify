/**
 * M15/W1 (G1 bridge) — promoteBenefitToKpi: benefits_register → initiative_kpis.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbAll, dbGet, dbRun, createKpiDefinition } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
  createKpiDefinition: vi.fn(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...a: any[]) => dbAll(...a),
  get: (...a: any[]) => dbGet(...a),
  run: (...a: any[]) => dbRun(...a),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
// RES-02: promoteBenefitToKpi mints the KPI through kpiDefinitionService (the
// canonical writer) instead of an inline INSERT INTO initiative_kpis.
vi.mock('../../../server/src/services/results/kpiDefinitionService.js', () => ({
  createDefinition: (...a: any[]) => createKpiDefinition(...a),
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
  createKpiDefinition.mockResolvedValue({ id: 'new-kpi-id' });
});

describe('promoteBenefitToKpi', () => {
  it('creates the KPI definition (canonical service) and marks the benefit promoted (org-scoped)', async () => {
    dbGet.mockResolvedValueOnce({ ...benefit });
    const r = await promoteBenefitToKpi(ORG, 'b1');
    expect(r.alreadyPromoted).toBe(false);
    expect(r.kpiId).toBe('new-kpi-id');

    // RES-02: canonical write goes through kpiDefinitionService — no direct
    // INSERT INTO initiative_kpis in this service anymore.
    expect(createKpiDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        initiativeId: 'i1',
        name: 'Czas cyklu (dni)',
        baselineValue: 10,
        targetValue: 6,
      })
    );
    expect(dbRun.mock.calls.some((c) => /INSERT INTO initiative_kpis/.test(String(c[0])))).toBe(
      false
    );
    const update = dbRun.mock.calls.find((c) =>
      /UPDATE benefits_register SET promoted_kpi_id/.test(String(c[0]))
    );
    expect(update).toBeTruthy();
    expect(update?.[1]).toContain('b1');
    expect(update?.[1]).toContain(ORG);
  });

  it('is idempotent — already-promoted benefit returns its existing KPI without a new definition', async () => {
    dbGet.mockResolvedValueOnce({ ...benefit, promoted_kpi_id: 'kpi-existing' });
    const r = await promoteBenefitToKpi(ORG, 'b1');
    expect(r.alreadyPromoted).toBe(true);
    expect(r.kpiId).toBe('kpi-existing');
    expect(createKpiDefinition).not.toHaveBeenCalled();
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('throws benefit_not_found when the benefit is missing / cross-org', async () => {
    dbGet.mockResolvedValueOnce(undefined);
    await expect(promoteBenefitToKpi(ORG, 'nope')).rejects.toThrow('benefit_not_found');
  });

  it('maps cadence to KPI measurement frequency', async () => {
    dbGet.mockResolvedValueOnce({ ...benefit, cadence: 'weekly' });
    await promoteBenefitToKpi(ORG, 'b1');
    expect(createKpiDefinition.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ measurementFrequency: 'WEEKLY' })
    );
  });
});
