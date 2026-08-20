import { createHash, randomUUID } from 'node:crypto';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';
import { withPgTransaction } from '../../../utils/queryHelpers.js';

export interface LinkBudgetInitiativeParams { organizationId:string; userId:string; budgetId:string; initiativeId:string; expectedVersion:number; idempotencyKey:string }
export interface BudgetInitiativeLinkResult { budgetId:string; initiativeId:string; budgetVersion:number; snapshot:{revenueUplift:string;costSavings:string;capexRequired:string}; replay:boolean }
export class BudgetInitiativeLinkCommandError extends Error { constructor(public readonly code:string,public readonly status:number,message:string,public readonly details?:Record<string,unknown>){super(message)} }
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function linkBudgetInitiativeCommand(params:LinkBudgetInitiativeParams):Promise<BudgetInitiativeLinkResult>{
 const key=params.idempotencyKey.trim();
 if(!key||key.length>200) throw new BudgetInitiativeLinkCommandError('IDEMPOTENCY_KEY_REQUIRED',400,'Idempotency-Key is required');
 if(!params.initiativeId.trim()) throw new BudgetInitiativeLinkCommandError('INITIATIVE_ID_REQUIRED',400,'initiativeId is required');
 if(!Number.isInteger(params.expectedVersion)||params.expectedVersion<1) throw new BudgetInitiativeLinkCommandError('INVALID_EXPECTED_VERSION',400,'expectedVersion must be a positive integer');
 const requestSha256=hash({budgetId:params.budgetId,initiativeId:params.initiativeId,expectedVersion:params.expectedVersion});
 return withPgTransaction(async tx=>{
  const member=(await tx.query<{status:string;role:string}>(`SELECT status,role FROM organization_members WHERE organization_id=? AND user_id=? FOR UPDATE`,[params.organizationId,params.userId])).rows[0];
  if(String(member?.status||'').toUpperCase()!=='ACTIVE') throw new BudgetInitiativeLinkCommandError('ORG_MEMBERSHIP_REVOKED',403,'Active organization membership is required');
  if(!hasFinanceEditRole(member.role)) throw new BudgetInitiativeLinkCommandError('FINANCE_EDIT_FORBIDDEN',403,'Finance editor role is required');
  await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`,[`${params.organizationId}:${params.budgetId}:BUDGET_INITIATIVE_LINK`]);
  const budget=(await tx.query<{status:string;version:number}>(`SELECT status,version FROM budgets WHERE id=? AND organization_id=? FOR UPDATE`,[params.budgetId,params.organizationId])).rows[0];
  if(!budget) throw new BudgetInitiativeLinkCommandError('BUDGET_NOT_FOUND',404,'Budget not found');
  const prior=(await tx.query<{request_sha256:string;response_json:BudgetInitiativeLinkResult}>(`SELECT request_sha256,response_json FROM finance_budget_initiative_link_receipts WHERE organization_id=? AND budget_id=? AND idempotency_key=?`,[params.organizationId,params.budgetId,key])).rows[0];
  if(prior){if(prior.request_sha256!==requestSha256) throw new BudgetInitiativeLinkCommandError('IDEMPOTENCY_PAYLOAD_COLLISION',409,'Idempotency key is bound to another link command');return {...prior.response_json,replay:true};}
  if(budget.status!=='DRAFT') throw new BudgetInitiativeLinkCommandError('BUDGET_IMMUTABLE',409,'Only a DRAFT budget can be edited');
  if(Number(budget.version)!==params.expectedVersion) throw new BudgetInitiativeLinkCommandError('BUDGET_VERSION_CONFLICT',409,'Budget version changed',{currentVersion:Number(budget.version)});
  const initiative=(await tx.query<{estimated_revenue_uplift:string|null;estimated_cost_savings:string|null;estimated_capex:string|null}>(`SELECT estimated_revenue_uplift::text,estimated_cost_savings::text,estimated_capex::text FROM initiatives WHERE id=? AND organization_id=? FOR UPDATE`,[params.initiativeId,params.organizationId])).rows[0];
  if(!initiative) throw new BudgetInitiativeLinkCommandError('INITIATIVE_NOT_FOUND',404,'Initiative not found');
  const exists=(await tx.query(`SELECT 1 FROM budget_initiative_links WHERE budget_id=? AND initiative_id=?`,[params.budgetId,params.initiativeId])).rows[0];
  if(exists) throw new BudgetInitiativeLinkCommandError('ALREADY_LINKED',409,'Initiative is already linked');
  const snapshot={revenueUplift:initiative.estimated_revenue_uplift||'0',costSavings:initiative.estimated_cost_savings||'0',capexRequired:initiative.estimated_capex||'0'};
  await tx.query(`INSERT INTO budget_initiative_links(id,budget_id,initiative_id,organization_id,revenue_uplift,cost_savings,capex_required,created_at) VALUES(?,?,?,?,?,?,?,now())`,[randomUUID(),params.budgetId,params.initiativeId,params.organizationId,snapshot.revenueUplift,snapshot.costSavings,snapshot.capexRequired]);
  const applied=params.expectedVersion+1;
  const updated=await tx.query(`UPDATE budgets SET version=?,updated_at=now() WHERE id=? AND organization_id=? AND version=? AND status='DRAFT'`,[applied,params.budgetId,params.organizationId,params.expectedVersion]);
  if(updated.rowCount!==1) throw new BudgetInitiativeLinkCommandError('BUDGET_VERSION_CONFLICT',409,'Budget changed before link commit');
  const response:BudgetInitiativeLinkResult={budgetId:params.budgetId,initiativeId:params.initiativeId,budgetVersion:applied,snapshot,replay:false};
  await tx.query(`INSERT INTO finance_budget_initiative_link_receipts(organization_id,budget_id,initiative_id,idempotency_key,request_sha256,expected_budget_version,applied_budget_version,snapshot_json,response_json,created_by) VALUES(?,?,?,?,?,?,?,?,?::jsonb,?)`,[params.organizationId,params.budgetId,params.initiativeId,key,requestSha256,params.expectedVersion,applied,JSON.stringify(snapshot),JSON.stringify(response),params.userId]);
  return response;
 });
}
