import { describe, expect, it } from 'vitest';

import { createApiError, normalizeApiError, normalizeApiErrorMessage } from '@/utils/apiError';

describe('apiError utils', () => {
  it('normalizes object error payloads without leaking object stringification', () => {
    expect(
      normalizeApiErrorMessage({
        error: {
          message: 'Email already exists',
          code: 'DUPLICATE_EMAIL',
        },
      })
    ).toBe('Email already exists');
  });

  it('flattens validation details with object entries into readable field messages', () => {
    const error = normalizeApiError({
      code: 'VALIDATION_ERROR',
      details: {
        email: [{ message: 'Must be a valid email' }],
        name: ['Required'],
      },
    });

    expect(error).toMatchObject({
      message: 'email: Must be a valid email, name: Required',
      code: 'VALIDATION_ERROR',
    });
  });

  it('uses safe fallbacks for empty, internal, and HTML-like messages', () => {
    expect(normalizeApiErrorMessage('', 'Could not save')).toBe('Could not save');
    expect(normalizeApiErrorMessage('INTERNAL_ERROR')).toBe(
      'Something went wrong. Please try again.'
    );
    expect(normalizeApiErrorMessage({ code: 'INTERNAL_ERROR' })).toBe(
      'Something went wrong. Please try again.'
    );
    expect(normalizeApiErrorMessage('<!doctype html><html></html>', 'HTTP 502 Bad Gateway')).toBe(
      'HTTP 502 Bad Gateway'
    );
  });

  it('creates Error instances with normalized metadata', () => {
    const error = createApiError(
      {
        errorCode: 'LIMIT_REACHED',
        status: 429,
        errors: { tokens: [{ reason: 'Budget exhausted' }] },
      },
      'Request failed'
    ) as Error & { code?: string; status?: number; details?: unknown; data?: unknown };

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('tokens: Budget exhausted');
    expect(error.code).toBe('LIMIT_REACHED');
    expect(error.status).toBe(429);
    expect(error.details).toEqual({ tokens: [{ reason: 'Budget exhausted' }] });
    expect(error.data).toMatchObject({ errorCode: 'LIMIT_REACHED' });
  });
});
