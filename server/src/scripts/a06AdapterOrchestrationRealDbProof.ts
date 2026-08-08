import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { Pool } from 'pg';
import { adaptQuery } from '../database/PostgresDatabase.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });
const db = {
  all(sql: string, params: unknown[], cb: (error: Error | null, rows: unknown[]) => void) {
    void pool.query(adaptQuery(sql), params).then((r) => cb(null, r.rows), (error) => cb(error as Error, []));
  },
  get(sql: string, params: unknown[], cb: (error: Error | null, row: unknown) => void) {
    void pool.query(adaptQuery(sql), params).then((r) => cb(null, r.rows[0] ?? null), (error) => cb(error as Error, null));
  },
  run(sql: string, params: unknown[], cb: (error: Error | null) => void) {
    void pool.query(adaptQuery(sql), params).then(
      (r) => cb.call({ changes: r.rowCount ?? 0 }, null),
      (e) => cb.call({ changes: 0 }, e)
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
    CREATE TABLE organizations (id TEXT PRIMARY KEY);
    INSERT INTO organizations VALUES ('org-a06');
    CREATE TABLE projects (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL);
    CREATE TABLE project_members (
      project_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY(project_id,user_id)
    );
    INSERT INTO projects VALUES ('project-a06','org-a06');
    INSERT INTO project_members VALUES ('project-a06','user-a06');
    CREATE TABLE wave8_agent_definitions (
      agent_id TEXT PRIMARY KEY, organization_id TEXT, name TEXT NOT NULL, role TEXT NOT NULL,
      purpose TEXT NOT NULL, persona TEXT NOT NULL, allowed_tools_json TEXT NOT NULL DEFAULT '[]',
      blocked_tools_json TEXT NOT NULL DEFAULT '[]', source_scope_json TEXT NOT NULL DEFAULT '[]',
      output_schema_json TEXT NOT NULL DEFAULT '{}', approval_policy TEXT NOT NULL,
      cost_class TEXT NOT NULL, risk_level TEXT NOT NULL, examples_json TEXT NOT NULL DEFAULT '[]',
      editable INTEGER NOT NULL DEFAULT 1, updated_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE transformation_cases (
      transformation_case_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT,
      execution_run_id TEXT, lineage_id TEXT NOT NULL
    );
    CREATE TABLE v8_agent_run_identities (
      canonical_run_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL,
      transformation_case_id TEXT UNIQUE, conversation_id TEXT, lineage_id TEXT NOT NULL
    );
    INSERT INTO transformation_cases VALUES ('case-a06','org-a06','project-a06','run-a06','lineage-a06');
    INSERT INTO v8_agent_run_identities VALUES ('run-a06','org-a06','case-a06',NULL,'lineage-a06');
    CREATE TABLE my_ideas (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, title TEXT NOT NULL);
    CREATE TABLE interview_insights (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, title TEXT NOT NULL);
    CREATE TABLE assessments (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL);
    CREATE TABLE initiatives (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL);
    CREATE TABLE financial_analyses (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, title TEXT NOT NULL);
    CREATE TABLE initiative_kpis (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL);
    CREATE TABLE v8_tool_catalog (
      tool_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL,
      description TEXT NOT NULL, category TEXT NOT NULL, risk_class TEXT NOT NULL,
      mutation_type TEXT NOT NULL, classification_status TEXT NOT NULL,
      default_approval_mode TEXT NOT NULL, classified_by TEXT, classified_at TEXT,
      version TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE v8_consumer_tool_policies (
      policy_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT,
      consumer_class TEXT NOT NULL, tool_id TEXT NOT NULL, allowed INTEGER NOT NULL,
      approval_override TEXT NOT NULL, max_invocations_per_run INTEGER,
      effective_from TEXT NOT NULL, effective_until TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE wave8_agent_tool_governance_events (
      event_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL,
      agent_id TEXT NOT NULL, tool_id TEXT, tool_name TEXT NOT NULL, project_id TEXT,
      run_id TEXT, decision TEXT NOT NULL, reason TEXT NOT NULL, policy_ref TEXT,
      input_digest TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    adaptQuery(
      fs.readFileSync(
        new URL('../../migrations/20260807_v8_agent_adapter_orchestration.sql', import.meta.url),
        'utf8'
      )
    )
  );
  await pool.query(
    adaptQuery(
      fs.readFileSync(
        new URL('../../migrations/20260808_v8_agent_resource_governance.sql', import.meta.url),
        'utf8'
      )
    )
  );
  await pool.query(
    `INSERT INTO v8_agent_resource_policies
      (policy_id,organization_id,project_id,max_concurrent_executions,max_estimated_cost_usd_per_run)
     VALUES ('a06-resource-policy','org-a06','project-a06',20,100)`
  );
  const { dispatchAgentAdapter } =
    await import('../services/v8/agentAdapterOrchestratorService.js');
  const { loadTransformationAgentExecutionContext, TRANSFORMATION_AGENT_ID } =
    await import('../services/v8/transformationAgentExecutionContextService.js');
  const executionContext = await loadTransformationAgentExecutionContext({
    transformationCaseId: 'case-a06',
    organizationId: 'org-a06',
    actorUserId: 'user-a06',
  });
  assert.equal(executionContext.canonicalRunId, 'run-a06');
  assert.equal(executionContext.agentId, TRANSFORMATION_AGENT_ID);
  const catalogCount = await pool.query(
    `SELECT COUNT(*)::int count FROM v8_tool_catalog WHERE organization_id='org-a06' AND tool_id LIKE 'a06-t01:%'`
  );
  const policyCount = await pool.query(
    `SELECT COUNT(*)::int count FROM v8_consumer_tool_policies WHERE organization_id='org-a06' AND policy_id LIKE 'a06-t01-policy:%'`
  );
  assert.equal(catalogCount.rows[0].count, 17);
  assert.equal(policyCount.rows[0].count, 17);
  const specs = [
    [
      'transformation.ideas.materialize',
      'Ideas',
      'my_idea',
      'my_ideas',
      'idea-a06',
      'title',
      'Reduce lead time',
    ],
    [
      'transformation.interviews.materialize',
      'Interview',
      'interview_insight',
      'interview_insights',
      'insight-a06',
      'title',
      'Approval bottleneck',
    ],
    [
      'transformation.drd.materialize',
      'Assessments',
      'drd_assessment',
      'assessments',
      'assessment-a06',
      'name',
      'DRD baseline',
    ],
    [
      'transformation.initiative_candidate.materialize',
      'Initiatives',
      'initiative',
      'initiatives',
      'initiative-a06',
      'name',
      'Approval automation',
    ],
    [
      'transformation.finance_kpi.materialize',
      'Finance',
      'financial_analysis',
      'financial_analyses',
      'finance-a06',
      'title',
      'Initiative business case',
    ],
    [
      'transformation.gate.delivery_handoff.accept',
      'KPI',
      'initiative_kpi',
      'initiative_kpis',
      'kpi-a06',
      'name',
      'Approval lead time',
    ],
  ] as const;
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO v8_tool_catalog
     (tool_id,organization_id,name,description,category,risk_class,mutation_type,
      classification_status,default_approval_mode,version,created_at,updated_at)
     VALUES ('tool-denied','org-a06','denied.create','denied.create','artifact_write',
             'low_risk','bounded_write','under_review','auto_executable','1.0.0',$1,$1)`,
    [now]
  );
  const results = [];
  for (const [key, module, artifactType, table, id, column, value] of specs) {
    const adapter = {
      key,
      compensationPolicy: 'manual_repair' as const,
      execute: async () => {
        await pool.query(
          `INSERT INTO ${table} (id,organization_id,${column}) VALUES ($1,'org-a06',$2)`,
          [id, value]
        );
        return {
          artifactType,
          artifactId: id,
          module,
          operation: 'create',
          data: { [column]: value },
        };
      },
      readback: async (artifactId: string) =>
        (
          await pool.query(`SELECT * FROM ${table} WHERE id=$1 AND organization_id='org-a06'`, [
            artifactId,
          ])
        ).rows[0] ?? null,
    };
    results.push(
      await dispatchAgentAdapter({
        canonicalRunId: executionContext.canonicalRunId,
        organizationId: 'org-a06',
        transformationCaseId: 'case-a06',
        actorUserId: executionContext.actorUserId,
        agentId: executionContext.agentId,
        toolName: key,
        projectId: 'project-a06',
        idempotencyKey: `${key}-v1`,
        payload: { [column]: value },
        adapter,
      })
    );
  }
  assert.equal(results.length, 6);
  assert.ok(results.every((result) => result.status === 'succeeded' && result.readbackDigest));
  const replayAdapter = {
    key: 'transformation.ideas.materialize',
    compensationPolicy: 'manual_repair' as const,
    execute: async () => {
      throw new Error('must_not_execute');
    },
    readback: async (artifactId: string) =>
      (
        await pool.query(`SELECT * FROM my_ideas WHERE id=$1 AND organization_id='org-a06'`, [
          artifactId,
        ])
      ).rows[0] ?? null,
  };
  const replay = await dispatchAgentAdapter({
    canonicalRunId: 'run-a06',
    organizationId: 'org-a06',
    transformationCaseId: 'case-a06',
    actorUserId: 'user-a06',
    agentId: executionContext.agentId,
    toolName: 'transformation.ideas.materialize',
    projectId: 'project-a06',
    idempotencyKey: 'transformation.ideas.materialize-v1',
    payload: { title: 'Reduce lead time' },
    adapter: replayAdapter,
  });
  assert.equal(replay.idempotentReplay, true);
  await pool.query(`UPDATE my_ideas SET title='Drifted title' WHERE id='idea-a06'`);
  await assert.rejects(
    dispatchAgentAdapter({
      canonicalRunId: 'run-a06',
      organizationId: 'org-a06',
      transformationCaseId: 'case-a06',
      actorUserId: 'user-a06',
      agentId: executionContext.agentId,
      toolName: 'transformation.ideas.materialize',
      projectId: 'project-a06',
      idempotencyKey: 'transformation.ideas.materialize-v1',
      payload: { title: 'Reduce lead time' },
      adapter: replayAdapter,
    }),
    /adapter_replay_readback_drift/
  );
  await pool.query(
    `INSERT INTO v8_agent_adapter_invocations
      (invocation_id,canonical_run_id,organization_id,transformation_case_id,adapter_key,
       idempotency_key,input_digest,status,compensation_policy,attempt_count,created_at)
     VALUES ('inv-stale-a06','run-a06','org-a06','case-a06',
       'transformation.gate.sustainability_review.accept','stale-gate-v1',
       $1,'running','manual_repair',1,'2020-01-01T00:00:00.000Z')`,
    [createHash('sha256').update('{"decision":"close"}').digest('hex')]
  );
  const staleRecovery = await dispatchAgentAdapter({
    canonicalRunId: 'run-a06',
    organizationId: 'org-a06',
    transformationCaseId: 'case-a06',
    actorUserId: 'user-a06',
    agentId: executionContext.agentId,
    toolName: 'transformation.gate.sustainability_review.accept',
    projectId: 'project-a06',
    idempotencyKey: 'stale-gate-v1',
    payload: { decision: 'close' },
    staleRunningAfterMs: 1,
    adapter: {
      key: 'transformation.gate.sustainability_review.accept',
      compensationPolicy: 'manual_repair',
      execute: async () => {
        await pool.query(
          `INSERT INTO assessments (id,organization_id,name) VALUES ('stale-receipt-a06','org-a06','Sustainability receipt')`
        );
        return {
          artifactType: 'transformation_gate_receipt',
          artifactId: 'stale-receipt-a06',
          module: 'Transformation Case',
          operation: 'accept',
          data: { gate: 'sustainability_review' },
        };
      },
      readback: async (artifactId: string) =>
        (await pool.query(`SELECT * FROM assessments WHERE id=$1`, [artifactId])).rows[0] ?? null,
    },
  });
  assert.equal(staleRecovery.invocationId, 'inv-stale-a06');
  let deniedExecuted = false;
  await assert.rejects(
    dispatchAgentAdapter({
      canonicalRunId: 'run-a06',
      organizationId: 'org-a06',
      transformationCaseId: 'case-a06',
      actorUserId: 'user-a06',
      agentId: 'transformation-agent',
      toolName: 'denied.create',
      projectId: 'project-a06',
      idempotencyKey: 'denied-v1',
      payload: { title: 'Must not execute' },
      adapter: {
        key: 'denied.create',
        compensationPolicy: 'manual_repair',
        execute: async () => {
          deniedExecuted = true;
          throw new Error('must_not_execute');
        },
        readback: async () => null,
      },
    }),
    /adapter_governance_denied:tool_not_ratified/
  );
  assert.equal(deniedExecuted, false);
  const ledger = await pool.query(
    `SELECT adapter_key,status,canonical_artifact_id,readback_digest FROM v8_agent_adapter_invocations ORDER BY created_at`
  );
  assert.equal(ledger.rows.length, 7);
  assert.equal(ledger.rows.filter((row) => row.status === 'succeeded').length, 6);
  assert.equal(ledger.rows.filter((row) => row.status === 'compensation_required').length, 1);
  const governance = await pool.query(
    `SELECT decision,reason,tool_name FROM wave8_agent_tool_governance_events
     WHERE organization_id='org-a06' AND run_id='run-a06' ORDER BY created_at`
  );
  assert.equal(governance.rows.filter((row) => row.decision === 'allowed').length, 9);
  assert.deepEqual(
    governance.rows.filter((row) => row.decision === 'denied'),
    [{ decision: 'denied', reason: 'tool_not_ratified', tool_name: 'denied.create' }]
  );
  console.log(
    JSON.stringify({
      proof: 'A06_REALDB_GREEN',
      canonicalRunId: 'run-a06',
      owningAdapters: 6,
      normalizedResults: 6,
      canonicalReadbacks: 6,
      idempotentReplay: true,
      centralGovernanceAllowed: 9,
      centralGovernanceDenied: 1,
      deniedAdapterExecuted: false,
      modules: specs.map((spec) => spec[1]),
      t01ToolDefinitions: catalogCount.rows[0].count,
      t01ExecutionPolicies: policyCount.rows[0].count,
      canonicalContextFailClosed: true,
      replayCanonicalReadback: true,
      replayDriftCompensationRequired: true,
      staleRunningRecovered: staleRecovery.invocationId === 'inv-stale-a06',
    })
  );
}

main().finally(() => pool.end());
