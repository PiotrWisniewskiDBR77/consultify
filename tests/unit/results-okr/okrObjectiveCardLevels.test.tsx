/**
 * @vitest-environment jsdom
 *
 * CZTERY POZIOMY RODZINY OKR + REGRESJA CRASHU KARTY KLUCZOWEGO REZULTATU.
 *
 * ── DLACZEGO TEN PLIK ISTNIEJE ─────────────────────────────────────────────
 * 1. Odrzucenie właściciela 2026-09-05: „Tutaj mamy tabelę, pod nią kartę,
 *    piętro niżej – zbiór kart, a poniżej kolejna karta." Zatwierdzony obraz
 *    karty celu (`evidence/grafika/26-wyniki-karty-n/cel-jedna-karta__PO__*`,
 *    ocena A) istniał WYŁĄCZNIE jako prototyp w harnessie — w aplikacji nie
 *    było ani jednej trasy, która by go pokazała. Testy niżej pilnują, że
 *    każde z trzech dołożonych pięter ma realne wejście i realne wyjście.
 * 2. Zgłoszony crash „ReferenceError: shortOkrId is not defined" w
 *    `okrKeyResultPresenters.tsx` — funkcja była WOŁANA w renderze kolumny
 *    „Właściciel", ale nigdy nie zaimportowana. Ten defekt jest niewidoczny
 *    dla testu, który sprawdza tylko KSZTAŁT tablicy kolumn: `render` jest
 *    domknięciem, więc wybucha dopiero, gdy komórka NAPRAWDĘ się rysuje.
 *    Dlatego test niżej RENDERUJE każdą komórkę każdej kolumny.
 *
 * ── DOWÓD MUTACYJNY (wykonany 2026-09-05, nie deklarowany) ─────────────────
 *  · przywrócenie w `okrKeyResultPresenters.tsx` renderu kolumny „Właściciel"
 *    do postaci sprzed naprawy (`{name || shortOkrId(row.ownerUserId)}` bez
 *    importu) → pada test „komórki renderują się także gdy nazwiska NIE DA SIĘ
 *    rozwiązać" z dokładnie tym `ReferenceError`, który zgłosił właściciel.
 *    UWAGA ZMIERZONA: wariant testu z resolverem ZNAJĄCYM nazwisko przechodzi
 *    nawet na zepsutym kodzie (`name || …` zwiera się na pierwszym członie) —
 *    dlatego bronić musi test z resolverem zwracającym `null`;
 *  · zamiana `okrKeyResultCardPath` na ścieżkę bez `keyResultId` → padają
 *    testy ścieżki poziomów i nawigacji ze zbioru kart do karty KR.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

/**
 * ── PUŁAPKA HARNESSU (zmierzona 2026-09-05, nie założona) ──────────────────
 * `tests/setup.ts` L151-165 globalnie podmienia `useNavigate` na `vi.fn()`
 * („useNavigate safety"), żeby komponenty renderowane BEZ routera nie
 * wybuchały. Skutek uboczny: KAŻDY test nawigacji przechodzi trywialnie na
 * atrapie i NIC nie mierzy — klik wołał poprawny adres, a `location` stała
 * w miejscu. Ten plik przywraca PRAWDZIWY `react-router-dom`, żeby test
 * poziomów mierzył realne przejście, a nie zaślepkę.
 */
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) =>
      typeof fallback === 'string' ? fallback : ((fallback as { defaultValue?: string })?.defaultValue ?? key),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@/components/ResultsVNext/resultsVNextFeatureFlags', () => ({
  isResultsVNextFlagEnabled: () => true,
}));

vi.mock('@/hooks/useOrganizationMemberNames', () => ({
  useOrganizationMemberNames: () => (userId: string | null | undefined) =>
    userId === 'user-anna' ? 'Anna Kowalczyk' : null,
  memberNameOrUnknown: (
    resolve: (id: string | null | undefined) => string | null,
    userId: string | null | undefined,
    isPolish: boolean
  ) => resolve(userId) ?? (isPolish ? 'Nieznany użytkownik' : 'Unknown user'),
}));

const KEY_RESULT = {
  keyResultId: 'kr-1',
  objectiveId: 'obj-1',
  setId: 'set-1',
  organizationId: 'org-1',
  ownerUserId: 'user-anna',
  title: 'Osiągnąć zweryfikowany cel realizacji korzyści',
  description: null,
  measurementType: 'numeric',
  unit: '%',
  currency: null,
  baselineValue: '0',
  targetValue: '100',
  startValue: '0',
  currentValue: '58',
  direction: 'increase',
  rangeMin: null,
  rangeMax: null,
  progress: '0.58',
  progressCalcPolicyVersionId: 'pol-1',
  progressCalcReason: null,
  outOfRangeDistance: null,
  confidence: 'medium',
  confidenceNumericValue: null,
  status: 'at_risk',
  sourceType: 'manual',
  sourceReference: null,
  weight: null,
  rowVersion: 1,
  createdBy: 'user-anna',
  createdAt: '2026-08-13T11:15:16.409Z',
  updatedBy: null,
  updatedAt: '2026-08-13T11:15:16.409Z',
} as const;

