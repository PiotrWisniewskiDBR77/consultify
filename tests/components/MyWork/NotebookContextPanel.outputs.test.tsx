/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';

import { NotebookContextPanel } from '../../../src/components/MyWork/notebook/NotebookContextPanel';

// NotebookContextPanel.tsx calls t('myWorkNotebook.contextPanel.linkedOutputs') etc. with NO
// inline fallback (relies on public/locales/en/translation.json). The previous mock omitted
// `t` entirely (`t is not a function`); resolve real English copy instead (same pattern as
// IdeaExportMenu.test.tsx).
function resolveTranslation(key: string, options?: Record<string, unknown>): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, segment) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined),
      enTranslation
    );
  const template = typeof value === 'string' ? value : key;
  if (!options) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name) =>
    Object.prototype.hasOwnProperty.call(options, name) ? String(options[name]) : `{{${name}}}`
  );
}

const {
  apiMock,
  trackFunnelEventMock,
  useAssessmentOutputsForOriginsMock,
  useArtifactOutputsForInitiativesMock,
  useArtifactOutputsForOriginsMock,
} = vi.hoisted(() => ({
  useAssessmentOutputsForOriginsMock: vi.fn(),
  useArtifactOutputsForInitiativesMock: vi.fn(),
  useArtifactOutputsForOriginsMock: vi.fn(),
  trackFunnelEventMock: vi.fn(),
  apiMock: {
    suggestMyIdeas: vi.fn(),
    get: vi.fn(),
    getLinkGraphBacklinks: vi.fn(),
    notebookResolveEmbedChips: vi.fn(),
    createLinkGraphEdge: vi.fn(),
  },
}));

// Keep `t` a stable function identity across renders (react-i18next's real `t` is stable;
// see tests/setup.ts note on why a per-call arrow can break effect/callback deps).
const stableT = (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options);
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: stableT,
  }),
}));

vi.mock('../../../src/components/shared/NModeBlocks', () => ({
  EmbeddedView: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <div>{title}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('../../../src/components/MyWork/notebook/PulseItemPickerModal', () => ({
  PulseItemPickerModal: () => null,
}));

vi.mock('../../../src/components/ReportsAndPresentations/useRapData', () => ({
  useAssessmentOutputsForOrigins: (...args: unknown[]) => useAssessmentOutputsForOriginsMock(...args),
  useArtifactOutputsForInitiatives: (...args: unknown[]) => useArtifactOutputsForInitiativesMock(...args),
  useArtifactOutputsForOrigins: (...args: unknown[]) => useArtifactOutputsForOriginsMock(...args),
}));

vi.mock('../../../src/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...args: unknown[]) => trackFunnelEventMock(...args),
}));

vi.mock('../../../src/services/api', () => ({
  Api: apiMock,
}));

describe('NotebookContextPanel linked outputs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.suggestMyIdeas.mockResolvedValue([]);
    apiMock.get.mockResolvedValue([]);
    apiMock.getLinkGraphBacklinks.mockResolvedValue([
      {
        id: 'backlink-1',
        sourceType: 'initiative',
        sourceId: 'init-1',
      },
    ]);
    apiMock.notebookResolveEmbedChips.mockResolvedValue({
      chips: [
        {
          artifactType: 'initiative',
          artifactId: 'init-1',
          title: 'Growth initiative',
          snippet: 'Primary linked initiative',
        },
      ],
    });
    useArtifactOutputsForInitiativesMock.mockReturnValue({
      rows: [
        {
          kind: 'presentation',
          originRecordId: 'deck-1',
          artifactId: 'artifact-deck-1',
          title: 'Board deck',
          statusKey: 'shared',
          owner: 'user-1',
          updatedAt: '2026-03-24T07:00:00.000Z',
          exportFormats: ['pptx'],
          governance: { visibilityScope: 'review_shared' },
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    useArtifactOutputsForOriginsMock.mockReturnValue({
      rows: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    useAssessmentOutputsForOriginsMock.mockReturnValue({
      rows: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('renders linked outputs sourced from note initiative backlinks', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(
      <NotebookContextPanel
        open
        onClose={vi.fn()}
        editor={null}
        noteId="note-1"
        noteTitle="Q1 planning"
        noteTags={['board']}
        allNotes={[]}
      />,
    );

    await waitFor(() => expect(apiMock.getLinkGraphBacklinks).toHaveBeenCalled());
    expect(screen.getByText('Linked outputs')).toBeInTheDocument();
    expect(screen.getByText('Board deck')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Open').at(-1)!);

    expect((dispatchSpy.mock.calls.at(-1)?.[0] as CustomEvent).detail).toEqual({
      type: 'presentation',
      id: 'deck-1',
      name: 'Board deck',
    });
  });

  it('renders direct converted outputs from the active note on the linked outputs surface', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    apiMock.getLinkGraphBacklinks.mockResolvedValue([]);
    apiMock.notebookResolveEmbedChips.mockResolvedValue({ chips: [] });
    useArtifactOutputsForInitiativesMock.mockReturnValue({
      rows: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    useArtifactOutputsForOriginsMock.mockReturnValue({
      rows: [
        {
          kind: 'document',
          originRecordId: 'report-1',
          artifactId: 'artifact-report-1',
          title: 'Notebook source report',
          statusKey: 'ready',
          owner: 'user-1',
          updatedAt: '2026-03-24T07:00:00.000Z',
          exportFormats: ['pdf'],
          governance: { visibilityScope: 'private' },
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <NotebookContextPanel
        open
        onClose={vi.fn()}
        editor={null}
        noteId="note-1"
        noteTitle="Q1 planning"
        noteTags={['board']}
        allNotes={[]}
        noteConvertedTo={[{ type: 'report', id: 'report-1' }]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Notebook source report')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Open'));

    expect((dispatchSpy.mock.calls.at(-1)?.[0] as CustomEvent).detail).toEqual({
      type: 'report',
      id: 'report-1',
      name: 'Notebook source report',
    });
  });

  it('renders direct converted assessments from the active note on the linked outputs surface', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    apiMock.getLinkGraphBacklinks.mockResolvedValue([]);
    apiMock.notebookResolveEmbedChips.mockResolvedValue({ chips: [] });
    useArtifactOutputsForInitiativesMock.mockReturnValue({
      rows: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    useArtifactOutputsForOriginsMock.mockReturnValue({
      rows: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    useAssessmentOutputsForOriginsMock.mockReturnValue({
      rows: [
        {
          kind: 'assessment',
          originRecordId: 'assessment-1',
          title: 'Digital readiness assessment',
          statusKey: 'draft',
          owner: 'org-1',
          updatedAt: '2026-03-24T07:00:00.000Z',
          governance: { visibilityScope: 'private' },
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <NotebookContextPanel
        open
        onClose={vi.fn()}
        editor={null}
        noteId="note-1"
        noteTitle="Q1 planning"
        noteTags={['board']}
        allNotes={[]}
        noteConvertedTo={[{ type: 'assessment', id: 'assessment-1' }]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Digital readiness assessment')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Open'));

    expect((dispatchSpy.mock.calls.at(-1)?.[0] as CustomEvent).detail).toEqual({
      type: 'assessment',
      id: 'assessment-1',
      name: 'Digital readiness assessment',
    });
  });
});
