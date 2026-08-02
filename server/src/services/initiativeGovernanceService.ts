/**
 * Initiative Governance Service
 *
 * V4-INIT-04: Goals/OKR spine with rollup to initiatives
 * V4-INIT-06: AI initiative blueprint generator
 * V4-INIT-07: Decision governance + RAID gates
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

class InitiativeGovernanceService {
  // ── V4-INIT-04: Goals/OKR ──

  async createGoal(
    orgId: string,
    data: {
      parentGoalId?: string;
      goalType?: string;
      title: string;
      description?: string;
      ownerId?: string;
      timeFrame?: string;
      startDate?: string;
      endDate?: string;
      targetValue?: number;
      unit?: string;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO goals (id, organization_id, parent_goal_id, goal_type, title, description, owner_id, time_frame, start_date, end_date, target_value, unit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        orgId,
        data.parentGoalId ?? null,
        data.goalType ?? 'objective',
        data.title,
        data.description ?? null,
        data.ownerId ?? null,
        data.timeFrame ?? null,
        data.startDate ?? null,
        data.endDate ?? null,
        data.targetValue ?? null,
        data.unit ?? null,
      ]
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
    return queryHelpers.queryFirst(`SELECT * FROM goals WHERE id=$1 AND organization_id=$2`, [
      goalId,
      orgId,
    ]);
  }

  async updateGoal(
    orgId: string,
    goalId: string,
    data: Partial<{
      title: string;
      description: string;
      status: string;
      progress: number;
      currentValue: number;
      ownerId: string;
    }>
  ) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.title !== undefined) {
      sets.push(`title=$${idx++}`);
      params.push(data.title);
    }
    if (data.description !== undefined) {
      sets.push(`description=$${idx++}`);
      params.push(data.description);
    }
    if (data.status !== undefined) {
      sets.push(`status=$${idx++}`);
      params.push(data.status);
    }
    if (data.progress !== undefined) {
      sets.push(`progress=$${idx++}`);
      params.push(data.progress);
    }
    if (data.currentValue !== undefined) {
      sets.push(`current_value=$${idx++}`);
      params.push(data.currentValue);
    }
    if (data.ownerId !== undefined) {
      sets.push(`owner_id=$${idx++}`);
      params.push(data.ownerId);
    }

    if (sets.length === 0) return { ok: true };
    sets.push(`updated_at=CURRENT_TIMESTAMP`);
    params.push(goalId, orgId);
    await queryHelpers.queryRun(
      `UPDATE goals SET ${sets.join(', ')} WHERE id=$${idx++} AND organization_id=$${idx}`,
      params
    );
    return { ok: true };
  }

  async linkGoalToInitiative(orgId: string, goalId: string, initiativeId: string, weight?: number) {
    const goal = await this.getGoal(orgId, goalId);
    if (!goal) throw Object.assign(new Error('Goal not found'), { status: 404 });
    const init = await queryHelpers.queryFirst(
      `SELECT id FROM initiatives WHERE id=$1 AND organization_id=$2`,
      [initiativeId, orgId]
    );
    if (!init) throw Object.assign(new Error('Initiative not found'), { status: 404 });
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO goal_initiative_links (id, goal_id, initiative_id, contribution_weight)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (goal_id, initiative_id) DO UPDATE SET contribution_weight=$4`,
      [id, goalId, initiativeId, weight ?? 1.0]
    );
    return { id };
  }

  async getGoalInitiatives(orgId: string, goalId: string) {
    const goal = await this.getGoal(orgId, goalId);
    if (!goal) return [];
    return queryHelpers.queryAll(
      `SELECT gil.*, i.name as initiative_name, i.status as initiative_status
       FROM goal_initiative_links gil
       LEFT JOIN initiatives i ON i.id = gil.initiative_id
       WHERE gil.goal_id=$1 AND i.organization_id=$2 ORDER BY gil.created_at`,
      [goalId, orgId]
    );
  }

  async getGoalRollup(orgId: string, goalId: string) {
    // TENANT FAIL-CLOSED (RES-10): the org-scoped ownership lookup MUST short-circuit
    // before any rollup read. Previously a null result fell through, and the two reads
    // below carry NO organization_id — `SELECT * FROM goal_initiative_links WHERE
    // goal_id=$1` and `SELECT id, progress FROM goals WHERE parent_goal_id=$1` — so a
    // foreign goalId leaked link counts, child-goal counts and rollup progress with a
    // 200. Same guard shape as linkGoalToInitiative / unlinkGoalFromInitiative; the
    // route maps this null to 404 (as `GET /goals/:goalId` already does).
    const goal = await this.getGoal(orgId, goalId);
    if (!goal) return null;
    const links = await queryHelpers.queryAll<{
      contribution_weight: number;
      initiative_id: string;
    }>(`SELECT * FROM goal_initiative_links WHERE goal_id=$1`, [goalId]);
    const childGoals = await queryHelpers.queryAll<{ id: string; progress: number }>(
      `SELECT id, progress FROM goals WHERE parent_goal_id=$1`,
      [goalId]
    );
    const linkedInitiatives = await queryHelpers.queryAll<{
      id: string;
      progress: number;
      contribution_weight: number;
    }>(
      `SELECT i.id, COALESCE(i.progress, 0) as progress, COALESCE(gil.contribution_weight, 1.0) as contribution_weight
       FROM goal_initiative_links gil
       JOIN initiatives i ON i.id = gil.initiative_id
       WHERE gil.goal_id=$1 AND i.organization_id=$2`,
      [goalId, orgId]
    );

    let weightedProgress = 0;
    let totalWeight = 0;
    for (const child of childGoals) {
      weightedProgress += child.progress || 0;
      totalWeight += 1;
    }
    for (const initiative of linkedInitiatives) {
      const weight = initiative.contribution_weight || 1;
      weightedProgress += (initiative.progress || 0) * weight;
      totalWeight += weight;
    }
    const avgProgress = totalWeight > 0 ? weightedProgress / totalWeight : 0;

    return {
      goal,
      linkedInitiatives: links.length,
      childGoals: childGoals.length,
      initiativeProgressCount: linkedInitiatives.length,
      rollupProgress: avgProgress,
    };
  }

  async unlinkGoalFromInitiative(orgId: string, goalId: string, initiativeId: string) {
    const goal = await this.getGoal(orgId, goalId);
    if (!goal) throw Object.assign(new Error('Goal not found'), { status: 404 });
    await queryHelpers.queryRun(
      `DELETE FROM goal_initiative_links WHERE goal_id=$1 AND initiative_id=$2`,
      [goalId, initiativeId]
    );
    return { deleted: true };
  }

  // ── V4-INIT-06: AI Blueprint Generator ──

  async createBlueprint(
    orgId: string,
    data: {
      initiativeId?: string;
      promptText?: string;
      generatedWbs?: object[];
      generatedMilestones?: object[];
      generatedDeps?: object[];
      generatedResources?: object[];
      citations?: string[];
      aiModelUsed?: string;
      confidence?: number;
      createdBy: string;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO initiative_ai_blueprints (id, organization_id, initiative_id, prompt_text, generated_wbs, generated_milestones, generated_deps, generated_resources, citations, ai_model_used, confidence, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        orgId,
        data.initiativeId ?? null,
        data.promptText ?? null,
        JSON.stringify(data.generatedWbs ?? []),
        JSON.stringify(data.generatedMilestones ?? []),
        JSON.stringify(data.generatedDeps ?? []),
        JSON.stringify(data.generatedResources ?? []),
        JSON.stringify(data.citations ?? []),
        data.aiModelUsed ?? null,
        data.confidence ?? 0.0,
        data.createdBy,
      ]
    );
    return { id };
  }

  async getBlueprints(orgId: string, initiativeId?: string) {
    const sql = initiativeId
      ? `SELECT * FROM initiative_ai_blueprints WHERE organization_id=$1 AND initiative_id=$2 ORDER BY created_at DESC`
      : `SELECT * FROM initiative_ai_blueprints WHERE organization_id=$1 ORDER BY created_at DESC`;
    return queryHelpers.queryAll(sql, initiativeId ? [orgId, initiativeId] : [orgId]);
  }

  async applyBlueprint(orgId: string, blueprintId: string, userId: string) {
    const blueprint = await queryHelpers.queryFirst<any>(
      `SELECT * FROM initiative_ai_blueprints WHERE id=$1 AND organization_id=$2`,
      [blueprintId, orgId]
    );
    if (!blueprint) return { ok: false, reason: 'not_found' };
    if (!blueprint.initiative_id) return { ok: false, reason: 'initiative_missing' };
    if (blueprint.status === 'applied') {
      return { ok: true, reused: true, initiativeId: blueprint.initiative_id };
    }

    const wbs = safeJsonArray(blueprint.generated_wbs);
    const milestones = safeJsonArray(blueprint.generated_milestones);
    const deps = safeJsonArray(blueprint.generated_deps);
    const resources = safeJsonArray(blueprint.generated_resources);

    const taskMap = new Map<string, string>();
    const taskIds: string[] = [];
    const milestoneIds: string[] = [];
    const resourceIds: string[] = [];
    let tasksCreated = 0;
    let dependenciesCreated = 0;

    for (const [index, item] of wbs.entries()) {
      const normalized = normalizeBlueprintWbsItem(item, index);
      const taskId = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO tasks
           (id, project_id, organization_id, title, description, status, priority, assignee_id, due_date,
            estimated_hours, tags, task_type, initiative_id, progress, acceptance_criteria, created_at, updated_at)
         VALUES ($1,
           (SELECT project_id FROM initiatives WHERE id=$2 AND organization_id=$3),
           $3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$2,0,$13,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        [
          taskId,
          blueprint.initiative_id,
          orgId,
          normalized.title,
          normalized.description,
          normalized.status,
          normalized.priority,
          normalized.assigneeId,
          normalized.dueDate,
          normalized.estimatedHours,
          JSON.stringify(normalized.tags),
          normalized.taskType,
          normalized.acceptanceCriteria,
        ]
      );
      tasksCreated++;
      taskIds.push(taskId);
      for (const key of normalized.identityKeys) {
        taskMap.set(key, taskId);
      }
    }

    for (const dep of deps) {
      const normalized = normalizeBlueprintDependency(dep);
      const fromId = resolveBlueprintTaskRef(normalized.from, taskMap);
      const toId = resolveBlueprintTaskRef(normalized.to, taskMap);
      if (!fromId || !toId || fromId === toId) continue;
      await queryHelpers.queryRun(
        `INSERT INTO task_dependencies (id, from_task_id, to_task_id, type, created_at)
         VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)`,
        [uuidv4(), fromId, toId, normalized.type]
      );
      dependenciesCreated++;
    }

    for (const [index, item] of milestones.entries()) {
      const normalized = normalizeBlueprintMilestone(item, index);
      const milestoneId = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO initiative_milestones
           (id, initiative_id, organization_id, name, description, target_date, status, order_index, is_gate, gate_decision_id, created_at, updated_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,$11)`,
        [
          milestoneId,
          blueprint.initiative_id,
          orgId,
          normalized.name,
          normalized.description,
          normalized.targetDate,
          normalized.status,
          normalized.orderIndex,
          normalized.isGate ? 1 : 0,
          normalized.gateDecisionId,
          userId,
        ]
      );
      milestoneIds.push(milestoneId);
    }

    for (const resource of resources) {
      const normalized = normalizeBlueprintResource(resource);
      const resourceId = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO initiative_resources
           (id, initiative_id, organization_id, user_id, name, role, allocation_percentage, start_date, end_date, notes, created_at, updated_at, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'blueprint')`,
        [
          resourceId,
          blueprint.initiative_id,
          orgId,
          normalized.userId,
          normalized.name,
          normalized.role,
          normalized.allocationPercentage,
          normalized.startDate,
          normalized.endDate,
          normalized.notes,
        ]
      );
      resourceIds.push(resourceId);
    }

    await queryHelpers.queryRun(
      `UPDATE initiative_ai_blueprints
       SET status='applied', applied_at=CURRENT_TIMESTAMP
       WHERE id=$1 AND organization_id=$2`,
      [blueprintId, orgId]
    );

    const appliedAt = new Date().toISOString();
    let auditWritten = false;
    try {
      const histId = uuidv4();
      let citations: unknown[] = [];
      try {
        citations = safeJsonArray(blueprint.citations);
      } catch {
        citations = [];
      }
      // FIX (NOT-NULL sweep, same class as InitiativeController.ts fields_updated/
      // status_changed): initiative_history has no organization_id/actor_name/changes
      // columns, and changed_by is NOT NULL with no default — the previous statement
      // 42703'd on the nonexistent columns before changed_by was even checked, and the
      // failure was swallowed by this try/catch (auditWritten stayed false silently).
      await queryHelpers.queryRun(
        `INSERT INTO initiative_history (id, initiative_id, action, changed_by, changed_at, notes)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          histId,
          blueprint.initiative_id,
          'ai_blueprint_applied',
          userId || 'system',
          appliedAt,
          JSON.stringify({
            proposalId: blueprintId,
            actorId: userId,
            appliedAt,
            acceptedDiffSummary: {
              tasksCreated,
              dependenciesCreated,
              milestonesCreated: milestoneIds.length,
              resourcesCreated: resourceIds.length,
              wbsItemCount: wbs.length,
              milestoneProposalCount: milestones.length,
              dependencyProposalCount: deps.length,
              resourceProposalCount: resources.length,
            },
            citations,
          }),
        ]
      );
      auditWritten = true;
    } catch (auditErr) {
      auditWritten = false;
      const msg = auditErr instanceof Error ? auditErr.message : String(auditErr);
      logger.warn(`[P11] audit trail write failed for blueprint ${blueprintId}: ${msg}`);
    }

    return {
      ok: true,
      reused: false,
      auditWritten,
      initiativeId: blueprint.initiative_id,
      tasksCreated,
      dependenciesCreated,
      milestonesCreated: milestoneIds.length,
      resourcesCreated: resourceIds.length,
      createdTaskIds: taskIds,
      createdMilestoneIds: milestoneIds,
      createdResourceIds: resourceIds,
    };
  }

  async rejectBlueprint(orgId: string, blueprintId: string) {
    const result = await queryHelpers.queryRun(
      `UPDATE initiative_ai_blueprints SET status='rejected' WHERE id=$1 AND organization_id=$2`,
      [blueprintId, orgId]
    );
    return { ok: result.changes > 0 };
  }

  // ── V4-INIT-07: Governance Gates ──

  async createGovernanceGate(
    orgId: string,
    data: {
      initiativeId: string;
      gateType?: string;
      gateName: string;
      requiredDecisions?: string[];
      requiredRaidStatus?: object;
      requiredApprovers?: string[];
    }
  ) {
    const owner = await queryHelpers.queryFirst<{ id: string }>(
      `SELECT id FROM initiatives WHERE id = $1 AND organization_id = $2`,
      [data.initiativeId, orgId]
    );
    if (!owner) throw Object.assign(new Error('initiative_not_found'), { status: 404 });

    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO initiative_governance_gates (id, organization_id, initiative_id, gate_type, gate_name, required_decisions, required_raid_status, required_approvers)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id,
        orgId,
        data.initiativeId,
        data.gateType ?? 'phase_gate',
        data.gateName,
        JSON.stringify(data.requiredDecisions ?? []),
        JSON.stringify(data.requiredRaidStatus ?? {}),
        JSON.stringify(data.requiredApprovers ?? []),
      ]
    );
    return { id };
  }

  async getGovernanceGates(orgId: string, initiativeId: string) {
    return queryHelpers.queryAll(
      `SELECT * FROM initiative_governance_gates WHERE organization_id=$1 AND initiative_id=$2 ORDER BY created_at`,
      [orgId, initiativeId]
    );
  }

  async evaluateGate(orgId: string, gateId: string) {
    const gate = await queryHelpers.queryFirst<{
      required_decisions: string;
      required_approvers: string;
      required_raid_status: string;
      initiative_id: string;
    }>(`SELECT * FROM initiative_governance_gates WHERE id=$1 AND organization_id=$2`, [
      gateId,
      orgId,
    ]);
    if (!gate) return null;

    const requiredDecisions = JSON.parse(gate.required_decisions || '[]');
    const requiredApprovers = JSON.parse(gate.required_approvers || '[]');
    const requiredRaidStatus = JSON.parse(gate.required_raid_status || '{}');
    const decisionsMet: boolean[] = [];
    for (const decId of requiredDecisions) {
      // SECURITY (M13 cross-org): scope the decision lookup to the gate's org so
      // evaluation cannot probe another org's decision publish status by id.
      const dec = await queryHelpers.queryFirst<{ workflow_status: string }>(
        `SELECT workflow_status FROM decisions WHERE id=$1 AND organization_id=$2`,
        [decId, orgId]
      );
      decisionsMet.push(dec?.workflow_status === 'published');
    }

    const raidChecks = Object.entries(requiredRaidStatus as Record<string, unknown>);
    let raidReady = true;
    const raidDetails: Record<string, number> = {};
    for (const [statusKey, minRequired] of raidChecks) {
      const countRow = await queryHelpers.queryFirst<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM raid_items WHERE initiative_id=$1 AND organization_id=$2 AND lower(status)=lower($3)`,
        [gate.initiative_id, orgId, statusKey]
      );
      const count = Number(countRow?.cnt ?? 0);
      raidDetails[statusKey] = count;
      if (count < Number(minRequired ?? 0)) raidReady = false;
    }

    let approversReady = true;
    const approverDetails: Array<{ userId: string; approved: boolean }> = [];
    for (const approverId of requiredApprovers as string[]) {
      const approved =
        decisionsMet.length > 0
          ? !!(await queryHelpers.queryFirst(
              `SELECT id FROM decisions
             WHERE initiative_id=$1 AND lower(workflow_status)='published' AND approved_by=$2
             LIMIT 1`,
              [gate.initiative_id, approverId]
            ))
          : !!approverId;
      approverDetails.push({ userId: approverId, approved });
      if (!approved) approversReady = false;
    }

    const allDecisionsMet = decisionsMet.every(Boolean);
    const result = {
      decisionsReady: allDecisionsMet,
      decisionDetails: decisionsMet,
      raidReady,
      raidDetails,
      approversReady,
      approverDetails,
    };
    const status = allDecisionsMet && raidReady && approversReady ? 'passed' : 'blocked';

    await queryHelpers.queryRun(
      `UPDATE initiative_governance_gates SET status=$1, evaluated_at=CURRENT_TIMESTAMP, evaluation_result=$2 WHERE id=$3`,
      [status, JSON.stringify(result), gateId]
    );

    return { status, ...result };
  }

  async linkDecisionToInitiative(
    orgId: string,
    initiativeId: string,
    decisionId: string,
    linkType?: string
  ) {
    const init = await queryHelpers.queryFirst(
      `SELECT id FROM initiatives WHERE id=$1 AND organization_id=$2`,
      [initiativeId, orgId]
    );
    if (!init) throw Object.assign(new Error('Initiative not found'), { status: 404 });
    // SECURITY (M13 cross-org): the decision being linked must also belong to the
    // caller's org — otherwise org A could attach org B's decision id as a gate
    // dependency (and later probe its status via evaluateGate).
    const dec = await queryHelpers.queryFirst(
      `SELECT id FROM decisions WHERE id=$1 AND organization_id=$2`,
      [decisionId, orgId]
    );
    if (!dec) throw Object.assign(new Error('Decision not found'), { status: 404 });
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO initiative_decision_links (id, initiative_id, decision_id, link_type)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (initiative_id, decision_id) DO UPDATE SET link_type=$4`,
      [id, initiativeId, decisionId, linkType ?? 'required']
    );
    return { id };
  }

  async getInitiativeDecisions(orgId: string, initiativeId: string) {
    const init = await queryHelpers.queryFirst(
      `SELECT id FROM initiatives WHERE id=$1 AND organization_id=$2`,
      [initiativeId, orgId]
    );
    if (!init) return [];
    return queryHelpers.queryAll(
      `SELECT idl.*, d.title as decision_title, d.workflow_status
       FROM initiative_decision_links idl
       LEFT JOIN decisions d ON d.id = idl.decision_id
       WHERE idl.initiative_id=$1 ORDER BY idl.created_at`,
      [initiativeId]
    );
  }
}

export const initiativeGovernanceService = new InitiativeGovernanceService();

function safeJsonArray(value: unknown): any[] {
  if (!value) return [];
  try {
    return Array.isArray(value) ? value : JSON.parse(String(value));
  } catch {
    return [];
  }
}

function normalizeBlueprintWbsItem(item: any, index: number) {
  const title = String(item?.title || item?.name || item?.label || `Task ${index + 1}`).trim();
  const identityKeys = [item?.id, item?.key, item?.templateKey, item?.ref, title, String(index)]
    .filter(Boolean)
    .map((value) => String(value));

  return {
    title,
    description: item?.description || item?.deliverables || null,
    status: String(item?.status || 'todo').toLowerCase(),
    priority: String(item?.priority || 'medium').toLowerCase(),
    assigneeId: item?.assigneeId || item?.ownerId || null,
    dueDate: item?.dueDate || item?.targetDate || null,
    estimatedHours: item?.estimatedHours ?? item?.effortHours ?? null,
    tags: Array.isArray(item?.tags) ? item.tags.map(String) : [],
    taskType: item?.taskType || 'task',
    acceptanceCriteria: item?.acceptanceCriteria || null,
    identityKeys,
  };
}

function normalizeBlueprintDependency(dep: any) {
  return {
    from: dep?.from || dep?.fromId || dep?.source || dep?.sourceId || dep?.predecessor,
    to: dep?.to || dep?.toId || dep?.target || dep?.targetId || dep?.successor,
    type: dep?.type || dep?.dependencyType || 'hard',
  };
}

function resolveBlueprintTaskRef(ref: unknown, taskMap: Map<string, string>): string | null {
  if (!ref) return null;
  const direct = taskMap.get(String(ref));
  return direct ?? null;
}

function normalizeBlueprintMilestone(item: any, index: number) {
  return {
    name: String(item?.name || item?.title || `Milestone ${index + 1}`).trim(),
    description: item?.description || null,
    targetDate: item?.targetDate || item?.date || null,
    status: item?.status || 'PENDING',
    orderIndex: item?.orderIndex ?? item?.order ?? index,
    isGate: Boolean(item?.isGate || item?.gateDecisionId),
    gateDecisionId: item?.gateDecisionId || null,
  };
}

function normalizeBlueprintResource(item: any) {
  return {
    userId: item?.userId || null,
    name: item?.name || item?.role || 'Team Member',
    role: item?.role || 'member',
    allocationPercentage: item?.allocationPercentage ?? item?.allocationPct ?? 100,
    startDate: item?.startDate || null,
    endDate: item?.endDate || null,
    notes:
      item?.notes || (Array.isArray(item?.skills) ? `Skills: ${item.skills.join(', ')}` : null),
  };
}
