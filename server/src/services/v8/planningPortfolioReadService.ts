// INI-04: the gate/transition constants are no longer read here directly — the
// approval profile comes from `initiativeCapabilityMatrix`, which owns them.
import { isScheduledOnward } from '../../constants/initiativeStatuses.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import {
  buildInitiativeCapabilityContract,
  computeApprovalProfile,
  computeInitiativeCapabilities,
  resolveInitiativeCapabilityContext,
} from '../initiative/initiativeCapabilityMatrix.js';
import { getBlockingReadinessItems } from '../initiative/initiativeGateReadinessService.js';
import { listInitiativeKpiAssignments } from '../initiative/initiativeKpiAssignmentService.js';
import {
  hasInitiativeStatusSchemaDrift,
  mapDbStatusToP11Lifecycle,
  normalizeInitiativeDbStatusForRead,
} from '../initiative/initiativeLifecycleCanon.js';

function isMissingPlanningSupportTableError(error: unknown, tableName: string): boolean {
  const message = String((error as any)?.message || error || '').toLowerCase();
  const normalizedTable = tableName.toLowerCase();
  return (
    (message.includes('no such table') || message.includes('does not exist')) &&
    message.includes(normalizedTable)
  );
}

export interface V8PlanningPortfolioReadFilters {
  projectId?: string;
  programId?: string;
  statuses?: string | string[];
  status?: string | string[];
  priority?: string | string[];
  search?: string;
}

export interface V8PlanningPortfolioStats {
  total: number;
  byStatus: Record<string, number>;
  executing: number;
  approved: number;
  review: number;
  blockedCount: number;
  done: number;
  totalBudget: number;
  totalValue: number;
  avgProgress: number;
}

const TASK_DEPENDENCY_SQL_SELECT = `
  CASE
    WHEN td.dependency_type IS NULL OR TRIM(CAST(td.dependency_type AS TEXT)) = '' THEN 'finish_to_start'
    ELSE LOWER(TRIM(CAST(td.dependency_type AS TEXT)))
  END as dependencyType,
  CASE
    WHEN td.lag_days IS NULL OR TRIM(CAST(td.lag_days AS TEXT)) = '' THEN 0
    ELSE CAST(td.lag_days AS INTEGER)
  END as lagDays
`;

const safeJsonParse = <T = unknown>(
  str: string | null | undefined,
  defaultValue: T[] = [] as T[]
): T[] => {
  if (!str || str === '' || str === 'null' || str === 'undefined') {
    return defaultValue;
  }
  try {
    const parsed = JSON.parse(str);
    return parsed || defaultValue;
  } catch {
    logger.warn('[v8-planning-portfolio] Failed to parse JSON payload');
    return defaultValue;
  }
};

const safeJsonParseObject = <T extends Record<string, unknown> = Record<string, unknown>>(
  str: string | null | undefined,
  fallback: T
): T => {
  if (!str || str === '' || str === 'null' || str === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as T;
    return fallback;
  } catch {
    return fallback;
  }
};

const parsePortfolioName = (name: string | unknown): string => {
  const value = String(name || 'Untitled Initiative');
  if (!value.startsWith('{')) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed.en || parsed.pl || value;
  } catch {
    return value;
  }
};

const getMultilingualText = (text: string | null | undefined, userLang: string = 'en'): string => {
  if (!text) return '';
  if (!text.startsWith('{') && !text.startsWith('[')) {
    return text;
  }

  try {
    const translations = JSON.parse(text);
    if (typeof translations === 'object' && translations !== null && !Array.isArray(translations)) {
      return (
        translations[userLang] ||
        translations.en ||
        translations[Object.keys(translations)[0]] ||
        text
      );
    }
    return text;
  } catch {
    return text;
  }
};

const collectRequestedStatuses = (filters: V8PlanningPortfolioReadFilters): string[] => {
  const out: string[] = [];
  const fromStatuses = String(filters.statuses || '')
    .split(',')
    .map((status) => status.trim())
    .filter(Boolean);
  out.push(...fromStatuses);

  if (Array.isArray(filters.status)) out.push(...filters.status);
  else if (filters.status) out.push(filters.status);

  return Array.from(
    new Set(out.map((status) => String(status || '').toUpperCase()).filter(Boolean))
  );
};

