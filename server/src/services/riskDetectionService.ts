/**
 * Risk Detection Service (T040)
 *
 * Heuristic-based risk signal detection engine.
 * Scans initiatives for patterns that indicate emerging risks:
 *  - Overdue initiatives / tasks
 *  - Prolonged blocked state
 *  - Dependency conflicts
 *  - High/critical RAID items without owners or mitigations
 *  - SLA breach proximity
 */
import { all as dbAll } from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import {
  buildWorkRiskReadModel,
  type WorkRiskObservation,
  type WorkRiskRecord,
} from './execution/workRiskBoundary.js';
import { calculateRiskScore, categorizeScore, DEFAULT_THRESHOLDS } from './raidScoringService.js';

export interface RiskSignal {
  id: string;
  initiativeId: string;
  initiativeName: string;
  signalType:
    | 'OVERDUE'
    | 'BLOCKED_LONG'
    | 'DEPENDENCY_CONFLICT'
    | 'UNOWNED_RISK'
    | 'UNMITIGATED_HIGH_RISK'
    | 'APPETITE_BREACH'
    | 'SLA_BREACH'
    | 'CAPACITY_OVERLOAD'
    | 'BUDGET_RISK';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  suggestedAction: string;
  sourceData?: Record<string, unknown>;
}

type WorkRiskSourceData = {
  workRiskBoundary?: Pick<
    WorkRiskRecord,
    | 'sourceType'
    | 'sourceId'
    | 'riskState'
    | 'decisionLevel'
    | 'missingEvidence'
    | 'requiresHumanReview'
  >;
};

interface AppetiteThresholds {
  greenMax: number;
  amberMax: number;
  redMin: number;
  autoEscalateAbove: number;
}

/**
 * F3 — resolve the org-level risk appetite. Reads `raid_appetite_thresholds`
 * (org row); falls back to the canonical defaults when the table or row is
 * absent. `auto_escalate_above` was previously written but never read — this is
 * the reader that turns the dead appetite config into live escalation.
 */
async function loadOrgAppetite(organizationId: string): Promise<AppetiteThresholds> {
  const fallback: AppetiteThresholds = {
    ...DEFAULT_THRESHOLDS,
    autoEscalateAbove: DEFAULT_THRESHOLDS.redMin + 2,
  };
  try {
    const rows = (await dbAll(
      `SELECT green_max, amber_max, red_min, auto_escalate_above
       FROM raid_appetite_thresholds
       WHERE organization_id = ? AND initiative_id IS NULL
       LIMIT 1`,
      [organizationId]
    )) as Array<Record<string, unknown>>;
    const r = rows?.[0];
    if (!r) return fallback;
    return {
      greenMax: Number(r.green_max ?? DEFAULT_THRESHOLDS.greenMax),
      amberMax: Number(r.amber_max ?? DEFAULT_THRESHOLDS.amberMax),
      redMin: Number(r.red_min ?? DEFAULT_THRESHOLDS.redMin),
      autoEscalateAbove: Number(r.auto_escalate_above ?? fallback.autoEscalateAbove),
    };
  } catch {
    return fallback;
  }
}

interface InitiativeRow {
  id: string;
  name: string;
  status: string;
  priority: string;
  planned_end_date: string | null;
  planned_start_date: string | null;
  start_date: string | null;
  sla_deadline: string | null;
  blocked_reason: string | null;
  blocked_at: string | null;
  on_hold: boolean | null;
  progress: number | null;
  owner_business_id: string | null;
  owner_execution_id: string | null;
  project_id: string | null;
}

interface RaidRow {
  id: string;
  initiative_id: string;
  type: string;
  title: string;
  status: string;
  probability: string | null;
  impact: string | null;
  owner_id: string | null;
  mitigation_plan: string | null;
  mitigation_status: string | null;
  due_date: string | null;
  project_id: string | null;
}

interface DependencyRow {
  id: string;
  from_initiative_id: string;
  to_initiative_id: string;
  type: string;
}

const BLOCKED_LONG_DAYS = 5;
const SLA_WARNING_DAYS = 7;

function initiativeWorkState(init: InitiativeRow): WorkRiskObservation['workState'] {
  const status = String(init.status || '').toUpperCase();
  if (status === 'CLOSED' || status === 'DONE' || status === 'COMPLETED') return 'done';
  if (status === 'REJECTED' || status === 'CANCELLED' || status === 'CANCELED') return 'cancelled';
  if (init.on_hold) return 'blocked';
  if (status === 'PLANNED' || status === 'PENDING_APPROVAL' || status === 'DRAFT') return 'planned';
  return 'active';
}

