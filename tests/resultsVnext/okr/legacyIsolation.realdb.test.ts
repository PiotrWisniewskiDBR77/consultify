/**
 * OKR-E008 Half C — Legacy Archive isolation contract test (design §5.5).
 *
 * Proves the vNext OKR read model (`okrRepository.listPrograms`/`getProgram`
 * /`listCycles`/`getCycle` — OKR-E001, the only vNext OKR repository landed
 * in this worktree) NEVER surfaces a row from any of the 4 legacy OKR
 * tables (`okr_cycles`, `okr_objectives`, `okr_key_results`,
 * `okr_check_ins` — `server/migrations/914_okr_management.sql` +
 * `20260803_res009_okr_key_result_definition_version.sql`), even when a
 * poisoned row in each of those tables shares the same `organization_id`.
 *
 * NOTE for whoever lands OKR-E002+: this suite currently only exercises
 * `okrRepository.ts` because it is the only `*Repository.ts` file that
 * exists under `server/src/services/resultsVnext/okr/` in this worktree
 * (OKR-E002's `okrSetRepository.ts`, OKR-E006's `okrAttentionRepository.ts`,
 * etc. are NOT landed here — built in a parallel worktree). The static
 * regex check below (§2) already scans every `*Repository.ts` file it
 * finds in that directory at run time, so it will automatically start
 * covering those files the moment they land — no test-file edit needed for
 * the static half. The real-DB behavioral half (§1) DOES need a manual
 * follow-up: add the new repository's read functions to the same
 * poison/control/assert block once they exist.
 *
 * Self-contained `buildClientConfig`/`DB_CONFIGURED` (no shared fixtures
 * import) — same convention as `okrCycleLifecycle.realdb.test.ts` /
 * `okrProgramPublish.realdb.test.ts` (OKR-E001), not ROI-E008's
 * `roiPirRealdbFixtures.ts`-shared-helper convention (that shared file
 * doesn't exist for OKR).
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const OKR_VNEXT_SERVICE_DIR = path.join(REPO_ROOT, 'server/src/services/resultsVnext/okr');

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `okr-e008-legacy-iso-org-${tag}`;
const USER_ADMIN = `okr-e008-legacy-iso-admin-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type RepositoryModule = typeof import('../../../server/src/services/resultsVnext/okr/okrRepository.js');
type LegacyRepoModule = typeof import('../../../server/src/services/resultsVnext/okr/okrLegacyArchiveRepository.js');

let createProgram: ProgramCommandsModule['createProgram'];
let listPrograms: RepositoryModule['listPrograms'];
let getProgram: RepositoryModule['getProgram'];
let listCycles: RepositoryModule['listCycles'];
let legacyRepo: LegacyRepoModule;

// Poisoned-row identifiers — inserted directly via raw pg.Client, bypassing
// every service in this repo.
const poisonedCycleId = `legacy-cycle-${tag}`;
const poisonedObjectiveId = `legacy-obj-${tag}`;
const poisonedKeyResultId = `legacy-kr-${tag}`;
const poisonedCheckInId = `legacy-ci-${tag}`;

describe('OKR-E008 Half C legacy isolation (real Postgres)', () => {
  let controlProgramId: string;

  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — OKR-E008 legacyIsolation realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_programs LIMIT 0');
      await client.query('SELECT 1 FROM okr_cycles LIMIT 0');
      await client.query('SELECT 1 FROM okr_objectives LIMIT 0');
      await client.query('SELECT 1 FROM okr_key_results LIMIT 0');
      await client.query('SELECT 1 FROM okr_check_ins LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing required schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const programCommands: ProgramCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrProgramCommands.js'
    );
    createProgram = programCommands.createProgram;

    const repo: RepositoryModule = await import('../../../server/src/services/resultsVnext/okr/okrRepository.js');
    listPrograms = repo.listPrograms;
    getProgram = repo.getProgram;
    listCycles = repo.listCycles;

    legacyRepo = await import('../../../server/src/services/resultsVnext/okr/okrLegacyArchiveRepository.js');
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    // ---- Cleanup: control fixture (okr_vnext_* path) ----
    await client.query(`DELETE FROM okr_vnext_cycles WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_programs WHERE organization_id = $1`, [ORG_ID]);

    // ---- Cleanup: 4 poisoned legacy rows (children first, FK order) ----
    await client.query(`DELETE FROM okr_check_ins WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_key_results WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_objectives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_cycles WHERE organization_id = $1`, [ORG_ID]);

    await client.end();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB(
    'one real control Program + 4 poisoned legacy rows (same org) — okrRepository sees ONLY the control row, never a legacy row',
    async () => {
      // ---- 1. Setup: one real Program through the normal okr_vnext_* command
      // path (OKR-E001, the only vNext OKR write path landed in this
      // worktree). ----
      const created = await createProgram({
        organizationId: ORG_ID,
        name: 'OKR-E008 legacy isolation control Program',
        createdBy: USER_ADMIN,
        actorEffectiveRole: 'admin',
        idempotencyKey: `okr-e008-legacy-iso-create-program-${randomUUID()}`,
      });
      controlProgramId = created.result.programId;

      // ---- 2. Poison: raw pg.Client, bypassing every service, one row per
      // legacy table, same organization_id. ----
      await client.query(
        `INSERT INTO okr_cycles (id, organization_id, name, period_year, status)
         VALUES ($1, $2, $3, 2026, 'draft')`,
        [poisonedCycleId, ORG_ID, 'Legacy isolation poisoned cycle']
      );
      await client.query(
        `INSERT INTO okr_objectives (id, organization_id, label, cycle_id, status)
         VALUES ($1, $2, $3, $4, 'draft')`,
        [poisonedObjectiveId, ORG_ID, 'Legacy isolation poisoned objective', poisonedCycleId]
      );
      await client.query(
        `INSERT INTO okr_key_results (id, objective_id, organization_id, label, baseline, target, current)
         VALUES ($1, $2, $3, $4, 0, 100, 10)`,
        [poisonedKeyResultId, poisonedObjectiveId, ORG_ID, 'Legacy isolation poisoned key result']
      );
      await client.query(
        `INSERT INTO okr_check_ins (id, key_result_id, organization_id, confidence, value, note)
         VALUES ($1, $2, $3, 'green', 10, 'Legacy isolation poisoned check-in')`,
        [poisonedCheckInId, poisonedKeyResultId, ORG_ID]
      );

      // ---- 3. Negative assertion: okrRepository's vNext read model never
      // surfaces a poisoned row, by id. ----
      const programs = await listPrograms({ organizationId: ORG_ID });
      expect(
        programs.length,
        'listPrograms returned more than the 1 control row — ORG_ID is a fresh unique tag for this test run, ' +
          'so any extra row is either leaked legacy data or a fixture-setup bug'
      ).toBe(1);
      expect(programs[0]!.programId).toBe(controlProgramId);
      for (const program of programs) {
        expect([poisonedCycleId, poisonedObjectiveId, poisonedKeyResultId, poisonedCheckInId]).not.toContain(
          program.programId
        );
      }

      const cycles = await listCycles({ organizationId: ORG_ID });
      // The control Program has no okr_vnext_cycles row created (out of
      // scope for this test) — the real assertion is that this list is
      // NEVER populated from a poisoned legacy `okr_cycles` row (a
      // different table/id-space entirely; the legacy poisoned cycle id
      // must never appear here).
      for (const cycle of cycles) {
        expect(cycle.cycleId).not.toBe(poisonedCycleId);
      }

      // ---- 4. Positive assertion: the control Program MUST appear via
      // listPrograms/getProgram (guards against a vacuous pass). ----
      const fetched = await getProgram({ organizationId: ORG_ID, programId: controlProgramId });
      expect(
        fetched,
        'SETUP BROKEN (not isolation): control Program missing from getProgram — fixture insert likely failed'
      ).not.toBeNull();
      expect(fetched?.programId).toBe(controlProgramId);

      // ---- 5. Direct correctness proof for okrLegacyArchiveRepository.ts
      // itself (MANDATORY TESTING DISCIPLINE — every new repository
      // function gets a direct real-Postgres assertion, not just an
      // isolation negative). Each function must find exactly the poisoned
      // row it owns. ----
      const cyclesList = await legacyRepo.listLegacyOkrCycles(ORG_ID, 50, 0);
      expect(cyclesList.rows.some((r) => (r as any).id === poisonedCycleId)).toBe(true);
      const cycleGet = await legacyRepo.getLegacyOkrCycle(ORG_ID, poisonedCycleId);
      expect(cycleGet).not.toBeNull();

      const objectivesList = await legacyRepo.listLegacyOkrObjectives(ORG_ID, 50, 0);
      expect(objectivesList.rows.some((r) => (r as any).id === poisonedObjectiveId)).toBe(true);
      const objectiveGet = await legacyRepo.getLegacyOkrObjective(ORG_ID, poisonedObjectiveId);
      expect(objectiveGet).not.toBeNull();

      const keyResultsList = await legacyRepo.listLegacyOkrKeyResults(ORG_ID, 50, 0);
      expect(keyResultsList.rows.some((r) => (r as any).id === poisonedKeyResultId)).toBe(true);
      const keyResultGet = await legacyRepo.getLegacyOkrKeyResult(ORG_ID, poisonedKeyResultId);
      expect(keyResultGet).not.toBeNull();
      // D-OKR8-19: the repository's SELECT * deliberately includes the D09
      // FK columns — proves the columns really are present on the real row.
      expect(keyResultGet).toHaveProperty('kpi_id');

      const checkInsList = await legacyRepo.listLegacyOkrCheckIns(ORG_ID, 50, 0);
      expect(checkInsList.rows.some((r) => (r as any).id === poisonedCheckInId)).toBe(true);
      const checkInGet = await legacyRepo.getLegacyOkrCheckIn(ORG_ID, poisonedCheckInId);
      expect(checkInGet).not.toBeNull();

      const index = await legacyRepo.getOkrLegacyArchiveIndex(ORG_ID);
      expect(index).toHaveLength(4);
      const bySource = new Map(index.map((row) => [row.sourceTable, row]));
      expect(bySource.get('okr_cycles')?.count).toBeGreaterThanOrEqual(1);
      expect(bySource.get('okr_objectives')?.count).toBeGreaterThanOrEqual(1);
      expect(bySource.get('okr_key_results')?.count).toBeGreaterThanOrEqual(1);
      expect(bySource.get('okr_check_ins')?.count).toBeGreaterThanOrEqual(1);
      for (const row of index) {
        expect(row.originDomain).toBe('okr_legacy_live');
      }
    }
  );

  describe('Static — zero legacy-table references in okr/*Repository.ts files (excluding okrLegacyArchiveRepository.ts itself)', () => {
    it('no okr/*Repository.ts file (other than okrLegacyArchiveRepository.ts) references any of the 4 legacy table names', () => {
      const files = readdirSync(OKR_VNEXT_SERVICE_DIR).filter(
        (f) => f.endsWith('Repository.ts') && f !== 'okrLegacyArchiveRepository.ts'
      );
      expect(
        files.length,
        'No okr/*Repository.ts file found besides okrLegacyArchiveRepository.ts — this test would pass ' +
          'vacuously. NOTE for OKR-E002+: once okrSetRepository.ts/okrAttentionRepository.ts/etc. land, they ' +
          'are automatically picked up here — no test-file edit needed for this static half (see file header).'
      ).toBeGreaterThan(0);

      // Word-boundary regex: does NOT match `okr_vnext_*` tables (preceded
      // by `_`, a word character, so `\b` fails right before the legacy
      // name there) — only matches a bare, standalone legacy table name.
      const legacyTableRef = /\b(okr_cycles|okr_objectives|okr_key_results|okr_check_ins)\b/;

      for (const file of files) {
        const fullPath = path.join(OKR_VNEXT_SERVICE_DIR, file);
        const source = readFileSync(fullPath, 'utf8');
        const codeLines = source
          .split('\n')
          .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'));
        const matches = codeLines.join('\n').match(new RegExp(legacyTableRef, 'g')) ?? [];
        expect(matches, `${file} references a legacy table by name: ${JSON.stringify(matches)}`).toEqual([]);
      }
    });
  });
});
