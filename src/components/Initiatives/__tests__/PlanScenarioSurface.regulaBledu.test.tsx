/** @vitest-environment jsdom */

/**
 * P15-K1 (DEC-421, KROK 2) — ekran pokazuje POWOD, nie jedno zdanie.
 *
 * POMIAR 07.09: kazdy blad zapisu planu konczyl sie napisem
 * „Operacja na planie nie powiodla sie" — takze wtedy, gdy serwer wiedzial, ze
 * portfel jest w innej wersji.
 *
 * MUTACJA (dowod RED): w `PlanScenarioSurface.tsx` przywroc render bez
 * `writeRule` (sam `writeState`) albo przestan przekazywac `rule` w
 * `RuntimeApiError` — test zobaczy ogolny komunikat zamiast zdania o portfelu.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import plTranslation from '../../../../public/locales/pl/translation.json';

const {
  listPlanScenarioRegister,
  readPlanScenario,
  writePlanScenario,
  RuntimeApiErrorMock,
  translate,
} = vi.hoisted(() => {
  const pl = require('../../../../public/locales/pl/translation.json') as unknown;
  return {
    listPlanScenarioRegister: vi.fn(),
    readPlanScenario: vi.fn(),
    writePlanScenario: vi.fn(),
    RuntimeApiErrorMock: class RuntimeApiError extends Error {
      constructor(
        readonly status: number,
        readonly code: string,
        readonly rule?: string
      ) {
        super(code);
      }
    },
    translate: (key: string, options?: unknown) => {
      const resolved = key
        .split('.')
        .reduce<unknown>(
          (node, part) =>
            node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
          pl
        );
      if (typeof resolved === 'string') return resolved;
      if (typeof options === 'string') return options;
      const fallback = (options as { defaultValue?: unknown } | undefined)?.defaultValue;
      return typeof fallback === 'string' ? fallback : key;
    },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translate, i18n: { language: 'pl' } }),
}));
vi.mock('@/i18n', () => ({ default: { language: 'pl', t: translate } }));
vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listPlanScenarioRegister,
  readPlanScenario,
  readPlanScenarioDiff: vi.fn(),
  readPlanScenarioHistory: vi.fn(async () => ({ versions: [] })),
  createPlanAnalysisProposal: vi.fn(),
  reviewPlanAnalysisProposal: vi.fn(),
  // P15-K2 (DEC-421): most inicjatyw modulu — powierzchnia wczytuje liste
  // kwalifikujacych sie inicjatyw przy montazu.
  listPlannableInitiatives: vi.fn(async () => ({ initiatives: [] })),
  registerInitiativeForPlanning: vi.fn(),
  writePlanScenario,
  RuntimeApiError: RuntimeApiErrorMock,
}));

import { PlanScenarioSurface } from '../PlanScenarioSurface';

describe('P15-K1 — blad zapisu planu nazywa regule', () => {
  beforeEach(() => {
    listPlanScenarioRegister.mockResolvedValue({ scenarios: [] });
    readPlanScenario.mockResolvedValue(null);
    writePlanScenario.mockRejectedValue(
      new RuntimeApiErrorMock(400, 'PORTFOLIO_VERSION_MISMATCH', 'PORTFOLIO_VERSION_MISMATCH')
    );
  });

  it('pokazuje zdanie o wersji portfela, a nie ogolne „nie powiodla sie"', async () => {
    // Formularz „Nowy plan" otwiera modul przez `createRequestId` (Menu 1),
    // a nie przycisk wewnatrz listy — dlatego test podaje go wprost.
    const view = render(
      <MemoryRouter>
        <PlanScenarioSurface activePreset="all" initiatives={[]} createRequestId={0} />
      </MemoryRouter>
    );
    view.rerender(
      <MemoryRouter>
        <PlanScenarioSurface activePreset="all" initiatives={[]} createRequestId={1} />
      </MemoryRouter>
    );
    fireEvent.change(await screen.findByLabelText('Nazwa planu nadana przez Ciebie'), {
      target: { value: 'Plan modernizacji' },
    });
    // P15-K2 (DEC-421): formularz NIE pyta juz o portfel — zaklada go serwer
    // (portfel roboczy). Zostaje sama nazwa planu.
    fireEvent.click(screen.getByRole('button', { name: (name) => name.includes('Utwórz plan') }));

    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert.textContent).toBe(
      plTranslation.initiatives.planScenario.errors.PORTFOLIO_VERSION_MISMATCH
    );
    expect(alert.textContent).not.toBe(plTranslation.initiatives.planScenario.writeError);
  });
});
