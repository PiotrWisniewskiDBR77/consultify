/**
 * Unit tests — gateTimelineService (M13 Depth · Fala 1 / G3).
 *
 * Covers GATE_AI_SPEC §4: planning-gate guard, dependency readiness (block),
 * date-conflict (warn), and fail-open on DB error. The DB util is mocked so
 * these are pure logic tests with no real database.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the DB util the service imports (path relative to THIS test file).
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
}));

// Silence the logger.
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getTimelineFlags } from '../../../server/src/services/initiative/gateTimelineService';
import { GateType } from '../../../server/src/constants/initiativeStatuses';
import * as queryHelpers from '../../../server/src/utils/queryHelpers.js';

const ORG = 'org-1';
const INIT = 'init-subject';

/** A scheduled-ish subject initiative with a concrete window + owner. */
const subjectRow = {
  id: INIT,
  status: 'APPROVED',
  owner_execution_id: 'user-owner',
  owner_business_id: null,
  planned_start_date: '2026-07-01T00:00:00.000Z',
  planned_end_date: '2026-07-31T00:00:00.000Z',
  start_date: null,
  end_date: null,
};

/**
 * Wire queryOne (subject load) and queryAll (deps, then date-conflicts) in the
 * order the service calls them.
 */
function wireQueries(opts: {
  subject?: unknown;
  deps?: unknown[];
  conflicts?: unknown[];
}) {
  vi.mocked(queryHelpers.queryOne).mockResolvedValue(
    (opts.subject === undefined ? subjectRow : opts.subject) as any
  );
  const all = vi.mocked(queryHelpers.queryAll);
  all.mockReset();
  // 1st queryAll = dependency query, 2nd = date-conflict query.
  all
    .mockResolvedValueOnce((opts.deps ?? []) as any)
    .mockResolvedValueOnce((opts.conflicts ?? []) as any);
}

describe('gateTimelineService.getTimelineFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for a non-planning gate (APPROVE) without touching the DB', async () => {
    const result = await getTimelineFlags(INIT, GateType.APPROVE, ORG);
    expect(result).toBeNull();
    expect(queryHelpers.queryOne).not.toHaveBeenCalled();
    expect(queryHelpers.queryAll).not.toHaveBeenCalled();
  });

  it('runs analysis for SCHEDULE and START (planning gates)', async () => {
    wireQueries({ deps: [], conflicts: [] });
    const schedule = await getTimelineFlags(INIT, GateType.SCHEDULE, ORG);
    expect(schedule).not.toBeNull();

    wireQueries({ deps: [], conflicts: [] });
    const start = await getTimelineFlags(INIT, GateType.START, ORG);
    expect(start).not.toBeNull();
  });

  it('flags an unready finish-to-start dependency as a single block', async () => {
    wireQueries({
      deps: [
        {
          dep_id: 'dep-1',
          from_initiative_id: 'pred-1',
          from_name: 'Migracja danych',
          from_status: 'PLANNING', // earlier than SCHEDULED → unready
        },
      ],
      conflicts: [],
    });

    const result = await getTimelineFlags(INIT, GateType.SCHEDULE, ORG);
    const depFlags = result!.flags.filter((f) => f.kind === 'dependency');
    expect(depFlags).toHaveLength(1);
    expect(depFlags[0].severity).toBe('block');
    expect(depFlags[0].refs).toEqual(['pred-1']);
    expect(depFlags[0].message).toContain('PLANNING');
  });

  it('emits no dependency flags when all predecessors are ready (>= SCHEDULED)', async () => {
    wireQueries({
      deps: [
        { dep_id: 'd1', from_initiative_id: 'p1', from_name: 'A', from_status: 'SCHEDULED' },
        { dep_id: 'd2', from_initiative_id: 'p2', from_name: 'B', from_status: 'EXECUTING' },
        { dep_id: 'd3', from_initiative_id: 'p3', from_name: 'C', from_status: 'DONE' },
      ],
      conflicts: [],
    });

    const result = await getTimelineFlags(INIT, GateType.SCHEDULE, ORG);
    expect(result!.flags.filter((f) => f.kind === 'dependency')).toHaveLength(0);
  });

  it('warns on a date overlap with another SCHEDULED initiative of the same owner', async () => {
    wireQueries({
      deps: [],
      conflicts: [
        {
          id: 'other-1',
          name: 'Wdrożenie ERP',
          status: 'SCHEDULED',
          planned_start_date: '2026-07-15T00:00:00.000Z', // overlaps subject Jul 1–31
          planned_end_date: '2026-08-15T00:00:00.000Z',
          start_date: null,
          end_date: null,
        },
      ],
    });

    const result = await getTimelineFlags(INIT, GateType.SCHEDULE, ORG);
    const dateFlags = result!.flags.filter((f) => f.kind === 'date_conflict');
    expect(dateFlags).toHaveLength(1);
    expect(dateFlags[0].severity).toBe('warn');
    expect(dateFlags[0].refs).toEqual(['other-1']);
  });

  it('does not warn when the other initiative window does not overlap', async () => {
    wireQueries({
      deps: [],
      conflicts: [
        {
          id: 'other-2',
          name: 'Nienakładające',
          status: 'SCHEDULED',
          planned_start_date: '2026-09-01T00:00:00.000Z', // after subject ends Jul 31
          planned_end_date: '2026-09-30T00:00:00.000Z',
          start_date: null,
          end_date: null,
        },
      ],
    });

    const result = await getTimelineFlags(INIT, GateType.SCHEDULE, ORG);
    expect(result!.flags.filter((f) => f.kind === 'date_conflict')).toHaveLength(0);
  });

  it('never emits a resource_conflict flag (skipped — no schema)', async () => {
    wireQueries({ deps: [], conflicts: [] });
    const result = await getTimelineFlags(INIT, GateType.SCHEDULE, ORG);
    expect(result!.flags.some((f) => f.kind === 'resource_conflict')).toBe(false);
  });

  it('fails open (returns null) when the DB throws', async () => {
    vi.mocked(queryHelpers.queryOne).mockRejectedValue(new Error('no such table'));
    const result = await getTimelineFlags(INIT, GateType.SCHEDULE, ORG);
    expect(result).toBeNull();
  });

  it('returns empty flags (not null) when the subject initiative is absent', async () => {
    vi.mocked(queryHelpers.queryOne).mockResolvedValue(null as any);
    const result = await getTimelineFlags(INIT, GateType.START, ORG);
    expect(result).toEqual({ flags: [] });
  });
});
