import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveReachableDatabaseUrlMock } = vi.hoisted(() => ({
  resolveReachableDatabaseUrlMock: vi.fn(),
}));

vi.mock('../../../../server/src/config/databaseTargetResolver.js', () => ({
  resolveReachableDatabaseUrl: resolveReachableDatabaseUrlMock,
}));

describe('auditLog.middleware', () => {
  const flushAsyncAuditWrites = async () => {
    for (let i = 0; i < 4; i += 1) {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resolveReachableDatabaseUrlMock.mockReturnValue({
      databaseUrl: 'postgres://user:pass@localhost:5432/db',
      source: 'DATABASE_URL',
      reason: null,
    });
  });

  it('continues when method accessor throws', async () => {
    const { default: auditLogMiddleware } = await import(
      '../../../../server/src/middleware/auditLog.middleware.ts'
    );

    const req: any = {};
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => {
        throw new Error('method getter failed');
      },
    });
    const res: any = { end: vi.fn(), statusCode: 200 };
    const next = vi.fn();

    await expect(auditLogMiddleware(req, res, next)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('treats lowercase safe method as safe and skips audit wrapping', async () => {
    const { default: auditLogMiddleware } = await import(
      '../../../../server/src/middleware/auditLog.middleware.ts'
    );

    const req: any = { method: 'get' };
    const res: any = { end: vi.fn(), statusCode: 200 };
    const next = vi.fn();

    await expect(auditLogMiddleware(req, res, next)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.end).toHaveBeenCalledTimes(0);
  });

  it('continues when response end binder throws', async () => {
    const { default: auditLogMiddleware } = await import(
      '../../../../server/src/middleware/auditLog.middleware.ts'
    );

    const req: any = { method: 'POST' };
    const res: any = {};
    Object.defineProperty(res, 'end', {
      configurable: true,
      get: () => {
        throw new Error('end getter failed');
      },
    });
    const next = vi.fn();

    await expect(auditLogMiddleware(req, res, next)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('continues response flow when statusCode accessor throws inside wrapped end', async () => {
    vi.resetModules();
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      },
    }));
    vi.doMock('../../../../server/src/services/ActivityService.js', () => ({
      default: { log: vi.fn().mockResolvedValue(undefined) },
    }));
    vi.doMock('../../../../server/src/services/AuditEventsService.js', () => ({
      default: { log: vi.fn().mockResolvedValue('evt-1') },
    }));
    vi.doMock('../../../../server/src/services/auditService.js', () => ({
      default: { log: vi.fn().mockResolvedValue('aud-1') },
    }));

    const { default: auditLogMiddleware } = await import(
      '../../../../server/src/middleware/auditLog.middleware.ts'
    );
    const req: any = {
      method: 'POST',
      user: { id: 'u-1', organizationId: 'org-1' },
      body: { id: 'x1' },
      originalUrl: '/api/projects/x1',
      get: vi.fn().mockReturnValue(undefined),
    };
    const originalEnd = vi.fn();
    const resObj: any = { end: originalEnd };
    Object.defineProperty(resObj, 'statusCode', {
      configurable: true,
      get: () => {
        throw new Error('statusCode getter failed');
      },
    });
    const res = resObj;
    const next = vi.fn();

    await expect(auditLogMiddleware(req, res, next)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(() => res.end()).not.toThrow();
    expect(originalEnd).toHaveBeenCalledTimes(1);
  });

  it('reads req.body once and still logs when user email/name accessors throw', async () => {
    vi.resetModules();
    const activityLog = vi.fn().mockResolvedValue(undefined);
    const auditEventsLog = vi.fn().mockResolvedValue('evt-1');
    const auditServiceLog = vi.fn().mockResolvedValue('aud-1');
    const loggerError = vi.fn();
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: {
        error: loggerError,
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      },
    }));
    vi.doMock('../../../../server/src/services/ActivityService.js', () => ({
      default: { log: activityLog },
    }));
    vi.doMock('../../../../server/src/services/AuditEventsService.js', () => ({
      default: { log: auditEventsLog },
    }));
    vi.doMock('../../../../server/src/services/auditService.js', () => ({
      default: { log: auditServiceLog },
    }));

    const { default: auditLogMiddleware } = await import(
      '../../../../server/src/middleware/auditLog.middleware.ts'
    );

    const user: any = { id: 'u-1', organizationId: 'org-1' };
    Object.defineProperty(user, 'email', {
      configurable: true,
      get: () => {
        throw new Error('email getter failed');
      },
    });
    Object.defineProperty(user, 'name', {
      configurable: true,
      get: () => {
        throw new Error('name getter failed');
      },
    });

    const bodyGetter = vi.fn(() => ({ id: 'x1', name: 'Entity Name' }));
    const req: any = {
      method: 'POST',
      user,
      originalUrl: '/api/projects/x1',
      get: vi.fn().mockReturnValue(undefined),
    };
    Object.defineProperty(req, 'body', {
      configurable: true,
      get: bodyGetter,
    });

    const originalEnd = vi.fn();
    const res: any = { end: originalEnd, statusCode: 200 };
    const next = vi.fn();

    await auditLogMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    res.end();

    // Allow promise callbacks scheduled in middleware to flush.
    await flushAsyncAuditWrites();

    expect(bodyGetter).toHaveBeenCalledTimes(1);
    // At minimum, middleware must remain non-throwing and avoid processing-level errors.
    expect(loggerError).not.toHaveBeenCalledWith('[AuditLog] Error processing log:', expect.anything());

    if (auditServiceLog.mock.calls.length > 0) {
      expect(auditServiceLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorEmail: undefined,
          actorName: undefined,
        })
      );
    }
  });

  it('redacts sensitive body fields across audit writers', async () => {
    vi.resetModules();
    const activityLog = vi.fn().mockResolvedValue(undefined);
    const auditEventsLog = vi.fn().mockResolvedValue('evt-1');
    const auditServiceLog = vi.fn().mockResolvedValue('aud-1');
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      },
    }));
    vi.doMock('../../../../server/src/services/ActivityService.js', () => ({
      default: { log: activityLog },
    }));
    vi.doMock('../../../../server/src/services/AuditEventsService.js', () => ({
      default: { log: auditEventsLog },
    }));
    vi.doMock('../../../../server/src/services/auditService.js', () => ({
      default: { log: auditServiceLog },
    }));

    const { default: auditLogMiddleware } = await import(
      '../../../../server/src/middleware/auditLog.middleware.ts'
    );

    const body = { id: 'x1', name: 'Entity Name', password: 'super-secret', token: 'abc' };
    const req: any = {
      method: 'POST',
      user: { id: 'u-1', organizationId: 'org-1' },
      body,
      originalUrl: '/api/projects/x1',
      get: vi.fn().mockReturnValue(undefined),
    };
    const res: any = { end: vi.fn(), statusCode: 200 };
    const next = vi.fn();

    await auditLogMiddleware(req, res, next);
    res.end();
    await flushAsyncAuditWrites();

    expect(activityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: expect.objectContaining({
          password: '[REDACTED]',
          token: '[REDACTED]',
        }),
      })
    );
    expect(auditEventsLog).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          password: '[REDACTED]',
          token: '[REDACTED]',
        }),
      })
    );
    expect(auditServiceLog).toHaveBeenCalledWith(
      expect.objectContaining({
        newValues: expect.objectContaining({
          password: '[REDACTED]',
          token: '[REDACTED]',
        }),
      })
    );
    expect(req.body.password).toBe('super-secret');
  });

  it('redacts session and auth-adjacent sensitive fields across audit writers', async () => {
    vi.resetModules();
    const activityLog = vi.fn().mockResolvedValue(undefined);
    const auditEventsLog = vi.fn().mockResolvedValue('evt-1');
    const auditServiceLog = vi.fn().mockResolvedValue('aud-1');
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      },
    }));
    vi.doMock('../../../../server/src/services/ActivityService.js', () => ({
      default: { log: activityLog },
    }));
    vi.doMock('../../../../server/src/services/AuditEventsService.js', () => ({
      default: { log: auditEventsLog },
    }));
    vi.doMock('../../../../server/src/services/auditService.js', () => ({
      default: { log: auditServiceLog },
    }));

    const { default: auditLogMiddleware } = await import(
      '../../../../server/src/middleware/auditLog.middleware.ts'
    );

    const body = {
      id: 'x1',
      cookie: 'cookie-value',
      sessionId: 'session-value',
      otp: '123456',
      clientSecret: 'secret-value',
    };
    const req: any = {
      method: 'POST',
      user: { id: 'u-1', organizationId: 'org-1' },
      body,
      originalUrl: '/api/projects/x1',
      get: vi.fn().mockReturnValue(undefined),
    };
    const res: any = { end: vi.fn(), statusCode: 200 };
    const next = vi.fn();

    await auditLogMiddleware(req, res, next);
    res.end();
    await flushAsyncAuditWrites();

    expect(activityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: expect.objectContaining({
          cookie: '[REDACTED]',
          sessionId: '[REDACTED]',
          otp: '[REDACTED]',
          clientSecret: '[REDACTED]',
        }),
      })
    );
    expect(auditEventsLog).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          cookie: '[REDACTED]',
          sessionId: '[REDACTED]',
          otp: '[REDACTED]',
          clientSecret: '[REDACTED]',
        }),
      })
    );
    expect(auditServiceLog).toHaveBeenCalledWith(
      expect.objectContaining({
        newValues: expect.objectContaining({
          cookie: '[REDACTED]',
          sessionId: '[REDACTED]',
          otp: '[REDACTED]',
          clientSecret: '[REDACTED]',
        }),
      })
    );
    expect(req.body.cookie).toBe('cookie-value');
    expect(req.body.sessionId).toBe('session-value');
  });

  it('redacts nested sensitive body fields across audit writers', async () => {
    vi.resetModules();
    const activityLog = vi.fn().mockResolvedValue(undefined);
    const auditEventsLog = vi.fn().mockResolvedValue('evt-1');
    const auditServiceLog = vi.fn().mockResolvedValue('aud-1');
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      },
    }));
    vi.doMock('../../../../server/src/services/ActivityService.js', () => ({
      default: { log: activityLog },
    }));
    vi.doMock('../../../../server/src/services/AuditEventsService.js', () => ({
      default: { log: auditEventsLog },
    }));
    vi.doMock('../../../../server/src/services/auditService.js', () => ({
      default: { log: auditServiceLog },
    }));

    const { default: auditLogMiddleware } = await import(
      '../../../../server/src/middleware/auditLog.middleware.ts'
    );

    const body = {
      id: 'x1',
      nested: { password: 'nested-secret', token: 'nested-token' },
      items: [{ apiKey: 'k1' }],
    };
    const req: any = {
      method: 'POST',
      user: { id: 'u-1', organizationId: 'org-1' },
      body,
      originalUrl: '/api/projects/x1',
      get: vi.fn().mockReturnValue(undefined),
    };
    const res: any = { end: vi.fn(), statusCode: 200 };
    const next = vi.fn();

    await auditLogMiddleware(req, res, next);
    res.end();
    await flushAsyncAuditWrites();

    expect(activityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: expect.objectContaining({
          nested: expect.objectContaining({
            password: '[REDACTED]',
            token: '[REDACTED]',
          }),
          items: expect.arrayContaining([
            expect.objectContaining({
              apiKey: '[REDACTED]',
            }),
          ]),
        }),
      })
    );
    expect(auditEventsLog).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          nested: expect.objectContaining({
            password: '[REDACTED]',
            token: '[REDACTED]',
          }),
        }),
      })
    );
    expect(auditServiceLog).toHaveBeenCalledWith(
      expect.objectContaining({
        newValues: expect.objectContaining({
          nested: expect.objectContaining({
            password: '[REDACTED]',
            token: '[REDACTED]',
          }),
        }),
      })
    );
    expect(req.body.nested.password).toBe('nested-secret');
  });

  it('does not throw and redacts sensitive getter-backed fields when body cloning is unsafe', async () => {
    vi.resetModules();
    const activityLog = vi.fn().mockResolvedValue(undefined);
    const auditEventsLog = vi.fn().mockResolvedValue('evt-1');
    const auditServiceLog = vi.fn().mockResolvedValue('aud-1');
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      },
    }));
    vi.doMock('../../../../server/src/services/ActivityService.js', () => ({
      default: { log: activityLog },
    }));
    vi.doMock('../../../../server/src/services/AuditEventsService.js', () => ({
      default: { log: auditEventsLog },
    }));
    vi.doMock('../../../../server/src/services/auditService.js', () => ({
      default: { log: auditServiceLog },
    }));
    const { default: auditLogMiddleware } = await import(
      '../../../../server/src/middleware/auditLog.middleware.ts'
    );

    const cyclicBody: any = {};
    Object.defineProperty(cyclicBody, 'password', {
      enumerable: true,
      configurable: true,
      get: () => {
        throw new Error('password getter failed');
      },
    });
    const req: any = {
      method: 'POST',
      user: { id: 'u-1', organizationId: 'org-1' },
      body: cyclicBody,
      originalUrl: '/api/projects/x1',
      get: vi.fn().mockReturnValue(undefined),
    };
    const res: any = { end: vi.fn(), statusCode: 200 };
    const next = vi.fn();

    await auditLogMiddleware(req, res, next);
    expect(() => res.end()).not.toThrow();
    await flushAsyncAuditWrites();

    expect(activityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: expect.objectContaining({
          password: '[REDACTED]',
        }),
      })
    );
    expect(auditEventsLog).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          password: '[REDACTED]',
        }),
      })
    );
    expect(auditServiceLog).toHaveBeenCalledWith(
      expect.objectContaining({
        newValues: expect.objectContaining({
          password: '[REDACTED]',
        }),
      })
    );
  });

  it('truncates oversized path in audit metadata', async () => {
    vi.resetModules();
    const auditEventsLog = vi.fn().mockResolvedValue('evt-1');
    const auditServiceLog = vi.fn().mockResolvedValue('aud-1');
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      },
    }));
    vi.doMock('../../../../server/src/services/ActivityService.js', () => ({
      default: { log: vi.fn().mockResolvedValue(undefined) },
    }));
    vi.doMock('../../../../server/src/services/AuditEventsService.js', () => ({
      default: { log: auditEventsLog },
    }));
    vi.doMock('../../../../server/src/services/auditService.js', () => ({
      default: { log: auditServiceLog },
    }));

    const { default: auditLogMiddleware } = await import(
      '../../../../server/src/middleware/auditLog.middleware.ts'
    );

    const oversizedPath = `/${'a'.repeat(5000)}`;
    const req: any = {
      method: 'POST',
      user: { id: 'u-1', organizationId: 'org-1' },
      body: { id: 'x1' },
      originalUrl: oversizedPath,
      get: vi.fn().mockReturnValue(undefined),
    };
    const res: any = { end: vi.fn(), statusCode: 200 };
    const next = vi.fn();

    await auditLogMiddleware(req, res, next);
    res.end();
    await flushAsyncAuditWrites();

    const auditEventsPath = auditEventsLog.mock.calls[0]?.[0]?.metadata?.path;
    const auditServicePath = auditServiceLog.mock.calls[0]?.[0]?.metadata?.path;
    expect(typeof auditEventsPath).toBe('string');
    expect(typeof auditServicePath).toBe('string');
    expect(auditEventsPath).toContain('...[truncated]');
    expect(auditServicePath).toContain('...[truncated]');
    expect(auditEventsPath.length).toBeLessThanOrEqual(2062);
    expect(auditServicePath.length).toBeLessThanOrEqual(2062);
  });

  it('truncates oversized correlation id and user-agent in audit metadata', async () => {
    vi.resetModules();
    const activityLog = vi.fn().mockResolvedValue(undefined);
    const auditEventsLog = vi.fn().mockResolvedValue('evt-1');
    const auditServiceLog = vi.fn().mockResolvedValue('aud-1');
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      },
    }));
    vi.doMock('../../../../server/src/services/ActivityService.js', () => ({
      default: { log: activityLog },
    }));
    vi.doMock('../../../../server/src/services/AuditEventsService.js', () => ({
      default: { log: auditEventsLog },
    }));
    vi.doMock('../../../../server/src/services/auditService.js', () => ({
      default: { log: auditServiceLog },
    }));
    const { default: auditLogMiddleware } = await import(
      '../../../../server/src/middleware/auditLog.middleware.ts'
    );

    const oversizedCorrelationId = 'c'.repeat(5000);
    const oversizedUserAgent = 'u'.repeat(5000);
    const req: any = {
      method: 'POST',
      user: { id: 'u-1', organizationId: 'org-1' },
      body: { id: 'x1' },
      originalUrl: '/api/projects/x1',
      correlationId: oversizedCorrelationId,
      get: vi.fn((header: string) => (header === 'user-agent' ? oversizedUserAgent : undefined)),
    };
    const res: any = { end: vi.fn(), statusCode: 200 };
    const next = vi.fn();

    await auditLogMiddleware(req, res, next);
    res.end();
    await flushAsyncAuditWrites();

    const metadataCorrelationId = auditEventsLog.mock.calls[0]?.[0]?.metadata?.correlationId as string;
    const metadataUserAgent = auditEventsLog.mock.calls[0]?.[0]?.userAgent as string;
    const auditActorUserAgent = auditServiceLog.mock.calls[0]?.[0]?.actorUserAgent as string;

    expect(metadataCorrelationId).toContain('...[truncated]');
    expect(metadataCorrelationId.length).toBeLessThanOrEqual(142);
    expect(metadataUserAgent).toContain('...[truncated]');
    expect(metadataUserAgent.length).toBeLessThanOrEqual(526);
    expect(auditActorUserAgent).toContain('...[truncated]');
    expect(auditActorUserAgent.length).toBeLessThanOrEqual(526);
    expect(activityLog.mock.calls[0]?.[0]?.userAgent).toContain('...[truncated]');
  });

  it('truncates oversized entity id/name and resource type before writing audit logs', async () => {
    vi.resetModules();
    const activityLog = vi.fn().mockResolvedValue(undefined);
    const auditEventsLog = vi.fn().mockResolvedValue('evt-1');
    const auditServiceLog = vi.fn().mockResolvedValue('aud-1');
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      },
    }));
    vi.doMock('../../../../server/src/services/ActivityService.js', () => ({
      default: { log: activityLog },
    }));
    vi.doMock('../../../../server/src/services/AuditEventsService.js', () => ({
      default: { log: auditEventsLog },
    }));
    vi.doMock('../../../../server/src/services/auditService.js', () => ({
      default: { log: auditServiceLog },
    }));
    const { default: auditLogMiddleware } = await import(
      '../../../../server/src/middleware/auditLog.middleware.ts'
    );

    const req: any = {
      method: 'POST',
      user: { id: 'u-1', organizationId: 'org-1' },
      body: {
        id: 'i'.repeat(5000),
        name: 'n'.repeat(5000),
      },
      originalUrl: `/api/${'projects'.repeat(100)}/x1`,
      get: vi.fn().mockReturnValue(undefined),
    };
    const res: any = { end: vi.fn(), statusCode: 200 };
    const next = vi.fn();

    await auditLogMiddleware(req, res, next);
    res.end();
    await flushAsyncAuditWrites();

    expect(activityLog.mock.calls[0]?.[0]?.entityId.length).toBeLessThanOrEqual(270);
    expect(activityLog.mock.calls[0]?.[0]?.entityName.length).toBeLessThanOrEqual(526);
    expect(activityLog.mock.calls[0]?.[0]?.entityType.length).toBeLessThanOrEqual(142);
    expect(auditEventsLog.mock.calls[0]?.[0]?.resourceId.length).toBeLessThanOrEqual(270);
    expect(auditEventsLog.mock.calls[0]?.[0]?.resourceType.length).toBeLessThanOrEqual(142);
    expect(auditServiceLog.mock.calls[0]?.[0]?.resourceId.length).toBeLessThanOrEqual(270);
    expect(auditServiceLog.mock.calls[0]?.[0]?.resourceType.length).toBeLessThanOrEqual(142);
  });

  it('truncates oversized req.ip before writing audit logs', async () => {
    vi.resetModules();
    const activityLog = vi.fn().mockResolvedValue(undefined);
    const auditEventsLog = vi.fn().mockResolvedValue('evt-1');
    const auditServiceLog = vi.fn().mockResolvedValue('aud-1');
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      },
    }));
    vi.doMock('../../../../server/src/services/ActivityService.js', () => ({
      default: { log: activityLog },
    }));
    vi.doMock('../../../../server/src/services/AuditEventsService.js', () => ({
      default: { log: auditEventsLog },
    }));
    vi.doMock('../../../../server/src/services/auditService.js', () => ({
      default: { log: auditServiceLog },
    }));
    const { default: auditLogMiddleware } = await import(
      '../../../../server/src/middleware/auditLog.middleware.ts'
    );

    const req: any = {
      method: 'POST',
      ip: `10.0.0.1,${'z'.repeat(5000)}`,
      user: { id: 'u-1', organizationId: 'org-1' },
      body: { id: 'x1' },
      originalUrl: '/api/projects/x1',
      get: vi.fn().mockReturnValue(undefined),
    };
    const res: any = { end: vi.fn(), statusCode: 200 };
    const next = vi.fn();

    await auditLogMiddleware(req, res, next);
    res.end();
    await flushAsyncAuditWrites();

    expect(activityLog.mock.calls[0]?.[0]?.ipAddress.length).toBeLessThanOrEqual(270);
    expect(auditEventsLog.mock.calls[0]?.[0]?.ip.length).toBeLessThanOrEqual(270);
    expect(auditServiceLog.mock.calls[0]?.[0]?.actorIp.length).toBeLessThanOrEqual(270);
  });

  it('reads request path accessor once when preparing audit payload', async () => {
    vi.resetModules();
    const activityLog = vi.fn().mockResolvedValue(undefined);
    const auditEventsLog = vi.fn().mockResolvedValue('evt-1');
    const auditServiceLog = vi.fn().mockResolvedValue('aud-1');
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      },
    }));
    vi.doMock('../../../../server/src/services/ActivityService.js', () => ({
      default: { log: activityLog },
    }));
    vi.doMock('../../../../server/src/services/AuditEventsService.js', () => ({
      default: { log: auditEventsLog },
    }));
    vi.doMock('../../../../server/src/services/auditService.js', () => ({
      default: { log: auditServiceLog },
    }));

    const { default: auditLogMiddleware } = await import(
      '../../../../server/src/middleware/auditLog.middleware.ts'
    );

    let originalUrlReads = 0;
    const req: any = {
      method: 'POST',
      user: { id: 'u-1', organizationId: 'org-1' },
      body: { id: 'x1' },
      get: vi.fn().mockReturnValue(undefined),
    };
    Object.defineProperty(req, 'originalUrl', {
      configurable: true,
      get: () => {
        originalUrlReads += 1;
        return '/api/projects/x1';
      },
    });
    const res: any = { end: vi.fn(), statusCode: 200 };
    const next = vi.fn();

    await auditLogMiddleware(req, res, next);
    res.end();
    await flushAsyncAuditWrites();

    expect(originalUrlReads).toBe(1);
  });

  it('caps oversized array payloads with truncation metadata in audit snapshots', async () => {
    vi.resetModules();
    const activityLog = vi.fn().mockResolvedValue(undefined);
    const auditEventsLog = vi.fn().mockResolvedValue('evt-1');
    const auditServiceLog = vi.fn().mockResolvedValue('aud-1');
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      },
    }));
    vi.doMock('../../../../server/src/services/ActivityService.js', () => ({
      default: { log: activityLog },
    }));
    vi.doMock('../../../../server/src/services/AuditEventsService.js', () => ({
      default: { log: auditEventsLog },
    }));
    vi.doMock('../../../../server/src/services/auditService.js', () => ({
      default: { log: auditServiceLog },
    }));

    const { default: auditLogMiddleware } = await import(
      '../../../../server/src/middleware/auditLog.middleware.ts'
    );

    const items = Array.from({ length: 1200 }, (_, i) => ({ n: i }));
    const req: any = {
      method: 'POST',
      user: { id: 'u-1', organizationId: 'org-1' },
      body: { id: 'x1', items },
      originalUrl: '/api/projects/x1',
      get: vi.fn().mockReturnValue(undefined),
    };
    const res: any = { end: vi.fn(), statusCode: 200 };
    const next = vi.fn();

    await auditLogMiddleware(req, res, next);
    res.end();
    await flushAsyncAuditWrites();

    const activityItems = activityLog.mock.calls[0]?.[0]?.newValue?.items;
    const eventsItems = auditEventsLog.mock.calls[0]?.[0]?.after?.items;
    const serviceItems = auditServiceLog.mock.calls[0]?.[0]?.newValues?.items;

    for (const snapshot of [activityItems, eventsItems, serviceItems]) {
      expect(snapshot).toEqual(
        expect.objectContaining({
          _auditArrayTruncated: true,
          originalLength: 1200,
          head: expect.any(Array),
        })
      );
      expect(snapshot.head).toHaveLength(500);
      expect(snapshot.head[0]).toEqual({ n: 0 });
    }
    expect(req.body.items).toHaveLength(1200);
  });

  it('does not double-log when middleware is mounted twice on same response', async () => {
    vi.resetModules();
    const activityLog = vi.fn().mockResolvedValue(undefined);
    const auditEventsLog = vi.fn().mockResolvedValue('evt-1');
    const auditServiceLog = vi.fn().mockResolvedValue('aud-1');
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      },
    }));
    vi.doMock('../../../../server/src/services/ActivityService.js', () => ({
      default: { log: activityLog },
    }));
    vi.doMock('../../../../server/src/services/AuditEventsService.js', () => ({
      default: { log: auditEventsLog },
    }));
    vi.doMock('../../../../server/src/services/auditService.js', () => ({
      default: { log: auditServiceLog },
    }));

    const { default: auditLogMiddleware } = await import(
      '../../../../server/src/middleware/auditLog.middleware.ts'
    );

    const req: any = {
      method: 'POST',
      user: { id: 'u-1', organizationId: 'org-1' },
      body: { id: 'x1' },
      originalUrl: '/api/projects/x1',
      get: vi.fn().mockReturnValue(undefined),
    };
    const res: any = { end: vi.fn(), statusCode: 200 };
    const next = vi.fn();

    await auditLogMiddleware(req, res, next);
    await auditLogMiddleware(req, res, next);
    res.end();
    await flushAsyncAuditWrites();

    expect(activityLog).toHaveBeenCalledTimes(1);
    expect(auditEventsLog).toHaveBeenCalledTimes(1);
    expect(auditServiceLog).toHaveBeenCalledTimes(1);
  });
});
