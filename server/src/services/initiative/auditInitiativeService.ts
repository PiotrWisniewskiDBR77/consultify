/**
 * F0 — Audit → Initiative (INITIATIVE BACKBONE, §F0 task 1).
 *
 * `createInitiativeFromAudit(...)` turns an audit finding into a DRAFT initiative,
 * stamping lineage `source_type='audit'` + `source_id=<auditId>`. It mirrors the
 * EXACT shape of `assessmentInitiativeService.ts` (persist via the canonical funnel
 * `createInitiative`, schema-variant-safe extra-column UPDATE, link row) so the two
 * source paths stay consistent.
 *
 * Source domain (the simplest reliable audit store — `audits` table, audit.routes):
 *   audits.id, audits.organization_id, audits.name, audits.findings (JSON TEXT)
 * Findings are stored INLINE as a JSON array in `audits.findings` (there is no
 * separate audit_findings table). A finding looks like:
 *   { title, description?, severity?, recommendation?, area?, ... }
 *
 * RULES:
 * - Status MUST be DRAFT (funnel normalizes; we never pass another status).
 * - Lineage: source_type='audit', source_id=auditId (funnel enforces sourceId for
 *   non-manual sources — defence-in-depth here too).
 * - Best-effort AI enrichment with a deterministic fallback (no AI dependency for
 *   the core path), matching assessment's degrade-gracefully posture.
 */
import { v4 as uuidv4 } from 'uuid';

import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { createInitiative as funnelCreateInitiative } from './createInitiativeService.js';

/** Shape of a single audit finding as stored in `audits.findings` JSON. */
export interface AuditFinding {
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical' | string;
  recommendation?: string;
  area?: string;
  category?: string;
}

export interface AuditRow {
  id: string;
  organization_id: string;
  project_id?: string | null;
  name?: string | null;
  findings?: string | null;
}

export interface CreateInitiativeFromAuditParams {
  /** The audit this initiative is sourced from (lineage anchor). */
  auditId: string;
  /** Org scope — mandatory. */
  organizationId: string;
  /** Creating user. */
  userId: string;
  /** Optional explicit project scope (else inherits from the audit row). */
  projectId?: string | null;
  /**
   * The finding to convert. When omitted, we attempt to load the audit row and
   * use its FIRST finding (caller can pre-select instead).
   */
  finding?: AuditFinding | null;
  /** Pre-loaded audit row (skips the DB read when provided — handy for tests). */
  audit?: AuditRow | null;
}

export interface CreateInitiativeFromAuditResult {
  id: string;
  title: string;
  status: string;
  sourceType: string;
  sourceId: string;
}

/** Map an audit severity onto an initiative priority. */
function severityToPriority(severity?: string): 'low' | 'medium' | 'high' | 'critical' {
  switch (String(severity || '').toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'low':
      return 'low';
    case 'medium':
    default:
      return 'medium';
  }
}

/** Map an audit severity onto an initiative risk level. */
function severityToRisk(severity?: string): 'low' | 'medium' | 'high' {
  switch (String(severity || '').toLowerCase()) {
    case 'critical':
    case 'high':
      return 'high';
    case 'low':
      return 'low';
    default:
      return 'medium';
  }
}

/** Safe JSON parse of the `audits.findings` blob → array of findings. */
function parseFindings(raw: string | null | undefined): AuditFinding[] {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as AuditFinding[];
    // Some writers store `{ findings: [...] }`.
    if (parsed && Array.isArray(parsed.findings)) return parsed.findings as AuditFinding[];
    return [];
  } catch {
    return [];
  }
}

/**
 * Build the initiative draft fields from an audit finding. Deterministic — no AI
 * required (AI enrichment is a separate, optional pass handled by the generator).
 */
function findingToDraft(finding: AuditFinding, auditName?: string | null) {
  const rawTitle = (finding.title || finding.name || '').toString().trim();
  const title = (
    rawTitle || `Audyt: ${auditName || 'ustalenie'} — działanie naprawcze`
  ).slice(0, 200);

  const descParts = [
    finding.description?.toString().trim(),
    finding.recommendation
      ? `Rekomendacja: ${finding.recommendation.toString().trim()}`
      : '',
  ].filter(Boolean);

  const problemStatement = finding.description?.toString().trim() || rawTitle || null;

  return {
    title,
    description: descParts.join('\n\n') || rawTitle || null,
    problemStatement,
    category: finding.category || finding.area || null,
    priority: severityToPriority(finding.severity),
    risk: severityToRisk(finding.severity),
  };
}

