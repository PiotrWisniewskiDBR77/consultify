import { describe, expect, it } from 'vitest';

import { workCanvasActionErrorMessage } from '@/utils/canvas/workCanvasActionErrorMessage';

const codedError = (code: string, message = 'server message') =>
  ({
    data: { code },
    message,
  }) as Error & { data: { code: string } };

describe('workCanvasActionErrorMessage', () => {
  it('maps known workflow machine codes to deterministic messages', () => {
    expect(
      workCanvasActionErrorMessage(
        codedError('WORK_CANVAS_WORKFLOW_TEMPLATE_INVALID'),
        'fallback message'
      )
    ).toBe('Workflow template is invalid. Choose a supported template before starting this workflow.');
    expect(
      workCanvasActionErrorMessage(codedError('WORK_CANVAS_WORKFLOW_RUN_NOT_FOUND'), 'fallback message')
    ).toBe('Workflow run was not found. Refresh the Canvas workflow list and retry.');
    expect(
      workCanvasActionErrorMessage(
        codedError('WORK_CANVAS_WORKFLOW_PERSIST_FAILED'),
        'fallback message'
      )
    ).toBe('Workflow changes could not be persisted. Retry in a moment.');
    expect(
      workCanvasActionErrorMessage(
        codedError('WORK_CANVAS_WORKFLOW_LIFECYCLE_INVALID'),
        'fallback message'
      )
    ).toBe('Workflow lifecycle transition is invalid for the current step state.');
    expect(
      workCanvasActionErrorMessage(
        codedError('WORK_CANVAS_WORKFLOW_CONTEXT_MISMATCH'),
        'fallback message'
      )
    ).toBe('Workflow context changed. Refresh the draft and retry the workflow action.');
    expect(
      workCanvasActionErrorMessage(
        codedError('WORK_CANVAS_WORKFLOW_COMMENT_BODY_REQUIRED'),
        'fallback message'
      )
    ).toBe('Workflow comment body is required before submitting.');
  });

  it('preserves existing draft conflict mapping', () => {
    expect(workCanvasActionErrorMessage(codedError('CANVAS_DRAFT_CONFLICT'), 'fallback message')).toBe(
      'Canvas changed elsewhere. Your local edits are still visible. Reload latest or retry from the current draft before applying this action.'
    );
  });

  it('falls back to deterministic fallback text', () => {
    expect(workCanvasActionErrorMessage(new Error('server says no'), 'FB')).toBe('FB');
    expect(workCanvasActionErrorMessage({ data: {} }, 'FB')).toBe('FB');
  });
});
