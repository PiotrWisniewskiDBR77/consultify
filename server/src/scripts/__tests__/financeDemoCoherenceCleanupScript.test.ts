/**
 * FIN-005 — tests for `server/scripts/finance-demo-coherence-cleanup.ts`.
 *
 * The script's dangerous logic (transaction ordering, durable manifest, crash
 * recovery, rollback refusal) is exercised against an IN-MEMORY gateway rather
 * than a database. That is deliberate and it is the only honest way to test it:
 * this branch may not touch demo, Railway or production, and the properties
 * under test are about ORDERING and REFUSAL, not about SQL dialect.
 *
 * What this therefore does NOT prove, stated plainly:
 * - that the SQL in `createPgGateway` is syntactically valid against Postgres;
 * - that `SELECT … FOR UPDATE` actually blocks a concurrent writer;
 * - that `fsync` reaches the physical platter on the operator's machine.
 * Those need a live run, which is out of scope for this packet.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getAtelierFinanceCanonicalIds } from '../../services/demo/atelierFinanceSeed.js';
import {
  assertManifestIntegrity,
  computeRowFingerprint,
  resolveRollbackEntries,
  type CanonicalFixtureReadback,
  type CleanupManifest,
  type DependencyGraph,
  type FinanceDemoClassification,
  type QuarantineOrganizationRow,
} from '../../services/demo/financeDemoCoherencePolicy.js';
import {
  buildReport,
  escapeLike,
  executeQuarantineRun,
  executeRollbackRun,
  main,
  parseArgs,
  parseConnectionFingerprint,
  readManifest,
  resolveDeclaredTarget,
  sqlLiteral,
  writeJsonFileAtomically,
  SCOPED_TABLE_NAMES,
  type CleanupGateway,
  type CleanupTransaction,
} from '../../../scripts/finance-demo-coherence-cleanup.js';

const ORG = 'demo-org';
const CANONICAL = getAtelierFinanceCanonicalIds(ORG);
const RUN_ID = '2026-08-01-a';
const QUAR = `${ORG}-fin005-quarantine-${RUN_ID}`;
const QUAR_NAME = `FIN-005 quarantine (run ${RUN_ID})`;

// ---------------------------------------------------------------------------
// In-memory gateway
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

interface FakeOrg {
  id: string;
  name: string | null;
  organization_type: string | null;
  status: string | null;
  is_active: boolean | null;
  userCount: number;
  memberCount: number;
}

class FakeDb {
  orgs = new Map<string, FakeOrg>();
  tables = new Map<string, Map<string, Row>>();

  table(name: string): Map<string, Row> {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return this.tables.get(name)!;
  }

  insert(table: string, row: Row): void {
    this.table(table).set(String(row.id), row);
  }

  rows(table: string): Row[] {
    return [...this.table(table).values()];
  }

  snapshot(): { orgs: Map<string, FakeOrg>; tables: Map<string, Map<string, Row>> } {
    return structuredClone({ orgs: this.orgs, tables: this.tables });
  }

  restore(snapshot: { orgs: Map<string, FakeOrg>; tables: Map<string, Map<string, Row>> }): void {
    this.orgs = snapshot.orgs;
    this.tables = snapshot.tables;
  }
}

function createFakeGateway(db: FakeDb): CleanupGateway & { db: FakeDb; commits: number } {
  const state = { commits: 0 };

  function graph(): DependencyGraph {
    const orgOf = (row: Row) => String(row.organization_id);
    return {
      packs: db.rows('financial_statement_packs').map((row) => ({
        id: String(row.id),
        organizationId: orgOf(row),
      })),
      statements: db.rows('financial_statements').map((row) => ({
        id: String(row.id),
        organizationId: orgOf(row),
        statementPackId: (row.statement_pack_id as string | null) ?? null,
      })),
      values: db.rows('financial_statement_values').map((row) => ({
        id: String(row.id),
        statementId: String(row.statement_id),
      })),
      ingestRuns: db.rows('financial_statement_ingest_runs').map((row) => ({
        id: String(row.id),
        organizationId: orgOf(row),
        statementId: (row.statement_id as string | null) ?? null,
      })),
      analyses: db.rows('financial_analyses').map((row) => ({
        id: String(row.id),
        organizationId: orgOf(row),
        sourceStatementPackId: (row.source_statement_pack_id as string | null) ?? null,
        sourceStatementIds: row.source_statement_ids
          ? (JSON.parse(String(row.source_statement_ids)) as string[])
          : [],
      })),
      models: db.rows('financial_models').map((row) => ({
        id: String(row.id),
        organizationId: orgOf(row),
        sourceStatementPackId: (row.source_statement_pack_id as string | null) ?? null,
        sourceAnalysisId: (row.source_analysis_id as string | null) ?? null,
      })),
    };
  }

  const tx: CleanupTransaction = {
    async ensureQuarantineOrganization(id, name) {
      if (db.orgs.has(id)) return;
      db.orgs.set(id, {
        id,
        name,
        organization_type: 'DEMO',
        status: 'inactive',
        is_active: false,
        userCount: 0,
        memberCount: 0,
      });
    },
    async readQuarantineOrganization(id): Promise<QuarantineOrganizationRow | null> {
      const org = db.orgs.get(id);
      if (!org) return null;
      return {
        id: org.id,
        name: org.name,
        organizationType: org.organization_type,
        status: org.status,
        isActive: org.is_active,
        userCount: org.userCount,
        memberCount: org.memberCount,
      };
    },
    async lockRows(table, ids, organizationId) {
      return db
        .rows(table)
        .filter((row) => ids.includes(String(row.id)) && row.organization_id === organizationId)
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .map((row) => ({ ...row }));
    },
    async moveRows(params) {
      const moved: string[] = [];
      for (const row of db.rows(params.table)) {
        const id = String(row.id);
        if (!params.ids.includes(id)) continue;
        if (row.organization_id !== params.fromOrganizationId) continue;
        // Mirrors the SQL guard: a canonical id can never be moved.
        if (params.canonicalIds.includes(id)) continue;
        row.organization_id = params.toOrganizationId;
        for (const column of params.clearColumns) {
          if (column in row) row[column] = null;
        }
        moved.push(id);
      }
      return moved;
    },
    async restoreRow(params) {
      const row = db.table(params.table).get(params.id);
      if (!row || row.organization_id !== params.fromOrganizationId) return 0;
      row.organization_id = params.toOrganizationId;
      for (const [column, value] of Object.entries(params.restore)) {
        row[column] = value;
      }
      return 1;
    },
    async readRow(table, id) {
      const row = db.table(table).get(id);
      return row ? { ...row } : null;
    },
    async readPack(id) {
      const row = db.table('financial_statement_packs').get(id);
      return row ? { id: String(row.id), organizationId: String(row.organization_id) } : null;
    },
    async readDependencyGraph() {
      return graph();
    },
  };

  return {
    db,
    get commits() {
      return state.commits;
    },
    async organizationExists(id) {
      const org = db.orgs.get(id);
      return org ? { id: org.id, organizationType: org.organization_type } : null;
    },
    async currentDatabase() {
      return 'railway';
    },
    async listScopedRows(organizationId) {
      const out: Array<{ table: string; id: string; displayName: string }> = [];
      for (const table of SCOPED_TABLE_NAMES) {
        for (const row of db.rows(table)) {
          if (row.organization_id !== organizationId) continue;
          out.push({
            table,
            id: String(row.id),
            displayName: String(row.entity_name || row.title || row.name || row.id),
          });
        }
      }
      return out;
    },
    async countObserveOnly() {
      return [];
    },
    async readCanonicalFixture(): Promise<CanonicalFixtureReadback> {
      return { packs: [], statements: [], values: [], analyses: [], models: [] };
    },
    async readDependencyGraph() {
      return graph();
    },
    async withTransaction(run, hooks) {
      const snapshot = db.snapshot();
      let outcome: unknown;
      try {
        outcome = await run(tx);
      } catch (error) {
        db.restore(snapshot);
        throw error;
      }
      // COMMIT. Everything past this point stays committed — in particular a
      // throwing `afterCommit` (the simulated crash) must NOT undo it.
      state.commits += 1;
      hooks?.afterCommit?.();
      return outcome as never;
    },
    async close() {
      /* nothing to close */
    },
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function seedDb(): FakeDb {
  const db = new FakeDb();
  db.orgs.set(ORG, {
    id: ORG,
    name: 'Demo Organization',
    organization_type: 'DEMO',
    status: 'active',
    is_active: true,
    userCount: 3,
    memberCount: 3,
  });

  // Canonical Atelier fixture — must never move.
  db.insert('financial_statement_packs', {
    id: CANONICAL.packId,
    organization_id: ORG,
    entity_name: 'Atelier Toys',
    period_label: 'FY2014',
  });
  db.insert('financial_statements', {
    id: CANONICAL.statementIds[0],
    organization_id: ORG,
    entity_name: 'Atelier Toys',
    statement_pack_id: CANONICAL.packId,
  });
  db.insert('financial_models', {
    id: CANONICAL.modelId,
    organization_id: ORG,
    name: 'Atelier Toys — Transformation 2015 ROI',
    source_statement_pack_id: CANONICAL.packId,
    source_analysis_id: null,
  });

  // Foreign rows, including an OLD technical fixture carrying the seed prefix.
  db.insert('financial_statements', {
    id: 'uuid-dbr77-pl',
    organization_id: ORG,
    entity_name: 'DBR77 Manufacturing',
    statement_pack_id: CANONICAL.packId,
    created_at: new Date('2026-07-01T09:00:00.000Z'),
  });
  db.insert('financial_models', {
    id: `${ORG}--financial-model--m16-seed`,
    organization_id: ORG,
    name: 'M16 seed model',
    source_statement_pack_id: CANONICAL.packId,
    source_analysis_id: null,
  });
  db.insert('financial_models', {
    id: 'uuid-copy-1',
    organization_id: ORG,
    name: 'DBR77 Staging Finance Model (kopia)',
    source_statement_pack_id: null,
    source_analysis_id: null,
  });
  return db;
}

