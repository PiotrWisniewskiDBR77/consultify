import { describe, expect, it } from 'vitest';

import type { CanvasDocumentState } from '../../../src/types/canvasWorkspace';
import { getCanvasActionAvailability } from '../../../src/utils/canvas/canvasActionAvailability';
import {
  normalizeCanvasArtifactBlocks,
  projectCanvasArtifactBlockToMarkdown,
} from '../../../src/utils/canvas/canvasArtifactBlocks';
import {
  mapDraftResponseToCanvasDocumentState,
  starterIdToCanvasKind,
} from '../../../src/utils/canvas/canvasDraftAdapter';

const baseDocument: CanvasDocumentState = {
  title: 'Company Work Note',
  contentMd: '# Company Work Note',
  canonicalFormat: 'markdown',
  kind: 'document',
  markdownProjectionStatus: 'synced',
  saveState: 'unsaved',
  lifecycleState: 'draft',
  activeStarterId: 'document',
  projectionError: null,
};

describe('canvas workspace front-end contract helpers', () => {
  it('maps Work Canvas draft responses into Canvas document state', () => {
    const mapped = mapDraftResponseToCanvasDocumentState(
      {
        id: 'draft-1',
        title: 'Decision Memo',
        kind: 'decision',
        contentMd: '# Decision Memo',
        canonicalFormat: 'markdown',
        markdownProjectionStatus: 'stale',
        saveState: 'saved',
        lifecycleState: 'in_review',
        updatedAt: '2026-05-03T05:00:00.000Z',
      },
      baseDocument
    );

    expect(mapped).toMatchObject({
      draftId: 'draft-1',
      title: 'Decision Memo',
      kind: 'decision',
      contentMd: '# Decision Memo',
      markdownProjectionStatus: 'stale',
      saveState: 'saved',
      lifecycleState: 'in_review',
      updatedAt: '2026-05-03T05:00:00.000Z',
    });
  });

  it('falls back to Markdown content and safe states when draft fields are partial', () => {
    const mapped = mapDraftResponseToCanvasDocumentState(
      {
        draftId: 'draft-2',
        content: '# Raw Markdown',
        canonicalFormat: 'json',
        saveState: 'unknown',
        lifecycleState: 'unknown',
        markdownProjectionStatus: 'unknown',
      },
      baseDocument
    );

    expect(mapped.draftId).toBe('draft-2');
    expect(mapped.contentMd).toBe('# Raw Markdown');
    expect(mapped.canonicalFormat).toBe('json');
    expect(mapped.saveState).toBe('unsaved');
    expect(mapped.lifecycleState).toBe('draft');
    expect(mapped.markdownProjectionStatus).toBe('synced');
  });

  it('normalizes server rollout vocabulary without hiding lifecycle or kind truth', () => {
    const proposed = mapDraftResponseToCanvasDocumentState(
      {
        draftId: 'draft-proposed',
        kind: 'markdown',
        lifecycleState: 'proposed',
        contentMd: '# Proposed Canvas',
      },
      baseDocument
    );

    expect(proposed.kind).toBe('markdown');
    expect(proposed.lifecycleState).toBe('in_review');

    const deck = mapDraftResponseToCanvasDocumentState(
      {
        draftId: 'draft-deck',
        kind: 'deck',
        lifecycleState: 'approved',
        contentMd: '# Deck Canvas',
      },
      baseDocument
    );

    expect(deck.kind).toBe('deck');
    expect(deck.lifecycleState).toBe('approved');
  });

  it('maps optional artifact blocks without changing Markdown-only drafts', () => {
    const mappedWithoutBlocks = mapDraftResponseToCanvasDocumentState(
      {
        draftId: 'draft-markdown',
        contentMd: '# Markdown only',
      },
      baseDocument
    );

    expect(mappedWithoutBlocks.blocks).toEqual([]);

    const mappedWithBlocks = mapDraftResponseToCanvasDocumentState(
      {
        draftId: 'draft-blocks',
        contentMd: '# Business Review',
        blocks: [
          {
            id: 'block-1',
            kind: 'table',
            schemaVersion: 'canvas-block/v1',
            title: 'Risks',
            status: 'ready',
            capabilities: ['view', 'sort', 'export'],
            data: {
              columns: ['Risk', 'Owner'],
              rows: [{ Risk: 'Delayed supplier decision', Owner: 'Ops' }],
            },
            provenance: { source: 'assistant', conversationId: 'conv-1' },
            markdownProjectionStatus: 'synced',
          },
        ],
      },
      baseDocument
    );

    expect(mappedWithBlocks.blocks).toHaveLength(1);
    expect(mappedWithBlocks.blocks?.[0].markdownProjection).toContain('| Risk | Owner |');
    expect(mappedWithBlocks.contentMd).toBe('# Business Review');
  });

  it('maps Canvas workflow runs from draft provenance for context packets', () => {
    const mapped = mapDraftResponseToCanvasDocumentState(
      {
        draftId: 'draft-workflow',
        contentMd: '# Workflow',
        provenance: {
          workflowRuns: [
            {
              id: 'workflow-1',
              draftId: 'draft-workflow',
              conversationId: 'conv-1',
              template: 'market_research_to_report',
              title: 'Market research to report',
              status: 'active',
              steps: [
                {
                  id: 'step-1',
                  kind: 'user_approval',
                  title: 'Approval checkpoint',
                  summary: 'Approve before durable output',
                  status: 'pending',
                  approvalRequired: true,
                  createdAt: '2026-05-03T00:00:00.000Z',
                },
              ],
              approvals: [{ stepId: 'step-1', status: 'pending', requiredCapability: 'approve' }],
              outputs: [],
              createdBy: 'user-1',
              createdAt: '2026-05-03T00:00:00.000Z',
              updatedAt: '2026-05-03T00:00:00.000Z',
            },
          ],
        },
      },
      baseDocument
    );

    expect(mapped.workflowRuns).toHaveLength(1);
    expect(mapped.workflowRuns?.[0]).toMatchObject({
      id: 'workflow-1',
      draftId: 'draft-workflow',
      conversationId: 'conv-1',
      steps: [expect.objectContaining({ approvalRequired: true })],
    });
  });

  it('projects business artifact blocks to readable Markdown without leaking raw JSON', () => {
    const [decisionBlock] = normalizeCanvasArtifactBlocks([
      {
        id: 'decision-1',
        kind: 'decision',
        schemaVersion: 'canvas-block/v1',
        title: 'Go-to-market decision',
        status: 'ready',
        capabilities: ['view', 'convert'],
        data: {
          recommendation: 'Launch with Partner A',
          options: [{ label: 'Partner A' }, { label: 'Partner B' }],
        },
        provenance: { source: 'assistant' },
        markdownProjectionStatus: 'synced',
      },
    ]);

    const markdown = projectCanvasArtifactBlockToMarkdown(decisionBlock);

    expect(markdown).toContain('Recommendation: Launch with Partner A');
    expect(markdown).toContain('- Partner A');
    expect(markdown).not.toContain('"recommendation"');
  });

  it('maps starter templates to Canvas document kinds', () => {
    expect(starterIdToCanvasKind('research')).toBe('research');
    expect(starterIdToCanvasKind('decision')).toBe('decision');
    expect(starterIdToCanvasKind('plan')).toBe('plan');
    expect(starterIdToCanvasKind('thoughts')).toBe('document');
  });

  it('describes action availability without leaving missing runtime actions silent', () => {
    expect(getCanvasActionAvailability('copy', baseDocument).status).toBe('enabled');
    expect(getCanvasActionAvailability('save', baseDocument).status).toBe('enabled');

    // P0-2 — share runtime exists; a missing canShare capability is a
    // permissions problem, not "coming soon".
    expect(getCanvasActionAvailability('share', baseDocument)).toMatchObject({
      status: 'disabled_missing_permission',
      reason: 'Brak uprawnień do udostępniania / No permission to share.',
    });

    expect(getCanvasActionAvailability('create-presentation', baseDocument)).toMatchObject({
      status: 'disabled_missing_runtime',
      reason: 'Presentation output runtime is unavailable.',
    });

    expect(
      getCanvasActionAvailability('send-to-idea', baseDocument, { canSendToIdea: true }).status
    ).toBe('enabled');
  });

  it('enables all Canvas business actions when runtime capabilities are present', () => {
    const capabilities = {
      canCreatePresentation: true,
      canCreateTable: true,
      canCreateReport: true,
      canSendToIdea: true,
      canSaveAsNote: true,
      canCreateInitiative: true,
      canShare: true,
    };

    expect(getCanvasActionAvailability('share', baseDocument, capabilities).status).toBe('enabled');
    expect(getCanvasActionAvailability('send-to-idea', baseDocument, capabilities).status).toBe(
      'enabled'
    );
    expect(getCanvasActionAvailability('save-as-note', baseDocument, capabilities).status).toBe(
      'enabled'
    );
    expect(
      getCanvasActionAvailability('create-initiative', baseDocument, capabilities).status
    ).toBe('enabled');
    expect(
      getCanvasActionAvailability('create-presentation', baseDocument, capabilities).status
    ).toBe('enabled');
    expect(getCanvasActionAvailability('create-table', baseDocument, capabilities).status).toBe(
      'enabled'
    );
    expect(getCanvasActionAvailability('create-report', baseDocument, capabilities).status).toBe(
      'enabled'
    );
  });

  it('disables document actions when there is no active Canvas document', () => {
    expect(getCanvasActionAvailability('copy', null)).toMatchObject({
      status: 'disabled_no_active_document',
    });
    expect(getCanvasActionAvailability('close', null).status).toBe('enabled');
  });
});