function levelFromSeverity(severity: RiskSignal['severity']): 0 | 1 | 2 | 3 {
  if (severity === 'CRITICAL') return 3;
  if (severity === 'HIGH') return 2;
  if (severity === 'MEDIUM') return 1;
  return 0;
}

function boundarySummary(record: WorkRiskRecord): WorkRiskSourceData['workRiskBoundary'] {
  return {
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    riskState: record.riskState,
    decisionLevel: record.decisionLevel,
    missingEvidence: record.missingEvidence,
    requiresHumanReview: record.requiresHumanReview,
  };
}

function classifyInitiativeSignal(
  organizationId: string,
  init: InitiativeRow,
  input: {
    signalId: string;
    severity: RiskSignal['severity'];
    baselineImpact: WorkRiskObservation['baselineImpact'];
    reasonCode: string;
    evidenceRef: string;
    observedAt: Date;
  }
): WorkRiskSourceData {
  if (!init.project_id) return {};
  const readModel = buildWorkRiskReadModel({ organizationId, projectId: init.project_id }, [
    {
      organizationId,
      projectId: init.project_id,
      sourceType: 'initiative',
      sourceId: input.signalId,
      initiativeId: init.id,
      workState: initiativeWorkState(init),
      baselineImpact: input.baselineImpact,
      measuredLevel: levelFromSeverity(input.severity),
      reasonCode: input.reasonCode,
      observedAt: input.observedAt.toISOString(),
      evidenceRef: input.evidenceRef,
      generatedBy: 'system',
    },
  ]);
  const [record] = readModel.records;
  return record ? { workRiskBoundary: boundarySummary(record) } : {};
}

function classifyRaidSignal(
  organizationId: string,
  raid: RaidRow,
  init: InitiativeRow | null,
  input: {
    signalId: string;
    severity: RiskSignal['severity'];
    reasonCode: string;
    evidenceRef: string;
    observedAt: Date;
  }
): WorkRiskSourceData {
  const projectId = raid.project_id || init?.project_id;
  if (!projectId) return {};
  const readModel = buildWorkRiskReadModel({ organizationId, projectId }, [
    {
      organizationId,
      projectId,
      sourceType: 'report',
      sourceId: input.signalId,
      initiativeId: raid.initiative_id || null,
      workState: init ? initiativeWorkState(init) : 'active',
      baselineImpact: init ? 'within_initiative' : 'unknown',
      measuredLevel: levelFromSeverity(input.severity),
      reasonCode: input.reasonCode,
      observedAt: input.observedAt.toISOString(),
      evidenceRef: input.evidenceRef,
      generatedBy: 'system',
    },
  ]);
  const [record] = readModel.records;
  return record ? { workRiskBoundary: boundarySummary(record) } : {};
}

