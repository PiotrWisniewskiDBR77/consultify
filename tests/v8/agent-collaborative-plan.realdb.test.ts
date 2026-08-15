import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const configured=Boolean(process.env.DATABASE_URL);
const tag=randomUUID();const org=`agt-org-${tag}`,actor=`agt-user-${tag}`,caseId=`agt-case-${tag}`,planId=`agt-plan-${tag}`;
let db:Client;let service:typeof import('../../server/src/services/v8/transformationPlanCollaborationService.js');

describe.skipIf(!configured)('AGT-002 collaborative Plan real Postgres',()=>{
  beforeAll(async()=>{
    db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();
    service=await import('../../server/src/services/v8/transformationPlanCollaborationService.js');
    const now=new Date().toISOString();
    await db.query(`INSERT INTO transformation_cases (transformation_case_id,organization_id,initiated_by_user_id,mandate,status,lifecycle_stage,autonomy_level,lineage_id,idempotency_key,version,created_at,updated_at,active_plan_id,desired_outcomes_json,source_refs_json,assumptions_json,missing_inputs_json) VALUES ($1,$2,$3,'Improve operations','plan_approved','mandate','A1_prepare',$4,$5,3,$6,$6,NULL,'[]','[]','[]','[]')`,[caseId,org,actor,`lineage-${tag}`,`key-${tag}`,now]);
    await db.query(`INSERT INTO transformation_plans (plan_id,transformation_case_id,organization_id,version,status,summary,created_by_user_id,created_at,updated_at) VALUES ($1,$2,$3,1,'approved','Original plan',$4,$5,$5)`,[planId,caseId,org,actor,now]);
    await db.query(`INSERT INTO transformation_plan_steps (step_id,plan_id,transformation_case_id,organization_id,step_index,lifecycle_stage,business_purpose,module_target,capability_status,owner_role,approval_class,risk_class,execution_mode,estimated_effort,status,created_at) VALUES ($1,$2,$3,$4,0,'discovery','Understand current state','Agent','REAL','Consultant','none','read_only','human_activity','1 week','proposed',$5)`,[`step-${tag}`,planId,caseId,org,now]);
    await db.query(`UPDATE transformation_cases SET active_plan_id=$1 WHERE transformation_case_id=$2`,[planId,caseId]);
  });
  afterAll(async()=>{if(!db)return;await db.query(`DELETE FROM transformation_cases WHERE transformation_case_id=$1`,[caseId]);await db.end();});

  it('audits mode CAS without mutating the active Plan',async()=>{
    const changed=await service.changeCollaborationMode({caseId,organizationId:org,actorUserId:actor,expectedVersion:3,mode:'human_draft_teresa_review',currentEditor:'human',reason:'Owner selected hybrid review'});
    expect(changed?.activePlanId).toBe(planId);expect(changed?.collaborationMode).toBe('human_draft_teresa_review');expect(changed?.version).toBe(4);
    await expect(service.changeCollaborationMode({caseId,organizationId:org,actorUserId:actor,expectedVersion:3,mode:'teresa_led',currentEditor:'teresa',reason:'stale'})).rejects.toMatchObject({code:'TRANSFORMATION_CASE_VERSION_CONFLICT'});
  });

  it('persists one proposal, accepts concurrently into one new version and replays the same Plan id',async()=>{
    const proposalInput={caseId,organizationId:org,actorUserId:actor,expectedCaseVersion:4,suggestedByType:'teresa' as const,idempotencyKey:`proposal-${tag}`,semanticDiff:{before:{summary:'Original plan'},after:{summary:'Evidence-led revised plan'}},rationale:'New evidence changes sequencing',impact:'Improves delivery confidence',evidenceRefs:['evidence:1']};
    await expect(service.proposePlanSuggestion({...proposalInput,idempotencyKey:`stale-${tag}`,semanticDiff:{before:{summary:'Stale plan'},after:{summary:'Changed'}}})).rejects.toMatchObject({code:'TRANSFORMATION_PLAN_SUGGESTION_STALE'});
    const [first,replay]=await Promise.all([service.proposePlanSuggestion(proposalInput),service.proposePlanSuggestion(proposalInput)]);
    expect(first.suggestionId).toBe(replay.suggestionId);expect([first.idempotentReplay,replay.idempotentReplay].sort()).toEqual([false,true]);
    const resolveInput={suggestionId:first.suggestionId,caseId,organizationId:org,actorUserId:actor,expectedCaseVersion:4,decision:'accept' as const,reason:'Reviewed semantic before/after'};
    const results=await Promise.all([service.resolvePlanSuggestion(resolveInput),service.resolvePlanSuggestion(resolveInput)]);
    expect(results[0].resultingPlanId).toBe(results[1].resultingPlanId);
    const counts=await db.query(`SELECT (SELECT count(*)::int FROM transformation_plans WHERE transformation_case_id=$1 AND version=2) plans,(SELECT count(*)::int FROM transformation_plan_suggestions WHERE transformation_case_id=$1 AND status='accepted') accepted`,[caseId]);
    expect(counts.rows[0]).toEqual({plans:1,accepted:1});
    const oldPlan=await db.query(`SELECT status,summary FROM transformation_plans WHERE plan_id=$1`,[planId]);
    expect(oldPlan.rows[0]).toEqual({status:'approved',summary:'Original plan'});
    await expect(service.listPlanSuggestions(caseId,'foreign-org')).resolves.toEqual([]);
  });
});
