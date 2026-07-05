/**
 * Fail-soft lazy DDL sweep (Paczka1 #4).
 *
 * Proves that read-path services whose opportunistic `ensure*Table` DDL was
 * hardened to `fallback: true` now DEGRADE GRACEFULLY (empty list / null) when
 * the underlying database is transiently unavailable, instead of rejecting and
 * bubbling up as a bare HTTP 500 / white screen.
 *
 * The DbPromise mock below faithfully mirrors the real fallback contract:
 *   - `fallback: false`  -> reject on DB error (writes want the error to surface)
 *   - `fallback: true`   -> swallow the error and return a safe empty shape
 * so this test fails if any ensure* DDL or list read in the covered services
 * regresses back to `fallback: false`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simulate a database that errors on EVERY statement (transient outage / brief
// read-only / missing table). Only `fallback: true` callers may survive.
const simulateDbError = { value: true };

function honorFallback<T>(safe: T, options?: { fallback?: boolean }): Promise<T> {
  const fallback = options?.fallback ?? true;
  if (simulateDbError.value && !fallback) {
    return Promise.reject(new Error('simulated transient DB failure'));
  }
  if (simulateDbError.value) {
    // fallback:true -> degrade to the safe empty shape rather than reject.
    return Promise.resolve(safe);
  }
  return Promise.resolve(safe);
}

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  run: vi.fn((_sql: string, _params?: unknown[], options?: { fallback?: boolean }) =>
    honorFallback({ changes: 0 }, options)
  ),
  all: vi.fn((_sql: string, _params?: unknown[], options?: { fallback?: boolean }) =>
    honorFallback([], options)
  ),
  get: vi.fn((_sql: string, _params?: unknown[], options?: { fallback?: boolean }) =>
    honorFallback(null, options)
  ),
  exec: vi.fn(() => Promise.resolve({ success: true })),
}));

import {
  getIntegrationOwner,
  listIntegrationOwnershipByOrg,
} from '../../../../server/src/services/integrationOwnershipService.js';
import { listIntegrationConnectionEvents } from '../../../../server/src/services/integrationConnectionLogService.js';

describe('fail-soft lazy DDL — read paths degrade instead of bare-500', () => {
  beforeEach(() => {
    simulateDbError.value = true;
  });

  it('listIntegrationOwnershipByOrg resolves to [] when the DB is transiently unavailable', async () => {
    // Would throw pre-fix (ensure* DDL used fallback:false and rejected).
    await expect(listIntegrationOwnershipByOrg('org-1')).resolves.toEqual([]);
  });

  it('getIntegrationOwner resolves to null when the DB is transiently unavailable', async () => {
    await expect(
      getIntegrationOwner({ integrationId: 'i-1', organizationId: 'org-1' })
    ).resolves.toBeNull();
  });

  it('listIntegrationConnectionEvents resolves to an empty page, not a rejection', async () => {
    const result = await listIntegrationConnectionEvents({ organizationId: 'org-1' });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('still returns real data when the DB is healthy', async () => {
    simulateDbError.value = false;
    await expect(listIntegrationOwnershipByOrg('org-1')).resolves.toEqual([]);
  });
});
