import { afterEach, describe, expect, it, vi } from 'vitest';

describe('alertWatchdog.middleware', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('continues request flow when response end binder throws before wrapping', async () => {
    vi.resetModules();
    const { default: alertWatchdog } = await import(
      '../../../../server/src/middleware/alertWatchdog.middleware.ts'
    );
    const req: any = {};
    const res: any = {};
    Object.defineProperty(res, 'end', {
      configurable: true,
      get: () => {
        throw new Error('end binder failed');
      },
    });
    const next = vi.fn();

    expect(() => alertWatchdog(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('swallows statusCode accessor errors in wrapped end handler', async () => {
    vi.resetModules();
    const { default: alertWatchdog } = await import(
      '../../../../server/src/middleware/alertWatchdog.middleware.ts'
    );
    const req: any = {};
    const originalEnd = vi.fn();
    const res: any = { end: originalEnd };
    Object.defineProperty(res, 'statusCode', {
      configurable: true,
      get: () => {
        throw new Error('status getter failed');
      },
    });
    const next = vi.fn();

    alertWatchdog(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    expect(() => res.end('payload')).not.toThrow();
    expect(originalEnd).toHaveBeenCalledTimes(1);
  });

  it('records response metrics only once even when end is called twice', async () => {
    vi.resetModules();
    const { default: alertWatchdog, getWatchdogStats } = await import(
      '../../../../server/src/middleware/alertWatchdog.middleware.ts'
    );

    const req: any = {};
    const originalEnd = vi.fn();
    const res: any = { end: originalEnd, statusCode: 200 };
    const next = vi.fn();

    alertWatchdog(req, res, next);
    res.end('first');
    res.end('second');

    expect(originalEnd).toHaveBeenCalledTimes(2);
    expect(getWatchdogStats().windowRequests).toBe(1);
  });

  it('ignores external string marker tampering and records only once', async () => {
    vi.resetModules();
    const { default: alertWatchdog, getWatchdogStats } = await import(
      '../../../../server/src/middleware/alertWatchdog.middleware.ts'
    );

    const req: any = {};
    const originalEnd = vi.fn();
    const res: any = { end: originalEnd, statusCode: 200 };
    const next = vi.fn();

    alertWatchdog(req, res, next);
    res.__watchdogCompleted = false;
    res.end('first');
    delete res.__watchdogCompleted;
    res.end('second');

    expect(originalEnd).toHaveBeenCalledTimes(2);
    expect(getWatchdogStats().windowRequests).toBe(1);
  });

  it('does not double-wrap or double-count when middleware is mounted twice on same response', async () => {
    vi.resetModules();
    const { default: alertWatchdog, getWatchdogStats } = await import(
      '../../../../server/src/middleware/alertWatchdog.middleware.ts'
    );
    const req: any = {};
    const originalEnd = vi.fn();
    const res: any = { end: originalEnd, statusCode: 200 };
    const next = vi.fn();

    alertWatchdog(req, res, next);
    alertWatchdog(req, res, next);
    res.end();

    expect(next).toHaveBeenCalledTimes(2);
    expect(originalEnd).toHaveBeenCalledTimes(1);
    expect(getWatchdogStats().totalRequests).toBe(1);
    expect(getWatchdogStats().windowRequests).toBe(1);
  });

  it('caps in-memory window records by ALERT_WATCHDOG_MAX_RECORDS', async () => {
    vi.stubEnv('ALERT_WATCHDOG_MAX_RECORDS', '3');
    vi.resetModules();
    const { default: alertWatchdog, getWatchdogStats } = await import(
      '../../../../server/src/middleware/alertWatchdog.middleware.ts'
    );

    for (let i = 0; i < 4; i += 1) {
      const req: any = {};
      const res: any = { end: vi.fn(), statusCode: 200 };
      const next = vi.fn();
      alertWatchdog(req, res, next);
      res.end();
    }

    expect(getWatchdogStats().windowRequests).toBe(3);
  });

  it('uses ALERT_WATCHDOG_WINDOW_MS to compute window stats', async () => {
    vi.stubEnv('ALERT_WATCHDOG_WINDOW_MS', '5000');
    vi.resetModules();
    const dateNowSpy = vi.spyOn(Date, 'now');
    let now = 100_000;
    dateNowSpy.mockImplementation(() => now);
    const { default: alertWatchdog, getWatchdogStats } = await import(
      '../../../../server/src/middleware/alertWatchdog.middleware.ts'
    );

    for (let i = 0; i < 3; i += 1) {
      const req: any = {};
      const res: any = { end: vi.fn(), statusCode: 200 };
      const next = vi.fn();
      alertWatchdog(req, res, next);
      res.end();
      now += 3000;
    }

    expect(getWatchdogStats().totalRequests).toBe(3);
    expect(getWatchdogStats().windowRequests).toBe(1);
    dateNowSpy.mockRestore();
  });

  it('falls back to default window size when ALERT_WATCHDOG_WINDOW_MS is invalid', async () => {
    vi.stubEnv('ALERT_WATCHDOG_WINDOW_MS', 'invalid');
    vi.resetModules();
    const dateNowSpy = vi.spyOn(Date, 'now');
    let now = 200_000;
    dateNowSpy.mockImplementation(() => now);
    const { default: alertWatchdog, getWatchdogStats } = await import(
      '../../../../server/src/middleware/alertWatchdog.middleware.ts'
    );

    for (let i = 0; i < 3; i += 1) {
      const req: any = {};
      const res: any = { end: vi.fn(), statusCode: 200 };
      const next = vi.fn();
      alertWatchdog(req, res, next);
      res.end();
      now += 3000;
    }

    expect(getWatchdogStats().windowRequests).toBe(3);
    dateNowSpy.mockRestore();
  });

  it('clamps oversized ALERT_WATCHDOG_MAX_RECORDS to hard cap', async () => {
    vi.stubEnv('ALERT_WATCHDOG_MAX_RECORDS', '999999999');
    vi.resetModules();
    const { default: alertWatchdog, getWatchdogStats } = await import(
      '../../../../server/src/middleware/alertWatchdog.middleware.ts'
    );

    for (let i = 0; i < 50_002; i += 1) {
      const req: any = {};
      const res: any = { end: vi.fn(), statusCode: 200 };
      const next = vi.fn();
      alertWatchdog(req, res, next);
      res.end();
    }

    expect(getWatchdogStats().windowRequests).toBe(50_000);
  });

  it('sanitizes invalid status code values before counting 5xx', async () => {
    vi.resetModules();
    const { default: alertWatchdog, getWatchdogStats } = await import(
      '../../../../server/src/middleware/alertWatchdog.middleware.ts'
    );
    const req: any = {};
    const originalEnd = vi.fn();
    const res: any = { end: originalEnd };
    Object.defineProperty(res, 'statusCode', {
      configurable: true,
      get: () => Number.NaN,
    });
    const next = vi.fn();

    alertWatchdog(req, res, next);
    res.end('payload');

    expect(getWatchdogStats().windowFiveXx).toBe(0);
    expect(originalEnd).toHaveBeenCalledTimes(1);
  });

  it('treats out-of-range status code 700 as non-5xx in watchdog accounting', async () => {
    vi.resetModules();
    const { default: alertWatchdog, getWatchdogStats } = await import(
      '../../../../server/src/middleware/alertWatchdog.middleware.ts'
    );
    const req: any = {};
    const originalEnd = vi.fn();
    const res: any = { end: originalEnd, statusCode: 700 };
    const next = vi.fn();

    alertWatchdog(req, res, next);
    res.end('payload');

    expect(getWatchdogStats().windowFiveXx).toBe(0);
    expect(originalEnd).toHaveBeenCalledTimes(1);
  });

  it('still evaluates latency alert path when logger.error throws in 5xx alert branch', async () => {
    vi.resetModules();
    const { default: logger } = await import('../../../../server/src/utils/Logger.js');
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {
      throw new Error('logger.error failed');
    });
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const dateNowSpy = vi.spyOn(Date, 'now');
    let now = 1_000_000;
    dateNowSpy.mockImplementation(() => {
      now += 3000;
      return now;
    });

    const { default: alertWatchdog } = await import(
      '../../../../server/src/middleware/alertWatchdog.middleware.ts'
    );

    for (let i = 0; i < 10; i += 1) {
      const req: any = {};
      const res: any = { end: vi.fn(), statusCode: 500 };
      const next = vi.fn();
      alertWatchdog(req, res, next);
      res.end();
    }

    expect(errorSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('returns safe empty stats when stats computation throws', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/middleware/alertWatchdog.middleware.ts');
    const filterSpy = vi.spyOn(Array.prototype, 'filter').mockImplementationOnce(() => {
      throw new Error('filter failed');
    });

    expect(mod.getWatchdogStats()).toEqual({
      totalRequests: 0,
      totalFiveXx: 0,
      windowRequests: 0,
      windowFiveXx: 0,
      p95Ms: 0,
    });

    filterSpy.mockRestore();
  });

  it('escapes html metacharacters in alert email payload helper', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/middleware/alertWatchdog.middleware.ts');

    expect(mod.__private__.escapeHtml(`a<&>"'b`)).toBe('a&lt;&amp;&gt;&quot;&#39;b');
  });

  it('pruneOld limits removals per invocation to avoid long blocking loops', async () => {
    vi.stubEnv('ALERT_WATCHDOG_MAX_RECORDS', '50000');
    vi.stubEnv('ALERT_WATCHDOG_WINDOW_MS', '1000');
    vi.resetModules();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));
      const { default: alertWatchdog, __private__ } = await import(
        '../../../../server/src/middleware/alertWatchdog.middleware.ts'
      );

      for (let i = 0; i < 12_000; i += 1) {
        const req: any = {};
        const res: any = { end: vi.fn(), statusCode: 200 };
        const next = vi.fn();
        alertWatchdog(req, res, next);
        res.end();
      }

      vi.setSystemTime(new Date('2020-01-01T00:00:05.000Z'));
      const req: any = {};
      const res: any = { end: vi.fn(), statusCode: 200 };
      const next = vi.fn();
      alertWatchdog(req, res, next);
      res.end();

      expect(__private__.getRecordCount()).toBeGreaterThan(1000);
    } finally {
      vi.useRealTimers();
    }
  });
});
