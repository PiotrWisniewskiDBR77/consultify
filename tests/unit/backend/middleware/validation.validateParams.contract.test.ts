import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { validateParams } from '../../../../server/src/middleware/validation.middleware.ts';

describe('validateParams (contract)', () => {
  const schema = z.object({ id: z.string().uuid() });

  it('returns 400 with details when invalid', async () => {
    const mw = validateParams(schema);
    const req: any = { params: { id: 'not-a-uuid' } };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(String),
        details: expect.any(Array),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('passes validated params', async () => {
    const uuid = '11111111-1111-4111-8111-111111111111';
    const mw = validateParams(schema);
    const req: any = { params: { id: uuid } };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req.params as any).id).toBe(uuid);
  });

  it('uses defineProperty fallback when req.params is read-only', async () => {
    const uuid = '11111111-1111-4111-8111-111111111111';
    const mw = validateParams(schema);
    const req: any = {};
    Object.defineProperty(req, 'params', {
      get: () => ({ id: uuid }),
      configurable: true,
    });
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req.params as any).id).toBe(uuid);
  });

  it('returns 500 when next is not a function on valid params payload', async () => {
    const uuid = '11111111-1111-4111-8111-111111111111';
    const mw = validateParams(schema);
    const req: any = { params: { id: uuid } };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };

    mw(req, res, undefined as unknown as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error during validation' });
  });
});
