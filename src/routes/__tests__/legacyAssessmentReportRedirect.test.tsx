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
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
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

/** Cel przekierowania — pokazuje ID, na które alias naprawdę wszedł.
 * (Wcześniej element czytał `location.pathname` z globalnego okna, a nie
 * z MemoryRoutera, więc pokazywał zawsze „/" i nic nie dowodził.) */
function CelRaportuOceny() {
  const { outputId } = useParams<{ outputId?: string }>();
  return <div data-testid="cel">raport-oceny:/assessment/outputs/{outputId}/report</div>;
}

function renderAt(reportId: string) {
  return render(
    <MemoryRouter initialEntries={[`/assessment-reports/${reportId}`]}>
      <Routes>
        <Route path="/assessment-reports/:reportId" element={<LegacyAssessmentReportRedirect />} />
        <Route path="/assessment/outputs/:outputId/report" element={<CelRaportuOceny />} />
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

  // ── F8a (2026-09-15) ─────────────────────────────────────────────────────
  // Kolejność z rozkazu: ZAMROŻONY Output przed rekordem sesji. Liczby
  // w testach są ZMIERZONE na stagingu `6c34292eb0` (org Northwind, konto
  // Iriny — `~/Developer/cto-codex/fala-f8a-20260915/pomiar/m2-api.json`):
  //   zamrożone Outputy org: `566e5de3-…` (sesja `a9c8f477-…`, 39 jednostek),
  //     `49ea2d44-…` (sesja `63aa51e1-…`, 39 jednostek);
  //   raport `71de85bb-…` → `assessmentId b2de5832-…`, dla którego
  //     `/api/method/outputs/b2de5832-…` = 404, a lista Outputów tej sesji jest
  //     PUSTA — jądro nie zna żadnego dowiązania do tej oceny zastanej.
  describe('[F8a] zamrożony Output ma pierwszeństwo przed rekordem sesji', () => {
    it('czysta reguła: gdy jest zamrożony Output, trasa prowadzi do NIEGO, nie do oceny', () => {
      expect(
        trasaZPayloaduRaportu(
          {
            id: '71de85bb-f745-5159-8ba4-cbcfbd20602c',
            builderReportId: null,
            assessmentId: 'a9c8f477-8d8f-4d31-804d-a39700de4b0a',
          },
          '566e5de3-7527-4fa7-9707-8e4b6d0b91ba'
        )
      ).toBe('/assessment/outputs/566e5de3-7527-4fa7-9707-8e4b6d0b91ba/report');
    });

    it('czysta reguła: Kreator dalej wygrywa nawet przy istniejącym Outpucie', () => {
      expect(
        trasaZPayloaduRaportu({ builderReportId: 'bld-1', assessmentId: 'asm-1' }, 'out-1')
      ).toBe('/reports/builder/bld-1');
    });

    it('trasa końcowa: sesja jądra z zamrożonym Outputem → /assessment/outputs/<outputId>/report', async () => {
      const wolane: string[] = [];
      mockGet.mockImplementation((url: string) => {
        wolane.push(url);
        if (url.includes('/assessment-reports/')) {
          return Promise.resolve({
            id: 'rap-1',
            builderReportId: null,
            assessmentId: 'a9c8f477-8d8f-4d31-804d-a39700de4b0a',
          });
        }
        if (url.includes('/method/outputs')) {
          return Promise.resolve({
            outputs: [{ id: '566e5de3-7527-4fa7-9707-8e4b6d0b91ba' }],
            total: 1,
          });
        }
        return Promise.reject(new Error('nieoczekiwane'));
      });

      renderAt('rap-1');

      await waitFor(() => expect(screen.getByTestId('cel')).toBeInTheDocument());
      expect(
        wolane.some((u) =>
          u.includes('/method/outputs?sessionId=a9c8f477-8d8f-4d31-804d-a39700de4b0a')
        )
      ).toBe(true);
      expect(screen.getByTestId('cel').textContent).toContain(
        '/assessment/outputs/566e5de3-7527-4fa7-9707-8e4b6d0b91ba/report'
      );
    });

    it('PRZYPADEK Northwind `71de85bb-…`: jądro nie ma Outputu → fallback na rekord sesji, bez cudzych liczb', async () => {
      mockGet.mockImplementation((url: string) => {
        if (url.includes('/assessment-reports/')) {
          return Promise.resolve({
            id: '71de85bb-f745-5159-8ba4-cbcfbd20602c',
            builderReportId: null,
            assessmentId: 'b2de5832-0a42-5639-8e46-6ecff2db82e5',
          });
        }
        // Zmierzone: pusta lista — ta ocena zastana nie ma Outputu w jądrze.
        if (url.includes('/method/outputs')) return Promise.resolve({ outputs: [], total: 0 });
        return Promise.reject(new Error('nieoczekiwane'));
      });

      renderAt('71de85bb-f745-5159-8ba4-cbcfbd20602c');

      await waitFor(() => expect(screen.getByTestId('cel')).toBeInTheDocument());
      expect(screen.getByTestId('cel').textContent).toContain(
        '/assessment/outputs/b2de5832-0a42-5639-8e46-6ecff2db82e5/report'
      );
      // NIGDY cudzy Output — dopasowanie po nazwie byłoby zgadywaniem.
      expect(screen.getByTestId('cel').textContent).not.toContain('566e5de3');
    });

    it('błąd zapytania o Output nie wywraca aliasu — spadamy do rekordu sesji', async () => {
      mockGet.mockImplementation((url: string) => {
        if (url.includes('/assessment-reports/')) {
          return Promise.resolve({ builderReportId: null, assessmentId: 'asm-err' });
        }
        return Promise.reject(Object.assign(new Error('boom'), { status: 500 }));
      });

      renderAt('rap-err');

      await waitFor(() => expect(screen.getByTestId('cel')).toBeInTheDocument());
      expect(screen.getByTestId('cel').textContent).toContain(
        '/assessment/outputs/asm-err/report'
      );
    });
  });
});
