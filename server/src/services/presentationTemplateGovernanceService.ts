/**
 * Presentation Template Registry Governance (Epic C2)
 *
 * Adds an enterprise-grade lifecycle (`draft` / `approved` / `deprecated`),
 * a transition matrix gated by the `template_approve` capability, an
 * append-only audit ledger, and a parent/root/version lineage chain
 * for `presentation_templates`.
 *
 * Design rules:
 *
 *   - Pure-logic core (`evaluateLifecycleTransition`,
 *     `computeLineageForClone`) so the matrix stays unit-testable
 *     without a database.
 *   - DB helpers are schema-tolerant: when the migration has not run
 *     yet, they return `{ status: 'storage_error', reason: 'migration_pending' }`
 *     instead of throwing or 500-ing.
 *   - The audit ledger is append-only — events are never updated or
 *     deleted. Deprecating a template never removes the recipe; the
 *     row stays queryable so historical decks that referenced it keep
 *     resolving.
 *   - Lineage is immutable: `lineage_root_id` of a clone is set ONCE
 *     at clone time and never updated.
 *
 * Capability requirements come from `presentationAccessPolicyService`:
 * any state transition requires `template_approve`. The route layer
 * is the final authority but the pure core also reports the required
 * capability so the UI can disable buttons honestly without round-trip.
 */

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { hasPresentationCapability } from './presentationAccessPolicyService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateLifecycleState = 'draft' | 'approved' | 'deprecated';

export type TemplateGovernanceEventType =
  | 'submitted_for_approval'
  | 'approved'
  | 'rejected'
  | 'deprecated'
  | 'cloned'
  | 'reverted';

export interface TemplateGovernanceTransitionInput {
  currentState: TemplateLifecycleState;
  targetState: TemplateLifecycleState;
  actorRole: string;
  reason?: string;
}

export interface TemplateGovernanceTransitionResult {
  status: 'allowed' | 'blocked';
  reason: string;
  requiredCapability?: 'template_approve';
  warnings: string[];
}

export interface TemplateGovernanceLineageInput {
  parentTemplate: { id: string; lineageRootId: string | null; lineageVersion: number };
}

export interface TemplateGovernanceLineageOutput {
  lineageParentId: string;
  lineageRootId: string;
  lineageVersion: number;
}

