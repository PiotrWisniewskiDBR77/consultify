/**
 * Uspójnienie F1.1 — kanoniczny lejek tworzenia inicjatyw (single creation funnel).
 *
 * JEDNO miejsce, przez które powstaje każda inicjatywa. Zastępuje ~23 rozproszone
 * `INSERT INTO initiatives` (audyt 2026-06-24). Gwarantuje jeden kontrakt:
 *   - walidacja `CreateInitiativeSchema` (lineage: sourceType≠manual ⇒ sourceId),
 *   - status startowy znormalizowany do DRAFT (F1.11) — chyba że jawnie podano,
 *   - zapis `name` ORAZ `title` (F1.13) — koniec rozjazdu name/title,
 *   - audit `initiative.created` (best-effort),
 *   - try-new-schema → fallback-legacy (zgodnie z istniejącym InitiativeController).
 *
 * Hooki na przyszłe fale: walidatory §B3 (F3) i event handoffu (F2) wpinamy tutaj,
 * raz, zamiast w każdej ścieżce z osobna.
 */
import { v4 as uuidv4 } from 'uuid';

import auditEventsService from '../AuditEventsService.js';
import { CreateInitiativeSchema } from '../../validators/initiative.validators.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

export interface CreateInitiativeInput {
  title?: string;
  /** legacy alias — accepted, normalized to title */
  name?: string;
  projectId?: string | null;
  programId?: string | null;
  category?: string | null;
  priority?: string | null;
  impact?: string | null;
  effort?: string | null;
  axis?: string | null;
  area?: string | null;
  summary?: string | null;
  hypothesis?: string | null;
  description?: string | null;
  status?: string | null;
  businessValue?: number | null;
  costCapex?: number | null;
  costOpex?: number | null;
  expectedRoi?: number | null;
  valueDriver?: string | null;
  confidenceLevel?: string | null;
  valueTiming?: string | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  ownerBusinessId?: string | null;
  ownerExecutionId?: string | null;
  problemStatement?: string | null;
  deliverables?: string[];
  successCriteria?: string[];
  scopeIn?: string[];
  scopeOut?: string[];
  keyRisks?: unknown[];
  sourceType?: string | null;
  sourceId?: string | null;
  actionContract?: Record<string, unknown> | null;
  sourcePack?: Record<string, unknown> | null;
  evidenceRefs?: string[];
  [key: string]: unknown;
}

export interface CreateInitiativeOptions {
  /** Validate input through CreateInitiativeSchema (default true). The single guard. */
  validate?: boolean;
  /** Emit `initiative.created` audit event (default true). */
  emitAudit?: boolean;
  actor?: { id?: string | null; ip?: string | null; userAgent?: string | null };
}

export interface CreateInitiativeResult {
  id: string;
  name: string;
  title: string;
  status: string;
  sourceType: string;
  sourceId: string | null;
}

/**
 * Create one initiative through the canonical funnel. Throws on validation/lineage
 * failure (callers map to HTTP). Org-scoped — `orgId` is mandatory.
 */
