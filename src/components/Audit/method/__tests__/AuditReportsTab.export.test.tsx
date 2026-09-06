/**
 * AuditReportsTab — DOCX export control (FIX-1, dyżur 41 odbiór).
 *
 * `GET /reports/:id/export.docx` istniało i renderowało realny DOCX, ale
 * `grep -rn "export.docx" src/` dawał 0 trafień — żaden ekran nie miał
 * wołacza. To dowodzi drugiego miejsca (obok pełnego widoku raportu,
 * `AuditReportDocumentView.export.test.tsx`): kanoniczny slot „⋮ Pobierz”
 * w kebabie bloku Details podglądu listy Raportów.
 *
 * FIX-187: bliźniak PDF (`export.pdf`) obok DOCX — kanoniczny drugi slot
 * `details.extraActions` (patrz `StandardPreview.tsx`).
 *
 * DEC-417 (1.1-A3): flaga `ff_auditsReportChain` usunięta — te czynności są
 * teraz widoczne zawsze, bez warunku.
 *
 * `MemoryRouter`: `AuditReportsTab` woła `useNavigate()` i osadza
 * `JedenPrawyPanel` (→ `useJedenPanel()`/`useLocation()` bezwarunkowo, K5) —
 * bez Routera render rzuca „useLocation() may be used only in the context
 * of a <Router>” niezależnie od tej flagi (ZNALEZISKO przy 1.1-A3/K6).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return { ...actual, listReports: vi.fn() };
});

import { AuditReportsTab } from '../tabs/AuditReportsTab';
import { listReports, type AuditReportSummary } from '../auditsMethodApi';

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

async function openReportPreview() {
  mockedListReports.mockResolvedValue({ items: [draftReport], total: 1 });
  render(
    <MemoryRouter>
      <AuditReportsTab isPolish={false} />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText('Day 41 Audit Report')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Day 41 Audit Report'));
  // ZNALEZISKO (1.1-A3): `data-testid="audit-report-preview"` istniał na
  // opakowaniu, które K5 (`d1270acba2`) zastąpiło `JedenPrawyPanel` bez
  // przeniesienia testid — czekamy więc na realny element panelu (kebab
  // Details), a nie na usunięty atrybut.
  await screen.findByRole('button', {
    name: 'sharedComponents.previewDetailsSection.detailsOptions',
  });
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('the preview Details kebab offers "Download DOCX" and requests the real export route', async () => {
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

  it('the preview Details kebab offers "Download PDF" and requests the real export route (FIX-187)', async () => {
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

  it('a backend error surfaces inline in the preview panel, not as alert() (DOCX)', async () => {
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

  it('a backend error surfaces inline in the preview panel, not as alert() (PDF, FIX-187)', async () => {
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
