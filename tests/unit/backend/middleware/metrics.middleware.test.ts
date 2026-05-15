import { describe, expect, it, vi } from 'vitest';

import {
  getRequestMetrics,
  metricsMiddleware,
} from '../../../../server/src/middleware/metrics.middleware.js';

describe('metrics.middleware', () => {
  it('caps recorded duration when Date.now jump is excessively large', () => {
    const req: any = { method: 'GET' };
    const res: any = { statusCode: 200, end: vi.fn() };
    const next = vi.fn();
    const before = getRequestMetrics();
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1_000_000_000);

    try {
      metricsMiddleware(req, res, next);
      res.end();
    } finally {
      nowSpy.mockRestore();
    }

    const after = getRequestMetrics();
    expect(after.requests).toBe(before.requests + 1);
    expect(after.latencySum - before.latencySum).toBe(600_000);
  });

  it('records completion metrics from finish event when end is not called', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = { method: 'GET' };
    const res: any = {
      statusCode: 204,
      end: vi.fn(),
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();
    const before = getRequestMetrics();
    const beforeStatus204 = before.byStatus[204] || 0;

    metricsMiddleware(req, res, next);
    finishHandlers[0]?.();

    const after = getRequestMetrics();
    expect(next).toHaveBeenCalledTimes(1);
    expect(after.requests).toBe(before.requests + 1);
    expect((after.byStatus[204] || 0) - beforeStatus204).toBe(1);
  });
});