export async function detectRiskSignals(
  organizationId: string,
  projectId?: string
): Promise<RiskSignal[]> {
  const signals: RiskSignal[] = [];
  const now = new Date();

  try {
    // Respect dismissals so signals do not re-appear after refresh.
    const dismissedRows = ((await dbAll(
      `SELECT id FROM risk_signal_alerts WHERE organization_id = ? AND is_dismissed = TRUE`,
      [organizationId]
    )) || []) as Array<{ id: string }>;
    const dismissedIds = new Set(dismissedRows.map((r) => String(r.id)));

    const initiativeColumns = await getTableColumns('initiatives');
    const initiativeSelect = (column: string) =>
      initiativeColumns.has(column) ? column : `NULL as ${column}`;

    // DEC-424 (P12-int-c): DONE -> CLOSED, CANCELLED -> REJECTED; ARCHIVED is a flag.
    const archivedFilter = initiativeColumns.has('archived')
      ? `AND NOT COALESCE(archived, FALSE)`
      : '';
    let initQuery = `
      SELECT id, name, status, ${initiativeSelect('priority')}, ${initiativeSelect('planned_end_date')}, ${initiativeSelect('planned_start_date')},
             ${initiativeSelect('start_date')}, ${initiativeSelect('sla_deadline')}, ${initiativeSelect('blocked_reason')}, ${initiativeSelect('blocked_at')}, ${initiativeSelect('on_hold')}, ${initiativeSelect('progress')},
             ${initiativeSelect('owner_business_id')}, ${initiativeSelect('owner_execution_id')}, ${initiativeSelect('project_id')}
      FROM initiatives
      WHERE organization_id = ?
        AND status NOT IN ('CLOSED', 'REJECTED')
        ${archivedFilter}
    `;
    const initParams: unknown[] = [organizationId];
    if (projectId) {
      initQuery += ' AND project_id = ?';
      initParams.push(projectId);
    }

    const initiatives = ((await dbAll(initQuery, initParams)) || []) as InitiativeRow[];
    const initMap = new Map<string, InitiativeRow>();
    initiatives.forEach((i) => initMap.set(i.id, i));

    for (const init of initiatives) {
      if (init.status === 'CLOSED' || init.status === 'REJECTED') continue; // DEC-424 (P12-int-c)

      const endDate = init.planned_end_date || init.sla_deadline;
      if (endDate && new Date(endDate) < now) {
        const daysOverdue = Math.floor(
          (now.getTime() - new Date(endDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        const severity: RiskSignal['severity'] =
          daysOverdue > 14 ? 'CRITICAL' : daysOverdue > 7 ? 'HIGH' : 'MEDIUM';

        signals.push({
          id: `overdue-${init.id}`,
          initiativeId: init.id,
          initiativeName: init.name,
          signalType: 'OVERDUE',
          severity,
          title: `Overdue by ${daysOverdue} days`,
          description: `"${init.name}" was due ${new Date(endDate).toLocaleDateString()} and is ${daysOverdue} days overdue.`,
          suggestedAction:
            daysOverdue > 14
              ? 'Escalate to sponsor. Consider replanning or scope reduction.'
              : 'Review timeline with owner. Update planned end date or remove blockers.',
          sourceData: {
            daysOverdue,
            plannedEnd: endDate,
            ...classifyInitiativeSignal(organizationId, init, {
              signalId: `overdue-${init.id}`,
              severity,
              baselineImpact: 'approved_baseline',
              reasonCode: 'initiative_overdue',
              evidenceRef: `initiatives:${init.id}:planned_end_date`,
              observedAt: now,
            }),
          },
        });
      }
    }

    for (const init of initiatives) {
      if (!init.on_hold || !init.blocked_at) continue; // DEC-424 (P12-int-c): BLOCKED -> on_hold flag

      const blockedDays = Math.floor(
        (now.getTime() - new Date(init.blocked_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (blockedDays >= BLOCKED_LONG_DAYS) {
        const severity: RiskSignal['severity'] = blockedDays > 14 ? 'HIGH' : 'MEDIUM';
        signals.push({
          id: `blocked-${init.id}`,
          initiativeId: init.id,
          initiativeName: init.name,
          signalType: 'BLOCKED_LONG',
          severity,
          title: `Blocked for ${blockedDays} days`,
          description: `"${init.name}" has been blocked for ${blockedDays} days. Reason: ${init.blocked_reason || 'Not specified'}.`,
          suggestedAction:
            'Identify and escalate the blocker. Assign an owner to resolve it or consider alternative approaches.',
          sourceData: {
            blockedDays,
            reason: init.blocked_reason,
            ...classifyInitiativeSignal(organizationId, init, {
              signalId: `blocked-${init.id}`,
              severity,
              baselineImpact: 'within_initiative',
              reasonCode: 'initiative_blocked_long',
              evidenceRef: `initiatives:${init.id}:blocked_at`,
              observedAt: now,
            }),
          },
        });
      }
    }

    for (const init of initiatives) {
      if (init.status === 'CLOSED' || init.status === 'REJECTED') continue; // DEC-424 (P12-int-c)
      if (!init.sla_deadline) continue;

      const daysUntilSla = Math.floor(
        (new Date(init.sla_deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilSla > 0 && daysUntilSla <= SLA_WARNING_DAYS) {
        signals.push({
          id: `sla-${init.id}`,
          initiativeId: init.id,
          initiativeName: init.name,
          signalType: 'SLA_BREACH',
          severity: daysUntilSla <= 3 ? 'HIGH' : 'MEDIUM',
          title: `SLA deadline in ${daysUntilSla} days`,
          description: `"${init.name}" has an SLA deadline on ${new Date(init.sla_deadline).toLocaleDateString()}. Only ${daysUntilSla} days remain.`,
          suggestedAction:
            'Prioritize this initiative. Ensure resources are allocated and blockers removed.',
          sourceData: {
            daysUntilSla,
            slaDeadline: init.sla_deadline,
            ...classifyInitiativeSignal(organizationId, init, {
              signalId: `sla-${init.id}`,
              severity: daysUntilSla <= 3 ? 'HIGH' : 'MEDIUM',
              baselineImpact: 'approved_baseline',
              reasonCode: 'sla_breach_proximity',
              evidenceRef: `initiatives:${init.id}:sla_deadline`,
              observedAt: now,
            }),
          },
        });
      }
    }

    const depQuery = `
      SELECT id, from_initiative_id, to_initiative_id, type
      FROM initiative_dependencies
      WHERE organization_id = ?
    `;
    const depParams: unknown[] = [organizationId];
    const deps = ((await dbAll(depQuery, depParams)) || []) as DependencyRow[];

    for (const dep of deps) {
      const fromInit = initMap.get(dep.from_initiative_id);
      const toInit = initMap.get(dep.to_initiative_id);
      if (!fromInit || !toInit) continue;

      const predEnd = fromInit.planned_end_date;
      const succStart = toInit.planned_start_date || toInit.start_date;

      if (predEnd && succStart && new Date(succStart) < new Date(predEnd)) {
        signals.push({
          id: `depconflict-${dep.id}`,
          initiativeId: toInit.id,
          initiativeName: toInit.name,
          signalType: 'DEPENDENCY_CONFLICT',
          severity: 'HIGH',
          title: `Dependency conflict with "${fromInit.name}"`,
          description: `"${toInit.name}" starts before its predecessor "${fromInit.name}" ends. This creates a scheduling conflict.`,
          suggestedAction:
            'Adjust timelines: either delay the dependent initiative or accelerate the predecessor.',
          sourceData: {
            predecessorId: fromInit.id,
            predecessorEnd: predEnd,
            successorStart: succStart,
          },
        });
      }
    }

    let raidQuery = `
      SELECT r.id, r.initiative_id, r.type, r.title, r.status, r.probability, r.impact,
             r.owner_id, r.mitigation_plan, r.mitigation_status, r.due_date, i.project_id
      FROM raid_items r
      LEFT JOIN initiatives i ON i.id = r.initiative_id AND i.organization_id = r.organization_id
      WHERE r.organization_id = ?
        AND r.status NOT IN ('CLOSED', 'MITIGATED')
    `;
    const raidParams: unknown[] = [organizationId];
    if (projectId) {
      raidQuery += ' AND i.project_id = ?';
      raidParams.push(projectId);
    }
    const raidItems = ((await dbAll(raidQuery, raidParams)) || []) as RaidRow[];

    // F3 — risk appetite drives escalation. Read the org's appetite thresholds
    // (previously dead config: auto_escalate_above had zero readers). Falls back
    // to the canonical defaults when the table/row is absent.
    const appetite = await loadOrgAppetite(organizationId);

    for (const raid of raidItems) {
      if (raid.type !== 'RISK') continue;
      // Canonical classification (matches heatmap + action queue): "high" means
      // the P×I score is AMBER+RED, not merely a raw HIGH/CRITICAL impact.
      const riskScore = calculateRiskScore(
        String(raid.probability || ''),
        String(raid.impact || '')
      );
      const riskCategory = categorizeScore(riskScore, appetite);
      const isHighSeverity = riskCategory !== 'GREEN';
      const init = raid.initiative_id ? (initMap.get(raid.initiative_id) ?? null) : null;
      const initName = init?.name || 'Unlinked';

      if (isHighSeverity && !raid.owner_id) {
        signals.push({
          id: `unowned-risk-${raid.id}`,
          initiativeId: raid.initiative_id || '',
          initiativeName: initName,
          signalType: 'UNOWNED_RISK',
          severity: raid.impact === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          title: `High risk without owner: "${raid.title}"`,
          description: `Risk "${raid.title}" (${raid.impact} impact) has no assigned owner.`,
          suggestedAction:
            'Assign a risk owner immediately. High-impact risks must have clear ownership.',
          sourceData: {
            raidId: raid.id,
            impact: raid.impact,
            ...classifyRaidSignal(organizationId, raid, init, {
              signalId: `unowned-risk-${raid.id}`,
              severity: raid.impact === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
              reasonCode: 'risk_without_owner',
              evidenceRef: `raid_items:${raid.id}:owner_id`,
              observedAt: now,
            }),
          },
        });
      }

      if (
        isHighSeverity &&
        (!raid.mitigation_plan || raid.mitigation_plan.trim() === '') &&
        raid.mitigation_status === 'OPEN'
      ) {
        signals.push({
          id: `unmitigated-risk-${raid.id}`,
          initiativeId: raid.initiative_id || '',
          initiativeName: initName,
          signalType: 'UNMITIGATED_HIGH_RISK',
          severity: 'HIGH',
          title: `No mitigation for high risk: "${raid.title}"`,
          description: `Risk "${raid.title}" has ${raid.impact} impact but no mitigation plan defined.`,
          suggestedAction: 'Define a mitigation plan with owner, due date, and response strategy.',
          sourceData: {
            raidId: raid.id,
            impact: raid.impact,
            probability: raid.probability,
            ...classifyRaidSignal(organizationId, raid, init, {
              signalId: `unmitigated-risk-${raid.id}`,
              severity: 'HIGH',
              reasonCode: 'high_risk_without_mitigation',
              evidenceRef: `raid_items:${raid.id}:mitigation_plan`,
              observedAt: now,
            }),
          },
        });
      }

      // F3 — appetite breach: the score is at/above the org's auto-escalate
      // threshold. This is the reader that makes `auto_escalate_above` live.
      if (riskScore >= appetite.autoEscalateAbove) {
        signals.push({
          id: `appetite-breach-${raid.id}`,
          initiativeId: raid.initiative_id || '',
          initiativeName: initName,
          signalType: 'APPETITE_BREACH',
          severity: 'CRITICAL',
          title: `Risk above appetite: "${raid.title}"`,
          description: `Risk "${raid.title}" scores ${riskScore} (P×I), at or above the organisation's auto-escalate threshold of ${appetite.autoEscalateAbove}.`,
          suggestedAction:
            "Escalate to the sponsor now — this risk exceeds the organisation's risk appetite.",
          sourceData: {
            raidId: raid.id,
            score: riskScore,
            threshold: appetite.autoEscalateAbove,
            category: riskCategory,
            ...classifyRaidSignal(organizationId, raid, init, {
              signalId: `appetite-breach-${raid.id}`,
              severity: 'CRITICAL',
              reasonCode: 'risk_above_appetite',
              evidenceRef: `raid_items:${raid.id}:risk_score`,
              observedAt: now,
            }),
          },
        });
      }

      if (raid.due_date && new Date(raid.due_date) < now && raid.status === 'OPEN') {
        signals.push({
          id: `overdue-risk-${raid.id}`,
          initiativeId: raid.initiative_id || '',
          initiativeName: initName,
          signalType: 'OVERDUE',
          severity: 'MEDIUM',
          title: `Overdue RAID item: "${raid.title}"`,
          description: `RAID item "${raid.title}" was due ${new Date(raid.due_date).toLocaleDateString()} and has not been resolved.`,
          suggestedAction: 'Review and update the RAID item. Escalate if it is blocking progress.',
          sourceData: {
            raidId: raid.id,
            dueDate: raid.due_date,
            ...classifyRaidSignal(organizationId, raid, init, {
              signalId: `overdue-risk-${raid.id}`,
              severity: 'MEDIUM',
              reasonCode: 'raid_item_overdue',
              evidenceRef: `raid_items:${raid.id}:due_date`,
              observedAt: now,
            }),
          },
        });
      }
    }

    signals.sort((a, b) => {
      const sev = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (sev[b.severity] || 0) - (sev[a.severity] || 0);
    });

    return signals.filter((s) => !dismissedIds.has(String(s.id))).slice(0, 50);
  } catch (err) {
    // DEC-120/A1-A3: detectRiskSignals returns a plain array (RiskSignal[]) —
    // the shape cannot carry a degraded flag without a breaking contract
    // change (blok B). Until then, this loud log with tenant context is the
    // only trace an operator has that "0 risk signals" was actually a
    // failure. The caller (execution-control risk-signals route) is
    // expected to surface the failure to the client via a non-200/degraded
    // response rather than re-swallowing it.
    logger.error('[riskDetectionService] detectRiskSignals failed', {
      error: err instanceof Error ? err.message : String(err),
      organizationId,
      projectId,
    });
    return [];
  }
}
