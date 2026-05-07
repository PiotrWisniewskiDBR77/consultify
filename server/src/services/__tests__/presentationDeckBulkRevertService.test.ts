import { describe, expect, it } from 'vitest';

import {
  evaluateBulkRevertEligibility,
  planBulkRevert,
  type BulkRevertOpRow,
} from '../presentationDeckBulkRevertService.js';

function buildRow(overrides: Partial<BulkRevertOpRow> = {}): BulkRevertOpRow {
  return {
    id: 'op-1',
    deckId: 'deck-1',
    organizationId: 'org-1',
    status: 'applied',
    originalDeckJson: '{"cards":[]}',
    versionBefore: 1,
    versionAfter: 2,
    createdAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('planBulkRevert', () => {
  it('happy path: 3 consecutive applied ops sorted DESC with oldest as baseSnapshot', () => {
    const rows: BulkRevertOpRow[] = [
      buildRow({ id: 'op-a', createdAt: '2026-05-01T10:00:00.000Z' }),
      buildRow({ id: 'op-b', createdAt: '2026-05-01T11:00:00.000Z' }),
      buildRow({ id: 'op-c', createdAt: '2026-05-01T12:00:00.000Z' }),
    ];
    const result = planBulkRevert({
      requestedIds: ['op-a', 'op-b', 'op-c'],
      rows,
      deckId: 'deck-1',
      organizationId: 'org-1',
    });
    expect(result.rejected).toEqual([]);
    expect(result.ordered.map((r) => r.id)).toEqual(['op-c', 'op-b', 'op-a']);
    expect(result.baseSnapshot?.id).toBe('op-a');
  });

  it('rejects unknown id with reason not_found', () => {
    const rows: BulkRevertOpRow[] = [
      buildRow({ id: 'op-a', createdAt: '2026-05-01T10:00:00.000Z' }),
    ];
    const result = planBulkRevert({
      requestedIds: ['op-a', 'op-missing'],
      rows,
      deckId: 'deck-1',
      organizationId: 'org-1',
    });
    expect(result.ordered.map((r) => r.id)).toEqual(['op-a']);
    expect(result.rejected).toContainEqual({
      operationId: 'op-missing',
      reason: 'not_found',
    });
  });

  it('rejects org mismatch', () => {
    const rows: BulkRevertOpRow[] = [
      buildRow({ id: 'op-a', organizationId: 'org-other' }),
      buildRow({ id: 'op-b' }),
    ];
    const result = planBulkRevert({
      requestedIds: ['op-a', 'op-b'],
      rows,
      deckId: 'deck-1',
      organizationId: 'org-1',
    });
    expect(result.ordered.map((r) => r.id)).toEqual(['op-b']);
    expect(result.rejected).toContainEqual({
      operationId: 'op-a',
      reason: 'org_mismatch',
    });
  });

  it('rejects deck mismatch', () => {
    const rows: BulkRevertOpRow[] = [
      buildRow({ id: 'op-a', deckId: 'deck-other' }),
      buildRow({ id: 'op-b' }),
    ];
    const result = planBulkRevert({
      requestedIds: ['op-a', 'op-b'],
      rows,
      deckId: 'deck-1',
      organizationId: 'org-1',
    });
    expect(result.ordered.map((r) => r.id)).toEqual(['op-b']);
    expect(result.rejected).toContainEqual({
      operationId: 'op-a',
      reason: 'deck_mismatch',
    });
  });

  it('dedupes duplicate ids and tags second occurrence as duplicate', () => {
    const rows: BulkRevertOpRow[] = [
      buildRow({ id: 'op-a', createdAt: '2026-05-01T10:00:00.000Z' }),
      buildRow({ id: 'op-b', createdAt: '2026-05-01T11:00:00.000Z' }),
    ];
    const result = planBulkRevert({
      requestedIds: ['op-a', 'op-b', 'op-a'],
      rows,
      deckId: 'deck-1',
      organizationId: 'org-1',
    });
    expect(result.ordered.map((r) => r.id)).toEqual(['op-b', 'op-a']);
    expect(result.rejected).toContainEqual({
      operationId: 'op-a',
      reason: 'duplicate',
    });
  });

  it('sorts DESC by createdAt and picks oldest as baseSnapshot', () => {
    const rows: BulkRevertOpRow[] = [
      buildRow({ id: 'op-mid', createdAt: '2026-05-01T11:00:00.000Z' }),
      buildRow({ id: 'op-old', createdAt: '2026-05-01T09:00:00.000Z' }),
      buildRow({ id: 'op-new', createdAt: '2026-05-01T13:00:00.000Z' }),
    ];
    const result = planBulkRevert({
      requestedIds: ['op-mid', 'op-old', 'op-new'],
      rows,
      deckId: 'deck-1',
      organizationId: 'org-1',
    });
    expect(result.ordered.map((r) => r.id)).toEqual(['op-new', 'op-mid', 'op-old']);
    expect(result.baseSnapshot?.id).toBe('op-old');
  });
});

describe('evaluateBulkRevertEligibility', () => {
  it('happy path: 3 consecutive applied ops, all eligible', () => {
    const ordered: BulkRevertOpRow[] = [
      buildRow({ id: 'op-c', createdAt: '2026-05-01T12:00:00.000Z' }),
      buildRow({ id: 'op-b', createdAt: '2026-05-01T11:00:00.000Z' }),
      buildRow({ id: 'op-a', createdAt: '2026-05-01T10:00:00.000Z' }),
    ];
    const result = evaluateBulkRevertEligibility({
      ordered,
      newerAppliedAfterOldestCount: 3,
    });
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.baseSnapshotId).toBe('op-a');
  });

  it('blocks when oldest selected op has no snapshot', () => {
    const ordered: BulkRevertOpRow[] = [
      buildRow({ id: 'op-b', createdAt: '2026-05-01T11:00:00.000Z' }),
      buildRow({
        id: 'op-a',
        createdAt: '2026-05-01T10:00:00.000Z',
        originalDeckJson: null,
      }),
    ];
    const result = evaluateBulkRevertEligibility({
      ordered,
      newerAppliedAfterOldestCount: 2,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('op_op-a_no_snapshot');
    expect(result.baseSnapshotId).toBe('op-a');
  });

  it('blocks when one selected op has draft status', () => {
    const ordered: BulkRevertOpRow[] = [
      buildRow({ id: 'op-c', createdAt: '2026-05-01T12:00:00.000Z' }),
      buildRow({ id: 'op-b', createdAt: '2026-05-01T11:00:00.000Z', status: 'draft' }),
      buildRow({ id: 'op-a', createdAt: '2026-05-01T10:00:00.000Z' }),
    ];
    const result = evaluateBulkRevertEligibility({
      ordered,
      newerAppliedAfterOldestCount: 3,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('op_op-b_not_applied');
  });

  it('blocks newer_op_outside_selection when an applied op outside the selection sits between oldest and HEAD', () => {
    const ordered: BulkRevertOpRow[] = [
      buildRow({ id: 'op-c', createdAt: '2026-05-01T12:00:00.000Z' }),
      buildRow({ id: 'op-a', createdAt: '2026-05-01T10:00:00.000Z' }),
    ];
    const result = evaluateBulkRevertEligibility({
      ordered,
      newerAppliedAfterOldestCount: 3,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('newer_op_outside_selection');
    expect(result.baseSnapshotId).toBe('op-a');
  });
});
