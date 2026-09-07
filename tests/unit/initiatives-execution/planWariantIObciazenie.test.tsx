/**
 * [ODMROZENIE 05_INITIATIVES DEC-421] P15-K6 + P15-K7 — WYBÓR WARIANTU I ARKUSZ W PLANIE.
 *
 * POMIAR 07.09 (własne API 4163, kopia bazy `consultify_p15k67`):
 *  • wybór wariantu „Przesuń kolejność" tworzył wyłącznie `nextGovernedInput` —
 *    plan zostawał bez zmian, żadna propozycja nie powstawała;
 *  • sekcja „Obciążenie ról" karty planu pokazywała `constraintSnapshot`
 *    (zdanie z seedu) albo „Nieznane" — arkusz okres × rola żył wyłącznie
 *    w drugiej zakładce i nie było stąd do niego drogi;
 *  • tryby zależne od mocy dawały się wybrać także wtedy, gdy analizy nie było.
 *
 * Atrapą jest WYŁĄCZNIE warstwa `runtimeApi` i katalog osób — karty
 * (`CapacityAnalysisCard`, `PlanCard`) oraz obie powierzchnie są PRAWDZIWE,
 * bo mierzymy przewód, nie wygląd atrapy.
 *
 * MUTACJE (dowód RED — zakładane ręcznie i cofane, `evidence/p15-k67/mutacje.txt`):
 *  (a) `selectOption` bez `hints` w ładunku → test (a) pada;
 *  (b) `selectOption` bez gałęzi „plan opublikowany → UPDATE" → test (b) pada;
 *  (c) sekcja `capacity` karty planu ze stałym tekstem zamiast arkusza → test (c) pada;
 *  (e) `capacityModesBlockedReason` przekazywany jako `null` → test (e) pada.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

// Katalog PL czytany z pliku — test jest też strażnikiem istnienia kluczy
// (kształt 18: „klucz istnieje ≠ przetłumaczony").
const katalogPl = (await import('../../../public/locales/pl/translation.json')).default as Record<
  string,
  unknown
>;
const zKatalogu = (key: string) =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      katalogPl
    );
const tlumacz = (key: string, options?: string | Record<string, unknown>) => {
  const zasob = zKatalogu(key);
  const fallback =
    typeof zasob === 'string'
      ? zasob
      : typeof options === 'string'
        ? options
        : typeof (options as Record<string, unknown>)?.defaultValue === 'string'
          ? String((options as Record<string, unknown>).defaultValue)
          : key;
  if (!options || typeof options === 'string') return fallback;
  return fallback.replace(/\{\{(\w+)\}\}/g, (_match, name) =>
    (options as Record<string, unknown>)[name] !== undefined
      ? String((options as Record<string, unknown>)[name])
      : `{{${name}}}`
  );
};
vi.mock('@/i18n', () => ({
  default: {
    language: 'pl',
    t: (k: string, o?: unknown) => tlumacz(k, o as never),
    getFixedT: () => (k: string, o?: unknown) => tlumacz(k, o as never),
  },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'pl' }, t: tlumacz }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/hooks/useOrganizationMemberNames', () => ({
  useOrganizationMemberNames: () => () => 'Osoba',
  memberNameOrUnknown: () => 'Osoba',
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
  acceptResourceCommitment: vi.fn(),
  computeCapacityScenario: vi.fn(),
  createPlanAnalysisProposal: vi.fn(),
  decideResourceCommitment: vi.fn(),
  listCapacityOptions: vi.fn(),
  listCapacityRoles: vi.fn(),
  listCapacityScenarioRegister: vi.fn(),
  listPlanAnalysisProposals: vi.fn(),
  listPlannableInitiatives: vi.fn(),
  listPlanScenarioRegister: vi.fn(),
  proposeCapacityOptions: vi.fn(),
  readCapacityScenario: vi.fn(),
  readCapacityScenarioHistory: vi.fn(),
  readPlanScenario: vi.fn(),
  readPlanScenarioDiff: vi.fn(),
  readPlanScenarioHistory: vi.fn(),
  registerInitiativeForPlanning: vi.fn(),
  requestResourceCommitment: vi.fn(),
  reviewPlanAnalysisProposal: vi.fn(),
  selectCapacityOption: vi.fn(),
  writeCapacityScenario: vi.fn(),
  writeInitiativeDependencies: vi.fn(),
  writePlanScenario: vi.fn(),
}));

import { CapacityScenarioSurface } from '../../../src/components/Initiatives/CapacityScenarioSurface';
import { PlanScenarioSurface } from '../../../src/components/Initiatives/PlanScenarioSurface';
import { GeneratorPlanuModal } from '../../../src/components/Initiatives/Generator/GeneratorPlanuModal';
import {
  createPlanAnalysisProposal,
  listCapacityOptions,
  listCapacityRoles,
  listCapacityScenarioRegister,
  listPlanAnalysisProposals,
  listPlannableInitiatives,
  listPlanScenarioRegister,
  readCapacityScenario,
  readCapacityScenarioHistory,
  readPlanScenario,
  readPlanScenarioHistory,
  selectCapacityOption,
  writePlanScenario,
} from '../../../src/services/initiatives-execution/runtimeApi';

const PLAN_ID = 'plan-k67';
const CAPACITY_ID = 'analiza-k67';
const COMPARISON_ID = `advisor-${CAPACITY_ID}`;

const period = (index: number) => ({
  periodId: `Tydzień ${index}`,
  start: `2026-09-${String(7 + (index - 1) * 7).padStart(2, '0')}T00:00:00.000Z`,
  end: `2026-09-${String(14 + (index - 1) * 7).padStart(2, '0')}T00:00:00.000Z`,
});
const zakres = (knowledgeState: string, base: number | null) => ({
  knowledgeState,
  low: base,
  base,
  high: base,
  sourceRef: 'resource-plan',
  sourceVersion: 1,
  asOf: '2026-09-07T00:00:00.000Z',
  confidence: 'MEDIUM',
  ownerId: 'owner-1',
  reason: base === null ? 'Nieznane' : null,
});
const rolaLinia = (demand: number, supply: number) => [
  {
    roleId: 'controls-engineer',
    roleLabel: 'Controls Engineer',
    demand,
    supply,
    supplySource: 'RESOURCE_PLAN' as const,
    demandSource: 'PLAN' as const,
  },
];
const analiza = {
  scenarioId: CAPACITY_ID,
  name: 'Analiza K67',
  scenarioVersion: 1,
  status: 'PUBLISHED' as const,
  planScenarioId: PLAN_ID,
  planScenarioVersion: 1,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [
    { ...period(1), demand: zakres('KNOWN', 5.5), supply: zakres('KNOWN', 2.5), roles: rolaLinia(5.5, 2.5) },
    { ...period(2), demand: zakres('KNOWN', 0), supply: zakres('KNOWN', 2.5), roles: rolaLinia(0, 2.5) },
  ],
  constraints: [],
  proposedAssignments: [],
  createdBy: 'a',
  updatedBy: 'a',
  publishedBy: 'a',
  publishedAt: '2026-09-07T10:00:00.000Z',
};
const planOpublikowany = {
  scenarioId: PLAN_ID,
  name: 'Plan K67',
  scenarioVersion: 1,
  status: 'PUBLISHED' as const,
  portfolioScenarioId: 'portfolio-org-roboczy',
  portfolioScenarioVersion: 2,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [period(1), period(2)],
  windows: [
    {
      initiativeId: 'ini-1',
      initiativeVersion: 1,
      earliest: period(1).start,
      target: period(1).start,
      latest: period(1).end,
      confidence: 'MEDIUM' as const,
      rationale: 'Okno wyjściowe.',
      dependencySnapshot: [],
      constraintSnapshot: [],
    },
  ],
  assumptions: [],
  createdBy: 'a',
  updatedBy: 'a',
  publishedBy: 'a',
  publishedAt: '2026-09-07T09:00:00.000Z',
};
const porownanie = {
  version: 1,
  comparisonId: COMPARISON_ID,
  planRef: { scenarioId: PLAN_ID, version: 3 },
  capacityRef: { scenarioId: CAPACITY_ID, version: 2 },
  status: 'DRAFT' as const,
  selectedOptionId: null,
  nextGovernedInput: null,
  options: (['RESEQUENCE', 'SCOPE_SPLIT', 'ADD_CAPACITY'] as const).map((kind) => ({
    optionId: `${CAPACITY_ID}:${kind}`,
    kind,
    assumptions: [],
    affectedMemberships: [{ initiativeId: 'ini-1', membershipVersion: 1 }],
    affectedPeriods: ['Tydzień 1'],
    affectedResources: [{ resourceRef: 'controls-engineer', version: 1 }],
    impact: {
      date:
        kind === 'RESEQUENCE'
          ? {
              low: 1,
              base: 1,
              high: 1,
              unit: 'periods',
              knowledgeState: 'ESTIMATED' as const,
              confidence: 'MEDIUM' as const,
              sourceRefs: [{ ref: `capacity-scenario:${CAPACITY_ID}`, version: 1 }],
            }
          : {
              low: null,
              base: null,
              high: null,
              unit: 'periods',
              knowledgeState: 'UNKNOWN' as const,
              confidence: 'UNKNOWN' as const,
              sourceRefs: [],
            },
      scope: { low: null, base: null, high: null, unit: 'items', knowledgeState: 'UNKNOWN' as const, confidence: 'UNKNOWN' as const, sourceRefs: [] },
      cost: { low: null, base: null, high: null, unit: 'PLN', knowledgeState: 'UNKNOWN' as const, confidence: 'UNKNOWN' as const, sourceRefs: [] },
      risk: { low: null, base: null, high: null, unit: 'score', knowledgeState: 'UNKNOWN' as const, confidence: 'UNKNOWN' as const, sourceRefs: [] },
    },
    rationale: `Wariant ${kind}`,
  })),
};

// Rejestr analiz wraca pod kluczem `scenarios` (patrz `CapacityScenarioSurface.load`).
const rejestrAnaliz = {
  scenarios: [
    {
      id: CAPACITY_ID,
      name: 'Analiza K67',
      state: 'PUBLISHED',
      version: 2,
      periodCount: 2,
      roleCount: 1,
      gapCount: 1,
      planRef: { scenarioId: PLAN_ID, scenarioVersion: 1, name: 'Plan K67' },
      window: { start: period(1).start, end: period(2).end },
      unit: { windowUnit: 'WEEK', timezone: 'Europe/Warsaw' },
      updatedAt: '2026-09-07T10:00:00.000Z',
      knowledgeSummary: { known: 4, estimated: 0, unknown: 0, unconfirmed: 0 },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listCapacityScenarioRegister).mockResolvedValue(rejestrAnaliz as never);
  vi.mocked(readCapacityScenario).mockResolvedValue({ version: 2, scenario: analiza } as never);
  vi.mocked(readCapacityScenarioHistory).mockResolvedValue({ versions: [] } as never);
  vi.mocked(listCapacityOptions).mockResolvedValue({ items: [porownanie] } as never);
  vi.mocked(listCapacityRoles).mockResolvedValue({ roles: [] } as never);
  vi.mocked(listPlanScenarioRegister).mockResolvedValue({
    scenarios: [
      {
        id: PLAN_ID,
        name: 'Plan K67',
        state: 'PUBLISHED',
        version: 3,
        portfolioRef: {
          scenarioId: 'portfolio-org-roboczy',
          scenarioVersion: 2,
          name: 'Portfel roboczy',
        },
        conflicts: 0,
        author: 'Osoba',
        initiativeCount: 1,
        updatedAt: '2026-09-07T09:00:00.000Z',
        window: { earliest: period(1).start, latest: period(2).end },
        timeBasis: {
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: [period(1), period(2)],
          knowledgeState: 'KNOWN',
        },
      },
    ],
  } as never);
  vi.mocked(readPlanScenario).mockResolvedValue({ version: 3, scenario: planOpublikowany } as never);
  vi.mocked(readPlanScenarioHistory).mockResolvedValue({ versions: [] } as never);
  vi.mocked(listPlanAnalysisProposals).mockResolvedValue({ items: [] } as never);
  vi.mocked(listPlannableInitiatives).mockResolvedValue({ initiatives: [] } as never);
  vi.mocked(writePlanScenario).mockResolvedValue({
    aggregateVersion: 4,
    response: { ...planOpublikowany, scenarioVersion: 2, status: 'DRAFT' },
  } as never);
  vi.mocked(createPlanAnalysisProposal).mockResolvedValue({ response: {} } as never);
  vi.mocked(selectCapacityOption).mockResolvedValue({ response: {} } as never);
});

const otworzKarteAnalizy = async () => {
  render(<MemoryRouter><CapacityScenarioSurface activePreset="all" createRequestId={0} /></MemoryRouter>);
  await waitFor(() => expect(screen.getAllByText('Analiza K67').length).toBeGreaterThan(0));
  fireEvent.dblClick(screen.getAllByText('Analiza K67')[0]);
  await waitFor(() => expect(screen.getByText('Propozycje zmian')).toBeTruthy());
  fireEvent.click(screen.getByText('Propozycje zmian'));
  await waitFor(() => expect(screen.getAllByText('Zmień kolejność').length).toBeGreaterThan(0));
};

describe('P15-K6 — wybór wariantu tworzy nową wersję planu z propozycją', () => {
  it('(a) „Przesuń kolejność" wysyła propozycję z analizą i PODPOWIEDZIĄ przesunięcia', async () => {
    await otworzKarteAnalizy();
    const wariant = screen.getByLabelText('Opcja obciążenia: Zmień kolejność');
    fireEvent.click(wariant.querySelector('button') as HTMLButtonElement);

    await waitFor(() => expect(vi.mocked(createPlanAnalysisProposal)).toHaveBeenCalled());
    const [planId, , command] = vi.mocked(createPlanAnalysisProposal).mock.calls[0];
    expect(planId).toBe(PLAN_ID);
    expect(command).toMatchObject({
      useCapacity: true,
      capacityScenarioId: CAPACITY_ID,
      hints: [{ initiativeId: 'ini-1', shiftPeriods: 1 }],
    });
  });

  it('(b) plan OPUBLIKOWANY dostaje najpierw nowy SZKIC (UPDATE), a decyzja zapisuje wersję wynikową', async () => {
    await otworzKarteAnalizy();
    const wariant = screen.getByLabelText('Opcja obciążenia: Zmień kolejność');
    fireEvent.click(wariant.querySelector('button') as HTMLButtonElement);

    await waitFor(() => expect(vi.mocked(writePlanScenario)).toHaveBeenCalled());
    const [id, komenda] = vi.mocked(writePlanScenario).mock.calls[0];
    expect(id).toBe(PLAN_ID);
    expect((komenda as Record<string, unknown>).operation).toBe('UPDATE');
    expect((komenda as Record<string, unknown>).expectedVersion).toBe(3);

    await waitFor(() => expect(vi.mocked(selectCapacityOption)).toHaveBeenCalled());
    const wybor = vi.mocked(selectCapacityOption).mock.calls[0][1] as Record<string, unknown>;
    expect(wybor.resultingPlanRef).toMatchObject({ scenarioId: PLAN_ID, scenarioVersion: 2 });
    expect(String(wybor.decisionNote)).toContain('Przesuń kolejność');
  });

  it('„Podziel zakres" zapisuje samą decyzję — planu nie rusza', async () => {
    await otworzKarteAnalizy();
    const wariant = screen.getByLabelText('Opcja obciążenia: Podziel zakres');
    fireEvent.click(wariant.querySelector('button') as HTMLButtonElement);

    await waitFor(() => expect(vi.mocked(selectCapacityOption)).toHaveBeenCalled());
    expect(vi.mocked(writePlanScenario)).not.toHaveBeenCalled();
    expect(vi.mocked(createPlanAnalysisProposal)).not.toHaveBeenCalled();
    const wybor = vi.mocked(selectCapacityOption).mock.calls[0][1] as Record<string, unknown>;
    expect(String(wybor.decisionNote)).toContain('Podziel zakres');
    expect(wybor.resultingPlanRef).toBeNull();
  });
});

describe('P15-K7 — „Obciążenie ról" w karcie planu', () => {
  const otworzKartePlanu = async () => {
    render(
      <MemoryRouter>
        <PlanScenarioSurface
          activePreset="all"
          initiatives={[]}
          createRequestId={0}
          onOpenCapacityAnalysis={() => undefined}
        />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getAllByText('Plan K67').length).toBeGreaterThan(0));
    fireEvent.dblClick(screen.getAllByText('Plan K67')[0]);
    await waitFor(() => expect(screen.getByText('Obciążenie ról')).toBeTruthy());
    fireEvent.click(screen.getByText('Obciążenie ról'));
  };

  it('(c) sekcja pokazuje ARKUSZ z powiązanej opublikowanej analizy, nie stałe zdanie', async () => {
    await otworzKartePlanu();
    await waitFor(() =>
      expect(screen.getByLabelText('Obciążenie ról z analizy')).toBeTruthy()
    );
    const arkusz = screen.getByLabelText('Obciążenie ról z analizy');
    expect(arkusz.textContent).toContain('Controls Engineer');
    expect(arkusz.textContent).toContain('5,5');
    expect(arkusz.textContent).toContain('2,5');
    expect(screen.queryByText('Nieznane — brak opublikowanej analizy obciążenia.')).toBeNull();
    expect(screen.getByText('Otwórz analizę')).toBeTruthy();
  });

  it('bez opublikowanej analizy sekcja mówi „Nieznane" i daje drogę do jej utworzenia', async () => {
    vi.mocked(listCapacityScenarioRegister).mockResolvedValue({ scenarios: [] } as never);
    render(
      <MemoryRouter>
        <PlanScenarioSurface
          activePreset="all"
          initiatives={[]}
          createRequestId={0}
          onNewCapacityAnalysis={() => undefined}
        />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getAllByText('Plan K67').length).toBeGreaterThan(0));
    fireEvent.dblClick(screen.getAllByText('Plan K67')[0]);
    await waitFor(() => expect(screen.getByText('Obciążenie ról')).toBeTruthy());
    fireEvent.click(screen.getByText('Obciążenie ról'));

    await waitFor(() =>
      expect(screen.getByText('Nieznane — brak opublikowanej analizy obciążenia.')).toBeTruthy()
    );
    expect(screen.getByText('Nowa analiza z tego planu')).toBeTruthy();
  });
});

describe('P15-K7 — tryby zależne od mocy w generatorze', () => {
  const powod =
    'Tryb wg obciążenia ról wymaga opublikowanej analizy obciążenia dla tej wersji planu — utwórz ją w Obciążeniu.';

  it('(e) bez analizy tryby mocy są NIEAKTYWNE i mówią dlaczego — widać to przed kliknięciem', () => {
    render(
      <GeneratorPlanuModal
        open
        plannable={[]}
        onClose={() => undefined}
        onGenerate={() => undefined}
        onReview={() => undefined}
        capacityModesBlockedReason={powod}
      />
    );
    const wybor = screen.getByLabelText('Tryb analizy') as HTMLSelectElement;
    const opcje = [...wybor.options];
    expect(opcje.find((o) => o.value === 'CAPACITY')?.disabled).toBe(true);
    expect(opcje.find((o) => o.value === 'MIXED')?.disabled).toBe(true);
    expect(opcje.find((o) => o.value === 'DEPENDENCIES')?.disabled).toBe(false);
    expect(screen.getByText(powod)).toBeTruthy();
  });

  it('z powiązaną analizą tryby mocy są dostępne', () => {
    render(
      <GeneratorPlanuModal
        open
        plannable={[]}
        onClose={() => undefined}
        onGenerate={() => undefined}
        onReview={() => undefined}
        capacityModesBlockedReason={null}
      />
    );
    const wybor = screen.getByLabelText('Tryb analizy') as HTMLSelectElement;
    expect([...wybor.options].find((o) => o.value === 'CAPACITY')?.disabled).toBe(false);
    expect(screen.queryByText(powod)).toBeNull();
  });
});
