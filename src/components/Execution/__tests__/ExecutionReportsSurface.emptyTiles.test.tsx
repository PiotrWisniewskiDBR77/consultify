/**
 * @vitest-environment jsdom
 *
 * [ODMROZENIE 06_EXECUTION DEC-453] P16-R6 (D6/D7, właściciel 07.09: „ważne,
 * żeby działało — w testach zobaczymy i będziemy poprawiać").
 *
 * 08.09 (uwaga właściciela, staging, 0 raportów): kafle jednego kliknięcia
 * w PUSTYM STANIE TABELI („Wygeneruj pierwszy raport", cztery karty) złamały
 * kanon — „ekrany listowe WYŁĄCZNIE StandardTable, tabela ZAWSZE". Kafle są
 * USUNIĘTE z pustego stanu; ta sama treść/handler żyje teraz w CTA „Dodaj
 * raport" w Menu 2 (`AddReportMenu`, rejestrowana przez
 * `onRegisterFilterControl`) — testy (k1)/(k2), które broniły starych kafli
 * w `tbody` tabeli, przeniosły się do
 * `ExecutionReportsSurface.addReportMenu.test.tsx` (nowy plik, ta sama
 * własność: katalog-driven, nie hardkod; klik = ten sam kreator/`wizardKey`).
 *
 * Test (l), NIEZMIENIONY tą naprawą: przyciski deweloperskie („Nowa
 * definicja"/„Kontrakt raportu (zaawansowane)") rejestrowane do kebaba
 * Menu 3 WYŁĄCZNIE gdy `isAdmin` jest prawdziwe — MEMBER (isAdmin=false) nie
 * dostaje kebaba wcale.
 *
 * MUTACJE, na które ten test reaguje:
 *   (l) kebab renderowany niezależnie od `isAdmin` → `onRegisterMenu3Control`
 *       dostałby węzeł z tekstem „Nowa definicja" nawet dla MEMBER (FAIL).
 */
// [ODMROZENIE 06_EXECUTION DEC-453] J7 (spójność językowa): kod miał polski
// defaultValue w t() mimo poprawnego klucza EN w public/locales — poprawiony
// na angielski ('No reports'). Asercja zaktualizowana — kontrakt się nie
// zmienił, zmienił się tylko język domyślnego tekstu.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : k),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// Katalog testowy: TYLKO DWA MVP (zamiast realnych czterech) — łapie mutację
// „4 kafle na sztywno" (test k1 poniżej).
const TEST_CATALOG = [
  {
    key: 'mvp-owner-test',
    name: 'Testowa karta właściciela',
    audience: 'Właściciel testowy',
    cadence: 'Tygodniowo',
    scope: 'Zakres testowy A',
    sections: ['Sekcja A'],
    level: 'OWNER' as const,
    mvp: true,
    formats: ['SCREEN' as const],
  },
  {
    key: 'weekly-exec',
    name: 'Tygodniowy pakiet realizacji',
    audience: 'PMO testowe',
    cadence: 'Tygodniowo',
    scope: 'Zakres testowy B',
    sections: ['Sekcja B'],
    level: 'PMO' as const,
    mvp: true,
    formats: ['SCREEN' as const],
  },
  {
    key: 'wave2-test',
    name: 'Definicja Fali 2',
    audience: 'Nikt jeszcze',
    cadence: 'Miesięcznie',
    scope: 'Zakres Fali 2',
    sections: ['Sekcja C'],
    level: 'BOARD' as const,
    mvp: false,
    formats: ['SCREEN' as const],
  },
];

const { listExecutionReportDefinitions, listExecutionReportRuns } = vi.hoisted(() => ({
  listExecutionReportDefinitions: vi.fn(),
  listExecutionReportRuns: vi.fn(),
}));
vi.mock('@/services/executionReports/executionReportsApi', () => ({
  listExecutionReportDefinitions,
  listExecutionReportRuns,
  createExecutionReportRun: vi.fn(),
  readExecutionReportRun: vi.fn(),
}));

