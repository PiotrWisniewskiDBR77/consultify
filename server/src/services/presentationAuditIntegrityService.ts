/**
 * Presentation Audit Integrity Service (Epic K3 — closure)
 *
 * Read-only verifier that cross-references three tables and confirms every
 * applied agent edit and every successful export has a matching audit
 * record in `audit_events` (the project's unified audit log) within a
 * tight latency budget.
 *
 *   1. `presentation_ai_operations`   — applied agent edits
 *   2. `presentation_export_records`  — successful exports
 *   3. `audit_events`                 — the audit log itself
 *                                       (`resource_type` ∈ {
 *                                         'presentation_deck_agent_edit',
 *                                         'presentation_deck_export'
 *                                       })
 *
 * The service splits cleanly into:
 *
 *   - `evaluateAuditIntegrity(input)`  — pure, side-effect-free verifier.
 *                                        Never throws, never reads from a DB.
 *                                        All semantics are unit-tested.
 *   - `buildAuditIntegrityReport(...)` — schema-tolerant DB wrapper that
 *                                        loads the three sources, hands them
 *                                        to the pure verifier, and surfaces
 *                                        per-source `warnings` if a backing
 *                                        table is missing.
 *
 * INVARIANTS (do NOT break in future edits):
 *
 *   - The verifier is **read-only**. It NEVER writes audit events itself —
 *     writing fake audit rows would defeat the entire point of the check.
 *   - The 5-minute latency budget lives as a single constant
 *     (`AUDIT_LATENCY_BUDGET_MS`) at the top of this file.
 *   - The issues array is hard-capped at `ISSUE_CAP` (1000) so we never
 *     OOM the report — `truncated: true` flags overflow.
 *   - The report is always JSON-serializable (no functions, no `Date`,
 *     no symbols on the wire).
 *   - Schema-tolerant: any missing source table downgrades to an empty
 *     array + a `schema_missing:<table>` warning. The verdict only ever
 *     reflects what we COULD scan.
 */

import { all as dbAll } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum tolerated lag between an action (apply / export) and the audit
 * event that records it. Exceeding this budget produces a P2
 * `late_audit_record` issue.
 */
export const AUDIT_LATENCY_BUDGET_MS = 5 * 60 * 1000;

/** Hard cap on the `issues` array. Overflow flips `truncated` true. */
export const ISSUE_CAP = 1000;

const WINDOW_DAYS_DEFAULT = 7;
const WINDOW_DAYS_MIN = 1;
const WINDOW_DAYS_MAX = 90;

const AGENT_EDIT_QUERY_LIMIT = 5_000;
const EXPORT_QUERY_LIMIT = 5_000;
const AUDIT_QUERY_LIMIT = 20_000;

const AGENT_EDIT_AUDIT_ACTIONS = new Set<string>([
  'agent_edit_applied',
  'agent_edit_proposal_applied',
  // Sprint 6/7 emitted `approve` for the same resource; treat as canonical.
  'approve',
]);

const EXPORT_AUDIT_ACTIONS = new Set<string>([
  'export_completed',
  'pdf_exported',
  'pptx_exported',
  'html_exported',
  'png_exported',
]);

const TRACKED_AUDIT_ACTIONS = new Set<string>([
  ...AGENT_EDIT_AUDIT_ACTIONS,
  ...EXPORT_AUDIT_ACTIONS,
]);

// ============================================================================
// TYPES
// ============================================================================

export interface IntegrityCheckInput {
  /** Window length in days. Default 7, max 90, min 1. */
  windowDays: number;
  organizationId: string;
}

export type IntegrityIssueType =
  | 'missing_audit_for_agent_edit'
  | 'missing_audit_for_export'
  | 'orphan_audit_event'
  | 'duplicate_audit_event'
  | 'late_audit_record';

export interface IntegrityIssue {
  type: IntegrityIssueType;
  severity: 'P1' | 'P2';
  deckId: string | null;
  referenceId: string;
  occurredAt: string;
  reason: string;
}

export interface IntegrityCheckTotals {
  agentEditsScanned: number;
  exportsScanned: number;
  auditEventsScanned: number;
  issuesFound: number;
  p1: number;
  p2: number;
}

export type IntegrityVerdict = 'PASS' | 'PASS_WITH_P2' | 'BLOCKED_P1';

