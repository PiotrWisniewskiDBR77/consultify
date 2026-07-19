import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isMutationAborted,
  isMutationAbortCanaryEnabled,
  mutationAbortCanary,
} from '../../../../server/src/middleware/mutationGuard.middleware.ts';

const withGuardEnabled = <T>(fn: () => T): T => {
  const original = process.env.ENABLE_MUTATION_ABORT_GUARD;
  process.env.ENABLE_MUTATION_ABORT_GUARD = 'true';
  try {
    return fn();
  } finally {
    if (original === undefined) delete process.env.ENABLE_MUTATION_ABORT_GUARD;
    else process.env.ENABLE_MUTATION_ABORT_GUARD = original;
  }
};

describe('mutationGuard.middleware', () => {
  afterEach(() => {
    delete process.env.ENABLE_MUTATION_ABORT_GUARD;
  });

  it('defaults to disabled (opt-in kill-switch)', () => {
    expect(isMutationAbortCanaryEnabled()).toBe(false);
  });

  it('is enabled only when ENABLE_MUTATION_ABORT_GUARD=true', () => {
    withGuardEnabled(() => {
      expect(isMutationAbortCanaryEnabled()).toBe(true);
    });
  });

  it('always calls next() and never touches res when disabled', () => {
    const req: any = { method: 'POST' };
    const res: any = { on: vi.fn(), once: vi.fn() };
    const next = vi.fn();

    mutationAbortCanary(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.on).not.toHaveBeenCalled();
    expect(res.once).not.toHaveBeenCalled();
  });

  it('skips non-mutation methods (GET) even when enabled', () => {
    withGuardEnabled(() => {
      const req: any = { method: 'GET' };
      const res: any = { on: vi.fn() };
      const next = vi.fn();

      mutationAbortCanary(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.on).not.toHaveBeenCalled();
    });
  });

  it('calls next() synchronously for mutation methods when enabled', () => {
    withGuardEnabled(() => {
      const req: any = { method: 'POST' };
      const res: any = {
        on: vi.fn(),
      };
      const next = vi.fn();

      mutationAbortCanary(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  it('logs and flags mutationAborted when close fires before the response finished', () => {
    withGuardEnabled(() => {
      const handlers: Record<string, () => void> = {};
      const req: any = { method: 'PATCH', originalUrl: '/api/v8/execution/42' };
      const res: any = {
        writableEnded: false,
        finished: false,
        on: vi.fn((event: string, cb: () => void) => {
          handlers[event] = cb;
        }),
      };
      const next = vi.fn();

      mutationAbortCanary(req, res, next);
      expect(isMutationAborted(req)).toBe(false);

      handlers.close?.();

      expect(isMutationAborted(req)).toBe(true);
    });
  });

  it('does NOT flag/log when close fires after finish (normal completion)', () => {
    withGuardEnabled(() => {
      const handlers: Record<string, () => void> = {};
      const req: any = { method: 'DELETE', originalUrl: '/api/v8/execution/42' };
      const res: any = {
        writableEnded: false,
        finished: false,
        on: vi.fn((event: string, cb: () => void) => {
          handlers[event] = cb;
        }),
      };
      const next = vi.fn();

      mutationAbortCanary(req, res, next);
      handlers.finish?.();
      res.writableEnded = true;
      handlers.close?.();

      expect(isMutationAborted(req)).toBe(false);
    });
  });

  it('does NOT flag when res.writableEnded is already true at close time', () => {
    withGuardEnabled(() => {
      const handlers: Record<string, () => void> = {};
      const req: any = { method: 'PUT' };
      const res: any = {
        writableEnded: true,
        on: vi.fn((event: string, cb: () => void) => {
          handlers[event] = cb;
        }),
      };
      const next = vi.fn();

      mutationAbortCanary(req, res, next);
      handlers.close?.();

      expect(isMutationAborted(req)).toBe(false);
    });
  });

  it('never throws when res is a pathological object (no on/once, throwing getters)', () => {
    withGuardEnabled(() => {
      const req: any = { method: 'POST' };
      const res: any = {};
      Object.defineProperty(res, 'writableEnded', {
        get() {
          throw new Error('boom');
        },
      });
      const next = vi.fn();

      expect(() => mutationAbortCanary(req, res, next)).not.toThrow();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  it('never throws and still calls next() when req.method access throws', () => {
    withGuardEnabled(() => {
      const req: any = {};
      Object.defineProperty(req, 'method', {
        get() {
          throw new Error('boom');
        },
      });
      const res: any = { on: vi.fn() };
      const next = vi.fn();

      expect(() => mutationAbortCanary(req, res, next)).not.toThrow();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  it('does not double-attach listeners on the same response object', () => {
    withGuardEnabled(() => {
      const req: any = { method: 'POST' };
      const res: any = { on: vi.fn() };
      const next = vi.fn();

      mutationAbortCanary(req, res, next);
      mutationAbortCanary(req, res, next);

      expect(res.on).toHaveBeenCalledTimes(2); // finish + close, once only
      expect(next).toHaveBeenCalledTimes(2);
    });
  });

  it('isMutationAborted returns false for a plain request with no flag', () => {
    expect(isMutationAborted({} as any)).toBe(false);
  });
});
