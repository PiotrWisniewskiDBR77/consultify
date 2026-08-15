import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'node:crypto';
import { queryOne, queryRun, withPgTransaction } from '../../utils/queryHelpers.js';
import { createTransformationCase, TransformationCaseOperationError, validateAndCompileTransformationPlan } from './transformationCaseService.js';
import { canonicalJson, templateContentDigest } from './agentProcessTemplateService.js';
import type { AgentPlanningBlueprint, AgentProcessTemplateGraph } from './agentProcessTemplateService.js';

export type PlanningIntakeMissingKey = 'measurable_outcomes' | 'sponsor' | 'scope' | 'horizon';
export interface TransformationPlanningIntake {
  intakeId: string;
  organizationId: string;
  projectId: string | null;
  conversationId: string | null;
  initiatedByUserId: string;
  status: 'needs_clarification' | 'ready' | 'converted';
  mandate: string;
  measurableOutcomes: string[];
  sponsor: string | null;
  scope: string | null;
  horizon: string | null;
  missingKeys: PlanningIntakeMissingKey[];
  convertedCaseId: string | null;
  sourceTemplateId: string | null;
  sourceTemplateVersion: number | null;
  sourceTemplateDigest: string | null;
  idempotentReplay: boolean;
}

interface IntakeRow {
  intake_id: string; organization_id: string; project_id: string | null; conversation_id: string | null;
  initiated_by_user_id: string; status: TransformationPlanningIntake['status']; mandate: string;
  measurable_outcomes_json: unknown; sponsor: string | null; scope: string | null; horizon: string | null;
  missing_keys_json: unknown; converted_case_id: string | null;
  input_digest?: string | null; source_template_id?: string | null; source_template_version?: number | null;
  source_template_version_id?: string | null; source_template_digest?: string | null;
  template_blueprint_snapshot_json?: unknown;
}
const json = <T>(value: unknown, fallback: T): T => typeof value === 'string' ? JSON.parse(value) : ((value ?? fallback) as T);
const clean = (value: unknown): string | null => String(value ?? '').trim() || null;
export const planningMissingKeys = (input: { measurableOutcomes?: string[]; sponsor?: string | null; scope?: string | null; horizon?: string | null }): PlanningIntakeMissingKey[] => [
  ...((input.measurableOutcomes ?? []).map((item) => item.trim()).filter(Boolean).length ? [] : ['measurable_outcomes'] as const),
  ...(clean(input.sponsor) ? [] : ['sponsor'] as const),
  ...(clean(input.scope) ? [] : ['scope'] as const),
  ...(clean(input.horizon) ? [] : ['horizon'] as const),
];
const map = (row: IntakeRow, replay = false): TransformationPlanningIntake => ({
  intakeId: row.intake_id, organizationId: row.organization_id, projectId: row.project_id,
  conversationId: row.conversation_id, initiatedByUserId: row.initiated_by_user_id, status: row.status,
  mandate: row.mandate, measurableOutcomes: json<string[]>(row.measurable_outcomes_json, []), sponsor: row.sponsor,
  scope: row.scope, horizon: row.horizon, missingKeys: json<PlanningIntakeMissingKey[]>(row.missing_keys_json, []),
  convertedCaseId: row.converted_case_id, sourceTemplateId:row.source_template_id ?? null,
  sourceTemplateVersion:row.source_template_version ?? null,sourceTemplateDigest:row.source_template_digest ?? null,
  idempotentReplay: replay,
});
async function owned(intakeId: string, organizationId: string, actorUserId: string) {
  const row = await queryOne<IntakeRow>(`SELECT * FROM transformation_planning_intakes WHERE intake_id=? AND organization_id=?`, [intakeId, organizationId]);
  if (!row) throw new TransformationCaseOperationError('TRANSFORMATION_PLANNING_INTAKE_NOT_FOUND', 404, 'Planning intake not found');
  if (row.initiated_by_user_id !== actorUserId) throw new TransformationCaseOperationError('TRANSFORMATION_PLANNING_INTAKE_ACTOR_MISMATCH', 403, 'Planning intake belongs to another actor');
  return row;
}
export async function startPlanningIntake(input: { organizationId: string; actorUserId: string; idempotencyKey: string; mandate: string; projectId?: string | null; conversationId?: string | null; measurableOutcomes?: string[]; sponsor?: string | null; scope?: string | null; horizon?: string | null }) {
  const mandate = clean(input.mandate);
  if (!mandate) throw new TransformationCaseOperationError('TRANSFORMATION_PLANNING_MANDATE_REQUIRED', 400, 'Mandate is required');
  const outcomes = (input.measurableOutcomes ?? []).map((x) => x.trim()).filter(Boolean);
  const missing = planningMissingKeys({ ...input, measurableOutcomes: outcomes });
  const payload = { mandate, projectId: input.projectId ?? null, conversationId: input.conversationId ?? null, measurableOutcomes: outcomes, sponsor: clean(input.sponsor), scope: clean(input.scope), horizon: clean(input.horizon) };
  const inputDigest = digestOf(payload);
  return withPgTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [`${input.organizationId}:planning-intake:${input.idempotencyKey}`]);
    const existing = (await client.query<IntakeRow>(`SELECT * FROM transformation_planning_intakes WHERE organization_id=? AND idempotency_key=? FOR UPDATE`, [input.organizationId, input.idempotencyKey])).rows[0];
    if (existing) {
      if (existing.initiated_by_user_id !== input.actorUserId) throw new TransformationCaseOperationError('TRANSFORMATION_PLANNING_INTAKE_ACTOR_MISMATCH', 403, 'Idempotency key belongs to another actor');
      if (existing.input_digest && existing.input_digest !== inputDigest) throw new TransformationCaseOperationError('TRANSFORMATION_PLANNING_INTAKE_IDEMPOTENCY_CONFLICT', 409, 'Idempotency payload changed');
      return map(existing, true);
    }
    const id = uuidv4();
    await client.query(`INSERT INTO transformation_planning_intakes (intake_id,organization_id,project_id,conversation_id,initiated_by_user_id,idempotency_key,input_digest,status,mandate,measurable_outcomes_json,sponsor,scope,horizon,missing_keys_json) VALUES (?,?,?,?,?,?,?,?,?,?::jsonb,?,?,?,?::jsonb)`, [id,input.organizationId,payload.projectId,payload.conversationId,input.actorUserId,input.idempotencyKey,inputDigest,missing.length?'needs_clarification':'ready',mandate,JSON.stringify(outcomes),payload.sponsor,payload.scope,payload.horizon,JSON.stringify(missing)]);
    return map((await client.query<IntakeRow>(`SELECT * FROM transformation_planning_intakes WHERE intake_id=?`, [id])).rows[0]);
  });
}

