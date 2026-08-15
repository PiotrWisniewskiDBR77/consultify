/**
 * B2 (M18 Document Studio) — CI-visible coverage for the reusable content
 * blocks insertion UI ("Content library" right-rail panel).
 *
 * The panel itself ships inside DocumentStudioDocumentPanel.tsx as
 * ContentLibraryPanel, registered under the `library` right-rail tool.
 * A sibling spec exists at src/components/DocumentStudio/__tests__/, but the
 * CI pipeline only collects tests/unit|integration|components — so this file
 * mirrors and extends that coverage where CI can actually see it.
 *
 * Verifies:
 *   - the `library` tool is present in the right rail and opens the panel;
 *   - the block list renders name/version/type/description and the
 *     target-section selector offers the document's sections;
 *   - the list request is filtered by the document's type and language;
 *   - "Insert into document" calls the durable schema mutation with the
 *     selected section and propagates the refreshed schema upward;
 *   - "Instantiate preview" shows the materialized block without mutating;
 *   - empty-library and load-failure states render their messages.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listDocumentStudioContentBlocksMock,
  instantiateDocumentStudioContentBlockMock,
  insertDocumentStudioContentBlockMock,
} = vi.hoisted(() => ({
  listDocumentStudioContentBlocksMock: vi.fn(),
  instantiateDocumentStudioContentBlockMock: vi.fn(),
  insertDocumentStudioContentBlockMock: vi.fn(),
}));

vi.mock('../../../src/components/DocumentStudio/api', async () => {
  const actual = await vi.importActual<
    typeof import('../../../src/components/DocumentStudio/api')
  >('../../../src/components/DocumentStudio/api');
  return {
    ...actual,
    getDocumentStudioPolicy: vi.fn(async () => ({ canOverrideQa: false, role: 'CONSULTANT' })),
    listDocumentStudioContentBlocks: listDocumentStudioContentBlocksMock,
    instantiateDocumentStudioContentBlock: instantiateDocumentStudioContentBlockMock,
    insertDocumentStudioContentBlock: insertDocumentStudioContentBlockMock,
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

import { DocumentStudioDocumentPanel } from '../../../src/components/DocumentStudio/DocumentStudioDocumentPanel';
import type {
  DocumentContentBlockTemplate,
  DocumentSchema,
} from '../../../src/components/DocumentStudio/types';

const TEMPLATE: DocumentContentBlockTemplate = {
  contentBlockId: 'content-block-1',
  organizationId: 'org-1',
  name: 'Reusable intro',
  description: 'Standard executive introduction paragraph.',
  status: 'active',
  version: 'v1',
  tags: ['intro'],
  documentTypes: ['executive_memo'],
  languageScope: 'en',
  block: { type: 'paragraph', content: { text: 'Reusable intro text.' } },
  createdBy: 'user-1',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
} as DocumentContentBlockTemplate;

const schema: DocumentSchema = {
  documentId: 'doc-1',
  artifactId: 'artifact-1',
  title: 'Board memo',
  documentType: 'executive_memo',
  language: 'en',
  audience: ['CEO'],
  goal: 'decide',
  communicationRegister: 'executive',
  density: 'concise',
  languageStyle: 'consulting',
  confidentiality: 'client_confidential',
  templateRef: { templateId: 'tpl-1', templateVersion: '1.0.0' },
  sourcePackId: 'sp-1',
  clientId: 'client-1',
  owner: 'owner-1',
  sourceRefs: [],
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
      blocks: [],
    },
  ],
} as DocumentSchema;

function renderPanel(onSchemaUpdated = vi.fn()): { onSchemaUpdated: ReturnType<typeof vi.fn> } {
  render(
    <DocumentStudioDocumentPanel
      artifactId="artifact-1"
      schema={schema}
      onStartOver={vi.fn()}
      onSchemaUpdated={onSchemaUpdated}
    />
  );
  return { onSchemaUpdated };
}

async function openLibraryPanel(): Promise<HTMLElement> {
  fireEvent.click(screen.getByTestId('mels-right-rail-tool-more'));
  fireEvent.click(screen.getByTestId('document-studio-rail-overflow-item-library'));
  const panel = await screen.findByTestId('mels-right-rail-panel');
  return panel;
}

describe('Document Studio content blocks panel (B2)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    listDocumentStudioContentBlocksMock.mockResolvedValue([TEMPLATE]);
    instantiateDocumentStudioContentBlockMock.mockResolvedValue({
      block: {
        blockId: 'materialized-1',
        type: 'paragraph',
        content: { text: 'Reusable intro text.' },
      },
      template: TEMPLATE,
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

  it('exposes the library tool in the right rail and lists matching blocks', async () => {
    renderPanel();

    const panel = await openLibraryPanel();
    await waitFor(() => expect(panel).toHaveTextContent('Reusable intro'));

    // Header + descriptive copy.
    expect(panel).toHaveTextContent('Content library');
    expect(panel).toHaveTextContent('Standard executive introduction paragraph.');
    // Language scope, version, and block type metadata line.
    expect(panel).toHaveTextContent('en · vv1 · paragraph');

    // The list request is scoped to the document's type + language.
    expect(listDocumentStudioContentBlocksMock).toHaveBeenCalledWith({
      documentType: 'executive_memo',
      language: 'en',
    });

    // Target-section selector offers every document section, first preselected.
    const select = within(panel).getByRole('combobox') as HTMLSelectElement;
    const optionLabels = within(select)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(optionLabels).toEqual(['1. Executive summary', '2. Risks']);
    expect(select.value).toBe('sec-1');
  });

  it('inserts a block into the selected section and propagates the refreshed schema', async () => {
    const { onSchemaUpdated } = renderPanel();

    const panel = await openLibraryPanel();
    await waitFor(() => expect(panel).toHaveTextContent('Reusable intro'));

    // Retarget the insert at the second section before submitting.
    const select = within(panel).getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'sec-2' } });

    fireEvent.click(within(panel).getByRole('button', { name: /insert into document/i }));

    await waitFor(() =>
      expect(insertDocumentStudioContentBlockMock).toHaveBeenCalledWith(
        'artifact-1',
        'content-block-1',
        { sectionId: 'sec-2', position: 'end' }
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
    // Read-back confirmation of the durable write.
    await waitFor(() => expect(panel).toHaveTextContent('Inserted block read-back'));
  });

  it('previews an instantiated block without mutating the document', async () => {
    const { onSchemaUpdated } = renderPanel();

    const panel = await openLibraryPanel();
    await waitFor(() => expect(panel).toHaveTextContent('Reusable intro'));

    fireEvent.click(within(panel).getByRole('button', { name: /instantiate preview/i }));

    await waitFor(() =>
      expect(instantiateDocumentStudioContentBlockMock).toHaveBeenCalledWith('content-block-1')
    );
    await waitFor(() => expect(panel).toHaveTextContent('Instantiated block preview'));
    expect(insertDocumentStudioContentBlockMock).not.toHaveBeenCalled();
    expect(onSchemaUpdated).not.toHaveBeenCalled();
  });

  it('renders the empty state when no blocks match the document', async () => {
    listDocumentStudioContentBlocksMock.mockResolvedValue([]);
    renderPanel();

    const panel = await openLibraryPanel();
    await waitFor(() =>
      expect(panel).toHaveTextContent('No reusable blocks match this document yet.')
    );
    expect(within(panel).queryByRole('button', { name: /insert into document/i })).toBeNull();
  });

  it('surfaces a load failure as an inline error', async () => {
    listDocumentStudioContentBlocksMock.mockRejectedValue(new Error('library backend down'));
    renderPanel();

    const panel = await openLibraryPanel();
    await waitFor(() => expect(panel).toHaveTextContent('library backend down'));
  });
});
