import { ResourceNotFoundError } from './resources.js';
import { MilestoneNotFoundError } from './milestones.js';
import { evaluateScheduleShift, isSameScheduledDay } from './scheduleBaseline.js';
import { BudgetItemNotFoundError } from './budgetItems.js';
import type { Pool, PoolClient } from 'pg';

import type {
  AggregateRelationClaim,
  AuditAppend,
  InitiativeCardSnapshot,
  LegacyTaskCutoverLedgerEntry,
  MaterialCommandTransaction,
  MaterialCommandUnitOfWork,
  OutboxAppend,
  SourceProposalSnapshot,
  StoredCommandReceipt,
} from './materialCommand.js';
import type { ModuleInitiativeForPlanning } from './registerModuleInitiativeForPlanning.js';
import {
  calculateRiskScore,
  categorizeScore,
  DEFAULT_THRESHOLDS,
} from '../../services/raidScoringService.js';
import {
  MaterialCommandConflictError,
  MaterialCommandRuleError,
  MaterialCommandValidationError,
} from './materialCommand.js';

interface QueryResultRowCount {
  rowCount: number | null;
}

function requireSingleRow(result: QueryResultRowCount, operation: string): void {
  if (result.rowCount !== 1) throw new Error(`${operation} affected ${result.rowCount ?? 0} rows`);
}

/**
 * Kod reguly dla duplikatu relacji (P15-K1, DEC-421).
 *
 * Nazwa relacji jest teraz STALA (tozsamosc i wersja zrodla siedza w kolumnach
 * source_id / source_version — migracja 20262107), wiec da sie z niej wprost
 * wyprowadzic regule, ktora zobaczy uzytkownik.
 */
function relationDuplicateRule(relationType: string): string {
  if (relationType.startsWith('PLAN_SCENARIO_')) return 'PLAN_SCENARIO_DUPLICATE';
  if (relationType.startsWith('PORTFOLIO_SCENARIO_')) return 'PORTFOLIO_SCENARIO_DUPLICATE';
  if (relationType.startsWith('CAPACITY_SCENARIO_')) return 'CAPACITY_SCENARIO_DUPLICATE';
  return 'RELATION_ALREADY_CLAIMED';
}

class PostgresMaterialCommandTransaction implements MaterialCommandTransaction {
  constructor(private readonly client: PoolClient) {}

  async writeInitiativeBudgetItem(input: import('./budgetItems.js').BudgetItemMutation & {
    organizationId: string;
    itemId: string;
  }): Promise<import('./budgetItems.js').BudgetItemRecord> {
    const parent = await this.client.query(
      'SELECT id, status FROM initiatives WHERE id=$1 AND organization_id=$2 FOR UPDATE',
      [input.initiativeId, input.organizationId]
    );
    if (parent.rowCount !== 1) throw new BudgetItemNotFoundError('Initiative not found');
    if (String(parent.rows[0].status).toUpperCase() === 'ARCHIVED') {
      throw new MaterialCommandRuleError('INITIATIVE_ARCHIVED_READ_ONLY', 409, 'Archived initiative is read-only');
    }
    const p = input.fields;
    let result;
    if (input.operation === 'create') {
      result = await this.client.query(
        `INSERT INTO initiative_budget_items
          (id,initiative_id,organization_id,category,cost_type,amount,currency,description,source,created_at,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING *`,
        [input.itemId,input.initiativeId,input.organizationId,p.category || 'other',
         p.costType || 'OPEX',p.amount || 0,p.currency || 'PLN',p.description || null,p.source || 'manual']
      );
    } else if (input.operation === 'update') {
      result = await this.client.query(
        `UPDATE initiative_budget_items SET category=COALESCE($4,category),
         cost_type=COALESCE($5,cost_type),amount=COALESCE($6,amount),
         currency=COALESCE($7,currency),description=COALESCE($8,description),updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 AND initiative_id=$2 AND organization_id=$3 RETURNING *`,
        [input.itemId,input.initiativeId,input.organizationId,p.category,p.costType,p.amount,p.currency,p.description]
      );
    } else {
      result = await this.client.query(
        'DELETE FROM initiative_budget_items WHERE id=$1 AND initiative_id=$2 AND organization_id=$3 RETURNING *',
        [input.itemId,input.initiativeId,input.organizationId]
      );
    }
    if (result.rowCount !== 1) throw new BudgetItemNotFoundError('Budget item not found');
    const row = result.rows[0];
    return {
      id: row.id, initiativeId: row.initiative_id, category: row.category,
      costType: row.cost_type, amount: Number(row.amount), currency: row.currency,
      description: row.description, source: row.source,
      ...(input.operation === 'delete' ? { deleted: true as const } : {}),
    };
  }

