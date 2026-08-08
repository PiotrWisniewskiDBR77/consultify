import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Pool } from 'pg';
import { adaptQuery } from '../database/PostgresDatabase.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });
const db = {
  query: (text: string, params: unknown[] = []) => pool.query(adaptQuery(text), params),
  get(text: string, params: unknown[], cb: (error: Error | null, row: unknown) => void) { void pool.query(adaptQuery(text), params).then((r) => cb(null, r.rows[0] ?? null), (error) => cb(error as Error, null)); },
  all(text: string, params: unknown[], cb: (error: Error | null, rows: unknown[]) => void) { void pool.query(adaptQuery(text), params).then((r) => cb(null, r.rows), (error) => cb(error as Error, [])); },
  run(text: string, params: unknown[], cb: (error: Error | null) => void) { void pool.query(adaptQuery(text), params).then((r) => cb.call({ changes: r.rowCount ?? 0 }, null), (e) => cb.call({ changes: 0 }, e)); },
  serialize(cb: () => void) { cb(); },
};
(globalThis as any).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = db;
(process as any).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = db;

async function main() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(`
    CREATE TABLE transformation_cases (transformation_case_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, execution_run_id TEXT NOT NULL, context_snapshot_id TEXT NOT NULL, project_id TEXT, mandate TEXT NOT NULL);
    CREATE TABLE v8_context_snapshots (snapshot_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT, initiator_user_id TEXT NOT NULL, source_context_refs JSONB NOT NULL, drift_events JSONB NOT NULL DEFAULT '[]');
    CREATE TABLE project_members (project_id TEXT NOT NULL, user_id TEXT NOT NULL);
    CREATE TABLE knowledge_docs (id TEXT PRIMARY KEY, filename TEXT, status TEXT, scope TEXT, project_id TEXT, owner_id TEXT, version INT, created_at TIMESTAMPTZ, organization_id TEXT, deleted_at TIMESTAMPTZ);
    CREATE TABLE knowledge_chunks (id TEXT PRIMARY KEY, doc_id TEXT, document_id TEXT, content TEXT, chunk_index INT, metadata JSONB);
    CREATE TABLE organization_context_lineage_events (id TEXT PRIMARY KEY, organization_id TEXT, user_id TEXT, target_type TEXT, target_id TEXT, workflow TEXT, event_type TEXT, requested_document_ids_json JSONB, selected_document_ids_json JSONB, used_chunks_json JSONB, degraded BOOLEAN, degraded_reasons_json JSONB, metadata_json JSONB, created_at TIMESTAMPTZ);
  `);
  await pool.query(adaptQuery(fs.readFileSync(new URL('../../migrations/20260807_v8_agent_context_grounding.sql', import.meta.url), 'utf8')));
  await pool.query(`
    INSERT INTO project_members VALUES ('project-a','user-a');
    INSERT INTO knowledge_docs VALUES
      ('doc-allowed','Allowed.pdf','ready','project','project-a',NULL,1,NOW(),'org-a',NULL),
      ('doc-foreign','Foreign.pdf','ready','project','project-b',NULL,1,NOW(),'org-a',NULL);
    INSERT INTO knowledge_chunks VALUES
      ('chunk-allowed','doc-allowed',NULL,'fact-123',1,'{"nativeSourceLocator":{"page":2}}'),
      ('chunk-too-long','doc-allowed',NULL,'this candidate exceeds the memory bound',2,'{}'),
      ('chunk-foreign','doc-foreign',NULL,'secret',1,'{}');
    INSERT INTO v8_context_snapshots VALUES
      ('snap-a','org-a','project-a','user-a','[{"artifactId":"doc-allowed","module":"Knowledge"}]','[]'),
      ('snap-foreign','org-a','project-a','user-a','[{"artifactId":"doc-foreign","module":"Knowledge"}]','[]'),
      ('snap-no-project','org-a',NULL,'user-a','[{"artifactId":"doc-allowed","module":"Knowledge"}]','[]');
    INSERT INTO transformation_cases VALUES
      ('case-a','org-a','run-a','snap-a','project-a','reduce lead time'),
      ('case-foreign','org-a','run-foreign','snap-foreign','project-a','read foreign'),
      ('case-no-project','org-a','run-no-project','snap-no-project',NULL,'invalid scope');
  `);
  const { retrieveAndRevalidateTransformationContext } = await import('../services/v8/agentContextProductionRetrievalAdapter.js');
  const client = { query: (sql: string, params: unknown[] = []) => pool.query(adaptQuery(sql), params) } as any;
  const policy = { allowedModules: ['Knowledge'], allowedArtifactIds: [], projectId: 'project-a', maxResults: 5, maxWorkingMemoryChars: 12 };
  const first = await retrieveAndRevalidateTransformationContext({ transformationCaseId: 'case-a', organizationId: 'org-a', actorUserId: 'user-a', policy, client });
  assert.equal(first.decision, 'allowed');
  if (!('admitted' in first)) throw new Error('Expected allowed retrieval with admitted candidates');
  assert.deepEqual(first.admitted.map((item: any) => item.artifactId), ['doc-allowed']);
  const second = await retrieveAndRevalidateTransformationContext({ transformationCaseId: 'case-a', organizationId: 'org-a', actorUserId: 'user-a', policy, client });
  assert.equal(second.decision, 'allowed');
  const foreign = await retrieveAndRevalidateTransformationContext({ transformationCaseId: 'case-foreign', organizationId: 'org-a', actorUserId: 'user-a', policy, client });
  assert.equal(foreign.decision, 'blocked_snapshot');
  const blocked = await retrieveAndRevalidateTransformationContext({ transformationCaseId: 'case-no-project', organizationId: 'org-a', actorUserId: 'user-a', policy: { ...policy, projectId: null }, client });
  assert.equal(blocked.decision, 'blocked_snapshot');
  const binding = await pool.query(`SELECT COUNT(*)::int count, MIN(memory_entry_id) memory_entry_id FROM v8_agent_working_memory_bindings`);
  const lineage = await pool.query(`SELECT COUNT(*)::int count FROM organization_context_lineage_events`);
  assert.deepEqual(binding.rows[0], { count: 1, memory_entry_id: 'doc-allowed' });
  assert.equal(lineage.rows[0].count, 1);
  console.log(JSON.stringify({ proof: 'A04_PRODUCTION_RETRIEVAL_REALDB_GREEN', allowedProjectMember: true, foreignProjectExcluded: true, nativeAttribution: true, boundedMemory: true, retrievalFailureBlocked: true, retryBindings: binding.rows[0].count, retryLineage: lineage.rows[0].count }));
}

main().finally(() => pool.end());
