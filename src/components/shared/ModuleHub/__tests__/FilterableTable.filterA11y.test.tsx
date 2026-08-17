/**
 * @vitest-environment jsdom
 *
 * CB-01 / RV-009 & RV-020 — the shared column-filter dropdown (used by
 * StandardTable → FilterableTable across Tasks, Decisions, Interview,
 * Initiatives, Meeting and Execution) must expose what it filters, its
 * current active state, and stay keyboard-operable (Escape closes and
 * returns focus).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRealT } from '@/test-utils/realTranslations';

// This generic passthrough mock ignores the KEY and just interpolates
// whatever default string the call site passes — since FilterableTable's
// default strings are themselves the English text, this exercises EN only,
// regardless of "language". Kept for the EN-focused suite below; the PL
// suite further down mocks real translations via `createRealT('pl')`
// instead, so it fails if the Polish string is actually missing or wrong.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultOrOpts?: any, maybeOpts?: any) => {
      const opts =
        typeof maybeOpts === 'object'
          ? maybeOpts
          : typeof defaultOrOpts === 'object'
            ? defaultOrOpts
            : undefined;
      const fallback =
        typeof defaultOrOpts === 'string' ? defaultOrOpts : (opts?.defaultValue ?? key);
      if (!opts) return fallback;
      return Object.keys(opts).reduce(
        (str, k) => str.replace(`{{${k}}}`, String(opts[k])),
        fallback
      );
    },
  }),
}));

import { FilterableTable, type TableColumn } from '../FilterableTable';

const COLUMNS: TableColumn[] = [
  { id: 'title', label: 'Title' },
  {
    id: 'status',
    label: 'Status',
    filterable: true,
    filterOptions: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ],
  },
];

const DATA = [{ id: 'row-1', title: 'Row one', status: 'open' }];

const renderTable = (activeFilters: Array<{ column: string; value: string }> = []) =>
  render(
    <FilterableTable
      columns={COLUMNS}
      data={DATA}
      activeFilters={activeFilters.map((f, i) => ({
        id: `${f.column}-${i}`,
        column: f.column,
        value: f.value,
        label: f.value,
      }))}
      onFilterChange={vi.fn()}
    />
  );

describe('FilterableTable — shared column-filter accessible contract', () => {
  it('keeps an interactive row keyboard-operable without an invalid button role', () => {
    const onRowClick = vi.fn();
    render(
      <FilterableTable
        columns={COLUMNS}
        data={DATA}
        activeFilters={[]}
        onFilterChange={vi.fn()}
        onRowClick={onRowClick}
      />
    );

    const row = screen.getByText('Row one').closest('tr');
    expect(row).toHaveAttribute('tabindex', '0');
    expect(row).not.toHaveAttribute('role', 'button');
    fireEvent.keyDown(row!, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledWith(DATA[0]);
  });

  it('names the filter trigger with the column and communicates no active filter', () => {
    renderTable();
    expect(
      screen.getByRole('button', { name: /Filter Status, no filter applied/i })
    ).toBeInTheDocument();
  });

  it('communicates the active count once a filter is applied', () => {
    renderTable([{ column: 'status', value: 'open' }]);
    expect(
      screen.getByRole('button', { name: /Filter Status \(active: 1\)/i })
    ).toBeInTheDocument();
  });

  it('exposes aria-expanded and opens a labelled group on activation', () => {
    renderTable();
    const trigger = screen.getByRole('button', { name: /Filter Status, no filter applied/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('group', { name: /Filter by Status/i })).toBeInTheDocument();
  });

  it('Escape closes the panel and returns focus to the trigger', async () => {
    renderTable();
    const trigger = screen.getByRole('button', { name: /Filter Status, no filter applied/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('group', { name: /Filter by Status/i })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('group', { name: /Filter by Status/i })).not.toBeInTheDocument()
    );
    expect(trigger).toHaveFocus();
  });

  // CODEX pass 2 — this is a non-modal disclosure popover, not a dialog: Tab
  // must be free to move focus out of it (never trapped), and once focus
  // actually leaves the panel the popover closes on its own instead of
  // staying open with focus elsewhere on the page.
  it('does not trap Tab: pressing Tab inside the panel is not intercepted', () => {
    renderTable();
    const trigger = screen.getByRole('button', { name: /Filter Status, no filter applied/i });
    fireEvent.click(trigger);
    const group = screen.getByRole('group', { name: /Filter by Status/i });
    const openCheckbox = screen.getByRole('checkbox', { name: 'Open' });
    openCheckbox.focus();

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    const prevented = !document.dispatchEvent(tabEvent);

    // The popover's own handler must never preventDefault a plain Tab — focus
    // is left exactly where the browser's normal tab order would put it.
    expect(prevented).toBe(false);
    expect(openCheckbox).toHaveFocus();
    expect(group).toBeInTheDocument();
  });

  it('closes the panel once focus leaves it (Tab out), without forcing focus back', () => {
    renderTable();
    const trigger = screen.getByRole('button', { name: /Filter Status, no filter applied/i });
    fireEvent.click(trigger);
    const group = screen.getByRole('group', { name: /Filter by Status/i });
    const openCheckbox = screen.getByRole('checkbox', { name: 'Open' });
    openCheckbox.focus();

    const outsideTarget = document.createElement('button');
    document.body.appendChild(outsideTarget);
    fireEvent.blur(openCheckbox, { relatedTarget: outsideTarget });
    outsideTarget.focus();

    expect(screen.queryByRole('group', { name: /Filter by Status/i })).not.toBeInTheDocument();
    // Focus was left on the element the browser actually moved it to — the
    // popover does not fight that by pulling focus back to the trigger.
    expect(outsideTarget).toHaveFocus();
    document.body.removeChild(outsideTarget);
    void group;
  });

  it('moving focus between two controls inside the panel does not close it', () => {
    renderTable();
    const trigger = screen.getByRole('button', { name: /Filter Status, no filter applied/i });
    fireEvent.click(trigger);
    const openCheckbox = screen.getByRole('checkbox', { name: 'Open' });
    const closedCheckbox = screen.getByRole('checkbox', { name: 'Closed' });
    openCheckbox.focus();

    fireEvent.blur(openCheckbox, { relatedTarget: closedCheckbox });
    closedCheckbox.focus();

    expect(screen.getByRole('group', { name: /Filter by Status/i })).toBeInTheDocument();
  });
});

// Real-Polish suite: dynamically re-imports FilterableTable under a
// `vi.doMock` that resolves `t()` against the actual shipped
// `public/locales/pl/translation.json` (via `createRealT`), so these tests
// fail if the Polish filter strings are ever missing or wrong — the static
// mock above cannot catch that since it never resolves real dictionaries.
describe('FilterableTable — shared column-filter accessible contract (real PL)', () => {
  let FilterableTablePl: typeof import('../FilterableTable');

  beforeEach(async () => {
    vi.resetModules();
    const t = createRealT('pl');
    vi.doMock('react-i18next', () => ({
      useTranslation: () => ({ t, i18n: { language: 'pl' } }),
    }));
    FilterableTablePl = await import('../FilterableTable');
  });

  const renderTablePl = (activeFilters: Array<{ column: string; value: string }> = []) =>
    render(
      <FilterableTablePl.FilterableTable
        columns={COLUMNS}
        data={DATA}
        activeFilters={activeFilters.map((f, i) => ({
          id: `${f.column}-${i}`,
          column: f.column,
          value: f.value,
          label: f.value,
        }))}
        onFilterChange={vi.fn()}
      />
    );

  it('names the filter trigger in real Polish, no active filter', () => {
    renderTablePl();

    // Real PL string: common.filterColumnInactive = "Filtruj {{column}}, brak aktywnego filtra"
    expect(
      screen.getByRole('button', { name: 'Filtruj Status, brak aktywnego filtra' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Filter Status, no filter applied/i })
    ).not.toBeInTheDocument();
  });

  it('communicates the active count in real Polish', () => {
    renderTablePl([{ column: 'status', value: 'open' }]);

    // Real PL string: common.filterColumnActive = "Filtruj {{column}} (aktywny: {{count}})"
    expect(screen.getByRole('button', { name: 'Filtruj Status (aktywny: 1)' })).toBeInTheDocument();
  });

  it('opens a group labelled in real Polish and Escape closes it, returning focus', async () => {
    renderTablePl();
    const trigger = screen.getByRole('button', { name: 'Filtruj Status, brak aktywnego filtra' });
    fireEvent.click(trigger);

    // Real PL string: common.filterByColumn = "Filtruj wg {{column}}"
    expect(screen.getByRole('group', { name: 'Filtruj wg Status' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Filtruj wg Status' })).not.toBeInTheDocument()
    );
    expect(trigger).toHaveFocus();
  });
});
