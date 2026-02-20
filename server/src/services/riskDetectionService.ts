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
import logger from '../utils/Logger.js';

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
    | 'SLA_BREACH'
    | 'CAPACITY_OVERLOAD'
    | 'BUDGET_RISK';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  suggestedAction: string;
  sourceData?: Record<string, unknown>;
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
    let initQuery = `
      SELECT id, name, status, priority, planned_end_date, planned_start_date,
             start_date, sla_deadline, blocked_reason, blocked_at, progress,
             owner_business_id, owner_execution_id
      FROM initiatives
      WHERE organization_id = ?
        AND status NOT IN ('DONE', 'CANCELLED', 'ARCHIVED')
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
      if (init.status === 'DONE' || init.status === 'CANCELLED') continue;

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
      if (init.status !== 'BLOCKED' || !init.blocked_at) continue;

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
      if (init.status === 'DONE' || init.status === 'CANCELLED') continue;
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
          suggestedAction: 'Prioritize this initiative. Ensure resources are allocated and blockers removed.',
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
          suggestedAction: 'Adjust timelines: either delay the dependent initiative or accelerate the predecessor.',
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

    for (const raid of raidItems) {
      if (raid.type !== 'RISK') continue;
      const isHighSeverity = raid.impact === 'HIGH' || raid.impact === 'CRITICAL';
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
          suggestedAction: 'Assign a risk owner immediately. High-impact risks must have clear ownership.',
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

    return signals.slice(0, 50);
  } catch (err) {
    logger.error('Risk detection failed', err);
    return [];
  }
}
