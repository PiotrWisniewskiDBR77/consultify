import { describe, expect, it, vi } from 'vitest';

import {
  decryptResponsePII,
  encryptRequestPII,
  getPiiRouteConfigIssues,
  piiEncryptionMiddleware,
} from '../../../../server/src/middleware/piiEncryption.middleware.ts';
import { encryptPII } from '../../../../server/src/services/encryption/EncryptionService.js';
import logger from '../../../../server/src/utils/Logger.js';

describe('piiEncryption.middleware', () => {
  it('encryptRequestPII continues when req.path accessor throws', () => {
    const req: any = { method: 'POST', body: { email: 'user@example.com' } };
    Object.defineProperty(req, 'path', {
      configurable: true,
      get: () => {
        throw new Error('path getter failed');
      },
    });
    const next = vi.fn();

    expect(() => encryptRequestPII(req, {} as any, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('decryptResponsePII continues when response json binder throws', () => {
    const req: any = { path: '/api/users' };
    const res: any = {};
    Object.defineProperty(res, 'json', {
      configurable: true,
      get: () => {
        throw new Error('json binder failed');
      },
    });
    const next = vi.fn();

    expect(() => decryptResponsePII(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('decryptResponsePII skips wrapping when res.json is non-callable value', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const req: any = { path: '/api/users' };
    const res: any = { json: {} };
    const next = vi.fn();

    expect(() => decryptResponsePII(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[PIIEncryption] res.json is not a function; skipping response wrap',
      expect.objectContaining({ path: '/api/users', type: 'object' })
    );

    warnSpy.mockRestore();
  });

  it('piiEncryptionMiddleware skips safely when path accessor throws', () => {
    const req: any = { body: { email: 'user@example.com' }, method: 'POST' };
    Object.defineProperty(req, 'path', {
      configurable: true,
      get: () => {
        throw new Error('path getter failed');
      },
    });
    const res: any = { json: vi.fn(() => res) };
    const next = vi.fn();

    expect(() => piiEncryptionMiddleware(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('encryptRequestPII does not treat /api/healthz as skip route', () => {
    const req: any = {
      path: '/api/healthz',
      method: 'POST',
      body: { email: 'user@example.com' },
    };
    const next = vi.fn();

    encryptRequestPII(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body.email).toMatch(/^enc:v[a-z0-9]+:/);
  });

  it('piiEncryptionMiddleware does not apply to prefix-collision route /api/usersConfidential', () => {
    const req: any = {
      path: '/api/usersConfidential',
      method: 'POST',
      body: { email: 'user@example.com' },
    };
    const originalJson = vi.fn((payload: unknown) => payload);
    const res: any = { json: originalJson };
    const next = vi.fn();

    piiEncryptionMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).toBe(originalJson);
  });

  it('getPiiRouteConfigIssues returns empty list for default middleware route manifests', () => {
    expect(getPiiRouteConfigIssues()).toEqual([]);
  });

  it('getPiiRouteConfigIssues flags malformed route declarations', () => {
    const issues = getPiiRouteConfigIssues(
      ['/api/users', '', '  /api/profile  ', 'api/invalid'],
      ['/api/ping']
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        'PII_ENCRYPTION_ROUTES: empty route entry',
        'PII_ENCRYPTION_ROUTES: route has leading/trailing whitespace',
        'PII_ENCRYPTION_ROUTES: route must start with "/": api/invalid',
      ])
    );
  });

  it('getPiiRouteConfigIssues flags overlap between pii and skip route prefixes', () => {
    const issues = getPiiRouteConfigIssues(['/api/gdpr'], ['/api/gdpr/export']);
    expect(issues).toEqual(expect.arrayContaining(['PII vs SKIP overlap: "/api/gdpr" <-> "/api/gdpr/export"']));
  });

  it('piiEncryptionMiddleware applies when path accessor throws but originalUrl includes query on valid route', () => {
    const req: any = {
      originalUrl: '/api/users?rev=1',
      method: 'POST',
      body: { email: 'user@example.com' },
    };
    Object.defineProperty(req, 'path', {
      configurable: true,
      get: () => {
        throw new Error('path getter failed');
      },
    });
    const res: any = { json: vi.fn((payload: unknown) => payload), statusCode: 200 };
    const next = vi.fn();

    piiEncryptionMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body.email).toMatch(/^enc:v[a-z0-9]+:/);
  });

  it('decryptResponsePII wraps response json only once per response', () => {
    const req: any = { path: '/api/users' };
    const originalJson = vi.fn(function (this: unknown, payload: unknown) {
      return payload;
    });
    const res: any = { json: originalJson };
    const next = vi.fn();

    decryptResponsePII(req, res, next);
    const firstWrapper = res.json;
    decryptResponsePII(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.json).toBe(firstWrapper);
  });

  it('encryptRequestPII encrypts plain-object entries in array request body and preserves non-plain entries', () => {
    const nonPlain = new Date('2020-01-01T00:00:00.000Z');
    const req: any = {
      path: '/api/users',
      method: 'POST',
      body: [{ email: 'user@example.com' }, nonPlain],
    };
    const next = vi.fn();

    encryptRequestPII(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(Array.isArray(req.body)).toBe(true);
    expect(req.body[0].email).toMatch(/^enc:v[a-z0-9]+:/);
    expect(req.body[1]).toBe(nonPlain);
  });

  it('decryptResponsePII preserves response this binding when sending body', () => {
    const req: any = { path: '/api/users' };
    const originalJson = vi.fn(function (this: unknown, payload: unknown) {
      expect(this).toBe(res);
      return payload;
    });
    const res: any = { json: originalJson };
    const next = vi.fn();

    decryptResponsePII(req, res, next);
    res.json({ email: 'enc:v1:testpayload' });

    expect(next).toHaveBeenCalledTimes(1);
    expect(originalJson).toHaveBeenCalledTimes(1);
  });

  it('decryptResponsePII continues when assigning res.json throws', () => {
    const req: any = { path: '/api/users' };
    const res: any = {
      statusCode: 200,
      _jsonImpl: vi.fn((payload: unknown) => payload),
      get json() {
        return this._jsonImpl;
      },
      set json(_value: unknown) {
        throw new Error('json setter blocked');
      },
    };
    const next = vi.fn();

    expect(() => decryptResponsePII(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('decryptResponsePII leaves non-plain object response bodies unchanged', () => {
    const req: any = { path: '/api/users' };
    const originalJson = vi.fn(function (this: unknown, payload: unknown) {
      return payload;
    });
    const res: any = { json: originalJson };
    const next = vi.fn();
    const datePayload = new Date('2020-01-01T00:00:00.000Z');

    decryptResponsePII(req, res, next);
    const result = res.json(datePayload);

    expect(next).toHaveBeenCalledTimes(1);
    expect(originalJson).toHaveBeenCalledWith(datePayload);
    expect(result).toBe(datePayload);
  });

  it('decryptResponsePII decrypts plain object array items and preserves non-plain entries', () => {
    const req: any = { path: '/api/users' };
    const originalJson = vi.fn(function (this: unknown, payload: unknown) {
      return payload;
    });
    const res: any = { json: originalJson };
    const next = vi.fn();
    const datePayload = new Date('2020-01-01T00:00:00.000Z');
    const encryptedPayload = encryptPII({ email: 'user@example.com' });
    const body = [{ email: encryptedPayload.email }, datePayload];

    decryptResponsePII(req, res, next);
    const result = res.json(body);

    expect(next).toHaveBeenCalledTimes(1);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].email).toBe('user@example.com');
    expect(result[1]).toBe(datePayload);
  });

  it('decryptResponsePII logs delegate json failures and rethrows', () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const req: any = { path: '/api/users', method: 'POST' };
    const delegateError = new Error('send failed');
    const res: any = {
      json: vi.fn(() => {
        throw delegateError;
      }),
    };
    const next = vi.fn();

    decryptResponsePII(req, res, next);

    expect(() => res.json({ ok: true })).toThrow('send failed');
    expect(errorSpy).toHaveBeenCalledWith(
      '[PIIEncryption] res.json delegate error',
      expect.objectContaining({
        path: '/api/users',
        method: 'POST',
        error: delegateError,
      })
    );

    errorSpy.mockRestore();
  });
});
