import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// MYW-CV-REC-003 ("nie ma trzeciego menu, menu dynamicznego (...) nie ma
// wszystkich funkcjonalności (...) bulk, dynamiczne pokazywanie na listwie
// tego, co jest potwierdzane"): the bulk bar used to offer only Delete and
// only a toast. It now offers a second bulk action (Add to AI knowledge)
// and renders a per-item receipt list directly on the bar after either
// action runs, so the user can see exactly what was confirmed/failed per
// document — not just an aggregate count.

// Stable references — an unstable `t`/`i18n` identity on every render breaks
// this component's `useCallback`/`useEffect` dependency chains (`load`
// depends on `t`; the mount effect depends on `load`), which re-triggers the
// data-load effect on every render and manifests as a React "Maximum update
// depth exceeded" loop that has nothing to do with the behavior under test.
const stableT = (_key: string, fallback?: unknown) =>
  typeof fallback === 'string'
    ? fallback
    : (fallback as { defaultValue?: string })?.defaultValue || _key;
const stableI18n = { language: 'pl' };

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stableT, i18n: stableI18n }),
}));

const apiMocks = vi.hoisted(() => ({
  getKnowledgeDocuments: vi.fn(),
  getMyProjectMemberships: vi.fn().mockResolvedValue([]),
  getVaultFolders: vi.fn().mockRejectedValue(new Error('folders unavailable')),
  deleteKnowledgeDocument: vi.fn(),
  updateKnowledgeDocument: vi.fn(),
}));

vi.mock('@/services/api', () => ({ Api: apiMocks }));
vi.mock('@/components/shared/HubBarSlots', () => ({ useHubBarSlot: vi.fn() }));
vi.mock('@/components/shared/RowActionsMenu', () => ({ RowActionsMenu: () => null }));
vi.mock('../VaultDocumentPanel', () => ({ VaultDocumentPanel: () => null }));
vi.mock('@/components/ui/primitives', () => ({
  MetaChip: () => null,
  StatusChip: () => null,
}));

// A minimal stand-in that exposes the `selection` contract VaultDocumentsView
// relies on, so a test can drive `selectedRowIds` without a full table.
vi.mock('@/components/standard', () => ({
  standardPreviewShortcuts: [],
  StandardPreview: () => null,
  StandardTable: ({ data, selection }: any) => (
    <div data-testid="table">
      <button
        type="button"
        onClick={() => selection.onChange(new Set(data.map((row: any) => String(row.id))))}
      >
        select-all
      </button>
    </div>
  ),
}));

import { VaultDocumentsView } from '../VaultDocumentsView';

const docs = [
  {
    id: 'doc-1',
    filename: 'Umowa ramowa.pdf',
    category: 'contract',
    tags: [],
    ai_visibility: 'blocked',
    status: 'indexed',
    created_at: '2026-08-01T00:00:00.000Z',
    chunk_count: 3,
    file_size_bytes: 1024,
    scope: 'project',
    project_id: 'project-1',
    owner_id: 'owner-1',
    folder_id: null,
  },
  {
    id: 'doc-2',
    filename: 'Raport audytu.pdf',
    category: 'report',
    tags: [],
    ai_visibility: 'blocked',
    status: 'indexed',
    created_at: '2026-08-02T00:00:00.000Z',
    chunk_count: 5,
    file_size_bytes: 2048,
    scope: 'project',
    project_id: 'project-1',
    owner_id: 'owner-1',
    folder_id: null,
  },
];

const safe = { id: 'project-1', name: 'AGD Nord', type: 'project' as const, projectId: 'project-1' };

describe('VaultDocumentsView bulk bar — per-item receipts (MYW-CV-REC-003)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getKnowledgeDocuments.mockResolvedValue({ documents: docs });
    apiMocks.getMyProjectMemberships.mockResolvedValue([]);
  });

  it('shows a second bulk action (Add to AI knowledge) alongside Delete once rows are selected', async () => {
    render(<VaultDocumentsView safe={safe} onBack={vi.fn()} />);
    await waitFor(() => expect(apiMocks.getKnowledgeDocuments).toHaveBeenCalled());

    fireEvent.click(await screen.findByText('select-all'));

    expect(await screen.findByText('Dodaj do wiedzy AI')).toBeInTheDocument();
    expect(screen.getByText('Usuń')).toBeInTheDocument();
  });

  it('renders one honest per-document receipt after a partial-failure bulk delete', async () => {
    apiMocks.deleteKnowledgeDocument.mockImplementation((id: string) => {
      if (id === 'doc-2') return Promise.reject(new Error('locked'));
      return Promise.resolve({});
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<VaultDocumentsView safe={safe} onBack={vi.fn()} />);
    await waitFor(() => expect(apiMocks.getKnowledgeDocuments).toHaveBeenCalled());
    fireEvent.click(await screen.findByText('select-all'));
    fireEvent.click(screen.getByText('Usuń'));

    const panel = await screen.findByTestId('vault-bulk-receipts');
    expect(panel).toHaveTextContent('Umowa ramowa.pdf');
    expect(panel).toHaveTextContent('Raport audytu.pdf');
    expect(panel).toHaveTextContent('locked');
  });

  it('renders a per-document receipt after "Add to AI knowledge" and calls the real update API per id', async () => {
    apiMocks.updateKnowledgeDocument.mockResolvedValue({});

    render(<VaultDocumentsView safe={safe} onBack={vi.fn()} />);
    await waitFor(() => expect(apiMocks.getKnowledgeDocuments).toHaveBeenCalled());
    fireEvent.click(await screen.findByText('select-all'));
    fireEvent.click(screen.getByText('Dodaj do wiedzy AI'));

    await waitFor(() => expect(apiMocks.updateKnowledgeDocument).toHaveBeenCalledTimes(2));
    expect(apiMocks.updateKnowledgeDocument).toHaveBeenCalledWith('doc-1', {
      ai_visibility: 'allowed',
    });
    expect(apiMocks.updateKnowledgeDocument).toHaveBeenCalledWith('doc-2', {
      ai_visibility: 'allowed',
    });
    const panel = await screen.findByTestId('vault-bulk-receipts');
    expect(panel).toHaveTextContent('Umowa ramowa.pdf');
    expect(panel).toHaveTextContent('Raport audytu.pdf');
  });

  it('dismisses the receipt panel via its close button', async () => {
    apiMocks.updateKnowledgeDocument.mockResolvedValue({});
    render(<VaultDocumentsView safe={safe} onBack={vi.fn()} />);
    await waitFor(() => expect(apiMocks.getKnowledgeDocuments).toHaveBeenCalled());
    fireEvent.click(await screen.findByText('select-all'));
    fireEvent.click(screen.getByText('Dodaj do wiedzy AI'));

    const panel = await screen.findByTestId('vault-bulk-receipts');
    fireEvent.click(screen.getByLabelText('Zamknij'));
    await waitFor(() => expect(screen.queryByTestId('vault-bulk-receipts')).not.toBeInTheDocument());
    expect(panel).toBeTruthy();
  });
});
