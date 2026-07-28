/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentStudioDocumentPanel } from '../DocumentStudioDocumentPanel';
import type { DocumentSchema } from '../types';

const {
  insertDocumentStudioContentBlockMock,
  generateDocumentStudioArtifactMock,
  saveDocumentStudioManualContentMock,
  navigateMock,
} = vi.hoisted(() => ({
  insertDocumentStudioContentBlockMock: vi.fn(),
  generateDocumentStudioArtifactMock: vi.fn(),
  saveDocumentStudioManualContentMock: vi.fn(),
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
    window.localStorage.clear();
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
    await waitFor(() => expect(screen.getByText('Governance')).toBeInTheDocument());

    const chips = within(screen.getByTestId('mels-topbar-chips'))
      .getAllByRole('button')
      .map((button) => button.getAttribute('data-mels-chip'));
    expect(chips).toEqual(['history', 'qa', 'governance', 'share', 'agent', 'run']);
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
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('version v2');
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('Used');
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('connector ready');

    fireEvent.click(screen.getByTestId('mels-right-rail-tool-properties'));
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('Properties');
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('tpl-1 v1.0.0');
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('client-1');
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

    fireEvent.click(screen.getByTestId('mels-right-rail-tool-library'));
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

    fireEvent.click(screen.getByTestId('mels-right-rail-tool-diff'));

    await waitFor(() =>
      expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('1 block added.')
    );
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('Reusable intro text.');
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

    fireEvent.click(screen.getByTestId('mels-right-rail-tool-manifest'));

    await waitFor(() =>
      expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent(
        'DOC_BUILDER_MANIFEST passes'
      )
    );
    expect(screen.getByTestId('mels-right-rail-panel')).toHaveTextContent('0 MUST · 0 SHOULD');
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
      await waitFor(() =>
        expect(navigateMock).toHaveBeenCalledWith('/document-studio/artifact-2')
      );
    });
  });

  // N19 (live odbiór 2026-07-28) — the document phase's own back arrow is
  // bound to "Start over" (discard + restart INSIDE the tool), not to
  // leaving Document Studio; the ONE real exit is the moduleLabel
  // breadcrumb segment. Both must be visibly labelled, not icon-only.
  describe('Exit affordance (N19)', () => {
    it('back arrow shows a visible "Start over" label, not just an icon', () => {
      render(
        <DocumentStudioDocumentPanel
          artifactId="artifact-1"
          schema={schema}
          onStartOver={vi.fn()}
          onSchemaUpdated={vi.fn()}
        />
      );

      expect(screen.getByTestId('mels-topbar-back')).toHaveTextContent('Start over');
    });

    it('module-label breadcrumb has a visible label and navigates to Materiały', () => {
      render(
        <DocumentStudioDocumentPanel
          artifactId="artifact-1"
          schema={schema}
          onStartOver={vi.fn()}
          onSchemaUpdated={vi.fn()}
        />
      );

      const exit = screen.getByTestId('mels-topbar-module-label-link');
      expect(exit).toHaveTextContent('Document Studio');

      fireEvent.click(exit);

      expect(navigateMock).toHaveBeenCalledWith('/presentations?tab=documents');
    });
  });
});
