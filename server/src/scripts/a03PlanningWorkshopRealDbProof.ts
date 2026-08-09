import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { adaptQuery } from '../database/PostgresDatabase.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });
const db = {
  all(sql: string, params: unknown[], cb: (error: Error | null, rows: unknown[]) => void) {
    void pool.query(adaptQuery(sql), params).then(
      (result) => cb(null, result.rows),
      (error) => cb(error as Error, [])
    );
  },
  get(sql: string, params: unknown[], cb: (error: Error | null, row: unknown) => void) {
    void pool.query(adaptQuery(sql), params).then(
      (result) => cb(null, result.rows[0] ?? null),
      (error) => cb(error as Error, null)
    );
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
    CREATE TABLE transformation_cases (
      transformation_case_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT,
      conversation_id TEXT, context_snapshot_id TEXT NOT NULL, execution_run_id TEXT,
      initiated_by_user_id TEXT NOT NULL, mandate TEXT NOT NULL, desired_outcomes_json JSONB DEFAULT '[]',
      status TEXT NOT NULL, lifecycle_stage TEXT NOT NULL, autonomy_level TEXT DEFAULT 'A1_prepare',
      source_refs_json JSONB DEFAULT '[]', assumptions_json JSONB DEFAULT '[]', missing_inputs_json JSONB DEFAULT '[]',
      active_plan_id TEXT, lineage_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, version INTEGER NOT NULL,
      created_at TEXT, updated_at TEXT, cancelled_at TEXT
    );
    CREATE TABLE transformation_plans (
      plan_id TEXT PRIMARY KEY, transformation_case_id TEXT NOT NULL, organization_id TEXT NOT NULL,
      version INTEGER NOT NULL, status TEXT NOT NULL, methodology_key TEXT DEFAULT 'consultify-transformation-v1',
      summary TEXT NOT NULL, assumptions_json JSONB DEFAULT '[]', risks_json JSONB DEFAULT '[]',
      created_by_user_id TEXT NOT NULL, created_at TEXT, updated_at TEXT,
      UNIQUE(transformation_case_id, version)
    );
    CREATE TABLE transformation_plan_steps (
      step_id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, transformation_case_id TEXT NOT NULL,
      organization_id TEXT NOT NULL, step_index INTEGER NOT NULL, lifecycle_stage TEXT NOT NULL,
      business_purpose TEXT NOT NULL, module_target TEXT NOT NULL, capability_status TEXT NOT NULL,
      inputs_json JSONB DEFAULT '[]', outputs_json JSONB DEFAULT '[]', owner_role TEXT NOT NULL,
      depends_on_json JSONB DEFAULT '[]', approval_class TEXT NOT NULL, risk_class TEXT NOT NULL,
      execution_mode TEXT NOT NULL, estimated_effort TEXT NOT NULL, status TEXT NOT NULL,
      blocker_reason TEXT, created_at TEXT, UNIQUE(plan_id, step_index)
    );
    CREATE TABLE transformation_case_audit_events (
      audit_event_id TEXT PRIMARY KEY, transformation_case_id TEXT NOT NULL, organization_id TEXT NOT NULL,
      plan_id TEXT, plan_version INTEGER, event_type TEXT, actor_user_id TEXT, correlation_id TEXT,
      payload_digest TEXT, detail_json JSONB, created_at TEXT
    );
    CREATE TABLE v8_execution_runs (
      run_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, plan_version INTEGER NOT NULL, updated_at TEXT
    );
  `);
  await pool.query(`
    INSERT INTO v8_execution_runs VALUES ('run-a03','org-a03',1,'2026-08-07T20:00:00Z');
    INSERT INTO transformation_cases VALUES (
      'case-a03','org-a03',NULL,NULL,'snapshot-a03','run-a03','owner-a03','Transform operations','[]',
      'plan_proposed','mandate','A1_prepare','[]','[]','[]','plan-a03-v1','lineage-a03','idem-a03',1,
      '2026-08-07T20:00:00Z','2026-08-07T20:00:00Z',NULL
    );
    INSERT INTO transformation_plans VALUES (
      'plan-a03-v1','case-a03','org-a03',1,'pending_review','consultify-transformation-v1','Initial plan','[]','[]',
      'owner-a03','2026-08-07T20:00:00Z','2026-08-07T20:00:00Z'
    );
  `);
  const { compileT01TransformationPlan, reviseTransformationCase } =
    await import('../services/v8/transformationCaseService.js');
  const initial = compileT01TransformationPlan();
  for (const step of initial) {
    await pool.query(`INSERT INTO transformation_plan_steps
      (step_id,plan_id,transformation_case_id,organization_id,step_index,lifecycle_stage,business_purpose,module_target,capability_status,inputs_json,outputs_json,owner_role,depends_on_json,approval_class,risk_class,execution_mode,estimated_effort,status,blocker_reason,created_at)
      VALUES ($1,'plan-a03-v1','case-a03','org-a03',$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10::jsonb,$11,$12,$13,$14,'proposed',$15,'2026-08-07T20:00:00Z')`,
      [step.stepId,step.stepIndex,step.lifecycleStage,step.businessPurpose,step.moduleTarget,step.capabilityStatus,JSON.stringify(step.inputs),JSON.stringify(step.outputs),step.ownerRole,JSON.stringify(step.dependsOn),step.approvalClass,step.riskClass,step.executionMode,step.estimatedEffort,step.blockerReason]);
  }
  const draft = initial.map(({ stepId, stepIndex: _index, status: _status, ...step }) => ({...step,sourceStepId:stepId}));
  draft[0]={...draft[0],businessPurpose:'Confirm mandate and measurable outcomes.',moduleTarget:'Chat / Agent Hub',inputs:['mandate','scope'],outputs:['reviewed plan'],ownerRole:'Transformation Sponsor',approvalClass:'policy_approvable',riskClass:'read_only',executionMode:'foreground',estimatedEffort:'2 h'};
  const custom={...draft[0],sourceStepId:undefined,lifecycleStage:'custom_change_readiness',businessPurpose:'Assess change readiness.',moduleTarget:'Agent',capabilityStatus:'PROPOSAL_ONLY' as const,inputs:['stakeholder map'],outputs:['readiness notes'],ownerRole:'Change Lead',dependsOn:['discovery'],approvalClass:'requires_human_approval' as const,riskClass:'safe_additive' as const,executionMode:'human_activity' as const,estimatedEffort:'4 h',blockerReason:'No verified runtime capability binding.'};
  const reordered = [draft[0], draft[2], draft[1], ...draft.slice(3), custom];
  const reviseInput = {
    transformationCaseId: 'case-a03',
    organizationId: 'org-a03',
    actorUserId: 'owner-a03',
    expectedVersion: 1,
    steps: reordered,
    correlationId: 'proof-a03',
  };
  const concurrent=await Promise.allSettled([reviseTransformationCase(reviseInput),reviseTransformationCase(reviseInput)]);
  assert.equal(concurrent.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(concurrent.filter(result=>result.status==='rejected' && /VERSION_CONFLICT|version/i.test(String(result.reason))).length,1);
  const revised=(concurrent.find(result=>result.status==='fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof reviseTransformationCase>>>).value;
  assert.equal(revised.version, 2);
  assert.deepEqual(
    revised.activePlan?.steps.map((step) => step.lifecycleStage),
    reordered.map((step) => step.lifecycleStage)
  );
  assert.equal(revised.activePlan?.status, 'pending_review');
  assert.equal(revised.activePlan?.steps[0].businessPurpose,'Confirm mandate and measurable outcomes.');
  assert.equal(revised.activePlan?.steps.at(-1)?.capabilityStatus,'PROPOSAL_ONLY');
  const revisedDraft=(revised.activePlan?.steps ?? []).map(({stepId,stepIndex:_index,status:_status,...step})=>({...step,sourceStepId:stepId}));
  const beforeRejected=await pool.query(`SELECT (SELECT COUNT(*)::int FROM transformation_plans) plans,(SELECT COUNT(*)::int FROM transformation_case_audit_events) audits,(SELECT version FROM transformation_cases WHERE transformation_case_id='case-a03') version`);
  await assert.rejects(()=>reviseTransformationCase({...reviseInput,expectedVersion:2,steps:revisedDraft.map((step,index)=>index===0?{...step,capabilityStatus:'REAL' as const}:step)}),/CAPABILITY_TRUTH|server-owned/);
  await assert.rejects(()=>reviseTransformationCase({...reviseInput,expectedVersion:2,steps:revisedDraft.map((step,index)=>index===0?{...step,lifecycleStage:'custom_forged'}:step)}),/CAPABILITY_TRUTH|server-owned/);
  const cyclic=revisedDraft.map(step=>({...step}));cyclic[0]={...cyclic[0],dependsOn:[cyclic[1].lifecycleStage]};cyclic[1]={...cyclic[1],dependsOn:[cyclic[0].lifecycleStage]};
  await assert.rejects(()=>reviseTransformationCase({...reviseInput,expectedVersion:2,steps:cyclic}),/cycle/i);
  await assert.rejects(()=>reviseTransformationCase({...reviseInput,organizationId:'org-foreign',expectedVersion:2}),/NOT_FOUND|not found/i);
  await assert.rejects(()=>reviseTransformationCase({...reviseInput,actorUserId:'',expectedVersion:2}),/ACTOR_REQUIRED|actor/i);
  await pool.query(`CREATE OR REPLACE FUNCTION fail_a03_step_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.business_purpose='FORCE_ROLLBACK' THEN RAISE EXCEPTION 'forced_a03_step_failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_a03_step_insert_trigger BEFORE INSERT ON transformation_plan_steps FOR EACH ROW EXECUTE FUNCTION fail_a03_step_insert()`);
  await assert.rejects(()=>reviseTransformationCase({...reviseInput,expectedVersion:2,steps:revisedDraft.map((step,index)=>index===0?{...step,businessPurpose:'FORCE_ROLLBACK'}:step)}),/forced_a03_step_failure/);
  await pool.query(`DROP TRIGGER fail_a03_step_insert_trigger ON transformation_plan_steps; DROP FUNCTION fail_a03_step_insert()`);
  const afterRejected=await pool.query(`SELECT (SELECT COUNT(*)::int FROM transformation_plans) plans,(SELECT COUNT(*)::int FROM transformation_case_audit_events) audits,(SELECT version FROM transformation_cases WHERE transformation_case_id='case-a03') version`);
  assert.deepEqual(afterRejected.rows[0],beforeRejected.rows[0]);
  const removed=await reviseTransformationCase({...reviseInput,expectedVersion:2,steps:revisedDraft.filter(step=>step.lifecycleStage!=='custom_change_readiness'),correlationId:'proof-a03-remove'});
  assert.equal(removed.version,3);assert.equal(removed.activePlan?.steps.some(step=>step.lifecycleStage==='custom_change_readiness'),false);
  const ledger = await pool.query(
    `SELECT plan_version FROM v8_execution_runs WHERE run_id='run-a03'`
  );
  const audit = await pool.query(
    `SELECT event_type, plan_version FROM transformation_case_audit_events`
  );
  assert.equal(ledger.rows[0].plan_version, 3);
  assert.deepEqual(audit.rows.map(row=>row.plan_version),[2,3]);
  console.log(
    JSON.stringify({
      proof: 'A03_REALDB_GREEN',
      reorderedPersisted: true,
      graphValidatedBeforeWrite: true,
      version: 3,
      approvalReset: true,
      canonicalRunPlanVersion: 3,
      audit: true,
      richFieldsPersisted: true,
      safeCustomStepAddedAndRemoved: true,
      authoritativeCapabilityTruth: true,
      concurrencyExactlyOne: true,
      rejectedGraphAndInsertRollback: true,
      tenantAndActorFailClosed: true,
    })
  );
}

main().finally(() => pool.end());
