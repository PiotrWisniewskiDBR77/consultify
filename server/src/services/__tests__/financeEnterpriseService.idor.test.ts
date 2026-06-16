/**
 * Cross-org IDOR regression test for financeEnterpriseService.createModelVersion.
 *
 * When a new model version is branched from a `parentVersionId`, the parent
 * snapshot (assumptions/events/outputs) was previously read by `WHERE id = ?`
 * with NO org filter — letting org B seed a version from org A's confidential
 * financial snapshot. The fix scopes that read to the caller's org.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryOne = vi.fn();
const queryRun = vi.fn();
const queryAll = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: (...a: unknown[]) => queryOne(...a),
  queryRun: (...a: unknown[]) => queryRun(...a),
  queryAll: (...a: unknown[]) => queryAll(...a),
}));

vi.mock('../../database/Database.js', () => ({ getDatabase: vi.fn() }));

import { financeEnterpriseService } from '../financeEnterpriseService.js';

const ORG = 'org-attacker';
const PARENT_VERSION = 'version-owned-by-victim';

describe('financeEnterpriseService.createModelVersion — cross-org parent read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryRun.mockResolvedValue({ changes: 1 });
  });

  it('scopes the parent-version snapshot read to the caller org', async () => {
    // version-number lookup, then the parent snapshot lookup (returns null:
    // foreign-org parent is invisible).
    queryOne.mockResolvedValueOnce({ maxV: 0 }).mockResolvedValueOnce(null);

    await financeEnterpriseService.createModelVersion(ORG, 'user-1', {
      modelId: 'model-1',
      parentVersionId: PARENT_VERSION,
    });

    const parentCall = queryOne.mock.calls.find((c) =>
      String(c[0]).includes('assumptions_snapshot')
    );
    expect(parentCall).toBeDefined();
    const [sql, params] = parentCall as [string, unknown[]];
    // The parent read MUST be org-filtered.
    expect(sql).toMatch(/organization_id\s*=\s*\?/i);
    expect(params).toEqual([PARENT_VERSION, ORG]);
  });

  it('does NOT copy a foreign-org parent snapshot into the new version', async () => {
    queryOne.mockResolvedValueOnce({ maxV: 0 }).mockResolvedValueOnce(null);

    await financeEnterpriseService.createModelVersion(ORG, 'user-1', {
      modelId: 'model-1',
      parentVersionId: PARENT_VERSION,
    });

    const insert = queryRun.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO financial_model_versions')
    );
    expect(insert).toBeDefined();
    const [, params] = insert as [string, unknown[]];
    // Defaults persist (empty snapshots) — no leaked victim data.
    expect(params).toContain('{}');
    expect(params).toContain('[]');
  });
});
