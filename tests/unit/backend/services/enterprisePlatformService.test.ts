import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryAll = vi.fn();
const mockQueryFirst = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryFirst: (...args: unknown[]) => mockQueryFirst(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('uuid', () => ({
  v4: () => 'obs-uuid',
}));

describe('EnterprisePlatformService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes connector health checks by organization', async () => {
    mockQueryRun.mockResolvedValue({ changes: 0 });

    const { enterprisePlatformService } = await import(
      '../../../../server/src/services/enterprisePlatformService.js'
    );
    const result = await enterprisePlatformService.healthCheckConnector('org-1', 'connector-1', 'healthy');

    expect(result).toEqual({ ok: false });
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('organization_id=$3'),
      ['healthy', 'connector-1', 'org-1'],
    );
  });

  it('scopes queue processing lookups and updates by organization', async () => {
    mockQueryFirst.mockResolvedValue({ retry_count: 0, max_retries: 3 });
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const { enterprisePlatformService } = await import(
      '../../../../server/src/services/enterprisePlatformService.js'
    );
    const result = await enterprisePlatformService.processQueueItem('org-1', 'queue-1', false, 'boom');

    expect(result).toEqual({ ok: true });
    expect(mockQueryFirst).toHaveBeenCalledWith(
      expect.stringContaining('organization_id=$2'),
      ['queue-1', 'org-1'],
    );
    expect(mockQueryRun).toHaveBeenLastCalledWith(
      expect.stringContaining('organization_id=$3'),
      ['boom', 'queue-1', 'org-1'],
    );
  });

  it('filters metrics by organization', async () => {
    mockQueryAll.mockResolvedValue([]);

    const { enterprisePlatformService } = await import(
      '../../../../server/src/services/enterprisePlatformService.js'
    );
    await enterprisePlatformService.getMetrics('org-1', 'latency_ms', '2026-03-07T00:00:00.000Z');

    expect(mockQueryAll).toHaveBeenCalledWith(
      expect.stringContaining('organization_id=$1'),
      ['org-1', 'latency_ms', '2026-03-07T00:00:00.000Z'],
    );
  });

  it('persists trace organization_id and scopes trace reads', async () => {
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockQueryAll.mockResolvedValue([]);

    const { enterprisePlatformService } = await import(
      '../../../../server/src/services/enterprisePlatformService.js'
    );

    await enterprisePlatformService.recordTrace({
      organizationId: 'org-1',
      traceId: 'trace-1',
      spanId: 'span-1',
      operationName: 'op',
    });
    await enterprisePlatformService.getTrace('org-1', 'trace-1');

    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('organization_id'),
      ['obs-uuid', 'org-1', 'trace-1', 'span-1', null, 'op', 'consultify-api', null, null, '{}', null, null],
    );
    expect(mockQueryAll).toHaveBeenCalledWith(
      expect.stringContaining('organization_id=$1 AND trace_id=$2'),
      ['org-1', 'trace-1'],
    );
  });
});
