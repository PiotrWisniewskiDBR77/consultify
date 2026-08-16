import type { NextFunction, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/DbPromise.js', () => ({ run: vi.fn().mockResolvedValue({ changes: 1 }) }));
vi.mock('../../utils/Logger.js', () => ({ default: { error: vi.fn() } }));

import * as DbPromise from '../../utils/DbPromise.js';
import {
  FINANCE_LEGACY_WRITER_ROLLBACK_ENV,
  financeLegacyCutoverGuard,
  findProtectedFinanceLegacyWriter,
} from '../financeLegacyCutover.js';

function request(method: string, path: string, params: Record<string, string> = {}): any {
  return {
    method,
    path,
    params,
    headers: { 'x-request-id': 'request-1' },
    v8Context: { organizationId: 'org-1', userId: 'user-1', userRole: 'finance_admin' },
  };
}

function response(): Response {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('finance legacy cutover guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FINANCE_LEGACY_WRITER_ROLLBACK_ENV];
  });

  it('recognizes only the frozen-contract model approval writer', () => {
    expect(findProtectedFinanceLegacyWriter('POST', '/models/legacy-1/approve')).not.toBeNull();
    expect(findProtectedFinanceLegacyWriter('POST', '/models/legacy-1/compute')).toBeNull();
    expect(findProtectedFinanceLegacyWriter('GET', '/models/legacy-1/approve')).toBeNull();
  });

  it('blocks the protected writer by default and records ID-aware telemetry', async () => {
    const req = request('POST', '/models/legacy-1/approve', { modelId: 'legacy-1' });
    const res = response();
    const next: NextFunction = vi.fn();

    await financeLegacyCutoverGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'FINANCE_LEGACY_WRITER_DISABLED',
        rollbackEnv: FINANCE_LEGACY_WRITER_ROLLBACK_ENV,
      })
    );
    expect(next).not.toHaveBeenCalled();
    expect(DbPromise.run).toHaveBeenCalledWith(
      expect.stringContaining('finance_artifact_aliases'),
      expect.arrayContaining(['legacy_writer_blocked', 'financial_models', 'legacy-1']),
      { fallback: false }
    );
  });

  it('allows the protected writer only under the explicit non-destructive rollback switch', async () => {
    process.env[FINANCE_LEGACY_WRITER_ROLLBACK_ENV] = 'true';
    const next: NextFunction = vi.fn();

    await financeLegacyCutoverGuard(
      request('POST', '/models/legacy-1/approve', { modelId: 'legacy-1' }),
      response(),
      next
    );

    expect(next).toHaveBeenCalledOnce();
    expect(DbPromise.run).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['rollback_writer']),
      { fallback: false }
    );
  });

  it('does not block uncovered writers when telemetry persistence fails', async () => {
    vi.mocked(DbPromise.run).mockRejectedValueOnce(new Error('telemetry unavailable'));
    const next: NextFunction = vi.fn();

    await financeLegacyCutoverGuard(request('POST', '/budgets'), response(), next);

    expect(next).toHaveBeenCalledOnce();
  });
});
