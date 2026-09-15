/**
 * @vitest-environment jsdom
 *
 * F12 (2026-09-15) — STRAŻNIK: BANK REALIZACJI MIEŚCI SIĘ W OBSZARZE TABELI.
 *
 * ODBIÓR 15.09 (Northwind, staging, konto Irina, 1440×900) zgłosił „nagłówek
 * VARIAN ucięty". POMIAR OBALIŁ PREMISĘ „za wąska kolumna": żaden nagłówek nie
 * jest przycięty wewnątrz swojej komórki (`scrollWidth === clientWidth` dla
 * każdego z trzynastu), natomiast element tabeli ma 1818 px przy obszarze
 * 1280 px (`fala-f12-20260915/pomiar/overflow-1440.json`). „Variance" jest po
 * prostu ostatnim napisem, który prawa krawędź przecina w połowie.
 *
 * Zmierzone szerokości na żywo — 300 · 160 · 145 · 150 · 96 · 133 · 139 · 110 ·
 * 160 · 95 · 140 · 110 (+80 kolumna akcji) — to DOKŁADNIE podłogi
 * `getColumnFitFloor`, czyli kanon zjechał już tak nisko, jak wolno. Obniżanie
 * tych podłóg zostało zmierzone i odrzucone przy K5-7 (nagłówki łamią się co
 * cztery litery). Jedynym lewarem jest LICZBA kolumn domyślnie widocznych — i
 * tak też przewidział to autor K5 („które kolumny są zbędne, to decyzja
 * właściciela — pstryczek kolumn").
 *
 * CO PILNUJE TEN TEST — nie wygląd, tylko BUDŻET: suma ZMIERZONYCH NA ŻYWO
 * podłóg kolumn domyślnie widocznych, plus kolumna akcji, mieści się w
 * obszarze tabeli przy oknie 1440 px.
 *
 * DLACZEGO PODŁOGI Z TABLICY, A NIE Z `th.style.width`. W jsdom nie ma metryki
 * czcionki, więc zmierzony nagłówek wychodzi szerszy niż w przeglądarce
 * (np. „BASELINE FINISH": 141 px w jsdom wobec 133 px na stagingu) i suma
 * urosłaby do 1387 px — liczby, której na ekranie nie ma. Tablica niżej
 * pochodzi z POMIARU na `bank-przed-1440-geo.json`; kolumna, której w niej
 * nie ma, wywraca test celowo, żeby autor nowej kolumny ją zmierzył.
 *
 * SKĄD 1280 px. Obszar tabeli to okno minus 160 px (szyna nawigacji +
 * marginesy powłoki), zmierzone: `DIV.w-full overflow-x-auto`.clientWidth =
 * 1280 przy oknie 1440.
 *
 * ZASTRZEŻENIE ZMIERZONE, NIE PRZEMILCZANE: przy oknie 1280 px obszar ma
 * ≈1120 px, a osiem kolumn domyślnych kosztuje 1213 px — tam Bank NADAL
 * przewija się poziomo. Zejście poniżej wymagałoby zdjęcia kolumny „Owner"
 * albo „Execution phase" i to jest decyzja właściciela, nie tej poprawki.
 * Akcept B-E1 jest robiony przy 1440 px.
 *
 * DOWÓD MUTACYJNY (sprawdzone):
 *   · skasowanie `defaultVisible: false` z `updatedAt` → 1323 px, test pada,
 *   · to samo z `health` → 1373 px, test pada,
 *   · usunięcie `varianceDays` z kolumn → pada asercja obecności.
 */
import { render } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ROW_ACTIONS_COLUMN_WIDTH } from '../../shared/ModuleHub/FilterableTable';
import type {
  ExecutionBankEvidence,
  ExecutionBankEvidenceMeta,
  ExecutionBankRow,
  ExecutionBankUnknownReason,
} from '../executionBankModel';
import { ExecutionBankViews } from '../ExecutionBankViews';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

/** Obszar tabeli przy oknie 1440 px — ZMIERZONY, patrz nota u góry pliku. */
export const BANK_TABLE_AREA_AT_1440 = 1280;

/**
 * Podłogi dopasowania ZMIERZONE w przeglądarce na stagingu 15.09
 * (`pomiar/bank-przed-1440-geo.json`). `initiativeCase` ma 200 px, a nie 300 —
 * na zrzucie dostała 300 px, bo jako kolumna główna zbiera nadmiar budżetu;
 * przy oknie 1920 px zmierzono jej 242 px, co potwierdza, że 300 to nie podłoga.
 */
const ZMIERZONE_PODLOGI: Record<string, number> = {
  initiativeCase: 200,
  lifecycleStatus: 160,
  executionState: 145,
  ownerName: 150,
  progress: 96,
  baselineFinish: 133,
  forecastFinish: 139,
  varianceDays: 110,
  health: 160,
  blockerCount: 95,
  nextAction: 140,
  updatedAt: 110,
  deliveryProfile: 155,
  pendingDecisionCount: 160,
  resourceConstraint: 160,
  handoff: 150,
  risk: 150,
};

