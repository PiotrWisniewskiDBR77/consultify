import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { validateQuery } from '../../../../server/src/middleware/validation.middleware.ts';

describe('validateQuery (contract)', () => {
  const schema = z.object({ limit: z.coerce.number().int().min(1).max(10) });

  it('returns 400 with details when invalid', async () => {
    const mw = validateQuery(schema);
    const req: any = { query: { limit: '0' } };
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

  it('coerces query and passes validated data', async () => {
    const mw = validateQuery(schema);
    const req: any = { query: { limit: '2' } };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req.query as any).limit).toBe(2);
  });

  it('uses defineProperty fallback when req.query is read-only', async () => {
    const mw = validateQuery(schema);
    const req: any = {};
    Object.defineProperty(req, 'query', {
      get: () => ({ limit: '2' }),
      configurable: true,
    });
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req.query as any).limit).toBe(2);
  });

  it('returns 500 when next is not a function on valid query payload', async () => {
    const mw = validateQuery(schema);
    const req: any = { query: { limit: '2' } };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };

    mw(req, res, undefined as unknown as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error during validation' });
    expect(req.query).toEqual({ limit: '2' });
  });

  it('returns 500 when next throws synchronously on valid query payload', async () => {
    const mw = validateQuery(schema);
    const req: any = { query: { limit: '2' } };
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
    const mw = validateQuery(schema);
    const req: any = { query: { limit: '0' } };
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
    const mw = validateQuery(schema);
    const req: any = { query: { limit: '0' } };
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

  it('returns stable 400 when query schema failure has throwing issues accessor', async () => {
    const mw = validateQuery({
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
    const req: any = { query: { limit: '0' } };
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