export async function getPortfolioRead(
  organizationId: string,
  filters: V8PlanningPortfolioReadFilters
): Promise<{ initiatives: Record<string, unknown>[]; stats: V8PlanningPortfolioStats }> {
  const priorities = Array.isArray(filters.priority)
    ? filters.priority
    : filters.priority
      ? [filters.priority]
      : [];
  const requestedStatuses = collectRequestedStatuses(filters);

  const params: Array<unknown> = [organizationId];
  let sql = `
        SELECT i.*,
            ob.first_name as ob_first_name, ob.last_name as ob_last_name, ob.avatar_url as ob_avatar,
            oe.first_name as oe_first_name, oe.last_name as oe_last_name, oe.avatar_url as oe_avatar
        FROM initiatives i
        LEFT JOIN users ob ON i.owner_business_id = ob.id
        LEFT JOIN users oe ON i.owner_execution_id = oe.id
        WHERE i.organization_id = ?
    `;

  if (filters.projectId) {
    sql += ` AND i.project_id = ?`;
    params.push(String(filters.projectId));
  }
  if (filters.programId) {
    sql += ` AND i.program_id = ?`;
    params.push(String(filters.programId));
  }
  if (priorities.length > 0) {
    const normalized = priorities
      .map((priority) => String(priority || '').toUpperCase())
      .filter(Boolean);
    if (normalized.length > 0) {
      sql += ` AND UPPER(COALESCE(i.priority,'')) IN (${normalized.map(() => '?').join(', ')})`;
      params.push(...normalized);
    }
  }
  if (filters.search) {
    const like = `%${String(filters.search).toLowerCase()}%`;
    sql += ` AND (
      LOWER(COALESCE(i.title, i.name, '')) LIKE ?
      OR LOWER(COALESCE(i.summary, '')) LIKE ?
      OR LOWER(COALESCE(i.hypothesis, '')) LIKE ?
    )`;
    params.push(like, like, like);
  }

  sql += ` ORDER BY i.created_at DESC`;

  const rows = await queryHelpers.queryAll(sql, params);

  let initiatives = rows.map((initiative: Record<string, unknown>) => {
    const budget =
      ((initiative.cost_capex as number) || 0) + ((initiative.cost_opex as number) || 0) ||
      (initiative.business_value as number) ||
      0;

    const normalizedStatus = normalizeInitiativeDbStatusForRead(initiative.status);
    return {
      id: initiative.id,
      organizationId: initiative.organization_id,
      projectId: initiative.project_id,
      programId: initiative.program_id ?? undefined,
      name: parsePortfolioName(initiative.title || initiative.name),
      title: parsePortfolioName(initiative.title || initiative.name),
      axis: initiative.axis || 'operational',
      area: initiative.area,
      summary: initiative.summary,
      hypothesis: initiative.hypothesis,
      status: normalizedStatus,
      displayStatus: normalizedStatus,
      p11LifecycleState: mapDbStatusToP11Lifecycle(initiative.status),
      statusReadDrift: hasInitiativeStatusSchemaDrift(initiative.status),
      progress: initiative.progress || 0,
      currentStage: initiative.current_stage,
      businessValue: initiative.business_value || 0,
      budget,
      costCapex: initiative.cost_capex || 0,
      costOpex: initiative.cost_opex || 0,
      expectedRoi: initiative.expected_roi || 0,
      valueDriver: initiative.value_driver,
      confidenceLevel: initiative.confidence_level || 'medium',
      valueTiming: initiative.value_timing,
      plannedStartDate: initiative.planned_start_date,
      plannedEndDate: initiative.planned_end_date,
      actualStartDate: initiative.actual_start_date,
      actualEndDate: initiative.actual_end_date,
      ownerId: initiative.owner_execution_id ?? initiative.owner_id ?? null,
      sponsorId: initiative.sponsor_id ?? null,
      priority: String(initiative.priority || 'MEDIUM').toUpperCase(),
      sourceId: initiative.source_id,
      sourceType: initiative.source_type,
      targetQuarter: initiative.planned_start_date
        ? `Q${Math.ceil((new Date(initiative.planned_start_date as string).getMonth() + 1) / 3)} ${new Date(initiative.planned_start_date as string).getFullYear()}`
        : undefined,
      ownerBusiness: initiative.owner_business_id
        ? {
            id: initiative.owner_business_id,
            firstName: initiative.ob_first_name,
            lastName: initiative.ob_last_name,
            avatarUrl: initiative.ob_avatar,
          }
        : null,
      ownerExecution: initiative.owner_execution_id
        ? {
            id: initiative.owner_execution_id,
            firstName: initiative.oe_first_name,
            lastName: initiative.oe_last_name,
            avatarUrl: initiative.oe_avatar,
          }
        : null,
      createdAt: initiative.created_at,
      updatedAt: initiative.updated_at,
    };
  });

  if (requestedStatuses.length > 0) {
    const statusSet = new Set(requestedStatuses);
    initiatives = initiatives.filter((initiative) =>
      statusSet.has(String(initiative.status || '').toUpperCase())
    );
  }

  const byStatus: Record<string, number> = {};
  initiatives.forEach((initiative) => {
    const status = String(initiative.status || '');
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  const total = initiatives.length;
  const totalBudget = initiatives.reduce(
    (sum, initiative) => sum + Number(initiative.budget || 0),
    0
  );
  const totalValue = initiatives.reduce(
    (sum, initiative) => sum + Number(initiative.businessValue || 0),
    0
  );

  return {
    initiatives,
    stats: {
      total,
      byStatus,
      executing: byStatus.EXECUTING || 0,
      approved: byStatus.APPROVED || 0,
      review: byStatus.REVIEW || 0,
      blockedCount: byStatus.BLOCKED || 0,
      done: byStatus.DONE || 0,
      totalBudget,
      totalValue,
      avgProgress:
        total > 0
          ? Math.round(
              initiatives.reduce((sum, initiative) => sum + Number(initiative.progress || 0), 0) /
                total
            )
          : 0,
    },
  };
}

export async function getInitiativeDetailRead(
  initiativeId: string,
  organizationId: string,
  userLang: string = 'en'
): Promise<Record<string, unknown> | null> {
  const sql = `
        SELECT i.*,
            ob.first_name as ob_first_name, ob.last_name as ob_last_name, ob.avatar_url as ob_avatar,
            oe.first_name as oe_first_name, oe.last_name as oe_last_name, oe.avatar_url as oe_avatar
        FROM initiatives i
        LEFT JOIN users ob ON i.owner_business_id = ob.id
        LEFT JOIN users oe ON i.owner_execution_id = oe.id
        WHERE i.id = ? AND i.organization_id = ?
    `;

  const initiative = await queryHelpers.queryOne(sql, [initiativeId, organizationId]);
  if (!initiative) return null;

  const row = initiative as Record<string, unknown>;
  const rawStatus = row.status;
  const displayStatus = normalizeInitiativeDbStatusForRead(rawStatus);
  const p11LifecycleState = mapDbStatusToP11Lifecycle(rawStatus);
  const statusReadDrift = hasInitiativeStatusSchemaDrift(rawStatus);
  // Structured charter (problemStructured, effortProfile, assumptions, strategicRole,
  // strategicIntent, valueTiming, confidenceLevel, competenciesRequired,
  // structuredSuccessCriteria, decisionToMake, applicantOneLiner, placementReason,
  // targetState.process/behavior/capability) is persisted inside target_state JSON.
  // Surface it top-level so the Initiative detail modal renders it. Purely additive:
  // fields are undefined when the charter is absent (legacy initiatives unaffected).
  const charter = safeJsonParseObject((row as any).target_state as string, {}) as Record<
    string,
    unknown
  >;

  return {
    ...initiative,
    name: getMultilingualText((row.name as string) || (row.title as string), userLang),
    summary: getMultilingualText(row.summary as string, userLang),
    description: getMultilingualText((row.hypothesis as string) || '', userLang),
    deliverables: safeJsonParse(row.deliverables as string, []),
    successCriteria: safeJsonParse(row.success_criteria as string, []),
    // H4.4 fix: was missing the camelCase alias (only `problem_statement` from the
    // `...initiative` spread), unlike every sibling field here — frontend already
    // defends with `data.problemStatement || data.problem_statement` (dual-shape
    // tolerance in InitiativeDocumentView.tsx), so this was latent, not
    // user-visible; making the read service consistent with its neighbors.
    problemStatement: row.problem_statement,
    scopeIn: safeJsonParse(row.scope_in as string, []),
    scopeOut: safeJsonParse(row.scope_out as string, []),
    killCriteria: safeJsonParse((row as any).kill_criteria as string, []),
    keyRisks: safeJsonParse(row.key_risks as string, []),
    tags: safeJsonParse((row as any).tags as string, []),
    resourceTools: safeJsonParse((row as any).resource_tools as string, []),
    estimatedBudget:
      (row as any).estimated_budget ??
      (row as any).estimatedBudget ??
      (row as any).budget_estimate ??
      null,
    ownerId: (row as any).owner_execution_id ?? (row as any).owner_id ?? null,
    sponsorId: (row as any).sponsor_id ?? null,
    plannedStartDate: (row as any).planned_start_date ?? (row as any).start_date ?? null,
    plannedEndDate: (row as any).planned_end_date ?? (row as any).end_date ?? null,
    baselineVersion: (row as any).baseline_version ? Number((row as any).baseline_version) : null,
    scheduleBaselineId: (row as any).schedule_baseline_id ?? null,
    targetState: charter,
    problemStructured: charter.problemStructured,
    structuredSuccessCriteria: charter.structuredSuccessCriteria,
    assumptions: charter.assumptions,
    effortProfile: charter.effortProfile,
    strategicRole: charter.strategicRole,
    strategicIntent: charter.strategicIntent,
    competenciesRequired: charter.competenciesRequired,
    decisionToMake: charter.decisionToMake,
    applicantOneLiner: charter.applicantOneLiner,
    placementReason: charter.placementReason,
    valueDriver: charter.valueDriver ?? (row as any).value_driver,
    businessValue: charter.businessValue ?? (row as any).business_value,
    valueTiming: charter.valueTiming ?? (row as any).value_timing,
    confidenceLevel: charter.confidenceLevel ?? (row as any).confidence_level,
    scope: {
      inScope: safeJsonParse(row.scope_in as string, []),
      outScope: safeJsonParse(row.scope_out as string, []),
      killCriteria: safeJsonParse((row as any).kill_criteria as string, []),
    },
    sourceType: row.source_type,
    sourceId: row.source_id,
    initiativeTemplateId: (row as any).initiative_template_id ?? null,
    actionContract: safeJsonParseObject((row as any).action_contract_json as string, {}),
    sourcePack: safeJsonParseObject((row as any).source_pack_json as string, {}),
    evidenceRefs: safeJsonParse((row as any).evidence_refs_json as string, []),
    aiGenerated: Boolean((row as any).ai_generated),
    displayStatus,
    p11LifecycleState,
    statusReadDrift,
  };
}

export async function getInitiativeTaskDependenciesRead(
  initiativeId: string,
  organizationId: string
): Promise<Record<string, unknown>[]> {
  const initiative = await queryHelpers.queryOne(
    `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
    [initiativeId, organizationId]
  );
  if (!initiative) return [];

  const dbToShort: Record<string, 'FS' | 'SS' | 'FF' | 'SF'> = {
    finish_to_start: 'FS',
    start_to_start: 'SS',
    finish_to_finish: 'FF',
    start_to_finish: 'SF',
    fs: 'FS',
    ss: 'SS',
    ff: 'FF',
    sf: 'SF',
    FS: 'FS',
    SS: 'SS',
    FF: 'FF',
    SF: 'SF',
  };

  let rows: any[] = [];
  try {
    rows = await queryHelpers.queryAll(
      `SELECT
        td.id,
        td.predecessor_id as "fromTaskId",
        td.successor_id as "toTaskId",
        ${TASK_DEPENDENCY_SQL_SELECT},
        td.notes,
        td.created_at as "createdAt",
        f.title as "fromTitle",
        f.status as "fromStatus",
        f.priority as "fromPriority",
        t.title as "toTitle",
        t.status as "toStatus",
        t.priority as "toPriority"
      FROM task_dependencies td
      JOIN tasks f ON f.id = td.predecessor_id
      JOIN tasks t ON t.id = td.successor_id
      WHERE f.organization_id = ?
        AND t.organization_id = ?
        AND f.initiative_id = ?
        AND t.initiative_id = ?
      ORDER BY td.created_at DESC`,
      [organizationId, organizationId, initiativeId, initiativeId]
    );
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (!msg.includes('no such column') && !msg.includes('does not exist')) throw err;
    rows = await queryHelpers.queryAll(
      `SELECT
        td.id,
        td.from_task_id as "fromTaskId",
        td.to_task_id as "toTaskId",
        ${TASK_DEPENDENCY_SQL_SELECT},
        td.notes,
        td.created_at as "createdAt",
        f.title as "fromTitle",
        f.status as "fromStatus",
        f.priority as "fromPriority",
        t.title as "toTitle",
        t.status as "toStatus",
        t.priority as "toPriority"
      FROM task_dependencies td
      JOIN tasks f ON f.id = td.from_task_id
      JOIN tasks t ON t.id = td.to_task_id
      WHERE f.organization_id = ?
        AND t.organization_id = ?
        AND f.initiative_id = ?
        AND t.initiative_id = ?
      ORDER BY td.created_at DESC`,
      [organizationId, organizationId, initiativeId, initiativeId]
    );
  }

  return (rows || []).flatMap((row: any) => {
    // node-pg folds UNQUOTED column aliases to lowercase (Postgres), while
    // SQLite preserves the camelCase. Read either case so the dependency ids
    // resolve on both — otherwise `row.fromTaskId` is undefined on Postgres and
    // the FE receives `sourceTaskId: "undefined"` (Gantt/deps render nothing).
    const g = (k: string): any => (row[k] !== undefined ? row[k] : row[k.toLowerCase()]);
    const fromTaskId = g('fromTaskId');
    const toTaskId = g('toTaskId');
    const typeKey = String(g('dependencyType') || 'finish_to_start').trim();
    const type = dbToShort[typeKey] || dbToShort[typeKey.toLowerCase()] || 'FS';
    const common = {
      dependencyType: type,
      lagDays: Number(g('lagDays') || 0) || 0,
      notes: g('notes') || undefined,
      createdAt: g('createdAt') || undefined,
    };

    return [
      {
        id: String(g('id')),
        sourceTaskId: String(toTaskId),
        taskId: String(fromTaskId),
        taskTitle: String(g('fromTitle') || ''),
        taskStatus: g('fromStatus') || undefined,
        taskPriority: g('fromPriority') || undefined,
        direction: 'predecessor',
        ...common,
      },
      {
        id: String(g('id')),
        sourceTaskId: String(fromTaskId),
        taskId: String(toTaskId),
        taskTitle: String(g('toTitle') || ''),
        taskStatus: g('toStatus') || undefined,
        taskPriority: g('toPriority') || undefined,
        direction: 'successor',
        ...common,
      },
    ];
  });
}

export async function getInitiativeStakeholdersRead(
  initiativeId: string,
  organizationId: string
): Promise<Record<string, unknown>[]> {
  try {
    const stakeholderCols = await getTableColumns('initiative_stakeholders');
    const selectFields = [
      's.id',
      's.initiative_id as "initiativeId"',
      's.user_id as "userId"',
      's.external_name as "externalName"',
      's.external_email as "externalEmail"',
      's.role',
      's.raci_type as "raciType"',
      stakeholderCols.has('influence_level')
        ? 's.influence_level as "influenceLevel"'
        : 'NULL as "influenceLevel"',
      stakeholderCols.has('interest_level')
        ? 's.interest_level as "interestLevel"'
        : 'NULL as "interestLevel"',
      's.created_at as "createdAt"',
      'u.first_name as "firstName"',
      'u.last_name as "lastName"',
      'u.email as email',
    ];
    return await queryHelpers.queryAll(
      `SELECT
        ${selectFields.join(',\n        ')}
      FROM initiative_stakeholders s
      JOIN initiatives i ON i.id = s.initiative_id
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.initiative_id = ? AND i.organization_id = ?
      ORDER BY s.created_at DESC`,
      [initiativeId, organizationId]
    );
  } catch (error) {
    if (isMissingPlanningSupportTableError(error, 'initiative_stakeholders')) {
      return [];
    }
    throw error;
  }
}

export async function getInitiativeWatchersRead(
  initiativeId: string,
  organizationId: string
): Promise<Record<string, unknown>[]> {
  try {
    return await queryHelpers.queryAll(
      `SELECT
        w.id,
        w.initiative_id as "initiativeId",
        w.user_id as "userId",
        w.created_at as "createdAt",
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.email as email
      FROM initiative_watchers w
      JOIN initiatives i ON i.id = w.initiative_id
      JOIN users u ON u.id = w.user_id
      WHERE w.initiative_id = ? AND i.organization_id = ?
      ORDER BY w.created_at DESC`,
      [initiativeId, organizationId]
    );
  } catch (error) {
    if (isMissingPlanningSupportTableError(error, 'initiative_watchers')) {
      return [];
    }
    throw error;
  }
}

export async function getInitiativeGateRolesRead(
  initiativeId: string,
  organizationId: string
): Promise<Record<string, unknown>[] | null> {
  const initiative = await queryHelpers.queryOne(
    `SELECT owner_business_id, owner_execution_id, sponsor_id
     FROM initiatives WHERE id = ? AND organization_id = ?`,
    [initiativeId, organizationId]
  );
  if (!initiative) return null;

  let explicitRoles: any[] = [];
  try {
    explicitRoles = await queryHelpers.queryAll(
      `SELECT
        gr.id,
        gr.initiative_id as "initiativeId",
        gr.gate_role as "gateRole",
        gr.user_id as "userId",
        gr.assigned_by as "assignedBy",
        gr.assigned_at as "assignedAt",
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.email
      FROM initiative_gate_roles gr
      LEFT JOIN users u ON u.id = gr.user_id
      WHERE gr.initiative_id = ?
      ORDER BY gr.gate_role, gr.assigned_at`,
      [initiativeId]
    );
  } catch {
    explicitRoles = [];
  }

  const derived: Array<Record<string, unknown>> = [];
  const row = initiative as Record<string, unknown>;
  if (row.owner_business_id) {
    derived.push({
      gateRole: 'INITIATIVE_OWNER',
      userId: row.owner_business_id,
      source: 'auto',
    });
    derived.push({
      gateRole: 'BUSINESS_OWNER',
      userId: row.owner_business_id,
      source: 'auto',
    });
  }
  if (row.owner_execution_id) {
    derived.push({
      gateRole: 'INITIATIVE_OWNER',
      userId: row.owner_execution_id,
      source: 'auto',
    });
  }
  if (row.sponsor_id) {
    derived.push({
      gateRole: 'PROJECT_SPONSOR',
      userId: row.sponsor_id,
      source: 'auto',
    });
  }

  const explicitKeys = new Set(
    explicitRoles.map((role: any) => `${role.gateRole}::${role.userId}`)
  );
  const mergedDerived = derived
    .filter((role) => !explicitKeys.has(`${role.gateRole}::${role.userId}`))
    .map((role) => ({ ...role, id: `derived-${role.gateRole}-${role.userId}` }));

  return [...explicitRoles.map((role: any) => ({ ...role, source: 'explicit' })), ...mergedDerived];
}

export async function getInitiativeStatusHistoryRead(
  initiativeId: string,
  organizationId: string
): Promise<Record<string, unknown>[]> {
  let rows: any[] = [];
  try {
    try {
      rows = await queryHelpers.queryAll(
        `SELECT
          h.id,
          h.initiative_id as "initiativeId",
          h.from_status as "fromStatus",
          h.to_status as "toStatus",
          h.changed_by as "changedBy",
          h.reason,
          h.gate_type as "gateType",
          h.created_at as "createdAt",
          u.first_name as "changedByFirstName",
          u.last_name as "changedByLastName",
          u.email as "changedByEmail"
        FROM initiative_status_history h
        LEFT JOIN users u ON u.id = h.changed_by
        WHERE h.initiative_id = ? AND h.organization_id = ?
        ORDER BY h.created_at DESC
        LIMIT 100`,
        [initiativeId, organizationId]
      );
    } catch (error: any) {
      const msg = String(error?.message || error || '').toLowerCase();
      const missingColumn =
        msg.includes('does not exist') ||
        msg.includes('no such column') ||
        msg.includes('gate_type') ||
        msg.includes('created_at') ||
        msg.includes('organization_id');

      if (!missingColumn) throw error;

      rows = await queryHelpers.queryAll(
        `SELECT
          h.id,
          h.initiative_id as "initiativeId",
          h.from_status as "fromStatus",
          h.to_status as "toStatus",
          h.changed_by as "changedBy",
          h.reason,
          NULL as "gateType",
          h.changed_at as "createdAt",
          u.first_name as "changedByFirstName",
          u.last_name as "changedByLastName",
          u.email as "changedByEmail"
        FROM initiative_status_history h
        LEFT JOIN users u ON u.id = h.changed_by
        JOIN initiatives i ON i.id = h.initiative_id AND i.organization_id = ?
        WHERE h.initiative_id = ?
        ORDER BY h.changed_at DESC
        LIMIT 100`,
        [organizationId, initiativeId]
      );
    }
  } catch {
    rows = [];
  }

  return rows;
}

export async function getInitiativeHistoryRead(
  initiativeId: string,
  organizationId: string
): Promise<Record<string, unknown>[]> {
  try {
    return await queryHelpers.queryAll(
      `SELECT
        h.id,
        h.initiative_id as "initiativeId",
        h.action as "eventType",
        h.changed_by as "actorId",
        h.changed_at as "createdAt",
        h.old_value as "oldValue",
        h.new_value as "newValue",
        h.notes
      FROM initiative_history h
      LEFT JOIN initiatives i ON i.id = h.initiative_id
      WHERE h.initiative_id = ? AND (i.organization_id = ? OR i.id IS NULL)
      ORDER BY h.changed_at DESC
      LIMIT 200`,
      [initiativeId, organizationId]
    );
  } catch (error) {
    if (isMissingPlanningSupportTableError(error, 'initiative_history')) {
      return [];
    }
    throw error;
  }
}

export async function getInitiativeCommentsRead(
  initiativeId: string,
  organizationId: string
): Promise<Record<string, unknown>[]> {
  let rows: any[] = [];
  try {
    rows = await queryHelpers.queryAll(
      `SELECT
        c.id,
        c.content,
        c.user_id as "authorId",
        c.created_at as "createdAt",
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.email as email
      FROM initiative_comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.initiative_id = ? AND c.organization_id = ?
      ORDER BY c.created_at DESC
      LIMIT 200`,
      [initiativeId, organizationId]
    );
  } catch (error) {
    if (isMissingPlanningSupportTableError(error, 'initiative_comments')) {
      return [];
    }
    throw error;
  }

  return rows.map((row: any) => {
    const authorName = `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.email || 'User';
    return {
      id: row.id,
      content: row.content,
      authorId: row.authorId,
      authorName,
      createdAt: row.createdAt,
      likes: 0,
      likedByMe: false,
    };
  });
}

export async function getInitiativeResourcesRead(
  initiativeId: string,
  organizationId: string
): Promise<Record<string, unknown>[]> {
  // INI-05: kept in sync with InitiativeController.getResources (the pmo
  // fallback for the same UI) — this is the READ PATH THE UI PREFERS
  // (`V8PlanningApi.getResources`, tried before the legacy fallback), so
  // `version` must appear here or the CAS contract silently never reaches
  // the client on the common path. `u.organization_id` join guard matches
  // the tenant-scope fix on the legacy copy.
  return queryHelpers.queryAll(
    `SELECT
      r.id,
      r.initiative_id as "initiativeId",
      r.user_id as "userId",
      r.name,
      r.role,
      r.allocation_percentage as "allocationPercentage",
      r.start_date as "startDate",
      r.end_date as "endDate",
      r.notes,
      r.source,
      r.version,
      u.first_name as "firstName",
      u.last_name as "lastName",
      u.avatar_url as "avatarUrl"
    FROM initiative_resources r
    LEFT JOIN users u ON r.user_id = u.id AND u.organization_id = r.organization_id
    WHERE r.initiative_id = ? AND r.organization_id = ?`,
    [initiativeId, organizationId]
  );
}

export async function getInitiativeGateReadinessRead(
  initiativeId: string,
  organizationId: string,
  currentUserId?: string | null,
  currentUserRole?: string | null
): Promise<Record<string, unknown> | null> {
  const initiative = await queryHelpers.queryOne(
    `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`,
    [initiativeId, organizationId]
  );
  if (!initiative) return null;

  const ini = initiative as any;
  const currentStatus = normalizeInitiativeDbStatusForRead(ini.status);

  // INI-04: same role profile (owner · sponsor · project role · gate roles ·
  // steering board · RACI) the writers resolve.
  const accessCtx =
    organizationId && currentUserId
      ? await resolveInitiativeCapabilityContext(
          organizationId,
          initiativeId,
          currentUserId,
          currentUserRole
        )
      : null;
  const steeringBoardEnabled = !!accessCtx?.steeringBoardEnabled;
  const userRoles = accessCtx?.effectiveRoles || [];

  const expandedAssignments: Array<{ gateRole: string; userId: string }> = [
    ...(accessCtx?.access?.roleAssignments || []),
  ];

  const projectId = accessCtx?.projectId ? String(accessCtx.projectId) : null;
  const mapProjectRoleToInitiativeGateRoles = (projectRole: string): string[] => {
    const role = String(projectRole || '')
      .trim()
      .toUpperCase();
    if (!role) return [];
    if (['PROJECT_SPONSOR', 'SPONSOR'].includes(role)) return ['PROJECT_SPONSOR'];
    if (
      [
        'PROJECT_LEADER',
        'PROJECT_LEAD',
        'PROJECT_MANAGER',
        'PMO_LEAD',
        'MANAGER',
        'TEAM_LEAD',
        'WORKSTREAM_OWNER',
      ].includes(role)
    ) {
      return ['PROJECT_MANAGER', 'PROJECT_LEAD'];
    }
    if (role === 'PMO') return ['PMO'];
    if (role === 'PORTFOLIO_OWNER') return ['PORTFOLIO_OWNER'];
    if (role === 'BUSINESS_OWNER') return ['BUSINESS_OWNER'];
    if (role === 'STEERING_COMMITTEE') return ['STEERING_COMMITTEE'];
    if (role === 'INITIATIVE_OWNER') return ['INITIATIVE_OWNER'];
    if (role === 'TEAM_MEMBER') return ['TEAM_MEMBER'];
    return [];
  };

  if (projectId) {
    try {
      const members = await queryHelpers.queryAll(
        `SELECT user_id as "userId", project_role as "projectRole"
         FROM project_members WHERE project_id = ?`,
        [projectId]
      );
      members.forEach((member: any) => {
        const userId = String(member?.userId || '');
        const projectRole = String(member?.projectRole || '');
        if (!userId || !projectRole) return;
        mapProjectRoleToInitiativeGateRoles(projectRole).forEach((gateRole) => {
          expandedAssignments.push({ gateRole, userId });
        });
      });
    } catch {
      // best-effort
    }

    if (steeringBoardEnabled) {
      try {
        const boardMembers = await queryHelpers.queryAll(
          `SELECT user_id as "userId"
           FROM project_steering_board_members
           WHERE project_id = ? AND UPPER(member_type) IN ('CHAIR','BOARD_MEMBER')`,
          [projectId]
        );
        boardMembers.forEach((member: any) => {
          const userId = String(member?.userId || '');
          if (userId) expandedAssignments.push({ gateRole: 'STEERING_COMMITTEE', userId });
        });
      } catch {
        // best-effort
      }
    }
  }

  // INI-04: approval profile from the canonical matrix (shared with the pmo
  // read model and with the transition writer).
  const availableTransitions = computeApprovalProfile({
    status: currentStatus,
    effectiveRoles: userRoles,
    steeringBoardEnabled,
    assignments: expandedAssignments,
  });

  const readiness: Record<string, unknown>[] = [];
  const addCheck = (
    key: string,
    label: string,
    pass: boolean,
    severity: string,
    suggestedAction?: string,
    suggestedActor?: string
  ) => {
    readiness.push({ key, label, pass, severity, suggestedAction, suggestedActor });
  };

  addCheck(
    'title',
    'Title defined',
    !!ini.name,
    'blocking',
    'Add a concise initiative title that clearly describes the change.',
    'Initiative Owner'
  );
  addCheck(
    'owner',
    'Owner assigned',
    !!(ini.owner_business_id || ini.owner_execution_id),
    'blocking',
    'Assign a business or execution owner who will be accountable.',
    'PMO / Project Manager'
  );

  if (['PENDING_REVIEW', 'REVIEW', 'PROMOTED', 'PLANNING'].includes(currentStatus)) {
    addCheck(
      'summary',
      'Summary / problem statement',
      !!(ini.summary || ini.problem_statement),
      'warning',
      'Write a 2-3 sentence summary explaining the business problem this initiative addresses.',
      'Initiative Owner'
    );
  }
  if (['REVIEW', 'PROMOTED', 'PLANNING', 'APPROVED'].includes(currentStatus)) {
    addCheck(
      'sponsor',
      'Sponsor assigned',
      !!ini.sponsor_id,
      'warning',
      'Nominate a senior leader who will champion and fund this initiative.',
      'PMO / Portfolio Owner'
    );
  }
  if (currentStatus === 'APPROVED') {
    const start = ini.planned_start_date || ini.start_date || null;
    const end = ini.planned_end_date || ini.end_date || null;
    addCheck(
      'timeline_dates',
      'Planned dates set (start + end)',
      !!(start && end),
      'blocking',
      'Set planned start and end dates before scheduling (baseline lock).',
      'Project Manager'
    );

    try {
      const milestones = await queryHelpers.queryOne(
        `SELECT COUNT(*) as c
         FROM initiative_milestones
         WHERE initiative_id = ? AND organization_id = ?`,
        [initiativeId, organizationId]
      );
      const count = Number((milestones as any)?.c || 0);
      addCheck(
        'schedule_milestones',
        'Milestones defined',
        count > 0,
        'blocking',
        'Add at least one milestone to lock the schedule baseline.',
        'Initiative Owner / Project Manager'
      );
    } catch (error: any) {
      const message = String(error?.message || error || '').toLowerCase();
      const missing =
        message.includes('no such table') ||
        message.includes('does not exist') ||
        message.includes('relation');
      addCheck(
        'schedule_milestones',
        missing ? 'Milestones schema available' : 'Milestones defined',
        false,
        'blocking',
        missing
          ? 'Milestones table is missing. Run migrations (initiative_milestones).'
          : 'Add at least one milestone to lock the schedule baseline.',
        'PMO / Platform Admin'
      );
    }
  }
  if (isScheduledOnward(currentStatus)) {
    const start = ini.planned_start_date || ini.start_date || null;
    const end = ini.planned_end_date || ini.end_date || null;
    addCheck(
      'timeline',
      'Timeline set',
      !!(start && end),
      'blocking',
      'Set planned start and end dates for baseline scheduling.',
      'Project Manager'
    );
    addCheck(
      'baseline',
      'Schedule baseline locked',
      Number(ini.baseline_version || 0) > 0,
      'warning',
      'Create a schedule baseline snapshot (re-schedule) to enable variance tracking.',
      'PMO / Project Manager'
    );
  }

  if (['PLANNING', 'APPROVED'].includes(currentStatus)) {
    addCheck(
      'scope',
      'Scope defined',
      !!(ini.scope || ini.objectives),
      'warning',
      'Define the scope or objectives so reviewers understand boundaries.',
      'Initiative Owner'
    );

    try {
      const riskCount = await queryHelpers.queryOne(
        `SELECT COUNT(*) as c FROM raid_items WHERE initiative_id = ? AND type = 'RISK'`,
        [initiativeId]
      );
      addCheck(
        'risks',
        'Risks identified',
        Number((riskCount as any)?.c || 0) > 0,
        'warning',
        'Identify at least one risk and its mitigation strategy.',
        'Initiative Owner / Risk Manager'
      );
    } catch {
      // best-effort
    }

    try {
      const taskCount = await queryHelpers.queryOne(
        `SELECT COUNT(*) as c FROM tasks WHERE initiative_id = ?`,
        [initiativeId]
      );
      addCheck(
        'tasks',
        'Tasks created',
        Number((taskCount as any)?.c || 0) > 0,
        'warning',
        'Break down the initiative into executable tasks.',
        'Project Manager / Initiative Owner'
      );
    } catch {
      // best-effort
    }
  }

  if (currentStatus === 'DONE') {
    addCheck(
      'benefits_owner',
      'Business Owner assigned (benefits owner)',
      !!ini.owner_business_id,
      'blocking',
      'Assign the business owner who will track realized benefits.',
      'PMO / Sponsor'
    );
    try {
      const kpiCount = await queryHelpers.queryOne(
        `SELECT COUNT(*) as c FROM initiative_kpis WHERE initiative_id = ?`,
        [initiativeId]
      );
      const totalCount = Number((kpiCount as any)?.c || 0);
      addCheck(
        'benefits_kpis',
        'KPIs defined',
        totalCount > 0,
        'blocking',
        'Define measurable KPIs that will prove business value.',
        'Business Owner'
      );

      const readyCount = await queryHelpers.queryOne(
        `SELECT COUNT(*) as c
         FROM initiative_kpis
         WHERE initiative_id = ?
           AND target_value IS NOT NULL
           AND unit IS NOT NULL`,
        [initiativeId]
      );
      const completedCount = Number((readyCount as any)?.c || 0);
      addCheck(
        'benefits_kpi_targets',
        'KPI targets + units defined',
        completedCount > 0,
        'warning',
        'Set numeric targets and units for each KPI.',
        'Business Owner'
      );
    } catch {
      addCheck('benefits_kpis', 'KPIs defined', false, 'blocking');
    }
  }

  const nextGates = availableTransitions.filter(
    (transition) => transition.gate && transition.gate !== 'CANCEL'
  );
  for (const transition of nextGates) {
    const missingRoles = ((transition.requiredRoles as string[]) || []).filter(
      (role: string) =>
        !expandedAssignments.some(
          (assignment) => String(assignment.gateRole).toUpperCase() === role
        )
    );
    if (missingRoles.length > 0) {
      addCheck(
        `gate_role_${String(transition.gate)}`,
        `Gate approver assigned for ${String(transition.gate)}: ${missingRoles.join(', ')}`,
        false,
        'warning',
        `Assign users to roles: ${missingRoles.join(', ')} so the gate can be approved.`,
        'PMO / Project Manager'
      );
    }
  }

  const capabilityDecision = computeInitiativeCapabilities({
    status: currentStatus,
    effectiveRoles: userRoles,
  });

  const blockingItems = await getBlockingReadinessItems(organizationId, initiativeId);

  return {
    currentStatus,
    userRoles,
    availableTransitions,
    passed: blockingItems.length === 0,
    missing: blockingItems.map((item) => ({
      section: item.section,
      field: item.field,
      requirement: item.requirement,
      key: item.key,
      label: item.label,
      suggestedAction: item.suggestedAction,
    })),
    capabilities: buildInitiativeCapabilityContract({
      decision: capabilityDecision,
      availableTransitions,
    }),
    readiness,
    allBlocking: blockingItems.length === 0,
    allWarnings: readiness.filter((item) => item.severity === 'warning' && !item.pass).length === 0,
  };
}

export async function getInitiativeKpisRead(
  initiativeId: string,
  organizationId: string
): Promise<Record<string, unknown>[] | null> {
  try {
    const assignments = await listInitiativeKpiAssignments(initiativeId, organizationId);
    return assignments.map((kpi) => ({
      id: kpi.id,
      mappingId: kpi.mappingId,
      initiativeId: kpi.initiativeId,
      name: kpi.name,
      description: kpi.description,
      category: kpi.category || 'benefits',
      unit: kpi.unit,
      baselineValue: kpi.baselineValue,
      targetValue: kpi.targetValue,
      currentValue: kpi.currentValue,
      latestValue: kpi.latestValue,
      latestMeasurementDate: kpi.latestMeasurementDate,
      progressPercentage: kpi.progressPercentage,
      status: kpi.status || 'on_track',
      measurementFrequency: kpi.measurementFrequency,
      createdAt: kpi.createdAt,
      updatedAt: kpi.updatedAt,
      isOnTarget: kpi.isOnTarget,
      definitionSource: kpi.definitionSource,
      observationPhase: kpi.observationPhase,
      trackedInRealization: kpi.trackedInRealization,
      trackedPostImplementation: kpi.trackedPostImplementation,
      observationStatus: kpi.observationStatus,
      realizationExpectation: kpi.realizationExpectation,
      postImplementationExpectation: kpi.postImplementationExpectation,
      trendData: [],
    }));
  } catch (error: any) {
    const message = String(error?.message || '');
    if (message.includes('Initiative not found')) return null;
    throw error;
  }
}

export async function getInitiativeBudgetItemsRead(
  initiativeId: string,
  organizationId: string
): Promise<Record<string, unknown>[]> {
  return queryHelpers.queryAll(
    `SELECT
      id,
      initiative_id as "initiativeId",
      category,
      cost_type as "costType",
      amount,
      currency,
      description,
      source,
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM initiative_budget_items
    WHERE initiative_id = ? AND organization_id = ?
    ORDER BY created_at ASC`,
    [initiativeId, organizationId]
  );
}

export async function getInitiativeToolsRead(
  initiativeId: string,
  organizationId: string
): Promise<Record<string, unknown>[]> {
  return queryHelpers.queryAll(
    `SELECT
      id,
      initiative_id as "initiativeId",
      name,
      category,
      vendor,
      license_cost as "licenseCost",
      license_type as "licenseType",
      status,
      notes,
      source,
      cost_type as "costType",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM initiative_tools
    WHERE initiative_id = ? AND organization_id = ?
    ORDER BY created_at ASC`,
    [initiativeId, organizationId]
  );
}

export async function getInitiativeIntangibleAssetsRead(
  initiativeId: string,
  organizationId: string
): Promise<Record<string, unknown>[]> {
  return queryHelpers.queryAll(
    `SELECT
      id,
      initiative_id as "initiativeId",
      asset_type as "assetType",
      name,
      provider,
      cost,
      currency,
      valid_from as "validFrom",
      valid_until as "validUntil",
      status,
      beneficiaries,
      notes,
      source,
      cost_type as "costType",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM initiative_intangible_assets
    WHERE initiative_id = ? AND organization_id = ?
    ORDER BY created_at ASC`,
    [initiativeId, organizationId]
  );
}

export async function getInitiativeRaidRead(
  initiativeId: string,
  organizationId: string,
  limit = 50
): Promise<Record<string, unknown>[]> {
  return queryHelpers.queryAll(
    `SELECT
      r.id,
      r.initiative_id as "initiativeId",
      LOWER(r.type) as type,
      r.title,
      r.description,
      r.status,
      r.impact as severity,
      r.probability,
      r.risk_score as "riskScore",
      r.score_category as "scoreCategory",
      r.owner_id as "ownerId",
      r.due_date as "dueDate",
      r.mitigation_plan as "mitigationPlan",
      r.response_strategy as "responseStrategy",
      r.mitigation_owner_id as "mitigationOwnerId",
      r.mitigation_due_date as "mitigationDueDate",
      r.mitigation_status as "mitigationStatus",
      r.created_at as "createdAt",
      r.updated_at as "updatedAt"
    FROM raid_items r
    WHERE r.organization_id = ? AND r.initiative_id = ?
    ORDER BY r.updated_at DESC
    LIMIT ?`,
    [organizationId, initiativeId, Number.isFinite(limit) ? limit : 50]
  );
}