const {
  listReportRuns,
  listReportDefinitions,
  listExecutionCases,
  getReportDefinition,
  createReportRun,
  createReportDefinition,
  transitionReportDefinition,
  transitionReportRun,
  readExecutionCase,
  createExecutionTask,
} = vi.hoisted(() => ({
  listReportRuns: vi.fn(),
  listReportDefinitions: vi.fn(),
  listExecutionCases: vi.fn(),
  getReportDefinition: vi.fn(),
  createReportRun: vi.fn(),
  createReportDefinition: vi.fn(),
  transitionReportDefinition: vi.fn(),
  transitionReportRun: vi.fn(),
  readExecutionCase: vi.fn(),
  createExecutionTask: vi.fn(),
}));
vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listReportRuns,
  listReportDefinitions,
  listExecutionCases,
  getReportDefinition,
  createReportRun,
  createReportDefinition,
  transitionReportDefinition,
  transitionReportRun,
  readExecutionCase,
  createExecutionTask,
}));

import { ExecutionReportsSurface } from '../ExecutionReportsSurface';

describe('ExecutionReportsSurface — pusty stan z kaflami (D6) i kebab admin-only (test k, l)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listExecutionReportDefinitions.mockResolvedValue({ definitions: TEST_CATALOG });
    listExecutionReportRuns.mockResolvedValue({ items: [] });
    listReportRuns.mockResolvedValue({ items: [] });
    listReportDefinitions.mockResolvedValue({ items: [] });
    listExecutionCases.mockResolvedValue({ cases: [] });
  });

  it('(k) 0 migawek → pusty stan tabeli BEZ kafli/planszy (kanon: tabela zawsze)', async () => {
    render(
      <MemoryRouter>
        <ExecutionReportsSurface />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('standard-table-empty')).toBeInTheDocument();
    });

    // Mutacja: przywrócenie `empty.actions` (kafle) w `ExecutionReportsSurface`
    // ma przewrócić ten test.
    expect(screen.queryByTestId('standard-table-empty-actions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('standard-table-empty-action-mvp-owner-test')).not.toBeInTheDocument();
    expect(screen.queryByText('Wygeneruj pierwszy raport')).not.toBeInTheDocument();
    expect(screen.getByText('No reports')).toBeInTheDocument();
  });

  it('(l) MEMBER (isAdmin=false) nie dostaje kebaba deweloperskiego w Menu 3', async () => {
    const onRegisterMenu3Control = vi.fn();
    render(
      <MemoryRouter>
        <ExecutionReportsSurface isAdmin={false} onRegisterMenu3Control={onRegisterMenu3Control} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(onRegisterMenu3Control).toHaveBeenCalled();
    });

    // KAŻDE wywołanie dla MEMBER musi nosić `null` — ani jedno wywołanie nie
    // może przekazać węzła z etykietami przycisków deweloperskich.
    for (const call of onRegisterMenu3Control.mock.calls) {
      expect(call[0]).toBeNull();
    }
  });

  it('(l) ADMIN (isAdmin=true) dostaje kebab z „Nowa definicja" i „Kontrakt raportu (zaawansowane)"', async () => {
    const onRegisterMenu3Control = vi.fn();
    render(
      <MemoryRouter>
        <ExecutionReportsSurface isAdmin onRegisterMenu3Control={onRegisterMenu3Control} />
      </MemoryRouter>
    );

    await waitFor(() => {
      const lastCall =
        onRegisterMenu3Control.mock.calls[onRegisterMenu3Control.mock.calls.length - 1];
      expect(lastCall?.[0]).not.toBeNull();
    });

    // Renderujemy sam węzeł zarejestrowany przez surface, żeby sprawdzić
    // jego treść niezależnie od gospodarza (ExecutionHub).
    const lastCall =
      onRegisterMenu3Control.mock.calls[onRegisterMenu3Control.mock.calls.length - 1];
    render(<MemoryRouter>{lastCall[0]}</MemoryRouter>);
    // Kebab jest zamknięty domyślnie — otwórz go, żeby zobaczyć pozycje.
    fireEvent.click(screen.getByLabelText('Row actions'));
    await waitFor(() => {
      expect(screen.getByText('Nowa definicja')).toBeInTheDocument();
      expect(screen.getByText('Kontrakt raportu (zaawansowane)')).toBeInTheDocument();
    });
  });
});
