import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

vi.mock('../../server/src/database/Database.js', () => ({
  getDatabase: () => getDatabase(),
}));

vi.mock('uuid', () => ({ v4: () => 'u1' }));

describe('Webhook retry service - REAL_CODE', () => {
  let nowSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    nowSpy?.mockRestore();
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  });

  afterEach(() => {
    nowSpy?.mockRestore();
    nowSpy = null;
  });

  it('queueForRetry inserts record and returns deterministic id', async () => {
    const run = vi.fn(async () => undefined);
    getDatabase.mockResolvedValue({ run, all: vi.fn(), get: vi.fn() });

    const svc = (await import('../../server/src/services/webhookRetryService.ts')).default as any;
    svc.db = null;

    const id = await svc.queueForRetry({
      webhookType: 'stripe',
      eventType: 'invoice.paid',
      payload: { organization_id: 'org-1' },
    });

    expect(id).toBe('retry-u1');
    expect(run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO webhook_retry_queue'),
      expect.arrayContaining(['retry-u1', 'stripe', 'invoice.paid'])
    );
  });

  it('getPendingRetries passes limit to DB query', async () => {
    const all = vi.fn(async () => []);
    getDatabase.mockResolvedValue({ run: vi.fn(), all, get: vi.fn() });

    const svc = (await import('../../server/src/services/webhookRetryService.ts')).default as any;
    svc.db = null;

    await svc.getPendingRetries(7);
    expect(all).toHaveBeenCalledWith(expect.stringContaining('LIMIT ?'), [7]);
  });

  it('markFailed is a no-op when record does not exist', async () => {
    const get = vi.fn(async () => null);
    const run = vi.fn(async () => undefined);
    getDatabase.mockResolvedValue({ run, all: vi.fn(), get });

    const svc = (await import('../../server/src/services/webhookRetryService.ts')).default as any;
    svc.db = null;

    await svc.markFailed('x', 'err');
    expect(run).not.toHaveBeenCalled();
  });

  it('markFailed schedules a retry when under max_retries', async () => {
    const get = vi.fn(async () => ({
      id: 'r1',
      webhook_type: 'stripe',
      event_type: 'x',
      event_id: null,
      payload: '{}',
      retry_count: 0,
      max_retries: 5,
      next_retry_at: null,
      last_error: null,
      status: 'pending',
      created_at: '',
      updated_at: '',
      completed_at: null,
    }));
    const run = vi.fn(async () => undefined);
    getDatabase.mockResolvedValue({ run, all: vi.fn(), get });

    const svc = (await import('../../server/src/services/webhookRetryService.ts')).default as any;
    svc.db = null;

    await svc.markFailed('r1', 'boom');

    const call = run.mock.calls.find((c) => String(c[0]).includes("SET status = 'pending'"));
    expect(call).toBeDefined();
    expect(call?.[1]).toEqual(expect.arrayContaining([1, expect.any(String), 'boom', 'r1']));
  });

  it('markFailed marks permanently failed when max_retries reached', async () => {
    const get = vi.fn(async () => ({
      id: 'r2',
      webhook_type: 'stripe',
      event_type: 'x',
      event_id: null,
      payload: '{}',
      retry_count: 4,
      max_retries: 5,
      next_retry_at: null,
      last_error: null,
      status: 'pending',
      created_at: '',
      updated_at: '',
      completed_at: null,
    }));
    const run = vi.fn(async () => undefined);
    getDatabase.mockResolvedValue({ run, all: vi.fn(), get });

    const svc = (await import('../../server/src/services/webhookRetryService.ts')).default as any;
    svc.db = null;

    await svc.markFailed('r2', 'boom');

    const call = run.mock.calls.find((c) => String(c[0]).includes("SET status = 'failed'"));
    expect(call).toBeDefined();
    expect(call?.[1]).toEqual([5, 'boom', 'r2']);
  });
});
