/**
 * TeresaProposalService — Intent -> Preview -> Commit -> Settle.
 *
 * Covers kernel test requirements:
 *  5. commit without an existing preview -> refused (preview_not_found).
 *  6. commit of an expired preview -> refused (preview_expired).
 *  7. commit of the same preview twice -> the SECOND call is refused
 *     (preview_already_consumed).
 *  8. commit of a preview whose quality verdict is `invalid` -> refused
 *     (quality_invalid).
 *  Bonus (explicitly called out in the task prose though not numbered):
 *  commit against a `frozen` session -> refused (session_frozen).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createKernelTestDb, type KernelTestDbHandle } from './kernelTestDb.js';
import type { TeresaIntent, TeresaProposedChange, TeresaQualityVerdict, TeresaStatement } from '../contracts/index.js';

let testDb: KernelTestDbHandle;

vi.mock('../../utils/DbPromise.js', async () => {
  const { createKernelTestDb } = await import('./kernelTestDb.js');
  testDb = createKernelTestDb();
  return { ...testDb, default: testDb };
});

const { TeresaProposalService } = await import('../TeresaProposalService.js');

const organizationId = 'org-1';
const sessionId = 'session-1';

const validQuality: TeresaQualityVerdict = { verdict: 'valid', failedChecks: [] };
const invalidQuality: TeresaQualityVerdict = {
  verdict: 'invalid',
  failedChecks: ['names_unit_and_level', 'no_invented_number'],
};

const intent: TeresaIntent = {
  capabilityId: 'draft_score_proposal',
  sessionId,
  unitId: 'unit-1',
  invokedBy: 'local_action',
  actorUserId: 'user-1',
};

const statements: TeresaStatement[] = [
  { kind: 'proposal', text: 'Proposed level 3 for unit-1', sourceRefs: [] },
];

const proposedChanges: TeresaProposedChange[] = [
  { target: 'score_proposal', targetId: 'unit-1', before: null, after: { level: 3 } },
];

describe('TeresaProposalService', () => {
  let service: InstanceType<typeof TeresaProposalService>;

  beforeEach(() => {
    testDb.reset();
    service = new TeresaProposalService();
  });

  it('createPreview persists a preview and returns the contract shape', async () => {
    const preview = await service.createPreview({
      organizationId,
      intent,
      statements,
      proposedChanges,
      quality: validQuality,
    });
    expect(preview.previewId).toBeTruthy();
    expect(preview.quality).toEqual(validQuality);
    expect(testDb.getRows('method_teresa_previews')).toHaveLength(1);
  });

  it('requirement 5: commit without an existing preview is refused (preview_not_found)', async () => {
    const result = await service.commit(organizationId, {
      previewId: 'does-not-exist',
      decision: 'accept',
      actorUserId: 'user-1',
      idempotencyKey: 'commit-1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal).toEqual({ kind: 'preview_not_found' });
  });

  it('requirement 6: commit of an expired preview is refused (preview_expired)', async () => {
    const preview = await service.createPreview({
      organizationId,
      intent,
      statements,
      proposedChanges,
      quality: validQuality,
      ttlMs: -1000, // already expired the moment it was created
    });

    const result = await service.commit(organizationId, {
      previewId: preview.previewId,
      decision: 'accept',
      actorUserId: 'user-1',
      idempotencyKey: 'commit-2',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal.kind).toBe('preview_expired');
    }
  });

  it('requirement 7: committing the same preview twice refuses the second call (preview_already_consumed)', async () => {
    const preview = await service.createPreview({
      organizationId,
      intent,
      statements,
      proposedChanges,
      quality: validQuality,
    });

    const first = await service.commit(organizationId, {
      previewId: preview.previewId,
      decision: 'accept',
      actorUserId: 'user-1',
      idempotencyKey: 'commit-3a',
    });
    expect(first.ok).toBe(true);

    const second = await service.commit(organizationId, {
      previewId: preview.previewId,
      decision: 'accept',
      actorUserId: 'user-1',
      idempotencyKey: 'commit-3b',
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.refusal).toEqual({ kind: 'preview_already_consumed' });
  });

  it('requirement 8: commit of a preview with quality verdict `invalid` is refused (quality_invalid)', async () => {
    const preview = await service.createPreview({
      organizationId,
      intent,
      statements,
      proposedChanges,
      quality: invalidQuality,
    });

    const result = await service.commit(organizationId, {
      previewId: preview.previewId,
      decision: 'accept',
      actorUserId: 'user-1',
      idempotencyKey: 'commit-4',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toEqual({
        kind: 'quality_invalid',
        failedChecks: invalidQuality.failedChecks,
      });
    }
  });

  it('bonus: commit against a frozen session is refused (session_frozen)', async () => {
    testDb.insertRow('method_sessions', { id: sessionId, state: 'frozen' });
    const preview = await service.createPreview({
      organizationId,
      intent,
      statements,
      proposedChanges,
      quality: validQuality,
    });

    const result = await service.commit(organizationId, {
      previewId: preview.previewId,
      decision: 'accept',
      actorUserId: 'user-1',
      idempotencyKey: 'commit-5',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal).toEqual({ kind: 'session_frozen' });
  });
});