/**
 * Create a DRAFT initiative from an audit finding, stamping lineage
 * `source_type='audit'` + `source_id=auditId`.
 *
 * Returns the created initiative summary. Throws on missing audit / empty findings
 * / funnel validation failure (caller maps to HTTP).
 */
export async function createInitiativeFromAudit(
  params: CreateInitiativeFromAuditParams
): Promise<CreateInitiativeFromAuditResult> {
  const { auditId, organizationId, userId } = params;
  if (!auditId) throw new Error('auditId is required');
  if (!organizationId) throw new Error('organizationId is required');

  // Resolve the audit row (DB read unless caller pre-supplied it).
  // Schema-safe: the live `audits` table may lack project_id (added by migration
  // 20260627_audits). A schema-drift error MUST degrade to not-found (404), never a
  // raw 500 — so we try the full select, then fall back to the guaranteed columns.
  let audit: AuditRow | null = params.audit ?? null;
  if (!audit) {
    try {
      audit = await queryHelpers.queryOne<AuditRow>(
        `SELECT id, organization_id, project_id, name, findings
         FROM audits WHERE id = ? AND organization_id = ?`,
        [auditId, organizationId]
      );
    } catch {
      // missing optional column (e.g. project_id) — retry with the guaranteed set
      try {
        audit = await queryHelpers.queryOne<AuditRow>(
          `SELECT id, organization_id, name, findings
           FROM audits WHERE id = ? AND organization_id = ?`,
          [auditId, organizationId]
        );
      } catch {
        audit = null; // table/columns absent → treat as not found (→ 404)
      }
    }
  }
  if (!audit) {
    const err = new Error('Audit not found');
    (err as { statusCode?: number }).statusCode = 404;
    throw err;
  }

  // Pick the finding: explicit param wins, else first finding on the audit.
  let finding: AuditFinding | null = params.finding ?? null;
  if (!finding) {
    const findings = parseFindings(audit.findings);
    finding = findings.length > 0 ? findings[0] : null;
  }
  if (!finding) {
    const err = new Error('Audit has no findings to convert into an initiative');
    (err as { statusCode?: number }).statusCode = 422;
    throw err;
  }

  const draft = findingToDraft(finding, audit.name);
  const sourceType = 'audit';
  const sourceId = String(auditId);
  const projectId = params.projectId ?? audit.project_id ?? null;

  // Persist through the canonical funnel — it normalizes status→DRAFT, writes
  // name+title, enforces the lineage refine, and emits the created audit event.
  const created = await funnelCreateInitiative(
    organizationId,
    {
      title: draft.title,
      projectId,
      description: draft.description,
      problemStatement: draft.problemStatement,
      category: draft.category,
      priority: draft.priority,
      // status DRAFT intentionally OMITTED — funnel normalizes it.
      sourceType,
      sourceId,
    },
    { validate: false, actor: { id: userId } }
  );

  // Extra columns the funnel does not know (risk_level, created_by) — schema-safe
  // post-create UPDATE, exactly like assessmentInitiativeService.
  try {
    const cols = await queryHelpers.getTableColumns('initiatives').catch(() => null);
    const colSet = cols ? new Set((cols || []).map((c) => c.name).filter(Boolean) as string[]) : null;
    const upCols: string[] = [];
    const upVals: unknown[] = [];
    const setIf = (col: string, value: unknown) => {
      if (colSet === null) return; // unknown schema → skip optional columns
      if (!colSet.has(col)) return;
      upCols.push(`${col} = ?`);
      upVals.push(value);
    };
    setIf('risk_level', draft.risk);
    setIf('created_by', userId);
    if (upCols.length > 0) {
      await queryHelpers.queryRun(
        `UPDATE initiatives SET ${upCols.join(', ')} WHERE id = ? AND organization_id = ?`,
        [...upVals, created.id, organizationId]
      );
    }
  } catch (updErr) {
    logger.warn(
      `[auditInitiativeService] post-create UPDATE failed (ignored): ${
        (updErr as Error)?.message || updErr
      }`
    );
  }

  return {
    id: created.id,
    title: created.title,
    status: created.status,
    sourceType: created.sourceType,
    sourceId: created.sourceId || sourceId,
  };
}

export default { createInitiativeFromAudit };