export async function createInitiative(
  orgId: string,
  rawInput: CreateInitiativeInput,
  options: CreateInitiativeOptions = {}
): Promise<CreateInitiativeResult> {
  if (!orgId) throw new Error('organizationId is required to create an initiative');

  const validate = options.validate !== false;
  // Accept the legacy `name` alias by promoting it to `title` before validation.
  const preInput: CreateInitiativeInput = { ...rawInput };
  if (!preInput.title && typeof preInput.name === 'string') preInput.title = preInput.name;

  // Single validation gate. CreateInitiativeSchema already defaults status→DRAFT and
  // enforces the lineage refine (sourceType≠manual ⇒ sourceId).
  const data: CreateInitiativeInput = validate
    ? (CreateInitiativeSchema.parse(preInput) as CreateInitiativeInput)
    : preInput;

  const title = (data.title || data.name || '').toString().trim();
  if (!title) {
    const err = new Error('Title is required');
    (err as { statusCode?: number }).statusCode = 400;
    throw err;
  }

  // Lineage guard (defence-in-depth even when validate=false).
  const sourceType = String(data.sourceType || 'manual')
    .trim()
    .toLowerCase();
  const sourceId = data.sourceId != null ? String(data.sourceId).trim() : '';
  if (sourceType !== 'manual' && !sourceId) {
    const err = new Error('sourceId is required when sourceType is not manual');
    (err as { statusCode?: number }).statusCode = 400;
    throw err;
  }

  // F1.11 — funnel normalizes the initial status to DRAFT unless one is explicit.
  const status = data.status && String(data.status).trim() ? String(data.status).trim() : 'DRAFT';

  const id = uuidv4();
  const now = new Date().toISOString();

  // Try the modern schema (writes BOTH title AND name — F1.13). Falls back to the
  // legacy column set on schema drift, mirroring InitiativeController.createInitiative.
  const newSql = `
    INSERT INTO initiatives (
      id, organization_id, project_id, program_id, name, title, category, priority, impact, effort,
      axis, area, summary, hypothesis, status,
      business_value, cost_capex, cost_opex, expected_roi,
      value_driver, confidence_level, value_timing,
      planned_start_date, planned_end_date,
      owner_business_id, owner_execution_id,
      problem_statement, deliverables, success_criteria, scope_in, scope_out, key_risks,
      source_type, source_id, action_contract_json, source_pack_json, evidence_refs_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const newParams = [
    id,
    orgId,
    data.projectId ?? null,
    data.programId ?? null,
    title,
    title,
    data.category ?? null,
    data.priority ?? 'medium',
    data.impact ?? 'medium',
    data.effort ?? 'medium',
    data.axis ?? null,
    data.area ?? null,
    data.summary ?? null,
    data.hypothesis ?? data.description ?? null,
    status,
    data.businessValue ?? null,
    data.costCapex ?? null,
    data.costOpex ?? null,
    data.expectedRoi ?? null,
    data.valueDriver ?? null,
    data.confidenceLevel ?? null,
    data.valueTiming ?? null,
    data.plannedStartDate ?? null,
    data.plannedEndDate ?? null,
    data.ownerBusinessId ?? null,
    data.ownerExecutionId ?? null,
    data.problemStatement ?? null,
    JSON.stringify(data.deliverables || []),
    JSON.stringify(data.successCriteria || []),
    JSON.stringify(data.scopeIn || []),
    JSON.stringify(data.scopeOut || []),
    JSON.stringify(data.keyRisks || []),
    sourceType,
    sourceId || null,
    JSON.stringify(
      data.actionContract && typeof data.actionContract === 'object' ? data.actionContract : {}
    ),
    JSON.stringify(data.sourcePack && typeof data.sourcePack === 'object' ? data.sourcePack : {}),
    JSON.stringify(Array.isArray(data.evidenceRefs) ? data.evidenceRefs : []),
    now,
    now,
  ];

  try {
    await queryHelpers.queryRun(newSql, newParams);
  } catch (error) {
    logger.warn(
      `[createInitiativeService] modern insert failed, falling back to legacy schema: ${
        (error as Error)?.message || error
      }`
    );
    const legacySql = `
      INSERT INTO initiatives (
        id, organization_id, project_id, name, axis, area, summary, hypothesis, status,
        business_value, cost_capex, cost_opex, expected_roi,
        start_date, end_date,
        owner_business_id, owner_execution_id,
        problem_statement, deliverables, success_criteria, scope_in, scope_out, key_risks,
        source_type, source_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await queryHelpers.queryRun(legacySql, [
      id,
      orgId,
      data.projectId ?? null,
      title,
      data.axis ?? null,
      data.area ?? null,
      data.summary ?? null,
      data.hypothesis ?? data.description ?? null,
      status,
      data.businessValue ?? null,
      data.costCapex ?? null,
      data.costOpex ?? null,
      data.expectedRoi ?? null,
      data.plannedStartDate ?? null,
      data.plannedEndDate ?? null,
      data.ownerBusinessId ?? null,
      data.ownerExecutionId ?? null,
      data.problemStatement ?? null,
      JSON.stringify(data.deliverables || []),
      JSON.stringify(data.successCriteria || []),
      JSON.stringify(data.scopeIn || []),
      JSON.stringify(data.scopeOut || []),
      JSON.stringify(data.keyRisks || []),
      sourceType,
      sourceId || null,
      now,
      now,
    ]);
  }

  // F1.13 — guarantee the `title` alias mirrors the canonical `name`, even when the
  // modern insert fell back to the legacy column set (which writes only `name`).
  // No-op on envs where the `title` column does not exist.
  try {
    await queryHelpers.queryRun(
      `UPDATE initiatives SET title = ? WHERE id = ? AND organization_id = ? AND (title IS NULL OR title = '')`,
      [title, id, orgId]
    );
  } catch {
    /* title column may be absent on legacy schemas */
  }

  if (options.emitAudit !== false) {
    try {
      await auditEventsService.log({
        actorId: options.actor?.id ?? undefined,
        actorType: 'USER',
        action: 'initiative.created',
        resourceType: 'initiative',
        resourceId: id,
        after: { id, title, projectId: data.projectId ?? null, status, sourceType, sourceId: sourceId || null },
        organizationId: orgId,
        ip: options.actor?.ip ?? undefined,
        userAgent: options.actor?.userAgent ?? undefined,
      });
    } catch {
      /* best-effort audit */
    }
  }

  return { id, name: title, title, status, sourceType, sourceId: sourceId || null };
}

export default { createInitiative };
