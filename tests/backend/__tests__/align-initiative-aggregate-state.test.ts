import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type AggregateStageStore,
  alignSeedInitiativeStage,
  isShowcaseOrg,
  planAggregateAlignment,
  processOrg,
  resolveAlignCliOptions,
  stageGroup,
} from '../../../server/src/services/initiatives/alignInitiativeAggregateService.js';

/**
 * D-19 (Wpis 60 · STAGE-1 · DEC-539) — the align script's PURE decision rule.
 * The DB-run proof (dry-run/apply/idempotency on a staging-dump copy) lives in
 * the Wpis 60 report; these unit tests pin the mapping so a regression in the
 * status->stage derivation cannot silently re-diverge the showcase orgs.
 */
describe('planAggregateAlignment — status → canonical aggregate stage', () => {
  it('advances a stale REGISTERED_DRAFT aggregate to the column status group', () => {
    // The measured Atelier Toys defect: column IN_EXECUTION, aggregate stuck at
    // REGISTERED_DRAFT (group DRAFT). Aligning must land IN_EXECUTION.
    expect(planAggregateAlignment('IN_EXECUTION', 'REGISTERED_DRAFT')).toEqual({
      action: 'align',
      targetStage: 'IN_EXECUTION',
    });
    expect(planAggregateAlignment('APPROVED', 'REGISTERED_DRAFT')).toEqual({
      action: 'align',
      targetStage: 'APPROVED_BACKLOG',
    });
    expect(planAggregateAlignment('PENDING_APPROVAL', 'REGISTERED_DRAFT')).toEqual({
      action: 'align',
      targetStage: 'READY_FOR_DECISION',
    });
    expect(planAggregateAlignment('CLOSED', 'REGISTERED_DRAFT')).toEqual({
      action: 'align',
      targetStage: 'CLOSED',
    });
  });

  it('is case-insensitive on the column status', () => {
    expect(planAggregateAlignment('in_execution', 'REGISTERED_DRAFT').action).toBe('align');
  });

  it('leaves an already-consistent aggregate alone (idempotent, no write)', () => {
    expect(planAggregateAlignment('IN_EXECUTION', 'IN_EXECUTION').action).toBe('skip-aligned');
    expect(planAggregateAlignment('DRAFT', 'REGISTERED_DRAFT').action).toBe('skip-aligned');
    expect(planAggregateAlignment('DRAFT', 'DEFINED').action).toBe('skip-aligned');
  });

  it('never downgrades a more precise stage within the same 7-code group', () => {
    // SCHEDULED and APPROVED_BACKLOG are both group APPROVED. The DBR77 reverse
    // case (aggregate AHEAD of column) must not be flattened to the first stage.
    expect(planAggregateAlignment('APPROVED', 'SCHEDULED').action).toBe('skip-aligned');
    expect(planAggregateAlignment('APPROVED', 'APPROVED_BACKLOG').action).toBe('skip-aligned');
    expect(planAggregateAlignment('PENDING_APPROVAL', 'ANALYZING').action).toBe('skip-aligned');
  });

  it('skips dispositions / pre-registration — no engine stage, register short-circuits', () => {
    expect(planAggregateAlignment('REJECTED', 'REGISTERED_DRAFT')).toEqual({
      action: 'skip-short-circuit',
      targetStage: null,
    });
    expect(planAggregateAlignment('PROPOSED', 'REGISTERED_DRAFT')).toEqual({
      action: 'skip-short-circuit',
      targetStage: null,
    });
  });

  it('re-aligns a dirty out-of-vocabulary aggregate value (the 07.09 EXECUTING row)', () => {
    // 'EXECUTING' is not one of the 12 stages, so it has no group and must be
    // realigned to the column status group.
    expect(stageGroup('EXECUTING')).toBeNull();
    expect(planAggregateAlignment('IN_EXECUTION', 'EXECUTING')).toEqual({
      action: 'align',
      targetStage: 'IN_EXECUTION',
    });
  });

  it('aligns when the aggregate row exists but carries no lifecycleState', () => {
    expect(planAggregateAlignment('IN_EXECUTION', null)).toEqual({
      action: 'align',
      targetStage: 'IN_EXECUTION',
    });
  });
});