const FOREIGN: FinanceDemoClassification[] = [
  {
    table: 'financial_statements',
    id: 'uuid-dbr77-pl',
    displayName: 'DBR77 Manufacturing',
    canonical: false,
    legacyPrefixed: false,
    flags: ['DBR77'],
  },
  {
    table: 'financial_models',
    id: `${ORG}--financial-model--m16-seed`,
    displayName: 'M16 seed model',
    canonical: false,
    legacyPrefixed: true,
    flags: ['technical-seed'],
  },
  {
    table: 'financial_models',
    id: 'uuid-copy-1',
    displayName: 'DBR77 Staging Finance Model (kopia)',
    canonical: false,
    legacyPrefixed: false,
    flags: ['DBR77', 'staging', 'ui-duplicate'],
  },
];

let workDir: string;

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fin005-cleanup-'));
});

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

function runParams(db: FakeDb, overrides: Record<string, unknown> = {}) {
  return {
    gateway: createFakeGateway(db),
    demoOrgId: ORG,
    quarantineOrgId: QUAR,
    quarantineOrgName: QUAR_NAME,
    runId: RUN_ID,
    foreign: FOREIGN,
    manifestPath: path.join(workDir, 'manifest.json'),
    host: 'trolley.proxy.rlwy.net',
    database: 'railway',
    ...overrides,
  } as Parameters<typeof executeQuarantineRun>[0];
}

