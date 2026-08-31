/**
 * AuditReportsTab — DOCX export control (FIX-1, dyżur 41 odbiór).
 *
 * `GET /reports/:id/export.docx` istniało i renderowało realny DOCX, ale
 * `grep -rn "export.docx" src/` dawał 0 trafień — żaden ekran nie miał
 * wołacza. To dowodzi drugiego miejsca (obok pełnego widoku raportu,
 * `AuditReportDocumentView.export.test.tsx`): kanoniczny slot „⋮ Pobierz”
 * w kebabie bloku Details podglądu listy Raportów, za tą samą flagą co
 * reszta łańcucha (`ff_audits_report_chain`), którą test włącza jawnie —
 * bez dotykania domyślnego stanu produkcyjnego (OFF).
 *
 * FIX-187: bliźniak PDF (`export.pdf`) obok DOCX — kanoniczny drugi slot
 * `details.extraActions` (patrz `StandardPreview.tsx`), ta sama flaga.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return { ...actual, listReports: vi.fn() };
});

import { resetAuditsReportChainFlagCache } from '@/utils/auditsReportChainFlag';

import { type AuditReportSummary, listReports } from '../auditsMethodApi';
import { AuditReportsTab } from '../tabs/AuditReportsTab';

const mockedListReports = vi.mocked(listReports);

const draftReport: AuditReportSummary = {
  id: 'rep-41',
  programId: 'prog-41',
  programName: 'Day 41 Audit',
  reportKind: 'audit_report',
  version: 1,
  title: 'Day 41 Audit Report',
  status: 'draft',
  language: 'en',
  audience: 'Executive sponsor',
  confidentiality: 'Confidential',
  approvedAt: null,
  publishedAt: null,
  updatedAt: '2026-08-10',
};

function flag(on: boolean) {
  localStorage.setItem('ff.audits_report_chain', on ? '1' : '0');
  resetAuditsReportChainFlagCache();
}

async function openReportPreview() {
  mockedListReports.mockResolvedValue({ items: [draftReport], total: 1 });
  render(<AuditReportsTab isPolish={false} />);
  await waitFor(() => expect(screen.getByText('Day 41 Audit Report')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Day 41 Audit Report'));
  await screen.findByTestId('audit-report-preview');
}

async function openDetailsKebab() {
  const trigger = await screen.findByRole('button', {
    name: 'sharedComponents.previewDetailsSection.detailsOptions',
  });
  fireEvent.click(trigger);
}

describe('AuditReportsTab DOCX/PDF export (FIX-1, FIX-187)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:day41-list'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    localStorage.removeItem('ff.audits_report_chain');
    resetAuditsReportChainFlagCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('flag OFF: the preview Details block renders no kebab at all (zero actions when onDownload is unset)', async () => {
    flag(false);
    await openReportPreview();
    expect(
      screen.queryByRole('button', {
        name: 'sharedComponents.previewDetailsSection.detailsOptions',
      })
    ).toBeNull();
  });

  it('flag ON: the preview Details kebab offers "Download DOCX" and requests the real export route', async () => {
    flag(true);
    vi.mocked(fetch).mockResolvedValue(new Response(new Blob(['PKdocx']), { status: 200 }));
    await openReportPreview();
    await openDetailsKebab();

    const downloadItem = await screen.findByText('Download DOCX');
    fireEvent.click(downloadItem);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/audits/reports/rep-41/export.docx', {
        headers: {},
      })
    );
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled());
  });

  it('flag ON: the preview Details kebab offers "Download PDF" and requests the real export route (FIX-187)', async () => {
    flag(true);
    vi.mocked(fetch).mockResolvedValue(new Response(new Blob(['%PDF']), { status: 200 }));
    await openReportPreview();
    await openDetailsKebab();

    const downloadItem = await screen.findByText('Download PDF');
    fireEvent.click(downloadItem);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/audits/reports/rep-41/export.pdf', {
        headers: {},
      })
    );
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled());
  });

  it('flag ON: a backend error surfaces inline in the preview panel, not as alert() (DOCX)', async () => {
    flag(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'AUDIT_NOT_FOUND' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await openReportPreview();
    await openDetailsKebab();
    fireEvent.click(await screen.findByText('Download DOCX'));

    expect(await screen.findByRole('alert')).toHaveTextContent('AUDIT_NOT_FOUND');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('flag ON: a backend error surfaces inline in the preview panel, not as alert() (PDF, FIX-187)', async () => {
    flag(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'AUDIT_NOT_FOUND' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await openReportPreview();
    await openDetailsKebab();
    fireEvent.click(await screen.findByText('Download PDF'));

    expect(await screen.findByRole('alert')).toHaveTextContent('AUDIT_NOT_FOUND');
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
