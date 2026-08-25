/**
 * Cross-org tenant regression test for interviewEnterpriseService (M03 Interview V4).
 *
 * Companion to `routes/__tests__/interview-enterprise.routes.tenant.test.ts`,
 * which pins the tenant at the REQUEST layer. This one pins the layer below:
 * even with a correctly-resolved caller org, the service used to accept
 * caller-supplied FOREIGN ids for the rows it references.
 *
 * Two shapes of hole are covered:
 *
 * 1. Session-scoped writes (`segments`, `quotas`, `reminder-schedules`,
 *    `diagnostics`, `findings`) stamped the CALLER'S `organization_id` onto the
 *    new row while taking `session_id` straight off the URL, unchecked. The
 *    result looked tenant-safe (the row carries the right org) but grafted a
 *    child row onto ANOTHER tenant's interview session — invisible to its real
 *    owner, since every read filters by `organization_id`, while still counting
 *    in that session's quota/reminder machinery. `createDistribution` already
 *    had the check inline; the rest did not.
 *
 * 2. `promoteFindingToInitiative` wrote a body-supplied `initiativeId` into the
 *    finding with no ownership check. The UPDATE is org-scoped so no foreign row
 *    is written, but the VALUE stored was unvalidated: a 200 vs 404 told the
 *    caller whether a probed initiative id exists in some other tenant, and the
 *    stored pointer then led every downstream traceability read out of the
 *    tenant.
 *
 * The DB layer is stubbed so the assertions are about the QUERIES issued —
 * specifically, that the ownership probe happens BEFORE the INSERT/UPDATE and
 * that the write never runs when the probe misses.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('../../database/Database.js', () => ({
  getDatabase: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  InterviewDistributionError,
  interviewEnterpriseService,
} from '../interviewEnterpriseService.js';

const CALLER_ORG = 'org-caller';
const VICTIM_SESSION = 'session-belonging-to-another-tenant';
const VICTIM_INITIATIVE = 'initiative-belonging-to-another-tenant';

/** Every ownership probe misses — i.e. the referenced row is not in CALLER_ORG. */
const probeMisses = () => mockQueryOne.mockResolvedValue(undefined);
/** Every ownership probe hits — the referenced row IS in CALLER_ORG. */
const probeHits = (id: string) => mockQueryOne.mockResolvedValue({ id });

describe('interviewEnterpriseService — session-scoped writes are bound to the caller org', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockQueryAll.mockResolvedValue([]);
  });

  const foreignSessionWrites: Array<[string, () => Promise<unknown>]> = [
    [
      'createSegment',
      () =>
        interviewEnterpriseService.createSegment(CALLER_ORG, VICTIM_SESSION, {
          segmentName: 'planted',
          criteria: {},
        }),
    ],
    [
      'createQuota',
      () => interviewEnterpriseService.createQuota(CALLER_ORG, VICTIM_SESSION, { targetCount: 5 }),
    ],
    [
      'createReminderSchedule',
      () => interviewEnterpriseService.createReminderSchedule(CALLER_ORG, VICTIM_SESSION, {}),
    ],
    [
      'createDiagnosticsSnapshot',
      () =>
        interviewEnterpriseService.createDiagnosticsSnapshot(CALLER_ORG, VICTIM_SESSION, {
          snapshotType: 'themes',
          data: {},
        }),
    ],
    [
      'createFinding',
      () =>
        interviewEnterpriseService.createFinding(CALLER_ORG, VICTIM_SESSION, {
          findingType: 'gap',
          title: 'planted',
        }),
    ],
  ];

  for (const [name, invoke] of foreignSessionWrites) {
    it(`${name} refuses a session outside the caller org and writes NOTHING`, async () => {
      probeMisses();
      await expect(invoke()).rejects.toBeInstanceOf(InterviewDistributionError);
      expect(mockQueryRun).not.toHaveBeenCalled();
    });

    it(`${name} probes interview_sessions scoped by BOTH id and organization_id`, async () => {
      probeMisses();
      await expect(invoke()).rejects.toThrow();
      const [sql, params] = mockQueryOne.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/FROM interview_sessions/i);
      expect(sql).toMatch(/organization_id\s*=\s*\?/i);
      expect(params).toEqual([VICTIM_SESSION, CALLER_ORG]);
    });
  }

  it('refuses with 404 (not 403) so "not yours" is indistinguishable from "not there"', async () => {
    probeMisses();
    await expect(
      interviewEnterpriseService.createFinding(CALLER_ORG, VICTIM_SESSION, {
        findingType: 'gap',
        title: 'planted',
      })
    ).rejects.toMatchObject({ statusCode: 404, code: 'SESSION_NOT_FOUND' });
  });

  it('still writes normally when the session IS in the caller org', async () => {
    probeHits('session-ours');
    const finding = await interviewEnterpriseService.createFinding(CALLER_ORG, 'session-ours', {
      findingType: 'risk',
      title: 'legit',
    });
    expect(finding.title).toBe('legit');
    expect(mockQueryRun).toHaveBeenCalledTimes(1);
    const [, params] = mockQueryRun.mock.calls[0] as [string, unknown[]];
    expect(params).toContain(CALLER_ORG);
    expect(params).toContain('session-ours');
  });

  it('createQuota refuses a segment from outside the caller org', async () => {
    // First probe (session) hits, second probe (segment) misses.
    mockQueryOne.mockResolvedValueOnce({ id: 'session-ours' }).mockResolvedValueOnce(undefined);
    await expect(
      interviewEnterpriseService.createQuota(CALLER_ORG, 'session-ours', {
        segmentId: 'segment-of-another-tenant',
        targetCount: 3,
      })
    ).rejects.toBeInstanceOf(InterviewDistributionError);
    expect(mockQueryRun).not.toHaveBeenCalled();
  });
});

describe('interviewEnterpriseService — promoteFindingToInitiative verifies the initiative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRun.mockResolvedValue({ changes: 1 });
  });

  it('refuses an initiative id outside the caller org and writes NOTHING', async () => {
    probeMisses();
    await expect(
      interviewEnterpriseService.promoteFindingToInitiative(
        CALLER_ORG,
        'finding-ours',
        VICTIM_INITIATIVE
      )
    ).rejects.toMatchObject({ statusCode: 404, code: 'INITIATIVE_NOT_FOUND' });
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('probes initiatives scoped by BOTH id and organization_id', async () => {
    probeMisses();
    await expect(
      interviewEnterpriseService.promoteFindingToInitiative(
        CALLER_ORG,
        'finding-ours',
        VICTIM_INITIATIVE
      )
    ).rejects.toThrow();
    const [sql, params] = mockQueryOne.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/FROM initiatives/i);
    expect(sql).toMatch(/organization_id\s*=\s*\?/i);
    expect(params).toEqual([VICTIM_INITIATIVE, CALLER_ORG]);
  });

  it('promotes normally when the initiative IS in the caller org', async () => {
    probeHits('initiative-ours');
    const ok = await interviewEnterpriseService.promoteFindingToInitiative(
      CALLER_ORG,
      'finding-ours',
      'initiative-ours'
    );
    expect(ok).toBe(true);
    const [sql, params] = mockQueryRun.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/UPDATE interview_findings/i);
    // The UPDATE stays org-scoped on top of the pre-check.
    expect(params).toContain(CALLER_ORG);
  });
});
