/**
 * Day 314 — the global error handler leaked the database driver's message and
 * the full Node stack to any logged-in caller on staging/demo.
 *
 * Measured 2026-09-04: GET /api/report-builder/sources/upload_bundle answered
 *   {"error":{"message":"column \"coverage_percent\" does not exist",
 *             "stack":"error: ...\n    at ..."}}
 * because the verbose branch fired on NODE_ENV=development and the deployed
 * tiers run exactly that.
 */
import type { Request, Response } from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import {
  errorHandlerMiddleware,
  isDatabaseDriverError,
  isHostedDeployment,
  isVerboseErrorEnv,
} from '../../../../server/src/utils/ErrorHandler.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function pgError(message: string) {
  return Object.assign(new Error(message), {
    code: '42703',
    severity: 'ERROR',
    routine: 'errorMissingColumn',
    file: 'parse_relation.c',
  });
}

function capture(err: Error) {
  const body: { status?: number; payload?: unknown } = {};
  const res = {
    status(code: number) {
      body.status = code;
      return this;
    },
    json(payload: unknown) {
      body.payload = payload;
      return this;
    },
    headersSent: false,
    writableEnded: false,
  } as unknown as Response;
  const req = { path: '/api/x', method: 'GET', get: () => undefined } as unknown as Request;
  errorHandlerMiddleware(err as never, req, res, (() => undefined) as never);
  return body;
}

describe('Day 314 — no stack and no raw SQL leaves a deployed environment', () => {
  it('treats a Railway / APP_ENV deployment as hosted even when NODE_ENV is development', () => {
    expect(isHostedDeployment({ APP_ENV: 'staging' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isHostedDeployment({ APP_ENV: 'demo' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isHostedDeployment({ RAILWAY_SERVICE_ID: 'svc-1' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isHostedDeployment({} as NodeJS.ProcessEnv)).toBe(false);

    expect(isVerboseErrorEnv({ NODE_ENV: 'development', APP_ENV: 'staging' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isVerboseErrorEnv({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isVerboseErrorEnv({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isVerboseErrorEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('recognises a pg driver error and does not mistake an ordinary error for one', () => {
    expect(isDatabaseDriverError(pgError('column "x" does not exist'))).toBe(true);
    expect(isDatabaseDriverError(Object.assign(new Error('locked'), { code: 'SQLITE_BUSY' }))).toBe(true);
    expect(isDatabaseDriverError(new Error('plain failure'))).toBe(false);
    expect(isDatabaseDriverError(Object.assign(new Error('http'), { code: 'ECONNREFUSED' }))).toBe(false);
    expect(isDatabaseDriverError(null)).toBe(false);
  });

  it('redacts a driver error even while NODE_ENV=development on a hosted tier', () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_ENV = 'staging';
    const { status, payload } = capture(pgError('column "coverage_percent" does not exist'));
    expect(status).toBe(500);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/coverage_percent/);
    expect(serialized).not.toMatch(/stack/i);
    expect(serialized).not.toMatch(/parse_relation/);
    expect((payload as { error: { code: string } }).error.code).toBe('DATABASE_ERROR');
  });

  it('redacts a driver error even on a local developer machine, where verbose is otherwise allowed', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.APP_ENV;
    delete process.env.RAILWAY_SERVICE_ID;
    delete process.env.RAILWAY_ENVIRONMENT;
    delete process.env.RAILWAY_ENVIRONMENT_ID;
    delete process.env.RAILWAY_ENVIRONMENT_NAME;
    expect(isVerboseErrorEnv()).toBe(true);
    const { payload } = capture(pgError('invalid input syntax for type uuid: "legacy-org-demo"'));
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/legacy-org-demo/);
    expect(serialized).not.toMatch(/stack/i);
  });

  it('hides the stack of an ordinary error on a hosted tier but keeps it for a local developer', () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_ENV = 'staging';
    expect(JSON.stringify(capture(new Error('boom')).payload)).not.toMatch(/stack/i);

    delete process.env.APP_ENV;
    delete process.env.RAILWAY_SERVICE_ID;
    delete process.env.RAILWAY_ENVIRONMENT;
    delete process.env.RAILWAY_ENVIRONMENT_ID;
    delete process.env.RAILWAY_ENVIRONMENT_NAME;
    expect(JSON.stringify(capture(new Error('boom')).payload)).toMatch(/stack/i);
  });
});