export interface IntegrityCheckReport {
  organizationId: string;
  windowDays: number;
  generatedAt: string;
  totals: IntegrityCheckTotals;
  issues: IntegrityIssue[];
  truncated: boolean;
  verdict: IntegrityVerdict;
  /**
   * Best-effort warnings raised by the DB layer (e.g. when a backing
   * table is missing). Pure verifier never adds entries here — only
   * `buildAuditIntegrityReport` does.
   */
  warnings: string[];
}

export interface AgentEditInput {
  id: string;
  deckId: string;
  appliedAt: string;
}

export interface ExportInput {
  id: string;
  deckId: string;
  completedAt: string;
  status: string;
}

export interface AuditEventInput {
  id: string;
  deckId: string | null;
  action: string;
  relatedId: string | null;
  occurredAt: string;
}

export interface EvaluateInput {
  agentEdits: AgentEditInput[];
  exports: ExportInput[];
  auditEvents: AuditEventInput[];
  windowDays: number;
  organizationId: string;
  /** Optional override for "now" (used by tests + deterministic CLI runs). */
  nowIso?: string;
}

// ============================================================================
// HELPERS — pure
// ============================================================================

function clampWindowDays(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return WINDOW_DAYS_DEFAULT;
  const rounded = Math.round(n);
  if (rounded < WINDOW_DAYS_MIN) return WINDOW_DAYS_MIN;
  if (rounded > WINDOW_DAYS_MAX) return WINDOW_DAYS_MAX;
  return rounded;
}

