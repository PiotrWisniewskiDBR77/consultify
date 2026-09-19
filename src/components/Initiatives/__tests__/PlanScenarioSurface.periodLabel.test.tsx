/** @vitest-environment jsdom */
/**
 * QD7 / D-97 — `periodId` okresu planu pochodzi z KLUCZA i18n, nie z zaszytego
 * polskiego literału.
 *
 * Pomiar KROK 0 (18.09): przed paczką `createPeriods` w
 * `PlanScenarioSurface.tsx:235` generował `` `${unit === 'MONTH' ? 'Miesiąc'
 * : 'Tydzień'} ${index + 1}` ``, a `addPeriod` (:1483) `` `Tydzień ${…}` `` —
 * także w interfejsie EN. periodId jest DANĄ zapisywaną w planie, więc polski
 * napis wyciekał do payloadu `writePlanScenario` i do każdego eksportu.
 *
 * Ten test trzyma dwie rzeczy:
 *  1. UNIT: `createPeriods` z realnym `i18next` — en → `Week n`/`Month n`,
 *     pl → `Tydzień n`/`Miesiąc n`, a gdy `t` nie zwraca niepustego napisu
 *     (instancja niezainicjalizowana / podmieniona) → awaryjny literał EN
 *     z kodu (ścieżka `tlumaczPozaHookiem`, defekt `undefined` z 14.09).
 *  2. WPIĘCIE: realny `PlanScenarioSurface`, przepływ „Utwórz plan" — asercja
 *     na ARGUMENT `writePlanScenario` (payload zapisu), nie na tekst ekranu:
 *     `scenario.periods[].periodId` niesie etykietę z języka UI w chwili
 *     tworzenia (pl → `Tydzień 1`, en → `Week 1`).
 *
 * MUTACJE (dowód RED, cofnięte bajt-w-bajt):
 *  M1: `PlanScenarioSurface.tsx` → `periodId: `${unit === 'MONTH' ? 'Miesiąc'
 *      : 'Tydzień'} ${index + 1}`` (stary literał) — czerwone: unit en/pl
 *      (pl przechodzi, en nie) + wpięcie EN.
 *  M2: `periodLabel` → klucz `…period.week` dla obu jednostek — czerwony unit
 *      MONTH (en i pl).
 *  M3: wpięcie → `create()` pomija `createPeriods` (puste `periods: []`) —
 *      czerwony test wpięcia (0 okresów zamiast 12).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import enJson from '../../../../public/locales/en/translation.json';
import plJson from '../../../../public/locales/pl/translation.json';

const { listPlanScenarioRegister, writePlanScenario, translate } = vi.hoisted(() => {
  const en = require('../../../../public/locales/en/translation.json') as unknown;
  return {
    listPlanScenarioRegister: vi.fn(),
    writePlanScenario: vi.fn(),
    translate: (key: string, options?: unknown) => {
      const resolved = key
        .split('.')
        .reduce<unknown>(
          (node, part) =>
            node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
          en
        );
      if (typeof resolved === 'string') return resolved;
      if (typeof options === 'string') return options;
      const fallback = (options as { defaultValue?: unknown } | undefined)?.defaultValue;
      return typeof fallback === 'string' ? fallback : key;
    },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translate, i18n: { language: 'en' } }),
}));
vi.mock('@/i18n', () => ({ default: { language: 'en', t: translate } }));
vi.mock('@/utils/planTimelineV2Flag', () => ({ isPlanTimelineV2Enabled: () => true }));
vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listPlanScenarioRegister,
  readPlanScenario: vi.fn(),
  readPlanScenarioDiff: vi.fn(async () => ({ changes: [] })),
  readPlanScenarioHistory: vi.fn(async () => ({ versions: [] })),
  createPlanAnalysisProposal: vi.fn(),
  reviewPlanAnalysisProposal: vi.fn(),
  listPlannableInitiatives: vi.fn(async () => ({ initiatives: [] })),
  listCapacityScenarioRegister: vi.fn(async () => ({ scenarios: [] })),
  readCapacityScenario: vi.fn(),
  listPlanAnalysisProposals: vi.fn(async () => ({ items: [] })),
  registerInitiativeForPlanning: vi.fn(),
  writeInitiativeDependencies: vi.fn(),
  writePlanScenario,
  RuntimeApiError: class RuntimeApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      readonly rule?: string
    ) {
      super(code);
    }
  },
}));

// Powłoka karty: stub renderuje wszystkie sekcje (jak w `casExpectedVersion.test.tsx`).
vi.mock('@/components/standard/StandardArtifactShell', async () => {
  const React = await import('react');
  return {
    StandardArtifactShell: (props: { sections?: Array<{ id: string; component: unknown }> }) =>
      React.createElement(
        'div',
        null,
        (props.sections ?? []).map((section) =>
          React.createElement(
            'div',
            { key: section.id, 'data-section': section.id },
            section.component as React.ReactNode
          )
        )
      ),
  };
});
vi.mock('@/components/standard/DocumentCardMenu5', async () => {
  const React = await import('react');
  return { DocumentCardMenu5: () => React.createElement('div', null) };
});
vi.mock('../PlanDependencyAnalysisPanel', async () => {
  const React = await import('react');
  return { PlanDependencyAnalysisPanel: () => React.createElement('div', null) };
});
vi.mock('../Generator/GeneratorPlanuModal', async () => {
  const React = await import('react');
  return { GeneratorPlanuModal: () => React.createElement('div', null) };
});
vi.mock('../cards/PlanRoleDemandEditor', async () => {
  const React = await import('react');
  return { PlanRoleDemandEditor: () => React.createElement('div', null) };
});

import { createPeriods, PlanScenarioSurface } from '../PlanScenarioSurface';

beforeAll(async () => {
  // Realny globalny `i18next` (ta sama instancja, którą czyta
  // `tlumaczPozaHookiem`) — bez inicjalizacji modułu `@/i18n`, który jest
  // zmockowany wyżej.
  await i18next.init({
    lng: 'en',
    resources: {
      en: { translation: enJson },
      pl: { translation: plJson },
    },
    interpolation: { escapeValue: false },
    initImmediate: false,
  });
});

describe('QD7/D-97 unit — createPeriods: periodId z klucza i18n', () => {
  it('język en: WEEK → "Week n", MONTH → "Month n" (nie polskie literały)', async () => {
    await i18next.changeLanguage('en');
    expect(createPeriods('2026-09-28', 3).map((p) => p.periodId)).toEqual([
      'Week 1',
      'Week 2',
      'Week 3',
    ]);
    expect(createPeriods('2026-09-01', 2, 'MONTH').map((p) => p.periodId)).toEqual([
      'Month 1',
      'Month 2',
    ]);
  });

  it('język pl: WEEK → "Tydzień n", MONTH → "Miesiąc n" — słowo z zasobu, nie z kodu', async () => {
    await i18next.changeLanguage('pl');
    expect(createPeriods('2026-09-28', 2).map((p) => p.periodId)).toEqual([
      'Tydzień 1',
      'Tydzień 2',
    ]);
    expect(createPeriods('2026-09-01', 2, 'MONTH').map((p) => p.periodId)).toEqual([
      'Miesiąc 1',
      'Miesiąc 2',
    ]);
    await i18next.changeLanguage('en');
  });

  it('awaria tłumaczenia (t zwraca pustkę): awaryjny literał EN z kodu, nigdy "undefined"', () => {
    const spy = vi
      .spyOn(i18next, 't')
      .mockImplementation((() => '') as unknown as typeof i18next.t);
    expect(createPeriods('2026-09-28', 2).map((p) => p.periodId)).toEqual(['Week 1', 'Week 2']);
    expect(createPeriods('2026-09-01', 1, 'MONTH').map((p) => p.periodId)).toEqual(['Month 1']);
    spy.mockRestore();
  });

  it('daty okresów pozostają z PARAMETRÓW generatora (P15-K2 bez regresji)', async () => {
    await i18next.changeLanguage('en');
    const periods = createPeriods('2026-09-28', 2);
    expect(periods[0].start).toBe('2026-09-28T00:00:00.000Z');
    expect(periods[0].end).toBe('2026-10-05T00:00:00.000Z');
    expect(periods[1].start).toBe('2026-10-05T00:00:00.000Z');
  });
});

describe('QD7/D-97 wpięcie — create() wysyła periodId z języka UI', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-14T12:00:00Z'));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 1000,
      height: 32,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 32,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    listPlanScenarioRegister.mockResolvedValue({ scenarios: [] });
    writePlanScenario.mockImplementation(
      async (_id: string, payload: { expectedVersion: number; scenario: Record<string, unknown> }) => ({
        aggregateVersion: payload.expectedVersion + 1,
        response: { ...payload.scenario, scenarioVersion: payload.expectedVersion + 1 },
      })
    );
  });

  /** Formularz „Nowy plan" otwiera zmiana propu `createRequestId` (efekt :381). */
  async function openCreateFormAndSubmit() {
    const view = render(
      <MemoryRouter>
        <PlanScenarioSurface activePreset="all" initiatives={[]} createRequestId={1} />
      </MemoryRouter>
    );
    view.rerender(
      <MemoryRouter>
        <PlanScenarioSurface activePreset="all" initiatives={[]} createRequestId={2} />
      </MemoryRouter>
    );
    const nameInput = await screen.findByLabelText('Plan name you provided');
    fireEvent.change(nameInput, { target: { value: 'QD7 i18n periods plan' } });
    fireEvent.click(screen.getByRole('button', { name: /Create plan/i }));
    await waitFor(() => expect(writePlanScenario).toHaveBeenCalledTimes(1));
    return writePlanScenario.mock.calls[0][1] as {
      operation: string;
      scenario: { periods: Array<{ periodId: string }> };
    };
  }

  it('UI en: payload CREATE niesie 12 okresów "Week 1".."Week 12"', async () => {
    await i18next.changeLanguage('en');
    const payload = await openCreateFormAndSubmit();
    expect(payload.operation).toBe('CREATE');
    expect(payload.scenario.periods).toHaveLength(12);
    expect(payload.scenario.periods.map((p) => p.periodId)).toEqual(
      Array.from({ length: 12 }, (_, i) => `Week ${i + 1}`)
    );
    vi.useRealTimers();
  });

  it('UI pl: ten sam przepływ zapisuje "Tydzień 1".."Tydzień 12" — dowód, że etykieta idzie z klucza, nie z literału EN', async () => {
    await i18next.changeLanguage('pl');
    const payload = await openCreateFormAndSubmit();
    expect(payload.scenario.periods.map((p) => p.periodId)).toEqual(
      Array.from({ length: 12 }, (_, i) => `Tydzień ${i + 1}`)
    );
    await i18next.changeLanguage('en');
    vi.useRealTimers();
  });
});