const META: ExecutionBankEvidenceMeta = {
  asOf: '2026-09-15',
  source: 'test',
  completeness: 'KNOWN',
  staleness: 'CURRENT',
  formula: { id: 'test', version: 1 },
  inputs: {},
  window: null,
};

const known = <T,>(value: T): ExecutionBankEvidence<T> => ({ status: 'KNOWN', value, meta: META });
const gap = <T,>(reason: ExecutionBankUnknownReason): ExecutionBankEvidence<T> => ({
  status: 'UNKNOWN',
  value: null,
  reason,
  meta: META,
});

const row = (id: string, name: string): ExecutionBankRow =>
  ({
    id,
    initiativeId: `init-${id}`,
    executionCaseId: `case-${id}`,
    executionCaseVersion: 1,
    name,
    description: null,
    lifecycleStatus: 'IN_EXECUTION',
    projectId: null,
    priority: null,
    executionState: 'ACTIVE',
    executionPhase: null,
    ownerId: null,
    ownerName: 'Priya Sharma',
    deliveryProfile: null,
    progress: known(30),
    confidence: gap('CONFIDENCE_MISSING'),
    baselineStart: known('2026-02-02'),
    baselineFinish: known('2026-12-18'),
    currentPlanStart: known('2026-02-02'),
    currentPlanFinish: known('2026-12-18'),
    forecastStart: known('2026-02-02'),
    forecastFinish: known('2026-12-04'),
    actualStart: gap('ACTUAL_MISSING'),
    actualFinish: gap('ACTUAL_MISSING'),
    varianceDays: known(-14) as ExecutionBankRow['varianceDays'],
    health: gap('HEALTH_MISSING'),
    blockerCount: null,
    pendingDecisionCount: null,
    resourceConstraint: null,
    nextAction: null,
    updatedAt: known('2026-09-08'),
    displayFinish: known('2026-12-04') as ExecutionBankRow['displayFinish'],
  }) as ExecutionBankRow;

const ROWS: ExecutionBankRow[] = [
  row('r1', 'Skills Matrix and Upskilling'),
  row('r2', 'Predictive Maintenance for CNC Line'),
  row('r3', 'MES Rollout Line 3'),
  row('r4', 'Warehouse Automation Pilot'),
];

const renderBank = () =>
  render(
    <ExecutionBankViews
      rows={ROWS}
      view="table"
      selected={null}
      calendarWindow={{ asOf: '2026-09-15', months: 6, buckets: [] } as never}
      onSelect={() => {}}
      onOpen={() => {}}
      onHorizonChange={() => {}}
      onDrilldownMonth={() => {}}
    />
  );

const widoczneKolumny = (container: HTMLElement): string[] =>
  [...container.querySelectorAll<HTMLTableCellElement>('thead th[data-column-id]')].map(
    (th) => th.dataset.columnId as string
  );

describe('F12 — Bank Realizacji mieści się w obszarze tabeli', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('kolumny domyślnie widoczne + kolumna akcji mieszczą się przy 1440 px', () => {
    const { container } = renderBank();
    const ids = widoczneKolumny(container);
    expect(ids.length).toBeGreaterThan(0);

    const niezmierzone = ids.filter((id) => ZMIERZONE_PODLOGI[id] == null);
    expect(
      niezmierzone,
      `kolumna bez ZMIERZONEJ podłogi — zmierz ją na żywo i dopisz do tablicy`
    ).toEqual([]);

    const budzet =
      ids.reduce((sum, id) => sum + ZMIERZONE_PODLOGI[id], 0) + ROW_ACTIONS_COLUMN_WIDTH;

    expect(budzet).toBeLessThanOrEqual(BANK_TABLE_AREA_AT_1440);
  });

  it('kolumny, po które właściciel przyszedł, ZOSTAJĄ widoczne domyślnie', () => {
    const ids = widoczneKolumny(renderBank().container);

    // To jest treść akceptu B-E1: postęp, baseline, prognoza i odchylenie.
    expect(ids).toEqual(
      expect.arrayContaining([
        'initiativeCase',
        'progress',
        'baselineFinish',
        'forecastFinish',
        'varianceDays',
      ])
    );
  });

  it('kolumny bez źródła danych schodzą do pstryczka, a nie znikają z tabeli', () => {
    const ids = widoczneKolumny(renderBank().container);

    // `health` / `blockerCount` / `nextAction` — serwer nie oddaje tych pól
    // w `GET /api/initiatives/runtime-v1/execution-cases` (pomiar 15.09),
    // więc na ekranie były wyłącznie myślnikami.
    expect(ids).not.toContain('health');
    expect(ids).not.toContain('blockerCount');
    expect(ids).not.toContain('nextAction');
  });
});
