/** @vitest-environment node */

import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import { mapAppErrorResponse } from '../../../middleware/appErrorMapper.js';
import { AppError } from '../../../utils/ErrorHandler.js';

describe('DAY325 pomiar AppError bez kodu słownika', () => {
  it('polski nagłówek nie tłumaczy operacyjnego AppError bez kodu', () => {
    const req = {
      get: (name: string) => name === 'Accept-Language' ? 'pl' : undefined,
    } as unknown as Request;
    const response = mapAppErrorResponse(new AppError('Failed to fetch organizations', 500), req);

    expect(response.errorCode).toBe('INTERNAL_ERROR');
    expect(response.error).toBe('Failed to fetch organizations');
  });
});
