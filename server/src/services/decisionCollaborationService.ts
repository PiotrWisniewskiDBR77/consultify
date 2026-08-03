/**
 * MW-DEC-001 — Decision collaboration data layer.
 *
 * Sibling service to DecisionController.ts / pmo/decisions.routes.ts (the
 * single canonical Decision domain owner — see CLAUDE.md architectural
 * rules). DecisionController is the only controller that calls this file;
 * this file is the only writer of decision_comments / decision_alternatives /
 * decision_risks, and the only place that runs the atomic final-transition
 * (approve/reject) on `decisions`.
 *
 * Root gap this replaces: DecisionDetailView.tsx (frontend) fakes comments/
 * alternatives/risks in `localStorage['consultify-decision-enhancements:<id>']`
 * with a hardcoded fake author "Current User" (MW-CORE-001_CURRENT_RUNTIME_MAP.md
 * §4). Every function here is real, organization-scoped, author-from-token
 * persistence — see 932_decision_workflow_canonical.sql for the schema.
 */
import type { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

import { acquirePgClient } from '../database/PostgresDatabase.js';
import { getTableColumns } from '../utils/dbSchema.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import { normalizeApplicationRole } from '../utils/roleNormalization.js';
import {
  isTerminalDecisionOutcome,
  requiresRationale,
  validateDecideTransition,
} from './decisionOutcomeService.js';
import NotificationOutboxService from './notificationOutboxService.js';

// ==========================================
// ERRORS (mapped to HTTP status by DecisionController)
// ==========================================

export class DecisionNotFoundError extends Error {
  constructor(message = 'Decision not found') {
    super(message);
    this.name = 'DecisionNotFoundError';
  }
}

export class DecisionSubResourceNotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'DecisionSubResourceNotFoundError';
  }
}

export class DecisionConflictError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DecisionConflictError';
    this.code = code;
    this.details = details;
  }
}

export class DecisionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecisionValidationError';
  }
}

// ==========================================
// SHARED HELPERS
// ==========================================

/** Role check shared by alternatives/risks authorship gates. Admin/Owner only. */
export function isPrivilegedRole(role?: string | null): boolean {
  return normalizeApplicationRole(role) === 'ADMIN' || normalizeApplicationRole(role) === 'OWNER';
}

interface DecisionOrgRow {
  id: string;
  organization_id: string;
  status: string | null;
  decision_maker_id: string | null;
  created_by: string | null;
  version: number | null;
}

/**
 * Org-scoped existence check reused by every mutation in this file. Returns
 * 404-worthy `DecisionNotFoundError` for both "does not exist" and "exists in
 * a different organization" — never leaks cross-tenant existence (mission
 * requirement: cross-tenant access returns 404, never 200/403-with-detail).
 */
async function getDecisionForOrgOrThrow(
  decisionId: string,
  organizationId: string
): Promise<DecisionOrgRow> {
  const cols = await getTableColumns('decisions');
  const versionSelect = cols.has('version') ? 'version' : '1 as version';
  const row = await queryHelpers.queryOne<DecisionOrgRow>(
    `SELECT id, organization_id, status, decision_maker_id, created_by, ${versionSelect}
     FROM decisions WHERE id = ? AND organization_id = ? LIMIT 1`,
    [decisionId, organizationId]
  );
  if (!row) throw new DecisionNotFoundError();
  return row;
}

function requireNonEmptyText(value: unknown, field: string, maxLen = 5000): string {
  const decoded = decodeHtmlEntities(String(value ?? '').trim());
  if (!decoded) throw new DecisionValidationError(`${field} is required`);
  return decoded.length > maxLen ? decoded.slice(0, maxLen) : decoded;
}

function optionalText(value: unknown, maxLen = 5000): string | null {
  if (value === undefined || value === null) return null;
  const decoded = decodeHtmlEntities(String(value).trim());
  if (!decoded) return null;
  return decoded.length > maxLen ? decoded.slice(0, maxLen) : decoded;
}

