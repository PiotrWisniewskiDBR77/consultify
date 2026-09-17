/**
 * SR-1 Showcase Date-Roll — unit tests (NO database).
 *
 * The service is exercised through `buildShowcaseDateRoll(db)` with an in-memory
 * fake connection that captures every statement, so the roll logic (delta,
 * idempotency, first-run initialization, org scoping, dry-run), the group-(c)
 * field membership ([A] Wpis 38), the VARIANT B weekly-recurrence rule and the
 * run-proof persistence ([A] Wpis 45) are proven deterministically without
 * Postgres. The real-data RealPG proof is station B's part 2 (Wpis 32); the
 * shift SQL itself was additionally de-risked against the live schema.
 *
 * Each business rule below has a mutation note: the change that would make it
 * red is named in the test title's MUTANT comment.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  buildShowcaseDateRoll,
  buildTableCountSql,
  buildTableUpdateSql,
  computeDeltaDays,
  computeWeeklyDeltaDays,
  introspectShowcaseColumns,
  kindFromRealType,
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

/** information_shape row shape returned by the introspection query. */
interface SchemaRow {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
}

/** The data_type/udt_name a declared kind maps to when the schema agrees with the label. */
const KIND_TO_REAL: Record<string, { data_type: string; udt_name: string }> = {
  text: { data_type: 'text', udt_name: 'text' },
  timestamp: { data_type: 'timestamp without time zone', udt_name: 'timestamp' },
  timestamptz: { data_type: 'timestamp with time zone', udt_name: 'timestamptz' },
  date: { data_type: 'date', udt_name: 'date' },
};

/**
 * Default information_schema rows: every declared column present, with a real
 * type that matches its declared kind (no mismatch). Tests override individual
 * `table.column` real types — or drop them — via the `schema` option.
 */
function defaultSchemaRows(): SchemaRow[] {
  return SHOWCASE_DATE_FIELDS.flatMap((t) =>
    t.columns.map((c) => ({
      table_name: t.table,
      column_name: c.column,
      ...KIND_TO_REAL[c.kind],
    }))
  );
}

/**
 * Fake connection: `all` answers the introspection, watermark and per-table
 * count SELECTs; `transaction` records statements.
 *
 * `schema` overrides the real type of specific `table.column` keys (or, with a
 * `null` value, removes the column) so the mismatch / missing / unsupported
 * write-paths can be exercised deterministically without Postgres.
 */
