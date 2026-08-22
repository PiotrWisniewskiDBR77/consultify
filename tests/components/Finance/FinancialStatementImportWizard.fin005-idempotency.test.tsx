/**
 * @vitest-environment jsdom
 *
 * FIN-005 Fix 2 — frontend half of the idempotency fix.
 *
 * Root cause this closes: FinancialStatementImportWizard called
 * POST /api/v8/finance/statements/upload-and-analyze (falling back to the
 * legacy /api/finance-statements/upload-and-analyze on 400/404/405/501)
 * without ever sending an Idempotency-Key — so a client retry after a slow
 * upload (LLM analysis can legitimately exceed the client's request
 * timeout) created a genuine duplicate Statement/Pack on the server, even
 * though the server-side reservation/finalize/fail state machine
 * (reserveIdempotentUpload et al., financialStatementService.ts) existed
 * and was ALREADY wired into both upload-and-analyze endpoints (see the
 * FIN-005 Fix 2 server-side commits) — it just never received a key to key
 * off of.
 *
 * `FinancialStatementImportWizard.v8-manual-flow.test.tsx` (updated by this
 * same change) already proves: the Idempotency-Key header is sent on the v8
 * call, and a retry onto the legacy fallback reuses the SAME key. This file
 * covers the two things that test does not:
 *   1. a 409 UPLOAD_IN_PROGRESS response shows an honest "try again
 *      shortly" state — NOT a false success (the wizard must not advance
 *      past the upload step), and NOT the generic error message either;
 *   2. a manual retry after that 409 reuses the SAME Idempotency-Key —
 *      proving the key survives a full failed-attempt/retry round trip via
 *      component state, not just a single render.
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
  const api = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    postMultipart: vi.fn(),
  };
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
  shouldFallbackToLegacyFinance: (error: any) =>
    [400, 404, 405, 501].includes(Number(error?.status)),
}));

vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));

vi.mock('../../../src/components/Finance/FinancialStatementMappingEditor', () => ({
  FinancialStatementMappingEditor: () => <div>financial-statement-mapping-editor</div>,
  isFinancialStatementValueVerified: () => false,
}));

import Api from '../../../src/services/api';
import { V8FinanceApi } from '../../../src/services/api/v8/finance';
import { FinancialStatementImportWizard } from '../../../src/components/Finance/FinancialStatementImportWizard';

function selectFile(container: HTMLElement) {
  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['revenue'], 'statement.csv', { type: 'text/csv' });
  fireEvent.change(fileInput, { target: { files: [file] } });
}

describe('FinancialStatementImportWizard — FIN-005 Fix 2 idempotency (409 handling + retry key reuse)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a 409 UPLOAD_IN_PROGRESS from the v8 endpoint shows the honest "try again shortly" message — not a false success, not the generic error', async () => {
    const inProgressError: any = new Error(
      'Another upload for this Idempotency-Key is already in progress — retry shortly'
    );
    inProgressError.status = 409;
    inProgressError.data = { code: 'UPLOAD_IN_PROGRESS', error: inProgressError.message };
    vi.mocked(V8FinanceApi.uploadAndAnalyzeStatement).mockRejectedValueOnce(inProgressError);

    const { container } = render(<FinancialStatementImportWizard />);
    selectFile(container);
    fireEvent.click(screen.getByRole('button', { name: 'Upload & Analyze' }));

    await waitFor(() => {
      expect(screen.getByText(/try again shortly/i)).toBeTruthy();
    });

    // Not a false success: the wizard must still be on the upload step, not
    // have advanced to Detection Results.
    expect(screen.queryByText('Detection Results')).toBeNull();
    // Not the generic fallback error path either (that would render the raw
    // Error message/status instead of the honest retry copy).
    expect(screen.queryByText(/^Another upload for this Idempotency-Key/)).toBeNull();
    // 409 is not in the v8→legacy fallback list, so the legacy endpoint must
    // never have been called for this failure.
    expect(Api.postMultipart).not.toHaveBeenCalled();
    // The Upload & Analyze action remains available for a retry (loading
    // state cleared, not stuck / not replaced by a dead end).
    expect(screen.getByRole('button', { name: 'Upload & Analyze' })).toBeTruthy();
  });

  it('a manual retry after UPLOAD_IN_PROGRESS reuses the SAME Idempotency-Key for the same file', async () => {
    const inProgressError: any = new Error('in progress');
    inProgressError.status = 409;
    inProgressError.data = { code: 'UPLOAD_IN_PROGRESS' };
    vi.mocked(V8FinanceApi.uploadAndAnalyzeStatement)
      .mockRejectedValueOnce(inProgressError)
      .mockResolvedValueOnce({ mode: 'legacy', statementIds: ['statement-1'] } as any);

    const { container } = render(<FinancialStatementImportWizard />);
    selectFile(container);

    fireEvent.click(screen.getByRole('button', { name: 'Upload & Analyze' }));
    await waitFor(() => {
      expect(screen.getByText(/try again shortly/i)).toBeTruthy();
    });

    // Manual retry — same button, same selected file (never re-picked).
    fireEvent.click(screen.getByRole('button', { name: 'Upload & Analyze' }));
    await waitFor(() => {
      expect(V8FinanceApi.uploadAndAnalyzeStatement).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Detection Results')).toBeTruthy();
    });

    const firstKey = (vi.mocked(V8FinanceApi.uploadAndAnalyzeStatement).mock.calls[0][1] as any)?.[
      'Idempotency-Key'
    ];
    const secondKey = (vi.mocked(V8FinanceApi.uploadAndAnalyzeStatement).mock.calls[1][1] as any)?.[
      'Idempotency-Key'
    ];
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
  });

  it('picking a genuinely different file after a failed attempt generates a NEW Idempotency-Key (not a stale reuse)', async () => {
    const inProgressError: any = new Error('in progress');
    inProgressError.status = 409;
    inProgressError.data = { code: 'UPLOAD_IN_PROGRESS' };
    vi.mocked(V8FinanceApi.uploadAndAnalyzeStatement)
      .mockRejectedValueOnce(inProgressError)
      .mockResolvedValueOnce({ mode: 'legacy', statementIds: ['statement-2'] } as any);

    const { container } = render(<FinancialStatementImportWizard />);
    selectFile(container);
    fireEvent.click(screen.getByRole('button', { name: 'Upload & Analyze' }));
    await waitFor(() => {
      expect(screen.getByText(/try again shortly/i)).toBeTruthy();
    });

    // A genuinely DIFFERENT file, not a retry of the same one.
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const otherFile = new File(['other revenue'], 'other-statement.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [otherFile] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload & Analyze' }));

    await waitFor(() => {
      expect(V8FinanceApi.uploadAndAnalyzeStatement).toHaveBeenCalledTimes(2);
    });

    const firstKey = (vi.mocked(V8FinanceApi.uploadAndAnalyzeStatement).mock.calls[0][1] as any)?.[
      'Idempotency-Key'
    ];
    const secondKey = (vi.mocked(V8FinanceApi.uploadAndAnalyzeStatement).mock.calls[1][1] as any)?.[
      'Idempotency-Key'
    ];
    expect(secondKey).toBeTruthy();
    expect(secondKey).not.toBe(firstKey);
  });

  it('a 409 IDEMPOTENCY_KEY_REUSED shows a real error state (distinct from UPLOAD_IN_PROGRESS)', async () => {
    const reuseError: any = new Error('reused');
    reuseError.status = 409;
    reuseError.data = { code: 'IDEMPOTENCY_KEY_REUSED' };
    vi.mocked(V8FinanceApi.uploadAndAnalyzeStatement).mockRejectedValueOnce(reuseError);

    const { container } = render(<FinancialStatementImportWizard />);
    selectFile(container);
    fireEvent.click(screen.getByRole('button', { name: 'Upload & Analyze' }));

    await waitFor(() => {
      expect(screen.getByText(/could not be safely retried/i)).toBeTruthy();
    });
    expect(screen.queryByText(/try again shortly/i)).toBeNull();
    expect(screen.queryByText('Detection Results')).toBeNull();
  });
});
