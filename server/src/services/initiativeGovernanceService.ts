/**
 * Initiative Governance Service
 *
 * V4-INIT-04: Goals/OKR spine with rollup to initiatives
 * V4-INIT-06: AI initiative blueprint generator
 * V4-INIT-07: Decision governance + RAID gates
 */

import { v4 as uuidv4 } from 'uuid';
import * as queryHelpers from '../utils/queryHelpers.js';

class InitiativeGovernanceService {

  // ── V4-INIT-04: Goals/OKR ──

  async createGoal(orgId: string, data: {
    parentGoalId?: string; goalType?: string; title: string; description?: string;
    ownerId?: string; timeFrame?: string; startDate?: string; endDate?: string;
    targetValue?: number; unit?: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO goals (id, organization_id, parent_goal_id, goal_type, title, description, owner_id, time_frame, start_date, end_date, target_value, unit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, orgId, data.parentGoalId ?? null, data.goalType ?? 'objective',
       data.title, data.description ?? null, data.ownerId ?? null,
       data.timeFrame ?? null, data.startDate ?? null, data.endDate ?? null,
       data.targetValue ?? null, data.unit ?? null],
    );
    return { id };
  }

  async getGoals(orgId: string, parentGoalId?: string) {
    const sql = parentGoalId
      ? `SELECT * FROM goals WHERE organization_id=$1 AND parent_goal_id=$2 ORDER BY created_at`
      : `SELECT * FROM goals WHERE organization_id=$1 ORDER BY created_at`;
    return queryHelpers.queryAll(sql, parentGoalId ? [orgId, parentGoalId] : [orgId]);
  }

  async getGoal(orgId: string, goalId: string) {
    return queryHelpers.queryFirst(
      `SELECT * FROM goals WHERE id=$1 AND organization_id=$2`, [goalId, orgId],
    );
  }

