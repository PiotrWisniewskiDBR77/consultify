import { describe, expect, it } from 'vitest';

import {
  compactObject,
  normalizeResolutionMeta,
  normalizeStringArray,
  normalizeWorkflowMeta,
  normalizeWorkflowTimeline,
  safeJsonParse,
  shapeFeedbackRow,
} from '../feedbackShape.js';

describe('feedbackShape.compactObject', () => {
  it('strips undefined, null, empty strings and empty arrays', () => {
    expect(
      compactObject({
        a: 'x',
        b: '',
        c: null,
        d: undefined,
        e: [],
        f: ['y'],
        g: 0,
        h: false,
      })
    ).toEqual({ a: 'x', f: ['y'], g: 0, h: false });
  });
});

describe('feedbackShape.normalizeStringArray', () => {
  it('coerces + trims and drops empty entries', () => {
    expect(normalizeStringArray(['a', '  b  ', '', null, undefined, 42])).toEqual([
      'a',
      'b',
      '42',
    ]);
  });

  it('returns [] for non-array', () => {
    expect(normalizeStringArray(undefined)).toEqual([]);
    expect(normalizeStringArray('abc')).toEqual([]);
    expect(normalizeStringArray({})).toEqual([]);
  });
});

describe('feedbackShape.safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse<{ a: number }>('{"a":1}', { a: 0 })).toEqual({ a: 1 });
  });

  it('returns fallback on invalid JSON', () => {
    expect(safeJsonParse('not json', { a: 0 })).toEqual({ a: 0 });
  });

  it('returns fallback for non-string input', () => {
    expect(safeJsonParse(undefined, { a: 1 })).toEqual({ a: 1 });
    expect(safeJsonParse(42, { a: 1 })).toEqual({ a: 1 });
  });
});

describe('feedbackShape.normalizeWorkflowMeta', () => {
  it('returns empty object for missing workflow', () => {
    expect(normalizeWorkflowMeta({})).toEqual({});
  });

  it('maps scalar workflow keys and drops empty/null values', () => {
    expect(
      normalizeWorkflowMeta({
        workflow: {
          owner: 'piotr@dbr77.com',
          cluster: '',
          source: 'cursor',
          branch: null,
          prUrl: 'https://github.com/x/y/pull/1',
          deployTargets: ['staging', ' production '],
        },
      })
    ).toEqual({
      owner: 'piotr@dbr77.com',
      source: 'cursor',
      prUrl: 'https://github.com/x/y/pull/1',
      deployTargets: ['staging', 'production'],
    });
  });

  it('falls back to top-level linkedTaskId when workflow has none', () => {
    expect(
      normalizeWorkflowMeta({
        workflow: { owner: 'o' },
        linkedTaskId: 'task_123',
      })
    ).toMatchObject({ linkedTaskId: 'task_123' });
  });

  it('ignores array / non-object workflow', () => {
    expect(normalizeWorkflowMeta({ workflow: [1, 2, 3] })).toEqual({});
    expect(normalizeWorkflowMeta({ workflow: 'bad' })).toEqual({});
  });
});

describe('feedbackShape.normalizeResolutionMeta', () => {
  it('maps resolution fields and drops empty ones', () => {
    expect(
      normalizeResolutionMeta({
        resolution: {
          type: 'fixed',
          summary: 'Done',
          rootCause: '',
          verificationNotes: null,
          testPlan: ['step 1', ' ', 'step 2'],
        },
      })
    ).toEqual({
      type: 'fixed',
      summary: 'Done',
      testPlan: ['step 1', 'step 2'],
    });
  });
});

describe('feedbackShape.normalizeWorkflowTimeline', () => {
  it('returns [] for missing or invalid timeline', () => {
    expect(normalizeWorkflowTimeline({})).toEqual([]);
    expect(normalizeWorkflowTimeline({ workflowTimeline: 'nope' })).toEqual([]);
  });

  it('keeps entries and synthesises missing fields', () => {
    const out = normalizeWorkflowTimeline({
      workflowTimeline: [
        {
          id: 'e1',
          at: '2026-04-16T10:00:00Z',
          actor: 'cursor',
          action: 'workflow_updated',
          note: 'picked up',
          changes: ['source', 'branch'],
        },
        // broken / partial entry — should be normalised, not dropped
        { action: 'status_changed' },
        // non-object -> skipped
        null,
        42,
      ],
    });

    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      id: 'e1',
      actor: 'cursor',
      action: 'workflow_updated',
      note: 'picked up',
      changes: ['source', 'branch'],
    });
    expect(out[1].action).toBe('status_changed');
    expect(typeof out[1].id).toBe('string');
    expect(typeof out[1].at).toBe('string');
  });
});

describe('feedbackShape.shapeFeedbackRow', () => {
  it('surfaces workflow + resolution + triage fields as top-level props', () => {
    const row = {
      id: 'f-1',
      user_id: 'u-1',
      user_email: null,
      user_name: null,
      metadata: JSON.stringify({
        userEmail: 'u@example.com',
        userName: 'Ola',
        routePath: '/superadmin/users',
        deviceType: 'desktop',
        screenSize: '1920x1080',
        uiLanguage: 'pl',
        uiTheme: 'dark',
        signatureHash: 'sig-abc',
        duplicateOf: 'f-0',
        duplicateCandidates: [{ id: 'f-0', title: 'Earlier ticket' }],
        duplicateCount: 3,
        dossier: {
          screenshot: { storage: 'file' },
          consoleLogs: [{ level: 'error', message: 'x' }],
        },
        workflow: { owner: 'cursor', cluster: 'Superadmin Users', source: 'cursor' },
        resolution: { type: 'fixed', summary: 'done' },
      }),
    };

    const shaped = shapeFeedbackRow(row) as Record<string, unknown>;

    expect(shaped.user_email).toBe('u@example.com');
    expect(shaped.user_name).toBe('Ola');
    expect(shaped.route_path).toBe('/superadmin/users');
    expect(shaped.device_type).toBe('desktop');
    expect(shaped.owner).toBe('cursor');
    expect(shaped.cluster).toBe('Superadmin Users');
    expect(shaped.resolution_summary).toBe('done');
    expect(shaped.duplicate_count).toBe(3);
    expect(shaped.duplicate_of).toBe('f-0');
    expect(shaped.signature_hash).toBe('sig-abc');
    expect(shaped.has_screenshot).toBe(true);
    expect(shaped.has_diagnostics).toBe(true);
  });

  it('falls back to empty-ish defaults when metadata is blank', () => {
    const shaped = shapeFeedbackRow({
      id: 'f-2',
      user_id: 'u-2',
      metadata: null,
    }) as Record<string, unknown>;

    expect(shaped.duplicate_count).toBe(0);
    expect(shaped.signature_hash).toBeNull();
    expect(shaped.has_screenshot).toBe(false);
    expect(shaped.has_diagnostics).toBe(false);
    expect(shaped.workflow).toEqual({});
    expect(shaped.resolution).toEqual({});
    expect(shaped.workflowTimeline).toEqual([]);
  });

  it('uses candidate array length when duplicateCount is missing', () => {
    const shaped = shapeFeedbackRow({
      id: 'f-3',
      user_id: 'u-3',
      metadata: JSON.stringify({
        duplicateCandidates: [{ id: 'a' }, { id: 'b' }],
      }),
    }) as Record<string, unknown>;

    expect(shaped.duplicate_count).toBe(2);
  });
});