// ---------------------------------------------------------------------------
// Durable file write
// ---------------------------------------------------------------------------

describe('writeJsonFileAtomically', () => {
  it('writes the file and leaves no temp artefact behind', () => {
    const target = path.join(workDir, 'nested', 'out.json');
    writeJsonFileAtomically(target, { a: 1 });
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual({ a: 1 });
    expect(fs.readdirSync(path.dirname(target))).toEqual(['out.json']);
  });

  it('replaces an existing file atomically rather than truncating it', () => {
    const target = path.join(workDir, 'out.json');
    writeJsonFileAtomically(target, { version: 1 });
    writeJsonFileAtomically(target, { version: 2 });
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual({ version: 2 });
    expect(fs.readdirSync(workDir)).toEqual(['out.json']);
  });
});

// ---------------------------------------------------------------------------
// Quarantine
// ---------------------------------------------------------------------------

describe('executeQuarantineRun', () => {
  it('moves every foreign row, keeps canonical rows, and clears tenant links', async () => {
    const db = seedDb();
    const manifest = await executeQuarantineRun(runParams(db));

    expect(manifest.status).toBe('COMMITTED');
    expect(manifest.entries).toHaveLength(3);
    expect(db.table('financial_statements').get('uuid-dbr77-pl')!.organization_id).toBe(QUAR);
    expect(db.table('financial_statements').get('uuid-dbr77-pl')!.statement_pack_id).toBeNull();
    expect(
      db.table('financial_models').get(`${ORG}--financial-model--m16-seed`)!.organization_id
    ).toBe(QUAR);
    // Canonical rows untouched.
    expect(db.table('financial_models').get(CANONICAL.modelId)!.organization_id).toBe(ORG);
    expect(db.table('financial_statement_packs').get(CANONICAL.packId)!.organization_id).toBe(ORG);
  });

  it('records the FULL prior state and both fingerprints for every row', async () => {
    const db = seedDb();
    const manifest = await executeQuarantineRun(runParams(db));
    const entry = manifest.entries.find((item) => item.id === 'uuid-dbr77-pl')!;

    expect(entry.priorState).toMatchObject({
      id: 'uuid-dbr77-pl',
      organization_id: ORG,
      entity_name: 'DBR77 Manufacturing',
      statement_pack_id: CANONICAL.packId,
    });
    expect(entry.clearedLinks).toEqual({ statement_pack_id: CANONICAL.packId });
    expect(entry.statementPackId).toBe(CANONICAL.packId);
    expect(entry.priorFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.expectedQuarantinedFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.expectedQuarantinedFingerprint).not.toBe(entry.priorFingerprint);
    // The recorded post-quarantine fingerprint matches the live row.
    expect(computeRowFingerprint(db.table('financial_statements').get('uuid-dbr77-pl')!)).toBe(
      entry.expectedQuarantinedFingerprint
    );
  });

  it('persists the rollback plan to disk BEFORE the transaction commits', async () => {
    const db = seedDb();
    const order: string[] = [];
    const gateway = createFakeGateway(db);
    const wrapped: CleanupGateway = {
      ...gateway,
      async withTransaction(run, hooks) {
        return gateway.withTransaction(async (tx) => {
          const outcome = await run(tx);
          order.push('COMMIT');
          return outcome;
        }, hooks);
      },
    };

    await executeQuarantineRun(
      runParams(db, {
        gateway: wrapped,
        writeManifest: (filePath: string, manifest: CleanupManifest) => {
          order.push(`write:${manifest.status}`);
          writeJsonFileAtomically(filePath, manifest);
        },
      })
    );

    expect(order).toEqual(['write:PREPARED', 'COMMIT', 'write:COMMITTED']);
  });

  it('refuses to move rows into an existing CUSTOMER tenant', async () => {
    const db = seedDb();
    db.orgs.set(QUAR, {
      id: QUAR,
      name: 'Elkomtech S.A.',
      organization_type: 'CUSTOMER',
      status: 'active',
      is_active: true,
      userCount: 26,
      memberCount: 26,
    });

    await expect(executeQuarantineRun(runParams(db))).rejects.toThrow(
      /never be moved into a tenant with users/i
    );
    // Nothing moved.
    expect(db.table('financial_statements').get('uuid-dbr77-pl')!.organization_id).toBe(ORG);
    expect(fs.existsSync(path.join(workDir, 'manifest.json'))).toBe(false);
  });

  it('rolls back when a dependency would be left pointing across the tenant boundary', async () => {
    const db = seedDb();
    // An ingest run whose statement stays in the demo tenant: its statement_id is
    // NOT NULL and cannot be cleared, so quarantining it breaks the graph.
    db.insert('financial_statement_ingest_runs', {
      id: 'uuid-ingest-foreign',
      organization_id: ORG,
      statement_id: CANONICAL.statementIds[0],
      source_file_name: 'dbr77.pdf',
    });
    const foreign = [
      ...FOREIGN,
      {
        table: 'financial_statement_ingest_runs',
        id: 'uuid-ingest-foreign',
        displayName: 'dbr77.pdf',
        canonical: false,
        legacyPrefixed: false,
        flags: [],
      },
    ];

    await expect(executeQuarantineRun(runParams(db, { foreign }))).rejects.toThrow(
      /Dependency postcondition failed \(pre-COMMIT\)/
    );
    expect(db.table('financial_statements').get('uuid-dbr77-pl')!.organization_id).toBe(ORG);
  });

  it('refuses when the tenant changed since the dry run', async () => {
    const db = seedDb();
    db.table('financial_models').delete('uuid-copy-1');
    await expect(executeQuarantineRun(runParams(db))).rejects.toThrow(/expected to lock 2 row\(s\)/);
  });

  it('cannot move a canonical row even if the caller hand-edits the candidate list', async () => {
    const db = seedDb();
    const foreign = [
      ...FOREIGN,
      {
        table: 'financial_models',
        id: CANONICAL.modelId,
        displayName: 'Atelier Toys — Transformation 2015 ROI',
        canonical: false, // a lie
        legacyPrefixed: true,
        flags: [],
      },
    ];
    await expect(executeQuarantineRun(runParams(db, { foreign }))).rejects.toThrow(
      /expected to quarantine 3 row\(s\), updated 2/
    );
    expect(db.table('financial_models').get(CANONICAL.modelId)!.organization_id).toBe(ORG);
  });
});

