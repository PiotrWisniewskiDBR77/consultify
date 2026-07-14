/**
 * initiativeLineageService — Uspójnienie F5.1 + F5.2 (observability of the chain).
 *
 * The initiative is the spine of the product chain:
 *
 *   ŹRÓDŁO (analiza/insight/idea)  →  INICJATYWA  →  WYKONANIE (execution)  →  REZULTATY (benefits/KPI)
 *
 * Nothing on the server exposed that chain as data. These two read-only aggregates do:
 *
 *   F5.1  getInitiativeLineage(orgId, initiativeId)
 *         One initiative's chain: where it came from (source_type/source_id), its
 *         current status, and what it produced downstream (execution status +
 *         tracked benefits/KPIs from benefits_register, if that table exists).
 *
 *   F5.2  getInitiativeFunnel(orgId)
 *         Org-wide funnel: counts per status, per source_type, and the
 *         created → in-execution → tracking conversion of the whole portfolio.
 *
 * Strictly org-scoped. Fail-safe against schema drift: every optional column /
 * optional table (benefits_register) is guarded with getTableColumns so a missing
 * table degrades to a null/empty branch instead of throwing. Read-only — never
 * mutates anything.
 */

import * as queryHelpers from '../../utils/queryHelpers.js';
import { mapDbStatusToP11Lifecycle } from './initiativeLifecycleCanon.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LineageSource {
  type: string;
  id: string;
}

export interface LineageBenefit {
  kpi: string;
}

export interface InitiativeLineage {
  source: LineageSource | null;
  initiative: {
    id: string;
    title: string;
    status: string;
  };
  downstream: {
    executionStatus?: string;
    benefits?: LineageBenefit[];
  };
}

export interface InitiativeFunnel {
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  conversion: {
    created: number;
    inExecution: number;
    tracking: number;
    conversionPct: number;
  };
  /**
   * F5.2 cycle-time (Z94 §3.2/§5.2 delta): average days spent IN a status
   * before the org's initiatives transitioned OUT of it, derived from
   * `initiative_status_history`. Only statuses with at least one completed
   * transition are included. Advisory / read-only — degrades to `[]` on
   * schema drift or when the history table is empty.
   */
  cycleTime: CycleTimeStage[];
}

