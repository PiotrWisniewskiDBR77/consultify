/**
 * `resolveTeresaCellRef`/`formatCellRef` — requirement 7 (CEL 5): a preview
 * must point at the concrete `unitId#level` matrix cell it would change.
 */
import { describe, expect, it } from 'vitest';

import type { TeresaPreview } from '@/method-core/contracts';

import { formatCellRef, formatPreviewCellRef, resolveTeresaCellRef } from '../cellRef';

function makePreview(overrides: Partial<TeresaPreview> = {}): TeresaPreview {
  return {
    previewId: 'preview-1',
    intent: {
      capabilityId: 'draft_score_proposal',
      sessionId: 'session-1',
      unitId: 'unit-1',
      invokedBy: 'local_action',
      actorUserId: 'user-1',
    },
    statements: [],
    proposedChanges: [],
    quality: { verdict: 'valid', failedChecks: [] },
    createdAt: '2026-08-13T09:00:00.000Z',
    expiresAt: '2026-08-13T11:00:00.000Z',
    ...overrides,
  };
}

describe('resolveTeresaCellRef', () => {
  it('uses intent.unitId + intent.level when the capability was invoked against an explicit level', () => {
    const preview = makePreview({
      intent: {
        capabilityId: 'challenge_coverage_and_scale',
        sessionId: 'session-1',
        unitId: 'unit-7',
        level: 3,
        invokedBy: 'local_action',
        actorUserId: 'user-1',
      },
    });
    expect(resolveTeresaCellRef(preview)).toEqual({ unitId: 'unit-7', level: 3 });
    expect(formatCellRef(resolveTeresaCellRef(preview)!)).toBe('unit-7#3');
  });

  it('falls back to a score_proposal proposedChange.after when intent.level is absent', () => {
    const preview = makePreview({
      proposedChanges: [{ target: 'score_proposal', targetId: 'unit-1', before: 1, after: 2 }],
    });
    expect(resolveTeresaCellRef(preview)).toEqual({ unitId: 'unit-1', level: 2 });
    expect(formatPreviewCellRef(preview)).toBe('unit-1#2');
  });

  it('uses the proposedChange targetId as unitId when intent.unitId is missing entirely', () => {
    const preview = makePreview({
      intent: {
        capabilityId: 'draft_score_proposal',
        sessionId: 'session-1',
        invokedBy: 'local_action',
        actorUserId: 'user-1',
      },
      proposedChanges: [{ target: 'score_proposal', targetId: 'unit-9', before: null, after: 1 }],
    });
    expect(resolveTeresaCellRef(preview)).toEqual({ unitId: 'unit-9', level: 1 });
  });

  it('returns null when there is no unit/level to point at (e.g. cluster_findings over multiple units)', () => {
    const preview = makePreview({
      intent: {
        capabilityId: 'cluster_findings',
        sessionId: 'session-1',
        invokedBy: 'local_action',
        actorUserId: 'user-1',
      },
      proposedChanges: [{ target: 'note', targetId: null, before: null, after: 'grouped 4 findings' }],
    });
    expect(resolveTeresaCellRef(preview)).toBeNull();
    expect(formatPreviewCellRef(preview)).toBeNull();
  });
});
