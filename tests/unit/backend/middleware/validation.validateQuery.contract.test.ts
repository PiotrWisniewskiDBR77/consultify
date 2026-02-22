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
});