function parseTime(raw: unknown): number | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function safeIso(ms: number): string {
  try {
    return new Date(ms).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(ms / 60_000);
  return `${minutes}m`;
}

function isWithinWindow(timeMs: number | null, windowStartMs: number, nowMs: number): boolean {
  if (timeMs === null) return false;
  return timeMs >= windowStartMs && timeMs <= nowMs;
}

// ============================================================================
// PURE VERIFIER
// ============================================================================

/**
 * Cross-reference scanned agent edits, exports, and audit events. Never
 * throws — all malformed inputs degrade to a documented issue type so the
 * scheduler can keep running.
 */
export function evaluateAuditIntegrity(input: EvaluateInput): IntegrityCheckReport {
  const windowDays = clampWindowDays(input.windowDays);
  const nowMs = parseTime(input.nowIso) ?? Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const windowStartMs = nowMs - windowMs;
  // Audit events get a small back-pad so a slightly-late audit row that
  // documents an in-window action is still examinable.
  const auditWindowStartMs = windowStartMs - AUDIT_LATENCY_BUDGET_MS;

  const issues: IntegrityIssue[] = [];
  let truncatedHit = false;

  function pushIssue(issue: IntegrityIssue): void {
    if (issues.length >= ISSUE_CAP) {
      truncatedHit = true;
      return;
    }
    issues.push(issue);
  }

  // ----- Filter sources to window ------------------------------------------

  const agentEdits = (Array.isArray(input.agentEdits) ? input.agentEdits : []).filter((e) =>
    isWithinWindow(parseTime(e?.appliedAt), windowStartMs, nowMs)
  );
  const exports = (Array.isArray(input.exports) ? input.exports : []).filter((e) => {
    if (!e || typeof e !== 'object') return false;
    return isWithinWindow(parseTime(e.completedAt), windowStartMs, nowMs);
  });
  const auditEvents = (Array.isArray(input.auditEvents) ? input.auditEvents : []).filter((ev) => {
    if (!ev || typeof ev !== 'object') return false;
    const t = parseTime(ev.occurredAt);
    if (t === null) {
      // Malformed timestamps must still be examinable so we surface them
      // as `late_audit_record` / `orphan_audit_event` rather than throw.
      return true;
    }
    return t >= auditWindowStartMs && t <= nowMs;
  });

  // ----- Build lookup tables -----------------------------------------------

  const auditByEditId = new Map<string, AuditEventInput[]>();
  const auditByExportId = new Map<string, AuditEventInput[]>();

  const scannedDeckIds = new Set<string>();
  for (const edit of agentEdits) {
    if (typeof edit.deckId === 'string' && edit.deckId.length > 0) {
      scannedDeckIds.add(edit.deckId);
    }
  }
  for (const exp of exports) {
    if (typeof exp.deckId === 'string' && exp.deckId.length > 0) {
      scannedDeckIds.add(exp.deckId);
    }
  }

  for (const ev of auditEvents) {
    const action = String(ev.action || '');
    const related =
      typeof ev.relatedId === 'string' && ev.relatedId.length > 0 ? ev.relatedId : null;
    if (related === null) continue;
    if (AGENT_EDIT_AUDIT_ACTIONS.has(action)) {
      const list = auditByEditId.get(related) ?? [];
      list.push(ev);
      auditByEditId.set(related, list);
    }
    if (EXPORT_AUDIT_ACTIONS.has(action)) {
      const list = auditByExportId.get(related) ?? [];
      list.push(ev);
      auditByExportId.set(related, list);
    }
  }

  // ----- 1. Agent edit coverage --------------------------------------------

  for (const edit of agentEdits) {
    const editTimeMs = parseTime(edit.appliedAt);
    const matches = auditByEditId.get(edit.id) ?? [];
    if (matches.length === 0) {
      pushIssue({
        type: 'missing_audit_for_agent_edit',
        severity: 'P1',
        deckId: edit.deckId || null,
        referenceId: edit.id,
        occurredAt: edit.appliedAt,
        reason:
          'no audit_event with relatedId=' +
          edit.id +
          ' and action in {' +
          Array.from(AGENT_EDIT_AUDIT_ACTIONS).join(', ') +
          '}',
      });
      continue;
    }
    if (editTimeMs === null) {
      pushIssue({
        type: 'late_audit_record',
        severity: 'P2',
        deckId: edit.deckId || null,
        referenceId: edit.id,
        occurredAt: edit.appliedAt,
        reason: 'agent_edit appliedAt is invalid; cannot verify audit latency budget',
      });
      continue;
    }
    let bestLatencyMs: number | null = null;
    let withinBudget = false;
    for (const m of matches) {
      const t = parseTime(m.occurredAt);
      if (t === null) continue;
      const lat = Math.abs(t - editTimeMs);
      if (bestLatencyMs === null || lat < bestLatencyMs) bestLatencyMs = lat;
      if (lat <= AUDIT_LATENCY_BUDGET_MS) {
        withinBudget = true;
        break;
      }
    }
    if (!withinBudget) {
      pushIssue({
        type: 'late_audit_record',
        severity: 'P2',
        deckId: edit.deckId || null,
        referenceId: edit.id,
        occurredAt: edit.appliedAt,
        reason:
          bestLatencyMs === null
            ? 'audit_event timestamps are invalid; cannot verify ≤5min budget'
            : 'audit_event arrived ' +
              formatLatency(bestLatencyMs) +
              ' from edit (budget ' +
              formatLatency(AUDIT_LATENCY_BUDGET_MS) +
              ')',
      });
    }
  }

  // ----- 2. Export coverage (only completed exports require an audit) ------

  for (const exp of exports) {
    if (String(exp.status || '').toLowerCase() !== 'completed') continue;
    const expTimeMs = parseTime(exp.completedAt);
    const matches = auditByExportId.get(exp.id) ?? [];
    if (matches.length === 0) {
      pushIssue({
        type: 'missing_audit_for_export',
        severity: 'P1',
        deckId: exp.deckId || null,
        referenceId: exp.id,
        occurredAt: exp.completedAt,
        reason:
          'no audit_event with relatedId=' +
          exp.id +
          ' and action in {' +
          Array.from(EXPORT_AUDIT_ACTIONS).join(', ') +
          '}',
      });
      continue;
    }
    if (expTimeMs === null) {
      pushIssue({
        type: 'late_audit_record',
        severity: 'P2',
        deckId: exp.deckId || null,
        referenceId: exp.id,
        occurredAt: exp.completedAt,
        reason: 'export completedAt is invalid; cannot verify audit latency budget',
      });
      continue;
    }
    let bestLatencyMs: number | null = null;
    let withinBudget = false;
    for (const m of matches) {
      const t = parseTime(m.occurredAt);
      if (t === null) continue;
      const lat = Math.abs(t - expTimeMs);
      if (bestLatencyMs === null || lat < bestLatencyMs) bestLatencyMs = lat;
      if (lat <= AUDIT_LATENCY_BUDGET_MS) {
        withinBudget = true;
        break;
      }
    }
    if (!withinBudget) {
      pushIssue({
        type: 'late_audit_record',
        severity: 'P2',
        deckId: exp.deckId || null,
        referenceId: exp.id,
        occurredAt: exp.completedAt,
        reason:
          bestLatencyMs === null
            ? 'audit_event timestamps are invalid; cannot verify ≤5min budget'
            : 'audit_event arrived ' +
              formatLatency(bestLatencyMs) +
              ' from export (budget ' +
              formatLatency(AUDIT_LATENCY_BUDGET_MS) +
              ')',
      });
    }
  }

  // ----- 3. Orphan audit events --------------------------------------------

  const editIds = new Set<string>(agentEdits.map((e) => e.id));
  const exportIds = new Set<string>(exports.map((e) => e.id));

  for (const ev of auditEvents) {
    const action = String(ev.action || '');
    if (!TRACKED_AUDIT_ACTIONS.has(action)) continue;
    const deckIdMissing =
      typeof ev.deckId === 'string' && ev.deckId.length > 0 && !scannedDeckIds.has(ev.deckId);
    const relatedId =
      typeof ev.relatedId === 'string' && ev.relatedId.length > 0 ? ev.relatedId : null;
    const relatedIsAgentAction = AGENT_EDIT_AUDIT_ACTIONS.has(action);
    const relatedIsExportAction = EXPORT_AUDIT_ACTIONS.has(action);
    const relatedMissing =
      relatedId !== null &&
      ((relatedIsAgentAction && !editIds.has(relatedId)) ||
        (relatedIsExportAction && !exportIds.has(relatedId)));
    if (deckIdMissing || relatedMissing) {
      const parts: string[] = [];
      if (deckIdMissing) parts.push('deckId=' + ev.deckId + ' not in scanned operations/exports');
      if (relatedMissing) parts.push('relatedId=' + relatedId + ' has no matching record');
      pushIssue({
        type: 'orphan_audit_event',
        severity: 'P1',
        deckId: ev.deckId,
        referenceId: ev.id,
        occurredAt: ev.occurredAt,
        reason: parts.join('; '),
      });
    }
  }

  // ----- 4. Duplicate audit events (same action+relatedId+deckId ≤5min) ----

  const dupGroups = new Map<string, AuditEventInput[]>();
  for (const ev of auditEvents) {
    const action = String(ev.action || '');
    if (!TRACKED_AUDIT_ACTIONS.has(action)) continue;
    const key = action + '|' + (ev.relatedId ?? '') + '|' + (ev.deckId ?? '');
    const list = dupGroups.get(key) ?? [];
    list.push(ev);
    dupGroups.set(key, list);
  }
  for (const list of dupGroups.values()) {
    if (list.length < 2) continue;
    const sorted = list.slice().sort((a, b) => {
      const ta = parseTime(a.occurredAt) ?? 0;
      const tb = parseTime(b.occurredAt) ?? 0;
      return ta - tb;
    });
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (!prev || !cur) continue;
      const tPrev = parseTime(prev.occurredAt);
      const tCur = parseTime(cur.occurredAt);
      if (tPrev === null || tCur === null) continue;
      if (tCur - tPrev <= AUDIT_LATENCY_BUDGET_MS) {
        pushIssue({
          type: 'duplicate_audit_event',
          severity: 'P2',
          deckId: cur.deckId,
          referenceId: cur.id,
          occurredAt: cur.occurredAt,
          reason:
            'duplicate of audit_event=' +
            prev.id +
            ' within ' +
            formatLatency(AUDIT_LATENCY_BUDGET_MS) +
            ' (action=' +
            cur.action +
            ', relatedId=' +
            (cur.relatedId ?? 'null') +
            ')',
        });
      }
    }
  }

  // ----- Verdict + totals --------------------------------------------------

  const p1 = issues.filter((i) => i.severity === 'P1').length;
  const p2 = issues.filter((i) => i.severity === 'P2').length;
  const verdict: IntegrityVerdict = p1 > 0 ? 'BLOCKED_P1' : p2 > 0 ? 'PASS_WITH_P2' : 'PASS';

  return {
    organizationId: String(input.organizationId || ''),
    windowDays,
    generatedAt: safeIso(nowMs),
    totals: {
      agentEditsScanned: agentEdits.length,
      exportsScanned: exports.length,
      auditEventsScanned: auditEvents.length,
      issuesFound: issues.length,
      p1,
      p2,
    },
    issues,
    truncated: truncatedHit,
    verdict,
    warnings: [],
  };
}

