// @vitest-environment jsdom

/**
 * Assessment Output artifact routes (tor "wołacze" 2026-09-02).
 *
 * Proves the two new routes (`/assessment/outputs/:outputId/report`,
 * `/assessment/outputs/:outputId/presentation`) actually MOUNT the two
 * previously-orphaned components (`AssessmentReportView`,
 * `AssessmentPresentationView`) and pass them `outputId` from the URL —
 * not just that a redirect exists when the flag is OFF. A test that only
 * checks the OFF→redirect branch would still pass if the ON branch were
 * broken or the component were silently dropped (`outputId={undefined}` /
 * `null`).
 *
 * `AssessmentOutputReportRoute` / `AssessmentOutputPresentationRoute` are
 * defined inline in `src/routes/AppRoutes.tsx` (same shape as the existing
 * `DRDAuditReportRoute`) and exported there as NAMED exports specifically
 * so this test can render the REAL route component instead of a
 * reimplementation of its flag-branching logic. Pattern (MemoryRouter +
 * Routes around a real route component) mirrors
 * `src/components/Results/__tests__/ResultsOwnerReviewEntry.test.tsx`.
 *
 * The two view components are mocked (not exercised end-to-end here — they
 * own their own fetches/tests) purely so this test can assert on the
 * `outputId` prop the route passed them without needing a live method-core
 * backend.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/assessment/report/AssessmentReportView', () => ({
  default: ({ outputId }: { outputId: string | null }) => (
    <div data-testid="report-view">report:{outputId ?? 'null'}</div>
  ),
}));

vi.mock('@/components/assessment/presentation/AssessmentPresentationView', () => ({
  default: ({ outputId }: { outputId: string | null }) => (
    <div data-testid="presentation-view">presentation:{outputId ?? 'null'}</div>
  ),
}));

import { AssessmentOutputPresentationRoute, AssessmentOutputReportRoute } from '../AppRoutes';

const FLAG_LOCAL_STORAGE_KEY = 'ff.assessment_output_artifacts';

function renderReportAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <React.Suspense fallback={<div>loading</div>}>
        <Routes>
          <Route
            path="/assessment/outputs/:outputId/report"
            element={<AssessmentOutputReportRoute />}
          />
          <Route path="/assessment" element={<div>outputs tab (redirect target)</div>} />
        </Routes>
      </React.Suspense>
    </MemoryRouter>
  );
}

function renderPresentationAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <React.Suspense fallback={<div>loading</div>}>
        <Routes>
          <Route
            path="/assessment/outputs/:outputId/presentation"
            element={<AssessmentOutputPresentationRoute />}
          />
          <Route path="/assessment" element={<div>outputs tab (redirect target)</div>} />
        </Routes>
      </React.Suspense>
    </MemoryRouter>
  );
}

describe('Assessment Output artifact routes', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  // NAPRAWA MVP 06.09 (evidence/audyt-mvp-20260906/A2/RAPORT_A2.md poz. 5.2,
  // BLOKER): flaga jest teraz domyślnie ON (decyzja CTO — patrz komentarz w
  // assessmentOutputArtifactsFlag.ts). Testy OFF poniżej wymuszają OFF przez
  // localStorage zamiast polegać na domyślnej wartości — to jest teraz ŚCIEŻKA
  // AWARYJNA (wyłączenie w razie regresji na żywo), nie stan domyślny.
  it('flag OFF (jawne wyłączenie awaryjne): report route redirects and does NOT mount AssessmentReportView', async () => {
    window.localStorage.setItem(FLAG_LOCAL_STORAGE_KEY, '0');
    renderReportAt('/assessment/outputs/abc/report');
    expect(await screen.findByText('outputs tab (redirect target)')).toBeInTheDocument();
    expect(screen.queryByTestId('report-view')).not.toBeInTheDocument();
  });

  it('flag ON (default): report route mounts AssessmentReportView with outputId from the URL', async () => {
    renderReportAt('/assessment/outputs/abc/report');
    expect(await screen.findByTestId('report-view')).toHaveTextContent('report:abc');
  });

  it('flag OFF (jawne wyłączenie awaryjne): presentation route redirects and does NOT mount AssessmentPresentationView', async () => {
    window.localStorage.setItem(FLAG_LOCAL_STORAGE_KEY, '0');
    renderPresentationAt('/assessment/outputs/xyz/presentation');
    expect(await screen.findByText('outputs tab (redirect target)')).toBeInTheDocument();
    expect(screen.queryByTestId('presentation-view')).not.toBeInTheDocument();
  });

  it('flag ON (default): presentation route mounts AssessmentPresentationView with outputId from the URL', async () => {
    renderPresentationAt('/assessment/outputs/xyz/presentation');
    expect(await screen.findByTestId('presentation-view')).toHaveTextContent('presentation:xyz');
  });
});

/**
 * ★ DRUGI BLOK — pilnuje SAMEJ REJESTRACJI, nie tylko komponentu trasy.
 *
 * Luka w bloku wyżej, znaleziona przy odbiorze (lekcja „test scenariusza nie
 * broni zabezpieczenia"): tamte testy budują WŁASNY `<Route path=…>` wokół
 * prawdziwego komponentu trasy. Gdyby ktoś skasował rejestrację
 * `<Route path="outputs/:outputId/report">` z bloku modułu Ocena w
 * `AppRoutes.tsx` — czyli DOKŁADNIE ten wołacz, o który chodzi w całej tej
 * pracy — tamte cztery testy nadal by przechodziły. Zabezpieczeniem jest
 * rejestracja i pozycja w kebabie; to je pinuje.
 *
 * Wzór czytania źródła 1:1 z `executionCanonicalRoute.test.ts` w tym katalogu.
 */
