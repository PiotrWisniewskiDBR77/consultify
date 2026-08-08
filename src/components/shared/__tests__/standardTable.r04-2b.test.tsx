/**
 * R04-2B — `StandardTable` jako fasada kontraktu powierzchni.
 *
 * Kontrakt: `MY_WORK_TABLE_SURFACE_CONTRACT_V1.md` §1 (deskryptor), §5 (tabela,
 * selection, kolumny, stany), rejestr `TABLE_SURFACE_REGISTER` (R00),
 * wysokość 56 px (decyzja R04-0, wdrożona w `FilterableTable` w R04-2A).
 *
 * ZAKRES: wyłącznie `StandardTable`. Renderer nie jest dublowany — fasada
 * przekazuje kontrakt do `FilterableTable` i to tam powstaje DOM, więc część
 * asercji sprawdza wynik delegacji, a nie własny markup fasady.
 *
 * NIE migrujemy 100 konsumentów: `surfaceId` jest OPCJONALNY, a ścieżka bez
 * niego musi zostać nietknięta. Osobny blok testów tego pilnuje.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import { TABLE_SURFACE_REGISTER } from '@/contracts/tableSurface/surfaceRegister';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && fallback.defaultValue) {
        return fallback.defaultValue;
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

/** T05 = My Work / Tasks — selection: 'bulk', persistKey 'my-work.tasks'. */
const T05 = TABLE_SURFACE_REGISTER.T05;
/** T15 = Consulting Tools / Library — delete business-locked, selection bulk. */
const T15 = TABLE_SURFACE_REGISTER.T15;

const data: TableRow[] = [
  {
    id: '1',
    title: 'Alpha',
    status: 'active',
    priority: 'high',
    assignee: 'Ada',
    dueDate: '2026-09-01',
  },
  { id: '2', title: 'Beta', status: 'blocked', priority: 'low', assignee: 'Bo', dueDate: null },
];

/** Komplet kolumn wymaganych przez kontrakt T05. */
const t05Columns: TableColumn[] = [
  { id: 'title', label: 'Title' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'dueDate', label: 'Due date' },
];

function renderTable(props: Partial<React.ComponentProps<typeof StandardTable>> = {}) {
  const onFilterChange = vi.fn();
  const utils = render(
    <StandardTable
      columns={t05Columns}
      data={data}
      activeFilters={[]}
      onFilterChange={onFilterChange}
      {...props}
    />
  );
  return { ...utils, onFilterChange };
}

const headerCells = () => [...document.querySelectorAll('thead th')] as HTMLElement[];
const bodyCells = () => [...document.querySelectorAll('tbody td')] as HTMLElement[];

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

// ── surfaceId → persistKey ─────────────────────────────────────────────────

describe('R04-2B · persistKey z kontraktu', () => {
  it('kontrakt T05 niesie kanoniczny persistKey', () => {
    expect(T05.capabilities.persistKey).toBe('my-work.tasks');
  });

  /*
   * Klucz persystencji nie jest widoczny w DOM, ale JEST obserwowalny: stan
   * „Show row description" czyta `standardTable.rowDesc.<persistKey>`. Jeśli
   * fasada wzięła klucz z rejestru, wpis zapisany pod kanoniczną nazwą włącza
   * opisy; jeśli wzięła klucz ekranu — włącza go wpis pod nazwą własną.
   */
  it('surfaceId ustawia persistKey z rejestru, gdy ekran go nie podał', () => {
    window.localStorage.setItem(`standardTable.rowDesc.${T05.capabilities.persistKey}`, '1');
    renderTable({ surfaceId: 'T05', rowDescription: () => 'opis wiersza' });
    expect(screen.getAllByText('opis wiersza').length).toBeGreaterThan(0);
  });

  it('bez surfaceId i bez persistKey opisy nie są persystowane', () => {
    window.localStorage.setItem(`standardTable.rowDesc.${T05.capabilities.persistKey}`, '1');
    renderTable({ rowDescription: () => 'opis wiersza' });
    // Brak klucza → brak odczytu → opis wyłączony, mimo wpisu w storage.
    expect(screen.queryByText('opis wiersza')).toBeNull();
  });

  it('jawny persistKey ekranu ma pierwszeństwo nad kontraktem', () => {
    // Wpis TYLKO pod kluczem własnym; klucz rejestru pozostaje pusty.
    window.localStorage.setItem('standardTable.rowDesc.custom-key', '1');
    renderTable({
      surfaceId: 'T05',
      persistKey: 'custom-key',
      rowDescription: () => 'opis wiersza',
    });
    expect(screen.getAllByText('opis wiersza').length).toBeGreaterThan(0);
  });
});

