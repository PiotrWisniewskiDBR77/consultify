import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotebookVersionHistory } from '@/components/MyWork/notebook/NotebookVersionHistory';

const versions = [
  {
    id: 'v1',
    pageId: 'p1',
    title: 'Note',
    contentJson: null,
    contentText: 'line one\nline two\nold tail',
    createdAt: '2026-06-18T12:00:00Z',
    createdBy: 'userABCDEFGH',
  },
];

function mockFetchOnce(handler: (url: string, init?: any) => any) {
  (global as any).fetch = vi.fn(handler);
}

describe('NotebookVersionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.localStorage as any).setItem?.('token', 'tok');
  });
  afterEach(() => {
    delete (global as any).fetch;
  });

  it('lists saved versions from the API', async () => {
    mockFetchOnce(async () => ({ ok: true, status: 200, json: async () => ({ data: versions }) }));
    render(<NotebookVersionHistory pageId="p1" currentText="line one\nline two\nnew tail" />);
    expect(await screen.findByText('Version history')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Restore')).toBeInTheDocument());
  });

  it('shows the migration-pending notice on 503', async () => {
    mockFetchOnce(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    render(<NotebookVersionHistory pageId="p1" />);
    expect(await screen.findByText(/migration pending/i)).toBeInTheDocument();
  });

  it('shows the empty state when there are no versions', async () => {
    mockFetchOnce(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }));
    render(<NotebookVersionHistory pageId="p1" />);
    expect(await screen.findByText('No saved versions yet.')).toBeInTheDocument();
  });

  it('renders a diff (added + removed lines) when a version is expanded', async () => {
    mockFetchOnce(async () => ({ ok: true, status: 200, json: async () => ({ data: versions }) }));
    render(<NotebookVersionHistory pageId="p1" currentText={'line one\nline two\nnew tail'} />);
    fireEvent.click(await screen.findByText(/by userABCD/));
    expect(await screen.findByText('Diff vs current')).toBeInTheDocument();
    expect(screen.getByText(/old tail/)).toBeInTheDocument();
  });

  it('restores a version and calls onRestored with the result', async () => {
    const onRestored = vi.fn();
    const restoreResult = {
      pageId: 'p1', restoredFrom: 'v1', backupVersionId: 'b1',
      title: 'Note', contentJson: null, contentText: 'restored body',
    };
    (global as any).fetch = vi.fn(async (url: string, init?: any) => {
      if (init?.method === 'POST') {
        return { ok: true, status: 200, json: async () => ({ data: restoreResult }) };
      }
      return { ok: true, status: 200, json: async () => ({ data: versions }) };
    });
    render(<NotebookVersionHistory pageId="p1" onRestored={onRestored} />);
    fireEvent.click(await screen.findByText('Restore'));
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith(restoreResult));
  });

  it('passes an Authorization header from the stored token', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }));
    (global as any).fetch = fetchSpy;
    render(<NotebookVersionHistory pageId="p1" />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const init = fetchSpy.mock.calls[0][1] as any;
    expect(init.headers.Authorization).toBe('Bearer tok');
  });
});
