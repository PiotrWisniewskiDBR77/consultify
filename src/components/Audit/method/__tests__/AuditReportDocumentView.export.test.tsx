/**
 * AuditReportDocumentView — DOCX/PDF export buttons.
 *
 * DEC-417 (1.1-A3): flaga `ff_auditsReportChain` usunięta — oba przyciski są
 * teraz widoczne zawsze, bez warunku.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    getReport: vi.fn(),
    getProgram: vi.fn(),
    listProgramCriteria: vi.fn(),
    listEvidence: vi.fn(),
  };
});
vi.mock('@/services/api', () => ({ Api: { getUsers: vi.fn().mockResolvedValue([]) } }));

import { AuditReportDocumentView } from '../AuditReportDocumentView';
import { getProgram, getReport, listEvidence, listProgramCriteria } from '../auditsMethodApi';

const report = {
  id: 'rep/41',
  programId: 'prog-1',
  programName: 'Audit 41',
  reportKind: 'audit_report' as const,
  version: 1,
  title: 'Audit 41 report',
  status: 'draft' as const,
  language: 'pl',
  audience: null,
  confidentiality: null,
  approvedAt: null,
  publishedAt: null,
  updatedAt: '2026-08-28',
  payload: {
    reportKind: 'audit_report',
    generatedAt: '2026-08-28T00:00:00Z',
    sections: [{ id: 'executive_summary', title: 'Streszczenie', kind: 'text', content: 'Treść' }],
  },
};

async function renderView() {
  render(<AuditReportDocumentView reportId="rep/41" />);
  await screen.findAllByText('Audit 41 report');
}

describe('AuditReportDocumentView DOCX/PDF export', () => {
  beforeEach(() => {
    vi.mocked(getReport).mockResolvedValue(report);
    vi.mocked(getProgram).mockResolvedValue(null);
    vi.mocked(listProgramCriteria).mockResolvedValue([]);
    vi.mocked(listEvidence).mockResolvedValue([]);
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:day41'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows both DOCX and PDF export buttons', async () => {
    await renderView();
    expect(screen.getByRole('button', { name: 'Pobierz DOCX' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pobierz PDF' })).toBeInTheDocument();
  });

  it('requests the encoded report export endpoint (DOCX)', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(new Blob(['PKdocx']), { status: 200 }));
    await renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Pobierz DOCX' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/audits/reports/rep%2F41/export.docx', {
        headers: {},
      })
    );
  });

  it('requests the encoded report export endpoint (PDF, FIX-187)', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(new Blob(['%PDF']), { status: 200 }));
    await renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Pobierz PDF' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/audits/reports/rep%2F41/export.pdf', {
        headers: {},
      })
    );
  });

  it('disables the DOCX control while the response is pending', async () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    await renderView();
    const button = screen.getByRole('button', { name: 'Pobierz DOCX' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
  });

  it('disables the PDF control while the response is pending (FIX-187)', async () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    await renderView();
    const button = screen.getByRole('button', { name: 'Pobierz PDF' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
  });

  it('shows an inline backend error and never calls alert (DOCX)', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'AUDIT_NOT_FOUND' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Pobierz DOCX' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('AUDIT_NOT_FOUND');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('shows an inline backend error and never calls alert (PDF, FIX-187)', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'AUDIT_NOT_FOUND' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Pobierz PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('AUDIT_NOT_FOUND');
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
