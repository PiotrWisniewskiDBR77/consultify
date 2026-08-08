/**
 * R04-1 — mechaniki rejestru: Settings2 i selection.
 *
 * Kontrakt: `MY_WORK_TABLE_SURFACE_CONTRACT_V1.md` §5 (Settings2, selection),
 * §9 (kolor), §10 (Selection obowiązkowe tylko przy `bulk`). Liczby z
 * `contracts/tableSurface/canon.ts` (R00/R04-0).
 *
 * ZAKRES: wyłącznie `TableSettingsPopover` i `useTableSelection`. NIE dotyka
 * `FilterableTable`, `StandardTable`, `ResizableTable`, R03, Menu 3 ani kebaba.
 *
 * GRANICA PAKIETU — ważna przy odbiorze: reguły „checkbox header+row tylko przy
 * `selection: 'bulk'`" i „klik checkboxa nie otwiera preview" realizuje RENDER,
 * który mieszka w `FilterableTable` (plik zablokowany cudzą konsolidacją).
 * R04-1 może je egzekwować wyłącznie u ŹRÓDŁA — w hooku — i to tutaj testuje.
 * Dowód na poziomie DOM należy do R04-2.
 */

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CANON_HIT_TARGET, CANON_ICON } from '@/contracts/tableSurface/canon';

import { isAlwaysLockedColumn } from '../ModuleHub/tableSettingsLocks';
import { type TableSettingsColumn, TableSettingsPopover } from '../ModuleHub/TableSettingsPopover';
import { useTableSelection } from '../ModuleHub/useTableSelection';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback ?? _k,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const columns: TableSettingsColumn[] = [
  { id: 'name', label: 'Name', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'owner', label: 'Owner', visible: false },
  { id: 'actions', label: 'Actions', visible: true },
];