  async updateGoal(orgId: string, goalId: string, data: Partial<{
    title: string; description: string; status: string; progress: number;
    currentValue: number; ownerId: string;
  }>) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.title !== undefined) { sets.push(`title=$${idx++}`); params.push(data.title); }
    if (data.description !== undefined) { sets.push(`description=$${idx++}`); params.push(data.description); }
    if (data.status !== undefined) { sets.push(`status=$${idx++}`); params.push(data.status); }
    if (data.progress !== undefined) { sets.push(`progress=$${idx++}`); params.push(data.progress); }
    if (data.currentValue !== undefined) { sets.push(`current_value=$${idx++}`); params.push(data.currentValue); }
    if (data.ownerId !== undefined) { sets.push(`owner_id=$${idx++}`); params.push(data.ownerId); }

    if (sets.length === 0) return { ok: true };
    sets.push(`updated_at=CURRENT_TIMESTAMP`);
    params.push(goalId, orgId);
    await queryHelpers.queryRun(
      `UPDATE goals SET ${sets.join(', ')} WHERE id=$${idx++} AND organization_id=$${idx}`, params,
    );
    return { ok: true };
  }

  async linkGoalToInitiative(goalId: string, initiativeId: string, weight?: number) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO goal_initiative_links (id, goal_id, initiative_id, contribution_weight)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (goal_id, initiative_id) DO UPDATE SET contribution_weight=$4`,
      [id, goalId, initiativeId, weight ?? 1.0],
    );
    return { id };
  }

  async getGoalInitiatives(goalId: string) {
    return queryHelpers.queryAll(
      `SELECT gil.*, i.name as initiative_name, i.status as initiative_status
       FROM goal_initiative_links gil
       LEFT JOIN initiatives i ON i.id = gil.initiative_id
       WHERE gil.goal_id=$1 ORDER BY gil.created_at`,
      [goalId],
    );
  }

  async getGoalRollup(orgId: string, goalId: string) {
    const goal = await this.getGoal(orgId, goalId);
    const links = await queryHelpers.queryAll<{ contribution_weight: number; initiative_id: string }>(
      `SELECT * FROM goal_initiative_links WHERE goal_id=$1`, [goalId],
    );
    const childGoals = await queryHelpers.queryAll<{ id: string; progress: number }>(
      `SELECT id, progress FROM goals WHERE parent_goal_id=$1`, [goalId],
    );

    let weightedProgress = 0;
    let totalWeight = 0;
    for (const child of childGoals) {
      weightedProgress += (child.progress || 0);
      totalWeight += 1;
    }
    const avgProgress = totalWeight > 0 ? weightedProgress / totalWeight : 0;

    return { goal, linkedInitiatives: links.length, childGoals: childGoals.length, rollupProgress: avgProgress };
  }

  async unlinkGoalFromInitiative(goalId: string, initiativeId: string) {
    await queryHelpers.queryRun(
      `DELETE FROM goal_initiative_links WHERE goal_id=$1 AND initiative_id=$2`,
      [goalId, initiativeId],
    );
    return { deleted: true };
  }

  // ── V4-INIT-06: AI Blueprint Generator ──

  async createBlueprint(orgId: string, data: {
    initiativeId?: string; promptText?: string; generatedWbs?: object[];
    generatedMilestones?: object[]; generatedDeps?: object[];
    generatedResources?: object[]; citations?: string[];
    aiModelUsed?: string; confidence?: number; createdBy: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO initiative_ai_blueprints (id, organization_id, initiative_id, prompt_text, generated_wbs, generated_milestones, generated_deps, generated_resources, citations, ai_model_used, confidence, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, orgId, data.initiativeId ?? null, data.promptText ?? null,
       JSON.stringify(data.generatedWbs ?? []), JSON.stringify(data.generatedMilestones ?? []),
       JSON.stringify(data.generatedDeps ?? []), JSON.stringify(data.generatedResources ?? []),
       JSON.stringify(data.citations ?? []), data.aiModelUsed ?? null,
       data.confidence ?? 0.0, data.createdBy],
    );
    return { id };
  }

  async getBlueprints(orgId: string, initiativeId?: string) {
    const sql = initiativeId
      ? `SELECT * FROM initiative_ai_blueprints WHERE organization_id=$1 AND initiative_id=$2 ORDER BY created_at DESC`
      : `SELECT * FROM initiative_ai_blueprints WHERE organization_id=$1 ORDER BY created_at DESC`;
    return queryHelpers.queryAll(sql, initiativeId ? [orgId, initiativeId] : [orgId]);
  }

  async applyBlueprint(blueprintId: string) {
    await queryHelpers.queryRun(
      `UPDATE initiative_ai_blueprints SET status='applied', applied_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [blueprintId],
    );
    return { ok: true };
  }

  async rejectBlueprint(blueprintId: string) {
    await queryHelpers.queryRun(
      `UPDATE initiative_ai_blueprints SET status='rejected' WHERE id=$1`, [blueprintId],
    );
    return { ok: true };
  }

  // ── V4-INIT-07: Governance Gates ──

  async createGovernanceGate(orgId: string, data: {
    initiativeId: string; gateType?: string; gateName: string;
    requiredDecisions?: string[]; requiredRaidStatus?: object;
    requiredApprovers?: string[];
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO initiative_governance_gates (id, organization_id, initiative_id, gate_type, gate_name, required_decisions, required_raid_status, required_approvers)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, orgId, data.initiativeId, data.gateType ?? 'phase_gate', data.gateName,
       JSON.stringify(data.requiredDecisions ?? []),
       JSON.stringify(data.requiredRaidStatus ?? {}),
       JSON.stringify(data.requiredApprovers ?? [])],
    );
    return { id };
  }

  async getGovernanceGates(orgId: string, initiativeId: string) {
    return queryHelpers.queryAll(
      `SELECT * FROM initiative_governance_gates WHERE organization_id=$1 AND initiative_id=$2 ORDER BY created_at`,
      [orgId, initiativeId],
    );
  }

  async evaluateGate(orgId: string, gateId: string) {
    const gate = await queryHelpers.queryFirst<{
      required_decisions: string; required_approvers: string; initiative_id: string;
    }>(
      `SELECT * FROM initiative_governance_gates WHERE id=$1 AND organization_id=$2`,
      [gateId, orgId],
    );
    if (!gate) return null;

    const requiredDecisions = JSON.parse(gate.required_decisions || '[]');
    const decisionsMet: boolean[] = [];
    for (const decId of requiredDecisions) {
      const dec = await queryHelpers.queryFirst<{ workflow_status: string }>(
        `SELECT workflow_status FROM decisions WHERE id=$1`, [decId],
      );
      decisionsMet.push(dec?.workflow_status === 'published');
    }

    const allDecisionsMet = decisionsMet.every(Boolean);
    const result = { decisionsReady: allDecisionsMet, decisionDetails: decisionsMet };
    const status = allDecisionsMet ? 'passed' : 'blocked';

    await queryHelpers.queryRun(
      `UPDATE initiative_governance_gates SET status=$1, evaluated_at=CURRENT_TIMESTAMP, evaluation_result=$2 WHERE id=$3`,
      [status, JSON.stringify(result), gateId],
    );

    return { status, ...result };
  }

  async linkDecisionToInitiative(initiativeId: string, decisionId: string, linkType?: string) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO initiative_decision_links (id, initiative_id, decision_id, link_type)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (initiative_id, decision_id) DO UPDATE SET link_type=$4`,
      [id, initiativeId, decisionId, linkType ?? 'required'],
    );
    return { id };
  }

  async getInitiativeDecisions(initiativeId: string) {
    return queryHelpers.queryAll(
      `SELECT idl.*, d.title as decision_title, d.workflow_status
       FROM initiative_decision_links idl
       LEFT JOIN decisions d ON d.id = idl.decision_id
       WHERE idl.initiative_id=$1 ORDER BY idl.created_at`,
      [initiativeId],
    );
  }
}

export const initiativeGovernanceService = new InitiativeGovernanceService();
