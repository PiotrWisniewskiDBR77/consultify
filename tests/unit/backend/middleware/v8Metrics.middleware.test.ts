import { describe, expect, it, vi } from 'vitest';

import { v8MetricsMiddleware } from '../../../../server/src/middleware/v8Metrics.middleware.ts';

const recordV8RequestMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../server/src/utils/v8MetricsStore.js', () => ({
  recordV8Request: recordV8RequestMock,
}));

describe('v8Metrics.middleware', () => {
  const flushNextTick = async (): Promise<void> =>
    new Promise<void>((resolve) => {
      process.nextTick(resolve);
    });
  const flushObservation = async (): Promise<void> => {
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    await flushNextTick();
  };

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
  });

  it('records metrics when response is already writableEnded before listener execution', async () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      statusCode: 200,
      writableEnded: true,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();

    v8MetricsMiddleware(req, res, next);

    await flushObservation();
    expect(recordV8RequestMock).toHaveBeenCalledTimes(1);
    expect(() => finishHandlers[0]?.()).not.toThrow();
    await flushObservation();
    expect(recordV8RequestMock).toHaveBeenCalledTimes(1);
  });

  it('records metrics when response is already finished before listener execution', async () => {
    const req: any = {};
    const res: any = {
      statusCode: 500,
      finished: true,
      on: vi.fn(),
    };
    const next = vi.fn();

    v8MetricsMiddleware(req, res, next);

    await flushObservation();
    expect(recordV8RequestMock).toHaveBeenCalledWith(expect.any(Number), true);
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

  it('records zero latency when Date.now goes backwards', async () => {
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
    const monotonicNow = vi.spyOn(performance, 'now');
    now.mockReturnValueOnce(1000);
    now.mockReturnValueOnce(500);
    monotonicNow.mockImplementation(() => {
      throw new Error('monotonic clock unavailable');
    });

    v8MetricsMiddleware(req, res, next);
    finishHandlers[0]?.();

    await flushObservation();
    expect(recordV8RequestMock).toHaveBeenCalledWith(0, false);
    now.mockRestore();
    monotonicNow.mockRestore();
  });

  it('registers finish listener only once for the same response object', async () => {
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
    await flushObservation();
    expect(recordV8RequestMock).toHaveBeenCalledTimes(1);
  });

  it('records only once when finish handler is triggered twice on res.on path', async () => {
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

    await flushObservation();
    expect(recordV8RequestMock).toHaveBeenCalledTimes(1);
  });

  it('continues when Date.now throws during middleware entry', async () => {
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
    const monotonicNow = vi.spyOn(performance, 'now');
    now.mockImplementationOnce(() => {
      throw new Error('clock unavailable');
    });
    now.mockReturnValueOnce(1000);
    monotonicNow.mockImplementation(() => {
      throw new Error('monotonic clock unavailable');
    });

    expect(() => v8MetricsMiddleware(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
    expect(() => finishHandlers[0]?.()).not.toThrow();
    await flushObservation();
    expect(recordV8RequestMock).toHaveBeenCalledWith(0, false);
    now.mockRestore();
    monotonicNow.mockRestore();
  });

  it('caps extremely large duration samples before recording', async () => {
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
    const monotonicNow = vi.spyOn(performance, 'now');
    now.mockReturnValueOnce(0);
    now.mockReturnValueOnce(86_500_000);
    monotonicNow.mockImplementation(() => {
      throw new Error('monotonic clock unavailable');
    });

    v8MetricsMiddleware(req, res, next);
    finishHandlers[0]?.();

    await flushObservation();
    expect(recordV8RequestMock).toHaveBeenCalledWith(86_400_000, true);
    now.mockRestore();
    monotonicNow.mockRestore();
  });

  it('prefers res.once for finish registration when available', async () => {
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
    await flushObservation();
    expect(recordV8RequestMock).toHaveBeenCalledTimes(1);
  });

  it('registers and records via close fallback when close fires before finish', async () => {
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

    await flushObservation();
    expect(recordV8RequestMock).toHaveBeenCalledTimes(1);
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

    await flushObservation();
    expect(recordV8RequestMock).toHaveBeenCalledTimes(1);
  });

  it('records once when both finish and close fire', async () => {
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

    await flushObservation();
    expect(recordV8RequestMock).toHaveBeenCalledTimes(1);
  });

  it('attaches metrics handlers when response exposes once but no on', async () => {
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
    await flushObservation();
    expect(recordV8RequestMock).toHaveBeenCalledTimes(1);
  });

  it('records zero duration when Date.now throws in finish handler', async () => {
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
    const monotonicNow = vi.spyOn(performance, 'now');
    now.mockReturnValueOnce(1000);
    now.mockImplementationOnce(() => {
      throw new Error('clock unavailable at finish');
    });
    monotonicNow.mockImplementation(() => {
      throw new Error('monotonic clock unavailable');
    });

    v8MetricsMiddleware(req, res, next);
    expect(() => finishHandlers[0]?.()).not.toThrow();

    await flushObservation();
    expect(recordV8RequestMock).toHaveBeenCalledWith(0, false);
    now.mockRestore();
    monotonicNow.mockRestore();
  });

  it('treats invalid statusCode values as non-error metrics classification', async () => {
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

    await flushObservation();
    expect(recordV8RequestMock).toHaveBeenCalledWith(expect.any(Number), false);
  });

  it('falls back when queueMicrotask throws during scheduling', async () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();
    const originalQueueMicrotask = globalThis.queueMicrotask;
    const queueMicrotaskSpy = vi.fn(() => {
      throw new Error('queueMicrotask broken');
    });
    vi.stubGlobal('queueMicrotask', queueMicrotaskSpy as any);
    try {
      v8MetricsMiddleware(req, res, next);
      finishHandlers[0]?.();
      await flushObservation();
      expect(queueMicrotaskSpy).toHaveBeenCalledTimes(1);
      expect(recordV8RequestMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.stubGlobal('queueMicrotask', originalQueueMicrotask as any);
    }
  });

  it('retries listener registration on second pass when initial hook registration fully fails', async () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const onMock = vi
      .fn<(event: string, cb: () => void) => void>()
      .mockImplementationOnce(() => {
        throw new Error('finish registration failed');
      })
      .mockImplementationOnce(() => {
        throw new Error('close registration failed');
      })
      .mockImplementation((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      });
    const res: any = {
      statusCode: 200,
      on: onMock,
    };
    const next = vi.fn();

    v8MetricsMiddleware(req, res, next);
    v8MetricsMiddleware(req, res, next);
    finishHandlers[0]?.();

    await flushObservation();
    expect(next).toHaveBeenCalledTimes(2);
    expect(res.on).toHaveBeenCalledTimes(4);
    expect(recordV8RequestMock).toHaveBeenCalledTimes(1);
  });

  it('falls back past broken queueMicrotask/setImmediate via later scheduler', async () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();
    const originalQueueMicrotask = globalThis.queueMicrotask;
    const originalSetImmediate = globalThis.setImmediate;
    vi.stubGlobal(
      'queueMicrotask',
      vi.fn(() => {
        throw new Error('queueMicrotask failed');
      }) as any
    );
    vi.stubGlobal(
      'setImmediate',
      vi.fn(() => {
        throw new Error('setImmediate failed');
      }) as any
    );
    try {
      v8MetricsMiddleware(req, res, next);
      finishHandlers[0]?.();
      await flushNextTick();
      expect(recordV8RequestMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.stubGlobal('queueMicrotask', originalQueueMicrotask as any);
      vi.stubGlobal('setImmediate', originalSetImmediate as any);
    }
  });

  it('uses nextTick scheduler when queueMicrotask and setImmediate are unavailable', async () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();
    const originalQueueMicrotask = globalThis.queueMicrotask;
    const originalSetImmediate = globalThis.setImmediate;
    vi.stubGlobal(
      'queueMicrotask',
      vi.fn(() => {
        throw new Error('queueMicrotask failed');
      }) as any
    );
    vi.stubGlobal(
      'setImmediate',
      vi.fn(() => {
        throw new Error('setImmediate failed');
      }) as any
    );
    try {
      v8MetricsMiddleware(req, res, next);
      finishHandlers[0]?.();
      expect(recordV8RequestMock).not.toHaveBeenCalled();
      await flushNextTick();
      expect(recordV8RequestMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.stubGlobal('queueMicrotask', originalQueueMicrotask as any);
      vi.stubGlobal('setImmediate', originalSetImmediate as any);
    }
  });

  it('prefers monotonic duration when performance.now is available', async () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      statusCode: 500,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();
    const nowSpy = vi.spyOn(performance, 'now');
    const dateNowSpy = vi.spyOn(Date, 'now');
    dateNowSpy.mockReturnValueOnce(10_000);
    dateNowSpy.mockReturnValueOnce(10_300);
    nowSpy.mockReturnValueOnce(1_000.4);
    nowSpy.mockReturnValueOnce(1_001.1);
    try {
      v8MetricsMiddleware(req, res, next);
      finishHandlers[0]?.();
      await flushObservation();
      expect(recordV8RequestMock).toHaveBeenCalledWith(1, true);
      expect(Number.isInteger(recordV8RequestMock.mock.calls[0]?.[0])).toBe(true);
    } finally {
      nowSpy.mockRestore();
      dateNowSpy.mockRestore();
    }
  });

  it('keeps middleware non-throwing when finish listener fires synchronously during registration', async () => {
    recordV8RequestMock.mockImplementationOnce(() => {
      throw new Error('metrics store failed');
    });
    const req: any = {};
    const res: any = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') cb();
      }),
    };
    const next = vi.fn();

    expect(() => v8MetricsMiddleware(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
    await flushObservation();
    expect(recordV8RequestMock).toHaveBeenCalledTimes(1);
  });

  it('keeps monotonic duration stable when wall clock goes backwards', async () => {
    const finishHandlers: Array<() => void> = [];
    const req: any = {};
    const res: any = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
    };
    const next = vi.fn();
    const nowSpy = vi.spyOn(performance, 'now');
    const dateNowSpy = vi.spyOn(Date, 'now');
    dateNowSpy.mockReturnValueOnce(2_000);
    dateNowSpy.mockReturnValueOnce(1_000);
    nowSpy.mockReturnValueOnce(10);
    nowSpy.mockReturnValueOnce(60);
    try {
      v8MetricsMiddleware(req, res, next);
      finishHandlers[0]?.();
      await flushObservation();
      expect(recordV8RequestMock).toHaveBeenCalledWith(50, false);
    } finally {
      nowSpy.mockRestore();
      dateNowSpy.mockRestore();
    }
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

    await flushObservation();
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
