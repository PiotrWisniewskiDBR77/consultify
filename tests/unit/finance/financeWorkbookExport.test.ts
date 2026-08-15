import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
  getCaseScenarios: vi.fn(),
  getModel: vi.fn(),
}));

vi.mock('../../../src/services/api', () => ({ Api: { post: mocks.apiPost } }));
vi.mock('../../../src/services/api/v8/finance', () => ({
  V8FinanceApi: {
    getCaseScenarios: mocks.getCaseScenarios,
    getModel: mocks.getModel,
  },
}));

import {
  buildFinanceWorkbookParams,
  exportFinancialModelWorkbook,
} from '../../../src/services/financeExportService';

const model = (scenario: string, revenue: number, cogs: number) => ({
  id: scenario,
  name: 'Golden Co',
  scenario,
  currency: 'EUR',
  start_date: '2027-01-01',
  assumptions_json: {
    revenueGrowthPct: scenario === 'bull' ? 0.12 : scenario === 'bear' ? -0.05 : 0.04,
    taxRatePct: 0.19,
    baseline: { revenue, cogs, opex: 200, depreciation: 50, interest: 25 },
  },
});

describe('Finance -> deterministic workbook contract', () => {
  it('maps persisted Base/Bull/Bear values without template defaults', () => {
    const params = buildFinanceWorkbookParams([
      model('base', 1000, 500),
      model('bull', 1200, 540),
      model('bear', 900, 540),
    ] as any);
    expect(params).toMatchObject({
      companyName: 'Golden Co',
      currencyCode: 'EUR',
      startYear: 2027,
      baseRevenue: 1000,
      'base.cogsPct': 0.5,
      'bull.cogsPct': 0.45,
      'bear.cogsPct': 0.6,
      'bull.revenueGrowthPct': 0.12,
      'bear.taxRatePct': 0.19,
    });
  });

  it('fails closed instead of inventing a missing scenario', () => {
    expect(() => buildFinanceWorkbookParams([model('base', 1000, 500)] as any)).toThrow(
      /persisted bull scenario/
    );
  });

  it('fails closed when ratios cannot be derived from zero revenue', () => {
    expect(() =>
      buildFinanceWorkbookParams([
        model('base', 1000, 500),
        model('bull', 1200, 540),
        model('bear', 0, 0),
      ] as any)
    ).toThrow(/zero bear revenue/);
  });

  it('builds through the persisted workbook endpoint and requires its durable identity', async () => {
    const models = [
      model('base', 1000, 500),
      model('bull', 1200, 540),
      model('bear', 900, 540),
    ] as any[];
    mocks.getCaseScenarios.mockResolvedValueOnce({
      scenarios: models.map(({ id }) => ({ id })),
    });
    mocks.getModel.mockImplementation(async (id: string) => ({
      model: models.find((candidate) => candidate.id === id),
    }));
    mocks.apiPost.mockResolvedValueOnce({
      id: 'workbook-1',
      downloadUrl: '/api/workbook/workbook-1/download',
      title: 'Golden Co scenarios',
    });

    await expect(exportFinancialModelWorkbook({ modelId: 'base' })).resolves.toMatchObject({
      outputId: 'workbook-1',
      outputType: 'workbook',
    });
    expect(mocks.apiPost).toHaveBeenCalledWith(
      '/workbook/templates/threeScenarioPnL/build',
      expect.objectContaining({ params: expect.objectContaining({ companyName: 'Golden Co' }) })
    );
  });
});
