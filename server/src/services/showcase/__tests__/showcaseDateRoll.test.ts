/**
 * SR-1 Showcase Date-Roll — unit tests (NO database).
 *
 * The service is exercised through `buildShowcaseDateRoll(db)` with an in-memory
 * fake connection that captures every statement, so the roll logic (delta,
 * idempotency, first-run initialization, org scoping, dry-run) and the nightly
 * job gating (flag OFF / empty org list) are proven deterministically without
 * Postgres. The real-data RealPG proof is station B's part 2 (Wpis 32).
 *
 * Each business rule below has a mutation note: the change that would make it
 * red is named in the test title's MUTANT comment.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  buildShowcaseDateRoll,
  computeDeltaDays,
  SHOWCASE_DATE_FIELDS,
  toUtcDateOnly,
  type ShowcaseRollStatement,
} from '../showcaseDateRollService.js';
import {
  isShowcaseDateRollEnabled,
  parseShowcaseOrgIds,
  runShowcaseDateRollTick,
} from '../showcaseDateRollScheduler.js';

interface Captured {
  transactions: ShowcaseRollStatement[][];
  selects: { sql: string; params: unknown[] }[];
}

/** Fake connection: `all` answers the watermark + count SELECTs; `transaction` records statements. */
function makeFakeDb(opts: { watermark?: string | null; count?: number } = {}) {
  const captured: Captured = { transactions: [], selects: [] };
  const db = {
    all: async <T,>(sql: string, params?: unknown[]): Promise<T[]> => {
      captured.selects.push({ sql, params: params ?? [] });
      if (/FROM public\.showcase_date_roll/.test(sql)) {
        return (opts.watermark == null ? [] : [{ last_rolled_on: opts.watermark }]) as T[];
      }
      return [{ n: opts.count ?? 0 }] as T[];
    },
    transaction: async (statements: ShowcaseRollStatement[]) => {
      captured.transactions.push(statements);
      return {
        success: true,
        results: statements.map(() => ({ success: true, changes: 0 })),
      };
    },
  };
  return { db, captured };
}

const TODAY = new Date('2026-09-17T09:30:00Z');

describe('computeDeltaDays', () => {
  it('returns whole UTC days between watermark and today', () => {
    expect(computeDeltaDays(TODAY, new Date('2026-09-10T00:00:00Z'))).toBe(7);
  });

  it('ignores the time-of-day of both operands (UTC midnight reduction)', () => {
    // MUTANT: dropping the Date.UTC midnight reduction makes this red.
    expect(computeDeltaDays(new Date('2026-09-17T23:59:00Z'), new Date('2026-09-10T00:01:00Z'))).toBe(7);
    expect(computeDeltaDays(new Date('2026-09-17T00:00:00Z'), new Date('2026-09-10T23:59:00Z'))).toBe(7);
  });

  it('is 0 for the same day and negative when today precedes the watermark', () => {
    expect(computeDeltaDays(TODAY, new Date('2026-09-17T00:00:00Z'))).toBe(0);
    expect(computeDeltaDays(TODAY, new Date('2026-09-20T00:00:00Z'))).toBe(-3);
  });
});

