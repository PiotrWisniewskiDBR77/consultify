/**
 * P15-K3 (DEC-421) — WARSZTAT PLANU W KARCIE: zakres, okna, zależności, konflikt wersji.
 *
 * POMIAR 07.09 (evidence/p15-k3/przed): karta pokazywała „Zakres inicjatyw"
 * i „Kolejność i okna" WYŁĄCZNIE do odczytu, a edytor okien leżał jako martwy
 * kod pod wcześniejszym `return` w `PlanScenarioSurface.tsx:1688`. Uzasadnienie
 * solvera było po angielsku, a sekcja „Zależności i konflikty" znikała, gdy
 * konfliktów nie było.
 *
 * Atrapą jest TYLKO okno generatora i warstwa `runtimeApi` — karta `PlanCard`
 * i powierzchnia `PlanScenarioSurface` są PRAWDZIWE, bo mierzymy przewód.
 *
 * MUTACJE (dowód RED — zakładane ręcznie i cofane, evidence/p15-k3/mutacje.txt):
 *  (a) `addInitiativeToPlan` bez `persistScenario` → „Dodaj inicjatywę" nic nie zapisuje;
 *  (b) `persistScenario` z `expectedVersion: 0` zamiast `aggregateVersion` → brak CAS;
 *  (d) `formatPlanSolverReason` zwraca surowy napis → uzasadnienie zostaje po angielsku;
 *  (e) `cardErrorLabel` = `null` → 409 nie mówi nic na ekranie.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `AnimatePresence mode="wait"` w `NModeCanvas` nie kończy w jsdom animacji
// wyjścia, więc bez tej atrapy klik w sekcję NIE podmienia treści (zmierzone).
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag: string) =>
        ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
          React.createElement(tag, props, children),
    }
  ),
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => true,
}));
vi.mock('@/i18n', () => ({ default: { language: 'pl' } }));
// Atrapa `t` czyta PRAWDZIWY katalog `public/locales/pl/translation.json`, więc
// test jest jednocześnie strażnikiem istnienia polskich kluczy (kształt 18:
// „klucz istnieje ≠ przetłumaczony"). Brak klucza → `defaultValue`.
vi.mock('react-i18next', async () => {
  const katalog = (await import('../../../public/locales/pl/translation.json')).default as Record<
    string,
    unknown
  >;
  const zKatalogu = (key: string) =>
    key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
        katalog
      );
  return {
    useTranslation: () => ({
      i18n: { language: 'pl' },
      t: (key: string, options?: string | Record<string, unknown>) => {
        const zasob = zKatalogu(key);
        const fallback =
          typeof zasob === 'string'
            ? zasob
            : typeof options === 'string'
              ? options
              : typeof options?.defaultValue === 'string'
                ? options.defaultValue
                : key;
        if (!options || typeof options === 'string') return fallback;
        return fallback.replace(/\{\{(\w+)\}\}/g, (_match, name) =>
          options[name] !== undefined ? String(options[name]) : `{{${name}}}`
        );
      },
    }),
    initReactI18next: { type: '3rdParty', init: () => undefined },
    Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('../../../src/components/Initiatives/Generator/GeneratorPlanuModal', () => ({
  GeneratorPlanuModal: () => null,
}));

vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class RuntimeApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      readonly rule?: string
    ) {
      super(code);
    }
  },
  createPlanAnalysisProposal: vi.fn(),
  listPlannableInitiatives: vi.fn(),
  listPlanScenarioRegister: vi.fn(),
  readPlanScenario: vi.fn(),
  readPlanScenarioDiff: vi.fn(),
  readPlanScenarioHistory: vi.fn(),
  registerInitiativeForPlanning: vi.fn(),
  reviewPlanAnalysisProposal: vi.fn(),
  writeInitiativeDependencies: vi.fn(),
  writePlanScenario: vi.fn(),
}));

import { PlanScenarioSurface } from '../../../src/components/Initiatives/PlanScenarioSurface';
import {
  listPlannableInitiatives,
  listPlanScenarioRegister,
  readPlanScenario,
  readPlanScenarioDiff,
  readPlanScenarioHistory,
  registerInitiativeForPlanning,
  RuntimeApiError,
  writeInitiativeDependencies,
  writePlanScenario,
} from '../../../src/services/initiatives-execution/runtimeApi';

const plannable = [
  {
    id: 'ini-1',
    name: 'Predictive Maintenance',
    status: 'APPROVED' as const,
    conditional: false,
    projectId: null,
    plannedStartDate: null,
    plannedEndDate: null,
    requiredCapacityFte: null,
  },
  {
    id: 'ini-2',
    name: 'OPC-UA Migration',
    status: 'APPROVED' as const,
    conditional: false,
    projectId: null,
    plannedStartDate: null,
    plannedEndDate: null,
    requiredCapacityFte: null,
  },
  {
    id: 'ini-3',
    name: 'Digital Twin',
    status: 'APPROVED' as const,
    conditional: false,
    projectId: null,
    plannedStartDate: null,
    plannedEndDate: null,
    requiredCapacityFte: null,
  },
];

const period = (index: number) => ({
  periodId: `Tydzień ${index}`,
  start: `2026-09-${String(6 + (index - 1) * 7).padStart(2, '0')}T00:00:00.000Z`,
  end: `2026-09-${String(13 + (index - 1) * 7).padStart(2, '0')}T00:00:00.000Z`,
});

const window = (id: string, dependencySnapshot: string[] = []) => ({
  initiativeId: id,
  initiativeVersion: 1,
  earliest: '2026-09-06T00:00:00.000Z',
  target: '2026-09-06T00:00:00.000Z',
  latest: '2026-09-20T00:00:00.000Z',
  confidence: 'UNKNOWN' as const,
  // Kod solvera — front ma go pokazać PO POLSKU.
  rationale:
    'SOLVER-1:SELECTED;period=Tydzie%C5%84%202;dep=NO_PREDECESSOR;cap=NO_CAPACITY_SCENARIO',
  dependencySnapshot,
  constraintSnapshot: [],
});

const plan = {
  scenarioId: 'plan-k3',
  name: 'Plan K3',
  scenarioVersion: 1,
  status: 'DRAFT' as const,
  portfolioScenarioId: 'portfolio-org-roboczy',
  portfolioScenarioVersion: 2,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [period(1), period(2), period(3)],
  windows: [window('ini-1'), window('ini-2')],
  assumptions: [],
  createdBy: 'planner',
  updatedBy: 'planner',
  publishedBy: null,
  publishedAt: null,
};

const AGGREGATE_VERSION = 7;

const openPlanCard = async (scenario: typeof plan = plan) => {
  render(
    <MemoryRouter>
      <PlanScenarioSurface activePreset="all" initiatives={[]} createRequestId={0} />
    </MemoryRouter>
  );
  await waitFor(() => expect(vi.mocked(listPlannableInitiatives)).toHaveBeenCalled());
  await waitFor(() => expect(screen.getAllByText(scenario.name).length).toBeGreaterThan(0));
  fireEvent.dblClick(screen.getAllByText(scenario.name)[0]);
  await screen.findByRole('button', { name: 'Zakres inicjatyw' });
};

const openSection = (label: string) =>
  fireEvent.click(screen.getByRole('button', { name: label }));

const lastWrite = () =>
  vi.mocked(writePlanScenario).mock.calls.at(-1)?.[1] as {
    operation: string;
    expectedVersion: number;
    scenario: { windows: Array<{ initiativeId: string; target: string | null; dependencySnapshot: string[] }> };
  };

const mountMocks = (scenario: typeof plan) => {
  vi.mocked(listPlannableInitiatives).mockReset().mockResolvedValue({ initiatives: plannable });
  vi.mocked(listPlanScenarioRegister)
    .mockReset()
    .mockResolvedValue({
      scenarios: [
        {
          id: scenario.scenarioId,
          name: scenario.name,
          state: scenario.status,
          version: scenario.scenarioVersion,
          portfolioRef: {
            scenarioId: scenario.portfolioScenarioId,
            scenarioVersion: 2,
            name: 'Portfel roboczy — zatwierdzone inicjatywy, stan z 2026-09-07',
          },
          window: { earliest: null, latest: null },
          updatedAt: '2026-09-07T17:45:00.000Z',
          timeBasis: {
            windowUnit: 'WEEK',
            timezone: 'Europe/Warsaw',
            periods: scenario.periods,
            knowledgeState: 'KNOWN',
          },
          initiativeCount: scenario.windows.length,
          conflicts: 0,
          author: 'Audyt Nocny',
        },
      ],
    });
  vi.mocked(readPlanScenario)
    .mockReset()
    .mockResolvedValue({ version: AGGREGATE_VERSION, scenario });
  vi.mocked(readPlanScenarioHistory).mockReset().mockResolvedValue({ versions: [scenario] });
  vi.mocked(readPlanScenarioDiff).mockReset().mockResolvedValue({ changes: [] });
  vi.mocked(registerInitiativeForPlanning)
    .mockReset()
    .mockImplementation(async (initiativeId: string) => ({
      status: 'APPLIED',
      aggregateVersion: 4,
      response: { initiativeId },
    }));
  vi.mocked(writeInitiativeDependencies)
    .mockReset()
    .mockImplementation(async (initiativeId: string, command: { dependsOn: string[] }) => ({
      initiativeId,
      dependsOn: command.dependsOn,
    }));
  vi.mocked(writePlanScenario)
    .mockReset()
    .mockImplementation(async (_id: string, command: Record<string, unknown>) => ({
      aggregateVersion: AGGREGATE_VERSION + 1,
      response: { ...scenario, ...(command.scenario as Record<string, unknown>), scenarioVersion: 2 },
    }));
};

describe('P15-K3 — warsztat planu w karcie', () => {
  beforeEach(() => mountMocks(plan));

  it('(a) „Dodaj inicjatywę" przyjmuje inicjatywę do planowania i ZAPISUJE nowe okno', async () => {
    await openPlanCard();
    openSection('Zakres inicjatyw');

    fireEvent.change(screen.getByLabelText('Inicjatywa do dodania do planu'), {
      target: { value: 'ini-3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj inicjatywę' }));

    await waitFor(() => expect(vi.mocked(registerInitiativeForPlanning)).toHaveBeenCalledWith(
      'ini-3',
      expect.objectContaining({ allowConditional: false })
    ));
    await waitFor(() => expect(vi.mocked(writePlanScenario)).toHaveBeenCalled());
    const update = lastWrite();
    expect(update.operation).toBe('UPDATE');
    expect(update.scenario.windows.map((w) => w.initiativeId)).toEqual([
      'ini-1',
      'ini-2',
      'ini-3',
    ]);
  });

  it('„Usuń z planu" zapisuje plan bez tego okna i bez zależności do niego', async () => {
    mountMocks({ ...plan, windows: [window('ini-1'), window('ini-2', ['ini-1'])] });
    await openPlanCard();
    openSection('Zakres inicjatyw');

    fireEvent.click(
      screen.getByRole('button', { name: 'Usuń „Predictive Maintenance" z planu' })
    );

    await waitFor(() => expect(vi.mocked(writePlanScenario)).toHaveBeenCalled());
    const update = lastWrite();
    expect(update.scenario.windows.map((w) => w.initiativeId)).toEqual(['ini-2']);
    expect(update.scenario.windows[0].dependencySnapshot).toEqual([]);
  });

  it('(b) zmiana daty docelowej wysyła PEŁNY zestaw okien z `expectedVersion` (CAS)', async () => {
    await openPlanCard();
    openSection('Kolejność i okna');

    fireEvent.change(screen.getByLabelText('Data docelowa — OPC-UA Migration'), {
      target: { value: '2026-09-15' },
    });

    await waitFor(() => expect(vi.mocked(writePlanScenario)).toHaveBeenCalled());
    const update = lastWrite();
    expect(update.expectedVersion).toBe(AGGREGATE_VERSION);
    expect(update.scenario.windows).toHaveLength(2);
    expect(update.scenario.windows[1].target).toBe('2026-09-15T00:00:00.000Z');
    expect(update.scenario.windows[0].target).toBe('2026-09-06T00:00:00.000Z');
  });

  it('data poza horyzontem NIE idzie do zapisu i mówi po polsku, co jest nie tak', async () => {
    await openPlanCard();
    openSection('Kolejność i okna');

    fireEvent.change(screen.getByLabelText('Najpóźniej — OPC-UA Migration'), {
      target: { value: '2027-01-01' },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Data musi mieścić się w horyzoncie planu'
    );
    expect(vi.mocked(writePlanScenario)).not.toHaveBeenCalled();
  });

  it('data łamiąca kolejność (docelowa przed najwcześniejszą) też nie idzie do zapisu', async () => {
    await openPlanCard();
    openSection('Kolejność i okna');

    fireEvent.change(screen.getByLabelText('Najwcześniej — OPC-UA Migration'), {
      target: { value: '2026-09-13' },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Zachowaj kolejność: najwcześniej ≤ data docelowa ≤ najpóźniej.'
    );
    expect(vi.mocked(writePlanScenario)).not.toHaveBeenCalled();
  });

  it('zaznaczenie „Po inicjatywie" zapisuje zależność I wkłada ją do snapshotu okna', async () => {
    await openPlanCard();
    openSection('Kolejność i okna');

    fireEvent.click(
      screen.getByLabelText('„OPC-UA Migration" po „Predictive Maintenance"')
    );

    await waitFor(() => expect(vi.mocked(writeInitiativeDependencies)).toHaveBeenCalledWith(
      'ini-2',
      expect.objectContaining({ dependsOn: ['ini-1'] })
    ));
    await waitFor(() => expect(vi.mocked(writePlanScenario)).toHaveBeenCalled());
    expect(lastWrite().scenario.windows[1].dependencySnapshot).toEqual(['ini-1']);
  });

  it('(d) uzasadnienie solvera renderuje się PO POLSKU, nie jako kod ani angielskie zdanie', async () => {
    await openPlanCard();
    openSection('Kolejność i okna');

    expect(document.body.textContent).toContain(
      'Solver wybrał Tydzień 2: brak zaplanowanego poprzednika'
    );
    expect(document.body.textContent).not.toContain('SOLVER-1:');
    expect(document.body.textContent).not.toContain('Deterministic solver selected');
  });

  it('sekcja „Zależności i konflikty" jest widoczna także wtedy, gdy konfliktów nie ma', async () => {
    await openPlanCard();
    openSection('Zależności i konflikty');
    expect(document.body.textContent).toContain('Brak konfliktów.');
  });

  it('(e) konflikt wersji (409) mówi po polsku, co zrobić', async () => {
    vi.mocked(writePlanScenario)
      .mockReset()
      .mockRejectedValue(new RuntimeApiError(409, 'CONFLICT', 'PLAN_VERSION_MISMATCH'));
    await openPlanCard();
    openSection('Kolejność i okna');

    fireEvent.change(screen.getByLabelText('Data docelowa — OPC-UA Migration'), {
      target: { value: '2026-09-15' },
    });

    openSection('Decyzje');
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent ?? '').toContain(
        'Plan źródłowy jest w innej wersji niż ta, na której pracujesz.'
      )
    );
  });

  it('plan OPUBLIKOWANY jest tylko do odczytu i mówi, jak go zmienić', async () => {
    mountMocks({ ...plan, status: 'PUBLISHED' as never, publishedAt: '2026-09-07T10:00:00.000Z' });
    await openPlanCard();
    openSection('Zakres inicjatyw');

    expect(document.body.textContent).toContain(
      'Plan opublikowany — utwórz nową wersję (szkic), aby zmienić.'
    );
    expect(screen.queryByRole('button', { name: 'Dodaj inicjatywę' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Utwórz nową wersję (szkic)' }));
    await waitFor(() => expect(vi.mocked(writePlanScenario)).toHaveBeenCalled());
    expect(lastWrite().operation).toBe('UPDATE');
  });
});
