/**
 * @vitest-environment jsdom
 *
 * `FinanceExportImportPanel` — Pakiet AP-CLIENT (Gate J), priorytet #5.
 *
 * Dowodzi: (1) flaga OFF → `null`, ZERO wywołań sieciowych, (2) eksport woła
 * `exportFinanceStatementPackXlsx(artifactId, businessVersionId)` i pokazuje manifest,
 * (3) trzy kroki importu: parse → preview → apply, w tej kolejności, z prawdziwymi danymi
 * przekazywanymi między krokami, (4) przycisk „Zastosuj" jest zablokowany, dopóki
 * `preview.ok !== true` — wszystko-albo-nic nigdy nie jest osiągalne z zepsutym podglądem,
 * (5) `applyFinanceImport` dostaje `batchIdempotencyKey`.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockExport = vi.fn();
const mockParse = vi.fn();
const mockPreview = vi.fn();
const mockApply = vi.fn();

vi.mock('@/services/api/financeV2.api', () => ({
  exportFinanceStatementPackXlsx: (...args: unknown[]) => mockExport(...args),
  parseFinanceImportXlsx: (...args: unknown[]) => mockParse(...args),
  previewFinanceImport: (...args: unknown[]) => mockPreview(...args),
  applyFinanceImport: (...args: unknown[]) => mockApply(...args),
}));

import { FinanceExportImportPanel } from '../FinanceExportImportPanel';

const SAMPLE_MANIFEST = {
  manifestVersion: 1,
  source: 'consultify-finance-v3-ap02',
  exportId: 'exp-1',
  organizationId: 'org-1',
  artifactId: 'art-1',
  artifactType: 'STATEMENT_PACK',
  businessVersionId: 'bv-1',
  businessVersionStatus: 'DRAFT',
  businessVersionNo: 3,
  businessVersionCasVersion: 5,
  workingRevisionId: 'wr-1',
  asOf: 't',
  defaultUnit: 'THOUSANDS',
  defaultPresentationCurrency: 'PLN',
  rowCount: 2,
};

beforeEach(() => {
  window.localStorage.clear();
  mockExport.mockReset();
  mockParse.mockReset();
  mockPreview.mockReset();
  mockApply.mockReset();
  // jsdom's URL.createObjectURL/revokeObjectURL don't exist by default.
  (URL as any).createObjectURL = vi.fn(() => 'blob:mock-url');
  (URL as any).revokeObjectURL = vi.fn();
});
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

const PROPS = { artifactId: 'art-1', businessVersionId: 'bv-1', expectedWorkingRevisionId: 'wr-1' };

describe('FinanceExportImportPanel', () => {
  it('flaga domyślnie OFF → renderuje null, ZERO wywołań export/import', () => {
    const { container } = render(<FinanceExportImportPanel {...PROPS} />);
    expect(container.firstChild).toBeNull();
    expect(mockExport).not.toHaveBeenCalled();
    expect(mockParse).not.toHaveBeenCalled();
  });

  it('eksport → woła exportFinanceStatementPackXlsx(artifactId, businessVersionId), pokazuje manifest', async () => {
    window.localStorage.setItem(
      'consultify_feature_flags',
      JSON.stringify({ financeExportImportV1: true })
    );
    mockExport.mockResolvedValueOnce({
      blob: new Blob(['x']),
      manifest: SAMPLE_MANIFEST,
      filename: 'art-1-v3.xlsx',
    });
    render(<FinanceExportImportPanel {...PROPS} />);
    fireEvent.click(screen.getByTestId('export-button'));
    await waitFor(() => expect(mockExport).toHaveBeenCalledWith('art-1', 'bv-1'));
    await waitFor(() =>
      expect(screen.getByTestId('export-manifest-summary')).toHaveTextContent('v3')
    );
  });

  it('import: parse → preview → apply, w tej kolejności, z realnymi danymi przekazywanymi między krokami', async () => {
    window.localStorage.setItem(
      'consultify_feature_flags',
      JSON.stringify({ financeExportImportV1: true })
    );
    const rows = [{ __rowNumber: 2, canonicalLineId: 'REVENUE' }];
    mockParse.mockResolvedValueOnce({ manifest: SAMPLE_MANIFEST, manifestIssues: [], rows });
    render(<FinanceExportImportPanel {...PROPS} />);

    const file = new File(['xlsx-bytes'], 'plik.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [file] } });

    await waitFor(() => expect(mockParse).toHaveBeenCalledWith(file, 'plik.xlsx'));
    await waitFor(() => expect(screen.getByTestId('import-parsed')).toBeInTheDocument());
    // Scoped do sekcji widocznej treści: Pakiet I (a11y) dodał RÓWNOLEGŁY,
    // zawsze zamontowany `role="status"` (sr-only) z tym samym komunikatem —
    // `within(...)` odróżnia widoczny akapit od live-region ogłoszenia.
    expect(
      within(screen.getByTestId('import-parsed')).getByText(/Wczytano 1 wierszy/)
    ).toBeInTheDocument();

    const preview = {
      ok: true,
      manifestCheck: { ok: true, issues: [] },
      diff: {
        toAdd: [],
        toChange: [
          {
            cellKey: 'k1',
            cellRef: {},
            before: { status: 'PRESENT_NONZERO', valueDecimal: '100' },
            after: { rowNumber: 2, cellKey: 'k1', cellRef: {}, value: {} },
          },
        ],
        toClear: [],
        unchangedCount: 3,
      },
      rowErrors: [],
      totalRows: 1,
    };
    mockPreview.mockResolvedValueOnce(preview);
    fireEvent.click(screen.getByTestId('import-preview-button'));
    await waitFor(() =>
      expect(mockPreview).toHaveBeenCalledWith({
        artifactId: 'art-1',
        businessVersionId: 'bv-1',
        manifest: SAMPLE_MANIFEST,
        rows,
      })
    );
    await waitFor(() => expect(screen.getByTestId('import-preview')).toBeInTheDocument());
    expect(screen.getByTestId('import-apply-button')).not.toBeDisabled();

    mockApply.mockResolvedValueOnce({
      businessVersionId: 'bv-1',
      newWorkingRevisionId: 'wr-2',
      newRevisionSeq: 2,
      appliedCount: { added: 0, changed: 1, cleared: 0 },
      idempotentReplay: false,
      reopened: false,
    });
    fireEvent.click(screen.getByTestId('import-apply-button'));
    await waitFor(() => expect(mockApply).toHaveBeenCalledTimes(1));
    const applyCallArgs = mockApply.mock.calls[0][0];
    expect(applyCallArgs).toMatchObject({
      artifactId: 'art-1',
      businessVersionId: 'bv-1',
      expectedWorkingRevisionId: 'wr-1',
      manifest: SAMPLE_MANIFEST,
      rows,
    });
    expect(typeof applyCallArgs.batchIdempotencyKey).toBe('string');
    expect(applyCallArgs.batchIdempotencyKey.length).toBeGreaterThan(0);

    await waitFor(() => expect(screen.getByTestId('import-applied')).toHaveTextContent('wr-2'));
  });

  it('KONTROLA NEGATYWNA: preview.ok=false (rowErrors) → przycisk „Zastosuj" DISABLED, applyFinanceImport nigdy nie wołany', async () => {
    window.localStorage.setItem(
      'consultify_feature_flags',
      JSON.stringify({ financeExportImportV1: true })
    );
    mockParse.mockResolvedValueOnce({
      manifest: SAMPLE_MANIFEST,
      manifestIssues: [],
      rows: [{ __rowNumber: 2 }],
    });
    render(<FinanceExportImportPanel {...PROPS} />);
    const file = new File(['x'], 'plik.xlsx');
    fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('import-parsed')).toBeInTheDocument());

    mockPreview.mockResolvedValueOnce({
      ok: false,
      manifestCheck: { ok: true, issues: [] },
      diff: { toAdd: [], toChange: [], toClear: [], unchangedCount: 0 },
      rowErrors: [{ rowNumber: 2, message: 'nieznana linia kanoniczna' }],
      totalRows: 1,
    });
    fireEvent.click(screen.getByTestId('import-preview-button'));
    await waitFor(() => expect(screen.getByTestId('import-row-errors')).toBeInTheDocument());

    const applyButton = screen.getByTestId('import-apply-button');
    expect(applyButton).toBeDisabled();
    fireEvent.click(applyButton);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('KONTROLA NEGATYWNA: 409 WORKING_REVISION_CONFLICT na apply → honest-UI komunikat, nie surowy kod', async () => {
    window.localStorage.setItem(
      'consultify_feature_flags',
      JSON.stringify({ financeExportImportV1: true })
    );
    mockParse.mockResolvedValueOnce({
      manifest: SAMPLE_MANIFEST,
      manifestIssues: [],
      rows: [{ __rowNumber: 2 }],
    });
    render(<FinanceExportImportPanel {...PROPS} />);
    fireEvent.change(screen.getByTestId('import-file-input'), {
      target: { files: [new File(['x'], 'plik.xlsx')] },
    });
    await waitFor(() => expect(screen.getByTestId('import-parsed')).toBeInTheDocument());

    mockPreview.mockResolvedValueOnce({
      ok: true,
      manifestCheck: { ok: true, issues: [] },
      diff: { toAdd: [], toChange: [], toClear: [], unchangedCount: 1 },
      rowErrors: [],
      totalRows: 1,
    });
    fireEvent.click(screen.getByTestId('import-preview-button'));
    await waitFor(() => expect(screen.getByTestId('import-apply-button')).not.toBeDisabled());

    const err = new Error('stale revision') as Error & { status?: number; data?: unknown };
    err.status = 409;
    err.data = { code: 'WORKING_REVISION_CONFLICT', currentWorkingRevisionId: 'wr-9' };
    mockApply.mockRejectedValueOnce(err);
    fireEvent.click(screen.getByTestId('import-apply-button'));

    await waitFor(() => expect(screen.getByTestId('import-error')).toBeInTheDocument());
    expect(screen.queryByText('WORKING_REVISION_CONFLICT')).not.toBeInTheDocument();
  });
});