// ---------------------------------------------------------------------------
// Fault injection — crash AFTER COMMIT, BEFORE the final manifest write
// ---------------------------------------------------------------------------

describe('crash between COMMIT and the final manifest write', () => {
  it('leaves a PREPARED manifest on disk that is enough to recover', async () => {
    const db = seedDb();
    const manifestPath = path.join(workDir, 'manifest.json');

    await expect(
      executeQuarantineRun(
        runParams(db, {
          gateway: createFakeGateway(db),
          manifestPath,
          hooks: {
            afterCommit: () => {
              throw new Error('SIGKILL: process died after COMMIT');
            },
          },
        })
      )
    ).rejects.toThrow(/died after COMMIT/);

    // The rows DID move — the transaction committed.
    expect(db.table('financial_statements').get('uuid-dbr77-pl')!.organization_id).toBe(QUAR);

    // …and the plan to move them back is on disk, complete and signed.
    const onDisk = readManifest(manifestPath);
    expect(onDisk.status).toBe('PREPARED');
    expect(onDisk.entries).toEqual([]);
    expect(() => assertManifestIntegrity(onDisk)).not.toThrow();

    const recovered = resolveRollbackEntries(onDisk);
    expect(recovered.recoveredFromPlan).toBe(true);
    expect(recovered.entries).toHaveLength(3);
    for (const entry of recovered.entries) {
      expect(entry.priorState).toBeDefined();
      expect(entry.expectedQuarantinedFingerprint).toBeTruthy();
    }
  });

  it('recovers the database from that PREPARED manifest', async () => {
    const db = seedDb();
    const manifestPath = path.join(workDir, 'manifest.json');

    await expect(
      executeQuarantineRun(
        runParams(db, {
          gateway: createFakeGateway(db),
          manifestPath,
          hooks: {
            afterCommit: () => {
              throw new Error('crash');
            },
          },
        })
      )
    ).rejects.toThrow(/crash/);

    const outcome = await executeRollbackRun({
      gateway: createFakeGateway(db),
      manifest: readManifest(manifestPath),
      target: { host: 'trolley.proxy.rlwy.net', database: 'railway' },
      approvedOrganizationId: ORG,
    });

    expect(outcome.recoveredFromPlan).toBe(true);
    expect(outcome.restored).toBe(3);
    const statement = db.table('financial_statements').get('uuid-dbr77-pl')!;
    expect(statement.organization_id).toBe(ORG);
    expect(statement.statement_pack_id).toBe(CANONICAL.packId);
    expect(db.table('financial_models').get('uuid-copy-1')!.organization_id).toBe(ORG);
  });

  it('is idempotent: a PREPARED manifest whose rows never moved restores cleanly', async () => {
    const db = seedDb();
    const manifestPath = path.join(workDir, 'manifest.json');
    // Quarantine, then hand-undo one row to simulate "the COMMIT never landed".
    await executeQuarantineRun(runParams(db, { manifestPath }));
    const manifest = readManifest(manifestPath);
    const prepared: CleanupManifest = { ...manifest, status: 'PREPARED', entries: [] };
    // Re-sign, because the rollback refuses an unsigned/edited manifest.
    const { signManifest } = await import('../../services/demo/financeDemoCoherencePolicy.js');
    const resigned = signManifest(prepared);

    const row = db.table('financial_models').get('uuid-copy-1')!;
    row.organization_id = ORG;

    const outcome = await executeRollbackRun({
      gateway: createFakeGateway(db),
      manifest: resigned,
      target: { host: 'trolley.proxy.rlwy.net', database: 'railway' },
      approvedOrganizationId: ORG,
    });
    // The already-correct row is skipped, the other two are restored.
    expect(outcome.restored).toBe(2);
    expect(db.table('financial_statements').get('uuid-dbr77-pl')!.organization_id).toBe(ORG);
  });
});

