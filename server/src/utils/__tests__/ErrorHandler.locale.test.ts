import { afterEach, describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import { errorHandlerMiddleware } from '../ErrorHandler.js';

function responseProbe() {
  let statusCode = 0;
  let payload: unknown;
  return {
    response: {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        payload = body;
        return this;
      },
    },
    read: () => ({ statusCode, payload }),
  };
}

function request(profileLanguage: string, headerLanguage: string) {
  return {
    path: '/api/upload',
    method: 'POST',
    user: { language: profileLanguage },
    get: (name: string) => (name === 'Accept-Language' ? headerLanguage : undefined),
  };
}

describe('ErrorHandler server locale', () => {
  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('localizes a body-parser contract from the authenticated user locale', () => {
    process.env.NODE_ENV = 'production';
    const probe = responseProbe();
    const error = Object.assign(new SyntaxError('raw parser detail'), {
      status: 400,
      type: 'entity.parse.failed',
    });

    errorHandlerMiddleware(
      error,
      request('pl', 'en-US') as unknown as Request,
      probe.response as unknown as Response,
      (() => undefined) as NextFunction
    );

    expect(probe.read()).toMatchObject({
      statusCode: 400,
      payload: {
        error: {
          code: 'REQUEST_JSON_INVALID',
          message: 'Treść żądania musi być poprawnym dokumentem JSON.',
        },
      },
    });
  });

  it('keeps English when the profile is English even with a Polish header', () => {
    process.env.NODE_ENV = 'production';
    const probe = responseProbe();
    const error = Object.assign(new Error('raw upload detail'), {
      name: 'MulterError',
      code: 'LIMIT_FILE_SIZE',
    });

    errorHandlerMiddleware(
      error,
      request('en', 'pl-PL') as unknown as Request,
      probe.response as unknown as Response,
      (() => undefined) as NextFunction
    );

    expect(probe.read()).toMatchObject({
      statusCode: 413,
      payload: {
        error: {
          code: 'REQUEST_MULTIPART_FILE_TOO_LARGE',
          message: 'Uploaded file exceeds the allowed size.',
        },
      },
    });
  });
});
