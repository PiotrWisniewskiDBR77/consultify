/**
 * FIX-1 (docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX2_JEDEN_MAGAZYN_2/97_ODBIOR_W1_W2.md §8) —
 * `PUT /api/initiatives/:id` on a canonical record replies `409
 * { code: 'INITIATIVE_CANONICAL_WRITE_REQUIRED', unsupportedFields, canonicalWriter }`
 * with NO `message`/`error` field (server carries only the code — rule E1b.2).
 *
 * Before this fix, `INITIATIVE_CANONICAL_WRITE_REQUIRED` was absent from
 * `API_ERROR_FALLBACKS_EN`, so `normalizeApiErrorMessage` fell through to the
 * generic `HTTP 409 Conflict` fallback and the user never saw a real sentence
 * (§5.6 of the odbiór report).
 */

import { describe, expect, it } from 'vitest';

import { normalizeApiError, normalizeApiErrorMessage } from '../apiError';
import { API_ERROR_FALLBACKS_EN } from '../apiErrorFallbacks';

describe('INITIATIVE_CANONICAL_WRITE_REQUIRED error mapping (FIX-1)', () => {
  it('is registered in API_ERROR_FALLBACKS_EN with a real sentence, not a placeholder', () => {
    const fallback = API_ERROR_FALLBACKS_EN.INITIATIVE_CANONICAL_WRITE_REQUIRED;
    expect(fallback).toBeTruthy();
    expect(fallback).not.toMatch(/^HTTP \d/);
    expect(fallback.toLowerCase()).not.toContain('conflict');
  });

  it('normalizeApiError preserves the code from the server body (no message/error field)', () => {
    const body = {
      code: 'INITIATIVE_CANONICAL_WRITE_REQUIRED',
      unsupportedFields: ['priority'],
      canonicalWriter: '/api/initiatives/runtime-v1',
    };
    const normalized = normalizeApiError(body, 'HTTP 409 Conflict');
    expect(normalized.code).toBe('INITIATIVE_CANONICAL_WRITE_REQUIRED');
  });

  it('normalizeApiErrorMessage resolves a real sentence instead of the generic HTTP fallback', () => {
    const body = {
      code: 'INITIATIVE_CANONICAL_WRITE_REQUIRED',
      unsupportedFields: ['priority'],
      canonicalWriter: '/api/initiatives/runtime-v1',
    };
    const message = normalizeApiErrorMessage(body, 'HTTP 409 Conflict');
    expect(message).toBe(API_ERROR_FALLBACKS_EN.INITIATIVE_CANONICAL_WRITE_REQUIRED);
    expect(message).not.toBe('HTTP 409 Conflict');
  });
});
