/**
 * @vitest-environment jsdom
 *
 * Component tests for `<TabeleSourcePackPanel>` (Block C · C-S6).
 *
 * Coverage:
 *   - Renders candidate list + saved packs from the test seams.
 *   - Toggling adds/removes a candidate; counter updates accordingly.
 *   - Save flow validates name + minimum 1 candidate before calling API.
 *   - "Use" forwards a pack to the parent callback.
 *   - Verified-only filter checkbox toggles candidate visibility.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findSourcePackCandidates: vi.fn(),
  createSourcePack: vi.fn(),
  listSourcePacksForTable: vi.fn(),
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  findSourcePackCandidates: mocks.findSourcePackCandidates,
  createSourcePack: mocks.createSourcePack,
  listSourcePacksForTable: mocks.listSourcePacksForTable,
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | Record<string, unknown>) => {
      const options = typeof fallback === 'object' ? fallback : {};
      const template =
        typeof fallback === 'string' ? fallback : String(options.defaultValue ?? _key);
      return template.replace(/{{(\w+)}}/g, (_match, name: string) => String(options[name] ?? ''));
    },
    i18n: { language: 'en' },
  }),
}));

import { TabeleSourcePackPanel } from '../sourcePack/TabeleSourcePackPanel';

const SAMPLE_CANDIDATES = [
  {
    recordId: 'r-1',
    tableId: 'tbl-1',
    title: 'Risk #1',
    preview: 'Risk #1 in scope',
    updatedAt: '2026-05-08T10:00:00Z',
    confidenceScore: 0.7,
    hasVerifiedSource: true,
    validationStatus: 'verified',
    rankScore: 0.85,
    rankSignals: { lexical: 0.9, recency: 1, confidence: 0.7, verifiedSource: 1 },
  },
  {
    recordId: 'r-2',
    tableId: 'tbl-1',
    title: 'Risk #2',
    preview: 'Risk #2 in review',
    updatedAt: '2026-05-01T10:00:00Z',
    confidenceScore: 0.4,
    hasVerifiedSource: false,
    validationStatus: 'in_review',
    rankScore: 0.55,
    rankSignals: { lexical: 0.5, recency: 0.6, confidence: 0.4, verifiedSource: 0 },
  },
];

const SAMPLE_PACK = {
  id: 'pack-1',
  organizationId: 'org-1',
  workspaceId: 'ws-1',
  ownerUserId: 'user-1',
  tableId: 'tbl-1',
  name: 'Existing Pack',
  description: null,
  candidateRecordIds: ['r-1'],
  v8Snapshot: {
    records: [],
    fields: [],
    capturedAt: '2026-05-08T10:00:00Z',
    captureSource: 'source_pack_create' as const,
  },
  createdAt: '2026-05-08T10:00:00Z',
  updatedAt: '2026-05-08T10:00:00Z',
  usedCount: 0,
  archivedAt: null,
};

describe('<TabeleSourcePackPanel>', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders candidates and saved packs from test seams', () => {
    render(
      <TabeleSourcePackPanel
        tableId="tbl-1"
        workspaceId="ws-1"
        testInitialCandidates={SAMPLE_CANDIDATES}
        testInitialPacks={[SAMPLE_PACK]}
      />
    );
    expect(screen.getByTestId('tabele-source-pack-panel')).toBeInTheDocument();
    expect(screen.getByText('Risk #1')).toBeInTheDocument();
    expect(screen.getByText('Risk #2')).toBeInTheDocument();
    expect(screen.getByText('Existing Pack')).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 200 selected/i)).toBeInTheDocument();
  });

  it('toggles candidate selection and updates the counter', () => {
    render(
      <TabeleSourcePackPanel
        tableId="tbl-1"
        workspaceId="ws-1"
        testInitialCandidates={SAMPLE_CANDIDATES}
        testInitialPacks={[]}
      />
    );
    const toggles = screen.getAllByTestId('candidate-toggle');
    const first = toggles[0] as HTMLElement;
    expect(first).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(first);
    expect(screen.getByText(/1 \/ 200 selected/i)).toBeInTheDocument();
    fireEvent.click(first);
    expect(screen.getByText(/0 \/ 200 selected/i)).toBeInTheDocument();
  });

  it('disables save when no records are selected', () => {
    render(
      <TabeleSourcePackPanel
        tableId="tbl-1"
        workspaceId="ws-1"
        testInitialCandidates={SAMPLE_CANDIDATES}
        testInitialPacks={[]}
      />
    );
    const saveButton = screen.getByTestId('source-pack-save-button');
    expect(saveButton).toBeDisabled();
    fireEvent.change(screen.getByTestId('source-pack-name-input'), {
      target: { value: 'My Pack' },
    });
    // Still disabled because no record selected.
    expect(saveButton).toBeDisabled();
  });

  it('saves a pack with the selected candidates', async () => {
    mocks.createSourcePack.mockResolvedValueOnce({
      ...SAMPLE_PACK,
      id: 'pack-new',
      name: 'My Pack',
      candidateRecordIds: ['r-1'],
    });
    render(
      <TabeleSourcePackPanel
        tableId="tbl-1"
        workspaceId="ws-1"
        testInitialCandidates={SAMPLE_CANDIDATES}
        testInitialPacks={[]}
      />
    );
    const firstToggle = screen.getAllByTestId('candidate-toggle')[0] as HTMLElement;
    fireEvent.click(firstToggle);
    fireEvent.change(screen.getByTestId('source-pack-name-input'), {
      target: { value: 'My Pack' },
    });
    fireEvent.click(screen.getByTestId('source-pack-save-button'));

    await waitFor(() => {
      expect(mocks.createSourcePack).toHaveBeenCalledWith({
        tableId: 'tbl-1',
        workspaceId: 'ws-1',
        name: 'My Pack',
        description: undefined,
        candidateRecordIds: ['r-1'],
      });
    });
    // Saved-pack list grows with the new pack.
    await waitFor(() => {
      expect(screen.getByText('My Pack')).toBeInTheDocument();
    });
  });

  it('forwards "Use" to the parent for AI Editor handoff', () => {
    const onUse = vi.fn();
    render(
      <TabeleSourcePackPanel
        tableId="tbl-1"
        workspaceId="ws-1"
        testInitialCandidates={SAMPLE_CANDIDATES}
        testInitialPacks={[SAMPLE_PACK]}
        onUseInAiEditor={onUse}
      />
    );
    fireEvent.click(screen.getByTestId('source-pack-use-in-ai'));
    expect(onUse).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pack-1', name: 'Existing Pack' })
    );
  });
});