export async function getActivePlanningIntake(input: { organizationId: string; actorUserId: string; conversationId: string }) {
  const row = await queryOne<IntakeRow>(`SELECT * FROM transformation_planning_intakes WHERE organization_id=? AND initiated_by_user_id=? AND conversation_id=? AND status IN ('needs_clarification','ready') ORDER BY updated_at DESC, created_at DESC LIMIT 1`, [input.organizationId, input.actorUserId, input.conversationId]);
  return row ? map(row) : null;
}
export async function answerPlanningIntake(input: { intakeId: string; organizationId: string; actorUserId: string; measurableOutcomes?: string[]; sponsor?: string | null; scope?: string | null; horizon?: string | null }) {
  const current = await owned(input.intakeId,input.organizationId,input.actorUserId);
  if (current.status === 'converted') return map(current,true);
  const outcomes = input.measurableOutcomes ?? json<string[]>(current.measurable_outcomes_json, []);
  const sponsor = clean(input.sponsor) ?? current.sponsor; const scope = clean(input.scope) ?? current.scope; const horizon = clean(input.horizon) ?? current.horizon;
  const missing = planningMissingKeys({measurableOutcomes:outcomes,sponsor,scope,horizon});
  await queryRun(`UPDATE transformation_planning_intakes SET measurable_outcomes_json=?::jsonb,sponsor=?,scope=?,horizon=?,missing_keys_json=?::jsonb,status=?,updated_at=? WHERE intake_id=? AND organization_id=? AND initiated_by_user_id=?`,[JSON.stringify(outcomes),sponsor,scope,horizon,JSON.stringify(missing),missing.length?'needs_clarification':'ready',new Date().toISOString(),input.intakeId,input.organizationId,input.actorUserId]);
  return map((await owned(input.intakeId,input.organizationId,input.actorUserId)));
}
export async function convertPlanningIntake(input: { intakeId: string; organizationId: string; actorUserId: string }) {
  return withPgTransaction(async(client)=>{
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?))`,[`${input.organizationId}:planning-convert:${input.intakeId}`]);
    const current=(await client.query<IntakeRow>(`SELECT * FROM transformation_planning_intakes WHERE intake_id=? AND organization_id=? FOR UPDATE`,[input.intakeId,input.organizationId])).rows[0];
    if(!current)throw new TransformationCaseOperationError('TRANSFORMATION_PLANNING_INTAKE_NOT_FOUND',404,'Planning intake not found');
    if(current.initiated_by_user_id!==input.actorUserId)throw new TransformationCaseOperationError('TRANSFORMATION_PLANNING_INTAKE_ACTOR_MISMATCH',403,'Planning intake belongs to another actor');
    if(current.status==='converted'&&current.converted_case_id)return{intake:map(current,true),transformationCaseId:current.converted_case_id};
    if(current.status!=='ready')throw new TransformationCaseOperationError('TRANSFORMATION_PLANNING_CLARIFICATION_REQUIRED',409,`Missing: ${json<string[]>(current.missing_keys_json,[]).join(',')}`);
    const transformationCase=await createTransformationCase({organizationId:input.organizationId,initiatedByUserId:input.actorUserId,idempotencyKey:`planning-intake:${current.intake_id}`,mandate:current.mandate,projectId:current.project_id,conversationId:current.conversation_id,desiredOutcomes:json<string[]>(current.measurable_outcomes_json,[]),assumptions:[`Sponsor: ${current.sponsor}`,`Scope: ${current.scope}`,`Horizon: ${current.horizon}`],missingInputs:[],sourceRefs:[{artifactId:current.intake_id,artifactType:'transformation_planning_intake',module:'Agent'}]});
    await client.query(`UPDATE transformation_planning_intakes SET status='converted',converted_case_id=?,updated_at=? WHERE intake_id=? AND organization_id=? AND initiated_by_user_id=? AND status='ready'`,[transformationCase.transformationCaseId,new Date().toISOString(),current.intake_id,input.organizationId,input.actorUserId]);
    await client.query(`INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,payload_digest,detail_json,created_at) SELECT ?,c.transformation_case_id,c.organization_id,c.active_plan_id,1,'transformation_planning_intake.converted',?,?,?::jsonb,? FROM transformation_cases c WHERE c.transformation_case_id=?`,[uuidv4(),input.actorUserId,current.intake_id,JSON.stringify({intakeId:current.intake_id}),new Date().toISOString(),transformationCase.transformationCaseId]);
    const converted=(await client.query<IntakeRow>(`SELECT * FROM transformation_planning_intakes WHERE intake_id=? AND organization_id=?`,[current.intake_id,input.organizationId])).rows[0];
    return{intake:map(converted),transformationCaseId:transformationCase.transformationCaseId};
  });
}

const digestOf = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function startPlanningIntakeFromTemplate(input:{
  organizationId:string;actorUserId:string;idempotencyKey:string;templateId:string;
  projectId?:string|null;conversationId?:string|null;
  mandate?:string;measurableOutcomes?:string[];sponsor?:string|null;scope?:string|null;horizon?:string|null;
}) {
  if(!input.organizationId.trim()||!input.actorUserId.trim())throw new TransformationCaseOperationError('TRANSFORMATION_PLANNING_INTAKE_IDENTITY_REQUIRED',403,'Tenant and actor are required');
  const payload={templateId:input.templateId,projectId:input.projectId??null,conversationId:input.conversationId??null,mandate:clean(input.mandate),measurableOutcomes:(input.measurableOutcomes??[]).map(x=>x.trim()).filter(Boolean),sponsor:clean(input.sponsor),scope:clean(input.scope),horizon:clean(input.horizon)};
  const inputDigest=digestOf(payload);
  const intakeId=uuidv4();
  const result=await withPgTransaction(async(client)=>{
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?))`,[`${input.organizationId}:template-intake:${input.idempotencyKey}`]);
    const replay=(await client.query<IntakeRow>(`SELECT * FROM transformation_planning_intakes WHERE organization_id=? AND idempotency_key=? FOR UPDATE`,[input.organizationId,input.idempotencyKey])).rows[0];
    if(replay){if(replay.initiated_by_user_id!==input.actorUserId)throw new TransformationCaseOperationError('TRANSFORMATION_PLANNING_INTAKE_ACTOR_MISMATCH',403,'Idempotency key belongs to another actor');if(replay.input_digest!==inputDigest)throw new TransformationCaseOperationError('TRANSFORMATION_PLANNING_INTAKE_IDEMPOTENCY_CONFLICT',409,'Idempotency payload changed');return map(replay,true);}
    const template=(await client.query<any>(`SELECT * FROM ai_playbook_templates WHERE id=? AND organization_id=? AND status='PUBLISHED' FOR UPDATE`,[input.templateId,input.organizationId])).rows[0];
    if(!template)throw new TransformationCaseOperationError('PUBLISHED_PLANNING_TEMPLATE_NOT_FOUND',404,'Published planning template not found');
    const version=(await client.query<any>(`SELECT * FROM ai_playbook_template_versions WHERE template_id=? AND version=? AND status_at_version='PUBLISHED' FOR UPDATE`,[input.templateId,template.version])).rows[0];
    if(!version)throw new TransformationCaseOperationError('PUBLISHED_PLANNING_TEMPLATE_VERSION_NOT_FOUND',404,'Published planning template version not found');
    const graph=JSON.parse(version.template_graph) as AgentProcessTemplateGraph;
    if(!graph.planningBlueprint)throw new TransformationCaseOperationError('PLANNING_TEMPLATE_BLUEPRINT_REQUIRED',409,'Template has no planning blueprint');
    validateAndCompileTransformationPlan(graph.planningBlueprint.steps);
    const contentDigest=templateContentDigest(graph);
    if(version.content_digest!==contentDigest)throw new TransformationCaseOperationError('AGENT_TEMPLATE_CONTENT_DIGEST_MISMATCH',409,'Template content digest mismatch');
    const defaults=graph.planningBlueprint.intakeDefaults;
    const mandate=payload.mandate??clean(defaults.mandate);
    if(!mandate)throw new TransformationCaseOperationError('TRANSFORMATION_PLANNING_MANDATE_REQUIRED',400,'Mandate is required');
    const outcomes=payload.measurableOutcomes.length?payload.measurableOutcomes:(defaults.measurableOutcomes??[]).map(x=>x.trim()).filter(Boolean);
    const sponsor=payload.sponsor??clean(defaults.sponsor);const scope=payload.scope??clean(defaults.scope);const horizon=payload.horizon??clean(defaults.horizon);
    const missing=planningMissingKeys({measurableOutcomes:outcomes,sponsor,scope,horizon});
    await client.query(`INSERT INTO transformation_planning_intakes (intake_id,organization_id,project_id,conversation_id,initiated_by_user_id,idempotency_key,input_digest,status,mandate,measurable_outcomes_json,sponsor,scope,horizon,missing_keys_json,source_template_id,source_template_version,source_template_version_id,source_template_digest,template_blueprint_snapshot_json) VALUES (?,?,?,?,?,?,?,?,?,?::jsonb,?,?,?,?::jsonb,?,?,?,?,?::jsonb)`,[intakeId,input.organizationId,payload.projectId,payload.conversationId,input.actorUserId,input.idempotencyKey,inputDigest,missing.length?'needs_clarification':'ready',mandate,JSON.stringify(outcomes),sponsor,scope,horizon,JSON.stringify(missing),input.templateId,Number(template.version),version.id,contentDigest,JSON.stringify(graph.planningBlueprint)]);
    const row=(await client.query<IntakeRow>(`SELECT * FROM transformation_planning_intakes WHERE intake_id=?`,[intakeId])).rows[0];return map(row);
  });
  return result;
}

