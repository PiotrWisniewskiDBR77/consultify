import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * D-19 v2 (Wpis 69 · wariant (c) · DEC-539) — the seed's FINAL step must, after
 * seeding the northwind org, call the SAME planner/apply that the ops script
 * `align-initiative-aggregate-state.ts` uses — imported from the shared service
 * `alignInitiativeAggregateService` (function import, NOT child_process) — for
 * the seed's own org id. Without this the demo seed leaves the canonical
 * aggregate at REGISTERED_DRAFT while the column says IN_EXECUTION, and the
 * STAGE-1 backfill (migration 20262260) would show executing initiatives as
 * "Draft registered".
 *
 * The DB-run proof (Northwind 0-change + Atelier Toys numbers on a dump copy)
 * lives in the Wpis 69 report; this test pins the WIRING so removing the call
 * turns red.
 */
vi.mock('../../../server/src/services/initiatives/alignInitiativeAggregateService.js', () => ({
  processOrg: vi.fn(),
}));

import { processOrg } from '../../../server/src/services/initiatives/alignInitiativeAggregateService.js';
import { uruchomAlignKrok } from '../../../server/scripts/seed/demo-en/98-align.js';
import { ORG_ID, ORG_SLUG, det, TAG } from '../../../server/scripts/seed/demo-en/00-wspolne.js';

const processOrgMock = vi.mocked(processOrg);

function fakeCounts(align: number, already: number, shortCircuit: number, noStage: number) {
  return {
    align,
    'skip-aligned': already,
    'skip-short-circuit': shortCircuit,
    'skip-no-stage': noStage,
    alignByStatus: {} as Record<string, number>,
  };
}

beforeEach(() => {
  processOrgMock.mockReset();
});

describe('98-align seed step — wiring to the align planner', () => {
  it('calls processOrg with the seed org id (the deterministic northwind UUID)', () => {
    // Pin the seed identity: ORG_ID is the deterministic northwind uuid, so the
    // align step can never be pointed at some other org by accident.
    expect(ORG_ID).toBe(det('organization', ORG_SLUG));

    processOrgMock.mockResolvedValue({
      counts: fakeCounts(0, 5, 0, 0),
      wrote: 0,
      name: 'Northwind Manufacturing Ltd.',
      allowed: true,
    });

    const client = {} as never;
    return uruchomAlignKrok(client, ORG_ID, true).then(() => {
      expect(processOrgMock).toHaveBeenCalledTimes(1);
      expect(processOrgMock).toHaveBeenCalledWith(client, ORG_ID, true);
    });
  });

  it('forwards dry-run mode (apply=false) unchanged to the planner', async () => {
    processOrgMock.mockResolvedValue({
      counts: fakeCounts(3, 0, 0, 0),
      wrote: 0,
      name: 'Northwind Manufacturing Ltd.',
      allowed: true,
    });
    const client = {} as never;
    await uruchomAlignKrok(client, ORG_ID, false);
    expect(processOrgMock).toHaveBeenCalledWith(client, ORG_ID, false);
  });

  it('maps the planner counts onto the seed log numbers (aligned/already/skipped/wrote)', async () => {
    processOrgMock.mockResolvedValue({
      counts: fakeCounts(7, 12, 2, 1),
      wrote: 7,
      name: 'Atelier Toys',
      allowed: true,
    });
    const client = {} as never;
    const result = await uruchomAlignKrok(client, ORG_ID, true);
    expect(result).toEqual({ aligned: 7, already: 12, skipped: 3, wrote: 7 });
  });
});

describe('00-wspolne seed identity — stable namespace', () => {
  it('ORG_ID is derived from the fixed seed tag/slug, never a hard-coded literal', () => {
    expect(ORG_SLUG).toBe('northwind');
    expect(TAG).toBe('northwind-demo-2026');
    expect(ORG_ID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
