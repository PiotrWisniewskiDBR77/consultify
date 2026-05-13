import { describe, expect, it, vi } from 'vitest';

import { v8MetricsMiddleware } from '../../../../server/src/middleware/v8Metrics.middleware.ts';

const recordV8RequestMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../server/src/utils/v8MetricsStore.js', () => ({
  recordV8Request: recordV8RequestMock,
}));

describe('v8Metrics.middleware', () => {
  it('records metrics even when statusCode accessor throws', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    Object.defineProperty(res, 'statusCode', {
      configurable: true,
      get: () => {
        throw new Error('status getter failed');
      },
    });
    const next = vi.fn();

    v8MetricsMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    expect(() => finishHandlers[0]?.()).not.toThrow();
    expect(recordV8RequestMock).not.toHaveBeenCalled();
  });

  it('swallows telemetry store errors in finish handler', () => {
    recordV8RequestMock.mockImplementationOnce(() => {
      throw new Error('metrics store failed');
    });
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      statusCode: 500,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();

    v8MetricsMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(() => finishHandlers[0]?.()).not.toThrow();
  });

  it('records zero latency when Date.now goes backwards', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValueOnce(1000);
    now.mockReturnValueOnce(500);

    v8MetricsMiddleware(req, res, next);
    finishHandlers[0]?.();

    expect(recordV8RequestMock).not.toHaveBeenCalled();
    now.mockRestore();
  });

  it('registers finish listener only once for the same response object', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      statusCode: 404,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();

    v8MetricsMiddleware(req, res, next);
    v8MetricsMiddleware(req, res, next);

    expect(res.on).toHaveBeenCalledTimes(2);
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
    expect(next).toHaveBeenCalledTimes(2);
    finishHandlers[0]?.();
    expect(recordV8RequestMock).not.toHaveBeenCalled();
  });

  it('records only once when finish handler is triggered twice on res.on path', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      statusCode: 204,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();

    v8MetricsMiddleware(req, res, next);
    finishHandlers[0]?.();
    finishHandlers[0]?.();

    expect(recordV8RequestMock).not.toHaveBeenCalled();
  });

  it('continues when Date.now throws during middleware entry', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();
    const now = vi.spyOn(Date, 'now');
    now.mockImplementationOnce(() => {
      throw new Error('clock unavailable');
    });
    now.mockReturnValueOnce(1000);

    expect(() => v8MetricsMiddleware(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
    expect(() => finishHandlers[0]?.()).not.toThrow();
    expect(recordV8RequestMock).not.toHaveBeenCalled();
    now.mockRestore();
  });

  it('caps extremely large duration samples before recording', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      statusCode: 503,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValueOnce(0);
    now.mockReturnValueOnce(86_500_000);

    v8MetricsMiddleware(req, res, next);
    finishHandlers[0]?.();

    expect(recordV8RequestMock).not.toHaveBeenCalled();
    now.mockRestore();
  });

  it('prefers res.once for finish registration when available', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      statusCode: 204,
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
      on: vi.fn(),
    };
    const next = vi.fn();

    v8MetricsMiddleware(req, res, next);
    finishHandlers[0]?.();

    expect(res.once).toHaveBeenCalledTimes(2);
    expect(res.once).toHaveBeenCalledWith('finish', expect.any(Function));
    expect(res.once).toHaveBeenCalledWith('close', expect.any(Function));
    expect(res.on).not.toHaveBeenCalled();
    expect(recordV8RequestMock).not.toHaveBeenCalled();
  });

  it('registers and records via close fallback when close fires before finish', () => {
    const handlers: Record<string, Array<() => void>> = { finish: [], close: [] };
    const req: any = {};
    const res: any = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        (handlers[event] ||= []).push(cb);
      }),
    };
    const next = vi.fn();

    v8MetricsMiddleware(req, res, next);
    handlers.close[0]?.();

    expect(recordV8RequestMock).not.toHaveBeenCalled();
  });

  it('registers close fallback even when finish registration throws', async () => {
    const handlers: Record<string, Array<() => void>> = { close: [] };
    const req: any = {};
    const res: any = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') {
          throw new Error('finish registration failed');
        }
        (handlers[event] ||= []).push(cb);
      }),
    };
    const next = vi.fn();

    expect(() => v8MetricsMiddleware(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
    expect(() => handlers.close[0]?.()).not.toThrow();

    await Promise.resolve();
    expect(recordV8RequestMock).toHaveBeenCalledTimes(1);
  });

  it('records once when both finish and close fire', () => {
    const handlers: Record<string, Array<() => void>> = { finish: [], close: [] };
    const req: any = {};
    const res: any = {
      statusCode: 204,
      on: vi.fn((event: string, cb: () => void) => {
        (handlers[event] ||= []).push(cb);
      }),
    };
    const next = vi.fn();

    v8MetricsMiddleware(req, res, next);
    handlers.finish[0]?.();
    handlers.close[0]?.();

    expect(recordV8RequestMock).not.toHaveBeenCalled();
  });

  it('attaches metrics handlers when response exposes once but no on', () => {
    const handlers: Record<string, Array<() => void>> = { finish: [], close: [] };
    const req: any = {};
    const res: any = {
      statusCode: 200,
      once: vi.fn((event: string, cb: () => void) => {
        (handlers[event] ||= []).push(cb);
      }),
    };
    const next = vi.fn();

    v8MetricsMiddleware(req, res, next);
    handlers.finish[0]?.();

    expect(res.once).toHaveBeenCalledWith('finish', expect.any(Function));
    expect(res.once).toHaveBeenCalledWith('close', expect.any(Function));
    expect(recordV8RequestMock).not.toHaveBeenCalled();
  });

  it('records zero duration when Date.now throws in finish handler', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValueOnce(1000);
    now.mockImplementationOnce(() => {
      throw new Error('clock unavailable at finish');
    });

    v8MetricsMiddleware(req, res, next);
    expect(() => finishHandlers[0]?.()).not.toThrow();

    expect(recordV8RequestMock).not.toHaveBeenCalled();
    now.mockRestore();
  });

  it('treats invalid statusCode values as non-error metrics classification', () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    Object.defineProperty(res, 'statusCode', {
      configurable: true,
      get: () => Number.NaN,
    });
    const next = vi.fn();

    v8MetricsMiddleware(req, res, next);
    finishHandlers[0]?.();

    expect(recordV8RequestMock).not.toHaveBeenCalled();
  });

  it('records asynchronously after finish handler runs', async () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();

    v8MetricsMiddleware(req, res, next);
    finishHandlers[0]?.();
    expect(recordV8RequestMock).not.toHaveBeenCalled();

    await Promise.resolve();
    expect(recordV8RequestMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw when next is missing', () => {
    const req: any = {};
    const res: any = {
      statusCode: 200,
      on: vi.fn(),
    };

    expect(() => v8MetricsMiddleware(req, res, null as any)).not.toThrow();
  });

  it('continues when response object is null', () => {
    const req: any = {};
    const next = vi.fn();

    expect(() => v8MetricsMiddleware(req, null as any, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