export interface TemplateGovernanceEvent {
  id: string;
  templateId: string;
  organizationId: string;
  eventType: TemplateGovernanceEventType;
  fromState: TemplateLifecycleState | null;
  toState: TemplateLifecycleState | null;
  actorId: string | null;
  actorRole: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TemplateGovernanceRecord {
  id: string;
  name: string;
  lifecycle_state: TemplateLifecycleState;
  lineage_version: number;
  lineage_root_id: string | null;
  lineage_parent_id: string | null;
  approved_at: string | null;
  approved_by: string | null;
  deprecated_at: string | null;
  deprecated_by: string | null;
  deprecation_reason: string | null;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_STATES: ReadonlySet<TemplateLifecycleState> = new Set([
  'draft',
  'approved',
  'deprecated',
]);

const TABLE_TEMPLATES = 'presentation_templates';
const TABLE_EVENTS = 'presentation_template_governance_events';

// ---------------------------------------------------------------------------
// Pure core: lifecycle transition matrix
// ---------------------------------------------------------------------------

function isValidState(value: unknown): value is TemplateLifecycleState {
  return typeof value === 'string' && VALID_STATES.has(value as TemplateLifecycleState);
}

/**
 * Evaluate whether a lifecycle transition is allowed.
 *
 * Allowed transitions matrix (rows = from, columns = to):
 *
 *   | from \ to  | draft | approved          | deprecated        |
 *   | draft      | —     | template_approve  | template_approve  |
 *   | approved   | NO    | —                 | template_approve  |
 *   | deprecated | NO    | NO                | —                 |
 *
 * `approved -> draft` is intentionally blocked: callers must clone
 * the approved template into a fresh draft instead, which preserves
 * the lineage chain. Same for resurrecting a `deprecated` template.
 *
 * Same-state transitions are blocked with `Already in <state>`.
 */
export function evaluateLifecycleTransition(
  input: TemplateGovernanceTransitionInput
): TemplateGovernanceTransitionResult {
  const warnings: string[] = [];

  // Defensive: never throw on malformed input.
  const current = isValidState(input?.currentState) ? input.currentState : null;
  const target = isValidState(input?.targetState) ? input.targetState : null;
  const actorRole = String(input?.actorRole || '').trim();
  const reason = typeof input?.reason === 'string' ? input.reason.trim() : '';

  if (!current) {
    return { status: 'blocked', reason: 'Unknown current lifecycle state', warnings };
  }
  if (!target) {
    return { status: 'blocked', reason: 'Unknown target lifecycle state', warnings };
  }

  if (current === target) {
    return {
      status: 'blocked',
      reason: `Already in ${current}`,
      warnings,
    };
  }

  // Disallowed transitions that have nothing to do with the actor's
  // role — these always fail regardless of capability.
  if (current === 'approved' && target === 'draft') {
    return {
      status: 'blocked',
      reason: 'Cannot move approved template back to draft. Clone to a new draft instead.',
      warnings,
    };
  }
  if (current === 'deprecated') {
    return {
      status: 'blocked',
      reason: 'Cannot resurrect a deprecated template. Clone it to a new draft instead.',
      warnings,
    };
  }

  // All remaining allowed transitions require `template_approve`.
  if (!hasPresentationCapability(actorRole, 'template_approve')) {
    return {
      status: 'blocked',
      reason: 'Lifecycle transitions require the template_approve capability.',
      requiredCapability: 'template_approve',
      warnings,
    };
  }

  // Soft warning when transitioning to deprecated without a written
  // reason — operators should always explain why a template is being
  // retired so downstream consumers know what to use instead.
  if (target === 'deprecated' && reason.length === 0) {
    warnings.push('deprecation_without_reason');
  }

  return {
    status: 'allowed',
    reason: `Transition ${current} -> ${target} is allowed.`,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Pure core: lineage computation
// ---------------------------------------------------------------------------

/**
 * Derive lineage columns for a clone of `parentTemplate`.
 *
 *   - `lineageParentId` = parent's id (the clone's direct parent)
 *   - `lineageRootId`   = parent's root id, or parent.id if the parent
 *                         is itself the root (no root recorded yet)
 *   - `lineageVersion`  = parent.lineageVersion + 1
 *
 * Lineage is immutable: callers must NEVER update these columns after
 * the row has been inserted.
 */
export function computeLineageForClone(
  input: TemplateGovernanceLineageInput
): TemplateGovernanceLineageOutput {
  const parent = input?.parentTemplate;
  const parentId = String(parent?.id || '').trim();
  const parentRoot = String(parent?.lineageRootId || '').trim();
  const parentVersion = Number.isFinite(parent?.lineageVersion)
    ? Math.max(1, Math.floor(Number(parent.lineageVersion)))
    : 1;

  return {
    lineageParentId: parentId,
    lineageRootId: parentRoot.length > 0 ? parentRoot : parentId,
    lineageVersion: parentVersion + 1,
  };
}

// ---------------------------------------------------------------------------
// DB helpers: schema-tolerant
// ---------------------------------------------------------------------------

function isSchemaMissingError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('no such table') ||
    msg.includes('no such column') ||
    msg.includes('relation') ||
    msg.includes('column') && msg.includes('lifecycle_state')
  );
}

function runResultIsSchemaMissing(result: { success: boolean; error?: string }): boolean {
  if (result.success) return false;
  return isSchemaMissingError({ message: result.error });
}

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function eventRowToRecord(row: any): TemplateGovernanceEvent {
  return {
    id: String(row?.id || ''),
    templateId: String(row?.template_id || ''),
    organizationId: String(row?.organization_id || ''),
    eventType: String(row?.event_type || 'submitted_for_approval') as TemplateGovernanceEventType,
    fromState: isValidState(row?.from_state) ? row.from_state : null,
    toState: isValidState(row?.to_state) ? row.to_state : null,
    actorId: row?.actor_id ? String(row.actor_id) : null,
    actorRole: row?.actor_role ? String(row.actor_role) : null,
    reason: row?.reason ? String(row.reason) : null,
    metadata: safeJsonParse<Record<string, unknown>>(row?.metadata, {}),
    createdAt: row?.created_at ? String(row.created_at) : new Date(0).toISOString(),
  };
}

export async function listGovernanceEvents(
  orgId: string,
  templateId: string,
  limit: number = 20
): Promise<TemplateGovernanceEvent[]> {
  const safeOrg = String(orgId || '').trim();
  const safeTemplate = String(templateId || '').trim();
  if (!safeOrg || !safeTemplate) return [];
  const cappedLimit = Math.max(1, Math.min(200, Math.floor(limit) || 20));
  try {
    const rows = (await dbAll(
      `SELECT id, template_id, organization_id, event_type, from_state, to_state,
              actor_id, actor_role, reason, metadata, created_at
         FROM ${TABLE_EVENTS}
        WHERE organization_id = ? AND template_id = ?
        ORDER BY created_at DESC
        LIMIT ${cappedLimit}`,
      [safeOrg, safeTemplate]
    )) as any[];
    return (rows || []).map(eventRowToRecord);
  } catch {
    return [];
  }
}

export interface RecordGovernanceEventResult {
  status: 'ok' | 'storage_error';
  eventId?: string;
  reason?: string;
}

export async function recordGovernanceEvent(input: {
  templateId: string;
  organizationId: string;
  eventType: TemplateGovernanceEventType;
  fromState?: TemplateLifecycleState | null;
  toState?: TemplateLifecycleState | null;
  actorId?: string | null;
  actorRole?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<RecordGovernanceEventResult> {
  const safeOrg = String(input?.organizationId || '').trim();
  const safeTemplate = String(input?.templateId || '').trim();
  if (!safeOrg || !safeTemplate) {
    return { status: 'storage_error', reason: 'invalid_input' };
  }
  const metadataJson = JSON.stringify(input?.metadata ?? {});
  try {
    const result = await dbRun(
      `INSERT INTO ${TABLE_EVENTS}
        (template_id, organization_id, event_type, from_state, to_state,
         actor_id, actor_role, reason, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)`,
      [
        safeTemplate,
        safeOrg,
        input.eventType,
        input.fromState ?? null,
        input.toState ?? null,
        input.actorId ?? null,
        input.actorRole ?? null,
        input.reason ?? null,
        metadataJson,
      ]
    );
    if (!result.success) {
      if (runResultIsSchemaMissing(result)) {
        return { status: 'storage_error', reason: 'migration_pending' };
      }
      return { status: 'storage_error', reason: result.error || 'db_error' };
    }
    return { status: 'ok' };
  } catch (error) {
    if (isSchemaMissingError(error)) {
      return { status: 'storage_error', reason: 'migration_pending' };
    }
    return { status: 'storage_error', reason: 'db_error' };
  }
}

function templateRowToRecord(row: any): TemplateGovernanceRecord {
  const lifecycle = isValidState(row?.lifecycle_state) ? row.lifecycle_state : 'draft';
  const versionRaw = Number(row?.lineage_version);
  return {
    id: String(row?.id || ''),
    name: String(row?.name || ''),
    lifecycle_state: lifecycle,
    lineage_version: Number.isFinite(versionRaw) ? versionRaw : 1,
    lineage_root_id: row?.lineage_root_id ? String(row.lineage_root_id) : null,
    lineage_parent_id: row?.lineage_parent_id ? String(row.lineage_parent_id) : null,
    approved_at: row?.approved_at ? String(row.approved_at) : null,
    approved_by: row?.approved_by ? String(row.approved_by) : null,
    deprecated_at: row?.deprecated_at ? String(row.deprecated_at) : null,
    deprecated_by: row?.deprecated_by ? String(row.deprecated_by) : null,
    deprecation_reason: row?.deprecation_reason ? String(row.deprecation_reason) : null,
    updated_at: row?.updated_at ? String(row.updated_at) : new Date(0).toISOString(),
  };
}

const GOVERNANCE_COLUMNS = `
  id, name, organization_id, is_system, lifecycle_state,
  lineage_root_id, lineage_parent_id, lineage_version,
  approved_at, approved_by,
  deprecated_at, deprecated_by, deprecation_reason,
  updated_at
`;

async function getTemplateGovernanceRow(
  templateId: string,
  organizationId: string
): Promise<{ row: any | null; storageStatus: 'ok' | 'storage_error'; reason?: string }> {
  try {
    const row = (await dbGet(
      `SELECT ${GOVERNANCE_COLUMNS}
         FROM ${TABLE_TEMPLATES}
        WHERE id = ?
          AND (organization_id IS NULL OR organization_id = ?)`,
      [templateId, organizationId]
    )) as any;
    return { row: row || null, storageStatus: 'ok' };
  } catch (error) {
    if (isSchemaMissingError(error)) {
      return { row: null, storageStatus: 'storage_error', reason: 'migration_pending' };
    }
    return { row: null, storageStatus: 'storage_error', reason: 'db_error' };
  }
}

export interface ApplyLifecycleTransitionResult {
  status: 'ok' | 'not_found' | 'blocked' | 'storage_error';
  record?: TemplateGovernanceRecord;
  reason?: string;
  warnings?: string[];
  requiredCapability?: 'template_approve';
}

export async function applyLifecycleTransition(input: {
  templateId: string;
  organizationId: string;
  targetState: TemplateLifecycleState;
  actor: { id: string; role: string };
  reason?: string;
}): Promise<ApplyLifecycleTransitionResult> {
  const safeOrg = String(input?.organizationId || '').trim();
  const safeTemplate = String(input?.templateId || '').trim();
  if (!safeOrg || !safeTemplate) {
    return { status: 'not_found', reason: 'invalid_input' };
  }
  if (!isValidState(input?.targetState)) {
    return { status: 'blocked', reason: 'Unknown target lifecycle state' };
  }

  const lookup = await getTemplateGovernanceRow(safeTemplate, safeOrg);
  if (lookup.storageStatus === 'storage_error') {
    return { status: 'storage_error', reason: lookup.reason || 'db_error' };
  }
  if (!lookup.row) {
    return { status: 'not_found', reason: 'template_not_found' };
  }

  const currentRecord = templateRowToRecord(lookup.row);

  // System templates ship as `approved` and represent the canonical
  // out-of-the-box library. They MUST NOT be deprecated through the
  // normal flow because they back system-default decks for every org.
  if (lookup.row.is_system === true && input.targetState === 'deprecated') {
    return {
      status: 'blocked',
      reason: 'System templates cannot be deprecated through governance flow.',
    };
  }

  const evaluation = evaluateLifecycleTransition({
    currentState: currentRecord.lifecycle_state,
    targetState: input.targetState,
    actorRole: input.actor.role,
    reason: input.reason,
  });

  if (evaluation.status === 'blocked') {
    return {
      status: 'blocked',
      reason: evaluation.reason,
      ...(evaluation.requiredCapability
        ? { requiredCapability: evaluation.requiredCapability }
        : {}),
      warnings: evaluation.warnings,
    };
  }

  // Build the targeted UPDATE based on the destination state.
  const setClauses: string[] = ['lifecycle_state = ?', 'updated_at = CURRENT_TIMESTAMP'];
  const params: unknown[] = [input.targetState];
  if (input.targetState === 'approved') {
    setClauses.push('approved_at = CURRENT_TIMESTAMP');
    setClauses.push('approved_by = ?');
    params.push(input.actor.id || null);
  } else if (input.targetState === 'deprecated') {
    setClauses.push('deprecated_at = CURRENT_TIMESTAMP');
    setClauses.push('deprecated_by = ?');
    params.push(input.actor.id || null);
    setClauses.push('deprecation_reason = ?');
    params.push(input.reason ?? null);
  }
  params.push(safeTemplate);
  params.push(safeOrg);

  try {
    const updateResult = await dbRun(
      `UPDATE ${TABLE_TEMPLATES}
          SET ${setClauses.join(', ')}
        WHERE id = ?
          AND (organization_id IS NULL OR organization_id = ?)`,
      params
    );
    if (!updateResult.success) {
      if (runResultIsSchemaMissing(updateResult)) {
        return { status: 'storage_error', reason: 'migration_pending' };
      }
      return { status: 'storage_error', reason: updateResult.error || 'db_error' };
    }

    // Best-effort audit ledger write — even if the events table is
    // missing we keep the lifecycle update so the system stays useful.
    await recordGovernanceEvent({
      templateId: safeTemplate,
      organizationId: safeOrg,
      eventType: input.targetState === 'approved' ? 'approved' : 'deprecated',
      fromState: currentRecord.lifecycle_state,
      toState: input.targetState,
      actorId: input.actor.id || null,
      actorRole: input.actor.role || null,
      reason: input.reason ?? null,
    });

    const refreshed = await getTemplateGovernanceRow(safeTemplate, safeOrg);
    const record = refreshed.row ? templateRowToRecord(refreshed.row) : currentRecord;
    return {
      status: 'ok',
      record,
      ...(evaluation.warnings.length > 0 ? { warnings: evaluation.warnings } : {}),
    };
  } catch (error) {
    if (isSchemaMissingError(error)) {
      return { status: 'storage_error', reason: 'migration_pending' };
    }
    return { status: 'storage_error', reason: 'db_error' };
  }
}

export async function listTemplatesByState(
  orgId: string,
  state: TemplateLifecycleState
): Promise<
  Array<{
    id: string;
    name: string;
    lifecycle_state: string;
    lineage_version: number;
    lineage_root_id: string | null;
    updated_at: string;
  }>
> {
  if (!isValidState(state)) return [];
  const safeOrg = String(orgId || '').trim();
  if (!safeOrg) return [];
  try {
    const rows = (await dbAll(
      `SELECT id, name, lifecycle_state, lineage_version, lineage_root_id, updated_at
         FROM ${TABLE_TEMPLATES}
        WHERE (organization_id IS NULL OR organization_id = ?)
          AND lifecycle_state = ?
          AND is_active = TRUE
        ORDER BY updated_at DESC`,
      [safeOrg, state]
    )) as any[];
    return (rows || []).map((row) => ({
      id: String(row.id),
      name: String(row.name || ''),
      lifecycle_state: String(row.lifecycle_state || 'draft'),
      lineage_version: Number(row.lineage_version || 1),
      lineage_root_id: row.lineage_root_id ? String(row.lineage_root_id) : null,
      updated_at: row.updated_at ? String(row.updated_at) : new Date(0).toISOString(),
    }));
  } catch {
    return [];
  }
}

export interface DeprecateTemplateResult {
  status: 'ok' | 'blocked' | 'not_found' | 'storage_error';
  reason?: string;
  record?: TemplateGovernanceRecord;
}

export async function deprecateTemplate(input: {
  templateId: string;
  organizationId: string;
  actor: { id: string; role: string };
  reason: string;
}): Promise<DeprecateTemplateResult> {
  const safeReason = String(input?.reason || '').trim();
  if (!safeReason) {
    return { status: 'blocked', reason: 'Deprecation reason is required.' };
  }
  const result = await applyLifecycleTransition({
    templateId: input.templateId,
    organizationId: input.organizationId,
    targetState: 'deprecated',
    actor: input.actor,
    reason: safeReason,
  });
  return {
    status: result.status,
    ...(result.reason ? { reason: result.reason } : {}),
    ...(result.record ? { record: result.record } : {}),
  };
}

// ---------------------------------------------------------------------------
// Lineage chain reader (root -> ... -> current)
// ---------------------------------------------------------------------------

export async function fetchLineageChain(
  orgId: string,
  templateId: string
): Promise<{
  status: 'ok' | 'not_found' | 'storage_error';
  chain: Array<{
    id: string;
    name: string;
    lifecycle_state: TemplateLifecycleState;
    lineage_version: number;
    lineage_parent_id: string | null;
  }>;
  reason?: string;
}> {
  const safeOrg = String(orgId || '').trim();
  const safeTemplate = String(templateId || '').trim();
  if (!safeOrg || !safeTemplate) {
    return { status: 'not_found', chain: [], reason: 'invalid_input' };
  }

  const lookup = await getTemplateGovernanceRow(safeTemplate, safeOrg);
  if (lookup.storageStatus === 'storage_error') {
    return { status: 'storage_error', chain: [], reason: lookup.reason || 'db_error' };
  }
  if (!lookup.row) {
    return { status: 'not_found', chain: [], reason: 'template_not_found' };
  }

  const rootId = lookup.row.lineage_root_id
    ? String(lookup.row.lineage_root_id)
    : String(lookup.row.id);

  try {
    const rows = (await dbAll(
      `SELECT id, name, lifecycle_state, lineage_version, lineage_parent_id
         FROM ${TABLE_TEMPLATES}
        WHERE (organization_id IS NULL OR organization_id = ?)
          AND (id = ? OR lineage_root_id = ?)
        ORDER BY lineage_version ASC`,
      [safeOrg, rootId, rootId]
    )) as any[];

    const chain = (rows || []).map((row) => ({
      id: String(row.id),
      name: String(row.name || ''),
      lifecycle_state: (isValidState(row.lifecycle_state)
        ? row.lifecycle_state
        : 'draft') as TemplateLifecycleState,
      lineage_version: Number(row.lineage_version || 1),
      lineage_parent_id: row.lineage_parent_id ? String(row.lineage_parent_id) : null,
    }));

    return { status: 'ok', chain };
  } catch (error) {
    if (isSchemaMissingError(error)) {
      return { status: 'storage_error', chain: [], reason: 'migration_pending' };
    }
    return { status: 'storage_error', chain: [], reason: 'db_error' };
  }
}

// ---------------------------------------------------------------------------
// Edit guard for /templates/:id PUT route
// ---------------------------------------------------------------------------

/**
 * Returns `{ allowed: false }` when the template's lifecycle state
 * forbids in-place edits (anything other than `draft`). The caller
 * (PUT route) returns 409 with the `reason` payload in that case.
 *
 * Schema-tolerant: if `lifecycle_state` is missing we default to
 * `draft` so pre-migration installs keep working.
 */
export function assertEditableLifecycle(template: any): {
  allowed: boolean;
  state: TemplateLifecycleState;
  reason?: string;
} {
  const raw = template?.lifecycle_state;
  const state: TemplateLifecycleState = isValidState(raw) ? raw : 'draft';
  if (state === 'draft') {
    return { allowed: true, state };
  }
  return {
    allowed: false,
    state,
    reason: `Template is ${state}; clone it to a new draft before editing.`,
  };
}