  async writeInitiativeMilestone(input: import('./milestones.js').MilestoneMutation & {
    organizationId: string; actorId: string; itemId: string;
  }): Promise<import('./milestones.js').MilestoneRecord> {
    const parent = await this.client.query(
      'SELECT id,status FROM initiatives WHERE id=$1 AND organization_id=$2 FOR UPDATE',
      [input.initiativeId,input.organizationId]
    );
    if (parent.rowCount !== 1) throw new MilestoneNotFoundError('Initiative not found');
    if (['ARCHIVED','CANCELLED'].includes(String(parent.rows[0].status).toUpperCase())) throw new MaterialCommandRuleError('INITIATIVE_ARCHIVED_READ_ONLY',409);
    const p=input.fields;
    let result;
    if (input.operation==='create') {
      if (!p.name) throw new MaterialCommandValidationError('Name is required');
      const ordering=await this.client.query('SELECT COALESCE(MAX(order_index),0)+1 AS next_order FROM initiative_milestones WHERE initiative_id=$1 AND organization_id=$2',[input.initiativeId,input.organizationId]);
      result=await this.client.query(
        `INSERT INTO initiative_milestones(id,initiative_id,organization_id,name,description,target_date,status,order_index,is_gate,idempotency_key,created_at,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,'PENDING',$7,$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING *`,
        [input.itemId,input.initiativeId,input.organizationId,p.name,p.description || null,p.targetDate || null,ordering.rows[0].next_order,p.isGate?1:0,p.idempotencyKey || null]
      );
    } else if(input.operation==='delete') {
      result=await this.client.query('DELETE FROM initiative_milestones WHERE id=$1 AND initiative_id=$2 AND organization_id=$3 RETURNING *',[input.itemId,input.initiativeId,input.organizationId]);
    } else {
      const existing=await this.client.query('SELECT * FROM initiative_milestones WHERE id=$1 AND initiative_id=$2 AND organization_id=$3 FOR UPDATE',[input.itemId,input.initiativeId,input.organizationId]);
      if(existing.rowCount!==1) throw new MilestoneNotFoundError('Milestone not found');
      const row=existing.rows[0];
      const changes:Record<string,unknown>={};
      const fields={name:'name',description:'description',targetDate:'target_date',actualDate:'actual_date',status:'status',orderIndex:'order_index'} as const;
      for(const [key,column] of Object.entries(fields)) if(p[key as keyof typeof fields]!==undefined) changes[column]=p[key as keyof typeof fields];
      if(p.isGate!==undefined) changes.is_gate=p.isGate?1:0;
      let shift: {index:number;reset:boolean}|null=null;
      if(p.targetDate!==undefined && 'baseline_date' in row && 'schedule_shift_count' in row) {
        if(row.baseline_date==null && p.targetDate!==null) {
          changes.baseline_date=p.targetDate; changes.baseline_set_at=new Date().toISOString();
        } else if(row.baseline_date!=null && !isSameScheduledDay(p.targetDate,row.target_date)) {
          const verdict=evaluateScheduleShift(Number(row.schedule_shift_count)||0,p.rebaselineDecision ?? null);
          if(!verdict.allowed) throw new MaterialCommandRuleError(verdict.code,409,verdict.error);
          const reset=p.rebaselineDecision?.resetBaseline===true;
          changes.schedule_shift_count=verdict.shiftIndex;
          if(reset) { changes.baseline_date=p.targetDate; changes.baseline_set_at=new Date().toISOString(); changes.baseline_version=(Number(row.baseline_version)||1)+1; }
          shift={index:verdict.shiftIndex,reset};
        }
      }
      changes.updated_at=new Date().toISOString();
      const entries=Object.entries(changes);
      result=await this.client.query(`UPDATE initiative_milestones SET ${entries.map(([column],i)=>`${column}=$${i+4}`).join(',')} WHERE id=$1 AND initiative_id=$2 AND organization_id=$3 RETURNING *`,[input.itemId,input.initiativeId,input.organizationId,...entries.map(([,v])=>v)]);
      if(shift) await this.client.query(
        `INSERT INTO initiative_rebaseline_log(id,organization_id,initiative_id,milestone_id,shift_index,previous_date,new_date,previous_baseline_date,new_baseline_date,baseline_reset,reason,decision_id,approved_by,requested_by,created_at)
         VALUES(gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CURRENT_TIMESTAMP)`,
        [input.organizationId,input.initiativeId,input.itemId,shift.index,row.target_date,p.targetDate,row.baseline_date,shift.reset?p.targetDate:row.baseline_date,shift.reset?1:0,p.rebaselineDecision?.reason??null,p.rebaselineDecision?.decisionId??null,p.rebaselineDecision?.approvedBy??input.actorId,input.actorId]
      );
    }
    if(result.rowCount!==1) throw new MilestoneNotFoundError('Milestone not found');
    const row=result.rows[0];
    return {id:row.id,initiativeId:row.initiative_id,name:row.name,description:row.description,targetDate:row.target_date,actualDate:row.actual_date,status:row.status,orderIndex:row.order_index,isGate:Boolean(row.is_gate),createdAt:row.created_at,...(input.operation==='delete'?{deleted:true as const}:{})};
  }

  async writeInitiativeResource(input: import('./resources.js').ResourceMutation & {
    organizationId:string; itemId:string;
  }):Promise<import('./resources.js').ResourceRecord> {
    const parent=await this.client.query('SELECT id,status FROM initiatives WHERE id=$1 AND organization_id=$2 FOR UPDATE',[input.initiativeId,input.organizationId]);
    if(parent.rowCount!==1)throw new ResourceNotFoundError('Initiative not found');
    if(['ARCHIVED','CANCELLED'].includes(String(parent.rows[0].status).toUpperCase()))throw new MaterialCommandRuleError('INITIATIVE_ARCHIVED_READ_ONLY',409);
    const p=input.fields;
    if(p.userId){
      const user=await this.client.query('SELECT id FROM users WHERE id=$1 AND organization_id=$2',[p.userId,input.organizationId]);
      if(user.rowCount!==1)throw new ResourceNotFoundError('Resource user not found');
    }
    let result;
    if(input.operation==='create') {
      if(!p.role)throw new MaterialCommandValidationError('Role is required');
      result=await this.client.query(
        `INSERT INTO initiative_resources(id,initiative_id,organization_id,user_id,name,role,allocation_percentage,start_date,end_date,notes,created_at,source,idempotency_key)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP,$11,$12) RETURNING *`,
        [input.itemId,input.initiativeId,input.organizationId,p.userId||null,p.name||null,p.role,p.allocationPercentage||100,p.startDate||null,p.endDate||null,p.notes||null,p.source||'manual',p.idempotencyKey||null]
      );
    } else if(input.operation==='delete') {
      result=await this.client.query('DELETE FROM initiative_resources WHERE id=$1 AND initiative_id=$2 AND organization_id=$3 RETURNING *',[input.itemId,input.initiativeId,input.organizationId]);
    } else {
      const current=await this.client.query('SELECT version FROM initiative_resources WHERE id=$1 AND initiative_id=$2 AND organization_id=$3 FOR UPDATE',[input.itemId,input.initiativeId,input.organizationId]);
      if(current.rowCount!==1)throw new ResourceNotFoundError('Resource not found');
      if(p.expectedVersion!==undefined && Number(current.rows[0].version)!==p.expectedVersion)throw new MaterialCommandConflictError('Resource version conflict',p.expectedVersion,Number(current.rows[0].version));
      result=await this.client.query(
        `UPDATE initiative_resources SET name=COALESCE($4,name),role=COALESCE($5,role),allocation_percentage=COALESCE($6,allocation_percentage),start_date=COALESCE($7,start_date),end_date=COALESCE($8,end_date),notes=COALESCE($9,notes),version=version+1,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 AND initiative_id=$2 AND organization_id=$3 RETURNING *`,
        [input.itemId,input.initiativeId,input.organizationId,p.name,p.role,p.allocationPercentage,p.startDate,p.endDate,p.notes]
      );
    }
    if(result.rowCount!==1)throw new ResourceNotFoundError('Resource not found');
    // Same calculation as syncInitiativeCapacity, now atomic with the resource.
    await this.client.query(
      `UPDATE initiatives SET allocated_capacity_fte=(SELECT ROUND(COALESCE(SUM(allocation_percentage),0)::numeric/100,2) FROM initiative_resources WHERE initiative_id=$1 AND organization_id=$2),
       required_capacity_fte=CASE WHEN (SELECT COALESCE(SUM(r.fte_required),0) FROM staffing_plan_roles r JOIN staffing_plans p ON p.id=r.staffing_plan_id WHERE p.initiative_id=$1 AND p.organization_id=$2)>0
       THEN (SELECT SUM(r.fte_required) FROM staffing_plan_roles r JOIN staffing_plans p ON p.id=r.staffing_plan_id WHERE p.initiative_id=$1 AND p.organization_id=$2) ELSE required_capacity_fte END,updated_at=CURRENT_TIMESTAMP
       WHERE id=$1 AND organization_id=$2`,[input.initiativeId,input.organizationId]
    );
    const row=result.rows[0];
    return {id:row.id,initiativeId:row.initiative_id,userId:row.user_id,name:row.name,role:row.role,allocationPercentage:Number(row.allocation_percentage),startDate:row.start_date,endDate:row.end_date,notes:row.notes,source:row.source,version:Number(row.version),...(input.operation==='delete'?{deleted:true as const}:{})};
  }

