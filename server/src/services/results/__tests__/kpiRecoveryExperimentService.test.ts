import { describe, expect, it, vi } from 'vitest';
import type { IDatabase } from '../../../database/IDatabase.js';
import {
  confirmRecoveryCause,
  createRecoveryExperiment,
  RecoveryExperimentError,
} from '../kpiRecoveryExperimentService.js';

function db(overrides: Partial<IDatabase> = {}): IDatabase {
  return {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    query: vi.fn(),
    exec: vi.fn(),
    serialize: vi.fn(),
    close: vi.fn(),
    ...overrides,
  } as IDatabase;
}

describe('kpiRecoveryExperimentService U04 owner contract', () => {
  it('fails tenant ownership closed before any experiment write', async () => {
    const database = db({ get: vi.fn().mockResolvedValue(null), run: vi.fn() });
    await expect(
      createRecoveryExperiment({
        db: database,
        orgId: 'org-a',
        cardId: 'foreign',
        actorUserId: 'u1',
        idempotencyKey: 'idem',
        intervention: 'x',
        baseline: 'b',
        measurementWindow: '30d',
        successCriterion: 's',
        ownerUserId: 'owner',
        remeasureAt: '2099-01-01T00:00:00Z',
      })
    ).rejects.toMatchObject({ code: 'RESULTS_RECOVERY_CARD_NOT_FOUND' });
    expect(database.run).not.toHaveBeenCalled();
  });

  it('requires a future explicit remeasureAt', async () => {
    const database = db({ get: vi.fn().mockResolvedValue({ id: 'card', kpi_id: 'kpi' }) });
    await expect(
      createRecoveryExperiment({
        db: database,
        orgId: 'org',
        cardId: 'card',
        actorUserId: 'u1',
        idempotencyKey: 'idem',
        intervention: 'x',
        baseline: 'b',
        measurementWindow: '30d',
        successCriterion: 's',
        ownerUserId: 'owner',
        remeasureAt: '2000-01-01T00:00:00Z',
      })
    ).rejects.toBeInstanceOf(RecoveryExperimentError);
  });

  it('does not infer confirmed cause and requires separate human evidence', async () => {
    const database = db({
      get: vi.fn().mockResolvedValue({ id: 'card', kpi_id: 'kpi' }),
      run: vi.fn(),
    });
    await expect(
      confirmRecoveryCause({
        db: database,
        orgId: 'org',
        cardId: 'card',
        actorUserId: 'u1',
        cause: '',
        evidence: '',
        idempotencyKey: 'idem',
      })
    ).rejects.toMatchObject({ code: 'RESULTS_RECOVERY_CAUSE_EVIDENCE_REQUIRED' });
    expect(database.run).not.toHaveBeenCalled();
  });
});
