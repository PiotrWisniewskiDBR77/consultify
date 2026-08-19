/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({ Api: { post: vi.fn(), patch: vi.fn() } }));

import { Api } from '@/services/api';
import { V8ResultsApi } from '../v8/results';

const action = { id: 'action-1', actionType: 'IMMEDIATE', title: 'Recover',
  status: 'OPEN', taskLinkStatus: 'NONE', rowVersion: 1 };
const checkpoint = { id: 'checkpoint-1', checkpointDate: '2026-08-20',
  status: 'PENDING', rowVersion: 1 };

describe('Results recovery canonical client', () => {
  beforeEach(() => vi.clearAllMocks());

  it('unwraps Axios-like action create and update responses', async () => {
    vi.mocked(Api.post).mockResolvedValueOnce({ data: { action } } as any);
    vi.mocked(Api.patch).mockResolvedValueOnce({ data: { action: { ...action, status: 'DONE', rowVersion: 2 } } } as any);
    await expect(V8ResultsApi.createRecoveryAction('card 1', {
      title: 'Recover', actionType: 'IMMEDIATE', idempotencyKey: 'idem-create-1',
    })).resolves.toEqual(action);
    await expect(V8ResultsApi.updateRecoveryAction('card 1', 'action-1', {
      expectedVersion: 1, status: 'DONE', idempotencyKey: 'idem-update-1',
    })).resolves.toMatchObject({ id: 'action-1', status: 'DONE', rowVersion: 2 });
    expect(Api.post).toHaveBeenCalledWith('/vnext/results/kpi/recovery-cards/card%201/actions', expect.anything());
    expect(Api.patch).toHaveBeenCalledWith('/vnext/results/kpi/recovery-cards/card%201/actions/action-1', expect.anything());
  });

  it('unwraps and validates the atomic task-link identity', async () => {
    vi.mocked(Api.post).mockResolvedValueOnce({ data: {
      linked: true, linkedTaskId: 'task-1',
      action: { ...action, linkedTaskId: 'task-1', taskLinkStatus: 'LINKED', rowVersion: 2 },
    } } as any);
    await expect(V8ResultsApi.linkRecoveryActionTask('card-1', 'action-1', {
      expectedVersion: 1, idempotencyKey: 'idem-link-1',
    })).resolves.toMatchObject({ linkedTaskId: 'task-1', action: { rowVersion: 2 } });
  });

  it('unwraps Axios-like checkpoint create and resolve responses', async () => {
    vi.mocked(Api.post).mockResolvedValueOnce({ data: { checkpoint } } as any);
    vi.mocked(Api.patch).mockResolvedValueOnce({ data: { checkpoint: {
      ...checkpoint, status: 'MISSED', rowVersion: 2,
    } } } as any);
    await expect(V8ResultsApi.createRecoveryCheckpoint('card-1', {
      checkpointDate: '2026-08-20', idempotencyKey: 'idem-checkpoint-1',
    })).resolves.toEqual(checkpoint);
    await expect(V8ResultsApi.resolveRecoveryCheckpoint('card-1', 'checkpoint-1', {
      expectedVersion: 1, status: 'MISSED', idempotencyKey: 'idem-resolve-1',
    })).resolves.toMatchObject({ status: 'MISSED', rowVersion: 2 });
  });

  it('fails closed when canonical identity or rowVersion is missing', async () => {
    vi.mocked(Api.post).mockResolvedValueOnce({ data: { action: { id: 'action-1' } } } as any);
    await expect(V8ResultsApi.createRecoveryAction('card-1', {
      title: 'Recover', actionType: 'IMMEDIATE', idempotencyKey: 'idem-create-2',
    })).rejects.toThrow('incomplete');
  });
});
