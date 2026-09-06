import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { mutateCapacityScenario, type CapacityRange, type CapacityScenario } from '../domain/initiatives-execution/capacityScenario.js';
import { mutatePlanScenario, type PlanScenario } from '../domain/initiatives-execution/planScenario.js';
import { PostgresMaterialCommandUnitOfWork } from '../domain/initiatives-execution/postgresMaterialCommandUnitOfWork.js';

const url=process.env.DATABASE_URL;
if(!url?.includes('127.0.0.1:54400/consultify_noc')) throw new Error('STOP: local NOC database required');
const pool=new Pool({connectionString:url}); const uow=new PostgresMaterialCommandUnitOfWork(pool);
const organizationId='cc9db573-260f-4a19-927f-f3cc1fbaea38', actorId='76015d70-9117-444f-97a6-4f5eda9d7ad5', planId='plan-f807b6fd-357e-40ba-860c-cc7de75afedc', capacityId='p11-dec421-capacity-20260906';
const envelope=<T>(aggregateType:string,aggregateId:string,expectedVersion:number,commandType:string,payload:T,createIfMissing=false)=>({organizationId,actorId,aggregateType,aggregateId,expectedVersion,clientRequestId:randomUUID(),correlationId:randomUUID(),policyId:'p11-dec421-owner-decision',policyVersion:1,commandType,createIfMissing,payload});
const planRow=await pool.query<{version:number;payload_json:PlanScenario}>(`SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='plan_scenario' AND aggregate_id=$2`,[organizationId,planId]);
if(!planRow.rows[0]) throw new Error('STOP: clicked plan missing');
let plan=planRow.rows[0].payload_json, planAggregateVersion=planRow.rows[0].version;
if(plan.status==='DRAFT'){const published=await mutatePlanScenario(uow,envelope('plan_scenario',planId,planAggregateVersion,'plan.scenario.mutate',{operation:'PUBLISH' as const,scenario:plan}));plan=published.response;planAggregateVersion=published.aggregateVersion;}
const existing=await pool.query(`SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='capacity_scenario' AND aggregate_id=$2`,[organizationId,capacityId]);
if(existing.rows[0]){console.log(JSON.stringify({status:'EXISTS',capacityId,planId}));await pool.end();process.exit(0);}
const known=(base:number):CapacityRange=>({knowledgeState:'KNOWN',low:base,base,high:base,sourceRef:'P11-DEC-421-owner-decision',sourceVersion:1,asOf:'2026-09-06T00:00:00.000Z',confidence:'HIGH',ownerId:actorId,reason:null});
const scenario:CapacityScenario={scenarioId:capacityId,name:'Analiza obciążenia — Controls Engineer',scenarioVersion:0,status:'DRAFT',planScenarioId:planId,planScenarioVersion:plan.scenarioVersion,windowUnit:plan.windowUnit,timezone:plan.timezone,periods:plan.periods.map(period=>({...period,demand:known(2),supply:known(1)})),constraints:[{constraintId:'controls-engineer-capacity',state:'KNOWN',detail:'Controls Engineer: popyt 2 FTE, podaż 1 FTE — przeciążenie 100%.',ownerId:actorId}],proposedAssignments:plan.windows.map((window,index)=>({assignmentId:`controls-${index+1}`,initiativeId:window.initiativeId,resourceOrRoleId:'Controls Engineer',periodIds:[plan.periods[Math.min(index,plan.periods.length-1)].periodId],demand:known(2),rationale:'Jawne obciążenie roli w planie P11.'})),createdBy:'',updatedBy:'',publishedBy:null,publishedAt:null};
const created=await mutateCapacityScenario(uow,envelope('capacity_scenario',capacityId,0,'capacity.scenario.mutate',{operation:'CREATE' as const,scenario},true));
const published=await mutateCapacityScenario(uow,envelope('capacity_scenario',capacityId,1,'capacity.scenario.mutate',{operation:'PUBLISH' as const,scenario:created.response}));
console.log(JSON.stringify({status:'CREATED',capacityId,planId,planScenarioVersion:plan.scenarioVersion,periods:published.response.periods.length,gaps:published.response.periods.filter(period=>(period.demand.base??0)>(period.supply.base??0)).length}));
await pool.end();
