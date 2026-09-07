/**
 * @vitest-environment jsdom
 *
 * [ODMROZENIE 06_EXECUTION DEC-453] P16-R6 (D6/D7, właściciel 07.09: „ważne,
 * żeby działało — w testach zobaczymy i będziemy poprawiać").
 *
 * Test (k) z P16 §6: 0 migawek → cztery kafle jednego kliknięcia, po jednym
 * na definicję MVP z KATALOGU serwera (nie lista na sztywno) — klik
 * „Wygeneruj raport" otwiera dokładnie ten sam kreator co „Nowy raport",
 * z wybraną definicją i domyślnym okresem.
 *
 * Test (l): przyciski deweloperskie („Nowa definicja"/„Kontrakt raportu
 * (zaawansowane)") rejestrowane do kebaba Menu 3 WYŁĄCZNIE gdy `isAdmin`
 * jest prawdziwe — MEMBER (isAdmin=false) nie dostaje kebaba wcale.
 *
 * MUTACJE, na które te testy reagują:
 *   (k1) kafle na sztywno (4 zahardkodowane klucze) zamiast z `catalog` →
 *        katalog testowy z 2 MVP renderowałby wtedy dalej 4 kafle (FAIL).
 *   (k2) klik kafla nie ustawia `wizardKey`/nie otwiera kreatora → selekt
 *        definicji w kreatorze zostaje pusty (FAIL).
 *   (l)  kebab renderowany niezależnie od `isAdmin` → `onRegisterMenu3Control`
 *        dostałby węzeł z tekstem „Nowa definicja" nawet dla MEMBER (FAIL).
 */
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

  it('(k1) renderuje jeden kafel PER definicja MVP z katalogu — nie listę na sztywno', async () => {
    render(
      <MemoryRouter>
        <ExecutionReportsSurface />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('standard-table-empty-actions')).toBeInTheDocument();
    });

    // Katalog testowy ma DWA mvp (mvp-owner-test, weekly-exec) — nie cztery
    // realne klucze produkcyjne. Kafel istnieje dokładnie dla tych dwóch,
    // ZERO dla 'wave2-test' (mvp: false) i zero dla kluczy spoza katalogu.
    expect(screen.getByTestId('standard-table-empty-action-mvp-owner-test')).toBeInTheDocument();
    expect(screen.getByTestId('standard-table-empty-action-weekly-exec')).toBeInTheDocument();
    expect(screen.queryByTestId('standard-table-empty-action-wave2-test')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('standard-table-empty-action-initiative-card')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('standard-table-empty-action-program-health')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('standard-table-empty-action-sponsor-onepager')
    ).not.toBeInTheDocument();

    // Treść kafla pochodzi z katalogu (nazwa/audytorium/opis), nie z tekstu
    // zaszytego w komponencie.
    expect(screen.getByText('Testowa karta właściciela')).toBeInTheDocument();
    expect(screen.getByText('Zakres testowy A')).toBeInTheDocument();
    expect(screen.getByText('Właściciel testowy')).toBeInTheDocument();
  });

  it('(k2) klik „Wygeneruj raport" na kaflu otwiera kreator z TĄ definicją wybraną', async () => {
    render(
      <MemoryRouter>
        <ExecutionReportsSurface />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('standard-table-empty-action-weekly-exec')).toBeInTheDocument();
    });

    const tile = screen.getByTestId('standard-table-empty-action-weekly-exec');
    const generateButton = tile.querySelector('button');
    expect(generateButton).not.toBeNull();
    fireEvent.click(generateButton!);

    await waitFor(() => {
      expect(screen.getByTestId('execution-report-wizard')).toBeInTheDocument();
    });

    const select = screen.getByLabelText('Definicja raportu') as HTMLSelectElement;
    expect(select.value).toBe('weekly-exec');
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