describe('toUtcDateOnly', () => {
  it('formats a Date as UTC YYYY-MM-DD regardless of local zone', () => {
    expect(toUtcDateOnly(new Date('2026-09-17T23:30:00Z'))).toBe('2026-09-17');
    expect(toUtcDateOnly(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01');
  });
});

describe('rollShowcaseDates — delta + write path', () => {
  it('shifts by the computed delta and binds [orgId, delta] into every table UPDATE', async () => {
    const { db, captured } = makeFakeDb({ watermark: '2026-09-10' });
    const res = await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a'] });

    expect(res).toHaveLength(1);
    expect(res[0].deltaDays).toBe(7);
    expect(res[0].lastRolledOn).toBe('2026-09-17');
    expect(res[0].skipped).toBeUndefined();

    // One transaction for the org: 9 table UPDATEs + 1 watermark upsert.
    expect(captured.transactions).toHaveLength(1);
    const stmts = captured.transactions[0];
    expect(stmts).toHaveLength(SHOWCASE_DATE_FIELDS.length + 1);

    const updates = stmts.slice(0, SHOWCASE_DATE_FIELDS.length);
    for (const u of updates) {
      expect(u.params).toEqual(['org-a', 7]); // MUTANT: hardcoding delta 0 makes this red.
      expect(u.sql).toMatch(/^UPDATE public\."/);
      expect(u.sql).toContain('"organization_id" = $1');
    }
    // The final statement is the watermark upsert bound to today.
    expect(stmts[stmts.length - 1].sql).toMatch(/INSERT INTO public\.showcase_date_roll/);
    expect(stmts[stmts.length - 1].params).toEqual(['org-a', '2026-09-17']);
  });

  it('emits a SET clause for every group-(a) column of each table (single source of truth)', async () => {
    const { db, captured } = makeFakeDb({ watermark: '2026-09-10' });
    await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a'] });
    const updates = captured.transactions[0].slice(0, SHOWCASE_DATE_FIELDS.length);

    SHOWCASE_DATE_FIELDS.forEach((t, i) => {
      const sql = updates[i].sql;
      expect(sql).toContain(`public."${t.table}"`);
      for (const c of t.columns) {
        // MUTANT: removing a column from SHOWCASE_DATE_FIELDS drops it here → red.
        expect(sql).toContain(`"${c.column}" =`);
      }
    });
  });

  it('covers exactly 9 tables / 23 columns, all scoped by organization_id', () => {
    expect(SHOWCASE_DATE_FIELDS).toHaveLength(9);
    const colCount = SHOWCASE_DATE_FIELDS.reduce((n, t) => n + t.columns.length, 0);
    expect(colCount).toBe(23);
    for (const t of SHOWCASE_DATE_FIELDS) expect(t.orgColumn).toBe('organization_id');
  });
});

describe('rollShowcaseDates — idempotency', () => {
  it('does nothing (no transaction) when the watermark already equals today', async () => {
    // MUTANT: removing the `delta === 0` early return makes this red (a write happens).
    const { db, captured } = makeFakeDb({ watermark: '2026-09-17' });
    const res = await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a'] });

    expect(res[0].deltaDays).toBe(0);
    expect(res[0].skipped).toBe('up_to_date');
    expect(res[0].perTable).toEqual({});
    expect(captured.transactions).toHaveLength(0);
  });

  it('a second same-day pass is a no-op after the first advanced the watermark', async () => {
    const { db, captured } = makeFakeDb({ watermark: '2026-09-10' });
    const roll = buildShowcaseDateRoll(db).roll;
    await roll({ today: TODAY, orgIds: ['org-a'] });
    expect(captured.transactions).toHaveLength(1);
    // Simulate the watermark now being today.
    const second = makeFakeDb({ watermark: '2026-09-17' });
    const res2 = await buildShowcaseDateRoll(second.db).roll({ today: TODAY, orgIds: ['org-a'] });
    expect(res2[0].skipped).toBe('up_to_date');
    expect(second.captured.transactions).toHaveLength(0);
  });
});

describe('rollShowcaseDates — first run initializes without shifting', () => {
  it('writes only the watermark (no table UPDATE) when no row exists', async () => {
    // MUTANT: removing the `!last` first-run branch makes this red (UPDATEs run).
    const { db, captured } = makeFakeDb({ watermark: null });
    const res = await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a'] });

    expect(res[0].deltaDays).toBe(0);
    expect(res[0].skipped).toBe('initialized');
    expect(captured.transactions).toHaveLength(1);
    const stmts = captured.transactions[0];
    expect(stmts).toHaveLength(1);
    expect(stmts[0].sql).toMatch(/INSERT INTO public\.showcase_date_roll/);
  });
});

describe('rollShowcaseDates — org scoping', () => {
  it('only ever binds the requested org ids; an org outside the list is never referenced', async () => {
    // MUTANT: dropping the `"organization_id" = $1` predicate makes this red.
    const { db, captured } = makeFakeDb({ watermark: '2026-09-10' });
    await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a', 'org-b'] });

    const allParams = captured.transactions.flatMap((tx) => tx.flatMap((s) => s.params));
    const orgParams = allParams.filter((p) => typeof p === 'string' && p.startsWith('org-'));
    expect(new Set(orgParams)).toEqual(new Set(['org-a', 'org-b']));
    expect(orgParams).not.toContain('org-other');
    for (const tx of captured.transactions) {
      for (const s of tx) {
        if (/^UPDATE public\./.test(s.sql)) expect(s.sql).toContain('"organization_id" = $1');
      }
    }
  });

  it('de-duplicates repeated org ids', async () => {
    const { db, captured } = makeFakeDb({ watermark: '2026-09-10' });
    const res = await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a', 'org-a'] });
    expect(res).toHaveLength(1);
    expect(captured.transactions).toHaveLength(1);
  });
});

describe('rollShowcaseDates — negative delta + dry run', () => {
  it('never rolls backwards when the watermark is in the future', async () => {
    const { db, captured } = makeFakeDb({ watermark: '2026-09-20' });
    const res = await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a'] });
    expect(res[0].deltaDays).toBe(-3);
    expect(res[0].skipped).toBe('negative_delta');
    expect(captured.transactions).toHaveLength(0);
  });

  it('dry run computes delta + candidate counts and writes nothing', async () => {
    const { db, captured } = makeFakeDb({ watermark: '2026-09-14', count: 5 });
    const res = await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a'], dryRun: true });
    expect(res[0].deltaDays).toBe(3);
    expect(res[0].skipped).toBe('dry_run');
    expect(res[0].perTable.tasks).toBe(5);
    expect(captured.transactions).toHaveLength(0); // MUTANT: writing on dryRun makes this red.
  });
});

describe('parseShowcaseOrgIds', () => {
  it('splits, trims, drops empties and de-dupes', () => {
    expect(parseShowcaseOrgIds(' a , b ,, a ')).toEqual(['a', 'b']);
    expect(parseShowcaseOrgIds('')).toEqual([]);
    expect(parseShowcaseOrgIds(undefined)).toEqual([]);
  });
});

describe('isShowcaseDateRollEnabled', () => {
  it('is OFF unless explicitly truthy', () => {
    expect(isShowcaseDateRollEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isShowcaseDateRollEnabled({ ENABLE_SHOWCASE_DATE_ROLL: '' } as any)).toBe(false);
    expect(isShowcaseDateRollEnabled({ ENABLE_SHOWCASE_DATE_ROLL: 'false' } as any)).toBe(false);
    expect(isShowcaseDateRollEnabled({ ENABLE_SHOWCASE_DATE_ROLL: 'true' } as any)).toBe(true);
    expect(isShowcaseDateRollEnabled({ ENABLE_SHOWCASE_DATE_ROLL: '1' } as any)).toBe(true);
  });
});

describe('runShowcaseDateRollTick — job gating', () => {
  it('does NOT call roll when the flag is OFF', async () => {
    // MUTANT: making isShowcaseDateRollEnabled always true makes this red.
    const roll = vi.fn();
    const out = await runShowcaseDateRollTick({
      env: { SHOWCASE_ORG_IDS: 'org-a' } as any,
      roll: roll as any,
    });
    expect(out).toEqual({ enabled: false, orgIds: 0, skipped: 'flag_off' });
    expect(roll).not.toHaveBeenCalled();
  });

  it('does NOT call roll when the flag is ON but SHOWCASE_ORG_IDS is empty', async () => {
    const roll = vi.fn();
    const out = await runShowcaseDateRollTick({
      env: { ENABLE_SHOWCASE_DATE_ROLL: 'true', SHOWCASE_ORG_IDS: '  ' } as any,
      roll: roll as any,
    });
    expect(out).toEqual({ enabled: true, orgIds: 0, skipped: 'no_orgs' });
    expect(roll).not.toHaveBeenCalled();
  });

  it('calls roll once with the parsed org ids and the injected today when enabled', async () => {
    const roll = vi.fn().mockResolvedValue([{ orgId: 'org-a', lastRolledOn: '2026-09-17', deltaDays: 7, perTable: {} }]);
    const out = await runShowcaseDateRollTick({
      env: { ENABLE_SHOWCASE_DATE_ROLL: 'true', SHOWCASE_ORG_IDS: 'org-a, org-b' } as any,
      now: () => TODAY,
      roll: roll as any,
    });
    expect(roll).toHaveBeenCalledTimes(1);
    expect(roll).toHaveBeenCalledWith({ today: TODAY, orgIds: ['org-a', 'org-b'] });
    expect(out.enabled).toBe(true);
    expect(out.orgIds).toBe(2);
  });
});
