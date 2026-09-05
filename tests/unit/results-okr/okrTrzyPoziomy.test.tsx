/**
 * @vitest-environment jsdom
 *
 * TRZY POZIOMY RODZINY OKR (P7K część A) + REGRESJA CRASHU KOLUMN KR.
 *
 * ── DLACZEGO TEN PLIK ISTNIEJE ─────────────────────────────────────────────
 * 1. SSOT właściciela (`docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md`
 *    §1) rozstrzyga: OKR ma TRZY poziomy — tabela raportów → raport → karta
 *    celu — a kluczowy rezultat jest SEKCJĄ karty celu, nie własnym ekranem.
 *    Do 05.09 aplikacja miała cztery poziomy (`OkrKeyResultSetPage`,
 *    `OkrKeyResultCardPage`); korekta P7K §4/§6 każe je usunąć. Testy niżej
 *    pilnują, że każdy z trzech poziomów ma realne wejście i realne wyjście,
 *    a czwarty NIE ISTNIEJE ani jako plik, ani jako zachowanie.
 * 2. Zgłoszony crash „ReferenceError: shortOkrId is not defined" w
 *    `okrKeyResultPresenters.tsx` — funkcja była WOŁANA w renderze kolumny
 *    „Właściciel", ale nigdy nie zaimportowana. Ten defekt jest niewidoczny
 *    dla testu, który sprawdza tylko KSZTAŁT tablicy kolumn: `render` jest
 *    domknięciem, więc wybucha dopiero, gdy komórka NAPRAWDĘ się rysuje.
 *
 * ── DOWÓD MUTACYJNY (co konkretnie wywraca te testy) ───────────────────────
 *  · przywrócenie strony poziomu KR: dopisanie z powrotem
 *    `src/components/ResultsVNext/okr/OkrKeyResultSetPage.tsx` →  pada test
 *    „czwarty poziom nie istnieje jako plik";
 *  · przywrócenie trasy KR: zamiana elementu trasy
 *    `ROUTES.RESULTS_OKR.OBJECTIVE_KEY_RESULTS` z przekierowania na stronę →
 *    pada test „stary adres rezultatu przekierowuje na kartę celu"
 *    (`location` zostaje na `/rezultaty` zamiast wskoczyć na kartę);
 *  · zamiana kolejności poziomów w `okrReportPaths.ts` (np. raport pod cel
 *    zamiast celu pod raport) → pada test zawierania ścieżek;
 *  · przywrócenie w `okrKeyResultPresenters.tsx` renderu kolumny „Właściciel"
 *    do postaci sprzed naprawy (`{name || shortOkrId(row.ownerUserId)}` bez
 *    importu) → pada test „komórki renderują się także gdy nazwiska NIE DA
 *    SIĘ rozwiązać" z dokładnie tym `ReferenceError`, który zgłosił
 *    właściciel. UWAGA ZMIERZONA: wariant testu z resolverem ZNAJĄCYM
 *    nazwisko przechodzi nawet na zepsutym kodzie (`name || …` zwiera się na
 *    pierwszym członie) — bronić musi test z resolverem zwracającym `null`.
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
  // P7K (migracja 20262102): zespół i termin rezultatu.
  teamName: 'Produkcja L3',
  deadline: '2026-11-30',
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
  // P7K (migracja 20262102): temat celu = oś grupowania raportu.
  theme: 'Efektywność operacyjna',
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
  // P7K (migracja 20262102): nagłówek raportu.
  description: 'Raport OKR zakładu na bieżący cykl.',
  reportGoal: 'Domknąć pomiar wartości transformacji.',
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
    listObjectivesForSet: vi.fn(async () => [OBJECTIVE]),
    createObjective: vi.fn(async () => ({ objective: OBJECTIVE, created: true })),
  };
});

// P7K — read model raportu (agregaty poziomu 1 i daty check-inów poziomu 2).
vi.mock('@/components/ResultsVNext/okr/p7k/okrReportApi', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    listOkrReportSummaries: vi.fn(async () => [
      {
        setId: 'set-1',
        objectiveCount: 1,
        keyResultCount: 1,
        ownerCount: 1,
        stateCounts: { onTrack: 0, atRisk: 1, critical: 0, noSignal: 0 },
        lastCheckinAt: '2026-09-04T10:00:00.000Z',
      },
    ]),
    listKeyResultCheckInSummaries: vi.fn(async () => [
      {
        keyResultId: 'kr-1',
        lastCheckinAt: '2026-09-04T10:00:00.000Z',
        lastNote: 'Tempo poniżej planu.',
        checkInCount: 1,
      },
    ]),
  };
});

vi.mock('@/components/ResultsVNext/okr/okrApi', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getOkrSet: vi.fn(async () => OKR_SET),
    listOkrSets: vi.fn(async () => [OKR_SET]),
  };
});

vi.mock('@/components/ResultsVNext/okr/okrAdminApi', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getOkrCycle: vi.fn(async () => ({ cycleId: 'cycle-1', name: 'Q4 2026' })),
    listOkrCycles: vi.fn(async () => [{ cycleId: 'cycle-1', name: 'Q4 2026' }]),
  };
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

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  okrObjectiveCardInReportPath,
  okrObjectiveCardKeyResultPath,
  okrReportPath,
  OKR_REPORT_REGISTRY_PATH,
} from '@/components/ResultsVNext/okr/p7k/okrReportPaths';
import { okrObjectiveCardPath } from '@/components/ResultsVNext/okr/okrObjectiveCardPath';
import {
  buildOkrKeyResultColumns,
  buildOkrKeyResultPreview,
} from '@/components/ResultsVNext/okr/okrKeyResultPresenters';
import { OkrKeyResultRedirect } from '@/components/ResultsVNext/okr/p7k/OkrKeyResultRedirect';
import { OkrReportPage } from '@/components/ResultsVNext/okr/p7k/OkrReportPage';
import { OkrObjectiveCardPage } from '@/components/ResultsVNext/okr/OkrObjectiveCardPage';
import { OKR_OBJECTIVE_CARD_SECTIONS } from '@/components/ResultsVNext/okr/OkrObjectiveCardSections';
import { ROUTES } from '@/routes/routeConfig';

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

describe('OKR — TRZY poziomy (SSOT §1, korekta P7K §4/§6)', () => {
  it('każdy poziom ma własny, podlinkowalny adres, a niższy zawiera wyższy', () => {
    expect(OKR_REPORT_REGISTRY_PATH).toBe('/results/okr');
    expect(okrReportPath('set-1')).toBe('/results/okr/set-1');
    expect(okrObjectiveCardInReportPath('set-1', 'obj-1')).toBe(
      '/results/okr/set-1/objectives/obj-1'
    );
    // Poziom 3 zawiera poziom 2, a poziom 2 zawiera poziom 1 — ścieżka
    // poziomów siedzi w ADRESIE, nie w stanie komponentu, więc przeżywa F5.
    expect(okrObjectiveCardInReportPath('set-1', 'obj-1').startsWith(okrReportPath('set-1'))).toBe(
      true
    );
    expect(okrReportPath('set-1').startsWith(OKR_REPORT_REGISTRY_PATH)).toBe(true);
  });

  it('CZWARTEGO poziomu nie ma: żaden kanoniczny adres nie prowadzi do osobnej strony rezultatu', () => {
    // Wejście „w rezultat" to KOTWICA sekcji karty celu, nie nowy poziom —
    // ten sam `pathname` co karta celu, różnica tylko w query.
    const anchor = okrObjectiveCardKeyResultPath('set-1', 'obj-1', 'kr-1');
    expect(anchor.split('?')[0]).toBe(okrObjectiveCardInReportPath('set-1', 'obj-1'));
    expect(anchor).toContain('sekcja=kluczowe-rezultaty');
    expect(anchor).toContain('rezultat=kr-1');
    for (const path of [
      OKR_REPORT_REGISTRY_PATH,
      okrReportPath('set-1'),
      okrObjectiveCardInReportPath('set-1', 'obj-1'),
      okrObjectiveCardPath('obj-1'),
    ]) {
      expect(path).not.toContain('/rezultaty');
    }
  });

  it('czwarty poziom nie istnieje jako plik (strony KR usunięte, nie tylko odlinkowane)', () => {
    // Samo odlinkowanie zostawiłoby martwe poddrzewo, które następny audyt
    // policzyłby jako „istniejący ekran" — pliki mają NIE ISTNIEĆ.
    for (const file of [
      'src/components/ResultsVNext/okr/OkrKeyResultSetPage.tsx',
      'src/components/ResultsVNext/okr/OkrKeyResultCardPage.tsx',
    ]) {
      expect(existsSync(resolve(process.cwd(), file))).toBe(false);
    }
  });

  it('trasy poziomów są zadeklarowane w routeConfig (nie tylko w komponentach)', () => {
    expect(ROUTES.RESULTS_OKR.ROOT).toBe('/results/okr');
    expect(ROUTES.RESULTS_OKR.REPORT).toBe('/results/okr/:setId');
    expect(ROUTES.RESULTS_OKR.REPORT_OBJECTIVE).toBe('/results/okr/:setId/objectives/:objectiveId');
    // Dawne poziomy zostają WYŁĄCZNIE jako adresy przekierowań.
    expect(ROUTES.RESULTS_OKR.OBJECTIVE_KEY_RESULTS).toBe(
      '/results/okr/:setId/objectives/:objectiveId/rezultaty'
    );
    expect(ROUTES.RESULTS_OKR.OBJECTIVE_KEY_RESULT).toBe(
      '/results/okr/:setId/objectives/:objectiveId/rezultaty/:keyResultId'
    );
  });

  it('stary adres rezultatu PRZEKIEROWUJE na kartę celu (a nie otwiera strony)', async () => {
    render(
      <MemoryRouter initialEntries={['/results/okr/set-1/objectives/obj-1/rezultaty/kr-1']}>
        <LocationProbe />
        <Routes>
          <Route path={ROUTES.RESULTS_OKR.OBJECTIVE_KEY_RESULT} element={<OkrKeyResultRedirect />} />
          <Route
            path={ROUTES.RESULTS_OKR.REPORT_OBJECTIVE}
            element={<div data-testid="karta-celu">karta celu</div>}
          />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByTestId('karta-celu')).toBeTruthy());
    expect(screen.getByTestId('location').textContent).toBe(
      '/results/okr/set-1/objectives/obj-1?sekcja=kluczowe-rezultaty&rezultat=kr-1'
    );
  });
});

describe('Poziom 2 — RAPORT OKR (tabela rezultatów grupowana temat → cel)', () => {
  it('grupuje po temacie, pokazuje rezultat z właścicielem i wchodzi w kartę celu', async () => {
    render(
      <MemoryRouter initialEntries={['/results/okr/set-1']}>
        <LocationProbe />
        <Routes>
          <Route path={ROUTES.RESULTS_OKR.REPORT} element={<OkrReportPage />} />
          <Route
            path={ROUTES.RESULTS_OKR.REPORT_OBJECTIVE}
            element={<div data-testid="karta-celu">karta celu</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    // Wiersz grupy niesie TEMAT (oś grupowania SSOT §3) …
    await waitFor(() => expect(screen.getAllByText('Efektywność operacyjna').length).toBeGreaterThan(0));
    // … a wiersz rezultatu niesie NAZWISKO właściciela, nie identyfikator.
    expect(screen.getAllByText('Anna Kowalczyk').length).toBeGreaterThan(0);
    expect(screen.queryByText('user-anna')).toBeNull();
    expect(screen.getAllByText(KEY_RESULT.title).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText(KEY_RESULT.title)[0]!);
    await waitFor(() => expect(screen.getByTestId('karta-celu')).toBeTruthy());
    expect(screen.getByTestId('location').textContent).toContain(
      '/results/okr/set-1/objectives/obj-1'
    );
  });

  it('ma akcję „Dodaj cel" i filtr właściciela (Menu 3 wg SSOT §3)', async () => {
    render(
      <MemoryRouter initialEntries={['/results/okr/set-1']}>
        <Routes>
          <Route path={ROUTES.RESULTS_OKR.REPORT} element={<OkrReportPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByTestId('okr-report-add-objective-cta')).toBeTruthy());
    expect(screen.getByTestId('okr-report-owner-filter')).toBeTruthy();
  });
});

describe('Poziom 3 — karta celu z rezultatami JAKO SEKCJĄ', () => {
  it('renderuje pięć sekcji (w tym „Check-iny") i przycisk check-inu na bloku rezultatu', async () => {
    // Wchodzimy adresem, którym wchodzi wiersz tabeli poziomu 2 — czyli z
    // kotwicą sekcji. `NModeShell` rysuje TREŚĆ tylko aktywnej sekcji, więc
    // test bez kotwicy sprawdzałby wyłącznie lewą nawigację.
    render(
      <MemoryRouter
        initialEntries={['/results/okr/set-1/objectives/obj-1?sekcja=kluczowe-rezultaty']}
      >
        <LocationProbe />
        <Routes>
          <Route path={ROUTES.RESULTS_OKR.REPORT_OBJECTIVE} element={<OkrObjectiveCardPage />} />
          <Route path={ROUTES.RESULTS_OKR.REPORT} element={<div data-testid="raport">raport</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('results-vnext-okr-objective-card-page')).toBeTruthy()
    );

    // Lewa nawigacja karty = kontrakt sekcji; SSOT §3 nazywa trzecią „Check-iny".
    for (const section of OKR_OBJECTIVE_CARD_SECTIONS) {
      expect(screen.getAllByText(section.label.pl).length).toBeGreaterThan(0);
    }
    expect(OKR_OBJECTIVE_CARD_SECTIONS.map((section) => section.id)).toEqual([
      'cel',
      'kluczowe-rezultaty',
      'check-iny',
      'powiazania',
      'refleksja',
    ]);

    // Tytuł nagłówka niesie tożsamość celu (a nie identyfikator).
    expect(screen.getAllByText(new RegExp(OBJECTIVE.title)).length).toBeGreaterThan(0);

    // Rezultat jest BLOKIEM z własnym check-inem — nie linkiem do osobnej strony.
    expect(screen.getByTestId(`okr-objective-card-checkin-${KEY_RESULT.keyResultId}`)).toBeTruthy();
    expect(screen.queryByTestId('okr-objective-card-open-key-result-set')).toBeNull();
    expect(
      screen.queryByTestId(`okr-objective-card-open-kr-${KEY_RESULT.keyResultId}`)
    ).toBeNull();
  });

  it('okruszek wraca do RAPORTU (poziom 2), nie do powłoki administracyjnej zestawu', async () => {
    render(
      <MemoryRouter initialEntries={['/results/okr/set-1/objectives/obj-1']}>
        <LocationProbe />
        <Routes>
          <Route path={ROUTES.RESULTS_OKR.REPORT_OBJECTIVE} element={<OkrObjectiveCardPage />} />
          <Route path={ROUTES.RESULTS_OKR.REPORT} element={<div data-testid="raport">raport</div>} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(screen.getByTestId('okr-objective-card-panel-open-report')).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId('okr-objective-card-panel-open-report'));
    await waitFor(() => expect(screen.getByTestId('raport')).toBeTruthy());
    expect(screen.getByTestId('location').textContent).toBe('/results/okr/set-1');
  });
});

describe('Regresja crashu kolumn Kluczowego Rezultatu', () => {
  it('każda komórka kolumn KR renderuje się bez wyjątku (crash `shortOkrId is not defined`)', () => {
    const columns = buildOkrKeyResultColumns(true, 'active', (userId) =>
      userId === 'user-anna' ? 'Anna Kowalczyk' : null
    );
    expect(columns.length).toBeGreaterThan(0);
    for (const column of columns) {
      const cell = column.render?.(KEY_RESULT as never, 0);
      const { unmount } = render(<div>{cell as React.ReactNode}</div>);
      unmount();
    }
  });

  it('komórki renderują się także gdy nazwiska NIE DA SIĘ rozwiązać (ta gałąź wybuchała)', () => {
    const columns = buildOkrKeyResultColumns(true, 'active', () => null);
    for (const column of columns) {
      const { unmount } = render(
        <div>{column.render?.(KEY_RESULT as never, 0) as React.ReactNode}</div>
      );
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
