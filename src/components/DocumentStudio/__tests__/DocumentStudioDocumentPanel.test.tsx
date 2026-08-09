/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentStudioDocumentPanel, SchemaDiffPanel } from '../DocumentStudioDocumentPanel';
import type { DocumentSchema } from '../types';

const {
  insertDocumentStudioContentBlockMock,
  generateDocumentStudioArtifactMock,
  saveDocumentStudioManualContentMock,
  createDocumentStudioSnapshotMock,
  rollbackDocumentStudioSnapshotMock,
  getDocumentStudioArtifactMock,
  navigateMock,
} = vi.hoisted(() => ({
  insertDocumentStudioContentBlockMock: vi.fn(),
  generateDocumentStudioArtifactMock: vi.fn(),
  saveDocumentStudioManualContentMock: vi.fn(),
  createDocumentStudioSnapshotMock: vi.fn(),
  rollbackDocumentStudioSnapshotMock: vi.fn(),
  getDocumentStudioArtifactMock: vi.fn(),
  navigateMock: vi.fn(),
}));

// N20 (menu pliku) — override the global no-op `useNavigate` safety net
// (`tests/setup.ts`) with a spy so "Otwórz" / the module-label exit can be
// asserted to navigate to the right place, per every other existing export
// (MemoryRouter, Routes, …) staying real.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    generateDocumentStudioArtifact: generateDocumentStudioArtifactMock,
    saveDocumentStudioManualContent: saveDocumentStudioManualContentMock,
    createDocumentStudioSnapshot: createDocumentStudioSnapshotMock,
    rollbackDocumentStudioSnapshot: rollbackDocumentStudioSnapshotMock,
    getDocumentStudioArtifact: getDocumentStudioArtifactMock,
    listDocumentStudioSnapshots: vi.fn(async () => [
      {
        versionId: 'snapshot-1',
        versionNumber: 1,
        capturedAt: '2026-05-09T00:00:00.000Z',
        origin: 'manual',
        label: 'Baseline',
      },
    ]),
    getDocumentStudioPolicy: vi.fn(async () => ({ canOverrideQa: false, role: 'CONSULTANT' })),
    getDocumentStudioSchemaDiff: vi.fn(async () => ({
      baseSnapshot: {
        versionId: 'snapshot-1',
        versionNumber: 1,
        capturedAt: '2026-05-09T00:00:00.000Z',
        origin: 'manual',
      },
      comparedAt: '2026-05-09T00:01:00.000Z',
      summary: '1 block added.',
      diff: {
        hasChanges: true,
        stats: {
          addedSectionCount: 0,
          removedSectionCount: 0,
          modifiedSectionCount: 1,
          reorderedSectionCount: 0,
          unchangedSectionCount: 1,
          addedBlockCount: 1,
          removedBlockCount: 0,
          modifiedBlockCount: 0,
          unchangedBlockCount: 1,
        },
        sectionDiffs: [
          {
            kind: 'modified',
            sectionId: 'sec-1',
            beforeTitle: 'Executive summary',
            afterTitle: 'Executive summary',
            beforeOrderIndex: 0,
            afterOrderIndex: 0,
            blockDiffs: [
              {
                kind: 'added',
                blockId: 'inserted-block-1',
                blockType: 'paragraph',
                beforeText: null,
                afterText: 'Reusable intro text.',
                beforePositionIndex: null,
                afterPositionIndex: 1,
              },
            ],
          },
        ],
      },
    })),
    listDocumentStudioContentBlocks: vi.fn(async () => [
      {
        contentBlockId: 'content-block-1',
        organizationId: 'org-1',
        name: 'Reusable intro',
        status: 'active',
        version: 'v1',
        tags: ['intro'],
        documentTypes: ['executive_memo'],
        languageScope: 'en',
        block: { type: 'paragraph', content: { text: 'Reusable intro text.' } },
        createdBy: 'user-1',
        createdAt: '2026-05-09T00:00:00.000Z',
        updatedAt: '2026-05-09T00:00:00.000Z',
      },
    ]),
    insertDocumentStudioContentBlock: insertDocumentStudioContentBlockMock,
    exportDocumentStudioArtifact: vi.fn(async () => ({
      format: 'docx',
      filename: 'sample.docx',
      contentBase64: 'SGVsbG8=',
      manifest: {},
    })),
  };
});