const OBJECTIVE = {
  objectiveId: 'obj-1',
  setId: 'set-1',
  organizationId: 'org-1',
  ownerUserId: 'user-anna',
  title: 'Potwierdzić mierzalne rezultaty transformacji',
  description: 'Domknąć pomiar wartości transformacji do końca cyklu.',
  rationale: null,
  ambitionType: 'committed',
  status: 'active',
  progress: '0.58',
  progressCalcPolicyVersionId: null,
  progressCalcReason: null,
  confidence: 'medium',
  confidenceNumericValue: null,
  confidenceCalcPolicyVersionId: null,
  confidenceCalcReason: null,
  sortOrder: 0,
  rowVersion: 1,
  createdBy: 'user-anna',
  createdAt: '2026-08-13T11:15:16.409Z',
  updatedBy: null,
  updatedAt: '2026-08-13T11:15:16.409Z',
  approvedAt: null,
  keyResults: [KEY_RESULT],
} as const;

const OKR_SET = {
  setId: 'set-1',
  organizationId: 'org-1',
  programId: 'prog-1',
  cycleId: 'cycle-1',
  scopeType: 'company',
  scopeId: 'org-1',
  ownerUserId: 'user-anna',
  reviewerUserId: null,
  title: 'Przyspieszyć realizację wartości transformacji',
  status: 'active',
  overallProgress: '0.58',
  overallConfidence: 'medium',
  attentionState: 'watch',
  currentVersion: 1,
  rowVersion: 1,
  createdBy: 'user-anna',
  createdAt: '2026-08-13T11:15:16.409Z',
  updatedBy: null,
  updatedAt: '2026-08-13T11:15:16.409Z',
} as const;

vi.mock('@/components/ResultsVNext/okr/okrObjectiveApi', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getObjectiveWithKeyResults: vi.fn(async () => OBJECTIVE),
  };
});

vi.mock('@/components/ResultsVNext/okr/okrApi', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, getOkrSet: vi.fn(async () => OKR_SET) };
});

vi.mock('@/components/ResultsVNext/okr/okrAdminApi', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, getOkrCycle: vi.fn(async () => null) };
});

vi.mock('@/components/ResultsVNext/okr/okrCheckInApi', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, listCheckIns: vi.fn(async () => []) };
});

vi.mock('@/components/ResultsVNext/okr/okrWorkspaceApi', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    listAlignmentsForObjective: vi.fn(async () => []),
    listOkrSetReviews: vi.fn(async () => []),
  };
});

import {
  okrKeyResultCardPath,
  okrKeyResultSetPath,
  okrObjectiveCardPath,
} from '@/components/ResultsVNext/okr/okrObjectiveCardPath';
import {
  buildOkrKeyResultColumns,
  buildOkrKeyResultPreview,
} from '@/components/ResultsVNext/okr/okrKeyResultPresenters';
import { OkrKeyResultSetPage } from '@/components/ResultsVNext/okr/OkrKeyResultSetPage';
import { OkrObjectiveCardPage } from '@/components/ResultsVNext/okr/OkrObjectiveCardPage';
import { OKR_OBJECTIVE_CARD_SECTIONS } from '@/components/ResultsVNext/okr/OkrObjectiveCardSections';
import { ROUTES } from '@/routes/routeConfig';

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

describe('OKR — ścieżka czterech poziomów (odrzucenie właściciela 2026-09-05)', () => {
  it('każdy poziom ma własny, podlinkowalny adres, a poziom 4 niesie całą ścieżkę', () => {
    expect(okrObjectiveCardPath('obj-1')).toBe('/results/okr/obj-1');
    expect(okrKeyResultSetPath('obj-1')).toBe('/results/okr/obj-1/rezultaty');
    expect(okrKeyResultCardPath('obj-1', 'kr-1')).toBe('/results/okr/obj-1/rezultaty/kr-1');
    // Poziom 4 zawiera poziom 3, a poziom 3 zawiera poziom 2 — ścieżka
    // poziomów jest w ADRESIE, nie w stanie komponentu, więc przeżywa F5.
    expect(okrKeyResultCardPath('obj-1', 'kr-1').startsWith(okrKeyResultSetPath('obj-1'))).toBe(true);
    expect(okrKeyResultSetPath('obj-1').startsWith(okrObjectiveCardPath('obj-1'))).toBe(true);
  });

  it('trasy poziomów są zadeklarowane w routeConfig (nie tylko w komponentach)', () => {
    expect(ROUTES.RESULTS_OKR.OBJECTIVE).toBe('/results/okr/:objectiveId');
    expect(ROUTES.RESULTS_OKR.OBJECTIVE_KEY_RESULTS).toBe('/results/okr/:objectiveId/rezultaty');
    expect(ROUTES.RESULTS_OKR.OBJECTIVE_KEY_RESULT).toBe('/results/okr/:objectiveId/rezultaty/:keyResultId');
  });
});