const SEVERITY_VALUES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const LIKELIHOOD_VALUES = new Set(['LOW', 'MEDIUM', 'HIGH']);

/** Reuses `decisions.priority`'s 4-level vocabulary (see DecisionController.normalizePriority). */
function normalizeSeverity(value?: string | null): string {
  const upper = String(value || 'MEDIUM').toUpperCase();
  return SEVERITY_VALUES.has(upper) ? upper : 'MEDIUM';
}

/** Reuses `decisions.impact`'s 3-level vocabulary (see DecisionController.normalizeImpact). */
function normalizeLikelihood(value?: string | null): string {
  const upper = String(value || 'MEDIUM').toUpperCase();
  return LIKELIHOOD_VALUES.has(upper) ? upper : 'MEDIUM';
}

/**
 * Freeze rule for alternatives/risks: once a decision has a terminal outcome
 * (approved/rejected) the dossier that was actually decided on cannot be
 * rewritten after the fact. Comments are explicitly NOT subject to this rule
 * (see decision_comments comment in the migration) — discussion continues
 * after a decision is made.
 */
function assertDossierEditable(decision: DecisionOrgRow): void {
  if (isTerminalDecisionOutcome(decision.status)) {
    throw new DecisionConflictError(
      `Decision is already ${String(decision.status).toLowerCase()}; alternatives/risks are frozen`,
      'DECISION_FINALIZED'
    );
  }
}

// ==========================================
// COMMENTS
// ==========================================

