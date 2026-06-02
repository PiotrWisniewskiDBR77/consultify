import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { loggerInfo, loggerError } = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));
vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    info: loggerInfo,
    error: loggerError,
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { validateBody, validateParams, validateQuery } from '../../../../server/src/middleware/validation.middleware.ts';

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.type = vi.fn(() => res);
  res.send = vi.fn(() => res);
  return res;
}

describe('validation.middleware (L1 contract)', () => {
  describe('validateBody', () => {
    it('returns 400 with details when invalid', () => {
      const schema = z.object({ name: z.string().min(2) });
      const mw = validateBody(schema);
      const req: any = { body: { name: 'a' }, method: 'POST', path: '/x' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          details: expect.any(Array),
        })
      );
      const payload = (res.json as any).mock.calls[0][0];
      expect(payload.details[0].field).toBe('name');
      expect(next).not.toHaveBeenCalled();
    });

    it('still returns 400 when logger.info throws on validation failure path', () => {
      loggerInfo.mockImplementationOnce(() => {
        throw new Error('logger down');
      });
      const schema = z.object({ name: z.string().min(2) });
      const mw = validateBody(schema);
      const req: any = { body: { name: 'a' }, method: 'POST', path: '/x' };
      const res = makeRes();
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

    it('coerces and replaces body with parsed data', () => {
      const schema = z.object({ n: z.coerce.number().int() });
      const mw = validateBody(schema);
      const req: any = { body: { n: '12' }, method: 'POST', path: '/x' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.body.n).toBe(12);
    });

    it('uses defineProperty fallback when req.body is read-only', () => {
      const schema = z.object({ n: z.coerce.number().int() });
      const mw = validateBody(schema);
      const req: any = { method: 'POST', path: '/x' };
      Object.defineProperty(req, 'body', {
        get: () => ({ n: '7' }),
        configurable: true,
      });
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.body.n).toBe(7);
    });

    it('returns 500 when schema.safeParse throws unexpectedly', () => {
      const schema: any = {
        safeParse: () => {
          throw new Error('boom');
        },
      };
      const mw = validateBody(schema);
      const req: any = { body: {}, method: 'POST', path: '/x' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 500 when schema is not Zod-like (missing safeParse)', () => {
      const mw = validateBody(null as unknown as z.ZodSchema);
      const req: any = { body: {}, method: 'POST', path: '/x' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error during validation' });
      expect(next).not.toHaveBeenCalled();
      expect(loggerError).toHaveBeenCalled();
    });

    it('still returns 500 when logger.error throws in invalid-schema branch', () => {
      loggerError.mockImplementationOnce(() => {
        throw new Error('logger down');
      });
      const mw = validateBody(null as unknown as z.ZodSchema);
      const req: any = { body: {}, method: 'POST', path: '/x' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error during validation' });
      expect(next).not.toHaveBeenCalled();
    });

    it('still completes 400 when res.json throws once (fallback send path)', () => {
      const schema = z.object({ name: z.string().min(2) });
      const mw = validateBody(schema);
      const req: any = { body: { name: 'a' }, method: 'POST', path: '/x' };
      const res = makeRes();
      let jsonCalls = 0;
      res.json = vi.fn(() => {
        jsonCalls += 1;
        if (jsonCalls === 1) throw new Error('json boom');
        return res;
      });
      const next = vi.fn();

      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('does not attempt 400 write when headers are already sent', () => {
      const schema = z.object({ name: z.string().min(2) });
      const mw = validateBody(schema);
      const req: any = { body: { name: 'a' }, method: 'POST', path: '/x' };
      const res = makeRes();
      res.headersSent = true;
      const next = vi.fn();

      mw(req, res, next);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('does not attempt 400 write when response is already writableEnded', () => {
      const schema = z.object({ name: z.string().min(2) });
      const mw = validateBody(schema);
      const req: any = { body: { name: 'a' }, method: 'POST', path: '/x' };
      const res = makeRes();
      res.headersSent = false;
      res.writableEnded = true;
      const next = vi.fn();

      mw(req, res, next);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

  it('does not attempt 400 write when response is already finished', () => {
    const schema = z.object({ name: z.string().min(2) });
    const mw = validateBody(schema);
    const req: any = { body: { name: 'a' }, method: 'POST', path: '/x' };
    const res = makeRes();
    res.headersSent = false;
    res.writableEnded = false;
    res.finished = true;
    const next = vi.fn();

    mw(req, res, next);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

    it('uses default error message when issues are missing (fallback branch)', () => {
      const schema: any = {
        safeParse: () => ({ success: false, error: undefined }),
      };
      const mw = validateBody(schema);
      const req: any = { body: { any: 'x' }, method: 'POST', path: '/x' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Validation Error', details: [] });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns safe 400 details when issue.path has malformed non-array shape', () => {
      const schema: any = {
        safeParse: () => ({
          success: false,
          error: {
            issues: [{ path: { join: () => { throw new Error('bad path'); } }, message: 123, code: null }],
          },
        }),
      };
      const mw = validateBody(schema);
      const req: any = { body: { any: 'x' }, method: 'POST', path: '/x' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid value',
        details: [{ field: '', message: 'Invalid value', code: 'custom' }],
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('caps excessively long validation field/message values in 400 payload', () => {
      const longPathSegment = 'x'.repeat(600);
      const longMessage = 'm'.repeat(5000);
      const schema: any = {
        safeParse: () => ({
          success: false,
          error: {
            issues: [
              {
                path: [longPathSegment],
                message: longMessage,
                code: 'too_big',
              },
            ],
          },
        }),
      };
      const mw = validateBody(schema);
      const req: any = { body: { any: 'x' }, method: 'POST', path: '/x' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      const payload = (res.json as any).mock.calls[0][0];
      expect(res.status).toHaveBeenCalledWith(400);
      expect(payload.details[0].field.length).toBeLessThanOrEqual(259);
      expect(payload.details[0].message.length).toBeLessThanOrEqual(2051);
      expect(payload.details[0].field.endsWith('...')).toBe(true);
      expect(payload.details[0].message.endsWith('...')).toBe(true);
      expect(next).not.toHaveBeenCalled();
    });

    it('caps validation path segment processing before joining into field string', () => {
      const hugePath = Array.from({ length: 50_000 }, (_, i) => `s${i}`);
      const schema: any = {
        safeParse: () => ({
          success: false,
          error: {
            issues: [
              {
                path: hugePath,
                message: 'too deep',
                code: 'custom',
              },
            ],
          },
        }),
      };
      const mw = validateBody(schema);
      const req: any = { body: { any: 'x' }, method: 'POST', path: '/x' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      const payload = (res.json as any).mock.calls[0][0];
      expect(res.status).toHaveBeenCalledWith(400);
      expect(payload.details[0].field).toContain('s63');
      expect(payload.details[0].field).not.toContain('s1000');
      expect(next).not.toHaveBeenCalled();
    });

    it('logs bounded preview string for large validation error arrays', () => {
      loggerInfo.mockClear();
      const hugeIssues = Array.from({ length: 300 }, (_, index) => ({
        path: [`field_${index}_${'x'.repeat(120)}`],
        message: `issue_${index}_${'m'.repeat(300)}`,
        code: 'custom',
      }));
      const schema: any = {
        safeParse: () => ({
          success: false,
          error: { issues: hugeIssues },
        }),
      };
      const mw = validateBody(schema);
      const req: any = { body: { any: 'x' }, method: 'POST', path: '/x' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(loggerInfo).toHaveBeenCalled();
      const preview = loggerInfo.mock.calls[0][1];
      expect(typeof preview).toBe('string');
      expect(preview.length).toBeLessThanOrEqual(8003);
      expect(next).not.toHaveBeenCalled();
    });

    it('caps validation details array size in 400 response payload', () => {
      const issues = Array.from({ length: 120 }, (_, index) => ({
        path: [`field_${index}`],
        message: `invalid_${index}`,
        code: 'custom',
      }));
      const schema: any = {
        safeParse: () => ({
          success: false,
          error: { issues },
        }),
      };
      const mw = validateBody(schema);
      const req: any = { body: { any: 'x' }, method: 'POST', path: '/x' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      const payload = (res.json as any).mock.calls[0][0];
      expect(res.status).toHaveBeenCalledWith(400);
      expect(Array.isArray(payload.details)).toBe(true);
      expect(payload.details).toHaveLength(50);
      expect(next).not.toHaveBeenCalled();
    });

    it('caps validation issue processing before details mapping', () => {
      const issues = Array.from({ length: 10000 }, (_, index) => ({
        path: [`field_${index}`],
        message: `invalid_${index}`,
        code: 'custom',
      }));
      const schema: any = {
        safeParse: () => ({
          success: false,
          error: { issues },
        }),
      };
      const mw = validateBody(schema);
      const req: any = { body: { any: 'x' }, method: 'POST', path: '/x' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      const payload = (res.json as any).mock.calls[0][0];
      expect(res.status).toHaveBeenCalledWith(400);
      expect(payload.details).toHaveLength(50);
      expect(payload.details[49].field).toContain('field_49');
      expect(payload.details.some((entry: any) => String(entry.field).includes('field_9999'))).toBe(false);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns stable 400 when schema failure object has throwing issues accessor', () => {
      const schema: any = {
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
      };
      const mw = validateBody(schema);
      const req: any = { body: { any: 'x' }, method: 'POST', path: '/x' };
      const res = makeRes();
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

    it('returns 400 when body accessor throws and schema expects object', () => {
      const schema = z.object({ name: z.string() });
      const mw = validateBody(schema);
      const req: any = { method: 'POST', path: '/x' };
      Object.defineProperty(req, 'body', {
        configurable: true,
        get: () => {
          throw new Error('body getter failed');
        },
      });
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 500 when next is not a function on valid body payload', () => {
      const schema = z.object({ name: z.string().min(2) });
      const mw = validateBody(schema);
      const req: any = { body: { name: 'valid' }, method: 'POST', path: '/x' };
      const res = makeRes();

      mw(req, res, undefined as unknown as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error during validation' });
    expect(req.body).toEqual({ name: 'valid' });
    });

    it('returns 500 when next throws synchronously on valid body payload', () => {
      const schema = z.object({ name: z.string().min(2) });
      const mw = validateBody(schema);
      const req: any = { body: { name: 'valid' }, method: 'POST', path: '/x' };
      const res = makeRes();
      const next = vi.fn(() => {
        throw new Error('next failed');
      });

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error during validation' });
    });
  });

  describe('validateQuery', () => {
    it('uses defineProperty fallback when req.query is read-only', () => {
      const schema = z.object({ page: z.coerce.number().int() });
      const mw = validateQuery(schema);
      const req: any = {};
      Object.defineProperty(req, 'query', {
        get: () => ({ page: '3' }),
        configurable: true,
      });
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect((req.query as any).page).toBe(3);
    });

    it('returns 500 when schema.safeParse throws unexpectedly', () => {
      const schema: any = {
        safeParse: () => {
          throw new Error('boom');
        },
      };
      const mw = validateQuery(schema);
      const req: any = { query: { page: '1' } };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(next).not.toHaveBeenCalled();
    });

    it('still returns 500 when logger.error throws in query invalid-schema branch', () => {
      loggerError.mockImplementationOnce(() => {
        throw new Error('logger down');
      });
      const mw = validateQuery(null as unknown as z.ZodSchema);
      const req: any = { query: {}, method: 'GET', path: '/list' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error during validation' });
      expect(next).not.toHaveBeenCalled();
    });

    it('logs validation failures on invalid query without affecting 400 response', () => {
      loggerInfo.mockClear();
      const schema = z.object({ page: z.coerce.number().int().min(1) });
      const mw = validateQuery(schema);
      const req: any = { query: { page: '0' }, method: 'GET', path: '/list' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(loggerInfo).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('still returns 400 when query logger.info throws on validation failure path', () => {
      loggerInfo.mockImplementationOnce(() => {
        throw new Error('logger down');
      });
      const schema = z.object({ page: z.coerce.number().int().min(1) });
      const mw = validateQuery(schema);
      const req: any = { query: { page: '0' }, method: 'GET', path: '/list' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('uses default error message when issues are missing (fallback branch)', () => {
      const schema: any = {
        safeParse: () => ({ success: false, error: undefined }),
      };
      const mw = validateQuery(schema);
      const req: any = { query: { any: 'x' } };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Validation Error', details: [] });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 when query accessor throws and schema expects object', () => {
      const schema = z.object({ page: z.coerce.number() });
      const mw = validateQuery(schema);
      const req: any = {};
      Object.defineProperty(req, 'query', {
        configurable: true,
        get: () => {
          throw new Error('query getter failed');
        },
      });
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateParams', () => {
    it('uses defineProperty fallback when req.params is read-only', () => {
      const schema = z.object({ id: z.string().min(1) });
      const mw = validateParams(schema);
      const req: any = {};
      Object.defineProperty(req, 'params', {
        get: () => ({ id: 'x' }),
        configurable: true,
      });
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect((req.params as any).id).toBe('x');
    });

    it('returns 500 when schema.safeParse throws unexpectedly', () => {
      const schema: any = {
        safeParse: () => {
          throw new Error('boom');
        },
      };
      const mw = validateParams(schema);
      const req: any = { params: { id: 'x' } };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(next).not.toHaveBeenCalled();
    });

    it('still returns 500 when logger.error throws in params invalid-schema branch', () => {
      loggerError.mockImplementationOnce(() => {
        throw new Error('logger down');
      });
      const mw = validateParams(null as unknown as z.ZodSchema);
      const req: any = { params: {}, method: 'GET', path: '/entity/x' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error during validation' });
      expect(next).not.toHaveBeenCalled();
    });

    it('logs validation failures on invalid params without affecting 400 response', () => {
      loggerInfo.mockClear();
      const schema = z.object({ id: z.string().uuid() });
      const mw = validateParams(schema);
      const req: any = { params: { id: 'bad' }, method: 'GET', path: '/entity/bad' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(loggerInfo).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('still returns 400 when params logger.info throws on validation failure path', () => {
      loggerInfo.mockImplementationOnce(() => {
        throw new Error('logger down');
      });
      const schema = z.object({ id: z.string().uuid() });
      const mw = validateParams(schema);
      const req: any = { params: { id: 'bad' }, method: 'GET', path: '/entity/bad' };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('uses default error message when issues are missing (fallback branch)', () => {
      const schema: any = {
        safeParse: () => ({ success: false, error: undefined }),
      };
      const mw = validateParams(schema);
      const req: any = { params: { any: 'x' } };
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Validation Error', details: [] });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 when params accessor throws and schema expects object', () => {
      const schema = z.object({ id: z.string() });
      const mw = validateParams(schema);
      const req: any = {};
      Object.defineProperty(req, 'params', {
        configurable: true,
        get: () => {
          throw new Error('params getter failed');
        },
      });
      const res = makeRes();
      const next = vi.fn();

      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
