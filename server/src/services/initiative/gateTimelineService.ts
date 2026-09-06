/**
 * Initiative Gate AI — timeline analyzer (M13 Depth · Fala 1 / sub-moduł G3).
 *
 * SSOT spec: docs/product/INITIATIVE_GATE_AI_SPEC.md §4 ("Wymiar czasowy").
 *
 * Produces TIMELINE (na linii czasu) flags for the two planning gates
 * (SCHEDULE, START). Non-planning gates never run timeline analysis and the
 * function returns null for them. The analyzer is purely advisory: a `block`
 * flag contributes to the soft-block; `warn` only informs.
 *
 * Contract (imported, NOT redefined here):
 *  - GateAiTimeline / TimelineFlag — server/src/types/gateAi.ts
 *  - gateHasTimelineCheck          — server/src/constants/initiativeGateAi.ts
 *  - GateTypeValue                 — server/src/constants/initiativeStatuses.ts
 *
 * Findings (schema recon — see PostgresDatabase.ts):
 *  - Dependency table `initiative_dependencies` (CREATE @ PostgresDatabase.ts:2137):
 *      from_initiative_id = PREDECESSOR, to_initiative_id = SUCCESSOR,
 *      type DEFAULT 'FINISH_TO_START', organization_id NOT NULL.
 *    For a finish-to-start edge, when analyzing the SUCCESSOR (this initiative)
 *    the predecessor is `from_initiative_id`. Mirrors the join already used in
 *    delayDetectionService.ts:122-129.
 *  - Initiative date columns (CREATE @ PostgresDatabase.ts:1968):
 *      planned_start_date / planned_end_date (preferred) + start_date / end_date.
 *      Owner columns: owner_execution_id / owner_business_id.
 *
 * FAIL-OPEN: any query error returns null (never throw into the request path).
 */
import { gateHasTimelineCheck } from '../../constants/initiativeGateAi.js';
import {
  GateType,
  type GateTypeValue,
  InitiativeStatus,
  type InitiativeStatusType,
} from '../../constants/initiativeStatuses.js';
import type { GateAiTimeline, TimelineFlag } from '../../types/gateAi.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

/**
 * Predecessor statuses that mean a finish-to-start dependency is NOT yet ready.
 * Anything earlier than SCHEDULED (i.e. still in the draft/review/planning
 * pipeline) blocks the successor's planning gate. SCHEDULED and onward
 * (EXECUTING, DONE, TRACKING, …) are considered ready.
 */
const UNREADY_DEPENDENCY_STATUSES: ReadonlySet<string> = new Set<InitiativeStatusType>([
  InitiativeStatus.DRAFT,
  InitiativeStatus.PENDING_APPROVAL,
]);

