/**
 * toolSessionApi — unit tests.
 *
 * Mocks the named `Api` exports (never `window.fetch`, per the documented
 * project trap — see toolSessionApi.ts's file header and
 * MEMORY.md gendeck-genexcel-nadganianie-2026-07-23) and asserts:
 *   - create/get/update are thin, faithful pass-throughs to the real
 *     `/api/tools` endpoints already implemented in
 *     server/src/routes/tools.routes.ts;
 *   - the error classifiers correctly tell apart an unreachable network
 *     (no `.status`, thrown by `fetch()` itself) from a real HTTP error
 *     response (`.status` set by `src/services/api.ts`'s `handleResponse`,
 *     see api.ts:1026-1029).
 */
import { describe, expect, it, vi } from 'vitest';

const { createToolSession, getToolSession, updateToolSession } = vi.hoisted(() => ({
  createToolSession: vi.fn(),
  getToolSession: vi.fn(),
  updateToolSession: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: { createToolSession, getToolSession, updateToolSession },
}));

import {
  getErrorMessage,
  isConflictError,
  isNotFoundError,
  isOfflineError,
  toolSessionApi,
} from '../toolSessionApi';

describe('toolSessionApi', () => {
  it('create() forwards to Api.createToolSession and returns its result', async () => {
    createToolSession.mockResolvedValueOnce({ id: 'tool-1', status: 'DRAFT' });
    const result = await toolSessionApi.create({ toolType: 'dynamic-swot', name: 'X' });
    expect(createToolSession).toHaveBeenCalledWith({ toolType: 'dynamic-swot', name: 'X' });
    expect(result).toEqual({ id: 'tool-1', status: 'DRAFT' });
  });

  it('get() forwards to Api.getToolSession', async () => {
    getToolSession.mockResolvedValueOnce({ id: 'tool-1', answers: { a: 1 } });
    const result = await toolSessionApi.get('tool-1');
    expect(getToolSession).toHaveBeenCalledWith('tool-1');
    expect(result.answers).toEqual({ a: 1 });
  });

  it('update() forwards to Api.updateToolSession, including expectedVersion', async () => {
    updateToolSession.mockResolvedValueOnce({ id: 'tool-1', status: 'DRAFT', updatedAt: 'now' });
    await toolSessionApi.update('tool-1', { answers: { a: 2 }, expectedVersion: 3 });
    expect(updateToolSession).toHaveBeenCalledWith('tool-1', {
      answers: { a: 2 },
      expectedVersion: 3,
    });
  });
});

describe('error classifiers', () => {
  it('isOfflineError: true for a fetch-thrown TypeError with no .status', () => {
    const err = new TypeError('Failed to fetch');
    expect(isOfflineError(err)).toBe(true);
  });

  it('isOfflineError: false for a real HTTP error (.status set)', () => {
    const err = Object.assign(new Error('Not found'), { status: 404 });
    expect(isOfflineError(err)).toBe(false);
  });

  it('isOfflineError: false for a non-network TypeError-shaped error carrying a status', () => {
    const err = Object.assign(new TypeError('boom'), { status: 500 });
    expect(isOfflineError(err)).toBe(false);
  });

  it('isConflictError: true only for status 409', () => {
    expect(isConflictError(Object.assign(new Error('x'), { status: 409 }))).toBe(true);
    expect(isConflictError(Object.assign(new Error('x'), { status: 500 }))).toBe(false);
    expect(isConflictError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isConflictError(null)).toBe(false);
  });

  it('isNotFoundError: true only for status 404', () => {
    expect(isNotFoundError(Object.assign(new Error('x'), { status: 404 }))).toBe(true);
    expect(isNotFoundError(Object.assign(new Error('x'), { status: 409 }))).toBe(false);
  });

  it('getErrorMessage: returns the Error message, falling back for non-Errors', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage('not an error', 'fallback')).toBe('fallback');
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
  });
});