export async function convertTemplatePlanningIntake(input:{intakeId:string;organizationId:string;actorUserId:string;idempotencyKey:string;expectedTemplateDigest:string}){
  if(!input.organizationId.trim()||!input.actorUserId.trim())throw new TransformationCaseOperationError('TRANSFORMATION_PLANNING_INTAKE_IDENTITY_REQUIRED',403,'Tenant and actor are required');
  const inputDigest=digestOf({intakeId:input.intakeId,expectedTemplateDigest:input.expectedTemplateDigest});
  const result=await withPgTransaction(async(client)=>{
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?))`,[`${input.organizationId}:${input.intakeId}:${input.idempotencyKey}`]);
    const receipt=(await client.query<any>(`SELECT * FROM transformation_template_conversion_receipts WHERE organization_id=? AND intake_id=? AND idempotency_key=? FOR UPDATE`,[input.organizationId,input.intakeId,input.idempotencyKey])).rows[0];
    if(receipt){if(receipt.input_digest!==inputDigest)throw new TransformationCaseOperationError('TRANSFORMATION_TEMPLATE_CONVERSION_IDEMPOTENCY_CONFLICT',409,'Conversion payload changed');return{transformationCaseId:receipt.transformation_case_id,planId:receipt.plan_id,canonicalRunId:receipt.canonical_run_id,idempotentReplay:true};}
    const intake=(await client.query<IntakeRow>(`SELECT * FROM transformation_planning_intakes WHERE intake_id=? AND organization_id=? FOR UPDATE`,[input.intakeId,input.organizationId])).rows[0];
    if(!intake)throw new TransformationCaseOperationError('TRANSFORMATION_PLANNING_INTAKE_NOT_FOUND',404,'Planning intake not found');
    if(intake.initiated_by_user_id!==input.actorUserId)throw new TransformationCaseOperationError('TRANSFORMATION_PLANNING_INTAKE_ACTOR_MISMATCH',403,'Planning intake belongs to another actor');
    if(!intake.source_template_id||!intake.source_template_version_id||!intake.source_template_digest)throw new TransformationCaseOperationError('TRANSFORMATION_TEMPLATE_INTAKE_REQUIRED',409,'Intake is not template-backed');
    if(input.expectedTemplateDigest!==intake.source_template_digest)throw new TransformationCaseOperationError('TRANSFORMATION_TEMPLATE_DIGEST_CONFLICT',409,'Pinned template digest changed');
    if(intake.status!=='ready')throw new TransformationCaseOperationError('TRANSFORMATION_PLANNING_CLARIFICATION_REQUIRED',409,`Missing: ${json<string[]>(intake.missing_keys_json,[]).join(',')}`);
    const version=(await client.query<any>(`SELECT * FROM ai_playbook_template_versions WHERE id=? AND template_id=? AND version=? FOR UPDATE`,[intake.source_template_version_id,intake.source_template_id,intake.source_template_version])).rows[0];
    if(!version)throw new TransformationCaseOperationError('PINNED_PLANNING_TEMPLATE_VERSION_NOT_FOUND',409,'Pinned template version not found');
    const graph=JSON.parse(version.template_graph) as AgentProcessTemplateGraph;const durableDigest=templateContentDigest(graph);
    if(durableDigest!==intake.source_template_digest||version.content_digest!==durableDigest)throw new TransformationCaseOperationError('AGENT_TEMPLATE_CONTENT_DIGEST_MISMATCH',409,'Pinned template content drifted');
    const blueprint=json<AgentPlanningBlueprint>(intake.template_blueprint_snapshot_json,null as never);
    if(!blueprint||canonicalJson(blueprint)!==canonicalJson(graph.planningBlueprint))throw new TransformationCaseOperationError('TRANSFORMATION_TEMPLATE_BLUEPRINT_DRIFT',409,'Pinned blueprint drifted');
    const steps=validateAndCompileTransformationPlan(blueprint.steps);
    const transformationCaseId=uuidv4(),planId=uuidv4(),contextSnapshotId=uuidv4(),canonicalRunId=uuidv4(),lineageId=uuidv4(),now=new Date().toISOString();
    const assumptions=[`Sponsor: ${intake.sponsor}`,`Scope: ${intake.scope}`,`Horizon: ${intake.horizon}`];
    const sourceRefs=[{artifactId:intake.intake_id,artifactType:'transformation_planning_intake',module:'Agent'},{artifactId:intake.source_template_version_id,artifactType:'agent_process_template_version',module:'Agent'}];
    await client.query(`INSERT INTO transformation_cases (transformation_case_id,organization_id,project_id,conversation_id,context_snapshot_id,execution_run_id,initiated_by_user_id,mandate,desired_outcomes_json,status,lifecycle_stage,autonomy_level,source_refs_json,assumptions_json,missing_inputs_json,active_plan_id,lineage_id,idempotency_key,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?::jsonb,'plan_proposed','mandate','A1_prepare',?::jsonb,?::jsonb,'[]'::jsonb,NULL,?,?,1,?,?)`,[transformationCaseId,input.organizationId,intake.project_id,intake.conversation_id,contextSnapshotId,canonicalRunId,input.actorUserId,intake.mandate,JSON.stringify(json<string[]>(intake.measurable_outcomes_json,[])),JSON.stringify(sourceRefs),JSON.stringify(assumptions),lineageId,`template-intake:${intake.intake_id}`,now,now]);
    await client.query(`INSERT INTO v8_context_snapshots (snapshot_id,parent_snapshot_id,snapshot_version,captured_at,workspace_id,organization_id,project_id,conversation_id,execution_run_id,artifact_refs,effective_scope_ref,resolved_role_ref,initiator_user_id,consumer_class,privacy_mode,source_context_refs,drift_events) VALUES (?,NULL,1,?,?,?,?,?,?,?::jsonb,?,?,?,'execution',0,?::jsonb,'[]'::jsonb)`,[contextSnapshotId,now,input.organizationId,input.organizationId,intake.project_id,intake.conversation_id,canonicalRunId,JSON.stringify(sourceRefs),`transformation-case:${transformationCaseId}`,'transformation_agent',input.actorUserId,JSON.stringify(sourceRefs)]);
    await client.query(`INSERT INTO v8_execution_runs (run_id,organization_id,context_snapshot_id,initiator_user_id,state,plan_version,goal,created_at,updated_at,resolved_at,expires_at,metadata) VALUES (?,?,?,?,'drafting',1,?,?,?,NULL,NULL,?::jsonb)`,[canonicalRunId,input.organizationId,contextSnapshotId,input.actorUserId,intake.mandate,now,now,JSON.stringify({transformationCaseId,lineageId,sourceTemplateId:intake.source_template_id,sourceTemplateVersion:intake.source_template_version,sourceTemplateDigest:intake.source_template_digest})]);
    await client.query(`INSERT INTO v8_agent_run_identities (canonical_run_id,organization_id,transformation_case_id,conversation_id,lineage_id) VALUES (?,?,?,?,?)`,[canonicalRunId,input.organizationId,transformationCaseId,intake.conversation_id,lineageId]);
    await client.query(`INSERT INTO v8_run_state_transitions (transition_id,run_id,from_state,to_state,triggered_by,reason,transitioned_at) VALUES (?,?,'drafting','drafting',?,'Template-backed Transformation Case created',?)`,[uuidv4(),canonicalRunId,input.actorUserId,now]);
    await client.query(`INSERT INTO transformation_plans (plan_id,transformation_case_id,organization_id,version,status,methodology_key,summary,assumptions_json,risks_json,created_by_user_id,created_at,updated_at,source_template_id,source_template_version,source_template_digest) VALUES (?,?,?,1,'pending_review','consultify-transformation-v1',?,?::jsonb,?::jsonb,?,?,?,?,?,?)`,[planId,transformationCaseId,input.organizationId,`Template-backed plan: ${intake.mandate}`,JSON.stringify(assumptions),JSON.stringify(['Business gates require authorized human decisions.']),input.actorUserId,now,now,intake.source_template_id,intake.source_template_version,intake.source_template_digest]);
    for(const step of steps)await client.query(`INSERT INTO transformation_plan_steps (step_id,plan_id,transformation_case_id,organization_id,step_index,lifecycle_stage,business_purpose,module_target,capability_status,inputs_json,outputs_json,owner_role,depends_on_json,approval_class,risk_class,execution_mode,estimated_effort,status,blocker_reason,created_at) VALUES (?,?,?,?,?,?,?,?,?,?::jsonb,?::jsonb,?,?::jsonb,?,?,?,?,'proposed',?,?)`,[step.stepId,planId,transformationCaseId,input.organizationId,step.stepIndex,step.lifecycleStage,step.businessPurpose,step.moduleTarget,step.capabilityStatus,JSON.stringify(step.inputs),JSON.stringify(step.outputs),step.ownerRole,JSON.stringify(step.dependsOn),step.approvalClass,step.riskClass,step.executionMode,step.estimatedEffort,step.blockerReason,now]);
    await client.query(`UPDATE transformation_cases SET active_plan_id=? WHERE transformation_case_id=? AND organization_id=?`,[planId,transformationCaseId,input.organizationId]);
    await client.query(`UPDATE transformation_planning_intakes SET status='converted',converted_case_id=?,updated_at=? WHERE intake_id=? AND organization_id=? AND initiated_by_user_id=? AND status='ready'`,[transformationCaseId,now,intake.intake_id,input.organizationId,input.actorUserId]);
    const lineageDetail={intakeId:intake.intake_id,templateId:intake.source_template_id,templateVersion:intake.source_template_version,templateVersionId:intake.source_template_version_id,templateDigest:intake.source_template_digest,canonicalRunId};
    await client.query(`INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,1,'transformation_template_intake.converted',?,?,?::jsonb,?)`,[uuidv4(),transformationCaseId,input.organizationId,planId,input.actorUserId,digestOf(lineageDetail),JSON.stringify(lineageDetail),now]);
    await client.query(`INSERT INTO v8_agent_template_governance_events (event_id,template_id,organization_id,version,event_type,actor_user_id,reason,execution_run_id) VALUES (?,?,?,?, 'instantiated_to_planning_case',?,'Pinned planning intake converted',?)`,[`template-event-${uuidv4()}`,intake.source_template_id,input.organizationId,intake.source_template_version,input.actorUserId,canonicalRunId]);
    await client.query(`UPDATE ai_playbook_templates SET usage_count=COALESCE(usage_count,0)+1 WHERE id=? AND organization_id=?`,[intake.source_template_id,input.organizationId]);
    await client.query(`INSERT INTO transformation_template_conversion_receipts (receipt_id,organization_id,intake_id,idempotency_key,input_digest,transformation_case_id,plan_id,canonical_run_id) VALUES (?,?,?,?,?,?,?,?)`,[uuidv4(),input.organizationId,intake.intake_id,input.idempotencyKey,inputDigest,transformationCaseId,planId,canonicalRunId]);
    return{transformationCaseId,planId,canonicalRunId,idempotentReplay:false};
  });
  return{...result,intake:map((await owned(input.intakeId,input.organizationId,input.actorUserId)),result.idempotentReplay)};
}
