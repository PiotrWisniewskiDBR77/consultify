/**
 * @vitest-environment jsdom
 *
 * S6.4a — Model creation grounds on an approved statement by default (DEC-3).
 * The source-selection component must:
 *  - default to the newest Approved statement (not "start from zero"),
 *  - pass sourceStatementPackId in the create payload,
 *  - let the user opt into "Start from zero" (no source), which drops the id.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const createModel = vi.fn();
vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    createModel: (...args: unknown[]) => createModel(...args),
    getModel: vi.fn(),
  },
  shouldFallbackToLegacyFinance: () => false,
}));

vi.mock('@/services/api', () => {
  const api = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
  return { Api: api, default: api };
});

import { CreateModelModal } from '../../../src/components/Economics/modals/CreateModelModal';
import type { FinanceStatementRow } from '../../../src/components/Economics/financeTypes';

function statement(over: Partial<FinanceStatementRow>): FinanceStatementRow {
  return {
    id: 'stmt-old',
    title: 'Old',
    kind: 'statements',
    status: 'APPROVED',
    statementType: 'PACK',
    entityName: 'ACME',
    periodStart: '2024-01-01',
    periodEnd: '2024-12-31',
    periodLabel: 'FY2024',
    currency: 'PLN',
    scaling: 'units',
    sourceFileName: '',
    validationStatus: 'ready',
    mappedLineCount: 10,
    totalLineCount: 10,
    unmappedLineCount: 0,
    overallConfidence: 1,
    rawStatus: 'ready',
    readinessStatus: 'ready',
    isWorkable: true,
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...over,
  } as FinanceStatementRow;
}

const NEWEST = statement({
  id: 'stmt-new',
  periodLabel: 'FY2025',
  updatedAt: '2025-06-01T00:00:00.000Z',
});
const OLDER = statement({
  id: 'stmt-old',
  periodLabel: 'FY2024',
  updatedAt: '2024-06-01T00:00:00.000Z',
});

describe('CreateModelModal — default grounding (DEC-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createModel.mockResolvedValue({ model: { id: 'model-1', name: 'X', status: 'draft' } });
  });

  it('defaults to grounding on the newest approved statement', async () => {
    render(
      <CreateModelModal
        availableStatements={[OLDER, NEWEST]}
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // The "Latest approved (default)" chip proves the newest is preselected.
    expect(screen.getByText('Latest approved (default)')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/5yr projection/i), {
      target: { value: 'My grounded model' },
    });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(createModel).toHaveBeenCalled());
    const payload = createModel.mock.calls[0][0] as any;
    expect(payload.sourceStatementPackId).toBe('stmt-new');
  });

  it('drops the source when the user starts from zero', async () => {
    render(
      <CreateModelModal
        availableStatements={[OLDER, NEWEST]}
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Start from zero'));
    fireEvent.change(screen.getByPlaceholderText(/5yr projection/i), {
      target: { value: 'Zero model' },
    });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(createModel).toHaveBeenCalled());
    const payload = createModel.mock.calls[0][0] as any;
    expect(payload.sourceStatementPackId).toBeUndefined();
  });
});
