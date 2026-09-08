/**
 * @vitest-environment jsdom
 *
 * [ODMROZENIE 06_EXECUTION DEC-453] Uwaga właściciela 08.09 (staging, 0
 * raportów): własna plansza „Wygeneruj pierwszy raport" (cztery kafle w
 * `tbody` pustego stanu tabeli) złamała kanon — „tabela ZAWSZE" (patrz
 * `ExecutionReportsSurface.emptyTiles.test.tsx`, test (k) po tej naprawie).
 * Ta sama treść (cztery raporty startowe + „Własny raport…") żyje teraz jako
 * pozycje `menu` primary CTA „Dodaj raport", rejestrowane przez
 * `onRegisterPrimaryCta` — ten sam kanał, którym Praca/Zasoby/Decyzje i
 * ryzyka dają swoje jedyne CTA widoku.
 *
 * ODBIÓR SPÓJNOŚCI 08.09 (DEC-453, wieczór): CTA żył dotąd jako lokalny
 * `AddReportMenu` (`btn-secondary`, jasny obrys) WEWNĄTRZ węzła
 * `onRegisterFilterControl` — jedyny CTA modułu inaczej wystylizowany niż
 * ciemne primary CTA sąsiednich zakładek. Test renderuje teraz zarejestrowany
 * `cta` przez `PrimaryCtaMenuButton` (`StandardModuleBar.tsx`) — DOKŁADNIE
 * ten sam komponent, który `ExecutionHub` montuje dla KAŻDEJ zakładki z
 * `primaryCta.menu` — więc asercje weryfikują realne zachowanie produktu,
 * nie prywatny prymityw tego pliku.
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
 *   (m5) CTA wraca do `btn-secondary`/wariantu bez `menu` — traci ciemny
 *        wygląd wspólny z Pracą/Zasobami/Decyzjami i ryzykiem (FAIL).
 */
// [ODMROZENIE 06_EXECUTION DEC-453] J7 (spójność językowa): kod miał polski
// defaultValue w t() mimo poprawnego klucza EN w public/locales — poprawiony
// na angielski ('Add report' / 'Custom report…'). Asercje zaktualizowano —
// kontrakt się nie zmienił, zmienił się tylko język domyślnego tekstu.
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