function openPopover(props: Partial<React.ComponentProps<typeof TableSettingsPopover>> = {}) {
  const onToggle = vi.fn();
  const onToggleDescription = vi.fn();
  const utils = render(
    <TableSettingsPopover
      columns={columns}
      onToggle={onToggle}
      showDescription={false}
      onToggleDescription={onToggleDescription}
      {...props}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Table settings' }));
  return { ...utils, onToggle, onToggleDescription };
}

const panel = () => screen.getByRole('dialog');
const rowFor = (label: string) => screen.getByText(label).closest('label') as HTMLLabelElement;

// ── Settings2: trigger ─────────────────────────────────────────────────────

describe('R04-1 · Settings2 trigger', () => {
  it('ma kanoniczny cel 32×32 px', () => {
    render(
      <TableSettingsPopover
        columns={columns}
        onToggle={vi.fn()}
        showDescription={false}
        onToggleDescription={vi.fn()}
      />
    );
    const trigger = screen.getByRole('button', { name: 'Table settings' });
    expect(CANON_HIT_TARGET.min).toBe(32);
    // h-8 w-8 = 32 px.
    expect(trigger.className).toContain('h-8');
    expect(trigger.className).toContain('w-8');
  });

  it('ikona ma kanoniczne 16 px', () => {
    render(
      <TableSettingsPopover
        columns={columns}
        onToggle={vi.fn()}
        showDescription={false}
        onToggleDescription={vi.fn()}
      />
    );
    const svg = screen.getByRole('button', { name: 'Table settings' }).querySelector('svg');
    expect(CANON_ICON.default).toBe(16);
    expect(svg?.getAttribute('width')).toBe('16');
  });

  it('deklaruje aria-haspopup i aria-expanded', () => {
    openPopover();
    const trigger = screen.getByRole('button', { name: 'Table settings' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });
});

// ── Settings2: zawartość popovera ──────────────────────────────────────────

describe('R04-1 · popover VISIBLE COLUMNS', () => {
  it('nagłówek grupy kolumn to „Visible columns"', () => {
    openPopover();
    // Klasa nagłówka jest `uppercase`, więc na ekranie czyta się VISIBLE COLUMNS.
    expect(screen.getByText('Visible columns')).toBeInTheDocument();
  });

  it('nagłówek jest renderowany uppercase', () => {
    openPopover();
    expect(screen.getByText('Visible columns').className).toContain('uppercase');
  });

  it('Escape zamyka popover', () => {
    openPopover();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('panel ma rolę dialog i dostępną nazwę', () => {
    openPopover();
    expect(panel().getAttribute('aria-label')).toBe('Table settings');
  });
});

// ── Settings2: kolumny zawsze zablokowane ──────────────────────────────────

describe('R04-1 · identifier i Actions ZAWSZE locked', () => {
  it('rozpoznaje kolumnę identyfikującą po pozycji, a Actions po id', () => {
    expect(isAlwaysLockedColumn('name', 0)).toBe(true);
    expect(isAlwaysLockedColumn('actions', 3)).toBe(true);
    expect(isAlwaysLockedColumn('rowActions', 2)).toBe(true);
    expect(isAlwaysLockedColumn('status', 1)).toBe(false);
  });

  it('pierwsza kolumna jest wyłączona, choć ekran NIE podał required', () => {
    openPopover();
    const checkbox = rowFor('Name').querySelector('input') as HTMLInputElement;
    expect(checkbox).toBeDisabled();
    expect(rowFor('Name').textContent).toContain('Locked');
  });

  it('kolumna Actions jest wyłączona, choć ekran NIE podał required', () => {
    openPopover();
    const checkbox = rowFor('Actions').querySelector('input') as HTMLInputElement;
    expect(checkbox).toBeDisabled();
    expect(rowFor('Actions').textContent).toContain('Locked');
  });

  it('klik w zablokowaną kolumnę NIE woła onToggle', () => {
    const { onToggle } = openPopover();
    fireEvent.click(rowFor('Name').querySelector('input') as HTMLInputElement);
    fireEvent.click(rowFor('Actions').querySelector('input') as HTMLInputElement);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('zwykła kolumna nadal się przełącza', () => {
    const { onToggle } = openPopover();
    fireEvent.click(rowFor('Status').querySelector('input') as HTMLInputElement);
    expect(onToggle).toHaveBeenCalledWith('status', false);
  });
});

// ── Settings2: „Show row description" zawsze ostatni ───────────────────────

describe('R04-1 · Show row description jest OSTATNI', () => {
  const lastRow = () => {
    const rows = [...panel().querySelectorAll('label, button')];
    return rows[rows.length - 1] as HTMLElement;
  };

  it('bez onReset — jest ostatnim elementem', () => {
    openPopover();
    expect(lastRow().getAttribute('data-settings-row')).toBe('description');
  });

  it('Z onReset — nadal jest ostatni, PO przycisku resetu', () => {
    // To był realny defekt: kolejność zależała od tego, czy ekran podał
    // `onReset`. Dwa ekrany, dwa układy tego samego popovera.
    openPopover({ onReset: vi.fn(), resetLabel: 'Reset columns' });
    expect(screen.getByText('Reset columns')).toBeInTheDocument();
    expect(lastRow().getAttribute('data-settings-row')).toBe('description');
  });

  it('przełącznik opisu działa', () => {
    const { onToggleDescription } = openPopover();
    fireEvent.click(rowFor('Show row description').querySelector('input') as HTMLInputElement);
    expect(onToggleDescription).toHaveBeenCalledWith(true);
  });
});

// ── Settings2: kolor ───────────────────────────────────────────────────────

describe('R04-1 · brak crimsona w popoverze (§9)', () => {
  it('wiersze nie używają tintu akcentu na hover', () => {
    openPopover({ onReset: vi.fn() });
    // `c-accent-soft` to tint crimsona — plik sam to dokumentuje przy triggerze,
    // ale wiersze, strzałki i reset nadal go używały.
    expect(panel().innerHTML).not.toContain('c-accent-soft');
  });

  it('hover jest neutralny', () => {
    openPopover();
    expect(rowFor('Status').className).toContain('hover:bg-state-hover');
  });
});

// ── Selection: tryb wg deskryptora ─────────────────────────────────────────

describe('R04-1 · selection wg capability', () => {
  const ids = ['a', 'b', 'c'];

  it('domyślnie działa jak dotąd (bulk) — API bez zmian', () => {
    const { result } = renderHook(() => useTableSelection(ids));
    act(() => result.current.toggleRow('a'));
    expect(result.current.count).toBe(1);
    expect(result.current.selectionProp.selectedIds.has('a')).toBe(true);
  });

  it('selection: none — toggleRow jest no-opem', () => {
    const { result } = renderHook(() => useTableSelection(ids, { mode: 'none' }));
    act(() => result.current.toggleRow('a'));
    expect(result.current.count).toBe(0);
  });

  it('selection: none — toggleAll jest no-opem', () => {
    const { result } = renderHook(() => useTableSelection(ids, { mode: 'none' }));
    act(() => result.current.toggleAll());
    expect(result.current.count).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
  });

  it('selection: bulk — toggleAll zaznacza wszystkie widoczne', () => {
    const { result } = renderHook(() => useTableSelection(ids));
    act(() => result.current.toggleAll());
    expect(result.current.count).toBe(3);
    expect(result.current.isAllSelected).toBe(true);
  });

  it('stan pośredni pojawia się przy częściowym zaznaczeniu', () => {
    const { result } = renderHook(() => useTableSelection(ids));
    act(() => result.current.toggleRow('a'));
    expect(result.current.isIndeterminate).toBe(true);
    expect(result.current.isAllSelected).toBe(false);
  });

  it('clear zeruje zaznaczenie', () => {
    const { result } = renderHook(() => useTableSelection(ids));
    act(() => result.current.toggleAll());
    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
  });

  it('selectionProp niesie etykiety dostępności dla obu checkboxów', () => {
    const { result } = renderHook(() => useTableSelection(ids));
    expect(result.current.selectionProp.selectRowLabel).toBe('Select row');
    expect(result.current.selectionProp.selectAllLabel).toBe('Select all');
  });

  it('publiczne API zachowuje komplet pól — brak regresji dla 2 konsumentów', () => {
    const { result } = renderHook(() => useTableSelection(ids));
    for (const key of [
      'selectedIds',
      'count',
      'toggleRow',
      'toggleAll',
      'clear',
      'isAllSelected',
      'isIndeterminate',
      'selectionProp',
      'runBulk',
    ]) {
      expect(result.current).toHaveProperty(key);
    }
  });
});