describe('Assessment Output artifact — rejestracja wołacza (pin na źródle)', () => {
  const appRoutes = readFileSync(resolve(process.cwd(), 'src/routes/AppRoutes.tsx'), 'utf8');
  const outputsTab = readFileSync(
    resolve(process.cwd(), 'src/components/assessment/AssessmentOutputsTab.tsx'),
    'utf8'
  );

  it('rejestruje obie trasy wewnątrz bloku modułu Ocena', () => {
    expect(appRoutes).toContain('path="outputs/:outputId/report"');
    expect(appRoutes).toContain('path="outputs/:outputId/presentation"');
    expect(appRoutes).toContain('<AssessmentOutputReportRoute />');
    expect(appRoutes).toContain('<AssessmentOutputPresentationRoute />');
  });

  it('trasy leżą w bloku ROUTES.ASSESSMENT.ROOT, a nie gdziekolwiek indziej', () => {
    const start = appRoutes.indexOf('${ROUTES.ASSESSMENT.ROOT}/*');
    expect(start).toBeGreaterThan(-1);
    const blok = appRoutes.slice(start, start + 4000);
    expect(blok).toContain('path="outputs/:outputId/report"');
    expect(blok).toContain('path="outputs/:outputId/presentation"');
  });

  it('kebab wiersza w zakładce Wnioski prowadzi do obu tras', () => {
    expect(outputsTab).toContain('/assessment/outputs/${rowId}/report');
    expect(outputsTab).toContain('/assessment/outputs/${rowId}/presentation');
    // Droga dojścia MUSI być za flagą — inaczej OFF przestaje znaczyć
    // „zachowanie bajt-w-bajt jak dziś".
    expect(outputsTab).toContain('isAssessmentOutputArtifactsEnabled()');
  });

  // NAPRAWA MVP 06.09 (poz. 5.2, BLOKER — patrz komentarz nad testami OFF
  // wyżej): odwrócona z domyślnie OFF na domyślnie ON, decyzja CTO. Ten test
  // teraz pinuje NOWY stan zamiast starego, żeby przyszła zmiana defaultu
  // była równie świadoma jak ta.
  it('flaga jest domyślnie ON (naprawa MVP 06.09, poz. 5.2 — decyzja CTO)', () => {
    const flaga = readFileSync(
      resolve(process.cwd(), 'src/utils/assessmentOutputArtifactsFlag.ts'),
      'utf8'
    );
    const fn = flaga.slice(flaga.indexOf('export function isAssessmentOutputArtifactsEnabled'));
    expect(fn).toContain('return true;');
    expect(fn).not.toContain('return false;');
  });
});
