/**
 * Unit tests for financialModelingService.createModel — cross-org FK-injection
 * guard (M16 finance hardening, wave 11 reconciliation).
 *
 * `createModel` persists params.projectId / params.initiativeId straight into
 * financial_models.{project_id,initiative_id}. Without an ownership check a
 * caller in org A could pass a projectId/initiativeId owned by org B and graft
 * a foreign FK onto its own model (integrity / FK-injection). These tests pin
 * that:
 *   (a) a foreign-org projectId throws 'not found' BEFORE any INSERT runs,
 *   (b) a foreign-org initiativeId throws 'not found' BEFORE any INSERT runs,
 *   (c) the ownership probes filter by the caller's organization_id,
 *   (d) same-org FKs (or no FKs) write through to a single INSERT.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const run = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: vi.fn().mockResolvedValue([]),
  get: (...args: unknown[]) => get(...args),
  run: (...args: unknown[]) => run(...args),
}));

import { createModel } from '../financialModelingService.js';

const ORG = 'org-caller';
const baseParams = {
  organizationId: ORG,
  name: 'Q4 model',
  startDate: '2026-01-01',
  createdBy: 'user-1',
};

beforeEach(() => {
  get.mockReset();
  run.mockReset();
  run.mockResolvedValue({ changes: 1 });
});

describe('financialModelingService.createModel — cross-org FK-injection guard', () => {
  it('rejects a foreign-org projectId and does NOT INSERT', async () => {
    // Ownership probe for the foreign project finds nothing in the caller org.
    get.mockResolvedValueOnce(undefined);

    await expect(
      createModel({ ...baseParams, projectId: 'project-owned-by-victim' })
    ).rejects.toThrow(/not found/i);

    // Probe filtered by the caller's org.
    const [sql, params] = get.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/FROM projects/i);
    expect(params).toEqual(['project-owned-by-victim', ORG]);
    // The FK-injection must never reach the INSERT.
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects a foreign-org initiativeId and does NOT INSERT', async () => {
    get.mockResolvedValueOnce(undefined);

    await expect(
      createModel({ ...baseParams, initiativeId: 'initiative-owned-by-victim' })
    ).rejects.toThrow(/not found/i);

    const [sql, params] = get.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/FROM initiatives/i);
    expect(params).toEqual(['initiative-owned-by-victim', ORG]);
    expect(run).not.toHaveBeenCalled();
  });

  it('accepts a same-org projectId + initiativeId and writes one INSERT', async () => {
    // Both ownership probes resolve to a row owned by the caller org.
    get.mockResolvedValueOnce({ id: 'project-mine' });
    get.mockResolvedValueOnce({ id: 'initiative-mine' });

    const id = await createModel({
      ...baseParams,
      projectId: 'project-mine',
      initiativeId: 'initiative-mine',
    });

    expect(typeof id).toBe('string');
    expect(run).toHaveBeenCalledTimes(1);
    const [sql, params] = run.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/INSERT INTO financial_models/i);
    expect(params).toContain('project-mine');
    expect(params).toContain('initiative-mine');
  });

  it('writes through with no FK probes when neither projectId nor initiativeId is supplied', async () => {
    const id = await createModel({ ...baseParams });

    expect(typeof id).toBe('string');
    // No ownership probes were needed.
    expect(get).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
