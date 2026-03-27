/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/services/api', () => {
  const api = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    postMultipart: vi.fn(),
  };
  return {
    Api: api,
    default: api,
  };
});

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    detectStatement: vi.fn(),
    extractStatement: vi.fn(),
    mapStatement: vi.fn(),
    getCanonicalLines: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('../../../src/components/Finance/FinancialStatementMappingEditor', () => ({
  FinancialStatementMappingEditor: () => <div>financial-statement-mapping-editor</div>,
}));

import Api from '../../../src/services/api';
import { V8FinanceApi } from '../../../src/services/api/v8/finance';
import { FinancialStatementImportWizard } from '../../../src/components/Finance/FinancialStatementImportWizard';

describe('FinancialStatementImportWizard V8 manual flow seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.postMultipart).mockResolvedValue({
      mode: 'legacy',
      statementIds: ['statement-1'],
    } as any);
  });

  async function openManualDetectStep() {
    const view = render(<FinancialStatementImportWizard />);
    const fileInput = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['revenue'], 'statement.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload & Analyze' }));

    await waitFor(() => {
      expect(screen.getByText('Detection Results')).toBeTruthy();
    });

    return view;
  }

  it('prefers governed detect/extract/map and canonical lines before legacy fallback in the wizard manual flow', async () => {
    vi.mocked(V8FinanceApi.detectStatement).mockResolvedValue({ statementId: 'statement-1' } as any);
    vi.mocked(V8FinanceApi.extractStatement).mockResolvedValue({
      statementId: 'statement-1',
      lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
      sections: [{ sectionKey: 'pl', sectionLabel: 'P&L', confidence: 0.9 }],
      columnSelection: { selectedPeriodLabel: '2024' },
      warnings: [],
      rawTableCount: 1,
      extractionStrategy: 'local_parser',
      documentClass: 'financial_statement',
    } as any);
    vi.mocked(V8FinanceApi.mapStatement).mockResolvedValue({
      statementId: 'statement-1',
      mappedLines: [
        {
          originalLabel: 'Revenue',
          value: 100,
          confidence: 0.9,
          suggestedCanonicalId: 'line-1',
          suggestedCanonicalLabel: 'Revenue',
        },
      ],
    } as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [{ id: 'line-1', statement_type: 'P&L', line_code: 'revenue', line_name: 'Revenue' }],
      count: 1,
    } as any);
    vi.mocked(Api.post).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected POST ${url}`);
    });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected GET ${url}`);
    });

    await openManualDetectStep();

    fireEvent.click(screen.getByRole('button', { name: 'Extract Financial Lines' }));

    await waitFor(() => {
      expect(screen.getByText('financial-statement-mapping-editor')).toBeTruthy();
    });

    expect(V8FinanceApi.detectStatement).toHaveBeenCalledWith('statement-1', {
      statementType: 'P&L',
      periodLabel: '',
      currency: 'PLN',
    });
    expect(V8FinanceApi.extractStatement).toHaveBeenCalledWith('statement-1', {
      statementType: 'P&L',
      periodLabel: '',
      currency: 'PLN',
    });
    expect(V8FinanceApi.mapStatement).toHaveBeenCalledWith('statement-1', {});
    expect(V8FinanceApi.getCanonicalLines).toHaveBeenCalled();
    expect(Api.post).not.toHaveBeenCalledWith('/api/finance-statements/statement-1/detect', expect.anything());
    expect(Api.post).not.toHaveBeenCalledWith('/api/finance-statements/statement-1/extract', expect.anything());
    expect(Api.post).not.toHaveBeenCalledWith('/api/finance-statements/statement-1/map', {});
    expect(Api.get).not.toHaveBeenCalledWith('/api/finance-statements/canonical-lines');
  });

  it('falls back to legacy detect/extract/map and canonical lines in the wizard manual flow on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.detectStatement).mockRejectedValue({ status: 404 });
    vi.mocked(V8FinanceApi.extractStatement).mockRejectedValue({ status: 404 });
    vi.mocked(V8FinanceApi.mapStatement).mockRejectedValue({ status: 404 });
    vi.mocked(V8FinanceApi.getCanonicalLines).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockImplementation(async (url: string, body?: any) => {
      if (url === '/api/finance-statements/statement-1/detect') {
        expect(body).toEqual({
          statementType: 'P&L',
          periodLabel: '',
          currency: 'PLN',
        });
        return { statementId: 'statement-1' } as any;
      }
      if (url === '/api/finance-statements/statement-1/extract') {
        expect(body).toEqual({
          statementType: 'P&L',
          periodLabel: '',
          currency: 'PLN',
        });
        return {
          lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
          sections: [{ sectionKey: 'pl', sectionLabel: 'P&L', confidence: 0.9 }],
          columnSelection: { selectedPeriodLabel: '2024' },
          warnings: [],
          rawTableCount: 1,
          extractionStrategy: 'local_parser',
          documentClass: 'financial_statement',
        } as any;
      }
      if (url === '/api/finance-statements/statement-1/map') {
        expect(body).toEqual({});
        return {
          mappedLines: [
            {
              originalLabel: 'Revenue',
              value: 100,
              confidence: 0.9,
              suggestedCanonicalId: 'line-1',
              suggestedCanonicalLabel: 'Revenue',
            },
          ],
        } as any;
      }
      throw new Error(`Unexpected POST ${url}`);
    });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/finance-statements/canonical-lines') {
        return [{ id: 'line-1', statement_type: 'P&L', line_code: 'revenue', line_name: 'Revenue' }] as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    await openManualDetectStep();

    fireEvent.click(screen.getByRole('button', { name: 'Extract Financial Lines' }));

    await waitFor(() => {
      expect(screen.getByText('financial-statement-mapping-editor')).toBeTruthy();
    });

    expect(V8FinanceApi.detectStatement).toHaveBeenCalledWith('statement-1', {
      statementType: 'P&L',
      periodLabel: '',
      currency: 'PLN',
    });
    expect(V8FinanceApi.extractStatement).toHaveBeenCalledWith('statement-1', {
      statementType: 'P&L',
      periodLabel: '',
      currency: 'PLN',
    });
    expect(V8FinanceApi.mapStatement).toHaveBeenCalledWith('statement-1', {});
    expect(V8FinanceApi.getCanonicalLines).toHaveBeenCalled();
    expect(Api.post).toHaveBeenCalledWith('/api/finance-statements/statement-1/detect', {
      statementType: 'P&L',
      periodLabel: '',
      currency: 'PLN',
    });
    expect(Api.post).toHaveBeenCalledWith('/api/finance-statements/statement-1/extract', {
      statementType: 'P&L',
      periodLabel: '',
      currency: 'PLN',
    });
    expect(Api.post).toHaveBeenCalledWith('/api/finance-statements/statement-1/map', {});
    expect(Api.get).toHaveBeenCalledWith('/api/finance-statements/canonical-lines');
  });
});
