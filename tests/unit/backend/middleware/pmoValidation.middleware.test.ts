import type { NextFunction, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, runMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  runMock: vi.fn(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: getMock,
  run: runMock,
}));

import {
  logStatusChange,
  setDependencies,
  validateInitiative,
  validateTask,
  validateTaskStatus,
} from '../../../../server/src/middleware/pmoValidation.middleware.ts';

function makeRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as Response;
}

// DEC-424 (P12): `validateInitiativeStatus` zniknęło z middleware — bramka
// statusu inicjatywy żyje wyłącznie w silniku przejść
// (server/src/constants/initiativeStatuses.ts, testy: tests/unit/backend/
// initiativeStatuses/**). Testy tamtego kontraktu usunięte razem z funkcją.
describe('pmoValidation.middleware', () => {
  const statusMachineMock = {
    validateInitiativeTransition: vi.fn(),
    validateTaskTransition: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ id: 'init-1' });
    runMock.mockResolvedValue({ success: true });
    statusMachineMock.validateInitiativeTransition.mockReturnValue({ valid: true });
    statusMachineMock.validateTaskTransition.mockReturnValue({ valid: true });
    setDependencies({ StatusMachine: statusMachineMock as any });
  });

  it('validateInitiative returns 400 when body accessor throws', () => {
    const req: any = {};
    Object.defineProperty(req, 'body', {
      configurable: true,
      get: () => {
        throw new Error('body getter failed');
      },
    });
    const res = makeRes();
    const next = vi.fn();

    validateInitiative(req as any, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('validateInitiative returns 400 when owner id is whitespace-only', () => {
    const req: any = { body: { ownerId: '   ' } };
    const res = makeRes();
    const next = vi.fn();

    validateInitiative(req as any, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('validateInitiative returns 400 when body is null', () => {
    const req: any = { body: null };
    const res = makeRes();
    const next = vi.fn();

    expect(() => validateInitiative(req as any, res, next as unknown as NextFunction)).not.toThrow();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('validateInitiative returns 400 when owner id exceeds max allowed length', () => {
    const req: any = { body: { ownerId: 'o'.repeat(129) } };
    const res = makeRes();
    const next = vi.fn();

    validateInitiative(req as any, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ rule: 'OWNER_VALUE_TOO_LONG' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('validateTask returns 400 when body accessor throws', async () => {
    const req: any = {};
    Object.defineProperty(req, 'body', {
      configurable: true,
      get: () => {
        throw new Error('body getter failed');
      },
    });
    const res = makeRes();
    const next = vi.fn();

    await validateTask(req as any, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('validateTask returns 400 when initiative id is whitespace-only', async () => {
    const req: any = { body: { initiative_id: '   ' } };
    const res = makeRes();
    const next = vi.fn();

    await validateTask(req as any, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('validateTask returns 400 when body is null', async () => {
    const req: any = { body: null };
    const res = makeRes();
    const next = vi.fn();

    await expect(validateTask(req as any, res, next as unknown as NextFunction)).resolves.toBeUndefined();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('validateTask returns 400 when initiative id exceeds max allowed length', async () => {
    const req: any = { body: { initiative_id: 'i'.repeat(129) } };
    const res = makeRes();
    const next = vi.fn();

    await validateTask(req as any, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ rule: 'INVALID_ENTITY_ID' }));
    expect(next).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('validateTask returns generic 500 error when DB lookup rejects', async () => {
    getMock.mockRejectedValueOnce(new Error('sqlite_secret_xyz'));
    const req: any = { body: { initiative_id: 'init-1' } };
    const res = makeRes();
    const next = vi.fn();

    await validateTask(req as any, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(next).not.toHaveBeenCalled();
  });

  it('logStatusChange continues when response json binder throws', () => {
    const req: any = { body: { status: 'DONE' }, previousStatus: 'IN_PROGRESS' };
    const res: any = { statusCode: 200 };
    Object.defineProperty(res, 'json', {
      configurable: true,
      get: () => {
        throw new Error('json binder failed');
      },
    });
    const next = vi.fn();

    const middleware = logStatusChange('task');
    expect(() => middleware(req, res as Response, next as unknown as NextFunction)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('logStatusChange continues when response statusCode accessor throws', async () => {
    const req: any = {
      body: { status: 'DONE' },
      previousStatus: 'IN_PROGRESS',
      organizationId: 'org-1',
      userId: 'user-1',
      params: { id: 'task-1' },
    };
    const res: any = { json: vi.fn((payload: unknown) => payload) };
    Object.defineProperty(res, 'statusCode', {
      configurable: true,
      get: () => {
        throw new Error('statusCode getter failed');
      },
    });
    const next = vi.fn();

    const middleware = logStatusChange('task');
    middleware(req, res as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);

    await expect((res.json as any)({ ok: true })).resolves.toEqual({ ok: true });
    expect(runMock).not.toHaveBeenCalled();
  });

  it('logStatusChange still sends response when previousStatus accessor throws', async () => {
    const req: any = {
      body: { status: 'DONE' },
      organizationId: 'org-1',
      userId: 'user-1',
      params: { id: 'task-1' },
    };
    Object.defineProperty(req, 'previousStatus', {
      configurable: true,
      get: () => {
        throw new Error('previousStatus getter failed');
      },
    });
    const res: any = { statusCode: 200, json: vi.fn((payload: unknown) => payload) };
    const next = vi.fn();

    const middleware = logStatusChange('task');
    middleware(req, res as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);

    await expect((res.json as any)({ ok: true })).resolves.toEqual({ ok: true });
    expect(runMock).not.toHaveBeenCalled();
  });

  it('logStatusChange still sends response when stringify throws during audit payload assembly', async () => {
    const req: any = {
      body: { status: 'DONE' },
      previousStatus: 'IN_PROGRESS',
      organizationId: 'org-1',
      userId: 'user-1',
      params: { id: 'task-1' },
    };
    const res: any = { statusCode: 200, json: vi.fn((payload: unknown) => payload) };
    const next = vi.fn();
    const stringifySpy = vi.spyOn(JSON, 'stringify');
    stringifySpy.mockImplementationOnce(() => {
      throw new Error('stringify boom');
    });

    const middleware = logStatusChange('task');
    middleware(req, res as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);

    await expect((res.json as any)({ ok: true })).resolves.toEqual({ ok: true });
    expect(runMock).not.toHaveBeenCalled();
    stringifySpy.mockRestore();
  });

  it('logStatusChange skips audit insert when entity id exceeds max allowed length', async () => {
    const req: any = {
      body: { status: 'DONE' },
      previousStatus: 'IN_PROGRESS',
      organizationId: 'org-1',
      userId: 'user-1',
      params: { id: 'x'.repeat(129) },
    };
    const res: any = { statusCode: 200, json: vi.fn((payload: unknown) => payload) };
    const next = vi.fn();

    const middleware = logStatusChange('task');
    middleware(req, res as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);

    await expect((res.json as any)({ ok: true })).resolves.toEqual({ ok: true });
    expect(runMock).not.toHaveBeenCalled();
  });

  it('validateTaskStatus returns 400 when params accessor throws', async () => {
    const req: any = { body: { status: 'DONE' } };
    Object.defineProperty(req, 'params', {
      configurable: true,
      get: () => {
        throw new Error('params getter failed');
      },
    });
    const res = makeRes();
    const next = vi.fn();

    await validateTaskStatus(req, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('validateTaskStatus skips DB lookup when status is whitespace-only', async () => {
    const req: any = { body: { status: '   ' }, params: { id: 'task-1' } };
    const res = makeRes();
    const next = vi.fn();

    await validateTaskStatus(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('validateTaskStatus treats null body as empty payload and skips DB lookup', async () => {
    const req: any = { body: null, params: { id: 'task-1' } };
    const res = makeRes();
    const next = vi.fn();

    await validateTaskStatus(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('validateTaskStatus returns 400 when status exceeds max allowed length', async () => {
    const req: any = { body: { status: 'S'.repeat(129) }, params: { id: 'task-1' } };
    const res = makeRes();
    const next = vi.fn();

    await validateTaskStatus(req, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ rule: 'STATUS_VALUE_TOO_LONG' })
    );
    expect(getMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('validateTaskStatus returns 400 when status is non-string type', async () => {
    const req: any = { body: { status: true }, params: { id: 'task-1' } };
    const res = makeRes();
    const next = vi.fn();

    await validateTaskStatus(req, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ rule: 'INVALID_STATUS_TYPE' }));
    expect(getMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('validateTaskStatus returns 400 when task id exceeds max allowed length', async () => {
    const req: any = { body: { status: 'IN_PROGRESS' }, params: { id: 't'.repeat(129) } };
    const res = makeRes();
    const next = vi.fn();

    await validateTaskStatus(req, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ rule: 'INVALID_ENTITY_ID' })
    );
    expect(getMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('validateTaskStatus normalizes blockedReason from legacy blocked_reason key', async () => {
    const req: any = {
      body: {
        status: 'BLOCKED',
        blockedReason: '   ',
        blocked_reason: 'legacy reason',
        blockerType: '   ',
        blocker_type: 'dependency',
      },
      params: { id: 'task-1' },
    };
    const res = makeRes();
    const next = vi.fn();
    getMock.mockResolvedValueOnce({ status: 'IN_PROGRESS', initiative_id: 'init-1' });

    await validateTaskStatus(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('validateTaskStatus returns 500 when StatusMachine throws', async () => {
    statusMachineMock.validateTaskTransition.mockImplementationOnce(() => {
      throw new Error('status machine failed');
    });
    getMock.mockResolvedValueOnce({ status: 'TODO', initiative_id: 'init-1' });
    const req: any = { body: { status: 'IN_PROGRESS' }, params: { id: 'task-1' } };
    const res = makeRes();
    const next = vi.fn();

    await validateTaskStatus(req, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('validateTaskStatus returns 500 when db row has invalid current status', async () => {
    getMock.mockResolvedValueOnce({ status: 123 as any, initiative_id: 'init-1' });
    const req: any = { body: { status: 'IN_PROGRESS' }, params: { id: 'task-1' } };
    const res = makeRes();
    const next = vi.fn();

    await validateTaskStatus(req, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(statusMachineMock.validateTaskTransition).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('validateTaskStatus returns fallback error when transition reason is non-string', async () => {
    statusMachineMock.validateTaskTransition.mockReturnValueOnce({ valid: false, reason: 123 as any });
    getMock.mockResolvedValueOnce({ status: 'TODO', initiative_id: 'init-1' });
    const req: any = { body: { status: 'IN_PROGRESS' }, params: { id: 'task-1' } };
    const res = makeRes();
    const next = vi.fn();

    await validateTaskStatus(req, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rule: 'INVALID_STATUS_TRANSITION',
        error: 'Invalid status transition',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('validateTaskStatus treats non-boolean valid flag as invalid transition', async () => {
    statusMachineMock.validateTaskTransition.mockReturnValueOnce({ valid: 'true' as any });
    getMock.mockResolvedValueOnce({ status: 'TODO', initiative_id: 'init-1' });
    const req: any = { body: { status: 'IN_PROGRESS' }, params: { id: 'task-1' } };
    const res = makeRes();
    const next = vi.fn();

    await validateTaskStatus(req, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rule: 'INVALID_STATUS_TRANSITION',
        currentStatus: 'TODO',
        requestedStatus: 'IN_PROGRESS',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('validateTaskStatus treats undefined status machine response as invalid transition', async () => {
    statusMachineMock.validateTaskTransition.mockReturnValueOnce(undefined as any);
    getMock.mockResolvedValueOnce({ status: 'TODO', initiative_id: 'init-1' });
    const req: any = { body: { status: 'IN_PROGRESS' }, params: { id: 'task-1' } };
    const res = makeRes();
    const next = vi.fn();

    await expect(validateTaskStatus(req, res, next as unknown as NextFunction)).resolves.toBeUndefined();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        rule: 'INVALID_STATUS_TRANSITION',
        error: 'Invalid status transition',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('validateTaskStatus clamps oversized blockedReason before StatusMachine validation', async () => {
    getMock.mockResolvedValueOnce({ status: 'TODO', initiative_id: 'init-1' });
    const req: any = {
      body: { status: 'IN_PROGRESS', blocked_reason: 'x'.repeat(9000) },
      params: { id: 'task-1' },
    };
    const res = makeRes();
    const next = vi.fn();

    await validateTaskStatus(req, res, next as unknown as NextFunction);

    expect(statusMachineMock.validateTaskTransition).toHaveBeenCalledWith(
      'TODO',
      'IN_PROGRESS',
      expect.objectContaining({
        blockedReason: 'x'.repeat(8192),
      })
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('logStatusChange skips audit insert when organization id exceeds max allowed length', async () => {
    const req: any = {
      body: { status: 'DONE' },
      previousStatus: 'IN_PROGRESS',
      organizationId: 'o'.repeat(129),
      userId: 'user-1',
      params: { id: 'task-1' },
    };
    const res: any = { statusCode: 200, json: vi.fn((payload: unknown) => payload) };
    const next = vi.fn();

    const middleware = logStatusChange('task');
    middleware(req, res as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);

    await expect((res.json as any)({ ok: true })).resolves.toEqual({ ok: true });
    expect(runMock).not.toHaveBeenCalled();
  });

  it('logStatusChange skips audit insert when user id exceeds max allowed length', async () => {
    const req: any = {
      body: { status: 'DONE' },
      previousStatus: 'IN_PROGRESS',
      organizationId: 'org-1',
      userId: 'u'.repeat(129),
      params: { id: 'task-1' },
    };
    const res: any = { statusCode: 200, json: vi.fn((payload: unknown) => payload) };
    const next = vi.fn();

    const middleware = logStatusChange('task');
    middleware(req, res as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);

    await expect((res.json as any)({ ok: true })).resolves.toEqual({ ok: true });
    expect(runMock).not.toHaveBeenCalled();
  });
});
