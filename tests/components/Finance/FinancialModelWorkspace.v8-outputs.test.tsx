/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('@/services/api', () => {
  const api = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
  return {
    Api: api,
    default: api,
  };
});

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    getModel: vi.fn(),
    getModelOutputs: vi.fn(),
    getModelValidations: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

vi.mock('../../../src/components/Finance/ExportButton', () => ({
  ExportButton: () => <div>export-button</div>,
}));

import { FinancialModelWorkspace } from '../../../src/components/Finance/FinancialModelWorkspace';
import Api from '../../../src/services/api';
import { V8FinanceApi } from '../../../src/services/api/v8/finance';

const baseModel = {
  id: 'model-1',
  name: 'Revenue forecast',
  currency: 'PLN',
  horizon_months: 36,
  start_date: '2026-01-01',
  granularity: 'monthly',
  scenario: 'base',
  status: 'draft',
  version: 1,
  assumptions_json: {},
  events: [],
};

describe('FinancialModelWorkspace V8 outputs seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/financial-modeling/models') {
        return [];
      }
      throw new Error(`Unexpected GET ${url}`);
    });
    vi.mocked(V8FinanceApi.getModel).mockResolvedValue({ model: baseModel } as any);
    vi.mocked(V8FinanceApi.getModelValidations).mockResolvedValue({
      validations: [],
      summary: { total: 0, pass: 0, fail: 0, warning: 0 },
    } as any);
  });

  it('prefers governed model outputs before legacy fallback in the workspace', async () => {
    vi.mocked(V8FinanceApi.getModelOutputs).mockResolvedValue({
      raw: [{ period_label: '2026-01', statement_type: 'P&L', line_code: 'REV', value: 100 }],
      grouped: {
        '2026-01': {
          'P&L': [{ lineCode: 'REV', lineName: 'Revenue', value: 100 }],
        },
      },
    } as any);

    render(<FinancialModelWorkspace initialModelId="model-1" hideSidebar />);

    await waitFor(() => {
      expect(V8FinanceApi.getModelOutputs).toHaveBeenCalledWith('model-1');
    });

    expect(Api.get).not.toHaveBeenCalledWith('/api/financial-modeling/models/model-1/outputs');
  });

  it('falls back to legacy model outputs in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getModelOutputs).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/financial-modeling/models') {
        return [];
      }
      if (url === '/api/financial-modeling/models/model-1/outputs') {
        return {
          raw: [{ period_label: '2026-01', statement_type: 'P&L', line_code: 'REV', value: 100 }],
          grouped: {
            '2026-01': {
              'P&L': [{ lineCode: 'REV', lineName: 'Revenue', value: 100 }],
            },
          },
        } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<FinancialModelWorkspace initialModelId="model-1" hideSidebar />);

    await waitFor(() => {
      expect(Api.get).toHaveBeenCalledWith('/api/financial-modeling/models/model-1/outputs');
    });

    expect(V8FinanceApi.getModelOutputs).toHaveBeenCalledWith('model-1');
  });
});