describe('alignSeedInitiativeStage — D-66 (Wpis 86): stage repaired from the SEEDED status', () => {
  /**
   * The seed cannot read `initiatives.status` to decide the stage: 20262260's
   * cascade already rewrote the column FROM the aggregate's hardcoded
   * REGISTERED_DRAFT, so a seeded CLOSED row claims DRAFT by then and the
   * planner would answer skip-aligned. These cases pin that the seed's OWN
   * resolved status drives the repair instead.
   */
  function fakeStore(stage: string | null) {
    const writes: string[] = [];
    const store: AggregateStageStore = {
      async readStage() {
        return stage;
      },
      async writeStage(_orgId, _initiativeId, next) {
        writes.push(next);
        return 1;
      },
    };
    return { store, writes };
  }

  it('advances the born-REGISTERED_DRAFT aggregate of a seeded CLOSED initiative to CLOSED', async () => {
    const { store, writes } = fakeStore('REGISTERED_DRAFT');
    await expect(alignSeedInitiativeStage(store, 'org', 'init', 'CLOSED')).resolves.toEqual({
      action: 'align',
      targetStage: 'CLOSED',
      wrote: 1,
    });
    expect(writes).toEqual(['CLOSED']);
  });

  it('does the same for a seeded IN_EXECUTION initiative', async () => {
    const { store, writes } = fakeStore('REGISTERED_DRAFT');
    await expect(alignSeedInitiativeStage(store, 'org', 'init', 'IN_EXECUTION')).resolves.toEqual({
      action: 'align',
      targetStage: 'IN_EXECUTION',
      wrote: 1,
    });
    expect(writes).toEqual(['IN_EXECUTION']);
  });

  it('writes nothing when the aggregate already sits in the seeded status group', async () => {
    const { store, writes } = fakeStore('REGISTERED_DRAFT');
    await expect(alignSeedInitiativeStage(store, 'org', 'init', 'DRAFT')).resolves.toEqual({
      action: 'skip-aligned',
      targetStage: 'REGISTERED_DRAFT',
      wrote: 0,
    });
    expect(writes).toEqual([]);
  });

  it('short-circuits a disposition (seeded CANCELLED -> REJECTED) so the caller re-asserts the column', async () => {
    const { store, writes } = fakeStore('REGISTERED_DRAFT');
    await expect(alignSeedInitiativeStage(store, 'org', 'init', 'REJECTED')).resolves.toEqual({
      action: 'skip-short-circuit',
      targetStage: null,
      wrote: 0,
    });
    expect(writes).toEqual([]);
  });

  it('reports no write when the store itself reports 0 changed rows (idempotent re-run)', async () => {
    const store: AggregateStageStore = {
      async readStage() {
        return 'REGISTERED_DRAFT';
      },
      async writeStage() {
        return 0;
      },
    };
    await expect(alignSeedInitiativeStage(store, 'org', 'init', 'CLOSED')).resolves.toEqual({
      action: 'align',
      targetStage: 'CLOSED',
      wrote: 0,
    });
  });
});

describe('stageGroup — 12-stage → 7-code group', () => {
  it('maps stages onto their compatibility status', () => {
    expect(stageGroup('APPROVED_BACKLOG')).toBe('APPROVED');
    expect(stageGroup('SCHEDULED')).toBe('APPROVED');
    expect(stageGroup('READY_FOR_DECISION')).toBe('PENDING_APPROVAL');
    expect(stageGroup('DELIVERED')).toBe('CLOSED');
    expect(stageGroup('IN_EXECUTION')).toBe('IN_EXECUTION');
  });

  it('returns null for unknown / empty values', () => {
    expect(stageGroup('EXECUTING')).toBeNull();
    expect(stageGroup('')).toBeNull();
    expect(stageGroup(null)).toBeNull();
    expect(stageGroup(undefined)).toBeNull();
  });
});

