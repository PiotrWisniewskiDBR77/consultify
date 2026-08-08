import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Pool } from 'pg';
import { adaptQuery } from '../database/PostgresDatabase.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });
const proofDb = {
  query: (text: string, params: unknown[] = []) => pool.query(adaptQuery(text), params),
  get(
    text: string,
    params: unknown[] = [],
    callback?: (error: Error | null, row: unknown) => void
  ) {
    const promise = pool.query(adaptQuery(text), params).then((r) => r.rows[0] ?? null);
    if (callback)
      void promise.then(
        (row) => callback(null, row),
        (e) => callback(e as Error, null)
      );
    return callback ? proofDb : promise;
  },
  all(
    text: string,
    params: unknown[] = [],
    callback?: (error: Error | null, rows: unknown[]) => void
  ) {
    const promise = pool.query(adaptQuery(text), params).then((r) => r.rows);
    if (callback)
      void promise.then(
        (rows) => callback(null, rows),
        (e) => callback(e as Error, [])
      );
    return callback ? proofDb : promise;
  },
  run(text: string, params: unknown[] = [], callback?: (error: Error | null) => void) {
    const promise = pool
      .query(adaptQuery(text), params)
      .then((r) => ({ changes: r.rowCount ?? 0 }));
    if (callback)
      void promise.then(
        (r) => callback.call({ changes: r.changes }, null),
        (e) => callback.call({ changes: 0 }, e as Error)
      );
    return callback ? proofDb : promise;
  },
  exec: (text: string) => pool.query(text).then(() => undefined),
  serialize(callback: () => void) {
    callback();
  },
  close: () => Promise.resolve(),
};
(globalThis as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;
(process as unknown as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;

async function main(): Promise<void> {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(`CREATE TABLE ai_playbook_templates (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, title TEXT NOT NULL, description TEXT, trigger_signal TEXT, template_graph TEXT, estimated_duration_mins INTEGER, status TEXT DEFAULT 'DRAFT', version INTEGER DEFAULT 1, category_id TEXT, organization_id TEXT, usage_count INTEGER DEFAULT 0, last_used_at TIMESTAMP, avg_execution_time_mins INTEGER, success_rate REAL, is_active INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_by TEXT);
    CREATE TABLE ai_playbook_template_versions (id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES ai_playbook_templates(id), version INTEGER NOT NULL, title TEXT NOT NULL, description TEXT, trigger_signal TEXT, template_graph TEXT, estimated_duration_mins INTEGER, changed_by TEXT, change_notes TEXT, change_type TEXT, status_at_version TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
  for (const migration of [
    '20260323_v8_context_snapshot.sql',
    '20260323_v8_context_snapshot_identity_chain.sql',
    '20260323_v8_execution_spine.sql',
    '20260807_agent_t01_transformation_case.sql',
    '20260807_v8_agent_run_identity.sql',
    '20260807_v8_multi_agent_work_manager.sql',
    '20260807_v8_agent_template_governance.sql',
  ]) {
    await pool.query(
      adaptQuery(fs.readFileSync(new URL(`../../migrations/${migration}`, import.meta.url), 'utf8'))
    );
  }
  const templates = await import('../services/v8/agentProcessTemplateService.js');
  const sourceGraph = {
    mode: 'router_parallel' as const,
    leadAgentId: 'lead-teresa',
    budget: { maxTokens: 10000 },
    runtimeBundle: {
      promptKey: 'agent.transformation',
      promptVersion: '1.0.0',
      modelId: 'gpt-5',
      modelVersion: '2026-08-07',
      policyVersion: 'agent-policy-1',
      toolPolicyRefs: ['research-read-v1', 'finance-read-v1'],
      agentDefinitionVersions: { 'research-agent': '1.0.0', 'sheets-finance-agent': '1.0.0' },
    },
    tasks: [
      {
        key: 'research',
        specialistAgentId: 'research-agent',
        title: 'Research',
        objective: 'Gather evidence',
        budget: { maxTokens: 5000 },
      },
    ],
  };
  const created = await templates.createAgentProcessTemplate({
    organizationId: 'org-a12',
    actorUserId: 'owner-a12',
    key: 'transformation-v1',
    title: 'Transformation',
    graph: sourceGraph,
  });
  await assert.rejects(
    () =>
      templates.instantiateAgentProcessTemplate({
        templateId: created.templateId,
        organizationId: 'org-a12',
        actorUserId: 'owner-a12',
        executionRunId: 'run-before-publish',
      }),
    /published_agent_template_not_found/
  );
  const published = await templates.transitionAgentProcessTemplate({
    templateId: created.templateId,
    organizationId: 'org-a12',
    actorUserId: 'owner-a12',
    action: 'publish',
    reason: 'QA approved',
  });
  await pool.query(`INSERT INTO v8_context_snapshots(snapshot_id,snapshot_version,captured_at,workspace_id,organization_id,execution_run_id,artifact_refs,effective_scope_ref,resolved_role_ref,initiator_user_id,consumer_class,privacy_mode,source_context_refs,drift_events) VALUES ('snapshot-a12',1,NOW(),'org-a12','org-a12','run-a12','[]','case-a12','transformation_agent','owner-a12','execution',0,'[]','[]');INSERT INTO v8_execution_runs(run_id,organization_id,context_snapshot_id,initiator_user_id,state,plan_version,goal,metadata) VALUES ('run-a12','org-a12','snapshot-a12','owner-a12','drafting',1,'Template regression','{}');INSERT INTO transformation_cases(transformation_case_id,organization_id,context_snapshot_id,execution_run_id,initiated_by_user_id,mandate,status,lifecycle_stage,lineage_id,idempotency_key,version) VALUES ('case-a12','org-a12','snapshot-a12','run-a12','owner-a12','Template regression','plan_proposed','mandate','lineage-a12','case-a12',1);INSERT INTO v8_agent_run_identities(canonical_run_id,organization_id,transformation_case_id,lineage_id) VALUES ('run-a12','org-a12','case-a12','lineage-a12')`);
  const instantiated = await templates.instantiateAgentProcessTemplate({
    templateId: created.templateId,
    organizationId: 'org-a12',
    actorUserId: 'owner-a12',
    executionRunId: 'run-a12',
  });
  const bundleReadback = await pool.query(
    `SELECT g.runtime_bundle_json, g.runtime_bundle_digest, g.source_template_ref_json,
            v.runtime_bundle_digest AS version_digest
     FROM v8_agent_work_graphs g JOIN ai_playbook_template_versions v
       ON v.template_id = $1 AND v.version = 1 WHERE g.graph_id = $2`,
    [created.templateId, instantiated.graphId]
  );
  assert.equal(bundleReadback.rows[0].runtime_bundle_digest.length, 64);
  assert.equal(bundleReadback.rows[0].runtime_bundle_digest, bundleReadback.rows[0].version_digest);
  assert.deepEqual(
    JSON.parse(bundleReadback.rows[0].runtime_bundle_json),
    sourceGraph.runtimeBundle
  );
  assert.deepEqual(JSON.parse(bundleReadback.rows[0].source_template_ref_json), {
    templateId: created.templateId,
    version: 1,
  });
  const snapshot = await pool.query(
    `SELECT template_graph, status_at_version FROM ai_playbook_template_versions WHERE template_id = $1 AND version = 1`,
    [created.templateId]
  );
  assert.deepEqual(JSON.parse(snapshot.rows[0].template_graph), sourceGraph);
  assert.equal(snapshot.rows[0].status_at_version, 'PUBLISHED');
  const revisedGraph = {
    ...sourceGraph,
    tasks: [
      ...sourceGraph.tasks,
      {
        key: 'finance',
        specialistAgentId: 'sheets-finance-agent',
        title: 'Finance',
        objective: 'Prepare scenarios',
        dependsOn: ['research'],
        budget: { maxTokens: 4000 },
      },
    ],
  };
  const revised = await templates.reviseAgentProcessTemplate({
    templateId: created.templateId,
    organizationId: 'org-a12',
    actorUserId: 'owner-a12',
    graph: revisedGraph,
    reason: 'Add finance review',
  });
  assert.equal(revised.version, 2);
  const versionOneAfterRevision = await pool.query(
    `SELECT template_graph, status_at_version FROM ai_playbook_template_versions WHERE template_id = $1 AND version = 1`,
    [created.templateId]
  );
  assert.deepEqual(JSON.parse(versionOneAfterRevision.rows[0].template_graph), sourceGraph);
  assert.equal(versionOneAfterRevision.rows[0].status_at_version, 'PUBLISHED');
  await templates.transitionAgentProcessTemplate({
    templateId: created.templateId,
    organizationId: 'org-a12',
    actorUserId: 'owner-a12',
    action: 'publish',
    reason: 'Version 2 QA approved',
  });
  await templates.transitionAgentProcessTemplate({
    templateId: created.templateId,
    organizationId: 'org-a12',
    actorUserId: 'owner-a12',
    action: 'deprecate',
    reason: 'Superseded by transformation v3',
  });
  await assert.rejects(
    () =>
      templates.instantiateAgentProcessTemplate({
        templateId: created.templateId,
        organizationId: 'org-a12',
        actorUserId: 'owner-a12',
        executionRunId: 'run-after-deprecation',
      }),
    /published_agent_template_not_found/
  );
  assert.equal(
    await templates.listAgentProcessTemplates('org-foreign').then((rows) => rows.length),
    0
  );
  const events = await pool.query(
    `SELECT event_type FROM v8_agent_template_governance_events WHERE template_id = $1 ORDER BY created_at`,
    [created.templateId]
  );
  assert.deepEqual(
    events.rows.map((row) => row.event_type),
    ['created', 'published', 'instantiated', 'revised', 'published', 'deprecated']
  );
  console.log(
    JSON.stringify({
      proof: 'A12_REALDB_GREEN',
      templateId: created.templateId,
      publishedVersion: published.version,
      instantiatedGraphId: instantiated.graphId,
      immutableSnapshot: true,
      draftBlocked: true,
      tenantIsolation: true,
      revisionVersion: revised.version,
      versionOnePreserved: true,
      deprecatedInstantiationBlocked: true,
      runtimeBundlePinned: true,
      runtimeBundleDigestVerified: true,
      governanceEvents: 6,
    })
  );
}
main().finally(() => pool.end());
