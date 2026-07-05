/**
 * RAID Governance Service (M14/F8 — 8.2)
 *
 * Pulls the two RAID types that governance has historically ignored into the
 * fold, and wires up the dead `linked_items` link:
 *
 *  - ASSUMPTION → validation lifecycle. An assumption is a bet; if it is never
 *    validated (or is invalidated) it silently becomes a risk. `assumptionSignals`
 *    surfaces unvalidated-past-due and invalidated assumptions as governance signals.
 *
 *  - ISSUE → resolution SLA. An issue is a risk that already happened; leaving it
 *    open past its resolution date is the most expensive failure mode.
 *    `issueSignals` surfaces overdue open issues.
 *
 *  - linked_items / materialization → the RISK↔ISSUE bridge. `linkIssueToRisk`
 *    persists a typed link on the issue; `materializeRiskToIssue` promotes a risk
 *    that has occurred into a tracked ISSUE, carrying the source risk id forward.
 *
 * Deliberately standalone (no imports of riskDetectionService / raid.routes) to
 * avoid touching the concurrently-edited risk-detection path.
 *
 * Storage: node-pg via DbPromise, snake_case columns, every statement org-scoped.
 */
import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// Types
// ==========================================

export type ValidationStatus = 'unvalidated' | 'validated' | 'invalidated';

export interface AssumptionInput {
  id: string;
  title: string;
  validation_status?: string | null;
  validation_due_date?: string | null;
  initiative_id?: string | null;
}

export interface AssumptionSignal {
  raidId: string;
  type: 'UNVALIDATED_ASSUMPTION_OVERDUE';
  title: string;
}

export interface IssueInput {
  id: string;
  title: string;
  status?: string | null;
  resolution_due_date?: string | null;
  impact?: string | null;
}

export interface IssueSignal {
  raidId: string;
  type: 'UNRESOLVED_ISSUE_OVERDUE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface RaidLinkRow {
  id: string;
  linked_items: string | null;
}

// ==========================================
// Helpers
// ==========================================

/** Parse the stored `linked_items` JSON into a string[]; tolerant of nulls/garbage. */
function parseLinkedItems(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
    return [];
  } catch {
    return [];
  }
}

/** ISSUE impact → governance severity. CRITICAL impact escalates the overdue signal. */
function issueSeverity(impact?: string | null): IssueSignal['severity'] {
  switch (String(impact || '').toUpperCase()) {
    case 'CRITICAL':
      return 'CRITICAL';
    case 'HIGH':
      return 'HIGH';
    case 'LOW':
      return 'LOW';
    default:
      return 'MEDIUM';
  }
}

