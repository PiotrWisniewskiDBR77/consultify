import { describe, expect, it } from 'vitest';

import { createError, errorHandlerMiddleware } from '../../../../server/src/utils/ErrorHandler.ts';

function makeRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.jsonBody = undefined;
  res.json = (body: any) => {
    res.jsonBody = body;
    return res;
  };
  return res;
}

describe('ErrorHandler middleware (development contract)', () => {
  it('includes stack in development response', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const err: any = new Error('Boom');
    err.statusCode = 500;
    err.code = 'INTERNAL_ERROR';

    const req: any = { path: '/x', method: 'GET' };
    const res = makeRes();

    errorHandlerMiddleware(err, req, res as any, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.jsonBody).toEqual(
      expect.objectContaining({
        status: 'error',
        error: expect.objectContaining({
          message: 'Boom',
          stack: expect.any(String),
          code: 'INTERNAL_ERROR',
        }),
      })
    );

    if (orig === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = orig;
  });

  it('createError includes ISO timestamp', () => {
    const res = createError('X', 'Msg', { a: 1 });
    expect(res).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'X',
          message: 'Msg',
          a: 1,
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        }),
      })
    );
  });
});
