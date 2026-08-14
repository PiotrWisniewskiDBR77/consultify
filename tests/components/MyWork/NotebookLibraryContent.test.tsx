import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getNotebooks = vi.fn();
const createNotebook = vi.fn();
const updateNotebook = vi.fn();
const deleteNotebook = vi.fn();
const getTeams = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    getNotebooks: (...a: any[]) => getNotebooks(...a),
    createNotebook: (...a: any[]) => createNotebook(...a),
    updateNotebook: (...a: any[]) => updateNotebook(...a),
    deleteNotebook: (...a: any[]) => deleteNotebook(...a),
    getTeams: (...a: any[]) => getTeams(...a),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (sel: any) => sel({ currentUser: { id: 'userA' } }),
}));

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { error: (...a: any[]) => toastError(...a), success: vi.fn() },
}));

import { NotebookLibraryContent } from '@/components/MyWork/NotebookLibraryContent';

const sampleNotebooks = [
  {
    id: 'nb1',
    ownerUserId: 'userA',
    organizationId: 'org1',
    title: 'Strategy 2026',
    icon: '📓',
    scope: 'personal',
    teamId: null,
    contextSharing: 'private',
    pageCount: 3,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-02T00:00:00Z',
  },
  {
    id: 'nb2',
    ownerUserId: 'userB',
    organizationId: 'org1',
    title: 'Client Insights',
    icon: '🔍',
    scope: 'team',
    teamId: 'teamX',
    contextSharing: 'org_context',
    pageCount: 7,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-20T00:00:00Z',
  },
];

describe('NotebookLibraryContent (App Table)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNotebooks.mockResolvedValue(sampleNotebooks);
  });

  it('renders notebooks as table rows with scope and context chips', async () => {
    render(<NotebookLibraryContent onOpenNotebook={vi.fn()} />);

    expect(await screen.findByText('Strategy 2026')).toBeInTheDocument();
    expect(screen.getByText('Client Insights')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Org context')).toBeInTheDocument();
  });

  it('opens a notebook on row click', async () => {
    const onOpen = vi.fn();
    render(<NotebookLibraryContent onOpenNotebook={onOpen} />);

    fireEvent.click(await screen.findByText('Strategy 2026'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'nb1' }));
  });

  it('shows an empty state when there are no notebooks', async () => {
    getNotebooks.mockResolvedValueOnce([]);
    render(<NotebookLibraryContent onOpenNotebook={vi.fn()} />);

    expect(await screen.findByText('No notebooks yet')).toBeInTheDocument();
  });

  it('opens the create modal when the Menu 2 createRequestId changes, then creates + opens', async () => {
    const onOpen = vi.fn();
    const created = { ...sampleNotebooks[0], id: 'nb-new', title: 'Fresh' };
    createNotebook.mockResolvedValueOnce(created);

    const { rerender } = render(
      <NotebookLibraryContent onOpenNotebook={onOpen} createRequestId={0} />
    );
    await screen.findByText('Strategy 2026');

    // Menu 2 "New notebook" CTA increments the request id.
    rerender(<NotebookLibraryContent onOpenNotebook={onOpen} createRequestId={1} />);

    const input = await screen.findByPlaceholderText('e.g. Strategy 2026');
    fireEvent.change(input, { target: { value: 'Fresh' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() =>
      expect(createNotebook).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Fresh', scope: 'personal', contextSharing: 'private' })
      )
    );
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'nb-new' }));
  });

  it('surfaces the real server reason when saving fails (U9)', async () => {
    // handleResponse throws an Error whose message is the server's { error } text.
    createNotebook.mockRejectedValueOnce(new Error('Only the owner can modify this notebook'));

    const { rerender } = render(<NotebookLibraryContent onOpenNotebook={vi.fn()} createRequestId={0} />);
    await screen.findByText('Strategy 2026');
    rerender(<NotebookLibraryContent onOpenNotebook={vi.fn()} createRequestId={1} />);

    const input = await screen.findByPlaceholderText('e.g. Strategy 2026');
    fireEvent.change(input, { target: { value: 'Fresh' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining('Only the owner can modify this notebook')
      )
    );
  });

  it('hides a useless generic error and shows only the fallback (U9)', async () => {
    createNotebook.mockRejectedValueOnce(new Error('Failed to fetch'));

    const { rerender } = render(<NotebookLibraryContent onOpenNotebook={vi.fn()} createRequestId={0} />);
    await screen.findByText('Strategy 2026');
    rerender(<NotebookLibraryContent onOpenNotebook={vi.fn()} createRequestId={1} />);

    const input = await screen.findByPlaceholderText('e.g. Strategy 2026');
    fireEvent.change(input, { target: { value: 'Fresh' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    // No leaked "Failed to fetch", no ": " separator appended — just the clean fallback.
    expect(toastError).toHaveBeenLastCalledWith('Failed to create notebook');
  });
});