describe('isShowcaseOrg — hard allow-list', () => {
  it('allows Atelier Toys demo-session orgs by id pattern and by name', () => {
    expect(isShowcaseOrg('ateliertoys-demo-session-1bd9863714-mu3crllf', null)).toBe(true);
    expect(isShowcaseOrg('some-other-id', 'Atelier Toys')).toBe(true);
  });

  it('allows Northwind Manufacturing Ltd. by name', () => {
    expect(isShowcaseOrg('468b234c-66c4-54e1-b626-5e0fb3a92f6a', 'Northwind Manufacturing Ltd.')).toBe(
      true
    );
  });

  it('refuses DBR77 and any non-showcase org', () => {
    expect(isShowcaseOrg('a3e05d4a-5397-419d-b486-8e44366c0063', 'DBR77')).toBe(false);
    expect(isShowcaseOrg('random-org-id', 'Some Tester Org')).toBe(false);
    expect(isShowcaseOrg('', '')).toBe(false);
  });
});

describe('resolveAlignCliOptions — CLI guard (P3)', () => {
  it('throws when --apply is passed without any --org', () => {
    expect(() => resolveAlignCliOptions(['node', 'script.ts', '--apply'])).toThrow(
      /apply_requires_explicit_org/
    );
  });

  it('allows --apply with at least one --org=<id>', () => {
    const opts = resolveAlignCliOptions(['node', 'script.ts', '--apply', '--org=abc-123']);
    expect(opts).toEqual({ apply: true, orgIds: ['abc-123'] });
  });

  it('allows --apply with --org <id> (space-separated)', () => {
    const opts = resolveAlignCliOptions(['node', 'script.ts', '--apply', '--org', 'xyz']);
    expect(opts).toEqual({ apply: true, orgIds: ['xyz'] });
  });

  it('dry-run without --org is allowed (read-only all-orgs mode)', () => {
    const opts = resolveAlignCliOptions(['node', 'script.ts']);
    expect(opts).toEqual({ apply: false, orgIds: [] });
  });
});

/**
 * D-41 (b) — the org-scope of the aggregate UPDATE, pinned WITHOUT a database.
 * The RealPG block below proves the scope end-to-end but is `skipIf(!RUN_SCOPE)`,
 * so in a normal run the guard was protected only by code inspection (the D-41
 * finding: "bronione tylko inspekcją kodu + pomiarem na kopii dumpu, nie testem
 * regresji"). This drives the REAL `processOrg` through a fake `pg.Client` that
 * captures the write statement, and asserts the UPDATE is scoped by
 * `organization_id` bound to the org being processed — removing
 * `organization_id = $n` from the WHERE clause turns it RED.
 */
describe('processOrg — aggregate UPDATE is scoped by organization_id (D-41 (b), no DB)', () => {
  interface CapturedWrite {
    sql: string;
    params: unknown[];
  }

  function fakeClient(rows: Array<{ id: string; status: string; current_stage: string | null }>) {
    const writes: CapturedWrite[] = [];
    const client = {
      async query(sql: string, params?: unknown[]) {
        if (/UPDATE\s+ie_aggregate_state/i.test(sql)) {
          writes.push({ sql, params: params ?? [] });
          return { rowCount: 1, rows: [] };
        }
        if (/FROM\s+organizations\b/i.test(sql)) {
          return { rowCount: 1, rows: [{ name: 'Atelier Toys' }] };
        }
        if (/FROM\s+initiatives\b/i.test(sql)) {
          return { rowCount: rows.length, rows };
        }
        return { rowCount: 0, rows: [] };
      },
    };
    return { client: client as unknown as pg.Client, writes };
  }

  it('binds organization_id in the UPDATE WHERE clause to the org being aligned', async () => {
    const orgId = 'ateliertoys-demo-session-d41b';
    const { client, writes } = fakeClient([
      { id: 'init-1', status: 'IN_EXECUTION', current_stage: 'REGISTERED_DRAFT' },
    ]);

    const result = await processOrg(client, orgId, true);

    expect(result.allowed).toBe(true);
    expect(result.wrote).toBe(1);
    expect(writes).toHaveLength(1);

    const { sql, params } = writes[0];
    const whereClause = sql.slice(sql.toUpperCase().indexOf('WHERE'));
    const scopeMatch = /organization_id\s*=\s*\$(\d+)/i.exec(whereClause);
    expect(scopeMatch, 'UPDATE WHERE must scope by organization_id').not.toBeNull();
    const placeholder = Number(scopeMatch![1]);
    expect(params[placeholder - 1]).toBe(orgId);
  });

  it('writes nothing in dry-run (apply=false) — the scope guard never runs unscoped', async () => {
    const { client, writes } = fakeClient([
      { id: 'init-1', status: 'IN_EXECUTION', current_stage: 'REGISTERED_DRAFT' },
    ]);
    const result = await processOrg(client, 'ateliertoys-demo-session-dry', false);
    expect(result.wrote).toBe(0);
    expect(writes).toHaveLength(0);
  });
});

