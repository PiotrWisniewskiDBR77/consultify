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
}

interface DependencyRow {
  id: string;
  from_initiative_id: string;
  to_initiative_id: string;
  type: string;
}

const BLOCKED_LONG_DAYS = 5;
const SLA_WARNING_DAYS = 7;

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
             ${initiativeSelect('owner_business_id')}, ${initiativeSelect('owner_execution_id')}
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
          sourceData: { daysOverdue, plannedEnd: endDate },
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
          sourceData: { blockedDays, reason: init.blocked_reason },
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
          sourceData: { daysUntilSla, slaDeadline: init.sla_deadline },
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

    const raidQuery = `
      SELECT r.id, r.initiative_id, r.type, r.title, r.status, r.probability, r.impact,
             r.owner_id, r.mitigation_plan, r.mitigation_status, r.due_date
      FROM raid_items r
      WHERE r.organization_id = ?
        AND r.status NOT IN ('CLOSED', 'MITIGATED')
    `;
    const raidParams: unknown[] = [organizationId];
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
      const init = raid.initiative_id ? initMap.get(raid.initiative_id) : null;
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
          sourceData: { raidId: raid.id, impact: raid.impact },
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
          sourceData: { raidId: raid.id, impact: raid.impact, probability: raid.probability },
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
          sourceData: { raidId: raid.id, dueDate: raid.due_date },
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
