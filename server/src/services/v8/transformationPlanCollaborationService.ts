import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { withPgTransaction, queryAll } from '../../utils/queryHelpers.js';
import { TransformationCaseOperationError, getTransformationCase, validateAndCompileTransformationPlan } from './transformationCaseService.js';

export const collaborationModes = ['teresa_led', 'human_led', 'teresa_draft_human_edit', 'human_draft_teresa_review'] as const;
export type CollaborationMode = typeof collaborationModes[number];
type Editor = 'human' | 'teresa';
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json = <T>(value: unknown, fallback: T): T => typeof value === 'string' ? JSON.parse(value) : (value ?? fallback) as T;

export async function changeCollaborationMode(input: { caseId: string; organizationId: string; actorUserId: string; expectedVersion: number; mode: CollaborationMode; currentEditor: Editor; reason: string }) {
  const now = new Date().toISOString();
  await withPgTransaction(async (client) => {
    const row = (await client.query<any>(`SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`, [input.caseId,input.organizationId])).rows[0];
    if (!row) throw new TransformationCaseOperationError('TRANSFORMATION_CASE_NOT_FOUND',404,'Transformation Case not found');
    if (row.version !== input.expectedVersion) throw new TransformationCaseOperationError('TRANSFORMATION_CASE_VERSION_CONFLICT',409,`Expected version ${input.expectedVersion}, current version is ${row.version}`);
    const updated = await client.query(`UPDATE transformation_cases SET collaboration_mode=?,current_editor=?,autonomy_policy_version=autonomy_policy_version+1,version=version+1,updated_at=? WHERE transformation_case_id=? AND organization_id=? AND version=?`,[input.mode,input.currentEditor,now,input.caseId,input.organizationId,input.expectedVersion]);
    if (updated.rowCount !== 1) throw new TransformationCaseOperationError('TRANSFORMATION_CASE_VERSION_CONFLICT',409,'Collaboration mode changed concurrently');
    const detail={fromMode:row.collaboration_mode,toMode:input.mode,fromEditor:row.current_editor,toEditor:input.currentEditor,reason:input.reason};
    await client.query(`INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation.collaboration_mode_changed',?,?,?::jsonb,?)`,[uuidv4(),input.caseId,input.organizationId,row.active_plan_id,row.version,input.actorUserId,digest(detail),JSON.stringify(detail),now]);
  });
  return getTransformationCase(input.caseId,input.organizationId);
}

export interface PlanSuggestionInput {
  caseId:string;organizationId:string;actorUserId:string;expectedCaseVersion:number;
  suggestedByType:'teresa'|'human';idempotencyKey:string;
  semanticDiff:{before:Record<string,unknown>;after:Record<string,unknown>};
  rationale:string;impact:string;evidenceRefs:string[];
}

export async function proposePlanSuggestion(input: PlanSuggestionInput) {
  const payloadDigest=digest({semanticDiff:input.semanticDiff,rationale:input.rationale,impact:input.impact,evidenceRefs:input.evidenceRefs,suggestedByType:input.suggestedByType});
  return withPgTransaction(async(client)=>{
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?))`,[`${input.organizationId}:${input.caseId}:${input.idempotencyKey}`]);
    const replay=(await client.query<any>(`SELECT * FROM transformation_plan_suggestions WHERE organization_id=? AND transformation_case_id=? AND idempotency_key=? FOR UPDATE`,[input.organizationId,input.caseId,input.idempotencyKey])).rows[0];
    if(replay){if(replay.diff_digest!==payloadDigest)throw new TransformationCaseOperationError('TRANSFORMATION_PLAN_SUGGESTION_IDEMPOTENCY_CONFLICT',409,'Suggestion payload changed');return{...mapSuggestion(replay),idempotentReplay:true};}
    const kase=(await client.query<any>(`SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,[input.caseId,input.organizationId])).rows[0];
    if(!kase)throw new TransformationCaseOperationError('TRANSFORMATION_CASE_NOT_FOUND',404,'Transformation Case not found');
    if(kase.version!==input.expectedCaseVersion)throw new TransformationCaseOperationError('TRANSFORMATION_CASE_VERSION_CONFLICT',409,`Expected version ${input.expectedCaseVersion}, current version is ${kase.version}`);
    const plan=(await client.query<any>(`SELECT * FROM transformation_plans WHERE plan_id=? AND transformation_case_id=? AND organization_id=? FOR UPDATE`,[kase.active_plan_id,input.caseId,input.organizationId])).rows[0];
    if(!plan)throw new TransformationCaseOperationError('TRANSFORMATION_PLAN_NOT_FOUND',409,'Active plan not found');
    const before=input.semanticDiff.before??{},after=input.semanticDiff.after??{};
    const currentProjection:Record<string,unknown>={summary:plan.summary,mandate:kase.mandate,desiredOutcomes:json(kase.desired_outcomes_json,[]),assumptions:json(kase.assumptions_json,[]),missingInputs:json(kase.missing_inputs_json,[])};
    const recognized=Object.keys(before).filter((key)=>key in currentProjection);
    if(!recognized.length||recognized.some((key)=>JSON.stringify(before[key])!==JSON.stringify(currentProjection[key])))throw new TransformationCaseOperationError('TRANSFORMATION_PLAN_SUGGESTION_STALE',409,'Semantic before state does not match the active Plan');
    if(JSON.stringify(before)===JSON.stringify(after))throw new TransformationCaseOperationError('TRANSFORMATION_PLAN_SUGGESTION_EMPTY',400,'Suggestion must contain a semantic change');
    const id=uuidv4(),now=new Date().toISOString();
    const row=(await client.query<any>(`INSERT INTO transformation_plan_suggestions (suggestion_id,transformation_case_id,organization_id,source_plan_id,source_plan_version,suggested_by_type,suggested_by_id,status,semantic_diff_json,rationale,impact,evidence_refs_json,diff_digest,idempotency_key,created_at) VALUES (?,?,?,?,?,?,?,'pending_review',?::jsonb,?,?,?::jsonb,?,?,?) RETURNING *`,[id,input.caseId,input.organizationId,plan.plan_id,plan.version,input.suggestedByType,input.actorUserId,JSON.stringify(input.semanticDiff),input.rationale,input.impact,JSON.stringify(input.evidenceRefs),payloadDigest,input.idempotencyKey,now])).rows[0];
    await client.query(`INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation.plan_suggestion_created',?,?,?::jsonb,?)`,[uuidv4(),input.caseId,input.organizationId,plan.plan_id,plan.version,input.actorUserId,payloadDigest,JSON.stringify({suggestionId:id,suggestedByType:input.suggestedByType}),now]);
    return {...mapSuggestion(row),idempotentReplay:false};
  });
}

