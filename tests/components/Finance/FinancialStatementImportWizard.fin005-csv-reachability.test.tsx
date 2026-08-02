/**
 * @vitest-environment jsdom
 *
 * FIN-005 gap closure: the FIN-05 backend/route packet (this branch) taught
 * the server to accept CSV statement uploads, but the wizard's own
 * drag-and-drop handler (`handleDrop`) and file-input `accept` attribute
 * still hard-coded `.pdf,.xlsx,.xls` — so a real user dragging a .csv file
 * onto the real screen never reached the backend at all; `handleDrop` set
 * an "unsupported format" error and returned before any upload call.
 *
 * `FinancialStatementImportWizard.v8-manual-flow.test.tsx` (pre-existing,
 * unchanged by this branch) already proves the full
 * upload→detect→extract→map→values→confirm state machine end-to-end using a
 * `statement.csv` fixture — but it drives the file into the component via
 * `fireEvent.change` on the raw `<input type=file>`, which bypasses both the
 * OS file-picker's `accept` filter AND this component's own `handleDrop`
 * extension/MIME check entirely. That test was passing before this branch's
 * fix and would keep passing even if `handleDrop` still rejected CSV — it
 * does not prove real-screen reachability.
 *
 * This file closes exactly that gap: it exercises the real `handleDrop`
 * path (drag-and-drop), which is the code this branch actually changed, and
 * confirms (a) CSV is now accepted through it where it previously was not,
 * (b) an actually-unsupported extension is still correctly rejected (so
 * this isn't "accept everything now"), and (c) the file input's `accept`
 * attribute was widened to include `.csv`.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/services/api', () => {
  const api = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), postMultipart: vi.fn() };
  return { Api: api, default: api };
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
  shouldFallbackToLegacyFinance: (error: any) => [400, 404, 405, 501].includes(Number(error?.status)),
}));

vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));

vi.mock('../../../src/components/Finance/FinancialStatementMappingEditor', () => ({
  FinancialStatementMappingEditor: () => <div>financial-statement-mapping-editor</div>,
}));

import { V8FinanceApi } from '../../../src/services/api/v8/finance';
import { FinancialStatementImportWizard } from '../../../src/components/Finance/FinancialStatementImportWizard';

function dropFile(dropzone: HTMLElement, file: File) {
  fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });
}

describe('FinancialStatementImportWizard — FIN-005 CSV real-screen reachability (drag-and-drop path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a .csv file dropped onto the real dropzone is ACCEPTED (no "unsupported format" error) — this is what was broken before FIN-005', () => {
    render(<FinancialStatementImportWizard />);
    const dropzone = screen.getByRole('button', { name: 'Drop file or click to browse' });
    const csv = new File(['Revenue;2024;2023\n100;90'], 'statement.csv', { type: 'text/csv' });

    dropFile(dropzone, csv);

    expect(screen.queryByText(/Supported formats:/i)).toBeNull();
    // Selecting a file flips the wizard into its "ready to upload" state —
    // the Upload & Analyze action becomes available, proving `setFile` (not
    // `setError`) is what actually ran.
    expect(screen.getByRole('button', { name: 'Upload & Analyze' })).toBeTruthy();
  });

  it('an actually-unsupported extension is still rejected through the same dropzone — this is not "accept everything now"', () => {
    render(<FinancialStatementImportWizard />);
    const dropzone = screen.getByRole('button', { name: 'Drop file or click to browse' });
    const badFile = new File(['not a statement'], 'notes.txt', { type: 'text/plain' });

    dropFile(dropzone, badFile);

    expect(screen.getByText(/Supported formats:.*CSV/i)).toBeTruthy();
  });

  it('the hidden file input\'s accept attribute includes .csv (native file-picker reachability, not just drag-and-drop)', () => {
    const { container } = render(<FinancialStatementImportWizard />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.getAttribute('accept')).toBe('.pdf,.xlsx,.xls,.csv');
  });

  it('a CSV dropped via the real dropzone completes the full golden flow through to confirm — proves the fix is not cosmetic', async () => {
    vi.mocked(V8FinanceApi.uploadAndAnalyzeStatement).mockResolvedValue({
      mode: 'v8',
      statementIds: ['statement-csv-1'],
    } as any);
    vi.mocked(V8FinanceApi.detectStatement).mockResolvedValue({ statementId: 'statement-csv-1' } as any);
    vi.mocked(V8FinanceApi.extractStatement).mockResolvedValue({
      statementId: 'statement-csv-1',
      lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9 }],
    } as any);
    vi.mocked(V8FinanceApi.mapStatement).mockResolvedValue({
      statementId: 'statement-csv-1',
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
      statementId: 'statement-csv-1',
      savedCount: 1,
      readiness: { readinessStatus: 'ready', summary: 'Ready', reasonCodes: [] },
      validation: { status: 'pass', messages: [] },
    } as any);
    vi.mocked(V8FinanceApi.confirmStatement).mockResolvedValue({
      success: true,
      statementId: 'statement-csv-1',
      status: 'confirmed',
    } as any);

    const onComplete = vi.fn();
    render(<FinancialStatementImportWizard onComplete={onComplete} />);

    const dropzone = screen.getByRole('button', { name: 'Drop file or click to browse' });
    const csv = new File(['Revenue;2024;2023\n100;90'], 'statement.csv', { type: 'text/csv' });
    dropFile(dropzone, csv);
    expect(screen.queryByText(/Supported formats:/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Upload & Analyze' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Extract Financial Lines' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save & Validate' }));

    // No success signal before the server confirms: the Confirm & Save
    // action only appears once values were durably saved, and onComplete
    // (the wizard's own "done" signal to its caller) must not fire before
    // confirmStatement's promise resolves.
    await screen.findByRole('button', { name: 'Confirm & Save' });
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save' }));

    await waitFor(() => {
      expect(V8FinanceApi.confirmStatement).toHaveBeenCalledWith('statement-csv-1');
      expect(onComplete).toHaveBeenCalledWith('statement-csv-1');
    });
  });
});
