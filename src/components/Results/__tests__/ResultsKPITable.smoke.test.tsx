/**
 * @vitest-environment jsdom
 *
 * Smoke tests for ResultsKPITable (Module 15 Results — KPI table surface).
 *
 * Verifies the canon §27 refactor (M15/L-07): the hand-rolled <table> +
 * ColumnFilterDropdown + manual sort were replaced by the shared, canonical
 * FilterableTable. Asserts:
 *  - KPI rows render as canonical table cells (name, initiative, owner text)
 *  - a column header filter (Status) narrows the visible rows
 *
 * Mocking mirrors RolloutTab.smoke.test.tsx — react-i18next is mocked with a
 * defaultValue passthrough so `t(key, 'Default')` returns the default string.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: any) => {
      if (typeof opts === 'string') return opts;
      if (opts?.defaultValue) return String(opts.defaultValue);
      return k;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

import { mapResultsKpis, type ResultsKPI } from '../kpiDomain';
import { ResultsKPITable } from '../ResultsKPITable';

// Minimal ResultsKPI factory — only the fields the table reads.
const makeKpi = (over: Partial<ResultsKPI> & { id: string; name: string }): ResultsKPI =>
  ({
    baselineValue: 0,
    targetValue: 100,
    latestValue: 50,
    unit: '%',
    status: 'on-target',
    trend: 'up',
    measurementFrequency: 'MONTHLY',
    needsEntry: false,
    ownerName: 'Ada Lovelace',
    initiativeName: 'Initiative Alpha',
    createdAt: new Date().toISOString(),
    ...over,
  }) as ResultsKPI;

const KPIS: ResultsKPI[] = [
  makeKpi({ id: 'k1', name: 'On-time delivery', status: 'on-target' }),
  makeKpi({
    id: 'k2',
    name: 'Defect rate',
    status: 'below',
    ownerName: 'Grace Hopper',
    initiativeName: 'Initiative Beta',
  }),
];

const Harness: React.FC<{ kpis: ResultsKPI[] }> = ({ kpis }) => {
  const [filters, setFilters] = React.useState<any[]>([]);
  return (
    <ResultsKPITable
      kpis={kpis}
      activeFilters={filters}
      onFilterChange={setFilters}
      onRowClick={() => {}}
      onRowAction={() => {}}
    />
  );
};

describe('ResultsKPITable smoke (canon §27)', () => {
  it('renders KPI rows as canonical FilterableTable cells', () => {
    render(<Harness kpis={KPIS} />);

    // One real <table> (the canonical FilterableTable), not the hand-rolled one.
    expect(screen.getAllByRole('table')).toHaveLength(1);

    // KPI names + owners + initiatives render as cell text.
    expect(screen.getByText('On-time delivery')).toBeInTheDocument();
    expect(screen.getByText('Defect rate')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Initiative Beta')).toBeInTheDocument();
  });

  it('narrows rows when a column (Status) filter is applied', () => {
    render(<Harness kpis={KPIS} />);

    // Both rows visible before filtering.
    expect(screen.getByText('On-time delivery')).toBeInTheDocument();
    expect(screen.getByText('Defect rate')).toBeInTheDocument();

    // Open the Status column filter dropdown. The Status header cell carries the
    // canonical ChevronDown filter trigger next to its label.
    const statusHeader = screen.getByText('Status').closest('th') as HTMLElement;
    fireEvent.click(within(statusHeader).getByRole('button'));

    // Tick "Below Target" and Apply → only the below-target KPI remains.
    fireEvent.click(screen.getByLabelText('Below Target', { selector: 'input' }));
    fireEvent.click(screen.getByText('Apply'));

    expect(screen.getByText('Defect rate')).toBeInTheDocument();
    expect(screen.queryByText('On-time delivery')).not.toBeInTheDocument();
  });

  it('reorders visible rows when sort-by-name is toggled (asc then desc)', () => {
    render(<Harness kpis={KPIS} />);

    // Helper: KPI names in true DOM order, read off the table body rows.
    const KNOWN = ['On-time delivery', 'Defect rate'];
    const nameOrder = () => {
      const table = screen.getByRole('table');
      const tbody = table.querySelector('tbody') as HTMLElement;
      return Array.from(tbody.querySelectorAll('tr'))
        .map((tr) => KNOWN.find((n) => tr.textContent?.includes(n)))
        .filter((n): n is string => Boolean(n));
    };

    // The sort control sits in a group labelled "Sort by". Each sortable column
    // is a button whose visible text is the column label ("Name").
    const sortGroup = screen.getByRole('group', { name: 'Sort by' });
    const sortByName = within(sortGroup)
      .getAllByRole('button')
      .find((b) => b.textContent?.trim().startsWith('Name')) as HTMLElement;
    expect(sortByName).toBeTruthy();

    // Default (unsorted) order = input order: On-time delivery, Defect rate.
    expect(nameOrder()).toEqual(['On-time delivery', 'Defect rate']);

    // Ascending → alphabetical: Defect rate, On-time delivery.
    fireEvent.click(sortByName);
    expect(sortByName).toHaveAttribute('aria-pressed', 'true');
    expect(nameOrder()).toEqual(['Defect rate', 'On-time delivery']);

    // Toggle same column → descending: order flips back.
    fireEvent.click(sortByName);
    expect(nameOrder()).toEqual(['On-time delivery', 'Defect rate']);
  });
});

describe('ResultsKPITable badge — RES-004 backend status is the single source of truth', () => {
  // Full pipeline: raw backend-shaped payload (as /results/kpis/catalog
  // returns it) -> mapResultsKpis (real derivation, not a hand-set `status`)
  // -> mounted table -> rendered badge. Catches a regression where the
  // frontend goes back to recomputing its own status instead of reading
  // evalStatus.
  const rawKpi = (over: Record<string, unknown>) => ({
    id: 'k1',
    name: 'Backend-driven KPI',
    latestValue: 70,
    isOnTarget: true, // deliberately WRONG/stale — evalStatus must win, not this
    ...over,
  });

  it('a GREEN backend status renders the On Target badge (green success)', () => {
    const kpis = mapResultsKpis([rawKpi({ evalStatus: 'GREEN' })], []);
    render(<Harness kpis={kpis} />);

    const badgeText = screen.getByText('On Target');
    expect(badgeText).toBeInTheDocument();
    expect(badgeText.className).toContain('text-c-success');
  });

  it('UNCONFIGURED backend status never renders a green success badge', () => {
    const kpis = mapResultsKpis([rawKpi({ evalStatus: 'UNCONFIGURED', isOnTarget: false })], []);
    render(<Harness kpis={kpis} />);

    // Fail-closed: UNCONFIGURED must read as "Below Target", not "On Target",
    // and must never carry the success (text-c-success) styling.
    expect(screen.getByText('Below Target')).toBeInTheDocument();
    expect(screen.queryByText('On Target')).not.toBeInTheDocument();
    expect(screen.getByText('Below Target').className).not.toContain('text-c-success');
  });
});
