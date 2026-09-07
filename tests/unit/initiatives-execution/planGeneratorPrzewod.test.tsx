/**
 * P15-K2 (DEC-421) — PRZEWÓD: generator → karta → powierzchnia → serwer.
 *
 * POMIAR 07.09: `PlanCard.tsx:38` miał `onGenerate={(input) => onAnalyze(input.mode)}`,
 * więc wybór inicjatyw i horyzont z modala nigdy nie docierały do `UPDATE`; po
 * „Zatwierdź" zmiany żyły wyłącznie w stanie Reacta, a znacznik zapisu był stałą.
 *
 * Atrapą jest TYLKO okno generatora (jego własne testy są w `planGeneratorMost`),
 * żeby ten plik mierzył przewód, a nie klikanie w modalu. Karta `PlanCard`
 * i powierzchnia `PlanScenarioSurface` są PRAWDZIWE.
 *
 * MUTACJE (dowód RED — wykonane ręcznie i cofnięte, evidence/p15-k2/mutacje.txt):
 *  (c)  `PlanCard.tsx` → `onGenerate={(input) => onAnalyze(input.mode)}`:
 *       `registerInitiativeForPlanning` nie jest wołane wcale → test pada;
 *  (c2) `PlanScenarioSurface.generatePlan` → `scenario: draft` bez `periods`/`windows`:
 *       zapisane okresy/okna zostają puste → test pada;
 *  (e)  `PlanScenarioSurface.markSaved` → stały napis zamiast `updatedAt` z rejestru:
 *       test „Zapisano 19:45" pada.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n', () => ({ default: { language: 'pl' } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'pl' },
    t: (key: string, options?: string | Record<string, unknown>) => {
      const fallback =
        typeof options === 'string'
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
}));

vi.mock('../../../src/components/Initiatives/Generator/GeneratorPlanuModal', () => ({
  GeneratorPlanuModal: ({
    onGenerate,
    onReview,
    savedLabel,
    proposal,
  }: {
    onGenerate: (input: unknown) => void;
    onReview: (outcome: 'ACCEPT' | 'REJECT') => void;
    savedLabel?: string | null;
    proposal?: unknown[] | null;
  }) => (
    <div>
      <button
        type="button"
        data-testid="atrapa-generuj"
        onClick={() =>
          onGenerate({
            initiativeIds: ['ini-1', 'ini-3'],
            allowConditional: true,
            start: '2026-09-07',
            periods: 12,
            unit: 'WEEK',
            mode: 'DEPENDENCIES',
          })
        }
      >
        generuj
      </button>
      <button type="button" data-testid="atrapa-zatwierdz" onClick={() => onReview('ACCEPT')}>
        zatwierdz
      </button>
      <span data-testid="atrapa-zapis">{savedLabel ?? ''}</span>
      <span data-testid="atrapa-propozycja">{proposal ? String(proposal.length) : 'brak'}</span>
    </div>
  ),
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
  // P15-K3: karta woła też zapis zależności — atrapa musi wystawić ten eksport,
  // inaczej import modułu przewraca cały plik testowy.
  writeInitiativeDependencies: vi.fn(),
  writePlanScenario: vi.fn(),
}));

import { PlanScenarioSurface } from '../../../src/components/Initiatives/PlanScenarioSurface';
import {
  createPlanAnalysisProposal,
  listPlannableInitiatives,
  listPlanScenarioRegister,
  readPlanScenario,
  readPlanScenarioDiff,
  readPlanScenarioHistory,
  registerInitiativeForPlanning,
  reviewPlanAnalysisProposal,
  writePlanScenario,
} from '../../../src/services/initiatives-execution/runtimeApi';

const plannable = [
  {
    id: 'ini-1',
    name: 'Predictive Maintenance',
    status: 'APPROVED' as const,
    conditional: false,
    projectId: null,
    plannedStartDate: '2026-09-21T00:00:00.000Z',
    plannedEndDate: null,
    requiredCapacityFte: null,
  },
  {
    id: 'ini-3',
    name: 'Digital Twin',
    status: 'PENDING_APPROVAL' as const,
    conditional: true,
    projectId: null,
    plannedStartDate: null,
    plannedEndDate: null,
    requiredCapacityFte: null,
  },
];

const plan = {
  scenarioId: 'plan-k2',
  name: 'Plan K2',
  scenarioVersion: 1,
  status: 'DRAFT' as const,
  portfolioScenarioId: 'portfolio-org-roboczy',
  portfolioScenarioVersion: 2,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [
    { periodId: 'Tydzień 1', start: '2026-09-07T00:00:00.000Z', end: '2026-09-14T00:00:00.000Z' },
  ],
  windows: [],
  assumptions: [],
  createdBy: 'planner',
  updatedBy: 'planner',
  publishedBy: null,
  publishedAt: null,
};

const openPlanCard = async () => {
  render(
    <MemoryRouter>
      <PlanScenarioSurface activePreset="all" initiatives={[]} createRequestId={0} />
    </MemoryRouter>
  );
  await waitFor(() => expect(vi.mocked(listPlannableInitiatives)).toHaveBeenCalled());
  // Kolumna "Portfel / wersja" pokazuje NAZWE portfela roboczego, nie surowy id.
  await waitFor(() =>
    expect(document.body.textContent).toContain('Portfel roboczy — zatwierdzone inicjatywy')
  );
  // Nazwa planu wystepuje w wierszu tabeli i w podgladzie — bierzemy wiersz.
  fireEvent.dblClick(screen.getAllByText('Plan K2')[0]);
  return screen.findByTestId('atrapa-generuj');
};

describe('P15-K2 — przewód generatora do serwera', () => {
  beforeEach(() => {
    vi.mocked(listPlannableInitiatives).mockReset().mockResolvedValue({ initiatives: plannable });
    vi.mocked(listPlanScenarioRegister)
      .mockReset()
      .mockResolvedValue({
        scenarios: [
          {
            id: plan.scenarioId,
            name: plan.name,
            state: 'DRAFT',
            version: 1,
            portfolioRef: {
              scenarioId: plan.portfolioScenarioId,
              scenarioVersion: 2,
              name: 'Portfel roboczy — zatwierdzone inicjatywy, stan z 2026-09-07',
            },
            window: { earliest: null, latest: null },
            updatedAt: '2026-09-07T17:45:00.000Z',
            timeBasis: {
              windowUnit: 'WEEK',
              timezone: 'Europe/Warsaw',
              periods: plan.periods,
              knowledgeState: 'KNOWN',
            },
            initiativeCount: 0,
            conflicts: 0,
            author: 'Audyt Nocny',
          },
        ],
      });
    vi.mocked(readPlanScenario).mockReset().mockResolvedValue({ version: 1, scenario: plan });
    vi.mocked(readPlanScenarioHistory).mockReset().mockResolvedValue({ versions: [plan] });
    vi.mocked(readPlanScenarioDiff).mockReset().mockResolvedValue({ changes: [] });
    vi.mocked(registerInitiativeForPlanning)
      .mockReset()
      .mockImplementation(async (initiativeId: string) => ({
        status: 'APPLIED',
        aggregateVersion: 1,
        response: { initiativeId },
      }));
    vi.mocked(writePlanScenario)
      .mockReset()
      .mockImplementation(async (_id: string, command: Record<string, unknown>) => ({
        aggregateVersion: 2,
        response: {
          ...plan,
          ...(command.scenario as Record<string, unknown>),
          scenarioVersion: 2,
        },
      }));
    vi.mocked(createPlanAnalysisProposal)
      .mockReset()
      .mockResolvedValue({
        response: {
          proposalId: 'prop-1',
          inputAggregateVersion: 2,
          inputScenarioVersion: 2,
          status: 'PENDING_REVIEW',
          assumptions: [],
          rationale: 'Propozycja',
          conflicts: [],
          changes: [],
        },
      });
    vi.mocked(reviewPlanAnalysisProposal).mockReset().mockResolvedValue({});
  });

  it('„Generuj" przyjmuje wybrane inicjatywy modułu do planowania i zapisuje okna z parametrów', async () => {
    fireEvent.click(await openPlanCard());

    await waitFor(() =>
      expect(vi.mocked(registerInitiativeForPlanning)).toHaveBeenCalledTimes(2)
    );
    expect(vi.mocked(registerInitiativeForPlanning).mock.calls.map((call) => call[0])).toEqual([
      'ini-1',
      'ini-3',
    ]);
    expect(vi.mocked(registerInitiativeForPlanning).mock.calls[1][1].allowConditional).toBe(true);

    await waitFor(() => expect(vi.mocked(writePlanScenario)).toHaveBeenCalled());
    const update = vi.mocked(writePlanScenario).mock.calls.at(-1)?.[1] as {
      operation: string;
      portfolio?: string;
      scenario: {
        periods: unknown[];
        windows: Array<{ initiativeId: string; target: string | null }>;
      };
    };
    expect(update.operation).toBe('UPDATE');
    expect(update.portfolio).toBe('auto');
    expect(update.scenario.periods).toHaveLength(12);
    expect(update.scenario.windows.map((window) => window.initiativeId)).toEqual([
      'ini-1',
      'ini-3',
    ]);
    // Data docelowa bierze planowany start z modułu, gdy mieści się w horyzoncie.
    expect(update.scenario.windows[0].target).toBe('2026-09-21T00:00:00.000Z');
    await waitFor(() => expect(vi.mocked(createPlanAnalysisProposal)).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId('atrapa-zapis').textContent).toBe('Zapisano 19:45')
    );
  });

  it('„Zatwierdź" zapisuje okna z propozycji na SERWERZE, nie tylko w stanie ekranu', async () => {
    fireEvent.click(await openPlanCard());
    await waitFor(() => expect(vi.mocked(createPlanAnalysisProposal)).toHaveBeenCalled());
    const before = vi.mocked(writePlanScenario).mock.calls.length;
    fireEvent.click(screen.getByTestId('atrapa-zatwierdz'));
    await waitFor(() => expect(vi.mocked(reviewPlanAnalysisProposal)).toHaveBeenCalled());
    await waitFor(() => expect(vi.mocked(writePlanScenario).mock.calls.length).toBe(before + 1));
    expect(
      (vi.mocked(writePlanScenario).mock.calls.at(-1)?.[1] as { operation: string }).operation
    ).toBe('UPDATE');
  });
});
