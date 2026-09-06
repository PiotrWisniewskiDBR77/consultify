import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { NotebookPage } from '@/types/myWork';

import { NotebookPageListRow } from '../NotebookPageListRow';

// Keep this test decoupled from ConvertToOutputMenu's own heavy dependency
// graph (react-router-dom, Api, conversionService, funnelAnalytics) — it
// already has its own tests; here we only care that IT still gets rendered
// (i.e. the "Convert to output" action survives inside the kebab), not how
// its own dialog flow behaves.
vi.mock('../../ConvertToOutputMenu', () => ({
  ConvertToOutputMenu: () => <div data-testid="convert-to-output-menu-stub" />,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

function buildPage(overrides: Partial<NotebookPage> = {}): NotebookPage {
  return {
    id: 'page-1',
    title: 'Q3 roadmap notes for the executive review',
    projectId: null,
    visibility: 'private',
    tags: ['strategy', 'roadmap', 'q3'],
    contentJson: null,
    contentText: '',
    maturity: 'growing',
    icon: null,
    summary: 'A long description that used to render as a second line under the title.',
    status: 'active',
    pinned: false,
    convertedTo: null,
    ...overrides,
  } as NotebookPage;
}

const noop = () => {};

/**
 * ZLECENIE 1.1-J (DEC-397) — the notebook sidebar row must be a single line:
 * icon, title (ellipsis), relative time, vertical kebab. Everything that used
 * to render as a second/third line (summary, maturity chip, verified/stale
 * badges, upload-source badge, converted-output checkmark, orphan badge,
 * tags) must NOT render on the row — that information still lives in the
 * note's own detail panel, just not duplicated here.
 *
 * Mutation check: restoring `{page.summary && <div>...}</div>` to the row
 * turns the "does NOT render the summary" case below RED.
 */
describe('NotebookPageListRow (zlecenie 1.1-J, DEC-397)', () => {
  it('renders the title, the relative time, and the kebab (aria-label "More")', () => {
    render(
      <NotebookPageListRow
        page={buildPage()}
        isActive={false}
        timeAgo="3h"
        onSelect={noop}
        onTogglePin={noop}
        onStartWorking={noop}
        onArchive={noop}
        onConvertComplete={noop}
      />
    );

    expect(screen.getByText('Q3 roadmap notes for the executive review')).toBeInTheDocument();
    expect(screen.getByText('3h')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('carries the full title as a `title` attribute for the truncated span', () => {
    const fullTitle = 'A very long note title that must ellipsis instead of wrapping the row';
    render(
      <NotebookPageListRow
        page={buildPage({ title: fullTitle })}
        isActive={false}
        timeAgo=""
        onSelect={noop}
        onTogglePin={noop}
        onStartWorking={noop}
        onArchive={noop}
        onConvertComplete={noop}
      />
    );
    expect(screen.getByText(fullTitle)).toHaveAttribute('title', fullTitle);
  });

  it('does NOT render the summary/description line under the title', () => {
    render(
      <NotebookPageListRow
        page={buildPage({ summary: 'This description must not leak into the row.' })}
        isActive={false}
        timeAgo=""
        onSelect={noop}
        onTogglePin={noop}
        onStartWorking={noop}
        onArchive={noop}
        onConvertComplete={noop}
      />
    );

    expect(
      screen.queryByText('This description must not leak into the row.')
    ).not.toBeInTheDocument();
  });

  it('does NOT render former row badges (maturity/tags/orphan) — no plakietki left on the row', () => {
    render(
      <NotebookPageListRow
        page={buildPage({
          maturity: 'actionable',
          convertedTo: [{ type: 'task', id: 'task-1' }],
          tags: ['alpha', 'beta', 'gamma'],
        })}
        isActive={false}
        timeAgo=""
        onSelect={noop}
        onTogglePin={noop}
        onStartWorking={noop}
        onArchive={noop}
        onConvertComplete={noop}
      />
    );

    expect(screen.queryByText('Actionable')).not.toBeInTheDocument();
    expect(screen.queryByText('alpha')).not.toBeInTheDocument();
    expect(screen.queryByText('Unlinked')).not.toBeInTheDocument();
  });

  it('shows a pin icon (not a badge) before the title when the page is pinned', () => {
    render(
      <NotebookPageListRow
        page={buildPage({ pinned: true })}
        isActive={false}
        timeAgo=""
        onSelect={noop}
        onTogglePin={noop}
        onStartWorking={noop}
        onArchive={noop}
        onConvertComplete={noop}
      />
    );
    expect(screen.getByTestId('notebook-row-pin-indicator')).toBeInTheDocument();
  });

  it('clicking the row body calls onSelect', () => {
    const onSelect = vi.fn();
    render(
      <NotebookPageListRow
        page={buildPage()}
        isActive={false}
        timeAgo=""
        onSelect={onSelect}
        onTogglePin={noop}
        onStartWorking={noop}
        onArchive={noop}
        onConvertComplete={noop}
      />
    );
    fireEvent.click(screen.getByText('Q3 roadmap notes for the executive review'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('opens the kebab with exactly the pre-existing hover actions: Convert to output, Pin, Archive (Start working hidden once not inbox)', () => {
    const onTogglePin = vi.fn();
    const onArchive = vi.fn();
    render(
      <NotebookPageListRow
        page={buildPage({ status: 'active' })}
        isActive={false}
        timeAgo=""
        onSelect={noop}
        onTogglePin={onTogglePin}
        onStartWorking={noop}
        onArchive={onArchive}
        onConvertComplete={noop}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'More' }));

    expect(screen.queryByText('Start working')).not.toBeInTheDocument();
    expect(screen.getByTestId('convert-to-output-menu-stub')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Pin'));
    expect(onTogglePin).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByText('Archive'));
    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it('shows "Start working" only for an inbox page, and hides Archive for an already-archived page', () => {
    const { rerender } = render(
      <NotebookPageListRow
        page={buildPage({ status: 'inbox' })}
        isActive={false}
        timeAgo=""
        onSelect={noop}
        onTogglePin={noop}
        onStartWorking={noop}
        onArchive={noop}
        onConvertComplete={noop}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByText('Start working')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();

    rerender(
      <NotebookPageListRow
        page={buildPage({ status: 'archived' })}
        isActive={false}
        timeAgo=""
        onSelect={noop}
        onTogglePin={noop}
        onStartWorking={noop}
        onArchive={noop}
        onConvertComplete={noop}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.queryByText('Start working')).not.toBeInTheDocument();
    expect(screen.queryByText('Archive')).not.toBeInTheDocument();
  });

  it('shows "Unpin" instead of "Pin" once the page is pinned', () => {
    render(
      <NotebookPageListRow
        page={buildPage({ pinned: true, status: 'active' })}
        isActive={false}
        timeAgo=""
        onSelect={noop}
        onTogglePin={noop}
        onStartWorking={noop}
        onArchive={noop}
        onConvertComplete={noop}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByText('Unpin')).toBeInTheDocument();
    expect(screen.queryByText('Pin')).not.toBeInTheDocument();
  });
});
