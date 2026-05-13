import { beforeEach, describe, expect, it, vi } from 'vitest';

const { logMock } = vi.hoisted(() => ({
  logMock: vi.fn(),
}));

vi.mock('../../../../server/src/services/AuditEventsService.js', () => ({
  default: {
    log: logMock,
  },
}));

import { requireAudit } from '../../../../server/src/middleware/requireAudit.middleware.ts';

describe('requireAudit.middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logMock.mockResolvedValue('evt-1');
  });

  it('uses fallback actor/org from req.userId and req.organizationId when user accessor throws', async () => {
    const req: any = {
      userId: 'user-1',
      organizationId: 'org-1',
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('agent-x'),
    };
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    const res: any = {};
    const next = vi.fn();

    requireAudit(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    const eventId = await req.emitAuditEvent({ action: 'UPDATE', resourceType: 'initiative' });
    expect(eventId).toBe('evt-1');
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        organizationId: 'org-1',
        userAgent: 'agent-x',
      })
    );
  });

  it('tolerates throwing req.get while emitting audit event', async () => {
    const req: any = {
      user: { id: 'user-1', organizationId: 'org-1' },
      ip: '127.0.0.1',
    };
    Object.defineProperty(req, 'get', {
      configurable: true,
      value: () => {
        throw new Error('get failed');
      },
    });
    const res: any = {};
    const next = vi.fn();

    requireAudit(req, res, next);
    await req.emitAuditEvent({ action: 'CREATE', resourceType: 'task' });

    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userAgent: undefined,
      })
    );
  });

  it('treats non-callable req.get as missing user-agent', async () => {
    const req: any = {
      user: { id: 'user-1', organizationId: 'org-1' },
      ip: '127.0.0.1',
      get: 'not-a-function',
    };
    const res: any = {};
    const next = vi.fn();

    requireAudit(req, res, next);
    await req.emitAuditEvent({ action: 'CREATE', resourceType: 'task' });

    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userAgent: undefined,
      })
    );
  });

  it('captures shallow snapshot of metadata and is not affected by later mutation', async () => {
    const req: any = {
      user: { id: 'user-1', organizationId: 'org-1' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('agent-x'),
    };
    const res: any = {};
    const next = vi.fn();

    requireAudit(req, res, next);

    const metadata = { version: 1 };
    const promise = req.emitAuditEvent({
      action: 'UPDATE',
      resourceType: 'initiative',
      metadata,
    });
    metadata.version = 2;
    await promise;

    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { version: 1 },
      })
    );
  });

  it('captures deep snapshot of nested metadata before later mutation', async () => {
    const req: any = {
      user: { id: 'user-1', organizationId: 'org-1' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('agent-x'),
    };
    const res: any = {};
    const next = vi.fn();

    requireAudit(req, res, next);

    const metadata = { nested: { value: 1 } };
    const promise = req.emitAuditEvent({
      action: 'UPDATE',
      resourceType: 'initiative',
      metadata,
    });
    metadata.nested.value = 2;
    await promise;

    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { nested: { value: 1 } },
      })
    );
  });

  it('clamps very long user agent and ip values before logging', async () => {
    const req: any = {
      user: { id: 'user-1', organizationId: 'org-1' },
      ip: `127.0.0.1-${'x'.repeat(300)}`,
      get: vi.fn().mockReturnValue('a'.repeat(5000)),
    };
    const res: any = {};
    const next = vi.fn();

    requireAudit(req, res, next);
    await req.emitAuditEvent({ action: 'CREATE', resourceType: 'task' });

    const logged = logMock.mock.calls[0][0];
    expect(typeof logged.userAgent).toBe('string');
    expect(logged.userAgent.length).toBe(2048);
    expect(typeof logged.ip).toBe('string');
    expect(logged.ip.length).toBe(128);
  });

  it('clamps very long actorId and organizationId values before logging', async () => {
    const req: any = {
      user: {
        id: `u-${'x'.repeat(300)}`,
        organizationId: `o-${'y'.repeat(300)}`,
      },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('agent-x'),
    };
    const res: any = {};
    const next = vi.fn();

    requireAudit(req, res, next);
    await req.emitAuditEvent({ action: 'CREATE', resourceType: 'task' });

    const logged = logMock.mock.calls[0][0];
    expect(typeof logged.actorId).toBe('string');
    expect(typeof logged.organizationId).toBe('string');
    expect(logged.actorId.length).toBe(128);
    expect(logged.organizationId.length).toBe(128);
  });

  it('clamps and trims resourceId before logging', async () => {
    const req: any = {
      user: { id: 'user-1', organizationId: 'org-1' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('agent-x'),
    };
    const res: any = {};
    const next = vi.fn();

    requireAudit(req, res, next);
    await req.emitAuditEvent({
      action: 'CREATE',
      resourceType: 'task',
      resourceId: `  ${'r'.repeat(400)}  `,
    });

    const logged = logMock.mock.calls[0][0];
    expect(typeof logged.resourceId).toBe('string');
    expect(logged.resourceId.length).toBe(256);
    expect(logged.resourceId).toBe('r'.repeat(256));
  });

  it('rejects circular metadata payload before logging', async () => {
    const req: any = {
      user: { id: 'user-1', organizationId: 'org-1' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('agent-x'),
    };
    const res: any = {};
    const next = vi.fn();
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    requireAudit(req, res, next);

    await expect(
      req.emitAuditEvent({
        action: 'CREATE',
        resourceType: 'task',
        metadata: circular,
      })
    ).rejects.toThrow(TypeError);
    expect(logMock).not.toHaveBeenCalled();
  });

  it('does not replace emitAuditEvent when middleware is mounted twice', async () => {
    const req: any = {
      user: { id: 'user-1', organizationId: 'org-1' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('agent-x'),
    };
    const res: any = {};
    const nextA = vi.fn();
    const nextB = vi.fn();

    requireAudit(req, res, nextA);
    const firstRef = req.emitAuditEvent;
    requireAudit(req, res, nextB);

    expect(nextA).toHaveBeenCalledTimes(1);
    expect(nextB).toHaveBeenCalledTimes(1);
    expect(req.emitAuditEvent).toBe(firstRef);

    await req.emitAuditEvent({ action: 'CREATE', resourceType: 'task' });
    expect(logMock).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid emitAuditEvent payload types before logging', async () => {
    const req: any = {
      user: { id: 'user-1', organizationId: 'org-1' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('agent-x'),
    };
    const res: any = {};
    const next = vi.fn();

    requireAudit(req, res, next);

    await expect(req.emitAuditEvent(undefined)).rejects.toThrow(TypeError);
    await expect(req.emitAuditEvent(null)).rejects.toThrow(TypeError);
    await expect(req.emitAuditEvent([])).rejects.toThrow(TypeError);
    expect(logMock).not.toHaveBeenCalled();
  });

  it('rejects missing action or resourceType before logging', async () => {
    const req: any = {
      user: { id: 'user-1', organizationId: 'org-1' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('agent-x'),
    };
    const res: any = {};
    const next = vi.fn();

    requireAudit(req, res, next);

    await expect(req.emitAuditEvent({ action: 'CREATE' })).rejects.toThrow(TypeError);
    await expect(req.emitAuditEvent({ resourceType: 'task' })).rejects.toThrow(TypeError);
    expect(logMock).not.toHaveBeenCalled();
  });

  it('normalizes invalid actorType values to USER', async () => {
    const req: any = {
      user: { id: 'user-1', organizationId: 'org-1' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('agent-x'),
    };
    const res: any = {};
    const next = vi.fn();

    requireAudit(req, res, next);
    await req.emitAuditEvent({
      action: 'UPDATE',
      resourceType: 'initiative',
      actorType: 'HACKER',
    });

    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'USER',
      })
    );
  });

  it('rejects non-string audit event ids returned by persistence layer', async () => {
    logMock.mockResolvedValueOnce(undefined as any);
    const req: any = {
      user: { id: 'user-1', organizationId: 'org-1' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('agent-x'),
    };
    const res: any = {};
    const next = vi.fn();

    requireAudit(req, res, next);

    await expect(req.emitAuditEvent({ action: 'UPDATE', resourceType: 'initiative' })).rejects.toThrow(
      TypeError
    );
    expect(logMock).toHaveBeenCalledTimes(1);
  });

  it('rejects blank audit event ids returned by persistence layer', async () => {
    logMock.mockResolvedValueOnce('   ');
    const req: any = {
      user: { id: 'user-1', organizationId: 'org-1' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('agent-x'),
    };
    const res: any = {};
    const next = vi.fn();

    requireAudit(req, res, next);

    await expect(req.emitAuditEvent({ action: 'DELETE', resourceType: 'task' })).rejects.toThrow(
      TypeError
    );
    expect(logMock).toHaveBeenCalledTimes(1);
  });

  it('does not forward arbitrary caller properties to auditEventsService.log', async () => {
    const req: any = {
      user: { id: 'user-1', organizationId: 'org-1' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('agent-x'),
    };
    const res: any = {};
    const next = vi.fn();

    requireAudit(req, res, next);
    await req.emitAuditEvent({
      action: 'CREATE',
      resourceType: 'task',
      extraField: 'should-not-reach-log',
    } as any);

    const logged = logMock.mock.calls[0]?.[0];
    expect(logged).not.toHaveProperty('extraField');
    expect(logged).toEqual(
      expect.objectContaining({
        action: 'CREATE',
        resourceType: 'task',
      })
    );
  });

  it('returns trimmed audit event id when persistence returns padded string', async () => {
    logMock.mockResolvedValueOnce('  evt-padded  ');
    const req: any = {
      user: { id: 'user-1', organizationId: 'org-1' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('agent-x'),
    };
    const res: any = {};
    const next = vi.fn();

    requireAudit(req, res, next);
    const eventId = await req.emitAuditEvent({ action: 'UPDATE', resourceType: 'initiative' });

    expect(eventId).toBe('evt-padded');
    expect(logMock).toHaveBeenCalledTimes(1);
  });
});
