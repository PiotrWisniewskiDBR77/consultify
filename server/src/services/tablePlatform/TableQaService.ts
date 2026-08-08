/**
 * Table QA Service (Block C · EPIC-T11 · Sprint C-S4)
 *
 * Continuously evaluates every Tabele table against the 5-axis health model:
 *
 *   1. completeness        — required-field fill rate + low-confidence ratio.
 *   2. freshness           — recency of record writes / source verifications.
 *   3. sourceCoverage      — % of records with ≥1 active verified source.
 *   4. methodology         — adherence to template `governance_rules` (Block A).
 *   5. formulaConsistency  — formula evaluation success rate across records.
 *
 * Each axis returns a 0..1 score plus a band (red/amber/green) and details.
 * Overall health is a weighted mean (default 0.25 / 0.15 / 0.25 / 0.20 / 0.15
 * — see EPIC-T11). Suggestions are deterministic — derived from the axis
 * deltas, not from an LLM — so this service does NOT touch
 * `AiUsageService.consume()`. The LLM call belongs to the AI Editor flow that
 * the user launches from a suggestion card (C-S5).
 *
 * Persistence:
 *   - `tp_qa_reports`                 — append-only history (the latest row per
 *                                       tableId is the canonical "current" report).
 *   - `tp_qa_suggestion_dismissals`   — durable suppression list keyed on a
 *                                       stable suggestion fingerprint.
 *
 * Cross-tenant safety: every public method requires the actor's
 * `organizationId` (and, for writes, `workspaceId`). The service refuses to
 * read or write a row whose `tp_bases.(organization_id, workspace_id)` does
 * not match the caller's resolved tenant — even if a request smuggles a
 * `tableId` from another tenant.
 *
 * Recompute scheduling:
 *   - On-demand: route layer calls `computeReport()` directly.
 *   - Async: writers (RecordsService, RelationService, etc.) call
 *     `scheduleRecompute()` which debounces a 5-minute timer per tableId.
 *     The scheduler is in-process; this is intentional for C-S4 because the
 *     existing async-job queue (BullMQ) is overkill for a single deterministic
 *     job. Tests inject a synchronous scheduler via `__setSchedulerFnForTesting()`.
 *
 * Schema reference: server/migrations/20260509_block_c_qa_engine.sql
 * Spec reference:   docs/product/work-packets/tabele-full-product/block-C-ai-operator/epics/EPIC-T11_TABLE_QA_ENGINE.md
 */

import { createHash } from 'node:crypto';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import { evaluateFormula, parseFormula } from './formulaEngine.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type QaAxisName =
  | 'completeness'
  | 'freshness'
  | 'sourceCoverage'
  | 'methodology'
  | 'formulaConsistency';

export type QaBand = 'red' | 'amber' | 'green';

export type QaTriggerKind = 'on_demand' | 'scheduled' | 'record_write' | 'migration';

export interface QaAxisDetail {
  score: number;
  band: QaBand;
  details: Array<{ metric: string; value: unknown }>;
}

export type QaSuggestionLevel =
  | 'cell'
  | 'record'
  | 'column'
  | 'structure'
  | 'view'
  | 'relational'
  | 'methodological'
  | 'source';

export interface QaSuggestion {
  id: string;
  /** Stable hash of (axis + action.kind + level + payload anchor) for durable dismissals. */
  fingerprint: string;
  axis: QaAxisName;
  description: string;
  recommendedAction: {
    kind: 'open_ai_editor';
    level: QaSuggestionLevel;
    payload: Record<string, unknown>;
  };
  severity: 'low' | 'medium' | 'high';
}

export interface QaReport {
  id: string;
  tableId: string;
  organizationId: string;
  workspaceId: string;
  computedAt: string;
  computedBy: string;
  triggerKind: QaTriggerKind;
  overallScore: number;
  axes: Record<QaAxisName, QaAxisDetail>;
  suggestions: QaSuggestion[];
  computationMs?: number;
}

export interface ComputeReportInput {
  tableId: string;
  organizationId: string;
  /** Resolved by the route layer; required for the audit row. */
  computedBy: string;
  triggerKind?: QaTriggerKind;
  /** When true, persists the report. Defaults to true. */
  persist?: boolean;
}

