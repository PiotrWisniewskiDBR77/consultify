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