// ---------------------------------------------------------------------------
// Rollback
// ---------------------------------------------------------------------------

describe('executeRollbackRun', () => {
  async function quarantined(): Promise<{ db: FakeDb; manifest: CleanupManifest }> {
    const db = seedDb();
    const manifestPath = path.join(workDir, 'manifest.json');
    await executeQuarantineRun(runParams(db, { manifestPath }));
    return { db, manifest: readManifest(manifestPath) };
  }

  it('restores every row and its cleared links', async () => {
    const { db, manifest } = await quarantined();
    const outcome = await executeRollbackRun({
      gateway: createFakeGateway(db),
      manifest,
      target: { host: 'trolley.proxy.rlwy.net', database: 'railway' },
      approvedOrganizationId: ORG,
    });
    expect(outcome).toEqual({ restored: 3, recoveredFromPlan: false });
    expect(db.table('financial_statements').get('uuid-dbr77-pl')!.statement_pack_id).toBe(
      CANONICAL.packId
    );
  });

  it('REFUSES when a record changed after quarantine', async () => {
    const { db, manifest } = await quarantined();
    db.table('financial_models').get('uuid-copy-1')!.name = 'Renamed while in quarantine';

    await expect(
      executeRollbackRun({
        gateway: createFakeGateway(db),
        manifest,
        target: { host: 'trolley.proxy.rlwy.net', database: 'railway' },
        approvedOrganizationId: ORG,
      })
    ).rejects.toThrow(/changed after it was quarantined/);
    // All-or-nothing: nothing was restored.
    expect(db.table('financial_statements').get('uuid-dbr77-pl')!.organization_id).toBe(QUAR);
  });

  it('refuses a manifest whose checksum does not verify', async () => {
    const { db, manifest } = await quarantined();
    const tampered = { ...manifest, quarantineOrgId: 'elkomtech' };
    await expect(
      executeRollbackRun({
        gateway: createFakeGateway(db),
        manifest: tampered,
        target: { host: 'trolley.proxy.rlwy.net', database: 'railway' },
        approvedOrganizationId: ORG,
      })
    ).rejects.toThrow(/checksum mismatch/);
  });

  it('refuses to restore into an organization other than the approved one', async () => {
    const { db, manifest } = await quarantined();
    await expect(
      executeRollbackRun({
        gateway: createFakeGateway(db),
        manifest,
        target: { host: 'trolley.proxy.rlwy.net', database: 'railway' },
        approvedOrganizationId: 'some-other-org',
      })
    ).rejects.toThrow(/approved target organization/);
  });

  it('refuses to replay a manifest against a different database', async () => {
    const { db, manifest } = await quarantined();
    await expect(
      executeRollbackRun({
        gateway: createFakeGateway(db),
        manifest,
        target: { host: 'centerbeam.proxy.rlwy.net', database: 'railway' },
        approvedOrganizationId: ORG,
      })
    ).rejects.toThrow(/Refusing to replay across databases/);
  });

  it('refuses when the statement pack it would re-link now belongs to another tenant', async () => {
    const { db, manifest } = await quarantined();
    db.table('financial_statement_packs').get(CANONICAL.packId)!.organization_id = 'elkomtech';
    await expect(
      executeRollbackRun({
        gateway: createFakeGateway(db),
        manifest,
        target: { host: 'trolley.proxy.rlwy.net', database: 'railway' },
        approvedOrganizationId: ORG,
      })
    ).rejects.toThrow(/belongs to/);
  });
});