export interface CycleTimeStage {
  status: string;
  avgDays: number;
  count: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if `table` exists and exposes ALL of `cols`. Never throws — schema
 * drift / missing table / introspection failure all degrade to false so callers
 * can take a safe empty branch.
 */
async function tableHasColumns(table: string, cols: string[]): Promise<boolean> {
  try {
    const columns = await queryHelpers.getTableColumns(table);
    if (!Array.isArray(columns) || columns.length === 0) return false;
    const have = new Set(columns.map((c) => String(c.name)));
    return cols.every((c) => have.has(c));
  } catch {
    return false;
  }
}

/** Lifecycle buckets that count as "in execution" for the funnel/lineage. */
const EXECUTION_BUCKETS = new Set(['executing', 'blocked']);
/** Lifecycle buckets that count as "delivered/tracking" (rezultaty) for the funnel. */
const TRACKING_BUCKETS = new Set(['delivered', 'closed']);

/**
 * F5.2 cycle-time: average days an org's initiatives dwelt IN each status
 * before transitioning OUT of it, computed from `initiative_status_history`.
 *
 * Grouped and averaged in JS (not SQL) so the computation stays portable
 * across the SQLite (dev) / Postgres (prod) split without relying on window
 * functions — history volume per org is small (one row per transition).
 * Fail-safe: any schema drift or query error degrades to `[]`.
 */
async function getCycleTimeByStage(orgId: string): Promise<CycleTimeStage[]> {
  if (
    !(await tableHasColumns('initiative_status_history', [
      'initiative_id',
      'organization_id',
      'from_status',
      'to_status',
      'created_at',
    ]))
  ) {
    return [];
  }

  try {
    const rows = await queryHelpers.queryAll<Record<string, unknown>>(
      `SELECT initiative_id, from_status, to_status, created_at
         FROM initiative_status_history
        WHERE organization_id = ?
        ORDER BY initiative_id ASC, created_at ASC`,
      [orgId]
    );

    // Group transitions per initiative, in order, so we can pair each
    // transition with the PREVIOUS one to know how long the initiative sat
    // in the status it is now leaving.
    const byInitiative = new Map<string, Array<{ status: string; at: number }>>();
    for (const r of rows || []) {
      const initId = String(r.initiative_id || '');
      if (!initId) continue;
      const at = new Date(String(r.created_at)).getTime();
      if (!Number.isFinite(at)) continue;
      const list = byInitiative.get(initId) || [];
      list.push({ status: String(r.from_status || ''), at });
      byInitiative.set(initId, list);
    }

    const dwellByStatus = new Map<string, number[]>();
    for (const transitions of byInitiative.values()) {
      for (let i = 1; i < transitions.length; i++) {
        const enteredAt = transitions[i - 1].at;
        const leftStatus = transitions[i].status;
        const leftAt = transitions[i].at;
        const days = (leftAt - enteredAt) / (1000 * 60 * 60 * 24);
        if (!Number.isFinite(days) || days < 0 || !leftStatus) continue;
        const arr = dwellByStatus.get(leftStatus) || [];
        arr.push(days);
        dwellByStatus.set(leftStatus, arr);
      }
    }

    const out: CycleTimeStage[] = [];
    for (const [status, days] of dwellByStatus.entries()) {
      const avgDays = days.reduce((a, b) => a + b, 0) / days.length;
      out.push({ status, avgDays: Math.round(avgDays * 10) / 10, count: days.length });
    }
    return out.sort((a, b) => b.avgDays - a.avgDays);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// F5.1 — Lineage
// ---------------------------------------------------------------------------

/**
 * Chain for ONE initiative: source → initiative → execution → results.
 * Org-scoped. Returns null only if the initiative does not resolve in the org
 * (so a foreign org cannot confirm existence).
 */
export async function getInitiativeLineage(
  orgId: string,
  initiativeId: string
): Promise<InitiativeLineage | null> {
  if (!orgId || !initiativeId) return null;

  const row = await queryHelpers.queryOne<Record<string, unknown>>(
    `SELECT id,
            COALESCE(title, name, '') AS title,
            COALESCE(status, '')      AS status,
            source_type,
            source_id
       FROM initiatives
      WHERE id = ? AND organization_id = ?
      LIMIT 1`,
    [initiativeId, orgId]
  );
  if (!row) return null;

  const status = String(row.status || 'DRAFT');
  const source: LineageSource | null = row.source_type
    ? { type: String(row.source_type), id: row.source_id != null ? String(row.source_id) : '' }
    : null;

  // Downstream: execution status is derived from the canonical lifecycle bucket of
  // the persisted status (no separate execution table is guaranteed). When the
  // initiative is in/after execution we surface the bucket; otherwise we omit it.
  const lifecycle = mapDbStatusToP11Lifecycle(status);
  const downstream: InitiativeLineage['downstream'] = {};
  if (EXECUTION_BUCKETS.has(lifecycle) || TRACKING_BUCKETS.has(lifecycle)) {
    downstream.executionStatus = lifecycle;
  }

  // Benefits: only if benefits_register exists and is wired by initiative_id.
  if (await tableHasColumns('benefits_register', ['initiative_id', 'organization_id'])) {
    try {
      const benefitRows = await queryHelpers.queryAll<Record<string, unknown>>(
        `SELECT COALESCE(kpi_name, name, '') AS kpi
           FROM benefits_register
          WHERE initiative_id = ? AND organization_id = ?
          ORDER BY created_at DESC
          LIMIT 200`,
        [initiativeId, orgId]
      );
      const benefits = (benefitRows || [])
        .map((b) => ({ kpi: String(b.kpi || '').trim() }))
        .filter((b) => b.kpi.length > 0);
      if (benefits.length > 0) downstream.benefits = benefits;
    } catch {
      // Degrade silently — benefits are an optional downstream signal.
    }
  }

  return {
    source,
    initiative: { id: String(row.id), title: String(row.title || ''), status },
    downstream,
  };
}

// ---------------------------------------------------------------------------
// F5.2 — Funnel
// ---------------------------------------------------------------------------

/**
 * Org-wide funnel aggregates. Single GROUP BY for status, single GROUP BY for
 * source_type, and a conversion summary (created → in-execution → tracking)
 * derived from the canonical lifecycle bucket of each status. Org-scoped.
 */
export async function getInitiativeFunnel(orgId: string): Promise<InitiativeFunnel> {
  const empty: InitiativeFunnel = {
    byStatus: {},
    bySource: {},
    conversion: { created: 0, inExecution: 0, tracking: 0, conversionPct: 0 },
    cycleTime: [],
  };
  if (!orgId) return empty;

  // byStatus — one GROUP BY.
  let statusRows: Array<Record<string, unknown>> = [];
  try {
    statusRows = await queryHelpers.queryAll<Record<string, unknown>>(
      `SELECT COALESCE(status, 'DRAFT') AS status, COUNT(*) AS cnt
         FROM initiatives
        WHERE organization_id = ?
        GROUP BY COALESCE(status, 'DRAFT')`,
      [orgId]
    );
  } catch {
    return empty;
  }

  const byStatus: Record<string, number> = {};
  let created = 0;
  let inExecution = 0;
  let tracking = 0;
  for (const r of statusRows) {
    const status = String(r.status || 'DRAFT');
    const cnt = Number(r.cnt) || 0;
    byStatus[status] = (byStatus[status] || 0) + cnt;
    created += cnt;
    const lifecycle = mapDbStatusToP11Lifecycle(status);
    if (EXECUTION_BUCKETS.has(lifecycle)) inExecution += cnt;
    if (TRACKING_BUCKETS.has(lifecycle)) tracking += cnt;
  }

  // bySource — one GROUP BY (only if source_type column exists).
  const bySource: Record<string, number> = {};
  if (await tableHasColumns('initiatives', ['source_type'])) {
    try {
      const sourceRows = await queryHelpers.queryAll<Record<string, unknown>>(
        `SELECT COALESCE(source_type, 'unknown') AS source_type, COUNT(*) AS cnt
           FROM initiatives
          WHERE organization_id = ?
          GROUP BY COALESCE(source_type, 'unknown')`,
        [orgId]
      );
      for (const r of sourceRows) {
        const src = String(r.source_type || 'unknown');
        bySource[src] = (bySource[src] || 0) + (Number(r.cnt) || 0);
      }
    } catch {
      // Leave bySource empty on drift.
    }
  }

  const conversionPct = created > 0 ? Math.round((tracking / created) * 1000) / 10 : 0;
  const cycleTime = await getCycleTimeByStage(orgId);

  return {
    byStatus,
    bySource,
    conversion: { created, inExecution, tracking, conversionPct },
    cycleTime,
  };
}