const RUN_SCOPE = process.env.RUN_DB_TESTS === '1' && process.env.DB_TYPE === 'postgres';

describe.skipIf(!RUN_SCOPE)('processOrg — UPDATE scoped by organization_id (P3, RealPG)', () => {
  const suffix = randomUUID().slice(0, 8);
  const orgA = `ateliertoys-demo-session-scope-a-${suffix}`;
  const orgB = `ateliertoys-demo-session-scope-b-${suffix}`;
  const initiativeId = `scope-initiative-${suffix}`;
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: String(process.env.DATABASE_URL) });
    await client.connect();
    await client.query(`INSERT INTO organizations (id, name) VALUES ($1, 'Atelier Toys') ON CONFLICT (id) DO NOTHING`, [orgA]);
    await client.query(`INSERT INTO organizations (id, name) VALUES ($1, 'Atelier Toys') ON CONFLICT (id) DO NOTHING`, [orgB]);
    await client.query(
      `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, 'Scope test', 'IN_EXECUTION') ON CONFLICT (id) DO NOTHING`,
      [initiativeId, orgA]
    );
    await client.query(
      `INSERT INTO ie_aggregate_state (organization_id, aggregate_type, aggregate_id, version, payload_json)
       VALUES ($1, 'initiative', $2, 1, '{"lifecycleState":"REGISTERED_DRAFT"}')
       ON CONFLICT (organization_id, aggregate_type, aggregate_id) DO UPDATE SET payload_json='{"lifecycleState":"REGISTERED_DRAFT"}', version=1`,
      [orgA, initiativeId]
    );
    await client.query(
      `INSERT INTO ie_aggregate_state (organization_id, aggregate_type, aggregate_id, version, payload_json)
       VALUES ($1, 'initiative', $2, 1, '{"lifecycleState":"REGISTERED_DRAFT"}')
       ON CONFLICT (organization_id, aggregate_type, aggregate_id) DO UPDATE SET payload_json='{"lifecycleState":"REGISTERED_DRAFT"}', version=1`,
      [orgB, initiativeId]
    );
  }, 30_000);

  afterAll(async () => {
    if (!client) return;
    await client.query(`DELETE FROM ie_aggregate_state WHERE organization_id IN ($1,$2)`, [orgA, orgB]).catch(() => undefined);
    await client.query(`DELETE FROM initiatives WHERE id = $1`, [initiativeId]).catch(() => undefined);
    await client.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]).catch(() => undefined);
    await client.end().catch(() => undefined);
  });

  it('processOrg on orgA aligns orgA but leaves orgB aggregate untouched', async () => {
    const result = await processOrg(client, orgA, true);
    expect(result.allowed).toBe(true);
    expect(result.wrote).toBeGreaterThanOrEqual(1);

    const rowA = await client.query(
      `SELECT payload_json->>'lifecycleState' AS stage FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`,
      [orgA, initiativeId]
    );
    expect(rowA.rows[0]?.stage).toBe('IN_EXECUTION');

    const rowB = await client.query(
      `SELECT payload_json->>'lifecycleState' AS stage FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`,
      [orgB, initiativeId]
    );
    expect(rowB.rows[0]?.stage).toBe('REGISTERED_DRAFT');
  });
});