describe('Regresja crashu karty Kluczowego Rezultatu', () => {
  it('każda komórka kolumn KR renderuje się bez wyjątku (crash `shortOkrId is not defined`)', () => {
    const columns = buildOkrKeyResultColumns(true, 'active', (userId) =>
      userId === 'user-anna' ? 'Anna Kowalczyk' : null
    );
    expect(columns.length).toBeGreaterThan(0);
    // WŁAŚNIE TO wybuchało: `render` jest domknięciem, więc brakujący import
    // ujawnia się dopiero przy rysowaniu komórki, nie przy budowie tablicy.
    for (const column of columns) {
      const cell = column.render?.(KEY_RESULT as never, 0);
      const { unmount } = render(<div>{cell as React.ReactNode}</div>);
      unmount();
    }
  });

  it('komórki renderują się także gdy nazwiska NIE DA SIĘ rozwiązać (ta gałąź wybuchała)', () => {
    // KLUCZOWE: pierwotny crash siedział w gałęzi `name || shortOkrId(...)`,
    // czyli odpalał się WYŁĄCZNIE wtedy, gdy resolver nie zna użytkownika
    // (pusta lista członków, konto usunięte, brak organizacji w kontekście).
    // Test z rozwiązywalnym nazwiskiem przechodzi nawet na zepsutym kodzie —
    // dlatego ta wersja z resolverem zwracającym `null` jest tą, która broni.
    const columns = buildOkrKeyResultColumns(true, 'active', () => null);
    for (const column of columns) {
      const { unmount } = render(<div>{column.render?.(KEY_RESULT as never, 0) as React.ReactNode}</div>);
      unmount();
    }
  });

  it('kolumna „Właściciel" pokazuje nazwisko, nigdy surowego identyfikatora', () => {
    const columns = buildOkrKeyResultColumns(true, 'active', (userId) =>
      userId === 'user-anna' ? 'Anna Kowalczyk' : null
    );
    const owner = columns.find((column) => column.id === 'owner');
    expect(owner).toBeDefined();
    render(<div>{owner!.render?.(KEY_RESULT as never, 0) as React.ReactNode}</div>);
    expect(screen.getByText('Anna Kowalczyk')).toBeTruthy();
    expect(screen.queryByText('user-anna')).toBeNull();
  });

  it('podgląd KR buduje się i renderuje bez wyjątku', () => {
    const preview = buildOkrKeyResultPreview(KEY_RESULT as never, {
      isPolish: true,
      resolveMemberName: (userId) => (userId === 'user-anna' ? 'Anna Kowalczyk' : null),
      parentSetStatus: 'active',
      onClose: () => {},
      onOpenCheckIns: () => {},
      onEdit: () => {},
      onCancel: () => {},
    });
    expect(preview.title).toBe(KEY_RESULT.title);
    for (const property of preview.details?.properties ?? []) {
      const { unmount } = render(<div>{property.value as React.ReactNode}</div>);
      unmount();
    }
  });
});

describe('Poziom 3 → poziom 4 (zbiór kart KR → karta KR)', () => {
  it('kafelek zbioru otwiera kartę Kluczowego Rezultatu pod adresem poziomu 4', async () => {
    render(
      <MemoryRouter initialEntries={['/results/okr/obj-1/rezultaty']}>
        <LocationProbe />
        <Routes>
          <Route path={ROUTES.RESULTS_OKR.OBJECTIVE_KEY_RESULTS} element={<OkrKeyResultSetPage />} />
          <Route path={ROUTES.RESULTS_OKR.OBJECTIVE_KEY_RESULT} element={<div>karta KR</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId('okr-key-result-set-grid')).toBeTruthy());
    fireEvent.click(screen.getByTestId(`standard-grid-card-${KEY_RESULT.keyResultId}`));

    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('/results/okr/obj-1/rezultaty/kr-1')
    );
  });
});

describe('Poziom 2 — karta celu w PRODUKCJI (zatwierdzony obraz `cel-jedna-karta`)', () => {
  it('renderuje pięć sekcji zatwierdzonej lewej nawigacji i wchodzi w zbiór kart KR', async () => {
    render(
      <MemoryRouter initialEntries={['/results/okr/obj-1']}>
        <LocationProbe />
        <Routes>
          <Route path={ROUTES.RESULTS_OKR.OBJECTIVE} element={<OkrObjectiveCardPage />} />
          <Route path={ROUTES.RESULTS_OKR.OBJECTIVE_KEY_RESULTS} element={<div>zbior KR</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId('results-vnext-okr-objective-card-page')).toBeTruthy());

    // Lewa nawigacja karty = dokładnie kontrakt sekcji z zatwierdzonego obrazu.
    for (const section of OKR_OBJECTIVE_CARD_SECTIONS) {
      expect(screen.getAllByText(section.label.pl).length).toBeGreaterThan(0);
    }

    // Tytuł nagłówka niesie tożsamość celu (a nie identyfikator).
    expect(screen.getAllByText(new RegExp(OBJECTIVE.title)).length).toBeGreaterThan(0);

    // Wejście „piętro niżej" z prawego panelu (Akcje) — poziom 3.
    fireEvent.click(screen.getByTestId('okr-objective-card-panel-key-result-set'));
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('/results/okr/obj-1/rezultaty')
    );
  });
});
