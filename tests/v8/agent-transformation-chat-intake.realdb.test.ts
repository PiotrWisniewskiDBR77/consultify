import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';

const configured=Boolean(process.env.DATABASE_URL),tag=randomUUID(),org=`intake-org-${tag}`,actor=`actor-${tag}`,conversation=`conv-${tag}`;
let db:Client;let service:typeof import('../../server/src/services/v8/transformationPlanningIntakeService.js');
describe.skipIf(!configured)('AGT-001 Teresa planning intake real Postgres',()=>{
  beforeAll(async()=>{db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();service=await import('../../server/src/services/v8/transformationPlanningIntakeService.js');});
  afterAll(async()=>{if(!db)return;await db.query(`DELETE FROM transformation_planning_intakes WHERE organization_id=$1`,[org]);await db.query(`DELETE FROM transformation_cases WHERE organization_id=$1`,[org]);await db.end();});
  it('serializes start, rejects payload collision and scopes cold reload',async()=>{
    const input={organizationId:org,actorUserId:actor,idempotencyKey:`chat-${tag}`,mandate:'Prepare a transformation plan',conversationId:conversation};
    const [a,b]=await Promise.all([service.startPlanningIntake(input),service.startPlanningIntake(input)]);
    expect(a.intakeId).toBe(b.intakeId);expect([a.idempotentReplay,b.idempotentReplay].sort()).toEqual([false,true]);
    await expect(service.startPlanningIntake({...input,mandate:'Changed payload'})).rejects.toMatchObject({code:'TRANSFORMATION_PLANNING_INTAKE_IDEMPOTENCY_CONFLICT'});
    expect((await service.getActivePlanningIntake({organizationId:org,actorUserId:actor,conversationId:conversation}))?.intakeId).toBe(a.intakeId);
    await expect(service.getActivePlanningIntake({organizationId:'foreign',actorUserId:actor,conversationId:conversation})).resolves.toBeNull();
    expect((await db.query(`SELECT count(*)::int count FROM transformation_cases WHERE organization_id=$1`,[org])).rows[0].count).toBe(0);
  });
  it('clarifies then converts concurrently and replays exactly one Case id',async()=>{
    const active=await service.getActivePlanningIntake({organizationId:org,actorUserId:actor,conversationId:conversation});
    const ready=await service.answerPlanningIntake({intakeId:active!.intakeId,organizationId:org,actorUserId:actor,measurableOutcomes:['Reduce lead time 20%'],sponsor:'CEO',scope:'Operations',horizon:'Q4'});expect(ready.status).toBe('ready');
    const results=await Promise.all([service.convertPlanningIntake({intakeId:ready.intakeId,organizationId:org,actorUserId:actor}),service.convertPlanningIntake({intakeId:ready.intakeId,organizationId:org,actorUserId:actor})]);
    expect(results[0].transformationCaseId).toBe(results[1].transformationCaseId);
    expect((await db.query(`SELECT count(*)::int count FROM transformation_cases WHERE organization_id=$1`,[org])).rows[0].count).toBe(1);
    await expect(service.getActivePlanningIntake({organizationId:org,actorUserId:actor,conversationId:conversation})).resolves.toBeNull();
  });
});
