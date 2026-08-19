import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import {
  EXECUTION_SPINE_LEGACY_READ_ONLY_CODE,
  requireCanonicalExecutionWriter,
} from '../executionSpineLegacyReadOnly.middleware.js';

function invoke(method: string) {
  const status = vi.fn();
  const json = vi.fn();
  status.mockReturnValue({ json });
  const next = vi.fn() as NextFunction;

  requireCanonicalExecutionWriter(
    { method } as Request,
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
});
