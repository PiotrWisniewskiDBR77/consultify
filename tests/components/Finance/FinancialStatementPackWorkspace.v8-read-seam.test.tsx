/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const translationState = vi.hoisted(() => ({ language: 'en' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { get language() { return translationState.language; } },
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    getStatementAnalytics: vi.fn(),
    getStatementPack: vi.fn(),
    getStatement: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

vi.mock('../../../src/components/Finance/CanonicalStatementTable', () => ({
  CanonicalStatementTable: () => <div>canonical-statement-table</div>,
}));

vi.mock('../../../src/components/Finance/FinancialStatementWorkspace', () => ({
  FinancialStatementWorkspace: () => <div>financial-statement-workspace</div>,
}));

vi.mock('../../../src/components/Finance/StatementExplainPanel', () => ({
  StatementExplainPanel: () => <div>statement-explain-panel</div>,
}));

vi.mock('../../../src/components/Finance/StatementValidationBadges', () => ({
  StatementValidationBadges: () => <div>statement-validation-badges</div>,
}));

import { FinancialStatementPackWorkspace } from '../../../src/components/Finance/FinancialStatementPackWorkspace';
import { Api } from '../../../src/services/api';
import { V8FinanceApi } from '../../../src/services/api/v8/finance';

describe('FinancialStatementPackWorkspace V8 read seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    translationState.language = 'en';
  });

  it('localizes the durable pack scaling token in Polish cold view', async () => {
    translationState.language = 'pl';
    vi.mocked(V8FinanceApi.getStatementPack).mockResolvedValue({
      pack: {
        id: 'pack-pl', entity_name: 'CD PROJEKT S.A.', period_label: '2025 / 2024',
        period_start: '2024-01-01', period_end: '2025-12-31', currency: 'PLN',
        scaling: 'thousands', pack_status: 'pending', pack_readiness_status: 'recoverable',
        source_statement_count: 1,
        statements: [{ id: 'statement-pl', statement_type: 'P&L', source_file_name: 'statement.pdf' }],
        validations: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: { id: 'statement-pl', statement_type: 'P&L', period_label: '2025', values: [], validationLedger: [] },
    } as any);

    render(<FinancialStatementPackWorkspace statementPackId="pack-pl" />);
    await waitFor(() => expect(screen.getByText('Tysiące')).toBeInTheDocument());
    expect(screen.queryByText('thousands')).not.toBeInTheDocument();
  });

  it('prefers governed statement-pack detail before legacy fallback in the workspace', async () => {
    vi.mocked(V8FinanceApi.getStatementPack).mockResolvedValue({
      pack: {
        id: 'pack-1',
        entity_name: 'Acme Sp. z o.o.',
        period_label: 'Q1 2026',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        currency: 'PLN',
        scaling: 'units',
        pack_status: 'pending',
        pack_readiness_status: 'recoverable',
        source_statement_count: 0,
        statements: [{ id: 'statement-1', statement_type: 'P&L', source_file_name: 'acme-q1.csv' }],
        validations: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        values: [],
        validationLedger: [],
      },
    } as any);

    render(<FinancialStatementPackWorkspace statementPackId="pack-1" />);

    await waitFor(() => {
      expect(screen.getByText('Acme Sp. z o.o.')).toBeInTheDocument();
      expect(screen.getByText('Q1 2026')).toBeInTheDocument();
    });

    expect(V8FinanceApi.getStatementPack).toHaveBeenCalledWith('pack-1');
    expect(V8FinanceApi.getStatement).toHaveBeenCalledWith('statement-1');
    expect(Api.get).not.toHaveBeenCalledWith('/api/finance-statements/packs/pack-1');
    expect(Api.get).not.toHaveBeenCalledWith('/api/finance-statements/statement-1');
  });

  it('prefers governed statement analytics before legacy fallback in the workspace', async () => {
    vi.mocked(V8FinanceApi.getStatementPack).mockResolvedValue({
      pack: {
        id: 'pack-1',
        entity_name: 'Acme Sp. z o.o.',
        period_label: 'Q1 2026',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        currency: 'PLN',
        scaling: 'units',
        pack_status: 'pending',
        pack_readiness_status: 'recoverable',
        source_statement_count: 1,
        statements: [{ id: 'statement-1', statement_type: 'P&L', source_file_name: 'acme-q1.csv' }],
        validations: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        values: [],
        validationLedger: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatementAnalytics).mockResolvedValue({
      periods: [{ label: 'Q1 2026', index: 0 }],
      rows: [],
    } as any);

    render(<FinancialStatementPackWorkspace statementPackId="pack-1" />);

    await waitFor(() => {
      expect(V8FinanceApi.getStatementAnalytics).toHaveBeenCalledWith('statement-1', { level: 2 });
    });

    expect(Api.get).not.toHaveBeenCalledWith('/api/finance-statements/statement-1/analytics?level=2');
  });

  it('falls back to legacy statement-pack detail in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getStatementPack).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockResolvedValue({
      id: 'pack-legacy-1',
      entity_name: 'Legacy Co.',
      period_label: 'Q1 2026',
      period_start: '2026-01-01',
      period_end: '2026-03-31',
      currency: 'PLN',
      scaling: 'units',
      pack_status: 'pending',
      pack_readiness_status: 'recoverable',
      source_statement_count: 0,
      statements: [],
      validations: [],
    } as any);

    render(<FinancialStatementPackWorkspace statementPackId="pack-legacy-1" />);

    await waitFor(() => {
      expect(screen.getByText('Legacy Co.')).toBeInTheDocument();
      expect(screen.getByText('Q1 2026')).toBeInTheDocument();
    });

    expect(V8FinanceApi.getStatementPack).toHaveBeenCalledWith('pack-legacy-1');
    expect(Api.get).toHaveBeenCalledWith('/api/finance-statements/packs/pack-legacy-1');
  });

  it('falls back to legacy child statement detail in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getStatementPack).mockResolvedValue({
      pack: {
        id: 'pack-1',
        entity_name: 'Acme Sp. z o.o.',
        period_label: 'Q1 2026',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        currency: 'PLN',
        scaling: 'units',
        pack_status: 'pending',
        pack_readiness_status: 'recoverable',
        source_statement_count: 1,
        statements: [{ id: 'statement-1', statement_type: 'P&L', source_file_name: 'acme-q1.csv' }],
        validations: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatement).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/finance-statements/statement-1') {
        return {
          id: 'statement-1',
          statement_type: 'P&L',
          period_label: 'Q1 2026',
          values: [],
          validationLedger: [],
        } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<FinancialStatementPackWorkspace statementPackId="pack-1" />);

    await waitFor(() => {
      expect(screen.getByText('Acme Sp. z o.o.')).toBeInTheDocument();
      expect(screen.getByText('Q1 2026')).toBeInTheDocument();
    });

    expect(V8FinanceApi.getStatement).toHaveBeenCalledWith('statement-1');
    expect(Api.get).toHaveBeenCalledWith('/api/finance-statements/statement-1');
  });

  it('falls back to legacy statement analytics in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getStatementPack).mockResolvedValue({
      pack: {
        id: 'pack-1',
        entity_name: 'Acme Sp. z o.o.',
        period_label: 'Q1 2026',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        currency: 'PLN',
        scaling: 'units',
        pack_status: 'pending',
        pack_readiness_status: 'recoverable',
        source_statement_count: 1,
        statements: [{ id: 'statement-1', statement_type: 'P&L', source_file_name: 'acme-q1.csv' }],
        validations: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        values: [],
        validationLedger: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatementAnalytics).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/finance-statements/statement-1/analytics?level=2') {
        return {
          periods: [{ label: 'Q1 2026', index: 0 }],
          rows: [],
        } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<FinancialStatementPackWorkspace statementPackId="pack-1" />);

    await waitFor(() => {
      expect(Api.get).toHaveBeenCalledWith('/api/finance-statements/statement-1/analytics?level=2');
    });
  });
});