vi.mock('@/utils/sheetArtifactOpen', () => ({
  buildMyWorkSheetTableOpenPath: vi.fn(() => '/my-work/table'),
  resolveTablePlatformWorkspaceIdForTable: vi.fn(async () => 'workspace-1'),
}));

vi.mock('@/services/executionModuleStandard/api', () => ({
  fetchExecutionModuleManifest: vi.fn(async () => ({
    moduleId: 'doc-builder',
    label: 'Doc Builder',
    status: 'reference',
    zones: [],
    menu2Chips: [],
    rightPanel: {
      collapseTriggerPosition: 'top_left_seam',
      collapseTriggerStyle: 'soft_chevron',
      collapsedWidthPx: 32,
      expandedWidthMinPx: 280,
      expandedWidthMaxPx: 360,
      persistence: 'per_user_per_module',
      parallelPanelsAllowed: false,
    },
    agent: {
      exposedAgentIds: ['teresa'],
      teresaSurface: 'drawer',
      contextAwareOn: 'section',
    },
    aiActions: {
      slot: 'commandRowRightContent',
      actionIds: [],
      duplicatedInCanvas: false,
    },
  })),
  validateExecutionModuleManifest: vi.fn(async () => ({
    ok: true,
    moduleId: 'doc-builder',
    mustViolations: [],
    shouldViolations: [],
  })),
}));

afterEach(() => {
  cleanup();
});

const schema: DocumentSchema = {
  documentId: 'doc-1',
  artifactId: 'artifact-1',
  title: 'Board memo',
  documentType: 'executive_memo',
  language: 'en',
  audience: ['CEO', 'PMO'],
  goal: 'decide',
  communicationRegister: 'executive',
  density: 'concise',
  languageStyle: 'consulting',
  confidentiality: 'client_confidential',
  templateRef: { templateId: 'tpl-1', templateVersion: '1.0.0' },
  sourcePackId: 'sp-1',
  clientId: 'client-1',
  owner: 'owner-1',
  sourceRefs: [
    {
      sourceType: 'table',
      sourceId: 'table-1',
      sourceTitle: 'Benefits table',
      sourceVersion: 'v2',
      sourceSnapshotId: 'snap-1',
    },
  ],
  sections: [
    {
      sectionId: 'sec-1',
      orderIndex: 0,
      level: 1,
      title: 'Executive summary',
      purpose: 'Set context',
      sourceRefs: [],
      blocks: [
        {
          blockId: 'block-1',
          type: 'paragraph',
          content: { text: 'This is the executive summary.' },
          sourceRef: {
            sourceType: 'table',
            sourceId: 'table-1',
            sourceTitle: 'Benefits table',
          },
        },
      ],
    },
    {
      sectionId: 'sec-2',
      orderIndex: 1,
      level: 1,
      title: 'Risks',
      purpose: 'Surface risks',
      sourceRefs: [],
      blocks: [
        {
          blockId: 'block-2',
          type: 'paragraph',
          content: { text: 'This needs validation.' },
          isAssumption: true,
        },
      ],
    },
  ],
};

