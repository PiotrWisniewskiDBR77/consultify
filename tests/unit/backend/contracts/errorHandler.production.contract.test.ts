import { describe, expect, it } from 'vitest';

import {
  AppError,
  ERROR_CODES,
  errorHandlerMiddleware,
} from '../../../../server/src/utils/ErrorHandler.ts';

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

describe('ErrorHandler middleware (production contract)', () => {
  it('returns operational 4xx errors with code/message/timestamp', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new AppError('Bad input', 400, ERROR_CODES.VALIDATION_ERROR, { fields: { a: 1 } });
    const req: any = { path: '/x', method: 'POST', user: { id: 'u1' } };
    const res = makeRes();

    errorHandlerMiddleware(err as any, req, res as any, () => {});

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual(
      expect.objectContaining({
        status: 'fail',
        error: expect.objectContaining({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Bad input',
          fields: { a: 1 },
          timestamp: expect.any(String),
        }),
      })
    );

    if (orig === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = orig;
  });

  it('returns generic 500 for non-operational errors', () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('Sensitive details');
    const req: any = { path: '/x', method: 'GET' };
    const res = makeRes();

    errorHandlerMiddleware(err as any, req, res as any, () => {});

    expect(res.statusCode).toBe(500);
    expect(res.jsonBody).toEqual(
      expect.objectContaining({
        status: 'error',
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'Something went very wrong!',
          timestamp: expect.any(String),
        }),
      })
    );
    expect(JSON.stringify(res.jsonBody)).not.toContain('Sensitive details');

    if (orig === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = orig;
  });
});