/** Parse an ISO date-ish string to epoch ms, or null when unusable. */
function toEpoch(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

// ==========================================
// PURE — assumption signals
// ==========================================

/**
 * An assumption is a governance signal when it is either:
 *   - `invalidated` (a bet that turned out false — always actionable), or
 *   - `unvalidated` AND past its `validation_due_date` (the bet was never tested in time).
 *
 * Validated assumptions, and unvalidated ones still inside their window, are silent.
 * Pure: no I/O, deterministic given `now`.
 */
export function assumptionSignals(assumptions: AssumptionInput[], now: number): AssumptionSignal[] {
  const out: AssumptionSignal[] = [];
  for (const a of assumptions || []) {
    if (!a || !a.id) continue;
    const status = String(a.validation_status || 'unvalidated').toLowerCase();

    if (status === 'invalidated') {
      out.push({ raidId: a.id, type: 'UNVALIDATED_ASSUMPTION_OVERDUE', title: a.title });
      continue;
    }

    if (status === 'unvalidated') {
      const due = toEpoch(a.validation_due_date);
      if (due !== null && due < now) {
        out.push({ raidId: a.id, type: 'UNVALIDATED_ASSUMPTION_OVERDUE', title: a.title });
      }
    }
  }
  return out;
}

// ==========================================
// PURE — issue signals
// ==========================================

/**
 * An open issue past its `resolution_due_date` is a governance signal whose
 * severity tracks the issue's impact. Closed/resolved issues, and open issues
 * still inside their SLA window (or with no SLA), are silent.
 * Pure: no I/O, deterministic given `now`.
 */
export function issueSignals(issues: IssueInput[], now: number): IssueSignal[] {
  const out: IssueSignal[] = [];
  for (const i of issues || []) {
    if (!i || !i.id) continue;
    const status = String(i.status || 'OPEN').toUpperCase();
    if (status === 'CLOSED' || status === 'RESOLVED' || status === 'MITIGATED') continue;

    const due = toEpoch(i.resolution_due_date);
    if (due !== null && due < now) {
      out.push({
        raidId: i.id,
        type: 'UNRESOLVED_ISSUE_OVERDUE',
        severity: issueSeverity(i.impact),
      });
    }
  }
  return out;
}

// ==========================================
// DB-backed loaders (org-scoped) — convenience for callers
// ==========================================

/** Load org assumptions and run them through the pure `assumptionSignals`. */
export async function getAssumptionSignals(
  organizationId: string,
  now: number = Date.now()
): Promise<AssumptionSignal[]> {
  const rows = (await dbAll(
    `SELECT id, title, validation_status, validation_due_date, initiative_id
       FROM raid_items
      WHERE organization_id = ? AND type = 'ASSUMPTION'`,
    [organizationId]
  )) as AssumptionInput[];
  return assumptionSignals(rows || [], now);
}

/** Load org issues and run them through the pure `issueSignals`. */
export async function getIssueSignals(
  organizationId: string,
  now: number = Date.now()
): Promise<IssueSignal[]> {
  const rows = (await dbAll(
    `SELECT id, title, status, resolution_due_date, impact
       FROM raid_items
      WHERE organization_id = ? AND type = 'ISSUE'`,
    [organizationId]
  )) as IssueInput[];
  return issueSignals(rows || [], now);
}

// ==========================================
// DB-backed mutations (org-scoped)
// ==========================================

/**
 * Persist a typed link from an ISSUE to a RISK on the issue's `linked_items`
 * JSON array (merge — never clobbers existing links, never duplicates).
 * Strictly org-scoped: the UPDATE only touches the caller's own row.
 */
export async function linkIssueToRisk(
  organizationId: string,
  issueId: string,
  riskId: string
): Promise<{ success: boolean; linkedItems: string[]; error?: string }> {
  try {
    const row = (await dbGet(
      `SELECT id, linked_items FROM raid_items
        WHERE organization_id = ? AND id = ?`,
      [organizationId, issueId]
    )) as RaidLinkRow | null;

    if (!row) {
      return { success: false, linkedItems: [], error: 'issue_not_found' };
    }

    const existing = parseLinkedItems(row.linked_items);
    const merged = existing.includes(riskId) ? existing : [...existing, riskId];

    const result = await dbRun(
      `UPDATE raid_items
          SET linked_items = ?, updated_at = ?
        WHERE organization_id = ? AND id = ?`,
      [JSON.stringify(merged), new Date().toISOString(), organizationId, issueId]
    );

    if (!result?.success) {
      return { success: false, linkedItems: existing, error: result?.error || 'update_failed' };
    }
    return { success: true, linkedItems: merged };
  } catch (err) {
    logger.error('[raidGovernance] linkIssueToRisk failed', err);
    return { success: false, linkedItems: [], error: (err as Error)?.message };
  }
}

/**
 * Promote a RISK that has occurred into a tracked ISSUE. The new ISSUE carries
 * the source risk id forward via `linked_items` and stamps `materialized_at`,
 * so the two stay traceably connected. Org-scoped on read and write.
 */
export async function materializeRiskToIssue(
  organizationId: string,
  riskId: string
): Promise<{ success: boolean; issueId?: string; error?: string }> {
  try {
    const risk = (await dbGet(
      `SELECT id, initiative_id, title, description, impact, owner_id
         FROM raid_items
        WHERE organization_id = ? AND id = ? AND type = 'RISK'`,
      [organizationId, riskId]
    )) as {
      id: string;
      initiative_id: string | null;
      title: string;
      description: string | null;
      impact: string | null;
      owner_id: string | null;
    } | null;

    if (!risk) {
      return { success: false, error: 'risk_not_found' };
    }

    const issueId = uuidv4();
    const nowIso = new Date().toISOString();

    const result = await dbRun(
      `INSERT INTO raid_items
         (id, organization_id, initiative_id, type, title, description, status,
          impact, owner_id, linked_items, materialized_at, created_at, updated_at)
       VALUES (?, ?, ?, 'ISSUE', ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?)`,
      [
        issueId,
        organizationId,
        risk.initiative_id,
        risk.title,
        risk.description,
        risk.impact,
        risk.owner_id,
        JSON.stringify([riskId]),
        nowIso,
        nowIso,
        nowIso,
      ]
    );

    if (!result?.success) {
      return { success: false, error: result?.error || 'insert_failed' };
    }
    return { success: true, issueId };
  } catch (err) {
    logger.error('[raidGovernance] materializeRiskToIssue failed', err);
    return { success: false, error: (err as Error)?.message };
  }
}