  async createRaidItem(input: {
    organizationId: string;
    initiativeId: string;
    raidItemId: string;
    type: 'RISK' | 'ASSUMPTION' | 'ISSUE' | 'DEPENDENCY';
    title: string;
    description: string | null;
    status: 'OPEN' | 'MITIGATED' | 'REALIZED' | 'CLOSED';
    probability: 'LOW' | 'MEDIUM' | 'HIGH' | null;
    impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
    ownerId: string | null;
    dueDate: string | null;
    mitigationPlan: string | null;
    linkedItems: string[];
  }): Promise<void> {
    await this.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${input.organizationId}:initiative-raid:${input.initiativeId}`,
    ]);
    const initiative = await this.client.query(
      'SELECT id FROM initiatives WHERE organization_id=$1 AND id=$2 FOR UPDATE',
      [input.organizationId, input.initiativeId]
    );
    if (initiative.rowCount !== 1) {
      throw new MaterialCommandValidationError('Initiative not found');
    }
    // Parytet z czytnikiem legacy (`GET /api/initiatives/:id/raid` zwraca
    // riskScore/scoreCategory i tabele UI po nich koloruja): kanoniczny writer
    // musi wyliczyc te same kolumny co wycofany zapis legacy, inaczej rekord
    // dodany przez Runtime-v1 wraca do UI bez oceny ryzyka.
    const riskScore = calculateRiskScore(input.probability || 'LOW', input.impact || 'LOW');
    const scoreCategory = categorizeScore(riskScore, DEFAULT_THRESHOLDS);
    const result = await this.client.query(
      `INSERT INTO raid_items
       (id,organization_id,initiative_id,type,title,description,status,probability,impact,
        owner_id,due_date,mitigation_plan,linked_items,risk_score,score_category)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        input.raidItemId,
        input.organizationId,
        input.initiativeId,
        input.type,
        input.title,
        input.description,
        input.status,
        input.probability,
        input.impact,
        input.ownerId,
        input.dueDate,
        input.mitigationPlan,
        JSON.stringify(input.linkedItems),
        riskScore,
        scoreCategory,
      ]
    );
    requireSingleRow(result, 'RAID item insert');
  }

  async updateRaidItem(input: {
    organizationId: string;
    initiativeId: string;
    raidItemId: string;
    title: string | null;
    description: string | null;
    status: 'OPEN' | 'MITIGATED' | 'REALIZED' | 'CLOSED' | null;
    probability: 'LOW' | 'MEDIUM' | 'HIGH' | null;
    impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
    ownerId: string | null;
    dueDate: string | null;
    mitigationPlan: string | null;
  }): Promise<void> {
    await this.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${input.organizationId}:initiative-raid:${input.initiativeId}`,
    ]);
    const existing = await this.client.query(
      `SELECT probability, impact FROM raid_items
       WHERE id=$1 AND organization_id=$2 AND initiative_id=$3 FOR UPDATE`,
      [input.raidItemId, input.organizationId, input.initiativeId]
    );
    if (existing.rowCount !== 1) throw new MaterialCommandValidationError('RAID item not found');
    const probability = input.probability ?? existing.rows[0].probability ?? 'LOW';
    const impact = input.impact ?? existing.rows[0].impact ?? 'LOW';
    const riskScore = calculateRiskScore(probability, impact);
    const scoreCategory = categorizeScore(riskScore, DEFAULT_THRESHOLDS);
    const result = await this.client.query(
      `UPDATE raid_items SET
         title=COALESCE($4,title),
         description=COALESCE($5,description),
         status=COALESCE($6,status),
         probability=COALESCE($7,probability),
         impact=COALESCE($8,impact),
         owner_id=COALESCE($9,owner_id),
         due_date=COALESCE($10,due_date),
         mitigation_plan=COALESCE($11,mitigation_plan),
         risk_score=$12,
         score_category=$13,
         updated_at=CURRENT_TIMESTAMP
       WHERE id=$1 AND organization_id=$2 AND initiative_id=$3`,
      [
        input.raidItemId,
        input.organizationId,
        input.initiativeId,
        input.title,
        input.description,
        input.status,
        input.probability,
        input.impact,
        input.ownerId,
        input.dueDate,
        input.mitigationPlan,
        riskScore,
        scoreCategory,
      ]
    );
    if (result.rowCount !== 1) throw new MaterialCommandValidationError('RAID item not found');
  }

  async deleteRaidItem(input: {
    organizationId: string;
    initiativeId: string;
    raidItemId: string;
  }): Promise<void> {
    await this.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${input.organizationId}:initiative-raid:${input.initiativeId}`,
    ]);
    const result = await this.client.query(
      'DELETE FROM raid_items WHERE id=$1 AND organization_id=$2 AND initiative_id=$3',
      [input.raidItemId, input.organizationId, input.initiativeId]
    );
    if (result.rowCount !== 1) throw new MaterialCommandValidationError('RAID item not found');
  }

  async adoptAcceptedClassicInitiative(input: {
    organizationId: string;
    candidateId: string;
    initiativeId: string;
    projectId: string;
    actorId: string;
    policyId: string;
    policyVersion: number;
    correlationId: string;
  }) {
    await this.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${input.organizationId}:accepted-classic:${input.candidateId}`,
    ]);
    const source = await this.client.query<{
      candidate_id: string;
      initiative_id: string;
      registered_initiative_id: string | null;
      title: string;
      rationale: string | null;
      handoff_id: string;
      source_revision: number;
      tool_output_id: string;
      tool_output_version: number;
      tool_output_content_hash: string;
    }>(
      `SELECT c.id candidate_id,c.initiative_id,c.registered_initiative_id,c.title,c.rationale,
              h.id handoff_id,h.source_revision,h.tool_output_id,h.tool_output_version,
              h.tool_output_content_hash
         FROM initiative_candidates c
         JOIN initiatives i ON i.organization_id=c.organization_id AND i.id=c.initiative_id
         JOIN swot_candidate_handoffs h ON h.organization_id=c.organization_id AND h.candidate_id=c.id
         JOIN tool_outputs o ON o.organization_id=h.organization_id AND o.id=h.tool_output_id
        WHERE c.organization_id=$1 AND c.id=$2 AND c.status='accepted'
          AND c.initiative_id=$3 AND i.project_id=$4 AND c.registered_initiative_id IS NULL
          AND o.status='approved' AND o.version=h.tool_output_version
          AND o.content_hash=h.tool_output_content_hash
        FOR UPDATE OF c`,
      [input.organizationId, input.candidateId, input.initiativeId, input.projectId]
    );
    const row = source.rows[0];
    if (!row)
      throw new MaterialCommandValidationError(
        'Accepted classic SWOT candidate not found or lineage is not immutable'
      );
    const existing = await this.client.query<{
      receipt_id: string;
      candidate_id: string;
      classic_initiative_id: string;
      runtime_initiative_id: string;
      project_id: string;
      swot_handoff_receipt_id: string;
      tool_output_id: string;
      tool_output_version: number;
      tool_output_content_hash: string;
    }>(
      `SELECT * FROM flow_accepted_classic_runtime_adoptions
          WHERE organization_id=$1 AND (candidate_id=$2 OR classic_initiative_id=$3) FOR UPDATE`,
      [input.organizationId, input.candidateId, input.initiativeId]
    );
    if (existing.rows.length > 1)
      throw new MaterialCommandConflictError('classic adoption identity conflict', 0, 1);
    const prior = existing.rows[0];
    if (prior) {
      if (
        prior.candidate_id !== input.candidateId ||
        prior.classic_initiative_id !== input.initiativeId ||
        prior.runtime_initiative_id !== input.initiativeId ||
        prior.swot_handoff_receipt_id !== row.handoff_id ||
        prior.project_id !== input.projectId ||
        prior.tool_output_id !== row.tool_output_id ||
        prior.tool_output_version !== row.tool_output_version ||
        prior.tool_output_content_hash !== row.tool_output_content_hash
      ) {
        throw new MaterialCommandConflictError('classic adoption identity conflict', 0, 1);
      }
      return {
        receiptId: prior.receipt_id,
        title: row.title,
        problem: row.rationale || row.title,
        sourceReceiptId: row.handoff_id,
        sourceVersion: row.source_revision,
        sourceContentHash: row.tool_output_content_hash,
        toolOutputId: row.tool_output_id,
        toolOutputVersion: row.tool_output_version,
      };
    }
    const inserted = await this.client.query<{ receipt_id: string }>(
      `INSERT INTO flow_accepted_classic_runtime_adoptions
       (organization_id,candidate_id,classic_initiative_id,runtime_initiative_id,
        project_id,swot_handoff_receipt_id,swot_source_revision,tool_output_id,tool_output_version,
        tool_output_content_hash,policy_id,policy_version,correlation_id,adopted_by)
       VALUES($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING receipt_id`,
      [
        input.organizationId,
        input.candidateId,
        input.initiativeId,
        input.projectId,
        row.handoff_id,
        row.source_revision,
        row.tool_output_id,
        row.tool_output_version,
        row.tool_output_content_hash,
        input.policyId,
        input.policyVersion,
        input.correlationId,
        input.actorId,
      ]
    );
    return {
      receiptId: inserted.rows[0].receipt_id,
      title: row.title,
      problem: row.rationale || row.title,
      sourceReceiptId: row.handoff_id,
      sourceVersion: row.source_revision,
      sourceContentHash: row.tool_output_content_hash,
      toolOutputId: row.tool_output_id,
      toolOutputVersion: row.tool_output_version,
    };
  }

  async adoptChatDraftInitiative(input: {
    organizationId: string;
    chatInitiativeId: string;
    initiativeId: string;
    projectId: string;
    initiativeOwnerId: string;
    actorId: string;
    policyId: string;
    policyVersion: number;
    correlationId: string;
  }) {
    await this.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${input.organizationId}:chat-draft:${input.chatInitiativeId}`,
    ]);
    const source = await this.client.query<{
      id: string;
      project_id: string;
      title: string | null;
      problem_statement: string | null;
      source_type: string;
      source_id: string | null;
      owner_business_id: string | null;
      owner_execution_id: string | null;
    }>(
      `SELECT id, organization_id, project_id, title, problem_statement,
              source_type, source_id, owner_business_id, owner_execution_id
         FROM initiatives
        WHERE organization_id = $1 AND id = $2 AND source_type = 'teresa_chat'
          AND project_id IS NOT NULL
        FOR UPDATE`,
      [input.organizationId, input.chatInitiativeId]
    );
    const row = source.rows[0];
    if (!row) {
      const diagnostic = await this.client.query<{
        source_type: string | null;
        project_id: string | null;
      }>('SELECT source_type, project_id FROM initiatives WHERE organization_id=$1 AND id=$2', [
        input.organizationId,
        input.chatInitiativeId,
      ]);
      const found = diagnostic.rows[0];
      if (!found) throw new MaterialCommandValidationError('Chat draft initiative not found');
      if (found.source_type !== 'teresa_chat') {
        throw new MaterialCommandValidationError('Initiative source_type must be teresa_chat');
      }
      throw new MaterialCommandValidationError('Initiative project_id is required before adoption');
    }
    if (!String(row.title || '').trim()) {
      throw new MaterialCommandValidationError('Initiative title is required before adoption');
    }
    if (!String(row.problem_statement || '').trim()) {
      throw new MaterialCommandValidationError(
        'Initiative problem_statement is required before adoption'
      );
    }
    if (row.project_id !== input.projectId) {
      throw new MaterialCommandValidationError('Initiative project_id does not match adoption project');
    }
    const ownerId = row.owner_execution_id || row.owner_business_id;
    if (!ownerId) {
      throw new MaterialCommandValidationError('Initiative owner is required before adoption');
    }
    if (ownerId !== input.initiativeOwnerId) {
      throw new MaterialCommandValidationError('Initiative owner does not match adoption owner');
    }

    const existing = await this.client.query<{
      receipt_id: string;
      chat_initiative_id: string;
      runtime_initiative_id: string;
      project_id: string;
    }>(
      `SELECT receipt_id,chat_initiative_id,runtime_initiative_id,project_id
         FROM flow_teresa_chat_draft_adoptions
        WHERE organization_id=$1 AND chat_initiative_id=$2 FOR UPDATE`,
      [input.organizationId, input.chatInitiativeId]
    );
    const prior = existing.rows[0];
    if (prior) {
      if (
        prior.runtime_initiative_id !== input.initiativeId ||
        prior.project_id !== input.projectId
      ) {
        throw new MaterialCommandConflictError('chat-draft adoption identity conflict', 0, 1);
      }
      return {
        receiptId: prior.receipt_id,
        title: String(row.title),
        problem: String(row.problem_statement),
        sourceId: row.source_id || row.id,
      };
    }
    const inserted = await this.client.query<{ receipt_id: string }>(
      `INSERT INTO flow_teresa_chat_draft_adoptions
       (organization_id,chat_initiative_id,runtime_initiative_id,project_id,
        policy_id,policy_version,correlation_id,adopted_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING receipt_id`,
      [
        input.organizationId,
        input.chatInitiativeId,
        input.initiativeId,
        input.projectId,
        input.policyId,
        input.policyVersion,
        input.correlationId,
        input.actorId,
      ]
    );
    return {
      receiptId: inserted.rows[0].receipt_id,
      title: String(row.title),
      problem: String(row.problem_statement),
      sourceId: row.source_id || row.id,
    };
  }

  async findReceipt<TResponse>(
    organizationId: string,
    clientRequestId: string
  ): Promise<StoredCommandReceipt<TResponse> | null> {
    const result = await this.client.query<{
      organization_id: string;
      client_request_id: string;
      command_type: string;
      aggregate_type: string;
      aggregate_id: string;
      aggregate_version: number;
      correlation_id: string;
      request_fingerprint: string;
      response_json: TResponse;
    }>(
      `SELECT organization_id, client_request_id, command_type, aggregate_type,
              aggregate_id, aggregate_version, correlation_id, request_fingerprint, response_json
         FROM ie_command_receipts
        WHERE organization_id = $1 AND client_request_id = $2`,
      [organizationId, clientRequestId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      organizationId: row.organization_id,
      clientRequestId: row.client_request_id,
      commandType: row.command_type,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      aggregateVersion: row.aggregate_version,
      correlationId: row.correlation_id,
      requestFingerprint: row.request_fingerprint,
      response: row.response_json,
    };
  }

  async getAggregateVersion(
    organizationId: string,
    aggregateType: string,
    aggregateId: string
  ): Promise<number | null> {
    await this.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${organizationId}:${aggregateType}:${aggregateId}`,
    ]);
    const result = await this.client.query<{ version: number }>(
      `SELECT version
         FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = $2 AND aggregate_id = $3
        FOR UPDATE`,
      [organizationId, aggregateType, aggregateId]
    );
    return result.rows[0]?.version ?? null;
  }

  async getAggregatePayload<TPayload>(
    organizationId: string,
    aggregateType: string,
    aggregateId: string
  ): Promise<TPayload | null> {
    const result = await this.client.query<{ payload_json: TPayload }>(
      `SELECT payload_json
         FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = $2 AND aggregate_id = $3`,
      [organizationId, aggregateType, aggregateId]
    );
    return result.rows[0]?.payload_json ?? null;
  }

  /**
   * MOST P15-K2 (DEC-421): inicjatywa MODUŁU jako źródło planu.
   *
   * `planned_start_date`/`planned_end_date` są w tej tabeli kolumnami TEXT (pomiar
   * 07.09), więc wracają jako zapisany napis ISO — bez konwersji przez `Date`,
   * która zamieniłaby brak strefy na lokalną. `initiative_dependencies` ma dziś
   * 0 wierszy; pusta lista to UCZCIWE „brak zależności", nie ukryte zero.
   */
  async getModuleInitiativeForPlanning(
    organizationId: string,
    initiativeId: string
  ): Promise<ModuleInitiativeForPlanning | null> {
    const result = await this.client.query<{
      id: string;
      name: string | null;
      title: string | null;
      status: string | null;
      project_id: string | null;
      planned_start_date: string | null;
      planned_end_date: string | null;
      required_capacity_fte: number | null;
    }>(
      `SELECT id, name, title, status, project_id,
              planned_start_date, planned_end_date, required_capacity_fte
         FROM initiatives
        WHERE organization_id = $1 AND id = $2`,
      [organizationId, initiativeId]
    );
    const row = result.rows[0];
    if (!row) return null;
    const dependencies = await this.client.query<{ to_initiative_id: string }>(
      `SELECT to_initiative_id
         FROM initiative_dependencies
        WHERE organization_id = $1 AND from_initiative_id = $2
        ORDER BY to_initiative_id`,
      [organizationId, initiativeId]
    );
    return {
      initiativeId: row.id,
      name: (row.name ?? row.title ?? row.id).trim() || row.id,
      status: String(row.status ?? ''),
      projectId: row.project_id,
      plannedStartDate: row.planned_start_date,
      plannedEndDate: row.planned_end_date,
      requiredCapacityFte:
        row.required_capacity_fte === null ? null : Number(row.required_capacity_fte),
      dependsOn: dependencies.rows.map((dependency) => dependency.to_initiative_id),
    };
  }

  async persistAggregate<TMutation>(
    organizationId: string,
    aggregateType: string,
    aggregateId: string,
    fromVersion: number,
    toVersion: number,
    mutation: TMutation
  ): Promise<void> {
    const result = await this.client.query(
      `UPDATE ie_aggregate_state
          SET version = $1, payload_json = $2::jsonb, updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = $3 AND aggregate_type = $4 AND aggregate_id = $5 AND version = $6`,
      [toVersion, JSON.stringify(mutation), organizationId, aggregateType, aggregateId, fromVersion]
    );
    if (result.rowCount === 1) return;
    if (fromVersion === 0) {
      const inserted = await this.client.query(
        `INSERT INTO ie_aggregate_state
          (organization_id, aggregate_type, aggregate_id, version, payload_json)
         VALUES ($1,$2,$3,$4,$5::jsonb)
         ON CONFLICT (organization_id, aggregate_type, aggregate_id) DO NOTHING`,
        [organizationId, aggregateType, aggregateId, toVersion, JSON.stringify(mutation)]
      );
      requireSingleRow(inserted, 'aggregate insert');
      return;
    }
    requireSingleRow(result, 'aggregate update');
  }

  async getRelatedAggregateForUpdate<TPayload>(
    organizationId: string,
    aggregateType: string,
    aggregateId: string
  ): Promise<{ version: number; payload: TPayload } | null> {
    const result = await this.client.query<{ version: number; payload_json: TPayload }>(
      `SELECT version, payload_json
         FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = $2 AND aggregate_id = $3
        FOR UPDATE`,
      [organizationId, aggregateType, aggregateId]
    );
    const row = result.rows[0];
    return row ? { version: row.version, payload: row.payload_json } : null;
  }

  async persistRelatedAggregate<TMutation>(
    organizationId: string,
    aggregateType: string,
    aggregateId: string,
    fromVersion: number,
    toVersion: number,
    mutation: TMutation
  ): Promise<void> {
    await this.persistAggregate(
      organizationId,
      aggregateType,
      aggregateId,
      fromVersion,
      toVersion,
      mutation
    );
  }

  async appendLegacyTaskCutoverLedgerEntry(entry: LegacyTaskCutoverLedgerEntry): Promise<void> {
    // FIX-216-1: a task that previously failed (see Guard B in
    // legacy-task-cutover-runner.ts) leaves a `FAILED` row behind with the
    // SAME primary key (organization_id, legacy_task_id) that a successful
    // retry writes here. A plain INSERT would collide with that stale row
    // and turn a successful migration into a crashed transaction — exactly
    // the "FAILED permanently parks the task" regression. Upsert over it
    // instead. The WHERE guard only allows overwriting a FAILED row (or a
    // fresh insert); it must never silently clobber an already-MIGRATED row
    // — Guard B is supposed to no-op before this is ever reached for one,
    // so if that invariant is somehow violated this UPDATE affects 0 rows
    // and `requireSingleRow` below fails loudly instead of corrupting data.
    const result = await this.client.query(
      `INSERT INTO legacy_task_cutover_ledger
       (organization_id,legacy_task_id,batch_id,status,client_request_id,canonical_id,
        case_version_before,case_version_after,actor_id,checksum,completed_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP)
       ON CONFLICT (organization_id, legacy_task_id) DO UPDATE SET
         batch_id = EXCLUDED.batch_id,
         status = EXCLUDED.status,
         reason_code = NULL,
         client_request_id = EXCLUDED.client_request_id,
         canonical_id = EXCLUDED.canonical_id,
         case_version_before = EXCLUDED.case_version_before,
         case_version_after = EXCLUDED.case_version_after,
         actor_id = EXCLUDED.actor_id,
         checksum = EXCLUDED.checksum,
         completed_at = EXCLUDED.completed_at,
         updated_at = CURRENT_TIMESTAMP
       WHERE legacy_task_cutover_ledger.status = 'FAILED'`,
      [
        entry.organizationId,
        entry.legacyTaskId,
        entry.batchId,
        entry.status,
        entry.clientRequestId,
        entry.canonicalId,
        entry.caseVersionBefore,
        entry.caseVersionAfter,
        entry.actorId,
        entry.checksum,
      ]
    );
    requireSingleRow(result, 'legacy task cutover ledger insert');
  }

  async appendAudit(entry: AuditAppend): Promise<void> {
    const result = await this.client.query(
      `INSERT INTO ie_audit_events
        (organization_id, actor_id, aggregate_type, aggregate_id, aggregate_version,
         command_type, client_request_id, correlation_id, policy_id, policy_version, payload_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
      [
        entry.organizationId,
        entry.actorId,
        entry.aggregateType,
        entry.aggregateId,
        entry.aggregateVersion,
        entry.commandType,
        entry.clientRequestId,
        entry.correlationId,
        entry.policyId,
        entry.policyVersion,
        JSON.stringify(entry.payload),
      ]
    );
    requireSingleRow(result, 'audit append');
  }

  async claimRelation(claim: AggregateRelationClaim): Promise<void> {
    let result: QueryResultRowCount;
    try {
      result = await this.client.query(
        `INSERT INTO ie_aggregate_relations
        (organization_id, relation_type, source_type, source_id, source_version,
         target_type, target_id, payload_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
        [
          claim.organizationId,
          claim.relationType,
          claim.sourceType,
          claim.sourceId,
          claim.sourceVersion,
          claim.targetType,
          claim.targetId,
          JSON.stringify(claim.payload),
        ]
      );
    } catch (error) {
      // P15-K1 (DEC-421): naruszenie unikalnosci relacji to reguła domenowa,
      // nie awaria serwera. Bez tego mapowania `23505` wychodzil na zewnatrz
      // jako HTTP 500 INITIATIVES_EXECUTION_RUNTIME_FAILED bez przyczyny.
      if ((error as { code?: unknown } | null)?.code !== '23505') throw error;
      throw new MaterialCommandRuleError(
        relationDuplicateRule(claim.relationType),
        409,
        `relation ${claim.relationType} already claimed for ${claim.targetType}:${claim.targetId}`
      );
    }
    requireSingleRow(result, 'relation claim');
  }

  async getSourceProposalForUpdate(
    organizationId: string,
    proposalId: string
  ): Promise<SourceProposalSnapshot | null> {
    const result = await this.client.query<{
      id: string;
      organization_id: string;
      version: number;
      source_type: string;
      source_id: string | null;
      source_version: number;
      title: string;
      problem: string | null;
      proposed_outcome: string | null;
      project_id: string | null;
      initiative_owner_id: string | null;
      visibility: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
      evidence_state: 'READY' | 'PARTIAL' | 'STALE' | 'UNKNOWN';
      duplicate_state: 'CLEAR' | 'POSSIBLE' | 'UNKNOWN';
      status: string;
      registered_initiative_id: string | null;
    }>(
      `SELECT id, organization_id, version, source_type, source_id, source_version,
              title, problem, proposed_outcome, project_id, initiative_owner_id,
              visibility, evidence_state, duplicate_state, status, registered_initiative_id
         FROM initiative_candidates
        WHERE organization_id = $1 AND id = $2
        FOR UPDATE`,
      [organizationId, proposalId]
    );
    const row = result.rows[0];
    if (!row || !row.source_id) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      version: row.version,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceVersion: row.source_version,
      title: row.title,
      problem: row.problem,
      proposedOutcome: row.proposed_outcome,
      projectId: row.project_id,
      initiativeOwnerId: row.initiative_owner_id,
      visibility: row.visibility,
      evidenceState: row.evidence_state,
      duplicateState: row.duplicate_state,
      status: row.status,
      registeredInitiativeId: row.registered_initiative_id,
    };
  }

  async findProposalBySourceForUpdate(
    organizationId: string,
    sourceType: string,
    sourceId: string,
    sourceVersion: number
  ): Promise<{ id: string } | null> {
    await this.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${organizationId}:source-proposal:${sourceType}:${sourceId}:${sourceVersion}`,
    ]);
    const result = await this.client.query<{ id: string }>(
      `SELECT id FROM initiative_candidates
        WHERE organization_id=$1 AND source_type=$2 AND source_id=$3 AND source_version=$4
        FOR UPDATE`,
      [organizationId, sourceType, sourceId, sourceVersion]
    );
    return result.rows[0] ?? null;
  }

  async insertSourceProposal(
    organizationId: string,
    proposal: import('./submitSourceProposal.js').SubmittedSourceProposal
  ): Promise<void> {
    const result = await this.client.query(
      `INSERT INTO initiative_candidates
        (id,organization_id,source_type,source_id,source_version,title,problem,proposed_outcome,
         project_id,initiative_owner_id,visibility,evidence_state,duplicate_state,status,version,
         provenance_json,policy_id,policy_version,created_by,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',1,$14::jsonb,$15,$16,$17,$18,$18)`,
      [
        proposal.proposalId,
        organizationId,
        proposal.sourceType,
        proposal.sourceId,
        proposal.sourceVersion,
        proposal.title,
        proposal.problem,
        proposal.proposedOutcome,
        proposal.projectId,
        proposal.initiativeOwnerId,
        proposal.visibility,
        proposal.evidenceState,
        proposal.duplicateState,
        JSON.stringify(proposal.provenance),
        proposal.policy.policyId,
        proposal.policy.policyVersion,
        proposal.submittedBy,
        proposal.submittedAt,
      ]
    );
    requireSingleRow(result, 'source proposal insert');
  }

  async markSourceProposalRegistered(
    organizationId: string,
    proposalId: string,
    proposalVersion: number,
    initiativeId: string
  ): Promise<void> {
    // INI-BVP-001 — considered adding `AND initiative_id IS NULL` here for
    // symmetry with the classic funnel's guard (initiativeCandidateService.
    // acceptCandidate now checks `initiative_id IS NULL AND
    // registered_initiative_id IS NULL`), but deliberately did NOT: it is not
    // load-bearing (this row is locked via `SELECT ... FOR UPDATE` in
    // getSourceProposalForUpdate before this runs, so Postgres already
    // serializes against a concurrent classic-funnel UPDATE on the same row —
    // whichever side commits first, the other observes the committed
    // `status`/claim-column state), and `initiative_id` was added by a
    // DIFFERENT migration (932_initiative_candidate_acceptance_receipt.sql)
    // than this table's own runtime-v1 columns
    // (932_initiatives_execution_material_commands.sql). Unlike
    // initiativeCandidateService.ts, this query is not wrapped in a
    // catch-and-degrade around a missing column — referencing a column that
    // may not exist on a partially-migrated environment would turn a working
    // Register into an unhandled 5xx instead of the intended guard failure.
    // `status = 'pending'` already blocks the case that matters here (the
    // classic funnel sets status='accepted' on its own claim too).
    const result = await this.client.query(
      `UPDATE initiative_candidates
          SET status = 'accepted', disposition = 'REGISTER', registered_initiative_id = $1,
              version = version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = $2 AND id = $3 AND version = $4
          AND status = 'pending' AND registered_initiative_id IS NULL`,
      [initiativeId, organizationId, proposalId, proposalVersion]
    );
    requireSingleRow(result, 'source proposal read-back');
  }

  async upsertExecutionControlKpiPolicy(input: {
    organizationId: string;
    policyId: string;
    name: string;
    parameters: Record<string, unknown>;
    expectedRowVersion: number;
    nextRowVersion: number;
  }): Promise<'INSERTED' | 'UPDATED' | 'CONFLICT'> {
    const inserted = await this.client.query(
      `INSERT INTO execution_control_kpi_policies
         (organization_id, policy_id, name, parameters, row_version)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (organization_id, policy_id) DO NOTHING`,
      [
        input.organizationId,
        input.policyId,
        input.name,
        JSON.stringify(input.parameters),
        input.nextRowVersion,
      ]
    );
    if (inserted.rowCount === 1) return 'INSERTED';

    const updated = await this.client.query(
      `UPDATE execution_control_kpi_policies
          SET name = $1, parameters = $2::jsonb, row_version = $3, updated_at = NOW()
        WHERE organization_id = $4 AND policy_id = $5 AND row_version = $6`,
      [
        input.name,
        JSON.stringify(input.parameters),
        input.nextRowVersion,
        input.organizationId,
        input.policyId,
        input.expectedRowVersion,
      ]
    );
    return updated.rowCount === 1 ? 'UPDATED' : 'CONFLICT';
  }

  async assignGoalPerspective(input: {
    organizationId: string;
    goalId: string;
    perspective:
      | 'financial'
      | 'customer'
      | 'process'
      | 'learning'
      | 'governance_data_quality'
      | null;
  }): Promise<void> {
    const result = await this.client.query(
      `UPDATE goals
          SET perspective=$1, updated_at=CURRENT_TIMESTAMP
        WHERE organization_id=$2 AND id=$3`,
      [input.perspective, input.organizationId, input.goalId]
    );
    if (result.rowCount !== 1) {
      throw new MaterialCommandValidationError('GOAL_NOT_FOUND');
    }
  }

  async markSourceProposalDisposition(
    organizationId: string,
    proposalId: string,
    proposalVersion: number,
    disposition: 'MERGE' | 'EXTEND' | 'RETURN' | 'DEFER' | 'DISMISS',
    targetInitiativeId: string | null
  ): Promise<void> {
    const statusByDisposition = {
      MERGE: 'accepted',
      EXTEND: 'accepted',
      RETURN: 'returned',
      DEFER: 'deferred',
      DISMISS: 'dismissed',
    } as const;
    const result = await this.client.query(
      `UPDATE initiative_candidates
          SET status = $1, disposition = $2, registered_initiative_id = $3,
              version = version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = $4 AND id = $5 AND version = $6
          AND status = 'pending' AND registered_initiative_id IS NULL`,
      [
        statusByDisposition[disposition],
        disposition,
        targetInitiativeId,
        organizationId,
        proposalId,
        proposalVersion,
      ]
    );
    requireSingleRow(result, 'source proposal disposition read-back');
  }

  async reviseSourceProposal(input: {
    organizationId: string;
    proposalId: string;
    expectedProposalVersion: number;
    sourceVersion: number;
    provenance: Record<string, unknown>;
  }): Promise<void> {
    const result = await this.client.query(
      `UPDATE initiative_candidates SET source_version=$1,version=version+1,
              provenance_json=$2::jsonb,evidence_state='READY',updated_at=CURRENT_TIMESTAMP
        WHERE organization_id=$3 AND id=$4 AND version=$5`,
      [
        input.sourceVersion,
        JSON.stringify(input.provenance),
        input.organizationId,
        input.proposalId,
        input.expectedProposalVersion,
      ]
    );
    requireSingleRow(result, 'source proposal revision');
  }

  async isCanonicalInitiativeCard(cardKey: string): Promise<boolean> {
    const result = await this.client.query(
      'SELECT 1 FROM ie_initiative_card_catalog WHERE card_key = $1 AND active = TRUE',
      [cardKey]
    );
    return result.rowCount === 1;
  }

  async listCanonicalInitiativeCardKeys(): Promise<string[]> {
    const result = await this.client.query<{ card_key: string }>(
      'SELECT card_key FROM ie_initiative_card_catalog WHERE active = TRUE ORDER BY card_key'
    );
    return result.rows.map((row) => row.card_key);
  }

  async replaceInitiativeCardSelection(input: {
    organizationId: string;
    initiativeId: string;
    cards: Array<{
      cardKey: string;
      included: boolean;
      position: number;
      requiredness: 'REQUIRED' | 'OPTIONAL';
      waiverDecisionId: string | null;
    }>;
  }): Promise<void> {
    await this.client.query(
      `DELETE FROM ie_initiative_card_selection
        WHERE organization_id = $1 AND initiative_id = $2`,
      [input.organizationId, input.initiativeId]
    );
    for (const card of input.cards) {
      const result = await this.client.query(
        `INSERT INTO ie_initiative_card_selection
          (organization_id, initiative_id, card_key, included, position,
           requiredness, waiver_decision_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          input.organizationId,
          input.initiativeId,
          card.cardKey,
          card.included,
          card.position,
          card.requiredness,
          card.waiverDecisionId,
        ]
      );
      requireSingleRow(result, 'Initiative card selection insert');
    }
  }

  async getInitiativeCardVersionForUpdate(
    organizationId: string,
    initiativeId: string,
    cardKey: string
  ): Promise<number> {
    const result = await this.client.query<{ card_version: number }>(
      `SELECT card_version
         FROM ie_initiative_card_versions
        WHERE organization_id = $1 AND initiative_id = $2 AND card_key = $3
        ORDER BY card_version DESC
        LIMIT 1
        FOR UPDATE`,
      [organizationId, initiativeId, cardKey]
    );
    return result.rows[0]?.card_version ?? 0;
  }

  async getLatestInitiativeCardForUpdate(
    organizationId: string,
    initiativeId: string,
    cardKey: string
  ): Promise<InitiativeCardSnapshot | null> {
    const result = await this.client.query<{
      card_key: string;
      card_version: number;
      applicability: InitiativeCardSnapshot['applicability'];
      completion: InitiativeCardSnapshot['completion'];
      quality: InitiativeCardSnapshot['quality'];
      freshness: InitiativeCardSnapshot['freshness'];
      review_state: InitiativeCardSnapshot['reviewState'];
      content_json: Record<string, unknown>;
      evidence_refs_json: string[];
      waiver_decision_id: string | null;
      published_by: string;
    }>(
      `SELECT card_key, card_version, applicability, completion, quality, freshness,
              review_state, content_json, evidence_refs_json, waiver_decision_id, published_by
         FROM ie_initiative_card_versions
        WHERE organization_id = $1 AND initiative_id = $2 AND card_key = $3
        ORDER BY card_version DESC
        LIMIT 1
        FOR UPDATE`,
      [organizationId, initiativeId, cardKey]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      cardKey: row.card_key,
      cardVersion: row.card_version,
      applicability: row.applicability,
      completion: row.completion,
      quality: row.quality,
      freshness: row.freshness,
      reviewState: row.review_state,
      content: row.content_json,
      evidenceRefs: row.evidence_refs_json,
      waiverDecisionId: row.waiver_decision_id,
      publishedBy: row.published_by,
    };
  }

  async publishInitiativeCardVersion(input: {
    organizationId: string;
    initiativeId: string;
    cardKey: string;
    cardVersion: number;
    aggregateVersion: number;
    applicability: 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';
    completion: 'EMPTY' | 'IN_PROGRESS' | 'COMPLETE';
    quality: 'UNKNOWN' | 'SUFFICIENT' | 'WARNING' | 'BLOCKER';
    freshness: 'CURRENT' | 'STALE' | 'SOURCE_UNAVAILABLE';
    reviewState: 'NOT_REQUESTED' | 'REQUESTED' | 'CHANGES_REQUESTED' | 'ACCEPTED';
    content: Record<string, unknown>;
    evidenceRefs: string[];
    waiverDecisionId: string | null;
    publishedBy: string;
  }): Promise<void> {
    const result = await this.client.query(
      `INSERT INTO ie_initiative_card_versions
        (organization_id, initiative_id, card_key, card_version, aggregate_version,
         applicability, completion, quality, freshness, review_state, content_json,
         evidence_refs_json, waiver_decision_id, published_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14)`,
      [
        input.organizationId,
        input.initiativeId,
        input.cardKey,
        input.cardVersion,
        input.aggregateVersion,
        input.applicability,
        input.completion,
        input.quality,
        input.freshness,
        input.reviewState,
        JSON.stringify(input.content),
        JSON.stringify(input.evidenceRefs),
        input.waiverDecisionId,
        input.publishedBy,
      ]
    );
    requireSingleRow(result, 'Initiative card publish');
  }

  async reviewInitiativeCardVersion(input: {
    organizationId: string;
    initiativeId: string;
    cardKey: string;
    fromCardVersion: number;
    toCardVersion: number;
    aggregateVersion: number;
    reviewState: 'CHANGES_REQUESTED' | 'ACCEPTED';
    decisionId: string;
    reviewedBy: string;
    rationale: string;
  }): Promise<void> {
    const result = await this.client.query(
      `INSERT INTO ie_initiative_card_versions
        (organization_id, initiative_id, card_key, card_version, aggregate_version,
         applicability, completion, quality, freshness, review_state, content_json,
         evidence_refs_json, waiver_decision_id, published_by, review_decision_id,
         reviewed_by, review_rationale)
       SELECT organization_id, initiative_id, card_key, $1, $2,
              applicability, completion, quality, freshness, $3, content_json,
              evidence_refs_json, waiver_decision_id, published_by, $4, $5, $6
         FROM ie_initiative_card_versions
        WHERE organization_id = $7 AND initiative_id = $8 AND card_key = $9
          AND card_version = $10`,
      [
        input.toCardVersion,
        input.aggregateVersion,
        input.reviewState,
        input.decisionId,
        input.reviewedBy,
        input.rationale,
        input.organizationId,
        input.initiativeId,
        input.cardKey,
        input.fromCardVersion,
      ]
    );
    requireSingleRow(result, 'Initiative card review');
  }

  async appendOutbox(entry: OutboxAppend): Promise<void> {
    const result = await this.client.query(
      `INSERT INTO ie_outbox_events
        (organization_id, aggregate_type, aggregate_id, aggregate_version, event_type,
         correlation_id, causation_id, payload_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        entry.organizationId,
        entry.aggregateType,
        entry.aggregateId,
        entry.aggregateVersion,
        entry.eventType,
        entry.correlationId,
        entry.causationId,
        JSON.stringify(entry.payload),
      ]
    );
    requireSingleRow(result, 'outbox append');
  }

  async saveReceipt<TResponse>(receipt: StoredCommandReceipt<TResponse>): Promise<void> {
    const result = await this.client.query(
      `INSERT INTO ie_command_receipts
        (organization_id, client_request_id, command_type, aggregate_type, aggregate_id,
         aggregate_version, correlation_id, request_fingerprint, response_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [
        receipt.organizationId,
        receipt.clientRequestId,
        receipt.commandType,
        receipt.aggregateType,
        receipt.aggregateId,
        receipt.aggregateVersion,
        receipt.correlationId,
        receipt.requestFingerprint,
        JSON.stringify(receipt.response),
      ]
    );
    requireSingleRow(result, 'receipt append');
  }
}

export class PostgresMaterialCommandUnitOfWork implements MaterialCommandUnitOfWork {
  constructor(private readonly pool: Pool) {}

  async transaction<T>(work: (transaction: MaterialCommandTransaction) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(new PostgresMaterialCommandTransaction(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original command failure. Connection disposal/recovery is Pool responsibility.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ZAPIS ZALEŻNOŚCI INICJATYWY (P15-K3, DEC-421, reguła 26A: pisarzem jest
   * runtime-v1, nie trasa legacy `execution-control`).
   *
   * `dependsOn` ZASTĘPUJE komplet poprzedników jednej inicjatywy w JEDNEJ
   * transakcji (usuń + wstaw), więc „odznacz ostatnią zależność" jest zwykłym
   * zapisem pustej listy, a nie osobną ścieżką kasowania. `project_id` bierzemy
   * z inicjatywy-następnika, bo kolumna ma klucz obcy do `projects` — nie wolno
   * wstawić tam wartości, której nie ma w tabeli projektów.
   */
  async replaceInitiativeDependencies(
    organizationId: string,
    initiativeId: string,
    dependsOn: string[],
    actorId: string
  ): Promise<string[]> {
    const unique = [...new Set(dependsOn.filter((id) => id && id !== initiativeId))].sort();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const owner = await client.query<{ project_id: string | null }>(
        `SELECT project_id FROM initiatives WHERE organization_id = $1 AND id = $2`,
        [organizationId, initiativeId]
      );
      if (!owner.rows.length) {
        await client.query('ROLLBACK');
        return [];
      }
      await client.query(
        `DELETE FROM initiative_dependencies WHERE organization_id = $1 AND from_initiative_id = $2`,
        [organizationId, initiativeId]
      );
      for (const dependencyId of unique) {
        await client.query(
          `INSERT INTO initiative_dependencies
             (id, organization_id, project_id, from_initiative_id, to_initiative_id, type, created_by)
           VALUES ($1, $2, $3, $4, $5, 'FINISH_TO_START', $6)`,
          [
            `idep-${organizationId}-${initiativeId}-${dependencyId}`.slice(0, 200),
            organizationId,
            owner.rows[0].project_id,
            initiativeId,
            dependencyId,
            actorId,
          ]
        );
      }
      await client.query('COMMIT');
      return unique;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Zachowaj oryginalny błąd zapisu; sprzątanie połączenia należy do Pool.
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
