/**
 * @vitest-environment jsdom
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
    uploadAndAnalyzeStatement: vi.fn(),
    detectStatement: vi.fn(),
    extractStatement: vi.fn(),
    mapStatement: vi.fn(),
    putStatementValues: vi.fn(),
    confirmStatement: vi.fn(),
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
    vi.mocked(V8FinanceApi.uploadAndAnalyzeStatement).mockResolvedValue({
      mode: 'legacy',
      statementIds: ['statement-1'],
    } as any);
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

  async function advanceToMapStep() {
    await openManualDetectStep();
    fireEvent.click(screen.getByRole('button', { name: 'Extract Financial Lines' }));

    await waitFor(() => {
      expect(screen.getByText('financial-statement-mapping-editor')).toBeTruthy();
    });
  }

  it('prefers governed upload-and-analyze before legacy fallback in the wizard', async () => {
    const view = render(<FinancialStatementImportWizard />);
    const fileInput = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['revenue'], 'statement.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload & Analyze' }));

    await waitFor(() => {
      expect(V8FinanceApi.uploadAndAnalyzeStatement).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Detection Results')).toBeTruthy();
    });

    // FIN-005 Fix 2: the wizard now also sends a stable Idempotency-Key
    // header on the v8 call — the mock call's 2nd arg is the FormData, 3rd
    // is the extra-headers object.
    const [, extraHeaders] = vi.mocked(V8FinanceApi.uploadAndAnalyzeStatement).mock.calls[0];
    expect(typeof (extraHeaders as any)?.['Idempotency-Key']).toBe('string');
    expect((extraHeaders as any)['Idempotency-Key'].length).toBeGreaterThan(0);

    expect(Api.postMultipart).not.toHaveBeenCalledWith(
      '/api/finance-statements/upload-and-analyze',
      expect.any(FormData),
      expect.anything()
    );
  });

  it('falls back to legacy upload-and-analyze in the wizard on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.uploadAndAnalyzeStatement).mockRejectedValue({ status: 404 });

    const view = render(<FinancialStatementImportWizard />);
    const fileInput = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['revenue'], 'statement.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload & Analyze' }));

    await waitFor(() => {
      expect(Api.postMultipart).toHaveBeenCalledWith(
        '/api/finance-statements/upload-and-analyze',
        expect.any(FormData),
        expect.objectContaining({ 'Idempotency-Key': expect.any(String) })
      );
      expect(screen.getByText('Detection Results')).toBeTruthy();
    });

    // FIN-005 Fix 2: the retry onto legacy must reuse the SAME key the v8
    // attempt used for this same file — never a fresh one — so the server's
    // reservation/finalize/fail state machine can actually dedupe them as
    // one logical upload attempt.
    const v8Key = (vi.mocked(V8FinanceApi.uploadAndAnalyzeStatement).mock.calls[0][1] as any)?.[
      'Idempotency-Key'
    ];
    const legacyKey = (vi.mocked(Api.postMultipart).mock.calls[0][2] as any)?.['Idempotency-Key'];
    expect(legacyKey).toBe(v8Key);
  });

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

    await advanceToMapStep();

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

    await advanceToMapStep();

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

  it('prefers governed values save before legacy fallback in the wizard manual flow', async () => {
    vi.mocked(V8FinanceApi.detectStatement).mockResolvedValue({ statementId: 'statement-1' } as any);
    vi.mocked(V8FinanceApi.extractStatement).mockResolvedValue({
      statementId: 'statement-1',
      lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
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
    vi.mocked(V8FinanceApi.putStatementValues).mockResolvedValue({
      statementId: 'statement-1',
      savedCount: 1,
      readiness: { readinessStatus: 'ready', summary: 'Ready', reasonCodes: [] },
      validation: { status: 'pass', messages: [] },
    } as any);
    vi.mocked(Api.post).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected POST ${url}`);
    });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected GET ${url}`);
    });
    vi.mocked(Api.put).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected PUT ${url}`);
    });

    await advanceToMapStep();

    fireEvent.click(screen.getByRole('button', { name: 'Save & Validate' }));

    await waitFor(() => {
      expect(V8FinanceApi.putStatementValues).toHaveBeenCalledWith('statement-1', {
        values: expect.any(Array),
      });
    });

    expect(Api.put).not.toHaveBeenCalledWith('/api/finance-statements/statement-1/values', {
      values: expect.any(Array),
    });
  });

  it('falls back to legacy values save in the wizard manual flow on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.detectStatement).mockResolvedValue({ statementId: 'statement-1' } as any);
    vi.mocked(V8FinanceApi.extractStatement).mockResolvedValue({
      statementId: 'statement-1',
      lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
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
    vi.mocked(V8FinanceApi.putStatementValues).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected POST ${url}`);
    });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected GET ${url}`);
    });
    vi.mocked(Api.put).mockResolvedValue({
      savedCount: 1,
      readiness: { readinessStatus: 'ready', summary: 'Ready', reasonCodes: [] },
      validation: { status: 'pass', messages: [] },
    } as any);

    await advanceToMapStep();

    fireEvent.click(screen.getByRole('button', { name: 'Save & Validate' }));

    await waitFor(() => {
      expect(Api.put).toHaveBeenCalledWith('/api/finance-statements/statement-1/values', {
        values: expect.any(Array),
      });
    });

    expect(V8FinanceApi.putStatementValues).toHaveBeenCalledWith('statement-1', {
      values: expect.any(Array),
    });
  });

  it('prefers governed confirm before legacy fallback in the wizard manual flow', async () => {
    vi.mocked(V8FinanceApi.detectStatement).mockResolvedValue({ statementId: 'statement-1' } as any);
    vi.mocked(V8FinanceApi.extractStatement).mockResolvedValue({
      statementId: 'statement-1',
      lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
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
    vi.mocked(V8FinanceApi.putStatementValues).mockResolvedValue({
      statementId: 'statement-1',
      savedCount: 1,
      readiness: { readinessStatus: 'ready', summary: 'Ready', reasonCodes: [] },
      validation: { status: 'pass', messages: [] },
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
    vi.mocked(Api.put).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected PUT ${url}`);
    });

    const onComplete = vi.fn();
    render(<FinancialStatementImportWizard onComplete={onComplete} />);
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['revenue'], 'statement.csv', { type: 'text/csv' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload & Analyze' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Extract Financial Lines' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save & Validate' }));
    await screen.findByRole('button', { name: 'Confirm & Save' });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save' }));

    await waitFor(() => {
      expect(V8FinanceApi.confirmStatement).toHaveBeenCalledWith('statement-1');
    });

    expect(Api.post).not.toHaveBeenCalledWith('/api/finance-statements/statement-1/confirm', {});
    expect(onComplete).toHaveBeenCalledWith('statement-1');
  });

  it('falls back to legacy confirm in the wizard manual flow on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.detectStatement).mockResolvedValue({ statementId: 'statement-1' } as any);
    vi.mocked(V8FinanceApi.extractStatement).mockResolvedValue({
      statementId: 'statement-1',
      lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
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
    vi.mocked(V8FinanceApi.putStatementValues).mockResolvedValue({
      statementId: 'statement-1',
      savedCount: 1,
      readiness: { readinessStatus: 'ready', summary: 'Ready', reasonCodes: [] },
      validation: { status: 'pass', messages: [] },
    } as any);
    vi.mocked(V8FinanceApi.confirmStatement).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockImplementation(async (url: string, body?: any) => {
      if (url === '/api/finance-statements/statement-1/confirm') {
        expect(body).toEqual({});
        return { success: true } as any;
      }
      throw new Error(`Unexpected POST ${url}`);
    });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected GET ${url}`);
    });
    vi.mocked(Api.put).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected PUT ${url}`);
    });

    const onComplete = vi.fn();
    render(<FinancialStatementImportWizard onComplete={onComplete} />);
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['revenue'], 'statement.csv', { type: 'text/csv' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload & Analyze' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Extract Financial Lines' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save & Validate' }));
    await screen.findByRole('button', { name: 'Confirm & Save' });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save' }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/api/finance-statements/statement-1/confirm', {});
    });

    expect(V8FinanceApi.confirmStatement).toHaveBeenCalledWith('statement-1');
    expect(onComplete).toHaveBeenCalledWith('statement-1');
  });
});
