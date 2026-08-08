import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { adaptQuery } from '../database/PostgresDatabase.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });
const proofDb = {
  query: (text: string, params: unknown[] = []) => pool.query(adaptQuery(text), params),
  get(text: string, params: unknown[], cb: (error: Error | null, row: unknown) => void) { void pool.query(adaptQuery(text), params).then((r) => cb(null, r.rows[0] ?? null), cb); },
  all(text: string, params: unknown[], cb: (error: Error | null, rows: unknown[]) => void) { void pool.query(adaptQuery(text), params).then((r) => cb(null, r.rows), cb); },
  run(text: string, params: unknown[], cb: (error: Error | null) => void) { void pool.query(adaptQuery(text), params).then((r) => cb.call({ changes: r.rowCount ?? 0 }, null), (e) => cb.call({ changes: 0 }, e)); },
  serialize(cb: () => void) { cb(); },
};
(globalThis as any).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;
(process as any).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;

async function main() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(`CREATE TABLE v8_agent_run_identities (canonical_run_id TEXT NOT NULL, organization_id TEXT NOT NULL, PRIMARY KEY (canonical_run_id, organization_id));`);
  await pool.query(`INSERT INTO v8_agent_run_identities VALUES ('run-t01','org-t01')`);
  const { assertLegacyNoncanonicalExecution: guard } = await import('../ai/legacyNoncanonicalExecution.js');
  const legacy = await guard({ entrypoint: 'playbook_executor', organizationId: 'org-legacy', entityId: 'run-legacy', payloads: [] });
  assert.equal(legacy.classification, 'legacy_noncanonical');
  await assert.rejects(() => guard({ entrypoint: 'ai_playbook_executor', organizationId: 'org-t01', entityId: 'run-t01', payloads: [] }), /canonical_identity_forbidden/);
  await assert.rejects(() => guard({ entrypoint: 'async_job_service', organizationId: 'org-t01', entityId: 'decision', payloads: [{ context: { canonical_run_id: 'run-t01' } }] }), /canonical_identity_forbidden/);
  await assert.rejects(() => guard({ entrypoint: 'async_job_processor', organizationId: 'org-t01', payloads: [{ branches: [{ Canonical_Run_Ref: 'run-t01' }] }] }), /canonical_identity_forbidden/);
  await assert.rejects(() => guard({ entrypoint: 'ai_playbook_executor', organizationId: 'org-t01', payloads: [{ Run_ID: 'run-t01' }] }), /canonical_identity_forbidden/);
  const foreignTenant = await guard({ entrypoint: 'async_job_processor', organizationId: 'org-foreign', entityId: 'run-t01', payloads: [] });
  assert.equal(foreignTenant.classification, 'legacy_noncanonical');
  console.log(JSON.stringify({ proof: 'A09_LEGACY_NONCANONICAL_ISOLATION_REALDB_GREEN', legacyClassified: true, canonicalIdentityBlocked: true, nestedExplicitIdentityBlocked: true, alternateCaseAliasBlocked: true, tenantScoped: true }));
}

main().finally(() => pool.end());
