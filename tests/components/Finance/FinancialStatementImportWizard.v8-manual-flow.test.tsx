/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mappingEditorState = vi.hoisted(() => ({ props: null as any }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
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
    getStatement: vi.fn(),
    getCanonicalLines: vi.fn(),
    getStatementSourceReceipt: vi.fn(),
    recordStatementManualMappingDecision: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock(
  '../../../src/components/Finance/FinancialStatementMappingEditor',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('../../../src/components/Finance/FinancialStatementMappingEditor')
    >();
    return {
      ...actual,
      FinancialStatementMappingEditor: (props: any) => {
        mappingEditorState.props = props;
        return (
          <div>
            financial-statement-mapping-editor
            <button type="button" onClick={() => props.onVerifyAllReady?.()}>
              verify-eligible-test
            </button>
          </div>
        );
      },
    };
  }
);

import Api from '../../../src/services/api';
import { V8FinanceApi } from '../../../src/services/api/v8/finance';
import { FinancialStatementImportWizard } from '../../../src/components/Finance/FinancialStatementImportWizard';

describe('FinancialStatementImportWizard V8 manual flow seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mappingEditorState.props = null;
    vi.mocked(V8FinanceApi.getStatementSourceReceipt).mockResolvedValue({
      receipt: {
        receipt_id: 'receipt-1',
        original_file_name: 'statement.csv',
        content_sha256: 'a'.repeat(64),
        size_bytes: 7,
        mime_type: 'text/csv',
        entity_name: 'ACME',
        periods_json: [],
        page_ranges_json: [],
        importer_name: 'consultify-statement-import',
        importer_version: '2026-08-20',
        imported_by: 'owner-1',
        imported_at: '2026-08-20T00:00:00.000Z',
      },
    } as any);
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
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'P&L' } });

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

  it('uses one multi-section selection for checkboxes, summary and extract request without raw labels', async () => {
    vi.mocked(V8FinanceApi.uploadAndAnalyzeStatement).mockResolvedValue({
      mode: 'smart',
      statementIds: ['statement-1'],
      analysis: {
        entityName: 'ACME',
        periodLabel: '2025',
        currency: 'PLN',
        scaling: 'thousands',
        sectionTypes: ['BS', 'CF', 'P&L'],
      },
    } as any);
    vi.mocked(V8FinanceApi.extractStatement).mockResolvedValue({
      statements: [],
      lines: [],
    } as any);

    const view = render(<FinancialStatementImportWizard />);
    fireEvent.change(view.container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['report'], 'statement.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload & Analyze' }));

    await waitFor(() => expect(screen.getByText('Detection Results')).toBeTruthy());
    expect(screen.queryByText('Show steps')).toBeNull();
    expect(screen.queryByText('BS (Balance Sheet)')).toBeNull();
    expect(screen.getByTestId('multi-section-selection-summary')).toHaveTextContent(
      'Balance sheet · Cash flow statement · Income statement'
    );
    expect(screen.getAllByRole('checkbox').filter((item) => (item as HTMLInputElement).checked)).toHaveLength(3);
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.queryByRole('option', { name: 'Choose statement type' })).toBeNull();
    expect(screen.queryByText('thousands')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Extract selected statement section' }));
    await waitFor(() =>
      expect(V8FinanceApi.extractStatement).toHaveBeenCalledWith(
        'statement-1',
        expect.objectContaining({ statementTypes: ['BS', 'CF', 'P&L'] })
      )
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

  it('uses governed extract/map without a redundant detect probe in the wizard manual flow', async () => {
    vi.mocked(V8FinanceApi.detectStatement).mockResolvedValue({
      statementId: 'statement-1',
    } as any);
    vi.mocked(V8FinanceApi.extractStatement).mockResolvedValue({
      statementId: 'statement-1',
      lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
      statements: [
        {
          statementId: 'statement-1',
          statementType: 'P&L',
          periodLabel: '2025',
          sourceReceiptId: 'receipt-1',
          lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
        },
      ],
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
      canonicalLines: [
        { id: 'line-1', statement_type: 'P&L', line_code: 'revenue', line_name: 'Revenue' },
      ],
      count: 1,
    } as any);
    vi.mocked(Api.post).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected POST ${url}`);
    });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected GET ${url}`);
    });

    await advanceToMapStep();

    expect(V8FinanceApi.detectStatement).not.toHaveBeenCalled();
    expect(V8FinanceApi.extractStatement).toHaveBeenCalledWith('statement-1', {
      statementType: 'P&L',
      periodLabel: '',
      currency: 'PLN',
    });
    expect(V8FinanceApi.mapStatement).toHaveBeenCalledWith('statement-1', {});
    expect(V8FinanceApi.getCanonicalLines).toHaveBeenCalled();
    expect(Api.post).not.toHaveBeenCalledWith(
      '/api/finance-statements/statement-1/detect',
      expect.anything()
    );
    expect(Api.post).not.toHaveBeenCalledWith(
      '/api/finance-statements/statement-1/extract',
      expect.anything()
    );
    expect(Api.post).not.toHaveBeenCalledWith('/api/finance-statements/statement-1/map', {});
    expect(Api.get).not.toHaveBeenCalledWith('/api/finance-statements/canonical-lines');
  });

  it('renders the current-session durable source summary and comparative periods without raw statement ids', async () => {
    vi.mocked(V8FinanceApi.detectStatement).mockResolvedValue({ statementId: 'statement-current' } as any);
    vi.mocked(V8FinanceApi.extractStatement).mockResolvedValue({
      statementId: 'statement-current',
      lines: [{ originalLabel: 'Przychody', value: 3233, confidence: 0.9 }],
      statements: [
        {
          statementId: 'statement-current',
          statementType: 'P&L',
          periodLabel: 'FY2025',
          sourceReceiptId: 'receipt-current',
          currency: 'PLN',
          scaling: 'thousands',
          entityName: 'CD PROJEKT S.A.',
          sourceFileName: 'CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf',
          sourceSha256: 'a'.repeat(64),
          lines: [{ originalLabel: 'Przychody', value: 3233, confidence: 0.9 }],
        },
        {
          statementId: 'statement-comparison',
          statementType: 'P&L',
          periodLabel: 'FY2024',
          comparisonOfStatementId: 'statement-current',
          sourceReceiptId: 'receipt-comparison',
          currency: 'PLN',
          scaling: 'thousands',
          entityName: 'CD PROJEKT S.A.',
          sourceFileName: 'CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf',
          sourceSha256: 'a'.repeat(64),
          lines: [{ originalLabel: 'Przychody', value: 2980, confidence: 0.9 }],
        },
      ],
    } as any);
    vi.mocked(V8FinanceApi.mapStatement).mockImplementation(async (statementId: string) => ({
      statementId,
      mappedLines: [
        {
          originalLabel: 'Przychody',
          value: statementId === 'statement-current' ? 3233 : 2980,
          confidence: 0.9,
          suggestedCanonicalId: 'line-revenue',
          suggestedCanonicalLabel: 'Przychody',
        },
      ],
    }) as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [
        { id: 'line-revenue', statement_type: 'P&L', line_code: 'revenue', line_name: 'Revenue' },
      ],
      count: 1,
    } as any);
    vi.mocked(V8FinanceApi.getStatementSourceReceipt).mockImplementation(async (statementId: string) => ({
      receipt: {
        receipt_id: statementId === 'statement-current' ? 'receipt-current' : 'receipt-comparison',
        original_file_name: 'CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf',
        content_sha256: 'a'.repeat(64),
        size_bytes: 123456,
        mime_type: 'application/pdf',
        entity_name: 'CD PROJEKT S.A.',
        periods_json: [
          {
            label: statementId === 'statement-current' ? 'FY2025' : 'FY2024',
            statementType: 'P&L',
            currency: 'PLN',
            scaling: 'thousands',
          },
        ],
        page_ranges_json: [{ pageStart: 12, pageEnd: 13 }],
        importer_name: 'consultify-statement-import',
        importer_version: '2026-08-20',
        imported_by: 'owner-1',
        imported_at: '2026-08-20T00:00:00.000Z',
      },
    })) as any;

    await advanceToMapStep();

    expect(screen.getByTestId('statement-comparison-side-by-side')).toBeTruthy();
    expect(screen.getByTestId('durable-source-summary').textContent).toContain('P&L');
    expect(screen.getByTestId('durable-source-summary').textContent).toContain('FY2025');
    expect(screen.getByTestId('durable-source-summary').textContent).toContain('FY2024');
    expect(screen.getByTestId('durable-source-summary').textContent).toContain('PLN · Thousands');
    expect(screen.getByTestId('durable-source-summary').textContent).toContain('owner-1');
    expect(screen.getByTestId('durable-source-summary').textContent).toContain('12–13');
    expect(screen.getAllByText('CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf').length).toBeGreaterThan(0);
    expect(screen.queryByText('statement-current')).toBeNull();
    expect(screen.queryByText('statement-comparison')).toBeNull();
  });

  it('reconstructs the durable review after unmount and a new deep-link mount', async () => {
    const detailFor = (id: string) => ({
      statement: {
        id,
        entity_name: 'CD PROJEKT S.A.',
        statement_type: 'P&L',
        period_label: id === 'statement-current' ? 'FY2025' : 'FY2024',
        currency: 'PLN',
        scaling: 'thousands',
        source_file_name: 'CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf',
        readinessStatus: 'recoverable',
        readinessSummary: 'Requires mapping review',
        values_version: 3,
        sourceSiblings: [
          { id: 'statement-current' },
          { id: 'statement-comparison' },
        ],
        values: [
          {
            original_label: 'Przychody',
            value: id === 'statement-current' ? 3233 : 2980,
            confidence: 0.9,
            canonical_line_id: 'line-revenue',
            line_name_pl: 'Przychody',
            source_row: 1,
          },
        ],
      },
    });
    vi.mocked(V8FinanceApi.getStatement).mockImplementation(async (id: string) => detailFor(id) as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [
        { id: 'line-revenue', statement_type: 'P&L', line_code: 'revenue', line_name: 'Revenue' },
      ],
      count: 1,
    } as any);
    vi.mocked(V8FinanceApi.getStatementSourceReceipt).mockImplementation(async (id: string) => ({
      receipt: {
        receipt_id: `receipt-${id}`,
        original_file_name: 'CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf',
        content_sha256: 'a'.repeat(64),
        entity_name: 'CD PROJEKT S.A.',
        periods_json: [
          { label: id === 'statement-current' ? 'FY2025' : 'FY2024', currency: 'PLN', scaling: 'thousands' },
        ],
        page_ranges_json: [{ pageStart: 12, pageEnd: 13 }],
        importer_name: 'consultify-statement-import',
        importer_version: '2026-08-20',
        imported_by: 'owner-1',
        imported_at: '2026-08-20T00:00:00.000Z',
      },
    })) as any;

    const first = render(<FinancialStatementImportWizard initialStatementId="statement-current" />);
    await waitFor(() => expect(screen.getByTestId('statement-comparison-side-by-side')).toBeTruthy());
    expect(screen.getByTestId('durable-source-summary').textContent).toContain('FY2025 / FY2024');
    expect(screen.getByTestId('statement-recovery-link').getAttribute('href')).toContain(
      'statementId=statement-current'
    );
    first.unmount();

    render(<FinancialStatementImportWizard initialStatementId="statement-current" />);
    await waitFor(() => expect(screen.getByTestId('statement-comparison-side-by-side')).toBeTruthy());
    expect(screen.getByTestId('durable-source-summary').textContent).toContain('PLN · Thousands');
    expect(screen.queryByText('statement-current')).toBeNull();
    expect(V8FinanceApi.getStatement).toHaveBeenCalledTimes(4);
    expect(V8FinanceApi.getStatementSourceReceipt).toHaveBeenCalledTimes(4);
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
        return [
          { id: 'line-1', statement_type: 'P&L', line_code: 'revenue', line_name: 'Revenue' },
        ] as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    await advanceToMapStep();

    expect(V8FinanceApi.detectStatement).not.toHaveBeenCalled();
    expect(V8FinanceApi.extractStatement).toHaveBeenCalledWith('statement-1', {
      statementType: 'P&L',
      periodLabel: '',
      currency: 'PLN',
    });
    expect(V8FinanceApi.mapStatement).toHaveBeenCalledWith('statement-1', {});
    expect(V8FinanceApi.getCanonicalLines).toHaveBeenCalled();
    expect(Api.post).not.toHaveBeenCalledWith(
      '/api/finance-statements/statement-1/detect',
      expect.anything()
    );
    expect(Api.post).toHaveBeenCalledWith('/api/finance-statements/statement-1/extract', {
      statementType: 'P&L',
      periodLabel: '',
      currency: 'PLN',
    });
    expect(Api.post).toHaveBeenCalledWith('/api/finance-statements/statement-1/map', {});
    expect(Api.get).toHaveBeenCalledWith('/api/finance-statements/canonical-lines');
  });

  it('prefers governed values save before legacy fallback in the wizard manual flow', async () => {
    vi.mocked(V8FinanceApi.detectStatement).mockResolvedValue({
      statementId: 'statement-1',
    } as any);
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
      canonicalLines: [
        { id: 'line-1', statement_type: 'P&L', line_code: 'revenue', line_name: 'Revenue' },
      ],
      count: 1,
    } as any);
    vi.mocked(V8FinanceApi.putStatementValues).mockResolvedValue({
      statementId: 'statement-1',
      savedCount: 1,
      valuesVersion: 1,
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

  it('bulk-verifies only rows with a canonical target and never records ACCEPT for unmapped rows', async () => {
    vi.mocked(V8FinanceApi.extractStatement).mockResolvedValue({
      statementId: 'statement-1',
      lines: [
        { originalLabel: 'Revenue', value: 100, confidence: 0.6, sourceRow: 10 },
        { originalLabel: 'Unknown', value: 5, confidence: 0.4, sourceRow: 11 },
      ],
      statements: [
        {
          statementId: 'statement-1',
          statementType: 'P&L',
          periodLabel: '2025',
          sourceReceiptId: 'receipt-1',
          lines: [
            { originalLabel: 'Revenue', value: 100, confidence: 0.6, sourceRow: 10 },
            { originalLabel: 'Unknown', value: 5, confidence: 0.4, sourceRow: 11 },
          ],
        },
      ],
    } as any);
    vi.mocked(V8FinanceApi.mapStatement).mockResolvedValue({
      statementId: 'statement-1',
      mappedLines: [
        {
          originalLabel: 'Revenue',
          value: 100,
          confidence: 0.6,
          sourceRow: 10,
          suggestedCanonicalId: 'line-1',
          suggestedCanonicalLabel: 'Revenue',
          mappingTier: 'review_required',
        },
        {
          originalLabel: 'Unknown',
          value: 5,
          confidence: 0.4,
          sourceRow: 11,
          suggestedCanonicalId: null,
          mappingTier: 'review_required',
        },
      ],
    } as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [
        { id: 'line-1', statement_type: 'P&L', line_code: 'revenue', line_name: 'Revenue' },
      ],
      count: 1,
    } as any);
    vi.mocked(V8FinanceApi.putStatementValues).mockResolvedValue({
      statementId: 'statement-1',
      savedCount: 2,
      valuesVersion: 1,
      readiness: {
        readinessStatus: 'recoverable',
        summary: 'Unmapped row remains',
        reasonCodes: ['UNMAPPED_ROWS'],
      },
      validation: { status: 'warnings', messages: [] },
    } as any);
    vi.mocked(V8FinanceApi.recordStatementManualMappingDecision).mockResolvedValue({
      decision: {
        readinessStatus: 'recoverable',
        summary: 'Unmapped row remains',
        reasonCodes: ['UNMAPPED_ROWS'],
      },
    } as any);

    await advanceToMapStep();
    fireEvent.click(screen.getByRole('button', { name: 'verify-eligible-test' }));

    await waitFor(() => {
      expect(mappingEditorState.props.mappedValues[0].userVerified).toBe(true);
      expect(mappingEditorState.props.mappedValues[1].userVerified).not.toBe(true);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save & Validate' }));

    await waitFor(() => {
      expect(V8FinanceApi.recordStatementManualMappingDecision).toHaveBeenCalledTimes(1);
    });
    expect(V8FinanceApi.recordStatementManualMappingDecision).toHaveBeenCalledWith(
      'statement-1',
      expect.objectContaining({ sourceRow: 10, canonicalLineId: 'line-1' }),
      expect.any(String)
    );
    expect(V8FinanceApi.recordStatementManualMappingDecision).not.toHaveBeenCalledWith(
      'statement-1',
      expect.objectContaining({ sourceRow: 11, canonicalLineId: null }),
      expect.any(String)
    );
  });

  it('falls back to legacy values save in the wizard manual flow on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.detectStatement).mockResolvedValue({
      statementId: 'statement-1',
    } as any);
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
      canonicalLines: [
        { id: 'line-1', statement_type: 'P&L', line_code: 'revenue', line_name: 'Revenue' },
      ],
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
    vi.mocked(V8FinanceApi.detectStatement).mockResolvedValue({
      statementId: 'statement-1',
    } as any);
    vi.mocked(V8FinanceApi.extractStatement).mockResolvedValue({
      statementId: 'statement-1',
      lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
      statements: [
        {
          statementId: 'statement-1',
          statementType: 'P&L',
          periodLabel: '2025',
          sourceReceiptId: 'receipt-1',
          lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
        },
      ],
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
      canonicalLines: [
        { id: 'line-1', statement_type: 'P&L', line_code: 'revenue', line_name: 'Revenue' },
      ],
      count: 1,
    } as any);
    vi.mocked(V8FinanceApi.putStatementValues).mockResolvedValue({
      statementId: 'statement-1',
      savedCount: 1,
      valuesVersion: 1,
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
    fireEvent.change(await screen.findAllByRole('combobox').then((items) => items[0]), {
      target: { value: 'P&L' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Extract Financial Lines' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save & Validate' }));
    await screen.findByRole('button', { name: 'Confirm & Save' });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save' }));

    await waitFor(() => {
      expect(V8FinanceApi.confirmStatement).toHaveBeenCalledWith(
        'statement-1',
        { sourceReceiptId: 'receipt-1', expectedValuesVersion: 1 },
        'statement-confirm-statement-1-1'
      );
    });

    expect(Api.post).not.toHaveBeenCalledWith('/api/finance-statements/statement-1/confirm', {});
    expect(onComplete).toHaveBeenCalledWith('statement-1');
  });

  it('falls back to legacy confirm in the wizard manual flow on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.detectStatement).mockResolvedValue({
      statementId: 'statement-1',
    } as any);
    vi.mocked(V8FinanceApi.extractStatement).mockResolvedValue({
      statementId: 'statement-1',
      lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
      statements: [
        {
          statementId: 'statement-1',
          statementType: 'P&L',
          periodLabel: '2025',
          sourceReceiptId: 'receipt-1',
          lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
        },
      ],
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
      canonicalLines: [
        { id: 'line-1', statement_type: 'P&L', line_code: 'revenue', line_name: 'Revenue' },
      ],
      count: 1,
    } as any);
    vi.mocked(V8FinanceApi.putStatementValues).mockResolvedValue({
      statementId: 'statement-1',
      savedCount: 1,
      valuesVersion: 1,
      readiness: { readinessStatus: 'ready', summary: 'Ready', reasonCodes: [] },
      validation: { status: 'pass', messages: [] },
    } as any);
    vi.mocked(V8FinanceApi.confirmStatement).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockImplementation(async (url: string, body?: any) => {
      if (url === '/api/finance-statements/statement-1/confirm') {
        expect(body).toEqual({ sourceReceiptId: 'receipt-1', expectedValuesVersion: 1 });
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
    fireEvent.change(await screen.findAllByRole('combobox').then((items) => items[0]), {
      target: { value: 'P&L' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Extract Financial Lines' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save & Validate' }));
    await screen.findByRole('button', { name: 'Confirm & Save' });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save' }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith(
        '/api/finance-statements/statement-1/confirm',
        { sourceReceiptId: 'receipt-1', expectedValuesVersion: 1 },
        { extraHeaders: { 'Idempotency-Key': 'statement-confirm-statement-1-1' } }
      );
    });

    expect(V8FinanceApi.confirmStatement).toHaveBeenCalledWith(
      'statement-1',
      { sourceReceiptId: 'receipt-1', expectedValuesVersion: 1 },
      'statement-confirm-statement-1-1'
    );
    expect(onComplete).toHaveBeenCalledWith('statement-1');
  });

  it('routes a smart analysis through review and governed confirmation', async () => {
    vi.mocked(V8FinanceApi.uploadAndAnalyzeStatement).mockResolvedValue({
      mode: 'smart',
      statementIds: ['smart-1'],
      statementPackId: null,
      analysis: {
        entityName: 'ACME',
        periodLabel: '2025',
        currency: 'PLN',
        scaling: 'units',
        sectionTypes: ['P&L', 'BS', 'CF'],
        totalLines: 1,
      },
      statements: [{ statementId: 'smart-1', statementType: 'P&L', lineCount: 1 }],
    } as any);
    vi.mocked(V8FinanceApi.extractStatement).mockResolvedValue({
      statements: (['P&L', 'BS', 'CF'] as const).flatMap((statementType, typeIndex) =>
        ['2025', '2024'].map((periodLabel, periodIndex) => ({
          statementId: `smart-${typeIndex}-${periodIndex}`,
          statementType,
          periodLabel,
          sourceReceiptId: `receipt-${typeIndex}-${periodIndex}`,
          lines: [],
        }))
      ),
    } as any);
    vi.mocked(V8FinanceApi.mapStatement).mockResolvedValue({
      mappedLines: [
        { originalLabel: 'Revenue', value: 100, confidence: 0.9, suggestedCanonicalId: 'line-1', sourceRow: 41 },
        { originalLabel: 'Revenue detail', value: 90, confidence: 0.9, suggestedCanonicalId: 'line-2', sourceRow: 41 },
      ],
    } as any);
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [
        { id: 'line-1', statement_type: 'P&L', line_code: 'revenue', line_name: 'Revenue' },
      ],
    } as any);
    vi.mocked(V8FinanceApi.putStatementValues).mockResolvedValue({
      valuesVersion: 7,
      validation: { status: 'pass', messages: [] },
      readiness: { readinessStatus: 'ready', summary: 'Ready', reasonCodes: [] },
    } as any);
    vi.mocked(V8FinanceApi.confirmStatement).mockResolvedValue({ success: true } as any);

    render(<FinancialStatementImportWizard />);
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['revenue'], 'smart.xlsx')] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload & Analyze' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: /Extract selected statement section|Extract Financial Lines/,
      })
    );
    await waitFor(() =>
      expect(V8FinanceApi.extractStatement).toHaveBeenCalledWith('smart-1', {
        statementType: '',
        statementTypes: ['P&L', 'BS', 'CF'],
        periodLabel: '2025',
        currency: 'PLN',
        entityName: 'ACME',
      })
    );
    expect(V8FinanceApi.detectStatement).not.toHaveBeenCalled();
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    fireEvent.click(await screen.findByRole('button', { name: 'Save & Validate' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm & Save' }));

    await waitFor(() =>
      expect(V8FinanceApi.confirmStatement).toHaveBeenCalledTimes(6)
    );
  });

  async function stageTwoStatementSections(secondReadiness: 'ready' | 'recoverable' = 'ready') {
    vi.mocked(V8FinanceApi.uploadAndAnalyzeStatement).mockResolvedValue({
      mode: 'legacy',
      statementIds: ['pl-1'],
      detection: {
        statementType: '',
        confidence: 0.9,
        currency: 'PLN',
        scaling: 'units',
        language: 'pl',
        containsMultipleStatements: true,
        containedStatementTypes: ['P&L', 'BS'],
      },
    } as any);
    vi.mocked(V8FinanceApi.detectStatement).mockResolvedValue({} as any);
    vi.mocked(V8FinanceApi.extractStatement).mockResolvedValue({
      statements: [
        {
          statementId: 'pl-1',
          statementType: 'P&L',
          periodLabel: '2025',
          sourceReceiptId: 'receipt-pl-1',
          lines: [],
        },
        {
          statementId: 'bs-1',
          statementType: 'BS',
          periodLabel: '2025',
          comparisonOfStatementId: 'pl-1',
          sourceReceiptId: 'receipt-bs-1',
          lines: [],
        },
      ],
    } as any);
    vi.mocked(V8FinanceApi.mapStatement).mockImplementation(
      async (id: string) =>
        ({
          mappedLines: [
            { originalLabel: id, value: 100, confidence: 0.8, suggestedCanonicalId: 'line-1' },
          ],
        }) as any
    );
    vi.mocked(V8FinanceApi.getCanonicalLines).mockResolvedValue({
      canonicalLines: [
        { id: 'line-1', statement_type: 'P&L', line_code: 'revenue', line_name: 'Revenue' },
      ],
    } as any);
    vi.mocked(V8FinanceApi.putStatementValues)
      .mockResolvedValueOnce({
        valuesVersion: 11,
        validation: { status: 'pass', messages: [] },
        readiness: { readinessStatus: 'ready', summary: 'Ready', reasonCodes: [] },
      } as any)
      .mockResolvedValueOnce({
        valuesVersion: 12,
        validation: { status: secondReadiness === 'ready' ? 'pass' : 'warnings', messages: [] },
        readiness: {
          readinessStatus: secondReadiness,
          summary: secondReadiness === 'ready' ? 'Ready' : 'Mapping requires review',
          reasonCodes: secondReadiness === 'ready' ? [] : ['MAPPING_REVIEW_REQUIRED'],
        },
      } as any);
    vi.mocked(V8FinanceApi.getStatementSourceReceipt).mockImplementation(async (id: string) => ({
      receipt: {
        receipt_id: `receipt-${id}`,
        original_file_name: 'whole.xlsx',
        content_sha256: 'a'.repeat(64),
        size_bytes: 100,
        mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        entity_name: 'ACME',
        periods_json: [{ label: '2025' }],
        page_ranges_json: [{ pageStart: 1, pageEnd: 2 }],
        importer_name: 'consultify-statement-import',
        importer_version: '2026-08-20',
        imported_by: 'owner-1',
        imported_at: '2026-08-20T00:00:00.000Z',
      },
    })) as any;
    vi.mocked(V8FinanceApi.confirmStatement).mockResolvedValue({ success: true } as any);
    const view = render(<FinancialStatementImportWizard />);
    fireEvent.change(view.container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['x'], 'whole.xlsx')] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload & Analyze' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Extract selected statement section' })
    );
    expect(await screen.findByRole('tab', { name: /Income statement · 2025/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Balance sheet · 2025 · comparison/ })).toBeInTheDocument();
    expect(screen.queryByText('Import Financial Statement')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Statement metrics' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save & Validate' }));
    return view;
  }

  it('requires receipts and saved versions, then confirms every ready section sequentially', async () => {
    await stageTwoStatementSections();
    await waitFor(() => expect(V8FinanceApi.putStatementValues).toHaveBeenCalledTimes(2));
    expect(V8FinanceApi.putStatementValues).toHaveBeenNthCalledWith(1, 'pl-1', expect.anything());
    expect(V8FinanceApi.putStatementValues).toHaveBeenNthCalledWith(2, 'bs-1', expect.anything());
    const confirm = await screen.findByRole('button', { name: 'Confirm & Save' });
    fireEvent.click(confirm);
    await waitFor(() => expect(V8FinanceApi.confirmStatement).toHaveBeenCalledTimes(2));
    expect(V8FinanceApi.confirmStatement).toHaveBeenNthCalledWith(
      1,
      'pl-1',
      { sourceReceiptId: 'receipt-pl-1', expectedValuesVersion: 11 },
      'statement-confirm-pl-1-11'
    );
    expect(V8FinanceApi.confirmStatement).toHaveBeenNthCalledWith(
      2,
      'bs-1',
      { sourceReceiptId: 'receipt-bs-1', expectedValuesVersion: 12 },
      'statement-confirm-bs-1-12'
    );
  });

  it('fails closed when any staged statement is not ready', async () => {
    await stageTwoStatementSections('recoverable');
    expect(
      await screen.findByRole('button', { name: 'Return to blocking items' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm & Save' })).not.toBeInTheDocument();
    expect(V8FinanceApi.confirmStatement).not.toHaveBeenCalled();
  });
});