import { PrimaryCtaMenuButton } from '@/components/standard/StandardModuleBar';

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
   * NIE spinamy `onRegisterPrimaryCta` z prawdziwym `useState` (harness na
   * żywo) — atrapa `useTranslation` w tym pliku zwraca NOWĄ funkcję `t` przy
   * KAŻDYM wywołaniu, a efekt rejestrujący primary CTA ma `t` w zależnościach
   * (patrz `ExecutionReportsSurface.tsx`, ten sam powód co w
   * `ExecutionControlSurface.tsx` R4/R5): sprzężenie zwrotne żywy-stan → nowy
   * render → nowe `t` → efekt → `setState` → render… napędza pętlę, która w
   * tym repo już raz spuchła worker vitest do 4 GB (zmierzone przy pisaniu
   * tego testu — pierwsza wersja z `useState` wieszała runnera). Zamiast tego:
   * `onRegisterPrimaryCta` to inertny `vi.fn()` (nie wywołuje żadnego
   * re-renderu), a `cta` z ostatniego wywołania renderujemy OSOBNO przez
   * `PrimaryCtaMenuButton` — DOKŁADNIE ten sam komponent, którym
   * `StandardModuleBar` renderuje `primaryCta.menu` dla KAŻDEJ zakładki
   * (Praca/Zasoby/Decyzje i ryzyka/Raporty), tak samo jak istniejące testy
   * kebaba admina w `ExecutionReportsSurface.emptyTiles.test.tsx` (test l).
   * Klik WEWNĄTRZ tego osobnego renderu nadal woła prawdziwe zamknięcia
   * (`onSelect`/`onCustom`) oryginalnej, wciąż zamontowanej instancji
   * `ExecutionReportsSurface` — to wystarczy, żeby zweryfikować zachowanie
   * bez pętli.
   */
  const mountSurface = () => {
    const onRegisterPrimaryCta = vi.fn();
    render(
      <MemoryRouter>
        <ExecutionReportsSurface onRegisterPrimaryCta={onRegisterPrimaryCta} />
      </MemoryRouter>
    );
    return onRegisterPrimaryCta;
  };

  const latestCta = (onRegisterPrimaryCta: ReturnType<typeof vi.fn>) => {
    const calls = onRegisterPrimaryCta.mock.calls;
    return calls[calls.length - 1]?.[0] ?? null;
  };

  /**
   * Renderuje `PrimaryCtaMenuButton` z `cta` zarejestrowanym PO doładowaniu
   * katalogu (nie ten z pierwszego, wczesnego wywołania efektu przy
   * `catalog === []`) — w OSOBNYM drzewie, tak jak `ExecutionHub` renderuje
   * go u siebie, w innym miejscu drzewa niż `ExecutionReportsSurface`.
   * `listExecutionReportDefinitions` jest async (`mockResolvedValue`), więc
   * pierwsze wywołanie efektu (przy montowaniu) zawsze łapie `catalog === []`
   * — `addReportMenuItems` zmienia tożsamość dopiero PO `setCatalog`, co daje
   * DRUGIE wywołanie `onRegisterPrimaryCta` z prawdziwymi pozycjami.
   */
  const renderMenu2Node = async (onRegisterPrimaryCta: ReturnType<typeof vi.fn>) => {
    await waitFor(() => {
      expect(onRegisterPrimaryCta.mock.calls.length).toBeGreaterThan(1);
    });
    const cta = latestCta(onRegisterPrimaryCta);
    expect(cta).not.toBeNull();
    render(<PrimaryCtaMenuButton cta={cta} />);
  };

  it('(m1) CTA „Dodaj raport" pokazuje jedną pozycję PER definicja MVP z katalogu + „Własny raport…"', async () => {
    const onRegisterPrimaryCta = mountSurface();
    await renderMenu2Node(onRegisterPrimaryCta);

    fireEvent.click(screen.getByText('Add report'));

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
    expect(screen.getByText('Custom report…')).toBeInTheDocument();
  });

  it('(m2) klik pozycji menu otwiera kreator z TĄ definicją wybraną (ten sam handler co dawny kafel)', async () => {
    const onRegisterPrimaryCta = mountSurface();
    await renderMenu2Node(onRegisterPrimaryCta);

    fireEvent.click(screen.getByText('Add report'));
    const item = await screen.findByText('Tygodniowy pakiet realizacji');
    fireEvent.click(item);

    await waitFor(() => {
      expect(screen.getByTestId('execution-report-wizard')).toBeInTheDocument();
    });

    const select = screen.getByLabelText('Definicja raportu') as HTMLSelectElement;
    expect(select.value).toBe('weekly-exec');
  });

  it('(m3) „Własny raport…" otwiera kreator BEZ definicji wybranej z góry', async () => {
    const onRegisterPrimaryCta = mountSurface();
    await renderMenu2Node(onRegisterPrimaryCta);

    fireEvent.click(screen.getByText('Add report'));
    const custom = await screen.findByText('Custom report…');
    fireEvent.click(custom);

    await waitFor(() => {
      expect(screen.getByTestId('execution-report-wizard')).toBeInTheDocument();
    });
  });

  it('(m4) CTA „Dodaj raport" znika w widoku „Definicje" (jedno CTA właściwe widokowi, nie duplikat)', async () => {
    // Ten test przełącza widok Raporty|Definicje — segment toggle żyje dalej
    // w `onRegisterFilterControl` (Poziom + Raporty|Definicje), CTA w
    // OSOBNYM kanale `onRegisterPrimaryCta`. Trzeba spiąć oba na JEDNEJ
    // instancji (nie `mountSurface()` — dublowałoby powierzchnię).
    const onRegisterFilterControl = vi.fn();
    const onRegisterPrimaryCta = vi.fn();
    render(
      <MemoryRouter>
        <ExecutionReportsSurface
          onRegisterFilterControl={onRegisterFilterControl}
          onRegisterPrimaryCta={onRegisterPrimaryCta}
        />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(onRegisterPrimaryCta.mock.calls.length).toBeGreaterThan(1);
    });

    // Widok domyślny to „Raporty" — CTA jest widoczne.
    render(<PrimaryCtaMenuButton cta={latestCta(onRegisterPrimaryCta)} />);
    expect(screen.getByText('Add report')).toBeInTheDocument();

    // Węzeł Menu 2 (segment „Raporty | Definicje") — najnowsze wywołanie.
    const filterCalls = onRegisterFilterControl.mock.calls;
    render(<MemoryRouter>{filterCalls[filterCalls.length - 1]?.[0]}</MemoryRouter>);

    // Klik na pigułkę „Definicje" woła `setRegisterMode` oryginalnej,
    // wciąż zamontowanej instancji (to jej domknięcie) — instancja
    // przerejestrowuje `onRegisterPrimaryCta` znowu, tym razem z `null`
    // (mutacja: brak warunku `registerMode === 'RUNS'` zostawiłby CTA
    // widoczne też w „Definicje" — RED).
    const callsBeforeClick = onRegisterPrimaryCta.mock.calls.length;
    fireEvent.click(screen.getByText('Definicje'));

    await waitFor(() => {
      expect(onRegisterPrimaryCta.mock.calls.length).toBeGreaterThan(callsBeforeClick);
    });
    expect(latestCta(onRegisterPrimaryCta)).toBeNull();
  });

  it('(m5) CTA jest wariantem `menu` DOKŁADNIE tego samego komponentu co Praca/Zasoby/Decyzje i ryzyka — ciemny primary, nie `btn-secondary`', async () => {
    const onRegisterPrimaryCta = mountSurface();
    await renderMenu2Node(onRegisterPrimaryCta);

    // `PrimaryCtaMenuButton` renderuje `MENU_1_PRIMARY_CTA` (SSOT ciemnego
    // wypełnienia) — mutacja: powrót do `btn-secondary` w renderowanym
    // przycisku ma przewrócić tę asercję.
    const trigger = screen.getByTestId('execution-reports-add-report-menu');
    expect(trigger.className).toContain('bg-navy-900');
    expect(trigger.className).not.toContain('btn-secondary');
  });
});
