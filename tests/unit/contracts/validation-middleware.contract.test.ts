import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { validateBody } from '../../../server/src/middleware/validation.middleware.js';

function createRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: any) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('Contract: validation middleware error shape', () => {
  it('returns { error, details[] } with field/message/code', () => {
    const Schema = z.object({
      email: z.string().email('Invalid email format'),
      password: z.string().min(1, 'Password is required'),
    });

    const req: any = { method: 'POST', path: '/x', body: { email: 'nope', password: '' } };
    const res = createRes();
    const next = vi.fn();

    validateBody(Schema)(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: expect.any(String),
        details: expect.arrayContaining([
          expect.objectContaining({
            field: expect.any(String),
            message: expect.any(String),
            code: expect.any(String),
          }),
        ]),
      })
    );
  });
});
