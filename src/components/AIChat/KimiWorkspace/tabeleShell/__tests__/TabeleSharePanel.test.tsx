/**
 * @vitest-environment jsdom
 *
 * Component tests for `<TabeleSharePanel>` (Block D · D-S3).
 *
 * Coverage:
 *   - Renders the conversion target chooser (document / presentation).
 *   - Lists saved source packs from the test seam.
 *   - Switching between live snapshot and a saved pack updates state.
 *   - Convert button calls the API with the selected target + pack.
 *   - Recent conversions list renders status + deep links.
 *   - Empty conversions state shows the placeholder.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  convertTable: vi.fn(),
  listSourcePacksForTable: vi.fn(),
  listTableConversions: vi.fn(),
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  convertTable: mocks.convertTable,
  listSourcePacksForTable: mocks.listSourcePacksForTable,
  listTableConversions: mocks.listTableConversions,
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign((..._args: unknown[]) => undefined, {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

import { TabeleSharePanel } from '../share/TabeleSharePanel';

const SAMPLE_PACK = {
  id: 'pack-1',
  organizationId: 'org-1',
  workspaceId: 'ws-1',
  ownerUserId: 'user-1',
  tableId: 'tbl-1',
  name: 'Initiative pack',
  description: null,
  candidateRecordIds: ['r-1', 'r-2'],
  v8Snapshot: {
    records: [],
    fields: [],
    capturedAt: '2026-05-08T10:00:00Z',
    captureSource: 'source_pack_create' as const,
  },
  createdAt: '2026-05-08T10:00:00Z',
  updatedAt: '2026-05-08T10:00:00Z',
  usedCount: 1,
  archivedAt: null,
};

const SAMPLE_CONVERSION = {
  id: 'aaaaaaaa-1111-2222-3333-444444444444',
  organizationId: 'org-1',
  workspaceId: 'ws-1',
  tableId: 'tbl-1',
  sourcePackId: null,
  target: 'document' as const,
  title: 'Briefing',
  outline: null,
  status: 'succeeded' as const,
  artifactRunId: 'run-1',
  artifactDeepLink: '/wordy/run-1',
  initiatedBy: 'user-1',
  initiatedAt: '2026-05-08T11:00:00Z',
  completedAt: '2026-05-08T11:00:30Z',
  failureReason: null,
  failureStage: null,
};

describe('<TabeleSharePanel>', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the conversion target chooser', () => {
    render(
      <TabeleSharePanel
        tableId="tbl-1"
        workspaceId="ws-1"
        testInitialPacks={[]}
        testInitialConversions={[]}
      />
    );
    expect(screen.getByTestId('tabele-share-panel')).toBeTruthy();
    expect(screen.getByTestId('share-target-document').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('share-target-presentation').getAttribute('aria-checked')).toBe(
      'false'
    );
  });

  it('lists saved source packs and toggles selection', () => {
    render(
      <TabeleSharePanel
        tableId="tbl-1"
        workspaceId="ws-1"
        testInitialPacks={[SAMPLE_PACK]}
        testInitialConversions={[]}
      />
    );
    const liveOption = screen.getByTestId('share-snapshot-live') as HTMLInputElement;
    expect(liveOption.checked).toBe(true);
    const packOption = screen.getByTestId(
      `share-snapshot-pack-${SAMPLE_PACK.id}`
    ) as HTMLInputElement;
    fireEvent.click(packOption);
    expect(packOption.checked).toBe(true);
    expect(liveOption.checked).toBe(false);
  });

  it('submits a conversion with the selected target and pack', async () => {
    mocks.convertTable.mockResolvedValueOnce({
      conversionId: 'c-1',
      status: 'succeeded',
      artifactRunId: 'run-1',
      artifactDeepLink: '/wordy/run-1',
      sourcePackId: SAMPLE_PACK.id,
    });
    mocks.listTableConversions.mockResolvedValue([SAMPLE_CONVERSION]);

    render(
      <TabeleSharePanel
        tableId="tbl-1"
        workspaceId="ws-1"
        testInitialPacks={[SAMPLE_PACK]}
        testInitialConversions={[]}
      />
    );

    fireEvent.click(screen.getByTestId('share-target-presentation'));
    fireEvent.click(screen.getByTestId(`share-snapshot-pack-${SAMPLE_PACK.id}`));
    const titleInput = screen.getByTestId('share-title-input') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Q3 Briefing' } });

    fireEvent.click(screen.getByTestId('share-convert-submit'));

    await waitFor(() => expect(mocks.convertTable).toHaveBeenCalled());
    expect(mocks.convertTable).toHaveBeenCalledWith('tbl-1', {
      workspaceId: 'ws-1',
      target: 'presentation',
      sourcePackId: SAMPLE_PACK.id,
      title: 'Q3 Briefing',
    });
  });

  it('renders recent conversions with deep link', () => {
    render(
      <TabeleSharePanel
        tableId="tbl-1"
        workspaceId="ws-1"
        testInitialPacks={[]}
        testInitialConversions={[SAMPLE_CONVERSION]}
      />
    );
    const list = screen.getByTestId('share-conversions-list');
    expect(list.textContent).toContain('Briefing');
    expect(screen.getByTestId(`share-conversion-link-${SAMPLE_CONVERSION.id}`)).toBeTruthy();
  });

  it('shows empty state when no conversions exist', () => {
    render(
      <TabeleSharePanel
        tableId="tbl-1"
        workspaceId="ws-1"
        testInitialPacks={[]}
        testInitialConversions={[]}
      />
    );
    expect(screen.getByTestId('share-conversions-empty')).toBeTruthy();
  });
});
