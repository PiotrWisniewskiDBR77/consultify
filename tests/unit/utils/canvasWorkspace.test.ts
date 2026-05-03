import { describe, expect, it } from 'vitest';

import type { CanvasDocumentState } from '../../../src/types/canvasWorkspace';
import { getCanvasActionAvailability } from '../../../src/utils/canvas/canvasActionAvailability';
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

  it('maps starter templates to Canvas document kinds', () => {
    expect(starterIdToCanvasKind('research')).toBe('research');
    expect(starterIdToCanvasKind('decision')).toBe('decision');
    expect(starterIdToCanvasKind('plan')).toBe('plan');
    expect(starterIdToCanvasKind('thoughts')).toBe('document');
  });

  it('describes action availability without leaving missing runtime actions silent', () => {
    expect(getCanvasActionAvailability('copy', baseDocument).status).toBe('enabled');
    expect(getCanvasActionAvailability('save', baseDocument).status).toBe('enabled');

    expect(getCanvasActionAvailability('share', baseDocument)).toMatchObject({
      status: 'coming_soon',
      reason: 'Share links need a backend runtime.',
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
    };

    expect(getCanvasActionAvailability('send-to-idea', baseDocument, capabilities).status).toBe(
      'enabled'
    );
    expect(getCanvasActionAvailability('save-as-note', baseDocument, capabilities).status).toBe(
      'enabled'
    );
    expect(getCanvasActionAvailability('create-initiative', baseDocument, capabilities).status).toBe(
      'enabled'
    );
    expect(getCanvasActionAvailability('create-presentation', baseDocument, capabilities).status).toBe(
      'enabled'
    );
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