const mapSuggestion=(row:any)=>({suggestionId:row.suggestion_id,transformationCaseId:row.transformation_case_id,sourcePlanId:row.source_plan_id,sourcePlanVersion:Number(row.source_plan_version),suggestedByType:row.suggested_by_type,status:row.status,semanticDiff:json(row.semantic_diff_json,{}),rationale:row.rationale,impact:row.impact,evidenceRefs:json(row.evidence_refs_json,[]),resultingPlanId:row.resulting_plan_id,createdAt:row.created_at,resolvedAt:row.resolved_at});
export async function listPlanSuggestions(caseId:string,organizationId:string){return (await queryAll<any>(`SELECT * FROM transformation_plan_suggestions WHERE transformation_case_id=? AND organization_id=? ORDER BY created_at DESC`,[caseId,organizationId])).map(mapSuggestion);}

export async function resolvePlanSuggestion(input:{suggestionId:string;caseId:string;organizationId:string;actorUserId:string;expectedCaseVersion:number;decision:'accept'|'reject';reason:string}){
  const now=new Date().toISOString();
  let resultPlanId:string|null=null;
  await withPgTransaction(async(client)=>{
    const suggestion=(await client.query<any>(`SELECT * FROM transformation_plan_suggestions WHERE suggestion_id=? AND transformation_case_id=? AND organization_id=? FOR UPDATE`,[input.suggestionId,input.caseId,input.organizationId])).rows[0];
    if(!suggestion)throw new TransformationCaseOperationError('TRANSFORMATION_PLAN_SUGGESTION_NOT_FOUND',404,'Plan suggestion not found');
    if(suggestion.status!=='pending_review'){
      if(suggestion.status==='accepted')resultPlanId=suggestion.resulting_plan_id;
      return;
    }
    const kase=(await client.query<any>(`SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,[input.caseId,input.organizationId])).rows[0];
    if(!kase)throw new TransformationCaseOperationError('TRANSFORMATION_CASE_NOT_FOUND',404,'Transformation Case not found');
    if(kase.version!==input.expectedCaseVersion)throw new TransformationCaseOperationError('TRANSFORMATION_CASE_VERSION_CONFLICT',409,`Expected version ${input.expectedCaseVersion}, current version is ${kase.version}`);
    if(kase.active_plan_id!==suggestion.source_plan_id)throw new TransformationCaseOperationError('TRANSFORMATION_PLAN_SUGGESTION_STALE',409,'Suggestion source is no longer the active Plan');
    if(input.decision==='reject'){
      await client.query(`UPDATE transformation_plan_suggestions SET status='rejected',resolved_by_user_id=?,resolution_reason=?,resolved_at=? WHERE suggestion_id=?`,[input.actorUserId,input.reason,now,input.suggestionId]);
    }else{
      const source=(await client.query<any>(`SELECT * FROM transformation_plans WHERE plan_id=? AND transformation_case_id=? AND organization_id=? FOR UPDATE`,[suggestion.source_plan_id,input.caseId,input.organizationId])).rows[0];
      if(!source||Number(source.version)!==Number(suggestion.source_plan_version))throw new TransformationCaseOperationError('TRANSFORMATION_PLAN_SUGGESTION_STALE',409,'Suggestion Plan version is stale');
      const diff=json<any>(suggestion.semantic_diff_json,{});const after=diff.after??{};
      const nextVersion=Number(source.version)+1;resultPlanId=uuidv4();
      const assumptions=Array.isArray(after.assumptions)?after.assumptions:json(source.assumptions_json,[]);
      await client.query(`INSERT INTO transformation_plans (plan_id,transformation_case_id,organization_id,version,status,methodology_key,summary,assumptions_json,risks_json,created_by_user_id,created_by_type,created_by_id,based_on_plan_version,change_reason,review_status,created_at,updated_at) VALUES (?,?,?,?,'pending_review',?,?,?::jsonb,?::jsonb,?,'teresa',?,?,?,'pending',?,?)`,[resultPlanId,input.caseId,input.organizationId,nextVersion,source.methodology_key,String(after.summary??source.summary),JSON.stringify(assumptions),JSON.stringify(json(source.risks_json,[])),input.actorUserId,input.actorUserId,source.version,input.reason,now,now]);
      const proposedSteps=Array.isArray(after.steps)?validateAndCompileTransformationPlan(after.steps):null;
      if(proposedSteps){for(const step of proposedSteps)await client.query(`INSERT INTO transformation_plan_steps (step_id,plan_id,transformation_case_id,organization_id,step_index,lifecycle_stage,business_purpose,module_target,capability_status,inputs_json,outputs_json,owner_role,depends_on_json,approval_class,risk_class,execution_mode,estimated_effort,status,blocker_reason,origin,last_edited_by_type,execution_actor,created_at) VALUES (?,?,?,?,?,?,?,?,?,?::jsonb,?::jsonb,?,?::jsonb,?,?,?,?,'proposed',?,'teresa','teresa','system',?)`,[step.stepId,resultPlanId,input.caseId,input.organizationId,step.stepIndex,step.lifecycleStage,step.businessPurpose,step.moduleTarget,step.capabilityStatus,JSON.stringify(step.inputs),JSON.stringify(step.outputs),step.ownerRole,JSON.stringify(step.dependsOn),step.approvalClass,step.riskClass,step.executionMode,step.estimatedEffort,step.blockerReason,now]);}
      else await client.query(`INSERT INTO transformation_plan_steps (step_id,plan_id,transformation_case_id,organization_id,step_index,lifecycle_stage,business_purpose,module_target,capability_status,inputs_json,outputs_json,owner_role,depends_on_json,approval_class,risk_class,execution_mode,estimated_effort,status,blocker_reason,origin,last_edited_by_type,execution_actor,runtime_capability_key,capability_checked_at,created_at) SELECT md5(random()::text||clock_timestamp()::text||step_id),?,transformation_case_id,organization_id,step_index,lifecycle_stage,business_purpose,module_target,capability_status,inputs_json,outputs_json,owner_role,depends_on_json,approval_class,risk_class,execution_mode,estimated_effort,status,blocker_reason,origin,last_edited_by_type,execution_actor,runtime_capability_key,capability_checked_at,? FROM transformation_plan_steps WHERE plan_id=? AND organization_id=? ORDER BY step_index`,[resultPlanId,now,source.plan_id,input.organizationId]);
      const updated=await client.query(`UPDATE transformation_cases SET mandate=?,desired_outcomes_json=?::jsonb,assumptions_json=?::jsonb,missing_inputs_json=?::jsonb,active_plan_id=?,status='plan_proposed',version=version+1,updated_at=? WHERE transformation_case_id=? AND organization_id=? AND version=?`,[String(after.mandate??kase.mandate),JSON.stringify(Array.isArray(after.desiredOutcomes)?after.desiredOutcomes:json(kase.desired_outcomes_json,[])),JSON.stringify(assumptions),JSON.stringify(Array.isArray(after.missingInputs)?after.missingInputs:json(kase.missing_inputs_json,[])),resultPlanId,now,input.caseId,input.organizationId,input.expectedCaseVersion]);
      if(updated.rowCount!==1)throw new TransformationCaseOperationError('TRANSFORMATION_CASE_VERSION_CONFLICT',409,'Case changed concurrently');
      await client.query(`UPDATE transformation_plan_suggestions SET status='accepted',resolved_by_user_id=?,resolution_reason=?,resulting_plan_id=?,resolved_at=? WHERE suggestion_id=?`,[input.actorUserId,input.reason,resultPlanId,now,input.suggestionId]);
    }
    const detail={suggestionId:input.suggestionId,decision:input.decision,resultingPlanId:resultPlanId,reason:input.reason};
    await client.query(`INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation.plan_suggestion_resolved',?,?,?::jsonb,?)`,[uuidv4(),input.caseId,input.organizationId,resultPlanId??kase.active_plan_id,input.expectedCaseVersion,input.actorUserId,digest(detail),JSON.stringify(detail),now]);
  });
  return {transformationCase:await getTransformationCase(input.caseId,input.organizationId),resultingPlanId:resultPlanId};
}
