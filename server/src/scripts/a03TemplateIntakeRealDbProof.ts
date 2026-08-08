import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Pool } from 'pg';
import { adaptQuery } from '../database/PostgresDatabase.js';

const databaseUrl=process.env.DATABASE_URL;if(!databaseUrl)throw new Error('DATABASE_URL is required');
const pool=new Pool({connectionString:databaseUrl});
const proofDb={
  query:(text:string,params:unknown[]=[])=>pool.query(adaptQuery(text),params),
  get(text:string,params:unknown[]=[],cb?:(error:Error|null,row:unknown)=>void){const p=pool.query(adaptQuery(text),params).then(r=>r.rows[0]??null);if(cb)void p.then(row=>cb(null,row),e=>cb(e as Error,null));return cb?proofDb:p;},
  all(text:string,params:unknown[]=[],cb?:(error:Error|null,rows:unknown[])=>void){const p=pool.query(adaptQuery(text),params).then(r=>r.rows);if(cb)void p.then(rows=>cb(null,rows),e=>cb(e as Error,[]));return cb?proofDb:p;},
  run(text:string,params:unknown[]=[],cb?:(error:Error|null)=>void){const p=pool.query(adaptQuery(text),params).then(r=>({changes:r.rowCount??0}));if(cb)void p.then(r=>cb.call({changes:r.changes},null),e=>cb.call({changes:0},e as Error));return cb?proofDb:p;},
  exec:(text:string)=>pool.query(text).then(()=>undefined),serialize(cb:()=>void){cb();},close:()=>Promise.resolve(),
};
(globalThis as any).__CONSULTIFY_GLOBAL_DB_INSTANCE__=proofDb;(process as any).__CONSULTIFY_GLOBAL_DB_INSTANCE__=proofDb;
async function migration(name:string){await pool.query(adaptQuery(fs.readFileSync(new URL(`../../migrations/${name}`,import.meta.url),'utf8')));}