export interface DecisionCommentDTO {
  id: string;
  decisionId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

function toCommentDTO(row: any): DecisionCommentDTO {
  return {
    id: row.id,
    decisionId: row.decision_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listDecisionComments(
  decisionId: string,
  organizationId: string
): Promise<DecisionCommentDTO[]> {
  await getDecisionForOrgOrThrow(decisionId, organizationId);
  const rows = await queryHelpers.queryAll(
    `SELECT id, decision_id, author_id, body, created_at, updated_at
     FROM decision_comments
     WHERE organization_id = ? AND decision_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [organizationId, decisionId]
  );
  return (rows || []).map(toCommentDTO);
}

export async function createDecisionComment(input: {
  decisionId: string;
  organizationId: string;
  authorId: string;
  body: string;
}): Promise<DecisionCommentDTO> {
  const { decisionId, organizationId, authorId } = input;
  await getDecisionForOrgOrThrow(decisionId, organizationId);
  const body = requireNonEmptyText(input.body, 'body', 4000);

  const id = uuidv4();
  await queryHelpers.queryRun(
    `INSERT INTO decision_comments (id, organization_id, decision_id, author_id, body, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [id, organizationId, decisionId, authorId, body]
  );

  const row = await queryHelpers.queryOne(
    `SELECT id, decision_id, author_id, body, created_at, updated_at FROM decision_comments WHERE id = ?`,
    [id]
  );
  return toCommentDTO(row);
}

export async function updateDecisionComment(input: {
  decisionId: string;
  organizationId: string;
  commentId: string;
  actorId: string;
  actorRole?: string | null;
  body: string;
}): Promise<DecisionCommentDTO> {
  const { decisionId, organizationId, commentId, actorId, body } = input;
  await getDecisionForOrgOrThrow(decisionId, organizationId);

  const existing = await queryHelpers.queryOne<{ author_id: string }>(
    `SELECT author_id FROM decision_comments
     WHERE id = ? AND organization_id = ? AND decision_id = ? AND deleted_at IS NULL`,
    [commentId, organizationId, decisionId]
  );
  if (!existing) throw new DecisionSubResourceNotFoundError('Comment not found');

  if (existing.author_id !== actorId && !isPrivilegedRole(input.actorRole)) {
    throw new DecisionConflictError(
      'Only the comment author or an admin can edit this comment',
      'FORBIDDEN'
    );
  }

  const nextBody = requireNonEmptyText(body, 'body', 4000);
  await queryHelpers.queryRun(
    `UPDATE decision_comments SET body = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [nextBody, commentId]
  );

  const row = await queryHelpers.queryOne(
    `SELECT id, decision_id, author_id, body, created_at, updated_at FROM decision_comments WHERE id = ?`,
    [commentId]
  );
  return toCommentDTO(row);
}

export async function deleteDecisionComment(input: {
  decisionId: string;
  organizationId: string;
  commentId: string;
  actorId: string;
  actorRole?: string | null;
}): Promise<void> {
  const { decisionId, organizationId, commentId, actorId } = input;
  await getDecisionForOrgOrThrow(decisionId, organizationId);

  const existing = await queryHelpers.queryOne<{ author_id: string }>(
    `SELECT author_id FROM decision_comments
     WHERE id = ? AND organization_id = ? AND decision_id = ? AND deleted_at IS NULL`,
    [commentId, organizationId, decisionId]
  );
  if (!existing) throw new DecisionSubResourceNotFoundError('Comment not found');

  if (existing.author_id !== actorId && !isPrivilegedRole(input.actorRole)) {
    throw new DecisionConflictError(
      'Only the comment author or an admin can delete this comment',
      'FORBIDDEN'
    );
  }

  await queryHelpers.queryRun(
    `UPDATE decision_comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [commentId]
  );
}

// ==========================================
// ALTERNATIVES
// ==========================================

export interface DecisionAlternativeDTO {
  id: string;
  decisionId: string;
  title: string;
  description: string | null;
  benefits: string | null;
  drawbacks: string | null;
  costOrFeasibility: string | null;
  isRecommended: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function toAlternativeDTO(row: any): DecisionAlternativeDTO {
  return {
    id: row.id,
    decisionId: row.decision_id,
    title: row.title,
    description: row.description ?? null,
    benefits: row.benefits ?? null,
    drawbacks: row.drawbacks ?? null,
    costOrFeasibility: row.cost_or_feasibility ?? null,
    isRecommended: row.is_recommended === true || row.is_recommended === 1,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listDecisionAlternatives(
  decisionId: string,
  organizationId: string
): Promise<DecisionAlternativeDTO[]> {
  await getDecisionForOrgOrThrow(decisionId, organizationId);
  const rows = await queryHelpers.queryAll(
    `SELECT id, decision_id, title, description, benefits, drawbacks, cost_or_feasibility,
            is_recommended, created_by, created_at, updated_at
     FROM decision_alternatives
     WHERE organization_id = ? AND decision_id = ?
     ORDER BY created_at ASC`,
    [organizationId, decisionId]
  );
  return (rows || []).map(toAlternativeDTO);
}

export async function createDecisionAlternative(input: {
  decisionId: string;
  organizationId: string;
  createdBy: string;
  title: string;
  description?: string;
  benefits?: string;
  drawbacks?: string;
  costOrFeasibility?: string;
  isRecommended?: boolean;
}): Promise<DecisionAlternativeDTO> {
  const { decisionId, organizationId, createdBy } = input;
  const decision = await getDecisionForOrgOrThrow(decisionId, organizationId);
  assertDossierEditable(decision);

  const title = requireNonEmptyText(input.title, 'title', 255);
  const id = uuidv4();
  await queryHelpers.queryRun(
    `INSERT INTO decision_alternatives
       (id, organization_id, decision_id, title, description, benefits, drawbacks,
        cost_or_feasibility, is_recommended, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      id,
      organizationId,
      decisionId,
      title,
      optionalText(input.description),
      optionalText(input.benefits),
      optionalText(input.drawbacks),
      optionalText(input.costOrFeasibility),
      Boolean(input.isRecommended),
      createdBy,
    ]
  );

  const row = await queryHelpers.queryOne(
    `SELECT id, decision_id, title, description, benefits, drawbacks, cost_or_feasibility,
            is_recommended, created_by, created_at, updated_at
     FROM decision_alternatives WHERE id = ?`,
    [id]
  );
  return toAlternativeDTO(row);
}

export async function updateDecisionAlternative(input: {
  decisionId: string;
  organizationId: string;
  alternativeId: string;
  patch: Partial<{
    title: string;
    description: string | null;
    benefits: string | null;
    drawbacks: string | null;
    costOrFeasibility: string | null;
    isRecommended: boolean;
  }>;
}): Promise<DecisionAlternativeDTO> {
  const { decisionId, organizationId, alternativeId, patch } = input;
  const decision = await getDecisionForOrgOrThrow(decisionId, organizationId);
  assertDossierEditable(decision);

  const existing = await queryHelpers.queryOne(
    `SELECT id FROM decision_alternatives WHERE id = ? AND organization_id = ? AND decision_id = ?`,
    [alternativeId, organizationId, decisionId]
  );
  if (!existing) throw new DecisionSubResourceNotFoundError('Alternative not found');

  const updates: string[] = [];
  const params: unknown[] = [];
  if (patch.title !== undefined) {
    updates.push('title = ?');
    params.push(requireNonEmptyText(patch.title, 'title', 255));
  }
  if (patch.description !== undefined) {
    updates.push('description = ?');
    params.push(optionalText(patch.description));
  }
  if (patch.benefits !== undefined) {
    updates.push('benefits = ?');
    params.push(optionalText(patch.benefits));
  }
  if (patch.drawbacks !== undefined) {
    updates.push('drawbacks = ?');
    params.push(optionalText(patch.drawbacks));
  }
  if (patch.costOrFeasibility !== undefined) {
    updates.push('cost_or_feasibility = ?');
    params.push(optionalText(patch.costOrFeasibility));
  }
  if (patch.isRecommended !== undefined) {
    updates.push('is_recommended = ?');
    params.push(Boolean(patch.isRecommended));
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(alternativeId);
    await queryHelpers.queryRun(
      `UPDATE decision_alternatives SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  const row = await queryHelpers.queryOne(
    `SELECT id, decision_id, title, description, benefits, drawbacks, cost_or_feasibility,
            is_recommended, created_by, created_at, updated_at
     FROM decision_alternatives WHERE id = ?`,
    [alternativeId]
  );
  return toAlternativeDTO(row);
}

export async function deleteDecisionAlternative(input: {
  decisionId: string;
  organizationId: string;
  alternativeId: string;
}): Promise<void> {
  const { decisionId, organizationId, alternativeId } = input;
  const decision = await getDecisionForOrgOrThrow(decisionId, organizationId);
  assertDossierEditable(decision);

  const result = await queryHelpers.queryRun(
    `DELETE FROM decision_alternatives WHERE id = ? AND organization_id = ? AND decision_id = ?`,
    [alternativeId, organizationId, decisionId]
  );
  if (!result || result.changes === 0)
    throw new DecisionSubResourceNotFoundError('Alternative not found');
}

// ==========================================
// RISKS
// ==========================================

export interface DecisionRiskDTO {
  id: string;
  decisionId: string;
  description: string;
  severity: string;
  likelihood: string;
  mitigation: string | null;
  ownerId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function toRiskDTO(row: any): DecisionRiskDTO {
  return {
    id: row.id,
    decisionId: row.decision_id,
    description: row.description,
    severity: row.severity,
    likelihood: row.likelihood,
    mitigation: row.mitigation ?? null,
    ownerId: row.owner_id ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listDecisionRisks(
  decisionId: string,
  organizationId: string
): Promise<DecisionRiskDTO[]> {
  await getDecisionForOrgOrThrow(decisionId, organizationId);
  const rows = await queryHelpers.queryAll(
    `SELECT id, decision_id, description, severity, likelihood, mitigation, owner_id,
            created_by, created_at, updated_at
     FROM decision_risks
     WHERE organization_id = ? AND decision_id = ?
     ORDER BY created_at ASC`,
    [organizationId, decisionId]
  );
  return (rows || []).map(toRiskDTO);
}

export async function createDecisionRisk(input: {
  decisionId: string;
  organizationId: string;
  createdBy: string;
  description: string;
  severity?: string;
  likelihood?: string;
  mitigation?: string;
  ownerId?: string | null;
}): Promise<DecisionRiskDTO> {
  const { decisionId, organizationId, createdBy } = input;
  const decision = await getDecisionForOrgOrThrow(decisionId, organizationId);
  assertDossierEditable(decision);

  const description = requireNonEmptyText(input.description, 'description', 2000);
  const id = uuidv4();
  await queryHelpers.queryRun(
    `INSERT INTO decision_risks
       (id, organization_id, decision_id, description, severity, likelihood, mitigation,
        owner_id, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      id,
      organizationId,
      decisionId,
      description,
      normalizeSeverity(input.severity),
      normalizeLikelihood(input.likelihood),
      optionalText(input.mitigation),
      input.ownerId || null,
      createdBy,
    ]
  );

  const row = await queryHelpers.queryOne(
    `SELECT id, decision_id, description, severity, likelihood, mitigation, owner_id,
            created_by, created_at, updated_at
     FROM decision_risks WHERE id = ?`,
    [id]
  );
  return toRiskDTO(row);
}

export async function updateDecisionRisk(input: {
  decisionId: string;
  organizationId: string;
  riskId: string;
  patch: Partial<{
    description: string;
    severity: string;
    likelihood: string;
    mitigation: string | null;
    ownerId: string | null;
  }>;
}): Promise<DecisionRiskDTO> {
  const { decisionId, organizationId, riskId, patch } = input;
  const decision = await getDecisionForOrgOrThrow(decisionId, organizationId);
  assertDossierEditable(decision);

  const existing = await queryHelpers.queryOne(
    `SELECT id FROM decision_risks WHERE id = ? AND organization_id = ? AND decision_id = ?`,
    [riskId, organizationId, decisionId]
  );
  if (!existing) throw new DecisionSubResourceNotFoundError('Risk not found');

  const updates: string[] = [];
  const params: unknown[] = [];
  if (patch.description !== undefined) {
    updates.push('description = ?');
    params.push(requireNonEmptyText(patch.description, 'description', 2000));
  }
  if (patch.severity !== undefined) {
    updates.push('severity = ?');
    params.push(normalizeSeverity(patch.severity));
  }
  if (patch.likelihood !== undefined) {
    updates.push('likelihood = ?');
    params.push(normalizeLikelihood(patch.likelihood));
  }
  if (patch.mitigation !== undefined) {
    updates.push('mitigation = ?');
    params.push(optionalText(patch.mitigation));
  }
  if (patch.ownerId !== undefined) {
    updates.push('owner_id = ?');
    params.push(patch.ownerId || null);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(riskId);
    await queryHelpers.queryRun(
      `UPDATE decision_risks SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  const row = await queryHelpers.queryOne(
    `SELECT id, decision_id, description, severity, likelihood, mitigation, owner_id,
            created_by, created_at, updated_at
     FROM decision_risks WHERE id = ?`,
    [riskId]
  );
  return toRiskDTO(row);
}

export async function deleteDecisionRisk(input: {
  decisionId: string;
  organizationId: string;
  riskId: string;
}): Promise<void> {
  const { decisionId, organizationId, riskId } = input;
  const decision = await getDecisionForOrgOrThrow(decisionId, organizationId);
  assertDossierEditable(decision);

  const result = await queryHelpers.queryRun(
    `DELETE FROM decision_risks WHERE id = ? AND organization_id = ? AND decision_id = ?`,
    [riskId, organizationId, decisionId]
  );
  if (!result || result.changes === 0) throw new DecisionSubResourceNotFoundError('Risk not found');
}

// ==========================================
// EVIDENCE LINKS (read-only here — reuses link_graph_edges; writes already
// possible via the existing generic POST /api/my-work/link-graph/edges, per
// architectural rule #6: do not invent a new evidence-link table/endpoint)
// ==========================================

export interface DecisionLinkDTO {
  id: string;
  relation: string;
  targetType: string;
  targetId: string;
  createdBy: string;
  createdAt: string;
}

export async function listDecisionLinks(
  decisionId: string,
  organizationId: string
): Promise<DecisionLinkDTO[]> {
  const hasLinkGraph = (await getTableColumns('link_graph_edges')).size > 0;
  if (!hasLinkGraph) return [];
  const rows = await queryHelpers.queryAll<{
    id: string;
    relation: string;
    target_type: string;
    target_id: string;
    created_by: string;
    created_at: string;
  }>(
    `SELECT id, relation, target_type, target_id, created_by, created_at
     FROM link_graph_edges
     WHERE organization_id = ? AND source_type = 'decision' AND source_id = ?
     ORDER BY created_at ASC`,
    [organizationId, decisionId]
  );
  return (rows || []).map((r) => ({
    id: r.id,
    relation: r.relation,
    targetType: r.target_type,
    targetId: r.target_id,
    createdBy: r.created_by,
    createdAt: r.created_at,
  }));
}

// ==========================================
// AGGREGATE READ (single call for GET /api/decisions/:id/detail)
// ==========================================

export async function getDecisionAggregateExtras(decisionId: string, organizationId: string) {
  // Existence/org-scope is re-verified by the caller (DecisionController
  // already loads the core decision row); these run in parallel since none
  // depend on each other.
  const [comments, alternatives, risks, links] = await Promise.all([
    listDecisionComments(decisionId, organizationId),
    listDecisionAlternatives(decisionId, organizationId),
    listDecisionRisks(decisionId, organizationId),
    listDecisionLinks(decisionId, organizationId),
  ]);
  return { comments, alternatives, risks, links };
}

// ==========================================
// ATOMIC FINAL TRANSITION (approve / reject / return-for-clarification)
// ==========================================

export interface FinalizeDecisionInput {
  decisionId: string;
  organizationId: string;
  actorId: string;
  actorRole?: string | null;
  targetStatus: string; // 'approved' | 'rejected' | 'returned_for_clarification' | 'pending'
  rationaleText: string;
  notes?: string;
  expectedVersion?: number;
}

export interface FinalizeDecisionResult {
  id: string;
  status: string;
  decidedBy: string | null;
  decidedAt: string | null;
  version: number;
  previousStatus: string;
}

/**
 * The atomic final-transition write. Runs SELECT ... FOR UPDATE, the
 * `decisions` UPDATE, and the `decision_history` INSERT on ONE pinned
 * PoolClient inside a single BEGIN/COMMIT — see acquirePgClient() doc in
 * PostgresDatabase.ts for why this is required (pool.query() per call does
 * NOT give atomicity). On any failure the whole transaction rolls back, so a
 * decision can never end up APPROVED/REJECTED without decision_rationale/
 * decided_by/decided_at/history all landing together (mission requirement:
 * "the decision must NOT be left in APPROVED/REJECTED status without
 * decision_rationale/decided_by/decided_at all set together").
 *
 * Authorization (decision-owner-or-admin) is checked by the caller
 * (DecisionController.decide) before calling this — this function still
 * re-validates the outcome-transition rules (terminal-state guard, rationale
 * requirement) as defense in depth, and is the ONLY place that enforces the
 * optimistic-concurrency version check.
 */
export async function finalizeDecisionTransition(
  input: FinalizeDecisionInput
): Promise<FinalizeDecisionResult> {
  const {
    decisionId,
    organizationId,
    actorId,
    targetStatus,
    rationaleText,
    notes,
    expectedVersion,
  } = input;

  const cols = await getTableColumns('decisions');
  const hasVersionCol = cols.has('version');
  const hasDecidedByCol = cols.has('decided_by');

  const client: PoolClient = await acquirePgClient();
  try {
    await client.query('BEGIN');

    const selectResult = await client.query(
      `SELECT id, organization_id, status, decision_maker_id, created_by${hasVersionCol ? ', version' : ''}
       FROM decisions WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [decisionId, organizationId]
    );
    const current = selectResult.rows[0] as
      | { id: string; status: string | null; version?: number }
      | undefined;

    if (!current) {
      await client.query('ROLLBACK');
      throw new DecisionNotFoundError();
    }

    const currentVersion = hasVersionCol ? Number(current.version ?? 1) : 1;

    if (
      hasVersionCol &&
      typeof expectedVersion === 'number' &&
      Number.isFinite(expectedVersion) &&
      expectedVersion !== currentVersion
    ) {
      await client.query('ROLLBACK');
      throw new DecisionConflictError(
        'Decision was modified since you last read it',
        'STALE_VERSION',
        { currentVersion, expectedVersion }
      );
    }

    const validation = validateDecideTransition({
      currentStatus: current.status,
      targetStatus,
      rationaleText,
    });
    if (!validation.allowed) {
      await client.query('ROLLBACK');
      if (validation.code === 'ALREADY_FINALIZED') {
        throw new DecisionConflictError(
          validation.reason || 'Decision already finalized',
          validation.code
        );
      }
      throw new DecisionValidationError(validation.reason || 'Invalid decision transition');
    }

    const nextVersion = currentVersion + 1;
    const setClauses = ['status = $1', 'decision_rationale = $2', 'updated_at = CURRENT_TIMESTAMP'];
    const params: unknown[] = [targetStatus, rationaleText || null];
    let paramIdx = 3;

    // decided_at/decided_by only make sense for a real terminal decision —
    // returned_for_clarification/pending do not set them (no outcome has
    // actually been reached yet).
    if (requiresRationale(targetStatus)) {
      setClauses.push(`decided_at = CURRENT_TIMESTAMP`);
      if (hasDecidedByCol) {
        setClauses.push(`decided_by = $${paramIdx}`);
        params.push(actorId);
        paramIdx += 1;
      }
    }
    if (hasVersionCol) {
      setClauses.push(`version = $${paramIdx}`);
      params.push(nextVersion);
      paramIdx += 1;
    }

    params.push(decisionId);
    await client.query(
      `UPDATE decisions SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
      params
    );

    await client.query(
      `INSERT INTO decision_history (id, decision_id, action, old_status, new_status, changed_by, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        uuidv4(),
        decisionId,
        targetStatus,
        current.status,
        targetStatus,
        actorId,
        JSON.stringify({ notes: notes || rationaleText || undefined, outcome: targetStatus }),
      ]
    );

    await client.query('COMMIT');

    return {
      id: decisionId,
      status: targetStatus,
      decidedBy: requiresRationale(targetStatus) ? actorId : null,
      decidedAt: requiresRationale(targetStatus) ? new Date().toISOString() : null,
      version: hasVersionCol ? nextVersion : currentVersion,
      previousStatus: String(current.status || 'pending'),
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.warn('[decisionCollaborationService] rollback after error failed', {
        error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
      });
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Best-effort post-commit notification. Never called inside the atomic
 * transaction (the outbox row must not roll back a successful decision
 * commit, and a failed enqueue must not roll back a successful decision
 * commit either — these are independent concerns). Persists a real
 * notification_outbox row via the existing NotificationOutboxService; actual
 * delivery depends on that service's drain cron — this function does not,
 * and must not, claim delivery succeeded.
 */
export async function enqueueDecisionFinalizedNotification(input: {
  organizationId: string;
  decisionId: string;
  decisionTitle: string;
  targetStatus: string;
  recipientUserId: string | null;
}): Promise<void> {
  const { organizationId, decisionId, decisionTitle, targetStatus, recipientUserId } = input;
  if (!recipientUserId) return;
  try {
    await NotificationOutboxService.enqueue(
      recipientUserId,
      organizationId,
      'DECISION_FINALIZED',
      {
        decisionId,
        status: targetStatus,
        message: `Decision "${decisionTitle}" is now ${targetStatus}.`,
      },
      { dedupeKey: `decision-finalized:${decisionId}:${targetStatus}` }
    );
  } catch (err) {
    logger.warn('[decisionCollaborationService] notification outbox enqueue failed (non-fatal)', {
      decisionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