export interface MarkInapplicableInput {
  tableId: string;
  organizationId: string;
  suggestionId: string;
  /** Required because dismissals are joined by fingerprint; the route resolves
   *  it from the latest report. */
  fingerprint: string;
  reason?: string;
  dismissedBy: string;
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class TableQaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = 'TableQaError';
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

export const AXIS_WEIGHTS: Record<QaAxisName, number> = {
  completeness: 0.25,
  freshness: 0.15,
  sourceCoverage: 0.25,
  methodology: 0.2,
  formulaConsistency: 0.15,
};

const BAND_GREEN_MIN = 0.85;
const BAND_AMBER_MIN = 0.6;
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const FRESHNESS_GREEN_DAYS = 7;
const FRESHNESS_AMBER_DAYS = 30;
const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes per EPIC-T11.
const MAX_RECORDS_FOR_FORMULA_SCAN = 1000;

// ── Internal scheduler ───────────────────────────────────────────────────────

type SchedulerFn = (
  tableId: string,
  organizationId: string,
  delayMs: number,
  invoke: () => Promise<void>
) => void;

const debounceTimers = new Map<string, NodeJS.Timeout>();

const defaultScheduler: SchedulerFn = (tableId, _orgId, delayMs, invoke) => {
  const existing = debounceTimers.get(tableId);
  if (existing) clearTimeout(existing);
  const handle = setTimeout(() => {
    debounceTimers.delete(tableId);
    invoke().catch((e) => {
      logger.error('[TableQaService] scheduled recompute failed', {
        tableId,
        error: (e as Error)?.message,
      });
    });
  }, delayMs);
  // Allow the Node process to exit even if a timer is pending (test envs).
  if (typeof handle.unref === 'function') handle.unref();
  debounceTimers.set(tableId, handle);
};

let activeScheduler: SchedulerFn = defaultScheduler;

// ── Helpers ──────────────────────────────────────────────────────────────────

interface TenantRow {
  workspaceId: string;
  organizationId: string;
  appliedTemplateId: string | null;
}

async function loadTenant(tableId: string): Promise<TenantRow | null> {
  const db = getDatabase();
  // `applied_template_id` is optional in older deploys; LEFT JOIN protects.
  let rows: Array<{
    workspace_id?: string;
    organization_id?: string;
    applied_template_id?: string | null;
  }>;
  try {
    const r = await db.query(
      `SELECT b.workspace_id, b.organization_id, b.applied_template_id
         FROM tp_tables t
         JOIN tp_bases  b ON t.base_id = b.id
        WHERE t.id = $1
        LIMIT 1`,
      [tableId]
    );
    rows = r.rows ?? [];
  } catch {
    // Schema variant without `applied_template_id` — fall back to a slimmer query.
    const r = await db.query(
      `SELECT b.workspace_id, b.organization_id
         FROM tp_tables t
         JOIN tp_bases  b ON t.base_id = b.id
        WHERE t.id = $1
        LIMIT 1`,
      [tableId]
    );
    rows = r.rows ?? [];
  }
  const row = rows[0];
  if (!row?.workspace_id || !row?.organization_id) return null;
  return {
    workspaceId: String(row.workspace_id),
    organizationId: String(row.organization_id),
    appliedTemplateId: row.applied_template_id ? String(row.applied_template_id) : null,
  };
}

function bandFor(score: number): QaBand {
  if (score >= BAND_GREEN_MIN) return 'green';
  if (score >= BAND_AMBER_MIN) return 'amber';
  return 'red';
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function isMissing(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

function fingerprintFor(parts: {
  tableId: string;
  axis: QaAxisName;
  level: QaSuggestionLevel;
  anchor: string;
}): string {
  const h = createHash('sha1');
  h.update(parts.tableId);
  h.update('|');
  h.update(parts.axis);
  h.update('|');
  h.update(parts.level);
  h.update('|');
  h.update(parts.anchor);
  return `qa_${h.digest('hex').slice(0, 24)}`;
}

function suggestionId(fingerprint: string, idx: number): string {
  return `${fingerprint}_${idx}`;
}

interface FieldRow {
  id: string;
  name: string;
  fieldType: string;
  options: Record<string, unknown>;
  isComputed: boolean;
  fieldOrder: number;
}

async function loadFields(tableId: string): Promise<FieldRow[]> {
  const db = getDatabase();
  const { rows } = await db.query(
    `SELECT id, name, field_type, options, is_computed, field_order
       FROM tp_fields
      WHERE table_id = $1
      ORDER BY field_order ASC, name ASC`,
    [tableId]
  );
  return (rows ?? []).map((r: any) => ({
    id: String(r.id),
    name: String(r.name),
    fieldType: String(r.field_type),
    options:
      r.options == null
        ? {}
        : typeof r.options === 'string'
          ? safeParseObject(r.options)
          : (r.options as Record<string, unknown>),
    isComputed: Boolean(r.is_computed),
    fieldOrder: Number(r.field_order ?? 0),
  }));
}

interface RecordRow {
  id: string;
  data: Record<string, unknown>;
  confidenceScore: number | null;
  validationStatus: string;
  updatedAt: string;
}

async function loadRecords(
  tableId: string,
  limit = MAX_RECORDS_FOR_FORMULA_SCAN
): Promise<RecordRow[]> {
  const db = getDatabase();
  const { rows } = await db.query(
    `SELECT id, data, confidence_score, validation_status, updated_at
       FROM tp_records
      WHERE table_id = $1
      ORDER BY updated_at DESC
      LIMIT $2`,
    [tableId, limit]
  );
  return (rows ?? []).map((r: any) => ({
    id: String(r.id),
    data:
      r.data == null
        ? {}
        : typeof r.data === 'string'
          ? safeParseObject(r.data)
          : (r.data as Record<string, unknown>),
    confidenceScore:
      r.confidence_score == null || r.confidence_score === '' ? null : Number(r.confidence_score),
    validationStatus: String(r.validation_status ?? 'unverified'),
    updatedAt:
      r.updated_at instanceof Date
        ? r.updated_at.toISOString()
        : String(r.updated_at ?? new Date().toISOString()),
  }));
}

async function countRecords(tableId: string): Promise<number> {
  const db = getDatabase();
  const { rows } = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM tp_records WHERE table_id = $1`,
    [tableId]
  );
  return Number(rows?.[0]?.n ?? 0);
}

interface SourceCoverageRow {
  recordsWithVerifiedSource: number;
  totalRecords: number;
  lastVerifiedAt: string | null;
}

async function loadSourceCoverage(tableId: string): Promise<SourceCoverageRow> {
  const db = getDatabase();
  // Best-effort: tp_record_sources may not exist in deployments that have not
  // run Block B's migration yet. In that case we report zero coverage rather
  // than crash the QA pipeline.
  try {
    const { rows } = await db.query<{
      verified_count: number;
      total: number;
      last_verified_at: string | Date | null;
    }>(
      `WITH t AS (
         SELECT id FROM tp_records WHERE table_id = $1
       ),
       verified AS (
         SELECT DISTINCT s.record_id
           FROM tp_record_sources s
           JOIN t ON t.id = s.record_id
          WHERE s.archived_at IS NULL
            AND s.last_verified_at IS NOT NULL
       ),
       last AS (
         SELECT MAX(s.last_verified_at) AS last_verified_at
           FROM tp_record_sources s
           JOIN t ON t.id = s.record_id
          WHERE s.archived_at IS NULL
       )
       SELECT
         (SELECT COUNT(*)::int FROM verified) AS verified_count,
         (SELECT COUNT(*)::int FROM t)        AS total,
         (SELECT last_verified_at FROM last)  AS last_verified_at`,
      [tableId]
    );
    const row: Partial<{
      verified_count: number;
      total: number;
      last_verified_at: string | Date | null;
    }> = rows?.[0] ?? {};
    return {
      recordsWithVerifiedSource: Number(row.verified_count ?? 0),
      totalRecords: Number(row.total ?? 0),
      lastVerifiedAt:
        row.last_verified_at instanceof Date
          ? row.last_verified_at.toISOString()
          : row.last_verified_at
            ? String(row.last_verified_at)
            : null,
    };
  } catch (e) {
    logger.warn('[TableQaService] tp_record_sources unavailable; reporting zero coverage', {
      tableId,
      error: (e as Error)?.message,
    });
    return {
      recordsWithVerifiedSource: 0,
      totalRecords: await countRecords(tableId),
      lastVerifiedAt: null,
    };
  }
}

async function loadGovernanceRules(
  appliedTemplateId: string | null
): Promise<Record<string, unknown>> {
  if (!appliedTemplateId) return {};
  try {
    const db = getDatabase();
    const { rows } = await db.query<{ governance_rules: unknown }>(
      `SELECT governance_rules FROM tp_base_templates WHERE id = $1 LIMIT 1`,
      [appliedTemplateId]
    );
    const raw = rows?.[0]?.governance_rules;
    if (!raw) return {};
    return typeof raw === 'string' ? safeParseObject(raw) : (raw as Record<string, unknown>);
  } catch {
    return {};
  }
}

async function loadDismissals(tableId: string): Promise<Set<string>> {
  try {
    const db = getDatabase();
    const { rows } = await db.query(
      `SELECT fingerprint FROM tp_qa_suggestion_dismissals WHERE table_id = $1`,
      [tableId]
    );
    return new Set((rows ?? []).map((r: any) => String(r.fingerprint)));
  } catch {
    return new Set();
  }
}

function safeParseObject(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// ── Axis computations ────────────────────────────────────────────────────────

function computeCompletenessAxis(
  fields: FieldRow[],
  records: RecordRow[]
): { axis: QaAxisDetail; emptyByField: Map<string, number> } {
  const required = fields.filter((f) => isRequired(f) && !f.isComputed);
  const emptyByField = new Map<string, number>();
  if (records.length === 0 || required.length === 0) {
    return {
      axis: {
        score: 1,
        band: 'green',
        details: [
          { metric: 'records', value: records.length },
          { metric: 'required_fields', value: required.length },
          { metric: 'fill_rate', value: 1 },
          { metric: 'low_confidence_ratio', value: 0 },
        ],
      },
      emptyByField,
    };
  }

  let totalCells = 0;
  let filledCells = 0;
  for (const r of records) {
    for (const f of required) {
      totalCells += 1;
      const value = r.data[f.id] ?? r.data[f.name];
      if (isMissing(value)) {
        emptyByField.set(f.id, (emptyByField.get(f.id) ?? 0) + 1);
      } else {
        filledCells += 1;
      }
    }
  }
  const fillRate = totalCells === 0 ? 1 : filledCells / totalCells;

  const lowConfRecords = records.filter(
    (r) => r.confidenceScore !== null && r.confidenceScore < LOW_CONFIDENCE_THRESHOLD
  );
  const lowConfRatio = records.length === 0 ? 0 : lowConfRecords.length / records.length;

  const score = clamp01(0.7 * fillRate + 0.3 * (1 - lowConfRatio));
  return {
    axis: {
      score,
      band: bandFor(score),
      details: [
        { metric: 'records', value: records.length },
        { metric: 'required_fields', value: required.length },
        { metric: 'fill_rate', value: round3(fillRate) },
        { metric: 'low_confidence_ratio', value: round3(lowConfRatio) },
      ],
    },
    emptyByField,
  };
}

function computeFreshnessAxis(records: RecordRow[], lastVerifiedAt: string | null): QaAxisDetail {
  if (records.length === 0) {
    return {
      score: 1,
      band: 'green',
      details: [
        { metric: 'last_record_update_days', value: null },
        { metric: 'last_source_verified_days', value: null },
      ],
    };
  }
  const newest = records.reduce(
    (acc, r) => (r.updatedAt > acc ? r.updatedAt : acc),
    records[0]!.updatedAt
  );
  const daysSinceUpdate = daysBetween(newest);
  const daysSinceVerify = lastVerifiedAt ? daysBetween(lastVerifiedAt) : null;
  const updateScore = freshnessSubScore(daysSinceUpdate);
  const verifyScore = daysSinceVerify === null ? updateScore : freshnessSubScore(daysSinceVerify);
  const score = clamp01((updateScore + verifyScore) / 2);
  return {
    score,
    band: bandFor(score),
    details: [
      { metric: 'last_record_update_days', value: round1(daysSinceUpdate) },
      {
        metric: 'last_source_verified_days',
        value: daysSinceVerify === null ? null : round1(daysSinceVerify),
      },
    ],
  };
}

function freshnessSubScore(days: number): number {
  if (days <= FRESHNESS_GREEN_DAYS) return 1;
  if (days <= FRESHNESS_AMBER_DAYS) {
    const span = FRESHNESS_AMBER_DAYS - FRESHNESS_GREEN_DAYS;
    return clamp01(1 - (days - FRESHNESS_GREEN_DAYS) / span);
  }
  return 0;
}

function daysBetween(iso: string): number {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

function computeSourceCoverageAxis(coverage: SourceCoverageRow): QaAxisDetail {
  if (coverage.totalRecords === 0) {
    return {
      score: 1,
      band: 'green',
      details: [
        { metric: 'records_with_verified_source', value: 0 },
        { metric: 'total_records', value: 0 },
        { metric: 'coverage_ratio', value: 1 },
      ],
    };
  }
  const ratio = coverage.recordsWithVerifiedSource / coverage.totalRecords;
  return {
    score: clamp01(ratio),
    band: bandFor(ratio),
    details: [
      { metric: 'records_with_verified_source', value: coverage.recordsWithVerifiedSource },
      { metric: 'total_records', value: coverage.totalRecords },
      { metric: 'coverage_ratio', value: round3(ratio) },
    ],
  };
}

interface MethodologyAxisOutcome {
  axis: QaAxisDetail;
  violations: Array<{ ruleId: string; message: string }>;
}

function computeMethodologyAxis(
  rules: Record<string, unknown>,
  fields: FieldRow[],
  records: RecordRow[]
): MethodologyAxisOutcome {
  const violations: Array<{ ruleId: string; message: string }> = [];
  let evaluated = 0;

  // Rule: required_fields — must exist in schema.
  const requiredFields = Array.isArray(rules.required_fields)
    ? (rules.required_fields as unknown[]).filter((f): f is string => typeof f === 'string')
    : [];
  if (requiredFields.length > 0) {
    evaluated += 1;
    const fieldNames = new Set(fields.map((f) => f.name));
    const missing = requiredFields.filter((f) => !fieldNames.has(f));
    if (missing.length > 0) {
      violations.push({
        ruleId: 'required_fields',
        message: `Schema missing required fields: ${missing.join(', ')}`,
      });
    }
  }

  // Rule: min_records_for_publish.
  const minRecords =
    typeof rules.min_records_for_publish === 'number'
      ? Number(rules.min_records_for_publish)
      : null;
  if (minRecords !== null && Number.isFinite(minRecords)) {
    evaluated += 1;
    if (records.length < minRecords) {
      violations.push({
        ruleId: 'min_records_for_publish',
        message: `Publish gate requires ≥${minRecords} records; have ${records.length}`,
      });
    }
  }

  // Rule: approval_required_fields — those fields must be filled on every
  // record marked as 'verified'.
  const approvalFields = Array.isArray(rules.approval_required_fields)
    ? (rules.approval_required_fields as unknown[]).filter(
        (f): f is string => typeof f === 'string'
      )
    : [];
  if (approvalFields.length > 0) {
    evaluated += 1;
    const idByName = new Map(fields.map((f) => [f.name, f.id]));
    const verifiedRecords = records.filter((r) => r.validationStatus === 'verified');
    let violationsForRule = 0;
    for (const r of verifiedRecords) {
      for (const fname of approvalFields) {
        const fid = idByName.get(fname) ?? fname;
        const v = r.data[fid] ?? r.data[fname];
        if (isMissing(v)) {
          violationsForRule += 1;
          break;
        }
      }
    }
    if (violationsForRule > 0) {
      violations.push({
        ruleId: 'approval_required_fields',
        message: `${violationsForRule} verified records are missing approval-required fields (${approvalFields.join(', ')})`,
      });
    }
  }

  if (evaluated === 0) {
    return {
      axis: {
        score: 1,
        band: 'green',
        details: [
          { metric: 'rules_evaluated', value: 0 },
          { metric: 'violations', value: 0 },
        ],
      },
      violations,
    };
  }

  const score = clamp01(1 - violations.length / Math.max(evaluated, 1));
  return {
    axis: {
      score,
      band: bandFor(score),
      details: [
        { metric: 'rules_evaluated', value: evaluated },
        { metric: 'violations', value: violations.length },
        { metric: 'violation_rules', value: violations.map((v) => v.ruleId) },
      ],
    },
    violations,
  };
}

interface FormulaAxisOutcome {
  axis: QaAxisDetail;
  brokenFields: string[];
}

function computeFormulaAxis(fields: FieldRow[], records: RecordRow[]): FormulaAxisOutcome {
  const formulaFields = fields.filter((f) => f.fieldType === 'formula');
  if (formulaFields.length === 0 || records.length === 0) {
    return {
      axis: {
        score: 1,
        band: 'green',
        details: [
          { metric: 'formula_fields', value: formulaFields.length },
          { metric: 'evaluations', value: 0 },
          { metric: 'errors', value: 0 },
        ],
      },
      brokenFields: [],
    };
  }
  const fieldMap = new Map<string, string>();
  for (const f of fields) {
    fieldMap.set(f.name, f.id);
    fieldMap.set(f.id, f.id);
  }
  let total = 0;
  let errors = 0;
  const errorByField = new Map<string, number>();
  for (const f of formulaFields) {
    const formulaStr = (f.options as { formula?: string })?.formula;
    if (!formulaStr || typeof formulaStr !== 'string') {
      errors += records.length;
      total += records.length;
      errorByField.set(f.id, records.length);
      continue;
    }
    let ast;
    try {
      ast = parseFormula(formulaStr);
    } catch {
      errors += records.length;
      total += records.length;
      errorByField.set(f.id, records.length);
      continue;
    }
    for (const r of records) {
      total += 1;
      try {
        evaluateFormula(ast, r.data, fieldMap);
      } catch {
        errors += 1;
        errorByField.set(f.id, (errorByField.get(f.id) ?? 0) + 1);
      }
    }
  }
  const successRate = total === 0 ? 1 : (total - errors) / total;
  const broken = [...errorByField.entries()].filter(([, n]) => n > 0).map(([fid]) => fid);
  return {
    axis: {
      score: clamp01(successRate),
      band: bandFor(successRate),
      details: [
        { metric: 'formula_fields', value: formulaFields.length },
        { metric: 'evaluations', value: total },
        { metric: 'errors', value: errors },
        { metric: 'broken_fields', value: broken },
      ],
    },
    brokenFields: broken,
  };
}

function round1(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}
function round3(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
}

function isRequired(f: FieldRow): boolean {
  return Boolean((f.options as { required?: boolean })?.required);
}

// ── Suggestion synthesis ─────────────────────────────────────────────────────

interface SuggestionInputs {
  tableId: string;
  fields: FieldRow[];
  emptyByField: Map<string, number>;
  freshness: QaAxisDetail;
  sourceCoverage: { axis: QaAxisDetail; coverage: SourceCoverageRow };
  methodology: MethodologyAxisOutcome;
  formula: FormulaAxisOutcome;
  completenessScore: number;
}

function synthesizeSuggestions(input: SuggestionInputs): QaSuggestion[] {
  const out: QaSuggestion[] = [];

  // Completeness — top-3 emptiest required fields by count.
  if (input.completenessScore < BAND_GREEN_MIN && input.emptyByField.size > 0) {
    const topEmpty = [...input.emptyByField.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    for (const [fieldId, count] of topEmpty) {
      const field = input.fields.find((f) => f.id === fieldId);
      const fieldName = field?.name ?? fieldId;
      const fp = fingerprintFor({
        tableId: input.tableId,
        axis: 'completeness',
        level: 'column',
        anchor: fieldId,
      });
      out.push({
        id: suggestionId(fp, out.length),
        fingerprint: fp,
        axis: 'completeness',
        description: `Bulk-fill empty values in column "${fieldName}" (${count} records missing).`,
        recommendedAction: {
          kind: 'open_ai_editor',
          level: 'column',
          payload: { fieldId, fieldName, missingCount: count },
        },
        severity: count > 50 ? 'high' : count > 10 ? 'medium' : 'low',
      });
    }
  }

  // Freshness — single suggestion when score < amber.
  if (input.freshness.score < BAND_AMBER_MIN) {
    const fp = fingerprintFor({
      tableId: input.tableId,
      axis: 'freshness',
      level: 'record',
      anchor: 'stale_records',
    });
    out.push({
      id: suggestionId(fp, out.length),
      fingerprint: fp,
      axis: 'freshness',
      description: 'Stale data detected. Review and verify the oldest records.',
      recommendedAction: {
        kind: 'open_ai_editor',
        level: 'record',
        payload: { hint: 'verify_stale_records' },
      },
      severity: input.freshness.score < 0.3 ? 'high' : 'medium',
    });
  }

  // Source coverage — single suggestion when below green.
  if (input.sourceCoverage.axis.score < BAND_GREEN_MIN) {
    const missingCount = Math.max(
      0,
      input.sourceCoverage.coverage.totalRecords -
        input.sourceCoverage.coverage.recordsWithVerifiedSource
    );
    const fp = fingerprintFor({
      tableId: input.tableId,
      axis: 'sourceCoverage',
      level: 'source',
      anchor: 'missing_sources',
    });
    out.push({
      id: suggestionId(fp, out.length),
      fingerprint: fp,
      axis: 'sourceCoverage',
      description: `${missingCount} records lack a verified source. Suggest candidate sources.`,
      recommendedAction: {
        kind: 'open_ai_editor',
        level: 'source',
        payload: { missingCount },
      },
      severity:
        input.sourceCoverage.axis.score < 0.4
          ? 'high'
          : input.sourceCoverage.axis.score < 0.7
            ? 'medium'
            : 'low',
    });
  }

  // Methodology — one suggestion per violation.
  for (const v of input.methodology.violations) {
    const fp = fingerprintFor({
      tableId: input.tableId,
      axis: 'methodology',
      level: 'methodological',
      anchor: v.ruleId,
    });
    out.push({
      id: suggestionId(fp, out.length),
      fingerprint: fp,
      axis: 'methodology',
      description: v.message,
      recommendedAction: {
        kind: 'open_ai_editor',
        level: 'methodological',
        payload: { ruleId: v.ruleId },
      },
      severity: 'high',
    });
  }

  // Formula — one suggestion per broken formula field.
  for (const fid of input.formula.brokenFields) {
    const field = input.fields.find((f) => f.id === fid);
    const fp = fingerprintFor({
      tableId: input.tableId,
      axis: 'formulaConsistency',
      level: 'structure',
      anchor: fid,
    });
    out.push({
      id: suggestionId(fp, out.length),
      fingerprint: fp,
      axis: 'formulaConsistency',
      description: `Formula field "${field?.name ?? fid}" produces evaluation errors.`,
      recommendedAction: {
        kind: 'open_ai_editor',
        level: 'structure',
        payload: { fieldId: fid, fieldName: field?.name },
      },
      severity: 'medium',
    });
  }

  return out;
}

// ── Service ──────────────────────────────────────────────────────────────────

const tableQaService = {
  /**
   * Compute a fresh QA report for `tableId`. Persists by default; pass
   * `persist: false` for a dry-run/preview.
   *
   * Cross-tenant defense: refuses tables not in `organizationId`.
   */
  async computeReport(input: ComputeReportInput): Promise<QaReport> {
    if (!input.tableId) throw new TableQaError('TABLE_ID_REQUIRED', 'tableId is required');
    if (!input.organizationId)
      throw new TableQaError('ORG_ID_REQUIRED', 'organizationId is required');
    if (!input.computedBy) throw new TableQaError('ACTOR_REQUIRED', 'computedBy is required');

    const tenant = await loadTenant(input.tableId);
    if (!tenant) throw new TableQaError('TABLE_NOT_FOUND', 'Table not found', 404);
    if (tenant.organizationId !== input.organizationId) {
      throw new TableQaError('TENANT_VIOLATION', 'Table not in actor organization', 403);
    }

    const start = Date.now();
    const [fields, records, sourceCoverage, governanceRules, dismissedFingerprints] =
      await Promise.all([
        loadFields(input.tableId),
        loadRecords(input.tableId),
        loadSourceCoverage(input.tableId),
        loadGovernanceRules(tenant.appliedTemplateId),
        loadDismissals(input.tableId),
      ]);

    const completeness = computeCompletenessAxis(fields, records);
    const freshness = computeFreshnessAxis(records, sourceCoverage.lastVerifiedAt);
    const sourceCoverageAxis = computeSourceCoverageAxis(sourceCoverage);
    const methodology = computeMethodologyAxis(governanceRules, fields, records);
    const formula = computeFormulaAxis(fields, records);

    const axes: Record<QaAxisName, QaAxisDetail> = {
      completeness: completeness.axis,
      freshness,
      sourceCoverage: sourceCoverageAxis,
      methodology: methodology.axis,
      formulaConsistency: formula.axis,
    };

    const overallScore = clamp01(
      AXIS_WEIGHTS.completeness * axes.completeness.score +
        AXIS_WEIGHTS.freshness * axes.freshness.score +
        AXIS_WEIGHTS.sourceCoverage * axes.sourceCoverage.score +
        AXIS_WEIGHTS.methodology * axes.methodology.score +
        AXIS_WEIGHTS.formulaConsistency * axes.formulaConsistency.score
    );

    const allSuggestions = synthesizeSuggestions({
      tableId: input.tableId,
      fields,
      emptyByField: completeness.emptyByField,
      freshness,
      sourceCoverage: { axis: sourceCoverageAxis, coverage: sourceCoverage },
      methodology,
      formula,
      completenessScore: axes.completeness.score,
    });
    // Filter out dismissed suggestions.
    const visibleSuggestions = allSuggestions.filter(
      (s) => !dismissedFingerprints.has(s.fingerprint)
    );

    const computationMs = Date.now() - start;
    const triggerKind: QaTriggerKind = input.triggerKind ?? 'on_demand';

    const report: QaReport = {
      id: '',
      tableId: input.tableId,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      computedAt: new Date().toISOString(),
      computedBy: input.computedBy,
      triggerKind,
      overallScore: round3(overallScore),
      axes,
      suggestions: visibleSuggestions,
      computationMs,
    };

    if (input.persist !== false) {
      report.id = await persistReport(report);
    }

    return report;
  },

  /**
   * Returns the most recent persisted report for `tableId`, or `null` if none.
   * Cross-tenant defense: refuses tables not in `organizationId`.
   */
  async getLatestReport(tableId: string, organizationId: string): Promise<QaReport | null> {
    if (!tableId) throw new TableQaError('TABLE_ID_REQUIRED', 'tableId is required');
    if (!organizationId) throw new TableQaError('ORG_ID_REQUIRED', 'organizationId is required');

    const tenant = await loadTenant(tableId);
    if (!tenant) return null;
    if (tenant.organizationId !== organizationId) {
      throw new TableQaError('TENANT_VIOLATION', 'Table not in actor organization', 403);
    }

    const db = getDatabase();
    const { rows } = await db.query(
      `SELECT id, table_id, organization_id, workspace_id, computed_at, computed_by,
              trigger_kind, overall_score, axes, suggestions, computation_ms
         FROM tp_qa_reports
        WHERE table_id = $1
        ORDER BY computed_at DESC
        LIMIT 1`,
      [tableId]
    );
    const row = rows?.[0];
    if (!row) return null;
    return rowToReport(row);
  },

  /**
   * Dismisses a suggestion durably for the table. Idempotent (re-dismissing
   * the same fingerprint just refreshes `dismissed_at` / `reason`).
   */
  async markSuggestionInapplicable(
    input: MarkInapplicableInput
  ): Promise<{ tableId: string; fingerprint: string; dismissed: true }> {
    if (!input.tableId) throw new TableQaError('TABLE_ID_REQUIRED', 'tableId is required');
    if (!input.organizationId)
      throw new TableQaError('ORG_ID_REQUIRED', 'organizationId is required');
    if (!input.fingerprint)
      throw new TableQaError('FINGERPRINT_REQUIRED', 'fingerprint is required');
    if (!input.dismissedBy) throw new TableQaError('ACTOR_REQUIRED', 'dismissedBy is required');

    const tenant = await loadTenant(input.tableId);
    if (!tenant) throw new TableQaError('TABLE_NOT_FOUND', 'Table not found', 404);
    if (tenant.organizationId !== input.organizationId) {
      throw new TableQaError('TENANT_VIOLATION', 'Table not in actor organization', 403);
    }

    const db = getDatabase();
    await db.query(
      `INSERT INTO tp_qa_suggestion_dismissals
         (table_id, organization_id, fingerprint, reason, dismissed_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (table_id, fingerprint)
       DO UPDATE SET reason = EXCLUDED.reason,
                     dismissed_by = EXCLUDED.dismissed_by,
                     dismissed_at = NOW()`,
      [
        input.tableId,
        tenant.organizationId,
        input.fingerprint,
        input.reason ?? null,
        input.dismissedBy,
      ]
    );

    return {
      tableId: input.tableId,
      fingerprint: input.fingerprint,
      dismissed: true,
    };
  },

  /**
   * Schedule a debounced async recompute. Multiple calls for the same
   * `tableId` within `DEBOUNCE_MS` collapse to a single trailing run. Callers
   * (RecordsService, RelationService …) should invoke this on every record
   * write/relation change with `triggerKind: 'record_write'`.
   *
   * The scheduler is in-process by default; tests can swap it via
   * `__setSchedulerFnForTesting()`.
   */
  scheduleRecompute(input: {
    tableId: string;
    organizationId: string;
    delayMs?: number;
    triggerKind?: QaTriggerKind;
  }): void {
    if (!input.tableId || !input.organizationId) return;
    const delay = input.delayMs ?? DEBOUNCE_MS;
    const trigger = input.triggerKind ?? 'record_write';
    activeScheduler(input.tableId, input.organizationId, delay, async () => {
      await this.computeReport({
        tableId: input.tableId,
        organizationId: input.organizationId,
        computedBy: 'system:scheduler',
        triggerKind: trigger,
      });
    });
  },

  /**
   * Test-only: replace the scheduler implementation. Pass `null` to restore.
   */
  __setSchedulerFnForTesting(fn: SchedulerFn | null): void {
    activeScheduler = fn ?? defaultScheduler;
  },

  /**
   * Test-only: clear any pending in-process timers.
   */
  __clearSchedulerForTesting(): void {
    for (const t of debounceTimers.values()) clearTimeout(t);
    debounceTimers.clear();
  },
};

async function persistReport(report: QaReport): Promise<string> {
  const db = getDatabase();
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO tp_qa_reports
       (table_id, organization_id, workspace_id, computed_at, computed_by,
        trigger_kind, overall_score, axes, suggestions, computation_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      report.tableId,
      report.organizationId,
      report.workspaceId,
      report.computedAt,
      report.computedBy,
      report.triggerKind,
      report.overallScore,
      JSON.stringify(report.axes),
      JSON.stringify(report.suggestions),
      report.computationMs ?? null,
    ]
  );
  return String(rows?.[0]?.id ?? '');
}

function rowToReport(row: any): QaReport {
  return {
    id: String(row.id),
    tableId: String(row.table_id),
    organizationId: String(row.organization_id),
    workspaceId: String(row.workspace_id),
    computedAt:
      row.computed_at instanceof Date ? row.computed_at.toISOString() : String(row.computed_at),
    computedBy: String(row.computed_by),
    triggerKind: String(row.trigger_kind) as QaTriggerKind,
    overallScore: Number(row.overall_score),
    axes:
      typeof row.axes === 'string'
        ? (safeParseObject(row.axes) as Record<QaAxisName, QaAxisDetail>)
        : (row.axes as Record<QaAxisName, QaAxisDetail>),
    suggestions:
      typeof row.suggestions === 'string'
        ? (JSON.parse(row.suggestions) as QaSuggestion[])
        : ((row.suggestions ?? []) as QaSuggestion[]),
    computationMs: row.computation_ms == null ? undefined : Number(row.computation_ms),
  };
}

export default tableQaService;
