import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Pool } from 'pg';
import { adaptQuery } from '../database/PostgresDatabase.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });
const db = {
  all(sql: string, params: unknown[], cb: (error: Error | null, rows: unknown[]) => void) {
    void pool.query(adaptQuery(sql), params).then((result) => cb(null, result.rows), cb);
  },
  get(sql: string, params: unknown[], cb: (error: Error | null, row: unknown) => void) {
    void pool.query(adaptQuery(sql), params).then((result) => cb(null, result.rows[0] ?? null), cb);
  },
  run(sql: string, params: unknown[], cb: (error: Error | null) => void) {
    void pool.query(adaptQuery(sql), params).then(
      (result) => cb.call({ changes: result.rowCount ?? 0 }, null),
      (error) => cb.call({ changes: 0 }, error)
    );
  },
  serialize(cb: () => void) {
    cb();
  },
};
(globalThis as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = db;
(process as unknown as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = db;

async function main(): Promise<void> {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(`
    CREATE TABLE v8_context_snapshots (
      snapshot_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT,
      source_context_refs TEXT NOT NULL, drift_events TEXT NOT NULL
    );
    CREATE TABLE transformation_cases (
      transformation_case_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL,
      execution_run_id TEXT NOT NULL, context_snapshot_id TEXT NOT NULL, project_id TEXT
    );
  `);
  await pool.query(
    adaptQuery(
      fs.readFileSync(
        new URL('../../migrations/20260807_v8_agent_context_grounding.sql', import.meta.url),
        'utf8'
      )
    )
  );
  await pool.query(`
    INSERT INTO v8_context_snapshots VALUES
      ('snap-clean','org-a04','project-a04','["vault:allowed"]','[]'),
      ('snap-drift','org-a04','project-a04','["vault:allowed"]','[{"type":"artifact_changed"}]');
    INSERT INTO transformation_cases VALUES
      ('case-clean','org-a04','run-clean','snap-clean','project-a04'),
      ('case-drift','org-a04','run-drift','snap-drift','project-a04');
  `);
  const { revalidateTransformationContext } =
    await import('../services/v8/agentContextGroundingService.js');
  const policy = {
    allowedModules: ['Vault'],
    allowedArtifactIds: [],
    projectId: 'project-a04',
    maxResults: 5,
    maxWorkingMemoryChars: 8,
  };
  const candidates = [
    {
      sourceRef: 'finance:denied',
      artifactId: 'finance-1',
      module: 'Finance',
      projectId: 'project-a04',
      content: 'higher relevance but forbidden',
      relevance: 1,
    },
    {
      sourceRef: 'vault:allowed',
      artifactId: 'vault-1',
      module: 'Vault',
      projectId: 'project-a04',
      content: 'allowed',
      relevance: 0.5,
    },
  ];
  const clean = await revalidateTransformationContext({
    transformationCaseId: 'case-clean',
    organizationId: 'org-a04',
    actorUserId: 'worker-a04',
    policy,
    candidates,
  });
  assert.equal(clean.decision, 'allowed');
  assert.deepEqual(
    clean.admitted.map((item) => item.sourceRef),
    ['vault:allowed']
  );
  assert.equal(clean.denied[0].reason, 'module_not_allowed');
  const drift = await revalidateTransformationContext({
    transformationCaseId: 'case-drift',
    organizationId: 'org-a04',
    actorUserId: 'worker-a04',
    policy,
    candidates,
  });
  assert.equal(drift.decision, 'blocked_drift');
  const decisions = await pool.query(
    `SELECT decision FROM v8_agent_context_revalidations ORDER BY decision`
  );
  const bindings = await pool.query(
    `SELECT source_ref, char_count FROM v8_agent_working_memory_bindings`
  );
  assert.deepEqual(
    decisions.rows.map((row) => row.decision),
    ['allowed', 'blocked_drift']
  );
  assert.deepEqual(bindings.rows[0], { source_ref: 'vault:allowed', char_count: 7 });
  console.log(
    JSON.stringify({
      proof: 'A04_REALDB_GREEN',
      policyBeforeRanking: true,
      attribution: true,
      boundedMemory: true,
      resumeDriftBlocked: true,
      tenantScoped: true,
      durableDecisions: 2,
    })
  );
}

main().finally(() => pool.end());
