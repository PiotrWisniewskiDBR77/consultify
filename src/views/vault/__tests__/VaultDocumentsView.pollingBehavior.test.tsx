import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  getKnowledgeDocuments: vi.fn(),
  getMyProjectMemberships: vi.fn().mockResolvedValue([]),
  getVaultFolders: vi.fn().mockRejectedValue(new Error('folders unavailable')),
}));

vi.mock('@/services/api', () => ({ Api: apiMocks }));
vi.mock('@/components/shared/HubBarSlots', () => ({ useHubBarSlot: vi.fn() }));
vi.mock('@/components/shared/RowActionsMenu', () => ({ RowActionsMenu: () => null }));
vi.mock('../VaultDocumentPanel', () => ({ VaultDocumentPanel: () => null }));
vi.mock('@/components/standard', () => ({
  standardPreviewShortcuts: [],
  StandardPreview: () => null,
  StandardTable: ({
    data,
    loading,
    error,
    onRetry,
  }: {
    data: Array<{ status: string }>;
    loading: boolean;
    error?: string | null;
    onRetry: () => void;
  }) => (
    <div>
      <span data-testid="table-loading">{String(loading)}</span>
      <span data-testid="table-error">{error || ''}</span>
      <span data-testid="table-statuses">
        {data.map((row: { status: string }) => row.status).join(',')}
      </span>
      <button type="button" onClick={onRetry}>
        Table retry
      </button>
    </div>
  ),
}));
vi.mock('@/components/ui/primitives', () => ({
  MetaChip: () => null,
  StatusChip: () => null,
}));

import { VaultDocumentsView } from '../VaultDocumentsView';

const safe = { id: 'safe-1', name: 'Client safe', type: 'organization' as const, projectId: null };
const documentWithStatus = (status: string) => ({
  id: 'doc-1',
  filename: 'strategy.pdf',
  tags: [],
  status,
  created_at: '2026-08-23T12:00:00.000Z',
  chunk_count: status === 'indexed' ? 12 : 0,
  file_size_bytes: 100,
  scope: 'organization',
  project_id: null,
  owner_id: 'user-1',
  folder_id: null,
});

describe('VaultDocumentsView automatic index refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiMocks.getKnowledgeDocuments.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates a pending row in background and stops after terminal status', async () => {
    apiMocks.getKnowledgeDocuments
      .mockResolvedValueOnce([documentWithStatus('pending')])
      .mockResolvedValueOnce([documentWithStatus('indexed')]);

    render(<VaultDocumentsView safe={safe} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('table-statuses')).toHaveTextContent('pending'));
    expect(screen.getByTestId('table-loading')).toHaveTextContent('false');

    await act(async () => vi.advanceTimersByTime(5000));
    await waitFor(() => expect(screen.getByTestId('table-statuses')).toHaveTextContent('indexed'));
    expect(screen.getByTestId('table-loading')).toHaveTextContent('false');

    await act(async () => vi.advanceTimersByTime(10000));
    expect(apiMocks.getKnowledgeDocuments).toHaveBeenCalledTimes(2);
  });

  it('retains rows on poll failure and uses the same guarded retry path', async () => {
    apiMocks.getKnowledgeDocuments
      .mockResolvedValueOnce([documentWithStatus('pending')])
      .mockRejectedValueOnce(new Error('temporary index outage'))
      .mockResolvedValueOnce([documentWithStatus('indexed')]);

    render(<VaultDocumentsView safe={safe} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('table-statuses')).toHaveTextContent('pending'));
    await act(async () => vi.advanceTimersByTime(5000));

    expect(await screen.findByRole('alert')).toHaveTextContent('last successful data');
    expect(screen.getByTestId('table-statuses')).toHaveTextContent('pending');

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('table-statuses')).toHaveTextContent('indexed'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(apiMocks.getKnowledgeDocuments).toHaveBeenCalledTimes(3);
  });
});