// ============================================================================
// SCHEMA-TOLERANT GUARD
// ============================================================================

function isSchemaMissingError(error: unknown): boolean {
  const msg = String((error as { message?: unknown })?.message || '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('no such table') ||
    msg.includes('no such column') ||
    msg.includes('relation') ||
    msg.includes('database not initialized')
  );
}

function pushUniqueWarning(target: string[], code: string): void {
  if (!target.includes(code)) target.push(code);
}

// ============================================================================
// DB LAYER
// ============================================================================

interface RawAgentEditRow {
  id?: unknown;
  deck_id?: unknown;
  resolved_at?: unknown;
  created_at?: unknown;
}

interface RawExportRow {
  id?: unknown;
  deck_id?: unknown;
  status?: unknown;
  completed_at?: unknown;
  created_at?: unknown;
}

interface RawAuditEventRow {
  id?: unknown;
  ts?: unknown;
  action?: unknown;
  resource_type?: unknown;
  resource_id?: unknown;
  metadata_json?: unknown;
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

async function fetchAgentEdits(
  organizationId: string,
  windowStartIso: string,
  warnings: string[]
): Promise<AgentEditInput[]> {
  try {
    const rows = await dbAll<RawAgentEditRow>(
      `SELECT id, deck_id, resolved_at, created_at
         FROM presentation_ai_operations
        WHERE organization_id = ?
          AND status = 'applied'
          AND COALESCE(resolved_at, created_at) >= ?
        ORDER BY COALESCE(resolved_at, created_at) DESC
        LIMIT ${AGENT_EDIT_QUERY_LIMIT}`,
      [organizationId, windowStartIso],
      { fallback: false }
    );
    return rows.map((row) => ({
      id: asString(row.id),
      deckId: asString(row.deck_id),
      appliedAt: asString(row.resolved_at) || asString(row.created_at),
    }));
  } catch (error) {
    if (isSchemaMissingError(error)) {
      pushUniqueWarning(warnings, 'schema_missing:presentation_ai_operations');
    } else {
      pushUniqueWarning(warnings, 'query_failed:presentation_ai_operations');
      logger.warn('[AuditIntegrity] fetchAgentEdits failed', error);
    }
    return [];
  }
}

async function fetchExports(
  organizationId: string,
  windowStartIso: string,
  warnings: string[]
): Promise<ExportInput[]> {
  try {
    const rows = await dbAll<RawExportRow>(
      `SELECT id, deck_id, status, completed_at, created_at
         FROM presentation_export_records
        WHERE organization_id = ?
          AND COALESCE(completed_at, created_at) >= ?
        ORDER BY COALESCE(completed_at, created_at) DESC
        LIMIT ${EXPORT_QUERY_LIMIT}`,
      [organizationId, windowStartIso],
      { fallback: false }
    );
    return rows.map((row) => ({
      id: asString(row.id),
      deckId: asString(row.deck_id),
      completedAt: asString(row.completed_at) || asString(row.created_at),
      status: asString(row.status),
    }));
  } catch (error) {
    if (isSchemaMissingError(error)) {
      pushUniqueWarning(warnings, 'schema_missing:presentation_export_records');
    } else {
      pushUniqueWarning(warnings, 'query_failed:presentation_export_records');
      logger.warn('[AuditIntegrity] fetchExports failed', error);
    }
    return [];
  }
}

async function fetchAuditEvents(
  organizationId: string,
  windowStartIso: string,
  warnings: string[]
): Promise<AuditEventInput[]> {
  try {
    const rows = await dbAll<RawAuditEventRow>(
      `SELECT id, ts, action, resource_type, resource_id, metadata_json
         FROM audit_events
        WHERE (org_id = ? OR org_id IS NULL)
          AND ts >= ?
          AND (resource_type = 'presentation_deck_agent_edit'
               OR resource_type = 'presentation_deck_export'
               OR resource_type = 'presentation_deck')
        ORDER BY ts DESC
        LIMIT ${AUDIT_QUERY_LIMIT}`,
      [organizationId, windowStartIso],
      { fallback: false }
    );
    return rows.map((row) => {
      let deckIdFromMeta: string | null = null;
      try {
        if (typeof row.metadata_json === 'string' && row.metadata_json.length > 0) {
          const meta = JSON.parse(row.metadata_json);
          if (meta && typeof meta === 'object' && typeof meta.deckId === 'string') {
            deckIdFromMeta = meta.deckId;
          }
        } else if (row.metadata_json && typeof row.metadata_json === 'object') {
          const meta = row.metadata_json as Record<string, unknown>;
          if (typeof meta.deckId === 'string') deckIdFromMeta = meta.deckId;
        }
      } catch {
        deckIdFromMeta = null;
      }
      const resourceType = asString(row.resource_type);
      const resourceId = asString(row.resource_id);
      // For deck-scoped audit rows, the resourceId IS the deckId.
      const deckId =
        resourceType === 'presentation_deck' && resourceId.length > 0 ? resourceId : deckIdFromMeta;
      // For agent-edit / export rows, the resourceId is the operation/export id.
      const relatedId =
        resourceType === 'presentation_deck_agent_edit' ||
        resourceType === 'presentation_deck_export'
          ? resourceId.length > 0
            ? resourceId
            : null
          : null;
      return {
        id: asString(row.id),
        deckId,
        action: asString(row.action),
        relatedId,
        occurredAt: asString(row.ts),
      };
    });
  } catch (error) {
    if (isSchemaMissingError(error)) {
      pushUniqueWarning(warnings, 'schema_missing:audit_events');
    } else {
      pushUniqueWarning(warnings, 'query_failed:audit_events');
      logger.warn('[AuditIntegrity] fetchAuditEvents failed', error);
    }
    return [];
  }
}

/**
 * Schema-tolerant DB wrapper. Loads each source independently — if any one
 * query fails (table missing / unrecoverable error) the run still completes
 * with the other sources scanned and a `warnings` entry recorded on the
 * report. Only catastrophic failures (`storage_error`) cause the wrapper
 * to surface a non-`ok` status.
 */
export async function buildAuditIntegrityReport(
  input: IntegrityCheckInput
): Promise<{ status: 'ok' | 'storage_error'; report?: IntegrityCheckReport; reason?: string }> {
  const organizationId = String(input?.organizationId || '');
  if (organizationId.length === 0) {
    return { status: 'storage_error', reason: 'organization_id_required' };
  }

  const windowDays = clampWindowDays(input?.windowDays);
  const nowMs = Date.now();
  const windowStartMs = nowMs - windowDays * 24 * 60 * 60 * 1000;
  // Pad audit lookback by 1 day so a slightly-late audit row still surfaces.
  const auditWindowStartMs = windowStartMs - 24 * 60 * 60 * 1000;
  const windowStartIso = safeIso(windowStartMs);
  const auditWindowStartIso = safeIso(auditWindowStartMs);

  const warnings: string[] = [];

  try {
    const [agentEdits, exports, auditEvents] = await Promise.all([
      fetchAgentEdits(organizationId, windowStartIso, warnings),
      fetchExports(organizationId, windowStartIso, warnings),
      fetchAuditEvents(organizationId, auditWindowStartIso, warnings),
    ]);

    const report = evaluateAuditIntegrity({
      agentEdits,
      exports,
      auditEvents,
      windowDays,
      organizationId,
      nowIso: safeIso(nowMs),
    });

    for (const code of warnings) {
      if (!report.warnings.includes(code)) report.warnings.push(code);
    }

    return { status: 'ok', report };
  } catch (error) {
    logger.error('[AuditIntegrity] buildAuditIntegrityReport unexpected failure', error);
    return {
      status: 'storage_error',
      reason: String((error as { message?: unknown })?.message || 'unknown'),
    };
  }
}

// ============================================================================
// Internal helpers (export for tests + sibling services if useful)
// ============================================================================

export const __internal = {
  AGENT_EDIT_AUDIT_ACTIONS,
  EXPORT_AUDIT_ACTIONS,
  TRACKED_AUDIT_ACTIONS,
  clampWindowDays,
  parseTime,
};