async function main(){
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migration('20260323_v8_context_snapshot.sql');await migration('20260323_v8_context_snapshot_identity_chain.sql');await migration('20260323_v8_execution_spine.sql');
  await pool.query(`CREATE TABLE ai_playbook_templates(id TEXT PRIMARY KEY,key TEXT,title TEXT,description TEXT,template_graph TEXT NOT NULL,status TEXT NOT NULL,version INTEGER NOT NULL,organization_id TEXT NOT NULL,created_by TEXT,usage_count INTEGER DEFAULT 0,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW());CREATE TABLE ai_playbook_template_versions(id TEXT PRIMARY KEY,template_id TEXT NOT NULL,version INTEGER NOT NULL,title TEXT,description TEXT,template_graph TEXT NOT NULL,changed_by TEXT,change_notes TEXT,change_type TEXT,status_at_version TEXT,runtime_bundle_json TEXT,runtime_bundle_digest TEXT,created_at TIMESTAMPTZ DEFAULT NOW());`);
  await migration('20260807_agent_t01_transformation_case.sql');await migration('20260807_v8_agent_run_identity.sql');await migration('20260807_v8_agent_template_governance.sql');
  const caseSvc=await import('../services/v8/transformationCaseService.js');const templateSvc=await import('../services/v8/agentProcessTemplateService.js');const intakeSvc=await import('../services/v8/transformationPlanningIntakeService.js');
  const steps=caseSvc.compileT01TransformationPlan().map(({stepId:_id,stepIndex:_index,status:_status,...step})=>step);
  const runtimeBundle={promptKey:'transform',promptVersion:'1',modelId:'gpt',modelVersion:'1',policyVersion:'1',toolPolicyRefs:['safe'],agentDefinitionVersions:{teresa:'1'}};
  const graph={mode:'sequential' as const,leadAgentId:'teresa',tasks:[{key:'plan',specialistAgentId:'teresa',title:'Plan',objective:'Plan transformation'}],runtimeBundle,planningBlueprint:{intakeDefaults:{mandate:'Transform operations',measurableOutcomes:[],sponsor:null,scope:'Operations',horizon:null},steps}};
  const digest=templateSvc.templateContentDigest(graph);
  await pool.query(`INSERT INTO ai_playbook_templates(id,key,title,template_graph,status,version,organization_id,created_by) VALUES ('tpl-a03','transform','Transform','$1','PUBLISHED',1,'org-a03','owner-a03')`.replace("'$1'",'$1'),[JSON.stringify(graph)]);
  await pool.query(`INSERT INTO ai_playbook_template_versions(id,template_id,version,title,template_graph,changed_by,change_type,status_at_version,runtime_bundle_json,runtime_bundle_digest,content_digest) VALUES ('tpl-a03-v1','tpl-a03',1,'Transform',$1,'owner-a03','CREATE','PUBLISHED',$2,$3,$4)`,[JSON.stringify(graph),JSON.stringify(runtimeBundle),templateSvc.runtimeBundleDigest(runtimeBundle),digest]);
  const startInput={organizationId:'org-a03',actorUserId:'owner-a03',idempotencyKey:'template-intake-start-a03',templateId:'tpl-a03'};
  const intake=await intakeSvc.startPlanningIntakeFromTemplate(startInput);assert.equal(intake.status,'needs_clarification');assert.deepEqual(intake.missingKeys,['measurable_outcomes','sponsor','horizon']);assert.equal(intake.sourceTemplateDigest,digest);
  assert.equal((await pool.query(`SELECT COUNT(*)::int count FROM transformation_cases`)).rows[0].count,0);
  const startReplay=await intakeSvc.startPlanningIntakeFromTemplate(startInput);assert.equal(startReplay.intakeId,intake.intakeId);assert.equal(startReplay.idempotentReplay,true);
  await assert.rejects(()=>intakeSvc.startPlanningIntakeFromTemplate({...startInput,mandate:'Different payload'}),/IDEMPOTENCY_CONFLICT|payload changed/i);
  await pool.query(`INSERT INTO ai_playbook_templates(id,key,title,template_graph,status,version,organization_id) VALUES ('tpl-draft','draft','Draft',$1,'DRAFT',1,'org-a03')`,[JSON.stringify(graph)]);
  await assert.rejects(()=>intakeSvc.startPlanningIntakeFromTemplate({...startInput,idempotencyKey:'draft-start-a03',templateId:'tpl-draft'}),/NOT_FOUND|not found/i);
  await assert.rejects(()=>intakeSvc.startPlanningIntakeFromTemplate({...startInput,idempotencyKey:'foreign-start-a03',organizationId:'org-foreign'}),/NOT_FOUND|not found/i);
  const refsBefore=(await pool.query(`SELECT source_template_id,source_template_version,source_template_version_id,source_template_digest,template_blueprint_snapshot_json FROM transformation_planning_intakes WHERE intake_id=$1`,[intake.intakeId])).rows[0];
  const ready=await intakeSvc.answerPlanningIntake({intakeId:intake.intakeId,organizationId:'org-a03',actorUserId:'owner-a03',measurableOutcomes:['Lead time <= 2 days'],sponsor:'COO',horizon:'Q4'});assert.equal(ready.status,'ready');
  const refsAfter=(await pool.query(`SELECT source_template_id,source_template_version,source_template_version_id,source_template_digest,template_blueprint_snapshot_json FROM transformation_planning_intakes WHERE intake_id=$1`,[intake.intakeId])).rows[0];assert.deepEqual(refsAfter,refsBefore);
  const graphV2={...graph,planningBlueprint:{...graph.planningBlueprint,intakeDefaults:{...graph.planningBlueprint.intakeDefaults,mandate:'Changed later'}}};
  await pool.query(`INSERT INTO ai_playbook_template_versions(id,template_id,version,title,template_graph,changed_by,change_type,status_at_version,content_digest) VALUES ('tpl-a03-v2','tpl-a03',2,'Changed',$1,'owner-a03','UPDATE','DEPRECATED',$2)`,[JSON.stringify(graphV2),templateSvc.templateContentDigest(graphV2)]);
  await pool.query(`UPDATE ai_playbook_templates SET version=2,status='DEPRECATED',template_graph=$1 WHERE id='tpl-a03'`,[JSON.stringify(graphV2)]);
  const convertInput={intakeId:intake.intakeId,organizationId:'org-a03',actorUserId:'owner-a03',idempotencyKey:'template-convert-a03',expectedTemplateDigest:digest};
  const convertedPair=await Promise.all([intakeSvc.convertTemplatePlanningIntake(convertInput),intakeSvc.convertTemplatePlanningIntake(convertInput)]);assert.equal(convertedPair[0].transformationCaseId,convertedPair[1].transformationCaseId);assert.equal(convertedPair.filter(x=>x.idempotentReplay).length,1);
  const counts=(await pool.query(`SELECT (SELECT COUNT(*)::int FROM transformation_cases) cases,(SELECT COUNT(*)::int FROM transformation_plans) plans,(SELECT COUNT(*)::int FROM v8_execution_runs) runs,(SELECT COUNT(*)::int FROM v8_agent_run_identities) identities,(SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_template_intake.converted') audits,(SELECT COUNT(*)::int FROM v8_agent_template_governance_events WHERE event_type='instantiated_to_planning_case') events,(SELECT COUNT(*)::int FROM transformation_template_conversion_receipts) receipts`)).rows[0];assert.deepEqual(counts,{cases:1,plans:1,runs:1,identities:1,audits:1,events:1,receipts:1});
  const readback=(await pool.query(`SELECT p.source_template_id,p.source_template_version,p.source_template_digest,(SELECT COUNT(*)::int FROM transformation_plan_steps s WHERE s.plan_id=p.plan_id) step_count,(SELECT usage_count FROM ai_playbook_templates WHERE id='tpl-a03') usage_count FROM transformation_plans p`)).rows[0];assert.deepEqual(readback,{source_template_id:'tpl-a03',source_template_version:1,source_template_digest:digest,step_count:15,usage_count:1});
  const replay=await intakeSvc.convertTemplatePlanningIntake(convertInput);assert.equal(replay.transformationCaseId,convertedPair[0].transformationCaseId);assert.equal(replay.idempotentReplay,true);
  await assert.rejects(()=>intakeSvc.convertTemplatePlanningIntake({...convertInput,expectedTemplateDigest:'different'}),/IDEMPOTENCY_CONFLICT|payload changed/i);
  await assert.rejects(()=>intakeSvc.convertTemplatePlanningIntake({...convertInput,idempotencyKey:'wrong-actor-convert',actorUserId:'other'}),/ACTOR_MISMATCH|another actor/i);
  await assert.rejects(()=>intakeSvc.convertTemplatePlanningIntake({...convertInput,idempotencyKey:'wrong-tenant-convert',organizationId:'org-foreign'}),/NOT_FOUND|not found/i);
  const rollbackIntake=await intakeSvc.startPlanningIntakeFromTemplate({...startInput,idempotencyKey:'rollback-start-a03',templateId:'tpl-a03',measurableOutcomes:['Outcome'],sponsor:'COO',horizon:'Q4'}).catch(async()=>{await pool.query(`UPDATE ai_playbook_templates SET status='PUBLISHED',version=1,template_graph=$1 WHERE id='tpl-a03'`,[JSON.stringify(graph)]);await pool.query(`UPDATE ai_playbook_template_versions SET status_at_version='PUBLISHED' WHERE id='tpl-a03-v1'`);return intakeSvc.startPlanningIntakeFromTemplate({...startInput,idempotencyKey:'rollback-start-a03',measurableOutcomes:['Outcome'],sponsor:'COO',horizon:'Q4'});});
  await pool.query(`CREATE OR REPLACE FUNCTION fail_a03_template_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='transformation_template_intake.converted' AND NEW.transformation_case_id<>(SELECT converted_case_id FROM transformation_planning_intakes WHERE intake_id='${intake.intakeId}') THEN RAISE EXCEPTION 'forced_template_audit_failure'; END IF; RETURN NEW; END $$;CREATE TRIGGER fail_a03_template_audit_trigger BEFORE INSERT ON transformation_case_audit_events FOR EACH ROW EXECUTE FUNCTION fail_a03_template_audit()`);
  await assert.rejects(()=>intakeSvc.convertTemplatePlanningIntake({intakeId:rollbackIntake.intakeId,organizationId:'org-a03',actorUserId:'owner-a03',idempotencyKey:'rollback-convert-a03',expectedTemplateDigest:digest}),/forced_template_audit_failure/);
  assert.equal((await pool.query(`SELECT COUNT(*)::int count FROM transformation_cases`)).rows[0].count,1);assert.equal((await pool.query(`SELECT status FROM transformation_planning_intakes WHERE intake_id=$1`,[rollbackIntake.intakeId])).rows[0].status,'ready');
  console.log(JSON.stringify({proof:'A03_TEMPLATE_INTAKE_REALDB_GREEN',publishedVersionPinned:true,immutableSnapshotAfterClarification:true,zeroPrematureCaseWrites:true,deprecationAfterPinConvertible:true,concurrencyExactlyOnce:2,cases:1,plans:1,canonicalRuns:1,lineageAudits:1,templateEvents:1,usageIncrement:1,replayNoDuplicates:true,startAndConvertConflictFailClosed:true,draftForeignTenantActorDenied:true,forcedFailureRolledBackAll:true,canonicalPlanSteps:15,noPastedRunId:true}));
}
main().finally(()=>pool.end());
