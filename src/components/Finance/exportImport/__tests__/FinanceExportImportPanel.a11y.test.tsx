/**
 * @vitest-environment jsdom
 *
 * Pakiet I (Dostępność), wymaganie #7 — `FinanceExportImportPanel.tsx`.
 * Ten panel jest CELOWY przykład z brifu ("compute trwa długo"): parse →
 * podgląd różnic → zastosowanie transakcyjne, trzy realne opóźnienia
 * sieciowe, PRZED naprawą wszystkie etapy ("Wczytuję plik…", "Liczę podgląd
 * różnic…", "Zapisuję…", błędy, podsumowanie) były widoczne wyłącznie
 * wzrokowo. Dodatkowo wymaganie #5 — `<input type="file">` bez etykiety.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const PROPS = { artifactId: 'art-1', businessVersionId: 'bv-1', expectedWorkingRevisionId: 'wr-1' };

beforeEach(() => {
  window.localStorage.clear();
  mockExport.mockReset();
  mockParse.mockReset();
  mockPreview.mockReset();
  mockApply.mockReset();
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:mock-url');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeExportImportV1: true }));
});
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('FinanceExportImportPanel — dostępna nazwa pola pliku (a11y, Pakiet I)', () => {
  it('pole importu ma jawnie powiązaną etykietę <label htmlFor>, nie tylko tekst obok', () => {
    render(<FinanceExportImportPanel {...PROPS} />);
    // `getByLabelText` przechodzi TYLKO gdy istnieje realne programowe
    // powiązanie label↔input (htmlFor/id, aria-labelledby, wrapping) —
    // dokładnie to, czego brakowało PRZED naprawą.
    expect(screen.getByLabelText('Wybierz plik do importu (.xlsx)')).toBe(screen.getByTestId('import-file-input'));
  });
});

describe('FinanceExportImportPanel — ogłaszanie stanów dynamicznych (a11y, Pakiet I)', () => {
  it('eksport: role="status" przechodzi Eksportuję…→komunikat gotowości', async () => {
    let resolveExport!: (v: unknown) => void;
    mockExport.mockReturnValueOnce(new Promise((resolve) => { resolveExport = resolve; }));
    render(<FinanceExportImportPanel {...PROPS} />);

    fireEvent.click(screen.getByTestId('export-button'));
    await waitFor(() =>
      expect(screen.getAllByTestId('finance-status-announcer').some((el) => el.textContent === 'Eksportuję plik .xlsx…')).toBe(true)
    );

    resolveExport({ blob: new Blob(['x']), filename: 'export.xlsx', manifest: { businessVersionNo: 3, defaultUnit: 'THOUSANDS', source: 'x' } });
    await waitFor(() =>
      expect(screen.getAllByTestId('finance-status-announcer').some((el) => el.textContent?.includes('Eksport gotowy'))).toBe(true)
    );
  });

  it('import: role="status" przechodzi Wczytuję plik…→Liczę podgląd różnic…→Zapisuję…→podsumowanie', async () => {
    mockParse.mockResolvedValueOnce({ manifest: { businessVersionNo: 3 }, manifestIssues: [], rows: [{ a: 1 }] });
    mockPreview.mockResolvedValueOnce({ ok: true, diff: { toAdd: [1], toChange: [], toClear: [], unchangedCount: 0 }, rowErrors: [], manifestCheck: { ok: true, issues: [] } });
    mockApply.mockResolvedValueOnce({ appliedCount: { added: 1, changed: 0, cleared: 0 }, newWorkingRevisionId: 'wr-2' });
    render(<FinanceExportImportPanel {...PROPS} />);

    const file = new File(['x'], 'plik.xlsx');
    fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getAllByTestId('finance-status-announcer').some((el) => el.textContent?.includes('Manifest OK'))).toBe(true)
    );

    fireEvent.click(screen.getByTestId('import-preview-button'));
    await waitFor(() =>
      expect(screen.getAllByTestId('finance-status-announcer').some((el) => el.textContent?.includes('Podgląd gotowy'))).toBe(true)
    );

    fireEvent.click(screen.getByTestId('import-apply-button'));
    await waitFor(() =>
      expect(screen.getAllByTestId('finance-status-announcer').some((el) => el.textContent?.includes('Zastosowano'))).toBe(true)
    );
  });

  it('błąd importu → role="status" priority=assertive', async () => {
    mockParse.mockRejectedValueOnce(new Error('boom'));
    render(<FinanceExportImportPanel {...PROPS} />);
    fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [new File(['x'], 'plik.xlsx')] } });
    await waitFor(() => {
      const announcers = screen.getAllByTestId('finance-status-announcer');
      expect(announcers.some((el) => el.getAttribute('aria-live') === 'assertive')).toBe(true);
    });
  });

  it('KONTROLA NEGATYWNA: przy fladze OFF panel nie renderuje nic — brak jakiegokolwiek role="status" lub etykiety pliku', () => {
    window.localStorage.clear();
    const { container } = render(<FinanceExportImportPanel {...PROPS} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('finance-status-announcer')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Wybierz plik do importu (.xlsx)')).not.toBeInTheDocument();
  });
});