function makeFakeDb(
  opts: {
    watermark?: string | null;
    count?: number;
    schema?: Record<string, { data_type: string; udt_name: string } | null>;
  } = {}
) {
  const captured: Captured = { transactions: [], selects: [] };
  const baseRows = defaultSchemaRows();
  const schemaRows: SchemaRow[] = baseRows
    .map((row) => {
      const key = `${row.table_name}.${row.column_name}`;
      if (!opts.schema || !(key in opts.schema)) return row;
      const override = opts.schema[key];
      if (override === null) return null; // column absent from the schema
      return { ...row, data_type: override.data_type, udt_name: override.udt_name };
    })
    .filter((r): r is SchemaRow => r !== null);

  const db = {
    all: async <T,>(sql: string, params?: unknown[]): Promise<T[]> => {
      captured.selects.push({ sql, params: params ?? [] });
      if (/information_schema\.columns/.test(sql)) {
        return schemaRows as unknown as T[];
      }
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

/** The table definition for a physical table name (throws if absent). */
function tableDef(name: string) {
  const t = SHOWCASE_DATE_FIELDS.find((x) => x.table === name);
  if (!t) throw new Error(`expected ${name} in SHOWCASE_DATE_FIELDS`);
  return t;
}

/** All column names shifted across every table. */
function allShiftedColumns(): string[] {
  return SHOWCASE_DATE_FIELDS.flatMap((t) => t.columns.map((c) => c.column));
}

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

describe('computeWeeklyDeltaDays — VARIANT B cadence', () => {
  it('snaps the raw delta to whole weeks (round(delta/7)*7)', () => {
    // MUTANT: replacing round(delta/7)*7 with the identity makes these red.
    expect(computeWeeklyDeltaDays(10)).toBe(7);
    expect(computeWeeklyDeltaDays(7)).toBe(7);
    expect(computeWeeklyDeltaDays(11)).toBe(14);
    expect(computeWeeklyDeltaDays(3)).toBe(0); // <3.5d stays put
    expect(computeWeeklyDeltaDays(4)).toBe(7); // >=3.5d rounds up to a week
    expect(computeWeeklyDeltaDays(0)).toBe(0);
  });
});

describe('toUtcDateOnly', () => {
  it('formats a Date as UTC YYYY-MM-DD regardless of local zone', () => {
    expect(toUtcDateOnly(new Date('2026-09-17T23:30:00Z'))).toBe('2026-09-17');
    expect(toUtcDateOnly(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01');
  });
});

describe('SHOWCASE_DATE_FIELDS — group membership ([A] Wpis 38)', () => {
  it('covers exactly 22 tables / 47 columns (group a 9/23 + OKR 3/14 + KPI 10/10)', () => {
    // MUTANT: adding/removing any table or column changes these counts → red.
    expect(SHOWCASE_DATE_FIELDS).toHaveLength(22);
    expect(allShiftedColumns()).toHaveLength(47);
    const byGroup = (g: string) => SHOWCASE_DATE_FIELDS.filter((t) => (t.group ?? 'a') === g);
    expect(byGroup('a')).toHaveLength(9);
    expect(byGroup('a').reduce((n, t) => n + t.columns.length, 0)).toBe(23);
    expect(byGroup('c-okr')).toHaveLength(3);
    expect(byGroup('c-okr').reduce((n, t) => n + t.columns.length, 0)).toBe(14);
    expect(byGroup('c-kpi')).toHaveLength(10);
    expect(byGroup('c-kpi').reduce((n, t) => n + t.columns.length, 0)).toBe(10);
  });

  it('group (c) item 2 — OKR vNext: the exact cycle dates + key-result deadline + set check-in', () => {
    const cyc = tableDef('okr_vnext_cycles');
    expect(cyc.group).toBe('c-okr');
    expect(cyc.columns.map((c) => c.column)).toEqual([
      'start_date', 'end_date', 'draft_open_at', 'active_start_at', 'review_open_at', 'close_at',
      'submission_due_at', 'approval_due_at', 'manager_review_due_at', 'final_update_due_at',
      'reflection_due_at', 'midcycle_review_at',
    ]);
    expect(tableDef('okr_vnext_key_results').columns.map((c) => c.column)).toEqual(['deadline']);
    expect(tableDef('okr_vnext_sets').columns.map((c) => c.column)).toEqual(['next_checkin_due_at']);
  });

  it('group (c) item 4 — KPI due / next-run / checkpoint / expected-recovery / response-due', () => {
    const kpi: Record<string, string> = {
      kpi_recovery_actions: 'due_date',
      rvn_kpi_recovery_actions: 'due_date',
      rvn_kpi_corrective_actions: 'due_date',
      kpi_deviation_actions: 'due_date',
      kpi_report_schedules: 'next_run_at',
      kpi_connectors: 'next_run_at',
      kpi_recovery_checkpoints: 'checkpoint_date',
      rvn_kpi_recovery_checkpoints: 'checkpoint_date',
      kpi_recovery_cards: 'expected_recovery_date',
      rvn_kpi_deviation_cases: 'response_due_at',
    };
    for (const [tbl, col] of Object.entries(kpi)) {
      const def = tableDef(tbl);
      expect(def.group).toBe('c-kpi');
      expect(def.columns.map((c) => c.column)).toEqual([col]);
    }
  });

  it('group (c) items 1 & 3 (lifecycle markers, KPI measurement periods) are NEVER shifted', () => {
    // MUTANT: adding any of these history columns to SHOWCASE_DATE_FIELDS makes this red.
    const forbidden = [
      'started_at', 'completed_at', 'closed_at', 'cancelled_at', 'resolved_at',
      'period_start', 'period_end', 'period_start_date', 'period_end_date',
      'baseline_period_start', 'baseline_period_end',
    ];
    const shifted = new Set(allShiftedColumns());
    for (const f of forbidden) expect(shifted.has(f)).toBe(false);
    // okr_cycles (legacy period_quarter/period_year/closed_at) must not appear at all.
    expect(SHOWCASE_DATE_FIELDS.find((t) => t.table === 'okr_cycles')).toBeUndefined();
  });

  it('group (c) item 5 (other planning fields) is EXCLUDED — seed-gated, unproven', () => {
    // MUTANT: adding any item-5 candidate table makes this red. The Northwind
    // demo-en seed does not run to completion on this line, so per Wpis 38
    // "0 = do not include" every item-5 candidate stays out until proven.
    const excluded = [
      'audit_programs', 'audit_verifications', 'initiative_schedule_baselines',
      'initiative_benefits', 'communication_plans', 'communication_plan_items',
      'action_cards', 'staffing_plans', 'management_report_schedules',
      'financial_forecast_cycles', 'transformation_monitoring_definitions',
    ];
    const present = new Set(SHOWCASE_DATE_FIELDS.map((t) => t.table));
    for (const e of excluded) expect(present.has(e)).toBe(false);
  });

  it('every group-(a) table keeps its measured columns (single source of truth)', () => {
    expect(tableDef('tasks').columns.map((c) => c.column)).toEqual(['due_date', 'milestone_target_date', 'sla_due_at']);
    expect(tableDef('initiatives').columns).toHaveLength(8);
    expect(tableDef('meetings').columns.map((c) => c.column)).toEqual(['start_at', 'end_at']);
  });
});

describe('rollShowcaseDates — delta + write path', () => {
  it('shifts by the computed delta and binds [orgId, delta] into every non-recurrence UPDATE', async () => {
    const { db, captured } = makeFakeDb({ watermark: '2026-09-10' });
    const res = await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a'] });

    expect(res).toHaveLength(1);
    expect(res[0].deltaDays).toBe(7);
    expect(res[0].lastRolledOn).toBe('2026-09-17');
    expect(res[0].skipped).toBeUndefined();

    // One transaction for the org: 22 table UPDATEs + 1 watermark/run-proof upsert.
    expect(captured.transactions).toHaveLength(1);
    const stmts = captured.transactions[0];
    expect(stmts).toHaveLength(SHOWCASE_DATE_FIELDS.length + 1);

    const updates = stmts.slice(0, SHOWCASE_DATE_FIELDS.length);
    updates.forEach((u, i) => {
      const t = SHOWCASE_DATE_FIELDS[i];
      expect(u.sql).toMatch(/^UPDATE public\."/);
      // MUTANT: hardcoding delta 0 makes this red.
      expect(u.params[0]).toBe('org-a');
      expect(u.params[1]).toBe(7);
      // Only the weekly-recurrence table binds a third (weekly) param.
      if (t.recurrence) expect(u.params).toEqual(['org-a', 7, 7]);
      else expect(u.params).toEqual(['org-a', 7]);
    });
    // The final statement is the watermark + run-proof upsert bound to today.
    expect(stmts[stmts.length - 1].sql).toMatch(/INSERT INTO public\.showcase_date_roll/);
    expect(stmts[stmts.length - 1].params[0]).toBe('org-a');
    expect(stmts[stmts.length - 1].params[1]).toBe('2026-09-17');
  });

  it('emits a SET clause for every column of every table (single source of truth)', async () => {
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

  it('scopes every UPDATE by org — direct organization_id, or a parent subquery for the child table', async () => {
    const { db, captured } = makeFakeDb({ watermark: '2026-09-10' });
    await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a'] });
    const updates = captured.transactions[0].slice(0, SHOWCASE_DATE_FIELDS.length);

    updates.forEach((u, i) => {
      const t = SHOWCASE_DATE_FIELDS[i];
      expect(u.params[0]).toBe('org-a'); // org is always $1
      if (t.orgScopeSql) {
        // kpi_deviation_actions has no organization_id — scoped through its parent case.
        expect(u.sql).toContain('kpi_deviation_cases WHERE organization_id = $1');
      } else {
        expect(u.sql).toContain(`"${t.orgColumn ?? 'organization_id'}" = $1`);
      }
    });
  });
});

describe('rollShowcaseDates — VARIANT B weekly recurrence ([A] Wpis 38 item 6)', () => {
  it('meetings UPDATE picks the weekly delta ($3) for FREQ=WEEKLY rows, raw delta ($2) otherwise', async () => {
    // delta 10 → weekly round(10/7)*7 = 7; the two paths must differ in the SQL.
    const { db, captured } = makeFakeDb({ watermark: '2026-09-07' });
    await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a'] });
    const meetingsIdx = SHOWCASE_DATE_FIELDS.findIndex((t) => t.table === 'meetings');
    const meetingsSql = captured.transactions[0][meetingsIdx].sql;
    const meetingsParams = captured.transactions[0][meetingsIdx].params;

    // MUTANT: dropping the recurrence CASE (always $2) makes this red.
    expect(meetingsSql).toContain(`CASE WHEN "recurrence_rule" ~* 'FREQ=WEEKLY' THEN $3::int ELSE $2::int END`);
    expect(meetingsParams).toEqual(['org-a', 10, 7]);
  });

  it('no other table binds a weekly ($3) param or a recurrence CASE', async () => {
    const { db, captured } = makeFakeDb({ watermark: '2026-09-07' });
    await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a'] });
    const updates = captured.transactions[0].slice(0, SHOWCASE_DATE_FIELDS.length);
    updates.forEach((u, i) => {
      if (SHOWCASE_DATE_FIELDS[i].table === 'meetings') return;
      expect(u.params).toHaveLength(2);
      expect(u.sql).not.toContain('FREQ=WEEKLY');
      expect(u.sql).not.toContain('$3');
    });
  });

  it('only meetings carries a recurrence rule (other recurrence-bearing tables are not guessed)', () => {
    const recurring = SHOWCASE_DATE_FIELDS.filter((t) => t.recurrence);
    expect(recurring.map((t) => t.table)).toEqual(['meetings']);
  });
});

describe('rollShowcaseDates — run-proof persistence ([A] Wpis 45)', () => {
  it('stores last_rolled_on + delta_days + per_table row counts in the SAME transaction as the shift', async () => {
    const { db, captured } = makeFakeDb({ watermark: '2026-09-10', count: 4 });
    const res = await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a'] });

    // Pre-counted candidates flow into the result and the persisted proof.
    expect(res[0].perTable.tasks).toBe(4);
    expect(res[0].perTable.meetings).toBe(4);

    const tx = captured.transactions[0];
    const upsert = tx[tx.length - 1];
    expect(upsert.sql).toMatch(/INSERT INTO public\.showcase_date_roll \(org_id, last_rolled_on, delta_days, per_table, updated_at\)/);
    expect(upsert.sql).toContain('ON CONFLICT (org_id) DO UPDATE SET');
    expect(upsert.sql).toContain('delta_days = EXCLUDED.delta_days');
    expect(upsert.sql).toContain('per_table = EXCLUDED.per_table');
    expect(upsert.params[0]).toBe('org-a');
    expect(upsert.params[1]).toBe('2026-09-17');
    expect(upsert.params[2]).toBe(7); // delta_days
    // MUTANT: persisting '{}' instead of the counted per_table makes this red.
    expect(JSON.parse(upsert.params[3] as string)).toMatchObject({ tasks: 4, meetings: 4 });
    // The proof rides in the same atomic transaction as the data shift.
    expect(tx.slice(0, SHOWCASE_DATE_FIELDS.length).every((s) => /^UPDATE public\."/.test(s.sql))).toBe(true);
  });

  it('first run persists delta_days 0 and an empty per_table (initialized, nothing shifted)', async () => {
    const { db, captured } = makeFakeDb({ watermark: null });
    await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a'] });
    const upsert = captured.transactions[0][0];
    expect(upsert.params).toEqual(['org-a', '2026-09-17', 0, '{}']);
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
    // MUTANT: dropping the org predicate ($1 binding) makes this red.
    const { db, captured } = makeFakeDb({ watermark: '2026-09-10' });
    await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a', 'org-b'] });

    const allParams = captured.transactions.flatMap((tx) => tx.flatMap((s) => s.params));
    const orgParams = allParams.filter((p) => typeof p === 'string' && p.startsWith('org-'));
    expect(new Set(orgParams)).toEqual(new Set(['org-a', 'org-b']));
    expect(orgParams).not.toContain('org-other');
    for (const tx of captured.transactions) {
      for (const s of tx) {
        if (/^UPDATE public\./.test(s.sql)) expect(s.params[0]).toMatch(/^org-[ab]$/);
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

// ---------------------------------------------------------------------------
// SR-1 v3 (Wpis 62): the generator trusts the REAL schema type, never `kind`.
// On the live staging schema 7/47 columns carry a real type that differs from
// their label — 3 fatally (text-declared but really timestamp, where the text
// write-path emits `~`, an operator that does not exist for a timestamp).
// ---------------------------------------------------------------------------

describe('kindFromRealType — real schema type → shift write-path (SR-1 v3)', () => {
  it('maps every supported information_schema type to its write-path', () => {
    expect(kindFromRealType('text', 'text')).toBe('text');
    expect(kindFromRealType('character varying', 'varchar')).toBe('text');
    expect(kindFromRealType('timestamp without time zone', 'timestamp')).toBe('timestamp');
    expect(kindFromRealType('timestamp with time zone', 'timestamptz')).toBe('timestamptz');
    expect(kindFromRealType('date', 'date')).toBe('date');
  });

  it('returns unsupported for a type with no shift write-path', () => {
    // MUTANT: mapping integer/jsonb/boolean onto a write-path makes this red.
    expect(kindFromRealType('integer', 'int4')).toBe('unsupported');
    expect(kindFromRealType('jsonb', 'jsonb')).toBe('unsupported');
    expect(kindFromRealType('boolean', 'bool')).toBe('unsupported');
  });
});

describe('introspectShowcaseColumns — declaration vs real type (SR-1 v3)', () => {
  it('records a kindMismatch (declared text, real timestamp) without throwing', async () => {
    const { db } = makeFakeDb({
      schema: {
        'tasks.sla_due_at': { data_type: 'timestamp without time zone', udt_name: 'timestamp' },
      },
    });
    const intro = await introspectShowcaseColumns(db);
    // MUTANT: trusting the declared kind (resolved = c.kind) makes this red.
    expect(intro.resolved.get('tasks.sla_due_at')).toBe('timestamp');
    expect(intro.kindMismatch).toEqual([
      {
        table: 'tasks',
        column: 'sla_due_at',
        declared: 'text',
        real: 'timestamp',
        realDataType: 'timestamp without time zone',
      },
    ]);
    expect(intro.missing).toEqual([]);
    expect(intro.unsupported).toEqual([]);
  });

  it('skips a column absent from the schema (missing), never fatal', async () => {
    const { db } = makeFakeDb({ schema: { 'tasks.sla_due_at': null } });
    const intro = await introspectShowcaseColumns(db);
    expect(intro.missing).toEqual([{ table: 'tasks', column: 'sla_due_at' }]);
    expect(intro.resolved.has('tasks.sla_due_at')).toBe(false);
    const sql = buildTableUpdateSql(tableDef('tasks'), intro);
    expect(sql).not.toBeNull();
    expect(sql).not.toContain('sla_due_at');
    expect(sql).toContain('"due_date" =');
  });

  it('skips a column whose real type has no write-path (unsupported)', async () => {
    const { db } = makeFakeDb({
      schema: { 'tasks.sla_due_at': { data_type: 'integer', udt_name: 'int4' } },
    });
    const intro = await introspectShowcaseColumns(db);
    expect(intro.unsupported).toEqual([
      { table: 'tasks', column: 'sla_due_at', realDataType: 'integer' },
    ]);
    expect(intro.resolved.has('tasks.sla_due_at')).toBe(false);
    expect(buildTableUpdateSql(tableDef('tasks'), intro)).not.toContain('sla_due_at');
  });

  it('emits NO statement for a table whose only column is absent', async () => {
    // MUTANT: emitting a SET-less UPDATE instead of null makes this red (invalid SQL).
    const { db } = makeFakeDb({ schema: { 'okr_vnext_key_results.deadline': null } });
    const intro = await introspectShowcaseColumns(db);
    expect(buildTableUpdateSql(tableDef('okr_vnext_key_results'), intro)).toBeNull();
    expect(buildTableCountSql(tableDef('okr_vnext_key_results'), intro)).toBeNull();
  });
});

describe('buildTableUpdateSql — write-path follows the REAL type (SR-1 v3)', () => {
  it('uses make_interval (not the regex ~) for a text-declared column that is really timestamp', async () => {
    const { db } = makeFakeDb({
      schema: {
        'tasks.sla_due_at': { data_type: 'timestamp without time zone', udt_name: 'timestamp' },
      },
    });
    const intro = await introspectShowcaseColumns(db);
    const sql = buildTableUpdateSql(tableDef('tasks'), intro);
    expect(sql).not.toBeNull();
    // MUTANT: choosing the expression from the declared kind (text) makes these red.
    expect(sql).toContain('"sla_due_at" = ("sla_due_at" + make_interval(days => $2::int))');
    expect(sql).not.toContain('~'); // no regex anywhere: due_date=timestamptz, milestone=date
    // the sibling columns keep their own real-type write-paths
    expect(sql).toContain('"due_date" = ((("due_date" AT TIME ZONE \'UTC\')');
    expect(sql).toContain('"milestone_target_date" = ("milestone_target_date" + $2::int)');
  });
});

describe('rollShowcaseDates — survives the 3 fatal staging columns (SR-1 v3)', () => {
  const FATAL_AS_TIMESTAMP = {
    'tasks.sla_due_at': { data_type: 'timestamp without time zone', udt_name: 'timestamp' },
    'initiatives.planned_start_date': { data_type: 'timestamp without time zone', udt_name: 'timestamp' },
    'initiatives.planned_end_date': { data_type: 'timestamp without time zone', udt_name: 'timestamp' },
  };

  it('rolls without aborting and records kindMismatch in the result and the run proof', async () => {
    const { db, captured } = makeFakeDb({
      watermark: '2026-09-10',
      count: 2,
      schema: FATAL_AS_TIMESTAMP,
    });
    const res = await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a'] });

    expect(res[0].skipped).toBeUndefined();
    expect(res[0].deltaDays).toBe(7);
    // MUTANT: trusting the declared text kind emits `~` on a timestamp → in a
    // real run the transaction aborts; here the tasks SQL would contain `~`.
    const tasksIdx = SHOWCASE_DATE_FIELDS.findIndex((t) => t.table === 'tasks');
    const tasksSql = captured.transactions[0][tasksIdx].sql;
    expect(tasksSql).toContain('"sla_due_at" = ("sla_due_at" + make_interval');
    expect(tasksSql).not.toContain('~');

    expect(res[0].kindMismatch?.map((m) => `${m.table}.${m.column}`).sort()).toEqual([
      'initiatives.planned_end_date',
      'initiatives.planned_start_date',
      'tasks.sla_due_at',
    ]);

    const upsert = captured.transactions[0][captured.transactions[0].length - 1];
    const proof = JSON.parse(upsert.params[3] as string);
    expect(proof.tasks).toBe(2); // counts still ride alongside the mismatch note
    expect(Array.isArray(proof.kindMismatch)).toBe(true);
    expect(proof.kindMismatch).toHaveLength(3);
  });

  it('persists NO kindMismatch key when the schema agrees with every label', async () => {
    const { db, captured } = makeFakeDb({ watermark: '2026-09-10', count: 1 });
    const res = await buildShowcaseDateRoll(db).roll({ today: TODAY, orgIds: ['org-a'] });
    expect(res[0].kindMismatch).toBeUndefined();
    const upsert = captured.transactions[0][captured.transactions[0].length - 1];
    const proof = JSON.parse(upsert.params[3] as string);
    expect('kindMismatch' in proof).toBe(false);
  });
});
