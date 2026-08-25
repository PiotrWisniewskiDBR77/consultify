import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// FIX-19 (Day 3 layer-2 acceptance): the server deliberately sends a neutral
// English `name` for system safes ("My safe" / "Organization safe" —
// server/src/routes/knowledge.routes.ts) and expects the client to localize
// it. `VaultSafesTable` already did; this screen (the breadcrumb card fed to
// the hub bar via `useHubBarSlot({ openItems })`, and the "Sejf: …" line in
// the add/edit document panel) rendered the raw server value instead, so a
// Polish user saw "Mój sejf" in the safes table but literal "My safe" the
// moment they opened it.

const hubBarSlotMock = vi.hoisted(() => vi.fn());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : _key),
    i18n: { language: 'pl' },
  }),
}));

const apiMocks = vi.hoisted(() => ({
  getKnowledgeDocuments: vi.fn().mockResolvedValue([]),
  getMyProjectMemberships: vi.fn().mockResolvedValue([]),
  getVaultFolders: vi.fn().mockRejectedValue(new Error('folders unavailable')),
}));

vi.mock('@/services/api', () => ({ Api: apiMocks }));
vi.mock('@/components/shared/HubBarSlots', () => ({ useHubBarSlot: hubBarSlotMock }));
vi.mock('@/components/shared/RowActionsMenu', () => ({ RowActionsMenu: () => null }));
vi.mock('../VaultDocumentPanel', () => ({
  VaultDocumentPanel: ({ safeName }: { safeName: string }) => (
    <div data-testid="panel-safe-name">{safeName}</div>
  ),
}));
vi.mock('@/components/standard', () => ({
  standardPreviewShortcuts: [],
  StandardPreview: () => null,
  StandardTable: () => <div data-testid="table" />,
}));
vi.mock('@/components/ui/primitives', () => ({
  MetaChip: () => null,
  StatusChip: () => null,
}));

import { VaultDocumentsView } from '../VaultDocumentsView';

describe('VaultDocumentsView safe-name localization (PL)', () => {
  beforeEach(() => {
    hubBarSlotMock.mockClear();
  });

  it('shows the localized system-safe name in the breadcrumb card, not the raw server value', async () => {
    const safe = { id: 'user', name: 'My safe', type: 'user' as const, projectId: null };
    render(<VaultDocumentsView safe={safe} onBack={vi.fn()} />);

    await waitFor(() => expect(hubBarSlotMock).toHaveBeenCalled());
    const lastCall = hubBarSlotMock.mock.calls[hubBarSlotMock.mock.calls.length - 1][0];
    expect(lastCall.openItems).toEqual([
      expect.objectContaining({ id: 'user', name: 'Mój sejf' }),
    ]);
    expect(lastCall.openItems[0].name).not.toBe('My safe');
  });

  it('localizes the organization safe the same way', async () => {
    const safe = {
      id: 'organization',
      name: 'Organization safe',
      type: 'organization' as const,
      projectId: null,
    };
    render(<VaultDocumentsView safe={safe} onBack={vi.fn()} />);

    await waitFor(() => expect(hubBarSlotMock).toHaveBeenCalled());
    const lastCall = hubBarSlotMock.mock.calls[hubBarSlotMock.mock.calls.length - 1][0];
    expect(lastCall.openItems[0].name).toBe('Sejf organizacji');
  });

  it('leaves a project safe name untouched (real project name, not a system label)', async () => {
    const safe = {
      id: 'project-1',
      name: 'AGD Nord',
      type: 'project' as const,
      projectId: 'project-1',
    };
    render(<VaultDocumentsView safe={safe} onBack={vi.fn()} />);

    await waitFor(() => expect(hubBarSlotMock).toHaveBeenCalled());
    const lastCall = hubBarSlotMock.mock.calls[hubBarSlotMock.mock.calls.length - 1][0];
    expect(lastCall.openItems[0].name).toBe('AGD Nord');
  });

  it('passes the same localized name to the add/edit document panel ("Sejf: …" line)', async () => {
    const safe = { id: 'user', name: 'My safe', type: 'user' as const, projectId: null };
    render(<VaultDocumentsView safe={safe} onBack={vi.fn()} />);
    expect(await screen.findByTestId('panel-safe-name')).toHaveTextContent('Mój sejf');
  });
});