// ── selection wg capability ────────────────────────────────────────────────

describe('R04-2B · selection zgodnie z kontraktem', () => {
  const selection = { selectedIds: new Set<string>(), onChange: vi.fn() };

  it('T05 deklaruje selection: bulk', () => {
    expect(T05.capabilities.selection).toBe('bulk');
  });

  it('przy selection: bulk checkboxy są renderowane', () => {
    renderTable({ surfaceId: 'T05', selection });
    const header = within(document.querySelector('thead') as HTMLElement).getAllByRole('checkbox');
    const body = within(document.querySelector('tbody') as HTMLElement).getAllByRole('checkbox');
    expect(header).toHaveLength(1);
    expect(body).toHaveLength(data.length);
  });

  it('kontrakt selection: none ODCINA checkboxy, choć ekran podał prop', () => {
    // Symulujemy powierzchnię o selection 'none' przez podmianę kontraktu —
    // dziś wszystkie 45 deklaruje 'bulk', więc bez tego nie dałoby się tego
    // sprawdzić inaczej niż na przyszłej regresji rejestru.
    const spy = vi.spyOn(TABLE_SURFACE_REGISTER, 'T15', 'get').mockReturnValue({
      ...T15,
      capabilities: { ...T15.capabilities, selection: 'none', selectionNoneReason: 'test' },
    } as typeof T15);

    renderTable({ surfaceId: 'T15', selection });
    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    spy.mockRestore();
  });

  it('bez surfaceId selection działa jak dotąd', () => {
    renderTable({ selection });
    const body = within(document.querySelector('tbody') as HTMLElement).getAllByRole('checkbox');
    expect(body).toHaveLength(data.length);
  });
});

// ── kompletność kolumn ─────────────────────────────────────────────────────

describe('R04-2B · wymagane kolumny wg rejestru', () => {
  it('komplet kolumn T05 nie zgłasza naruszenia', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderTable({ surfaceId: 'T05' });
    const messages = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(messages).not.toContain('TABLE_MISSING_REQUIRED_COLUMN');
  });

  it('brak wymaganej kolumny jest raportowany, ale NIE blokuje renderu', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderTable({
      surfaceId: 'T05',
      columns: [
        { id: 'title', label: 'Title' },
        { id: 'status', label: 'Status' },
      ],
    });
    const messages = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(messages).toContain('TABLE_MISSING_REQUIRED_COLUMN');
    // G1: raportujemy, nie odbieramy funkcji — tabela nadal jest.
    expect(document.querySelector('table')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('brak kolumny identyfikującej ma własny kod naruszenia', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderTable({
      surfaceId: 'T05',
      columns: [{ id: 'status', label: 'Status' }],
    });
    const messages = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(messages).toContain('TABLE_MISSING_IDENTIFIER_COLUMN');
  });
});

// ── geometria dziedziczona z R04-2A ────────────────────────────────────────

describe('R04-2B · 56 px przechodzi przez fasadę', () => {
  it('nagłówek i wiersz mają h-14 po delegacji', () => {
    renderTable({ surfaceId: 'T05' });
    expect(headerCells().length).toBeGreaterThan(0);
    for (const cell of headerCells()) expect(cell.className).toContain('h-14');
    for (const cell of bodyCells()) expect(cell.className).toContain('h-14');
  });

  it('fasada NIE dubluje renderera — renderuje dokładnie jedną tabelę', () => {
    renderTable({ surfaceId: 'T05' });
    expect(document.querySelectorAll('table')).toHaveLength(1);
  });
});

// ── interakcja ─────────────────────────────────────────────────────────────