interface InitiativeTimelineRow {
  id: string;
  status?: string | null;
  owner_execution_id?: string | null;
  owner_business_id?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

interface DependencyRow {
  dep_id: string;
  from_initiative_id: string;
  from_name?: string | null;
  from_status?: string | null;
}

interface ConflictRow {
  id: string;
  name?: string | null;
  status?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

/** Pick the effective start/end for an initiative row (planned_* wins). */
function effectiveWindow(row: {
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}): { start: number | null; end: number | null } {
  const startRaw = row.planned_start_date ?? row.start_date ?? null;
  const endRaw = row.planned_end_date ?? row.end_date ?? null;
  const start = startRaw ? new Date(startRaw).getTime() : null;
  const end = endRaw ? new Date(endRaw).getTime() : null;
  return {
    start: start !== null && !Number.isNaN(start) ? start : null,
    end: end !== null && !Number.isNaN(end) ? end : null,
  };
}

/** Two date windows overlap when each starts on/before the other one ends. */
function windowsOverlap(
  a: { start: number | null; end: number | null },
  b: { start: number | null; end: number | null }
): boolean {
  // Need at least one bound on each side to reason about overlap.
  const aStart = a.start ?? a.end;
  const aEnd = a.end ?? a.start;
  const bStart = b.start ?? b.end;
  const bEnd = b.end ?? b.start;
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) {
    return false;
  }
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Build timeline flags for a planning gate (SCHEDULE / START).
 *
 * @returns null when the gate is not a planning gate OR on any DB error
 *          (fail-open). Otherwise a GateAiTimeline with 0..n flags.
 */
export async function getTimelineFlags(
  initiativeId: string,
  gate: GateTypeValue,
  organizationId: string
): Promise<GateAiTimeline | null> {
  // Only SCHEDULE and START run timeline analysis (GATE_AI_SPEC §4).
  if (!gateHasTimelineCheck(gate)) {
    return null;
  }

  try {
    const flags: TimelineFlag[] = [];

    // ── Load the target initiative (org-scoped) for owner + window ──────────
    const subject = await queryHelpers.queryOne<InitiativeTimelineRow>(
      `SELECT id, status, owner_execution_id, owner_business_id,
              planned_start_date, planned_end_date, start_date, end_date
       FROM initiatives
       WHERE id = ? AND organization_id = ?`,
      [initiativeId, organizationId]
    );

    // Subject missing (or org mismatch) → nothing to analyze, no flags.
    if (!subject) {
      return { flags };
    }

    // ── 1 · DEPENDENCY readiness (finish-to-start predecessors) ─────────────
    // This initiative is the SUCCESSOR (to_initiative_id); predecessors are
    // from_initiative_id. A predecessor whose status is earlier than SCHEDULED
    // is not ready → 'block'. Org-scoped on both the edge and the predecessor.
    const deps = await queryHelpers.queryAll<DependencyRow>(
      `SELECT dep.id AS dep_id,
              dep.from_initiative_id AS from_initiative_id,
              pred.name AS from_name,
              pred.status AS from_status
       FROM initiative_dependencies dep
       JOIN initiatives pred
         ON pred.id = dep.from_initiative_id
        AND pred.organization_id = dep.organization_id
       WHERE dep.to_initiative_id = ?
         AND dep.organization_id = ?
         AND UPPER(COALESCE(dep.type, 'FINISH_TO_START')) = 'FINISH_TO_START'`,
      [initiativeId, organizationId]
    );

    for (const dep of deps || []) {
      const predStatus = String(dep.from_status || '').toUpperCase();
      if (UNREADY_DEPENDENCY_STATUSES.has(predStatus)) {
        const label = dep.from_name || dep.from_initiative_id;
        flags.push({
          severity: 'block',
          kind: 'dependency',
          message: `Zależność "${label}" niegotowa (status ${predStatus || 'UNKNOWN'}).`,
          refs: [dep.from_initiative_id],
        });
      }
    }

    // ── 2 · DATE conflict (same owner, overlapping window, SCHEDULED) ───────
    const subjectWindow = effectiveWindow(subject);
    const ownerId = subject.owner_execution_id || subject.owner_business_id || null;

    if (ownerId && (subjectWindow.start !== null || subjectWindow.end !== null)) {
      const conflicts = await queryHelpers.queryAll<ConflictRow>(
        `SELECT id, name, status,
                planned_start_date, planned_end_date, start_date, end_date
         FROM initiatives
         WHERE organization_id = ?
           AND id <> ?
           AND UPPER(status) = ?
           AND (owner_execution_id = ? OR owner_business_id = ?)`,
        [organizationId, initiativeId, InitiativeStatus.APPROVED, ownerId, ownerId]
      );

      for (const other of conflicts || []) {
        const otherWindow = effectiveWindow(other);
        if (windowsOverlap(subjectWindow, otherWindow)) {
          const label = other.name || other.id;
          flags.push({
            severity: 'warn',
            kind: 'date_conflict',
            message: `Okno terminów nakłada się z zaplanowaną inicjatywą "${label}" tego samego właściciela.`,
            refs: [other.id],
          });
        }
      }
    }

    // ── 3 · RESOURCE conflict — SKIPPED ─────────────────────────────────────
    // No per-window resource/assignee allocation table exists in the current
    // schema (initiatives only carry owner_* user refs, already used by the
    // date-conflict check above; resource_tools is a free-text JSON list, not a
    // time-windowed allocation). Implementing a real resource_conflict flag
    // would require inventing a schema, which the G3 brief forbids. Per spec
    // (§4 + brief), the function shape is kept and resource flags are skipped.
    logger.info(
      '[gateTimelineService] resource_conflict check skipped (no time-windowed resource allocation table in schema)'
    );

    return { flags };
  } catch (err) {
    // FAIL-OPEN: never throw into the request path; absence of a timeline
    // result means "do not soft-block on timeline" (GATE_AI_SPEC §0/§8).
    logger.error('[gateTimelineService] getTimelineFlags failed — failing open (null):', err);
    return null;
  }
}

// Re-export so callers/tests have an explicit handle on the gate guard origin.
export { GateType };
