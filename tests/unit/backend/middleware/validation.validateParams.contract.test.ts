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
    expect(req.params).toEqual({ id: uuid });
  });

  it('returns 500 when next throws synchronously on valid params payload', async () => {
    const uuid = '11111111-1111-4111-8111-111111111111';
    const mw = validateParams(schema);
    const req: any = { params: { id: uuid } };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn(() => {
      throw new Error('next failed');
    });

    mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error during validation' });
  });

  it('does not attempt 400 write when response is already writableEnded', async () => {
    const mw = validateParams(schema);
    const req: any = { params: { id: 'not-a-uuid' } };
    const res: any = {
      headersSent: false,
      writableEnded: true,
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    mw(req, res, next);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('does not attempt 400 write when response is already finished', async () => {
    const mw = validateParams(schema);
    const req: any = { params: { id: 'not-a-uuid' } };
    const res: any = {
      headersSent: false,
      writableEnded: false,
      finished: true,
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    mw(req, res, next);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns stable 400 when params schema failure has throwing issues accessor', async () => {
    const mw = validateParams({
      safeParse: () => {
        const error = {};
        Object.defineProperty(error, 'issues', {
          enumerable: true,
          get: () => {
            throw new Error('issues getter failed');
          },
        });
        return { success: false, error };
      },
    } as any);
    const req: any = { params: { id: 'not-a-uuid' } };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation Error',
        details: [{ field: '', message: 'Validation Error', code: 'custom' }],
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
