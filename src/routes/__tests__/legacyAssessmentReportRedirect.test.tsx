// @vitest-environment jsdom

/**
 * `/assessment-reports/:reportId` — alias raportu oceny (NAPRAWA F5 2026-09-15).
 *
 * KROK 0 (zmierzone na stagingu `de73155bc7`, org Northwind, konto Irina —
 * dowody `~/Developer/cto-codex/fala-f5-20260915/pomiar/`):
 *   `GET /api/assessment-reports` zwraca zatwierdzony raport DRD
 *   `71de85bb-…` z `builderReportId: null` i `assessmentId: b2de5832-…`.
 *   Stara wersja `LegacyAssessmentReportRedirect` wkładała wtedy id RAPORTU
 *   OCENY w trasę KREATORA (`/reports/builder/71de85bb-…`), kreator wołał
 *   `GET /api/report-builder/71de85bb-…` → 404 i użytkownik lądował w
 *   PUSTYM kreatorze („Start building your report") z `ApiError: Report not
 *   found` w konsoli.
 *
 * Ten test pilnuje trzech przypadków, których żaden inny test nie trzymał:
 *   1. id raportu OCENY (brak `builderReportId`) → żywy czytnik raportu DRD;
 *   2. id raportu KREATORA (`builderReportId` obecne, albo `/full` 404 a
 *      `/report-builder/:id` 200) → kreator;
 *   3. id nieznane obu przestrzeniom → czytelny stan „Report not available",
 *      NIGDY pusty kreator ani surowy ApiError.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

import { LegacyAssessmentReportRedirect, trasaZPayloaduRaportu } from '../LegacyAssessmentReportRedirect';

function renderAt(reportId: string) {
  return render(
    <MemoryRouter initialEntries={[`/assessment-reports/${reportId}`]}>
      <Routes>
        <Route path="/assessment-reports/:reportId" element={<LegacyAssessmentReportRedirect />} />
        <Route
          path="/assessment/outputs/:outputId/report"
          element={<div data-testid="cel">raport-oceny:{location.pathname}</div>}
        />
        <Route path="/reports/builder/:id" element={<div data-testid="cel-kreator">kreator</div>} />
        <Route path="/reports/builder" element={<div data-testid="cel-kreator-lista">lista</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('[F5] LegacyAssessmentReportRedirect — /assessment-reports/:reportId', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('czysta reguła: brak builderReportId + jest assessmentId → trasa raportu oceny', () => {
    expect(
      trasaZPayloaduRaportu({
        id: '71de85bb-f745-5159-8ba4-cbcfbd20602c',
        builderReportId: null,
        assessmentId: 'b2de5832-0a42-5639-8e46-6ecff2db82e5',
      })
    ).toBe('/assessment/outputs/b2de5832-0a42-5639-8e46-6ecff2db82e5/report');
  });

  it('czysta reguła: builderReportId wygrywa → trasa kreatora', () => {
    expect(
      trasaZPayloaduRaportu({ report: { builderReportId: 'bld-1', assessmentId: 'asm-1' } })
    ).toBe('/reports/builder/bld-1');
  });

  it('czysta reguła: ani builder, ani ocena → brak trasy', () => {
    expect(trasaZPayloaduRaportu({ id: 'x' })).toBeNull();
    expect(trasaZPayloaduRaportu(null)).toBeNull();
  });

  it('id RAPORTU OCENY (przypadek Northwind DRD) → żywy widok raportu, nie pusty kreator', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/assessment-reports/')) {
        return Promise.resolve({
          id: '71de85bb-f745-5159-8ba4-cbcfbd20602c',
          name: 'Northwind 2027 Operational Maturity Report',
          status: 'APPROVED',
          builderReportId: null,
          assessmentId: 'b2de5832-0a42-5639-8e46-6ecff2db82e5',
        });
      }
      return Promise.reject(new Error('nie powinno być wołane'));
    });

    renderAt('71de85bb-f745-5159-8ba4-cbcfbd20602c');

    await waitFor(() => expect(screen.getByTestId('cel')).toBeInTheDocument());
    expect(screen.queryByTestId('cel-kreator')).not.toBeInTheDocument();
  });

  it('id RAPORTU KREATORA (nieznane `/full`, znane `/report-builder`) → kreator', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/assessment-reports/')) {
        return Promise.reject(Object.assign(new Error('Report not found'), { status: 404 }));
      }
      if (url.includes('/report-builder/')) return Promise.resolve({ id: 'bld-9' });
      return Promise.reject(new Error('nieoczekiwane'));
    });

    renderAt('bld-9');

    await waitFor(() => expect(screen.getByTestId('cel-kreator')).toBeInTheDocument());
  });

  it('id nieznane obu przestrzeniom → czytelny stan „Report not available", bez pustego kreatora', async () => {
    mockGet.mockImplementation(() =>
      Promise.reject(Object.assign(new Error('Report not found'), { status: 404 }))
    );

    renderAt('nie-ma-takiego');

    await waitFor(() =>
      expect(screen.getByTestId('legacy-assessment-report-not-available')).toBeInTheDocument()
    );
    expect(screen.getByText(/Report not available/i)).toBeInTheDocument();
    expect(screen.queryByTestId('cel-kreator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cel')).not.toBeInTheDocument();
  });
});
