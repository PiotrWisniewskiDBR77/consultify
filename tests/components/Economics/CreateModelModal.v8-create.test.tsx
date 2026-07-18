/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    createModel: vi.fn(),
    getModel: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { CreateModelModal } from '@/components/Economics/modals/CreateModelModal';
import { Api } from '@/services/api';
import { V8FinanceApi } from '@/services/api/v8/finance';

const statements = [
  {
    id: 'pack-1',
    entityName: 'Atelier',
    title: 'Atelier FY25',
    currency: 'PLN',
    periodLabel: 'FY 2025',
    periodEnd: '2025-12-31',
    readinessStatus: 'ready',
  },
] as any;

describe('CreateModelModal V8 create seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers governed model creation before legacy fallback', async () => {
    const onCreated = vi.fn();
    vi.mocked(V8FinanceApi.createModel).mockResolvedValue({
      model: {
        id: 'model-1',
        name: 'FY 2025 forecast',
        status: 'draft',
        scenario: 'base',
        currency: 'PLN',
        horizon_months: 60,
        start_date: '2026-01-01',
        source_statement_pack_id: 'pack-1',
      },
    } as any);

    render(
      <CreateModelModal
        onCreated={onCreated}
        onClose={vi.fn()}
        availableStatements={statements}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create from statement' }));
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'pack-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(V8FinanceApi.createModel).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceStatementPackId: 'pack-1',
          startDate: '2026-01-01',
        }),
      );
    });

    expect(Api.post).not.toHaveBeenCalledWith('/api/financial-modeling/models', expect.anything());
    expect(onCreated).toHaveBeenCalled();
  });

  it('falls back to legacy model creation on bounded compatibility statuses', async () => {
    const onCreated = vi.fn();
    vi.mocked(V8FinanceApi.createModel).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({
      id: 'model-legacy-1',
    } as any);

    render(
      <CreateModelModal
        onCreated={onCreated}
        onClose={vi.fn()}
        availableStatements={statements}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create from statement' }));
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'pack-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith(
        '/api/financial-modeling/models',
        expect.objectContaining({
          sourceStatementPackId: 'pack-1',
          startDate: '2026-01-01',
        }),
      );
    });

    expect(onCreated).toHaveBeenCalled();
  });
});
