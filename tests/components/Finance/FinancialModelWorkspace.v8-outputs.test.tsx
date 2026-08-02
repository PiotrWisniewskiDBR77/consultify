/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
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
    addModelEvent: vi.fn(),
    approveModel: vi.fn(),
    computeModel: vi.fn(),
    createModel: vi.fn(),
    deleteModelEvent: vi.fn(),
    getModels: vi.fn(),
    getModel: vi.fn(),
    getModelOutputs: vi.fn(),
    getModelValidations: vi.fn(),
    updateModel: vi.fn(),
    // M16/6.5 — ModelVersionHistory (mounted unconditionally under the
    // `modelVersioning` flag, default ON per financeFeatureFlags.ts DEFAULT_ON)
    // is a real child of FinancialModelWorkspace and calls these on mount.
    // Missing from this mock → synchronous "is not a function" TypeError
    // that crashed every test in this file (test-stale, added after M16/6.5).
    getModelVersions: vi.fn().mockResolvedValue({ versions: [], count: 0 }),
    getModelVersionDiff: vi.fn().mockResolvedValue({ diff: null }),
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

const modelWithEvent = {
  ...baseModel,
  events: [
    {
      id: 'event-1',
      event_type: 'revenue',
      name: 'Existing contract',
      amount: 50000,
      recurrence: 'monthly',
      growth_rate: 0,
      cf_classification: 'operating',
      period_start: '2026-01-01',
      is_active: 1,
    },
  ],
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
    vi.mocked(V8FinanceApi.getModels).mockResolvedValue({ models: [] } as any);
    vi.mocked(V8FinanceApi.getModel).mockResolvedValue({ model: baseModel } as any);
    vi.mocked(V8FinanceApi.getModelValidations).mockResolvedValue({
      validations: [],
      summary: { total: 0, pass: 0, fail: 0, warning: 0 },
    } as any);
  });

  it('prefers governed model list before legacy fallback in the workspace', async () => {
    vi.mocked(V8FinanceApi.getModels).mockResolvedValue({
      models: [{ ...baseModel, id: 'model-2', name: 'Board model' }],
    } as any);

    render(<FinancialModelWorkspace hideSidebar />);

    await waitFor(() => {
      expect(V8FinanceApi.getModels).toHaveBeenCalled();
    });

    expect(Api.get).not.toHaveBeenCalledWith('/api/financial-modeling/models');
  });

  it('falls back to legacy model list in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getModels).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/financial-modeling/models') {
        return [{ ...baseModel, id: 'model-2', name: 'Legacy board model' }] as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<FinancialModelWorkspace hideSidebar />);

    await waitFor(() => {
      expect(Api.get).toHaveBeenCalledWith('/api/financial-modeling/models');
    });

    expect(V8FinanceApi.getModels).toHaveBeenCalled();
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

  it('prefers governed model compute before legacy fallback in the workspace', async () => {
    vi.mocked(V8FinanceApi.getModelOutputs).mockResolvedValue({ raw: [], grouped: {} } as any);
    vi.mocked(V8FinanceApi.computeModel).mockResolvedValue({ success: true } as any);

    render(<FinancialModelWorkspace initialModelId="model-1" hideSidebar />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Compute' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Compute' }));
    });

    await waitFor(() => {
      expect(V8FinanceApi.computeModel).toHaveBeenCalledWith('model-1');
    });

    expect(Api.post).not.toHaveBeenCalledWith('/api/financial-modeling/models/model-1/compute', {});
  });

  it('falls back to legacy model compute in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getModelOutputs).mockResolvedValue({ raw: [], grouped: {} } as any);
    vi.mocked(V8FinanceApi.computeModel).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({ success: true } as any);

    render(<FinancialModelWorkspace initialModelId="model-1" hideSidebar />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Compute' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Compute' }));
    });

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/api/financial-modeling/models/model-1/compute', {});
    });
  });

  it('prefers governed model approve before legacy fallback in the workspace', async () => {
    vi.mocked(V8FinanceApi.getModelOutputs).mockResolvedValue({ raw: [], grouped: {} } as any);
    vi.mocked(V8FinanceApi.approveModel).mockResolvedValue({ success: true, status: 'approved' } as any);

    render(<FinancialModelWorkspace initialModelId="model-1" hideSidebar />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    });

    await waitFor(() => {
      expect(V8FinanceApi.approveModel).toHaveBeenCalledWith('model-1');
    });

    expect(Api.post).not.toHaveBeenCalledWith('/api/financial-modeling/models/model-1/approve', {});
  });

  it('falls back to legacy model approve in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getModelOutputs).mockResolvedValue({ raw: [], grouped: {} } as any);
    vi.mocked(V8FinanceApi.approveModel).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({ success: true } as any);

    render(<FinancialModelWorkspace initialModelId="model-1" hideSidebar />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    });

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/api/financial-modeling/models/model-1/approve', {});
    });
  });

  it('prefers governed model assumptions save before legacy fallback in the workspace', async () => {
    vi.mocked(V8FinanceApi.getModel).mockResolvedValue({
      model: { ...baseModel, assumptions_json: { initialCash: 1000 } },
    } as any);
    vi.mocked(V8FinanceApi.getModelOutputs).mockResolvedValue({ raw: [], grouped: {} } as any);
    vi.mocked(V8FinanceApi.updateModel).mockResolvedValue({ success: true } as any);

    render(<FinancialModelWorkspace initialModelId="model-1" hideSidebar />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    await waitFor(() => {
      // FIN-03 CAS: the workspace now pins the write to the version it last
      // read (baseModel.version === 1) so a stale write 409s instead of
      // silently overwriting a concurrent change.
      expect(V8FinanceApi.updateModel).toHaveBeenCalledWith(
        'model-1',
        { assumptions: { initialCash: 1000 } },
        { expectedVersion: 1 },
      );
    });

    expect(Api.put).not.toHaveBeenCalledWith('/api/financial-modeling/models/model-1', {
      assumptions: { initialCash: 1000 },
    });
  });

  it('falls back to legacy model assumptions save in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getModel).mockResolvedValue({
      model: { ...baseModel, assumptions_json: { initialCash: 1000 } },
    } as any);
    vi.mocked(V8FinanceApi.getModelOutputs).mockResolvedValue({ raw: [], grouped: {} } as any);
    vi.mocked(V8FinanceApi.updateModel).mockRejectedValue({ status: 404 });
    vi.mocked(Api.put).mockResolvedValue({ success: true } as any);

    render(<FinancialModelWorkspace initialModelId="model-1" hideSidebar />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    await waitFor(() => {
      expect(Api.put).toHaveBeenCalledWith('/api/financial-modeling/models/model-1', {
        assumptions: { initialCash: 1000 },
      });
    });
  });

  it('prefers governed model create before legacy fallback in the workspace', async () => {
    vi.mocked(V8FinanceApi.createModel).mockResolvedValue({
      model: { id: 'model-created-1', name: 'Created model' },
    } as any);

    const { container } = render(<FinancialModelWorkspace />);
    const createLauncher = container.querySelector('button[class*="p-1.5"]');
    expect(createLauncher).not.toBeNull();

    fireEvent.click(createLauncher as HTMLButtonElement);
    fireEvent.change(screen.getByPlaceholderText('e.g. Initiative Alpha — 5yr projection'), {
      target: { value: 'Created model' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    });

    await waitFor(() => {
      expect(V8FinanceApi.createModel).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Created model',
        }),
      );
    });

    expect(Api.post).not.toHaveBeenCalledWith('/api/financial-modeling/models', expect.anything());
  });

  it('falls back to legacy model create in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.createModel).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({ id: 'model-created-legacy-1' } as any);

    const { container } = render(<FinancialModelWorkspace />);
    const createLauncher = container.querySelector('button[class*="p-1.5"]');
    expect(createLauncher).not.toBeNull();

    fireEvent.click(createLauncher as HTMLButtonElement);
    fireEvent.change(screen.getByPlaceholderText('e.g. Initiative Alpha — 5yr projection'), {
      target: { value: 'Legacy model' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    });

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith(
        '/api/financial-modeling/models',
        expect.objectContaining({
          name: 'Legacy model',
        }),
      );
    });
  });

  it('prefers governed model event create before legacy fallback in the workspace', async () => {
    vi.mocked(V8FinanceApi.getModelOutputs).mockResolvedValue({ raw: [], grouped: {} } as any);
    vi.mocked(V8FinanceApi.addModelEvent).mockResolvedValue({ success: true, id: 'event-1' } as any);

    const { container } = render(<FinancialModelWorkspace initialModelId="model-1" hideSidebar />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Events Timeline/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Events Timeline/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add Event' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Event' }));
    });

    const eventTextInputs = container.querySelectorAll('input');
    fireEvent.change(eventTextInputs[0] as HTMLInputElement, { target: { value: 'New contract' } });
    fireEvent.change(eventTextInputs[1] as HTMLInputElement, { target: { value: '120000' } });
    fireEvent.change(eventTextInputs[2] as HTMLInputElement, { target: { value: '2026-01-01' } });

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Add Event' })[1]);
    });

    await waitFor(() => {
      expect(V8FinanceApi.addModelEvent).toHaveBeenCalledWith(
        'model-1',
        expect.objectContaining({
          eventType: 'revenue',
          name: 'New contract',
          amount: 120000,
          periodStart: '2026-01-01',
          cfClassification: 'operating',
        }),
      );
    });

    expect(Api.post).not.toHaveBeenCalledWith(
      '/api/financial-modeling/models/model-1/events',
      expect.anything(),
    );
  });

  it('falls back to legacy model event create in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getModelOutputs).mockResolvedValue({ raw: [], grouped: {} } as any);
    vi.mocked(V8FinanceApi.addModelEvent).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({ success: true, id: 'event-legacy-1' } as any);

    const { container } = render(<FinancialModelWorkspace initialModelId="model-1" hideSidebar />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Events Timeline/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Events Timeline/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add Event' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Event' }));
    });

    const eventTextInputs = container.querySelectorAll('input');
    fireEvent.change(eventTextInputs[0] as HTMLInputElement, { target: { value: 'Legacy contract' } });
    fireEvent.change(eventTextInputs[1] as HTMLInputElement, { target: { value: '99000' } });
    fireEvent.change(eventTextInputs[2] as HTMLInputElement, { target: { value: '2026-01-01' } });

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Add Event' })[1]);
    });

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith(
        '/api/financial-modeling/models/model-1/events',
        expect.objectContaining({
          eventType: 'revenue',
          name: 'Legacy contract',
          amount: 99000,
          periodStart: '2026-01-01',
          cfClassification: 'operating',
        }),
      );
    });
  });

  it('prefers governed model event delete before legacy fallback in the workspace', async () => {
    vi.mocked(V8FinanceApi.getModel).mockResolvedValue({ model: modelWithEvent } as any);
    vi.mocked(V8FinanceApi.getModelOutputs).mockResolvedValue({ raw: [], grouped: {} } as any);
    vi.mocked(V8FinanceApi.deleteModelEvent).mockResolvedValue({
      success: true,
      deleted: 'event-1',
    } as any);

    render(<FinancialModelWorkspace initialModelId="model-1" hideSidebar />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Events Timeline/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Events Timeline/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete event' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete event' }));
    });

    await waitFor(() => {
      expect(V8FinanceApi.deleteModelEvent).toHaveBeenCalledWith('event-1');
    });

    expect(Api.delete).not.toHaveBeenCalledWith('/api/financial-modeling/events/event-1');
  });

  it('falls back to legacy model event delete in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getModel).mockResolvedValue({ model: modelWithEvent } as any);
    vi.mocked(V8FinanceApi.getModelOutputs).mockResolvedValue({ raw: [], grouped: {} } as any);
    vi.mocked(V8FinanceApi.deleteModelEvent).mockRejectedValue({ status: 404 });
    vi.mocked(Api.delete).mockResolvedValue({ success: true } as any);

    render(<FinancialModelWorkspace initialModelId="model-1" hideSidebar />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Events Timeline/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Events Timeline/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete event' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete event' }));
    });

    await waitFor(() => {
      expect(Api.delete).toHaveBeenCalledWith('/api/financial-modeling/events/event-1');
    });
  });
});
