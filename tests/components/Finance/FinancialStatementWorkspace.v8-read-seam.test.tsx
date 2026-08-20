/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const translationState = vi.hoisted(() => ({ language: 'en' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      (typeof fallback === 'string' ? fallback : fallback?.defaultValue) || _key,
    i18n: { get language() { return translationState.language; } },
  }),
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
    getStatements: vi.fn(),
    getStatement: vi.fn(),
    getStatementRatios: vi.fn(),
    searchStatementDocumentIntelligence: vi.fn(),
    detectStatement: vi.fn(),
    extractStatement: vi.fn(),
    mapStatement: vi.fn(),
    confirmStatement: vi.fn(),
    putStatementValues: vi.fn(),
    getCanonicalLines: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

vi.mock('../../../src/components/Finance/FinancialStatementMappingEditor', () => ({
  FinancialStatementMappingEditor: () => <div>financial-statement-mapping-editor</div>,
}));

import { FinancialStatementWorkspace } from '../../../src/components/Finance/FinancialStatementWorkspace';
import Api from '../../../src/services/api';
import { V8FinanceApi } from '../../../src/services/api/v8/finance';

describe('FinancialStatementWorkspace V8 read seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    translationState.language = 'en';
  });

  it('prefers governed child statement detail before legacy fallback in the workspace', async () => {
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        currency: 'PLN',
        scaling: 'units',
        source_file_name: 'acme-q1.csv',
        validation_status: 'pending',
        status: 'draft',
        readinessStatus: 'recoverable',
        validationMessages: [],
        values: [],
        qualityRuns: [],
        ingestRuns: [],
      },
    } as any);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected GET ${url}`);
    });
    vi.mocked(V8FinanceApi.getStatements).mockResolvedValue({
      statements: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.getStatementRatios).mockResolvedValue({
      ratios: {
        statementId: 'statement-1',
        periodLabel: 'Q1 2026',
        ratios: [],
        coverageSummary: { coveragePct: 0, computed: 0, total: 0 },
      },
    } as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [{ id: 'line-1', line_name: 'Revenue', line_name_pl: 'Przychody' }],
      count: 1,
    } as any);

    render(<FinancialStatementWorkspace statementId="statement-1" />);

    await waitFor(() => {
      expect(screen.getAllByText('Q1 2026').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/2026-01-01/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/2026-03-31/).length).toBeGreaterThan(0);
    });

    expect(V8FinanceApi.getStatement).toHaveBeenCalledWith('statement-1');
    expect(V8FinanceApi.getStatements).toHaveBeenCalled();
    expect(V8FinanceApi.getStatementRatios).toHaveBeenCalledWith('statement-1');
    expect(V8FinanceApi.getCanonicalLines).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/api/finance-statements/statement-1');
    expect(Api.get).not.toHaveBeenCalledWith('/api/finance-statements');
    expect(Api.get).not.toHaveBeenCalledWith('/api/finance-statements/statement-1/ratios');
    expect(Api.get).not.toHaveBeenCalledWith('/api/finance-statements/canonical-lines');
  });

  it('falls back to legacy child statement detail in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getStatement).mockRejectedValue({ status: 404 });
    vi.mocked(V8FinanceApi.getStatements).mockResolvedValue({
      statements: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.getStatementRatios).mockResolvedValue({
      ratios: {
        statementId: 'statement-1',
        periodLabel: 'Q1 2026',
        ratios: [],
        coverageSummary: { coveragePct: 0, computed: 0, total: 0 },
      },
    } as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [],
      count: 0,
    } as any);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/finance-statements/statement-1') {
        return {
          id: 'statement-1',
          statement_type: 'P&L',
          period_label: 'Q1 2026',
          period_start: '2026-01-01',
          period_end: '2026-03-31',
          currency: 'PLN',
          scaling: 'units',
          source_file_name: 'acme-q1.csv',
          validation_status: 'pending',
          status: 'draft',
          readinessStatus: 'recoverable',
          validationMessages: [],
          values: [],
          qualityRuns: [],
          ingestRuns: [],
        } as any;
      }
      if (url === '/api/finance-statements') {
        return [] as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<FinancialStatementWorkspace statementId="statement-1" />);

    await waitFor(() => {
      expect(screen.getAllByText('Q1 2026').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/2026-01-01/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/2026-03-31/).length).toBeGreaterThan(0);
    });

    expect(V8FinanceApi.getStatement).toHaveBeenCalledWith('statement-1');
    expect(Api.get).toHaveBeenCalledWith('/api/finance-statements/statement-1');
  });

  it('falls back to legacy canonical lines in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        currency: 'PLN',
        scaling: 'units',
        source_file_name: 'acme-q1.csv',
        validation_status: 'pending',
        status: 'draft',
        readinessStatus: 'recoverable',
        validationMessages: [],
        values: [],
        qualityRuns: [],
        ingestRuns: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatements).mockResolvedValue({
      statements: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.getStatementRatios).mockResolvedValue({
      ratios: {
        statementId: 'statement-1',
        periodLabel: 'Q1 2026',
        ratios: [],
        coverageSummary: { coveragePct: 0, computed: 0, total: 0 },
      },
    } as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/finance-statements/canonical-lines') {
        return [{ id: 'line-1', line_name: 'Revenue', line_name_pl: 'Przychody' }] as any;
      }
      if (url === '/api/finance-statements') {
        return [] as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<FinancialStatementWorkspace statementId="statement-1" />);

    await waitFor(() => {
      expect(screen.getAllByText('Q1 2026').length).toBeGreaterThan(0);
    });

    expect(V8FinanceApi.getCanonicalLines).toHaveBeenCalled();
    expect(Api.get).toHaveBeenCalledWith('/api/finance-statements/canonical-lines');
  });

  it('falls back to legacy statement ratios in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        currency: 'PLN',
        scaling: 'units',
        source_file_name: 'acme-q1.csv',
        validation_status: 'pending',
        status: 'draft',
        readinessStatus: 'recoverable',
        validationMessages: [],
        values: [],
        qualityRuns: [],
        ingestRuns: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatements).mockResolvedValue({
      statements: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.getStatementRatios).mockRejectedValue({ status: 404 });
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [],
      count: 0,
    } as any);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/finance-statements/statement-1/ratios') {
        return {
          ratios: [{ code: 'CURRENT_RATIO', name: 'Current Ratio', value: 1.42, status: 'ok' }],
          coverageSummary: { coveragePct: 100, computed: 1, total: 1 },
        } as any;
      }
      if (url === '/api/finance-statements') {
        return [] as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<FinancialStatementWorkspace statementId="statement-1" />);

    await waitFor(() => {
      expect(Api.get).toHaveBeenCalledWith('/api/finance-statements/statement-1/ratios');
    });

    expect(V8FinanceApi.getStatementRatios).toHaveBeenCalledWith('statement-1');
    expect(Api.get).toHaveBeenCalledWith('/api/finance-statements/statement-1/ratios');
  });

  it('falls back to legacy related statement list in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        currency: 'PLN',
        scaling: 'units',
        source_file_name: 'acme-q1.csv',
        validation_status: 'pending',
        status: 'draft',
        readinessStatus: 'recoverable',
        validationMessages: [],
        values: [],
        qualityRuns: [],
        ingestRuns: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatements).mockRejectedValue({ status: 404 });
    vi.mocked(V8FinanceApi.getStatementRatios).mockResolvedValue({
      ratios: {
        statementId: 'statement-1',
        periodLabel: 'Q1 2026',
        ratios: [],
        coverageSummary: { coveragePct: 0, computed: 0, total: 0 },
      },
    } as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [],
      count: 0,
    } as any);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/finance-statements') {
        return [
          {
            id: 'statement-2',
            statement_type: 'BS',
            period_label: 'Q1 2026',
            period_end: '2026-03-31',
            source_file_name: 'acme-bs.csv',
            readiness_status: 'ready',
            mapped_line_count: 12,
            unmapped_line_count: 0,
          },
        ] as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<FinancialStatementWorkspace statementId="statement-1" />);

    await waitFor(() => {
      expect(Api.get).toHaveBeenCalledWith('/api/finance-statements');
    });

    expect(V8FinanceApi.getStatements).toHaveBeenCalled();
    expect(Api.get).toHaveBeenCalledWith('/api/finance-statements');
    expect(screen.getByText('acme-bs.csv')).toBeTruthy();
  });

  it('prefers governed document-intelligence search before legacy fallback in the workspace', async () => {
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        currency: 'PLN',
        scaling: 'units',
        source_file_name: 'acme-q1.csv',
        validation_status: 'pending',
        status: 'draft',
        readinessStatus: 'recoverable',
        validationMessages: [],
        values: [],
        qualityRuns: [],
        ingestRuns: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatements).mockResolvedValue({
      statements: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.getStatementRatios).mockResolvedValue({
      ratios: {
        statementId: 'statement-1',
        periodLabel: 'Q1 2026',
        ratios: [],
        coverageSummary: { coveragePct: 0, computed: 0, total: 0 },
      },
    } as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.searchStatementDocumentIntelligence).mockResolvedValue({
      statementId: 'statement-1',
      query: 'revenue',
      matches: [{ chunkText: 'Revenue increased due to seasonality.', score: 0.91 }],
      authoritativeForNumbers: false,
    } as any);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<FinancialStatementWorkspace statementId="statement-1" />);

    await waitFor(() => {
      expect(screen.getAllByText('Q1 2026').length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByPlaceholderText('Ask the report'), {
      target: { value: 'revenue' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(screen.getByText('Revenue increased due to seasonality.')).toBeTruthy();
    });

    expect(V8FinanceApi.searchStatementDocumentIntelligence).toHaveBeenCalledWith('statement-1', {
      q: 'revenue',
    });
    expect(Api.get).not.toHaveBeenCalledWith(
      '/api/finance-statements/statement-1/document-intelligence/search?q=revenue',
    );
  });

  it('prefers governed confirm action before legacy fallback in the workspace', async () => {
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        currency: 'PLN',
        scaling: 'units',
        source_file_name: 'acme-q1.csv',
        validation_status: 'pass',
        status: 'mapped',
        readinessStatus: 'ready',
        validationMessages: [],
        values: [{ id: 'value-1', original_label: 'Revenue', value: 100, mapping_status: 'mapped' }],
        qualityRuns: [],
        ingestRuns: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatements).mockResolvedValue({
      statements: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.getStatementRatios).mockResolvedValue({
      ratios: {
        statementId: 'statement-1',
        periodLabel: 'Q1 2026',
        ratios: [],
        coverageSummary: { coveragePct: 0, computed: 0, total: 0 },
      },
    } as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.confirmStatement).mockResolvedValue({
      success: true,
      statementId: 'statement-1',
      status: 'confirmed',
    } as any);
    vi.mocked(Api.post).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected POST ${url}`);
    });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<FinancialStatementWorkspace statementId="statement-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Potwierdź statement' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Potwierdź statement' }));

    await waitFor(() => {
      expect(V8FinanceApi.confirmStatement).toHaveBeenCalledWith('statement-1');
    });

    expect(Api.post).not.toHaveBeenCalledWith('/api/finance-statements/statement-1/confirm', {});
  });

  it('falls back to legacy confirm action in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        currency: 'PLN',
        scaling: 'units',
        source_file_name: 'acme-q1.csv',
        validation_status: 'pass',
        status: 'mapped',
        readinessStatus: 'ready',
        validationMessages: [],
        values: [{ id: 'value-1', original_label: 'Revenue', value: 100, mapping_status: 'mapped' }],
        qualityRuns: [],
        ingestRuns: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatements).mockResolvedValue({
      statements: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.getStatementRatios).mockResolvedValue({
      ratios: {
        statementId: 'statement-1',
        periodLabel: 'Q1 2026',
        ratios: [],
        coverageSummary: { coveragePct: 0, computed: 0, total: 0 },
      },
    } as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.confirmStatement).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({ success: true } as any);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<FinancialStatementWorkspace statementId="statement-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Potwierdź statement' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Potwierdź statement' }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/api/finance-statements/statement-1/confirm', {});
    });

    expect(V8FinanceApi.confirmStatement).toHaveBeenCalledWith('statement-1');
  });

  it('prefers governed detect/extract/map actions before legacy fallback in retry recovery', async () => {
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        currency: 'PLN',
        scaling: 'units',
        source_file_name: 'acme-q1.csv',
        validation_status: 'pending',
        status: 'draft',
        readinessStatus: 'recoverable',
        validationMessages: [],
        values: [],
        qualityRuns: [],
        ingestRuns: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatements).mockResolvedValue({
      statements: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.getStatementRatios).mockResolvedValue({
      ratios: {
        statementId: 'statement-1',
        periodLabel: 'Q1 2026',
        ratios: [],
        coverageSummary: { coveragePct: 0, computed: 0, total: 0 },
      },
    } as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.detectStatement).mockResolvedValue({
      statementId: 'statement-1',
      detection: { statementType: 'P&L' },
    } as any);
    vi.mocked(V8FinanceApi.extractStatement).mockResolvedValue({
      statementId: 'statement-1',
      lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
    } as any);
    vi.mocked(V8FinanceApi.mapStatement).mockResolvedValue({
      statementId: 'statement-1',
      mappedLines: [
        {
          suggestedCanonicalId: 'line-1',
          originalLabel: 'Revenue',
          value: 100,
          confidence: 0.9,
        },
      ],
    } as any);
    vi.mocked(V8FinanceApi.putStatementValues).mockResolvedValue({
      statementId: 'statement-1',
      savedCount: 1,
    } as any);
    vi.mocked(Api.post).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected POST ${url}`);
    });
    vi.mocked(Api.put).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected PUT ${url}`);
    });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<FinancialStatementWorkspace statementId="statement-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry recovery' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry recovery' }));

    await waitFor(() => {
      expect(V8FinanceApi.detectStatement).toHaveBeenCalledWith('statement-1', {});
    });

    expect(Api.post).not.toHaveBeenCalledWith('/api/finance-statements/statement-1/detect', {});
    expect(V8FinanceApi.extractStatement).toHaveBeenCalledWith('statement-1', {});
    expect(V8FinanceApi.mapStatement).toHaveBeenCalledWith('statement-1', {
      lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
    });
    expect(Api.post).not.toHaveBeenCalledWith('/api/finance-statements/statement-1/extract', {});
    expect(Api.post).not.toHaveBeenCalledWith('/api/finance-statements/statement-1/map', {
      lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
    });
    expect(V8FinanceApi.putStatementValues).toHaveBeenCalledWith('statement-1', {
      values: expect.any(Array),
    });
  });

  it('falls back to legacy extract/map actions in retry recovery on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        currency: 'PLN',
        scaling: 'units',
        source_file_name: 'acme-q1.csv',
        validation_status: 'pending',
        status: 'draft',
        readinessStatus: 'recoverable',
        validationMessages: [],
        values: [],
        qualityRuns: [],
        ingestRuns: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatements).mockResolvedValue({
      statements: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.getStatementRatios).mockResolvedValue({
      ratios: {
        statementId: 'statement-1',
        periodLabel: 'Q1 2026',
        ratios: [],
        coverageSummary: { coveragePct: 0, computed: 0, total: 0 },
      },
    } as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.detectStatement).mockRejectedValue({ status: 404 });
    vi.mocked(V8FinanceApi.extractStatement).mockRejectedValue({ status: 404 });
    vi.mocked(V8FinanceApi.mapStatement).mockRejectedValue({ status: 404 });
    vi.mocked(V8FinanceApi.putStatementValues).mockResolvedValue({
      statementId: 'statement-1',
      savedCount: 1,
    } as any);
    vi.mocked(Api.post).mockImplementation(async (url: string, body?: any) => {
      if (url === '/api/finance-statements/statement-1/detect') {
        return { statementId: 'statement-1' } as any;
      }
      if (url === '/api/finance-statements/statement-1/extract') {
        return {
          lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
        } as any;
      }
      if (url === '/api/finance-statements/statement-1/map') {
        expect(body).toEqual({
          lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
        });
        return {
          mappedLines: [
            {
              suggestedCanonicalId: 'line-1',
              originalLabel: 'Revenue',
              value: 100,
              confidence: 0.9,
            },
          ],
        } as any;
      }
      throw new Error(`Unexpected POST ${url}`);
    });
    vi.mocked(Api.put).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected PUT ${url}`);
    });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<FinancialStatementWorkspace statementId="statement-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry recovery' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry recovery' }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/api/finance-statements/statement-1/detect', {});
    });

    expect(V8FinanceApi.detectStatement).toHaveBeenCalledWith('statement-1', {});
    expect(V8FinanceApi.extractStatement).toHaveBeenCalledWith('statement-1', {});
    expect(V8FinanceApi.mapStatement).toHaveBeenCalledWith('statement-1', {
      lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
    });
    expect(Api.post).toHaveBeenCalledWith('/api/finance-statements/statement-1/extract', {});
    expect(Api.post).toHaveBeenCalledWith('/api/finance-statements/statement-1/map', {
      lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
    });
  });

  it('prefers governed values save before legacy fallback in the workspace', async () => {
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        currency: 'PLN',
        scaling: 'units',
        source_file_name: 'acme-q1.csv',
        validation_status: 'pending',
        status: 'draft',
        readinessStatus: 'recoverable',
        validationMessages: [],
        values: [{ id: 'value-1', original_label: 'Revenue', originalLabel: 'Revenue', value: 100, mapping_status: 'unmapped' }],
        qualityRuns: [],
        ingestRuns: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatements).mockResolvedValue({
      statements: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.getStatementRatios).mockResolvedValue({
      ratios: {
        statementId: 'statement-1',
        periodLabel: 'Q1 2026',
        ratios: [],
        coverageSummary: { coveragePct: 0, computed: 0, total: 0 },
      },
    } as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.putStatementValues).mockResolvedValue({
      statementId: 'statement-1',
      savedCount: 1,
    } as any);
    vi.mocked(Api.put).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected PUT ${url}`);
    });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<FinancialStatementWorkspace statementId="statement-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save recovery' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save recovery' }));

    await waitFor(() => {
      expect(V8FinanceApi.putStatementValues).toHaveBeenCalledWith('statement-1', {
        values: expect.any(Array),
      });
    });

    expect(Api.put).not.toHaveBeenCalledWith('/api/finance-statements/statement-1/values', {
      values: expect.any(Array),
    });
  });

  it('falls back to legacy values save in the workspace on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        currency: 'PLN',
        scaling: 'units',
        source_file_name: 'acme-q1.csv',
        validation_status: 'pending',
        status: 'draft',
        readinessStatus: 'recoverable',
        validationMessages: [],
        values: [{ id: 'value-1', original_label: 'Revenue', originalLabel: 'Revenue', value: 100, mapping_status: 'unmapped' }],
        qualityRuns: [],
        ingestRuns: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatements).mockResolvedValue({
      statements: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.getStatementRatios).mockResolvedValue({
      ratios: {
        statementId: 'statement-1',
        periodLabel: 'Q1 2026',
        ratios: [],
        coverageSummary: { coveragePct: 0, computed: 0, total: 0 },
      },
    } as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [],
      count: 0,
    } as any);
    vi.mocked(V8FinanceApi.putStatementValues).mockRejectedValue({ status: 404 });
    vi.mocked(Api.put).mockResolvedValue({ savedCount: 1 } as any);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<FinancialStatementWorkspace statementId="statement-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save recovery' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save recovery' }));

    await waitFor(() => {
      expect(Api.put).toHaveBeenCalledWith('/api/finance-statements/statement-1/values', {
        values: expect.any(Array),
      });
    });

    expect(V8FinanceApi.putStatementValues).toHaveBeenCalledWith('statement-1', {
      values: expect.any(Array),
    });
  });

  it('localizes the durable scaling token in a Polish cold detail', async () => {
    translationState.language = 'pl';
    vi.mocked(V8FinanceApi.getStatement).mockResolvedValue({
      statement: {
        id: 'statement-pl', statement_type: 'BS', period_label: '2025',
        period_start: '2025-01-01', period_end: '2025-12-31', currency: 'PLN',
        scaling: 'thousands', source_file_name: 'statement.pdf', validation_status: 'pending',
        status: 'draft', readinessStatus: 'recoverable', validationMessages: [], values: [],
        qualityRuns: [], ingestRuns: [],
      },
    } as any);
    vi.mocked(V8FinanceApi.getStatements).mockResolvedValue({ statements: [], count: 0 } as any);
    vi.mocked(V8FinanceApi.getStatementRatios).mockResolvedValue({
      ratios: { statementId: 'statement-pl', periodLabel: '2025', ratios: [], coverageSummary: { coveragePct: 0, computed: 0, total: 0 } },
    } as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({ canonicalLines: [], count: 0 } as any);

    render(<FinancialStatementWorkspace statementId="statement-pl" />);
    await waitFor(() => expect(screen.getByText('Tysiące')).toBeInTheDocument());
    expect(screen.queryByText('thousands')).not.toBeInTheDocument();
  });
});