// ---------------------------------------------------------------------------
// CLI surface
// ---------------------------------------------------------------------------

describe('CLI surface', () => {
  it('does not run anything on import — only the CLI entry auto-runs', () => {
    // Reaching this line at all proves it: importing the module above neither
    // opened a pool nor called main().
    expect(typeof main).toBe('function');
  });

  it('removes --force-org outright and says why', async () => {
    await expect(main(['--force-org'])).rejects.toThrow(/--force-org no longer exists/);
    await expect(main(['--force-org', 'true', '--write'])).rejects.toThrow(/its own packet/);
  });

  it('requires the target to be declared — nothing is defaulted', () => {
    const declared = resolveDeclaredTarget(parseArgs([]));
    expect(Object.values(declared).every((value) => value === '')).toBe(true);

    const full = resolveDeclaredTarget(
      parseArgs([
        '--railway-project',
        'consultify',
        '--railway-environment',
        'demo',
        '--railway-service',
        'Postgres',
        '--expect-host',
        'trolley.proxy.rlwy.net',
        '--expect-port',
        '28146',
        '--expect-database',
        'railway',
        '--demo-org-id',
        ORG,
      ])
    );
    expect(full).toEqual({
      railwayProject: 'consultify',
      railwayEnvironment: 'demo',
      railwayService: 'Postgres',
      host: 'trolley.proxy.rlwy.net',
      port: '28146',
      database: 'railway',
      organizationId: ORG,
    });
  });

  it('parses the connection fingerprint the allowlist is matched against', () => {
    expect(
      parseConnectionFingerprint('postgresql://u:p@trolley.proxy.rlwy.net:28146/railway')
    ).toEqual({ host: 'trolley.proxy.rlwy.net', port: 28146, database: 'railway' });
  });
});

describe('report generation', () => {
  it('escapes SQL literals and LIKE metacharacters in the pasteable queries', () => {
    expect(sqlLiteral("o'brien")).toBe("'o''brien'");
    expect(escapeLike('demo_org%x')).toBe('demo!_org!%x');

    const report = buildReport({
      demoOrgId: ORG,
      quarantineOrgId: QUAR,
      dryRun: true,
      host: 'trolley.proxy.rlwy.net',
      database: 'railway',
      candidates: [
        {
          table: 'financial_models',
          id: `${ORG}--financial-model--m16-seed`,
          displayName: 'M16 seed model',
          canonical: false,
          legacyPrefixed: true,
          flags: ['technical-seed'],
        },
      ],
      observeOnly: [{ table: 'budgets', count: 2 }],
      generatedAt: '2026-08-01T00:00:00.000Z',
    });

    expect(report).toContain("ESCAPE '!'");
    expect(report).toContain('legacy_prefixed_rows');
    expect(report).toContain('**yes (old fixture)**');
    // The canonical filter lists exact ids, not a prefix.
    expect(report).toContain(sqlLiteral(CANONICAL.modelId));
  });
});
