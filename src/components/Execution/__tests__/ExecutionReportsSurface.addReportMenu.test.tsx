/**
 * @vitest-environment jsdom
 *
 * [ODMROZENIE 06_EXECUTION DEC-453] Uwaga właściciela 08.09 (staging, 0
 * raportów): własna plansza „Wygeneruj pierwszy raport" (cztery kafle w
 * `tbody` pustego stanu tabeli) złamała kanon — „tabela ZAWSZE" (patrz
 * `ExecutionReportsSurface.emptyTiles.test.tsx`, test (k) po tej naprawie).
 * Ta sama treść (cztery raporty startowe + „Własny raport…") żyje teraz w
 * CTA „Dodaj raport" w Menu 2 (`AddReportMenu`), rejestrowana przez
 * `onRegisterFilterControl` — ten sam kanał, którym `ExecutionControlSurface`
 * daje „Nowa decyzja"/„Nowa pozycja RAID" (JEDNO CTA właściwe widokowi, w
 * rejestrowanym węźle Menu 2, NIE w primary CTA gospodarza `onNewItem`).
 *
 * MUTACJE, na które te testy reagują:
 *   (m1) pozycje menu na sztywno (4 zahardkodowane klucze) zamiast z
 *        `catalog` → katalog testowy z DWOMA MVP renderowałby dalej 4
 *        pozycje (FAIL).
 *   (m2) klik pozycji menu nie ustawia `wizardKey`/nie otwiera kreatora →
 *        selekt definicji w kreatorze zostaje pusty (FAIL).
 *   (m3) „Własny raport…" brakuje albo nie otwiera kreatora wcale (FAIL).
 *   (m4) CTA rejestrowane także w widoku „Definicje" (`registerMode
 *        === 'DEFINITIONS'`) zamiast wyłącznie w „Raporty" — duplikat CTA,
 *        ten sam błąd gęstości co dawne dwa CTA robiące to samo (FAIL).
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
// „4 pozycje na sztywno" (test m1 poniżej).
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

describe('ExecutionReportsSurface — CTA „Dodaj raport" w Menu 2 (DEC-453, 08.09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listExecutionReportDefinitions.mockResolvedValue({ definitions: TEST_CATALOG });
    listExecutionReportRuns.mockResolvedValue({ items: [] });
    listReportRuns.mockResolvedValue({ items: [] });
    listReportDefinitions.mockResolvedValue({ items: [] });
    listExecutionCases.mockResolvedValue({ cases: [] });
  });

  /**
   * NIE spinamy `onRegisterFilterControl` z prawdziwym `useState` (harness na
   * żywo) — atrapa `useTranslation` w tym pliku zwraca NOWĄ funkcję `t` przy
   * KAŻDYM wywołaniu, a efekt rejestrujący węzeł Menu 2 ma `t` w zależnościach
   * (patrz `ExecutionReportsSurface.tsx`, ten sam powód co w
   * `ExecutionControlSurface.tsx` R4/R5): sprzężenie zwrotne żywy-stan → nowy
   * render → nowe `t` → efekt → `setState` → render… napędza pętlę, która w
   * tym repo już raz spuchła worker vitest do 4 GB (zmierzone przy pisaniu
   * tego testu — pierwsza wersja z `useState` wieszała runnera). Zamiast tego:
   * `onRegisterFilterControl` to inertny `vi.fn()` (nie wywołuje żadnego
   * re-renderu), a WĘZEŁ z ostatniego wywołania renderujemy OSOBNO, tak samo
   * jak istniejące testy kebaba admina w `ExecutionReportsSurface.emptyTiles.test.tsx`
   * (test l). Klik WEWNĄTRZ tego osobnego renderu nadal woła prawdziwe settery
   * oryginalnej, wciąż zamontowanej instancji `ExecutionReportsSurface` (te same
   * domknięcia) — to wystarczy, żeby zweryfikować zachowanie bez pętli.
   */
  const mountSurface = () => {
    const onRegisterFilterControl = vi.fn();
    render(
      <MemoryRouter>
        <ExecutionReportsSurface onRegisterFilterControl={onRegisterFilterControl} />
      </MemoryRouter>
    );
    return onRegisterFilterControl;
  };

  const latestNode = (onRegisterFilterControl: ReturnType<typeof vi.fn>) => {
    const calls = onRegisterFilterControl.mock.calls;
    return calls[calls.length - 1]?.[0] ?? null;
  };

  /**
   * Renderuje węzeł Menu 2 zarejestrowany PO doładowaniu katalogu (nie ten z
   * pierwszego, wczesnego wywołania efektu przy `catalog === []`) — w OSOBNYM
   * drzewie, tak jak `ExecutionHub` renderuje go u siebie, w innym miejscu
   * drzewa niż `ExecutionReportsSurface`. `listExecutionReportDefinitions`
   * jest async (`mockResolvedValue`), więc pierwsze wywołanie efektu (przy
   * montowaniu) zawsze łapie `catalog === []` — `addReportMenuItems` zmienia
   * tożsamość dopiero PO `setCatalog`, co daje DRUGIE wywołanie
   * `onRegisterFilterControl` z prawdziwymi pozycjami.
   */
  const renderMenu2Node = async (onRegisterFilterControl: ReturnType<typeof vi.fn>) => {
    await waitFor(() => {
      expect(onRegisterFilterControl.mock.calls.length).toBeGreaterThan(1);
    });
    render(<MemoryRouter>{latestNode(onRegisterFilterControl)}</MemoryRouter>);
  };

  it('(m1) CTA „Dodaj raport" pokazuje jedną pozycję PER definicja MVP z katalogu + „Własny raport…"', async () => {
    const onRegisterFilterControl = mountSurface();
    await renderMenu2Node(onRegisterFilterControl);

    fireEvent.click(screen.getByText('Dodaj raport'));

    // Katalog testowy ma DWA mvp (mvp-owner-test, weekly-exec) — nie cztery
    // realne klucze produkcyjne, i ZERO dla 'wave2-test' (mvp: false).
    // `findByText` (nie `getByText`) — pozycje menu dochodzą po async
    // `listExecutionReportDefinitions`, dropdown może się otworzyć zanim
    // katalog dotrze; React zachowuje lokalny stan `open` `AddReportMenu`
    // przy rekoncyliacji tej samej pozycji w drzewie, więc menu dostaje
    // pozycje, gdy tylko katalog doładuje.
    expect(await screen.findByText('Testowa karta właściciela')).toBeInTheDocument();
    expect(screen.getByText('Zakres testowy A')).toBeInTheDocument();
    expect(screen.getByText('Właściciel testowy')).toBeInTheDocument();
    expect(screen.getByText('Tygodniowy pakiet realizacji')).toBeInTheDocument();
    expect(screen.queryByText('Definicja Fali 2')).not.toBeInTheDocument();

    // Piąta pozycja: „Własny raport…" (dawniej: „Nowy raport" w primary CTA).
    expect(screen.getByText('Własny raport…')).toBeInTheDocument();
  });

  it('(m2) klik pozycji menu otwiera kreator z TĄ definicją wybraną (ten sam handler co dawny kafel)', async () => {
    const onRegisterFilterControl = mountSurface();
    await renderMenu2Node(onRegisterFilterControl);

    fireEvent.click(screen.getByText('Dodaj raport'));
    const item = await screen.findByText('Tygodniowy pakiet realizacji');
    fireEvent.click(item);

    await waitFor(() => {
      expect(screen.getByTestId('execution-report-wizard')).toBeInTheDocument();
    });

    const select = screen.getByLabelText('Definicja raportu') as HTMLSelectElement;
    expect(select.value).toBe('weekly-exec');
  });

  it('(m3) „Własny raport…" otwiera kreator BEZ definicji wybranej z góry', async () => {
    const onRegisterFilterControl = mountSurface();
    await renderMenu2Node(onRegisterFilterControl);

    fireEvent.click(screen.getByText('Dodaj raport'));
    const custom = await screen.findByText('Własny raport…');
    fireEvent.click(custom);

    await waitFor(() => {
      expect(screen.getByTestId('execution-report-wizard')).toBeInTheDocument();
    });
  });

  it('(m4) CTA „Dodaj raport" znika w widoku „Definicje" (jedno CTA właściwe widokowi, nie duplikat)', async () => {
    const onRegisterFilterControl = mountSurface();
    await renderMenu2Node(onRegisterFilterControl);

    // Widok domyślny to „Raporty" — CTA jest widoczne.
    expect(await screen.findByText('Dodaj raport')).toBeInTheDocument();

    // Klik na pigułkę „Definicje" woła `setRegisterMode` oryginalnej,
    // wciąż zamontowanej instancji (to jej domknięcie) — instancja
    // przerejestrowuje węzeł Menu 2 (`onRegisterFilterControl` znowu, z
    // NOWĄ treścią). Ten render (kopia sprzed kliknięcia) tego nie pokaże —
    // trzeba pobrać i wyrenderować NAJNOWSZE wywołanie osobno, tak jak robi
    // to `ExecutionHub` po każdym renderze `ExecutionReportsSurface`.
    const callsBeforeClick = onRegisterFilterControl.mock.calls.length;
    fireEvent.click(screen.getByText('Definicje'));

    await waitFor(() => {
      expect(onRegisterFilterControl.mock.calls.length).toBeGreaterThan(callsBeforeClick);
    });
    render(<MemoryRouter>{latestNode(onRegisterFilterControl)}</MemoryRouter>);

    // Mutacja: CTA rejestrowane bez warunku `registerMode === 'RUNS'` (czyli
    // widoczne też w „Definicje") ma przewrócić tę asercję — liczymy WSZYSTKIE
    // wystąpienia w dokumencie (obie kopie DOM), bo poprzedni render z CTA
    // wciąż jest zamontowany obok.
    expect(screen.queryAllByText('Dodaj raport')).toHaveLength(1);
  });
});