describe('DocumentStudioDocumentPanel', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
    // Legacy characterization cases are intentionally isolated from rollout
    // flags supplied by a developer's local Vite environment.
    window.localStorage.setItem('ff.artifact_studio', 'false');
    window.localStorage.setItem('ff.document_studio_v2', 'false');
    vi.clearAllMocks();
    // N20 (menu pliku) — "Zapisz jako" default happy path: a fresh artifact
    // is created, then overwritten with the current schema's sections.
    generateDocumentStudioArtifactMock.mockResolvedValue({
      artifactId: 'artifact-2',
      schema: { ...schema, artifactId: 'artifact-2', updatedAt: '2026-07-28T00:00:00.000Z' },
      generationWarnings: [],
    });
    saveDocumentStudioManualContentMock.mockResolvedValue({
      ...schema,
      artifactId: 'artifact-2',
      title: 'Board memo (kopia)',
    });
    insertDocumentStudioContentBlockMock.mockResolvedValue({
      insertedBlock: {
        blockId: 'inserted-block-1',
        type: 'paragraph',
        content: { text: 'Reusable intro text.' },
      },
      schema: {
        ...schema,
        sections: [
          {
            ...schema.sections[0],
            blocks: [
              ...schema.sections[0].blocks,
              {
                blockId: 'inserted-block-1',
                type: 'paragraph',
                content: { text: 'Reusable intro text.' },
              },
            ],
          },
          schema.sections[1],
        ],
      },
    });
    createDocumentStudioSnapshotMock.mockResolvedValue({
      versionId: 'snapshot-2',
      versionNumber: 2,
      capturedAt: '2026-05-09T01:00:00.000Z',
      origin: 'manual',
      label: 'Manual checkpoint',
    });
    rollbackDocumentStudioSnapshotMock.mockResolvedValue(undefined);
    getDocumentStudioArtifactMock.mockResolvedValue({
      schema: { ...schema, title: 'Restored title' },
      generationWarnings: [],
    });
  });

  it('uses the Artifact Studio shell without a local Teresa or legacy right rail', async () => {
    window.localStorage.setItem('ff.artifact_studio', 'true');
    window.localStorage.setItem('ff.document_studio_v2', 'true');

    render(
      <DocumentStudioDocumentPanel
        artifactId="artifact-1"
        schema={schema}
        onStartOver={vi.fn()}
        onSchemaUpdated={vi.fn()}
      />
    );

    expect(screen.getByTestId('document-studio-mels-shell')).toHaveAttribute(
      'data-artifact-studio',
      'true'
    );
    expect(screen.getByTestId('artifact-menu3')).toBeInTheDocument();
    expect(screen.getByTestId('artifact-bottom-bar-content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Teresa' })).toBeInTheDocument();
    expect(screen.getByTestId('document-artifact-status')).toHaveTextContent('Zapisano');
    expect(screen.getByTestId('document-artifact-status')).toHaveTextContent(
      schema.confidentiality
    );
    expect(
      screen.getByTestId('mels-topbar-chips').querySelector('[data-mels-chip="qa"]')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mels-topbar-overflow'));
    expect(screen.getByTestId('mels-topbar-overflow-menu')).toHaveTextContent('QA');
    expect(screen.getByTestId('mels-topbar-overflow-menu')).toHaveTextContent('History');

    expect(screen.queryByTestId('mels-right-rail')).not.toBeInTheDocument();
    expect(screen.queryByTestId('document-file-menu-trigger')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'AI Editor' })).not.toBeInTheDocument();
    expect(screen.queryByText('Manifest gate')).not.toBeInTheDocument();
    expect(screen.queryByText('Document preview')).not.toBeInTheDocument();

    const sourcesButton = screen.getByRole('button', { name: 'Źródła' });
    fireEvent.click(sourcesButton);
    expect(sourcesButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mels-left-rail')).toHaveTextContent('Benefits table');
    expect(screen.queryByRole('dialog', { name: 'Narzędzia dokumentu' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Struktura' }));
    expect(screen.getByTestId('mels-left-rail')).toHaveTextContent('Executive summary');

    fireEvent.click(screen.getByRole('button', { name: 'QA i przegląd' }));
    expect(screen.getByTestId('document-review-panel')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'QA' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Zatwierdzenie' }));
    expect(screen.getByRole('tab', { name: 'Zatwierdzenie' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(await screen.findByText('Approvals')).toBeInTheDocument();
  });

  it('renders the document in the shared MELS shell with outline and canonical chips', async () => {
    render(
      <DocumentStudioDocumentPanel
        artifactId="artifact-1"
        schema={schema}
        onStartOver={vi.fn()}
        onSchemaUpdated={vi.fn()}
      />
    );

    expect(screen.getByTestId('document-studio-mels-shell')).toBeInTheDocument();
    expect(screen.getByTestId('mels-left-rail')).toHaveTextContent('Executive summary');
    expect(screen.getByTestId('mels-left-rail')).toHaveTextContent('Risks');
    expect(screen.getByTestId('mels-canvas')).toHaveTextContent('Document preview');
    expect(screen.getByTestId('mels-canvas')).toHaveTextContent('This is the executive summary.');
    await waitFor(() => expect(screen.getByText('QA i przegląd')).toBeInTheDocument());

    // U5 (odbiór "menu pliku", 2026-07-28) — "history" and "governance" moved
    // to the `⋯` overflow tier (measured live at 1280px: 6 always-expanded
    // chips + the new "Plik" menu crushed the document title to a 0-26px
    // sliver; folding these two — lower call-frequency, audit-style actions
    // — back to editor-shell-canon's own documented overflow pattern
    // reclaimed ~200px with zero functionality loss, since `⋯` was already
    // built for exactly this). So the always-visible chip set shrank; the
    // folded two are asserted separately below via the `⋯` menu.
    //
    // `mels-topbar-chips` also hosts `topBarLeadingActionSlot` (the new
    // "Plik" dropdown trigger, rendered FIRST per U3) — see `TopBar.tsx`'s
    // own doc for that slot. Scope the query to elements carrying the
    // `data-mels-chip` contract so this assertion keeps testing the
    // canonical CHIP set, not "every button in the container".
    // Render order is secondary-tier chips first, then primary ("share") —
    // a PRE-EXISTING, separately-flagged inconsistency between
    // `sortChipsByMelsOrder` (which interleaves "share" between "qa" and
    // "agent" per MELS_CHIP_ORDER) and `TopBar.tsx`'s tier-partitioned
    // render (secondary chips always render before primary chips). Verified
    // unrelated to this change: reproduces identically on a clean
    // `origin/demo` checkout with zero modifications (see task
    // `task_289f7414`). Asserting the actual (buggy) order here rather than
    // the nominally-intended MELS order, so this test doesn't mask further
    // regressions on top of the known one.
    const chips = Array.from(
      screen.getByTestId('mels-topbar-chips').querySelectorAll('[data-mels-chip]')
    ).map((button) => button.getAttribute('data-mels-chip'));
    expect(chips).toEqual(['qa', 'agent', 'run', 'share']);
    expect(screen.getByTestId('document-file-menu-trigger')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mels-topbar-overflow'));
    const overflowMenu = screen.getByTestId('mels-topbar-overflow-menu');
    expect(overflowMenu).toHaveTextContent('History');
    expect(overflowMenu).toHaveTextContent('Governance');
  });

  it('opens sources and properties right-rail panels', async () => {
    render(
      <DocumentStudioDocumentPanel
        artifactId="artifact-1"
        schema={schema}
        onStartOver={vi.fn()}
        onSchemaUpdated={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('mels-right-rail-tool-sources'));
    await waitFor(() =>
      expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('Benefits table')
    );
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('Benefits table');
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('v2');
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('Used');
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('connector ready');

    fireEvent.click(screen.getByTestId('mels-right-rail-tool-properties'));
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('Properties');
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('tpl-1 v1.0.0');
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('client-1');
  });

  it('opens the real share-link panel when Materials hands off a share action', async () => {
    render(
      <DocumentStudioDocumentPanel
        artifactId="artifact-1"
        schema={schema}
        initialOverflowToolId="share"
        onStartOver={vi.fn()}
        onSchemaUpdated={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('Share links')
    );
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('Create link');
  });

  it('inserts reusable content blocks through the durable schema mutation', async () => {
    const onSchemaUpdated = vi.fn();
    render(
      <DocumentStudioDocumentPanel
        artifactId="artifact-1"
        schema={schema}
        onStartOver={vi.fn()}
        onSchemaUpdated={onSchemaUpdated}
      />
    );

    fireEvent.click(screen.getByTestId('mels-right-rail-tool-more'));
    fireEvent.click(screen.getByTestId('document-studio-rail-overflow-item-library'));
    await waitFor(() =>
      expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('Reusable intro')
    );

    fireEvent.click(screen.getByRole('button', { name: /insert into document/i }));

    await waitFor(() =>
      expect(insertDocumentStudioContentBlockMock).toHaveBeenCalledWith(
        'artifact-1',
        'content-block-1',
        { sectionId: 'sec-1', position: 'end' }
      )
    );
    expect(onSchemaUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            blocks: expect.arrayContaining([
              expect.objectContaining({ blockId: 'inserted-block-1' }),
            ]),
          }),
        ]),
      })
    );
  });

  it('opens the read-only document schema diff panel', async () => {
    render(
      <DocumentStudioDocumentPanel
        artifactId="artifact-1"
        schema={schema}
        onStartOver={vi.fn()}
        onSchemaUpdated={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('mels-right-rail-tool-more'));
    fireEvent.click(screen.getByTestId('document-studio-rail-overflow-item-diff'));

    await waitFor(() =>
      expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('1 block added.')
    );
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('Reusable intro text.');
  });

  it('captures and restores a snapshot, then publishes the canonical read-back', async () => {
    const onSchemaUpdated = vi.fn();
    render(<SchemaDiffPanel artifactId="artifact-1" onSchemaUpdated={onSchemaUpdated} />);
    await waitFor(() =>
      expect(screen.getByTestId('document-snapshot-capture')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId('document-snapshot-capture'));
    await waitFor(() =>
      expect(createDocumentStudioSnapshotMock).toHaveBeenCalledWith(
        'artifact-1',
        expect.objectContaining({ reason: 'document_studio_ui_capture' })
      )
    );

    const select = screen.getByTestId('schema-diff-baseline-select');
    fireEvent.change(select, { target: { value: 'snapshot-1' } });
    fireEvent.click(screen.getByTestId('document-snapshot-restore'));
    expect(screen.getByTestId('document-snapshot-restore')).toHaveTextContent('Confirm restore');
    fireEvent.click(screen.getByTestId('document-snapshot-restore'));
    await waitFor(() =>
      expect(rollbackDocumentStudioSnapshotMock).toHaveBeenCalledWith(
        'artifact-1',
        'snapshot-1',
        expect.objectContaining({ reason: 'document_studio_ui_restore' })
      )
    );
    expect(getDocumentStudioArtifactMock).toHaveBeenCalledWith('artifact-1');
    expect(onSchemaUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Restored title' })
    );
  });

  it('opens the DOC_BUILDER_MANIFEST validation gate', async () => {
    render(
      <DocumentStudioDocumentPanel
        artifactId="artifact-1"
        schema={schema}
        onStartOver={vi.fn()}
        onSchemaUpdated={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('mels-right-rail-tool-more'));
    fireEvent.click(screen.getByTestId('document-studio-rail-overflow-item-manifest'));

    await waitFor(() =>
      expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent(
        'DOC_BUILDER_MANIFEST passes'
      )
    );
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('MUST');
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('SHOULD');
  });

  // N20 (menu pliku, live odbiór 2026-07-28) — "Nie ma Zapisz, Zapisz jako,
  // Otwórz". The File menu below is the fix; these 4 tests match the
  // ROBOTNIK brief's own acceptance list verbatim.
  describe('File menu (N20)', () => {
    it('renders 4 file operations (Nowy · Otwórz · Zapisz · Zapisz jako)', async () => {
      render(
        <DocumentStudioDocumentPanel
          artifactId="artifact-1"
          schema={schema}
          onStartOver={vi.fn()}
          onSchemaUpdated={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('document-file-menu-trigger'));

      expect(screen.getByTestId('document-file-menu-new')).toBeInTheDocument();
      expect(screen.getByTestId('document-file-menu-open')).toBeInTheDocument();
      expect(screen.getByTestId('document-file-menu-save')).toBeInTheDocument();
      expect(screen.getByTestId('document-file-menu-save-as')).toBeInTheDocument();
    });

    it('"Otwórz" navigates to the Materiały documents list', async () => {
      render(
        <DocumentStudioDocumentPanel
          artifactId="artifact-1"
          schema={schema}
          onStartOver={vi.fn()}
          onSchemaUpdated={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('document-file-menu-trigger'));
      fireEvent.click(screen.getByTestId('document-file-menu-open'));

      expect(navigateMock).toHaveBeenCalledWith('/presentations?tab=documents');
    });

    it('shows the live autosave state instead of a fake manual "Save" action', async () => {
      render(
        <DocumentStudioDocumentPanel
          artifactId="artifact-1"
          schema={schema}
          onStartOver={vi.fn()}
          onSchemaUpdated={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('document-file-menu-trigger'));

      // Freshly opened, no edits yet — the autosave observer starts at
      // 'idle', which reads as "already durable" (matches server state at
      // load), not as "nothing to report".
      const saveRow = screen.getByTestId('document-file-menu-save');
      expect(saveRow).toHaveTextContent('Zapisano automatycznie');
      // Not a button — clicking it must not pretend to trigger a save.
      expect(saveRow).toHaveAttribute('aria-disabled', 'true');
    });

    it('"Zapisz jako" duplicates the document via the existing generate + manual-content endpoints', async () => {
      render(
        <DocumentStudioDocumentPanel
          artifactId="artifact-1"
          schema={schema}
          onStartOver={vi.fn()}
          onSchemaUpdated={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('document-file-menu-trigger'));
      fireEvent.click(screen.getByTestId('document-file-menu-save-as'));

      await waitFor(() => expect(generateDocumentStudioArtifactMock).toHaveBeenCalledTimes(1));
      expect(generateDocumentStudioArtifactMock).toHaveBeenCalledWith(
        expect.objectContaining({ useLlm: false })
      );
      await waitFor(() =>
        expect(saveDocumentStudioManualContentMock).toHaveBeenCalledWith('artifact-2', {
          sections: schema.sections,
          expectedVersion: '2026-07-28T00:00:00.000Z',
        })
      );
      await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/document-studio/artifact-2'));
    });
  });

  // N19/U1/U2 (live odbiór 2026-07-28) — the arrow in the top-left corner is
  // a universal "back/exit" sign. It used to fire "Start over" (discard +
  // restart INSIDE the tool) — a data-loss-shaped trap for exactly the user
  // hunting for the exit. Fixed: the arrow now IS the one real exit, its
  // visible label says where it leads (not the name of the screen you're
  // already on), and "Start over" no longer lives behind anything
  // arrow-shaped.
  describe('Exit affordance (N19/U1/U2)', () => {
    it('back arrow navigates to Materiały and does NOT discard the open document', () => {
      const onStartOver = vi.fn();
      render(
        <DocumentStudioDocumentPanel
          artifactId="artifact-1"
          schema={schema}
          onStartOver={onStartOver}
          onSchemaUpdated={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('mels-topbar-back'));

      expect(navigateMock).toHaveBeenCalledWith('/presentations?tab=documents');
      // U1's core complaint: the back arrow must not be a disguised
      // "discard and restart" trap — it must only navigate, never fire the
      // destructive start-over handler.
      expect(onStartOver).not.toHaveBeenCalled();
    });

    it("back arrow's visible label says where it leads (Materiały), matching its accessible name", () => {
      render(
        <DocumentStudioDocumentPanel
          artifactId="artifact-1"
          schema={schema}
          onStartOver={vi.fn()}
          onSchemaUpdated={vi.fn()}
        />
      );

      const back = screen.getByTestId('mels-topbar-back');
      // U2: visible text and accessible name (aria-label) must agree, and
      // both must name the DESTINATION, not the screen the user is already
      // on ("Document Studio" — that was the bug).
      expect(back).toHaveTextContent('Materiał');
      expect(back).toHaveAccessibleName(/materiał/i);
    });

    it('"Start over" (Nowy) is reachable ONLY from the File menu, not from the back arrow', () => {
      const onStartOver = vi.fn();
      render(
        <DocumentStudioDocumentPanel
          artifactId="artifact-1"
          schema={schema}
          onStartOver={onStartOver}
          onSchemaUpdated={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('document-file-menu-trigger'));
      fireEvent.click(screen.getByTestId('document-file-menu-new'));

      expect(onStartOver).toHaveBeenCalledTimes(1);
    });
  });
});
