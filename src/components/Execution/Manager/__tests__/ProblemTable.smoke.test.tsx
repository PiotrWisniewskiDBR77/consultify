/**
 * @vitest-environment jsdom
 *
 * Smoke tests for ProblemTable (Module 14 Manager — canon §27 refactor, L-06).
 *
 * Verifies the raw-<table> → shared FilterableTable conversion preserves all
 * existing behavior:
 *  - rows render as READ-ONLY canonical cells (text, not <input>s)
 *  - the severity column-header filter narrows the visible rows
 *  - row-click selects (onSelect), double-click opens (onDoubleClick)
 *  - the kebab exposes the row's triage actions + "Otwórz podgląd" and they fire
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: any) => (typeof fallback === 'string' ? fallback : k),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

import { ProblemTable } from '../ProblemTable';
import type { ManagerProblemRow } from '../types';

const makeRow = (over: Partial<ManagerProblemRow>): ManagerProblemRow => ({
  id: 'r1',
  severity: 'info',
  problemType: 'stale_item',
  title: 'Untitled problem',
  rootCause: 'root cause',
  sourceEntityType: 'TASK',
  sourceEntityId: 's1',
  sourceEntityName: 'Source A',
  ownerId: null,
  ownerName: null,
  daysOverdue: null,
  impactCount: 0,
  affectedEntities: [],
  actions: [],
  meta: {},
  ...over,
});

const rows: ManagerProblemRow[] = [
  makeRow({
    id: 'crit-1',
    severity: 'critical',
    problemType: 'blocked_task',
    title: 'Critical blocker',
    actions: [{ id: 'unblock', label: 'Unblock now', variant: 'primary' }],
  }),
  makeRow({ id: 'info-1', severity: 'info', title: 'Informational note' }),
];

const noop = () => {};

afterEach(() => vi.clearAllMocks());

describe('ProblemTable smoke (canon §27)', () => {
  it('renders rows as read-only canonical cells (text, not inputs)', () => {
    render(<ProblemTable rows={rows} selectedId={null} onSelect={noop} onAction={noop} />);
    expect(screen.getByText('Critical blocker')).toBeInTheDocument();
    expect(screen.getByText('Informational note')).toBeInTheDocument();
    // Read-only: titles are plain text, never editable inputs.
    expect(screen.queryByDisplayValue('Critical blocker')).not.toBeInTheDocument();
    expect(document.querySelectorAll('input[type="text"]').length).toBe(0);
  });

  it('renders the empty state when there are no rows', () => {
    render(
      <ProblemTable
        rows={[]}
        selectedId={null}
        onSelect={noop}
        onAction={noop}
        emptyMessage="Nothing to triage"
      />
    );
    expect(screen.getByText('Nothing to triage')).toBeInTheDocument();
  });

  it('severity column-header filter narrows the visible rows', async () => {
    render(<ProblemTable rows={rows} selectedId={null} onSelect={noop} onAction={noop} />);
    // Both rows visible initially.
    expect(screen.getByText('Critical blocker')).toBeInTheDocument();
    expect(screen.getByText('Informational note')).toBeInTheDocument();

    // Open the severity header filter dropdown (the ChevronDown next to the label).
    const severityHeader = screen.getByText('Severity').closest('th') as HTMLElement;
    fireEvent.click(within(severityHeader).getByRole('button'));

    // Tick "Critical" and apply.
    fireEvent.click(await screen.findByLabelText('Critical'));
    fireEvent.click(screen.getByText('Apply'));

    await waitFor(() => {
      expect(screen.queryByText('Informational note')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Critical blocker')).toBeInTheDocument();
  });

  it('row click selects and double-click opens', () => {
    const onSelect = vi.fn();
    const onDoubleClick = vi.fn();
    render(
      <ProblemTable
        rows={rows}
        selectedId={null}
        onSelect={onSelect}
        onDoubleClick={onDoubleClick}
        onAction={noop}
      />
    );
    const cell = screen.getByText('Critical blocker');
    fireEvent.click(cell);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'crit-1' }));

    fireEvent.doubleClick(cell);
    expect(onDoubleClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'crit-1' }));
  });

  it('free-text search narrows the visible rows (in-component pre-filter)', async () => {
    render(<ProblemTable rows={rows} selectedId={null} onSelect={noop} onAction={noop} />);
    // Both rows visible initially.
    expect(screen.getByText('Critical blocker')).toBeInTheDocument();
    expect(screen.getByText('Informational note')).toBeInTheDocument();

    // Open the search box and type a query that only matches the critical row.
    fireEvent.click(screen.getByLabelText('Search...'));
    fireEvent.change(await screen.findByPlaceholderText('Search...'), {
      target: { value: 'blocker' },
    });

    await waitFor(() => {
      expect(screen.queryByText('Informational note')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Critical blocker')).toBeInTheDocument();
  });

  it('per-severity count badges reflect the data', () => {
    render(<ProblemTable rows={rows} selectedId={null} onSelect={noop} onAction={noop} />);
    // rows = 1 critical, 0 warning, 1 info.
    expect(screen.getByTestId('severity-count-critical')).toHaveTextContent('1');
    expect(screen.getByTestId('severity-count-warning')).toHaveTextContent('0');
    expect(screen.getByTestId('severity-count-info')).toHaveTextContent('1');
  });

  it('kebab exposes the row triage action and fires onAction', async () => {
    const onAction = vi.fn();
    render(<ProblemTable rows={rows} selectedId={null} onSelect={noop} onAction={onAction} />);
    // Open the first row's kebab.
    fireEvent.click(screen.getAllByLabelText('Row actions')[0]);
    fireEvent.click(await screen.findByText('Unblock now'));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crit-1' }),
      expect.objectContaining({ id: 'unblock' })
    );
  });
});