describe('R04-2B · interakcja wiersza', () => {
  it('klik wiersza otwiera preview', () => {
    const onRowClick = vi.fn();
    renderTable({ surfaceId: 'T05', onRowClick });
    fireEvent.click(screen.getByText('Alpha').closest('tr') as HTMLElement);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('podwójny klik otwiera pełny szczegół', () => {
    const onRowDoubleClick = vi.fn();
    renderTable({ surfaceId: 'T05', onRowDoubleClick });
    fireEvent.doubleClick(screen.getByText('Alpha').closest('tr') as HTMLElement);
    expect(onRowDoubleClick).toHaveBeenCalledTimes(1);
  });
});

// ── zgodność wsteczna: 100 konsumentów bez surfaceId ───────────────────────

describe('R04-2B · ścieżka bez surfaceId pozostaje nietknięta', () => {
  it('renderuje tabelę i dane bez żadnego kontraktu', () => {
    renderTable();
    expect(document.querySelector('table')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('NIE zgłasza naruszeń kontraktu, gdy powierzchnia go nie deklaruje', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderTable({ columns: [{ id: 'whatever', label: 'Whatever' }] });
    const messages = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(messages).not.toContain('TABLE_MISSING_REQUIRED_COLUMN');
  });

  it('zachowuje stan loading', () => {
    renderTable({ loading: true });
    expect(screen.getByTestId('standard-table-loading')).toBeInTheDocument();
  });

  it('zachowuje stan empty przy braku danych i filtrów', () => {
    renderTable({ data: [], empty: { title: 'Nic tu nie ma' } });
    expect(screen.getByTestId('standard-table-empty')).toBeInTheDocument();
    expect(screen.getByText('Nic tu nie ma')).toBeInTheDocument();
  });
});

// ── R04-2C: empty i loading NIE kasują już nagłówka ────────────────────────

describe('R04-2C · empty i loading zachowują nagłówek i geometrię', () => {
  const emptyReason = () =>
    (document.querySelector('[data-empty-reason]') as HTMLElement | null)?.getAttribute(
      'data-empty-reason'
    );

  it('EMPTY: nagłówek, kolumny i 56 px zostają', () => {
    // Do R04-2C fasada robiła wczesny return i renderowała sam `EmptyState` —
    // nagłówek i geometria znikały całkowicie (wbrew §5).
    renderTable({ data: [], empty: { title: 'Nic tu nie ma' } });

    expect(document.querySelector('table')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Due date')).toBeInTheDocument();
    expect(headerCells().length).toBe(t05Columns.length);
    for (const cell of headerCells()) expect(cell.className).toContain('h-14');
    // …a treść stanu jest w tbody, nie zamiast tabeli.
    expect(screen.getByTestId('standard-table-empty')).toBeInTheDocument();
  });

  it('LOADING: nagłówek i szerokości kolumn zostają', () => {
    renderTable({ loading: true });
    expect(document.querySelector('table')).toBeInTheDocument();
    expect(headerCells().length).toBe(t05Columns.length);
    for (const cell of headerCells()) expect(cell.className).toContain('h-14');
    expect(screen.getByTestId('standard-table-loading')).toBeInTheDocument();
  });

  it('LOADING nie pokazuje starych wierszy', () => {
    renderTable({ loading: true });
    expect(screen.queryByText('Alpha')).toBeNull();
  });

  it('brak danych jest odróżnialny od braku wyników filtracji', () => {
    renderTable({ data: [], empty: { title: 'Nic tu nie ma' } });
    expect(emptyReason()).toBe('no-data');
  });

  it('filtr bez wyników ma własny powód i reset', () => {
    renderTable({
      activeFilters: [{ id: 'status', label: 'Status', value: 'zzz' } as never],
    });
    expect(emptyReason()).toBe('no-filter-results');
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('emptyMessage jako ReactNode trafia do tbody bez kasowania tabeli', () => {
    renderTable({ data: [], emptyMessage: <strong>Własny pusty stan</strong> });
    expect(screen.getByText('Własny pusty stan')).toBeInTheDocument();
    expect(document.querySelector('table')).toBeInTheDocument();
    expect(headerCells().length).toBe(t05Columns.length);
  });

  it('zwykły string nadal działa — API kompatybilne', () => {
    renderTable({ data: [], emptyMessage: 'Pusto' });
    expect(screen.getByText('Pusto')).toBeInTheDocument();
  });

  it('stan error nadal zastępuje tabelę (poza zakresem R04-2C)', () => {
    // Świadome ograniczenie: §5 wymaga dla błędu opisu i Retry, ale nie
    // rozstrzyga, czy nagłówek ma zostać. Zachowanie bez zmian.
    renderTable({ error: 'Coś poszło nie tak', onRetry: vi.fn() });
    expect(screen.getByTestId('standard-table-error')).toBeInTheDocument();
    expect(document.querySelector('table')).toBeNull();
  });
});
