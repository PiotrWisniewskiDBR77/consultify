import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import {
  EXECUTION_SPINE_LEGACY_READ_ONLY_CODE,
  requireCanonicalExecutionWriter,
  requireCanonicalInitiativeExecutionWriter,
} from '../executionSpineLegacyReadOnly.middleware.js';

function invoke(method: string, path = '') {
  const status = vi.fn();
  const json = vi.fn();
  status.mockReturnValue({ json });
  const next = vi.fn() as NextFunction;

  requireCanonicalExecutionWriter(
    { method, path } as Request,
    { status } as unknown as Response,
    next
  );

  return { status, json, next };
}

function invokeInitiative(method: string, path: string) {
  const status = vi.fn();
  const json = vi.fn();
  status.mockReturnValue({ json });
  const next = vi.fn() as NextFunction;

  requireCanonicalInitiativeExecutionWriter(
    { method, path } as Request,
    { status } as unknown as Response,
    next
  );

  return { status, json, next };
}

describe('execution spine legacy read-only boundary', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])('allows %s compatibility reads', (method) => {
    const result = invoke(method);
    expect(result.next).toHaveBeenCalledOnce();
    expect(result.status).not.toHaveBeenCalled();
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'denies %s with the canonical writer contract',
    (method) => {
      const result = invoke(method);
      expect(result.next).not.toHaveBeenCalled();
      expect(result.status).toHaveBeenCalledWith(409);
      expect(result.json).toHaveBeenCalledWith({
        error: 'Legacy execution writes are retired. Use the canonical Runtime-v1 execution API.',
        code: EXECUTION_SPINE_LEGACY_READ_ONLY_CODE,
        canonicalWriter: '/api/initiatives/runtime-v1',
      });
    }
  );

  it('allows only the receipted governed budget delete command through the legacy namespace guard', () => {
    const exact = invoke('DELETE', '/budget/entries/entry-1');
    expect(exact.next).toHaveBeenCalledOnce();
    expect(exact.status).not.toHaveBeenCalled();

    for (const path of [
      '/budget/entries',
      '/budget/entries/entry-1/other',
      '/budget/initiative/initiative-1',
    ]) {
      const nearMiss = invoke('DELETE', path);
      expect(nearMiss.next).not.toHaveBeenCalled();
      expect(nearMiss.status).toHaveBeenCalledWith(409);
    }
  });

  it.each([
    '/initiative-1/milestones',
    '/initiative-1/resources/resource-1',
    '/initiative-1/staffing-plans/plan-1/roles',
    '/initiative-1/budget-items/item-1',
    '/initiative-1/raid/risk-1',
    '/initiative-1/start-execution',
    '/initiative-1/lifecycle-gate-decisions',
    '/initiative-1/apply-template',
  ])('denies the legacy Initiative execution writer %s', (path) => {
    const result = invokeInitiative('POST', path);
    expect(result.next).not.toHaveBeenCalled();
    expect(result.status).toHaveBeenCalledWith(409);
  });

  it.each([
    '/wizard/sessions',
    '/similarity-check',
    '/initiative-1/merge-from-insight',
    '/templates',
    '/initiative-1/profile',
    '/initiative-1/changes',
    '/initiative-1/complete',
    '/initiative-1/comments',
  ])('keeps the unrelated Initiative writer %s mounted', (path) => {
    const result = invokeInitiative('POST', path);
    expect(result.next).toHaveBeenCalledOnce();
    expect(result.status).not.toHaveBeenCalled();
  });
});
