import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotebookSearchDialog } from '../NotebookSearchDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
}));

const notebookSemanticSearch = vi.fn();
vi.mock('@/services/api', () => ({
  Api: {
    notebookSemanticSearch: (...args: unknown[]) => notebookSemanticSearch(...args),
  },
}));

// MYW-NBK-004: Api.notebookSemanticSearch (GET /notebook/search) already
// existed with zero UI consumers. This locks the new dialog's real wiring —
// query in, real API call, results rendered, click-through opens the page,
// keyboard operable, closes cleanly.
describe('NotebookSearchDialog (MYW-NBK-004)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    notebookSemanticSearch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when closed', () => {
    render(<NotebookSearchDialog open={false} onClose={vi.fn()} onOpenPage={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a prompt before any query is typed, and never calls the API for an empty query', () => {
    render(<NotebookSearchDialog open onClose={vi.fn()} onOpenPage={vi.fn()} />);
    expect(screen.getByText('Type to search across every notebook')).toBeInTheDocument();
    expect(notebookSemanticSearch).not.toHaveBeenCalled();
  });

  it('debounces typing and calls Api.notebookSemanticSearch with the trimmed query', async () => {
    notebookSemanticSearch.mockResolvedValue({ results: [], total: 0 });
    render(<NotebookSearchDialog open onClose={vi.fn()} onOpenPage={vi.fn()} />);

    fireEvent.change(screen.getByTestId('notebook-search-dialog-input'), {
      target: { value: 'roadmap ' },
    });

    expect(notebookSemanticSearch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(notebookSemanticSearch).toHaveBeenCalledWith('roadmap', { limit: 20 });
  });

  it('renders real results with title and snippet, and opens the chosen page on click', async () => {
    notebookSemanticSearch.mockResolvedValue({
      results: [
        { pageId: 'page-1', title: 'Q3 roadmap', snippet: 'Ship the roadmap by Q3…', score: 0.9, matchType: 'title' },
        { pageId: 'page-2', title: 'Roadmap risks', snippet: 'Key risks to the roadmap…', score: 0.7, matchType: 'content' },
      ],
      total: 2,
    });
    const onOpenPage = vi.fn();
    const onClose = vi.fn();
    render(<NotebookSearchDialog open onClose={onClose} onOpenPage={onOpenPage} />);

    fireEvent.change(screen.getByTestId('notebook-search-dialog-input'), {
      target: { value: 'roadmap' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getAllByTestId('notebook-search-dialog-result')).toHaveLength(2);
    expect(screen.getByText('Q3 roadmap')).toBeInTheDocument();
    expect(screen.getByText('Ship the roadmap by Q3…')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Roadmap risks'));

    expect(onOpenPage).toHaveBeenCalledWith('page-2');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a real empty state when the query matches nothing', async () => {
    notebookSemanticSearch.mockResolvedValue({ results: [], total: 0 });
    render(<NotebookSearchDialog open onClose={vi.fn()} onOpenPage={vi.fn()} />);

    fireEvent.change(screen.getByTestId('notebook-search-dialog-input'), {
      target: { value: 'nothing matches this' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByTestId('notebook-search-dialog-empty')).toBeInTheDocument();
  });

  it('surfaces a real error state instead of a silently empty list when the API rejects', async () => {
    notebookSemanticSearch.mockRejectedValue(new Error('boom'));
    render(<NotebookSearchDialog open onClose={vi.fn()} onOpenPage={vi.fn()} />);

    fireEvent.change(screen.getByTestId('notebook-search-dialog-input'), {
      target: { value: 'roadmap' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Search failed');
  });

  it('closes on Escape without invoking onOpenPage', () => {
    const onClose = vi.fn();
    const onOpenPage = vi.fn();
    render(<NotebookSearchDialog open onClose={onClose} onOpenPage={onOpenPage} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenPage).not.toHaveBeenCalled();
  });

  it('supports ArrowDown/Enter to open a result without the mouse', async () => {
    notebookSemanticSearch.mockResolvedValue({
      results: [
        { pageId: 'page-1', title: 'First', snippet: '', score: 0.9, matchType: 'title' },
        { pageId: 'page-2', title: 'Second', snippet: '', score: 0.8, matchType: 'title' },
      ],
      total: 2,
    });
    const onOpenPage = vi.fn();
    render(<NotebookSearchDialog open onClose={vi.fn()} onOpenPage={onOpenPage} />);

    fireEvent.change(screen.getByTestId('notebook-search-dialog-input'), {
      target: { value: 'x' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(screen.getAllByTestId('notebook-search-dialog-result')).toHaveLength(2);

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    fireEvent.keyDown(dialog, { key: 'Enter' });

    expect(onOpenPage).toHaveBeenCalledWith('page-2');
  });
});
