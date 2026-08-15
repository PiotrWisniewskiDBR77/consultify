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

import { decodeHtmlEntities } from '../../utils/htmlEntities.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { CreateInitiativeSchema } from '../../validators/initiative.validators.js';
import auditEventsService from '../AuditEventsService.js';
import { assertCardMeetsFormula } from '../cardContentFormulaValidator.js';
import {
  isRequireInitiativeProjectEnabled,
  resolveOrCreateSystemPortfolioProject,
} from '../initiativeProjectPolicyService.js';
import { type InitiativeCardData, validateCardStructure } from './initiativeCardValidators.js';

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
  /** Durable idempotency link for candidate promotion. */
  sourceCandidateId?: string | null;
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
  /**
   * F3.2 — when true, surface §B3 structural quality failures as `qualityWarnings`
   * on the result. ADVISORY only: never blocks or throws regardless of value.
   * Structural validation is logged either way (default false).
   */
  enforceQuality?: boolean;
  actor?: { id?: string | null; ip?: string | null; userAgent?: string | null };
  /**
   * Zwornik Delta C anchoring escape hatch: when true, skip the system-portfolio
   * auto-anchor even if REQUIRE_INITIATIVE_PROJECT is ON and no projectId was
   * supplied. Default false — every caller goes through the same gate. Reserved
   * for call sites that intentionally manage org-level (project-less)
   * initiatives outside the PM backbone (none today; kept for forward
   * compatibility instead of a silent bypass).
   */
  allowMissingProject?: boolean;
  /** Pinned transaction writer for atomic cross-domain handoffs. */
  db?: Pick<typeof queryHelpers, 'queryRun'>;
}

export interface CreateInitiativeResult {
  id: string;
  name: string;
  title: string;
  status: string;
  sourceType: string;
  sourceId: string | null;
  /**
   * Zwornik Delta C — the project the initiative was anchored to (echoes
   * `data.projectId` when supplied, or the auto-resolved system "Portfel"
   * project id, or null when anchoring is disabled/degraded).
   */
  projectId: string | null;
  /** F3.2/F3.9 — advisory quality warnings, present only when enforceQuality:true and issues found. */
  qualityWarnings?: string[];
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
  const writeDb = options.db ?? queryHelpers;

  // F15 (data-integrity, continuation of Z139): decode HTML entities the global
  // input-sanitization middleware escaped on this field before storing. This is
  // THE single canonical creation funnel (F1.1 — replaces ~23 formerly scattered
  // INSERTs), so fixing title here covers initiatives.name/title across nearly
  // every creation path (wizard, Teresa handoff, candidate accept, report/
  // assessment import, onboarding, …) in one place.
  const title = decodeHtmlEntities((data.title || data.name || '').toString().trim());
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

  // Zwornik Delta C anchoring (§5.2, D-J: every initiative MUST have a project).
  // This is the ONE choke point every creator funnels through (wizard via
  // InitiativeController, Teresa handoff, candidate accept, report/assessment
  // import, onboarding, …) — so anchoring here is the "same gate as the
  // wizard" the F2→F1 candidate path was previously bypassing (0× project_id,
  // confirmed by audit). The interactive wizard already hard-blocks a missing
  // projectId one layer up (InitiativeController.createInitiative); background
  // callers reaching this point without one are auto-anchored to the org's
  // system "Portfel — inicjatywy bezpośrednie" container instead of persisting
  // project_id=NULL, so no NEW orphans are created from this point forward.
  // Fail-soft: if the org lookup/lazy-create itself fails, we degrade to NULL
  // (pre-zwornik behaviour) rather than blocking the initiative's creation.
  let projectId: string | null = data.projectId ?? null;
  if (!projectId && isRequireInitiativeProjectEnabled() && options.allowMissingProject !== true) {
    projectId = await resolveOrCreateSystemPortfolioProject(orgId, {
      createdBy: options.actor?.id ?? null,
    });
  }

  // ── O7.1 TWARDA BRAMA (przed zapisem) ──────────────────────────────────────
  // Decyzja Piotra: karta poniżej progu formuły NIE powstaje. Egzekwujemy TYLKO
  // wąską listę naruszeń blokujących (CARD_GATE_BLOCKING_CODES: brak tytułu /
  // placeholder-filler) — reguły KOMPLETNOŚCI (kpi/raid/scope/milestones) i
  // heurystyki (hypothesis_format, lang_pl) pozostają DORADCZE poniżej, więc
  // rzadka karta quick-create NIGDY nie jest tu blokowana. Gdy walidator sam
  // rzuci wyjątek (bug) → assertCardMeetsFormula łyka go i PRZEPUSZCZA kartę
  // (fail-open), a intencjonalny CardContentGateError(422) propaguje do wołającego
  // (kontroler mapuje na HTTP 422 przez statusCode). Zawór: CARD_CONTENT_HARD_GATE.
  assertCardMeetsFormula(
    'initiative',
    {
      title,
      problem_statement: data.problemStatement ?? undefined,
      hypothesis: data.hypothesis ?? undefined,
      summary: data.summary ?? undefined,
      description: data.description ?? undefined,
      business_value: data.businessValue ?? undefined,
    },
    {
      onValidatorError: (err) =>
        logger.warn(
          `[createInitiativeService] hard-gate walidator rzucił wyjątek — FAIL-OPEN, karta przechodzi: ${
            (err as Error)?.message || err
          }`
        ),
    }
  );

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
      source_type, source_id, source_candidate_id, action_contract_json, source_pack_json, evidence_refs_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const newParams = [
    id,
    orgId,
    projectId,
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
    data.sourceCandidateId ?? null,
    JSON.stringify(
      data.actionContract && typeof data.actionContract === 'object' ? data.actionContract : {}
    ),
    JSON.stringify(data.sourcePack && typeof data.sourcePack === 'object' ? data.sourcePack : {}),
    JSON.stringify(Array.isArray(data.evidenceRefs) ? data.evidenceRefs : []),
    now,
    now,
  ];

  try {
    await writeDb.queryRun(newSql, newParams);
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
        source_type, source_id, source_candidate_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await writeDb.queryRun(legacySql, [
      id,
      orgId,
      projectId,
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
      data.sourceCandidateId ?? null,
      now,
      now,
    ]);
  }

  // F1.13 — guarantee the `title` alias mirrors the canonical `name`, even when the
  // modern insert fell back to the legacy column set (which writes only `name`).
  // No-op on envs where the `title` column does not exist.
  try {
    await writeDb.queryRun(
      `UPDATE initiatives SET title = ? WHERE id = ? AND organization_id = ? AND (title IS NULL OR title = '')`,
      [title, id, orgId]
    );
  } catch {
    /* title column may be absent on legacy schemas */
  }

  // Ownership: neither insert variant writes `created_by` (column set differs per
  // schema generation), yet delete/edit permission checks treat the creator as
  // owner. Best-effort post-create UPDATE mirrors the title-alias pattern above.
  if (options.actor?.id) {
    try {
      await writeDb.queryRun(
        `UPDATE initiatives SET created_by = ? WHERE id = ? AND organization_id = ? AND created_by IS NULL`,
        [String(options.actor.id), id, orgId]
      );
    } catch {
      /* created_by column may be absent on legacy schemas */
    }
  }

  if (options.emitAudit !== false) {
    try {
      await auditEventsService.log({
        actorId: options.actor?.id ?? undefined,
        actorType: 'USER',
        action: 'initiative.created',
        resourceType: 'initiative',
        resourceId: id,
        after: { id, title, projectId, status, sourceType, sourceId: sourceId || null },
        organizationId: orgId,
        ip: options.actor?.ip ?? undefined,
        userAgent: options.actor?.userAgent ?? undefined,
      });
    } catch {
      /* best-effort audit */
    }
  }

  // ── F3.2 / F3.9 — advisory quality pass (NEVER blocks creation) ────────────
  // The initiative is already persisted + audited above; everything below only
  // surfaces/logs quality signals. Any failure here is swallowed so a bad
  // validator can never take down the canonical funnel.
  const qualityWarnings: string[] = [];
  try {
    // F3.2 — map input onto the loosely-typed §B3 card and run structural validators.
    const card: InitiativeCardData = {
      kpis: data.kpis,
      kpi: data.kpi,
      key_risks: data.keyRisks,
      raid: data.raid,
      raid_log: data.raidLog,
      scope_in: data.scopeIn,
      scope_out: data.scopeOut,
      deliverables: data.deliverables,
      success_criteria: data.successCriteria,
      kill_criteria: data.killCriteria,
      milestones: data.milestones,
      cost_capex: data.costCapex,
      cost_opex: data.costOpex,
      expected_roi: data.expectedRoi,
      owner_business_id: data.ownerBusinessId,
    };

    const results = validateCardStructure(card);
    const failed = results.filter((r) => !r.pass);
    if (failed.length > 0) {
      const failedIds = failed.map((r) => r.id);
      logger.info(
        `[createInitiativeService] §B3 quality (advisory) — initiative ${id}: ${failed.length}/${results.length} failed [${failedIds.join(', ')}]`
      );
      for (const r of failed) qualityWarnings.push(`${r.id}: ${r.reason}`);
    } else {
      logger.info(
        `[createInitiativeService] §B3 quality (advisory) — initiative ${id}: all passed`
      );
    }

    // F3.9 — anti-crash material_quality shape check (InsightViewer guard).
    // Tolerant: absent field = OK. Partial object (missing score/posture/coverage) = warn.
    const mq = data.materialQuality ?? data.material_quality;
    if (mq != null && typeof mq === 'object' && !Array.isArray(mq)) {
      const o = mq as Record<string, unknown>;
      const missing = ['score', 'posture', 'coverage'].filter((k) => o[k] == null);
      if (missing.length > 0 && missing.length < 3) {
        const msg = `material_quality: niekompletny obiekt (brak: ${missing.join(', ')}) — może spowodować awarię InsightViewer.`;
        qualityWarnings.push(msg);
        logger.warn(`[createInitiativeService] ${msg} (initiative ${id})`);
      }
    }
  } catch (error) {
    logger.warn(
      `[createInitiativeService] advisory quality pass failed (ignored): ${
        (error as Error)?.message || error
      }`
    );
  }

  const result: CreateInitiativeResult = {
    id,
    name: title,
    title,
    status,
    sourceType,
    sourceId: sourceId || null,
    projectId,
  };
  // USPOJNIENIE C3 — ostrzeżenia §B3 są ZAWSZE zwracane (advisory, widoczny
  // sygnał jakości dla wołającego), ale NIGDY nie blokują tworzenia. Wcześniej
  // wracały tylko przy options.enforceQuality → jakość była mierzona, lecz
  // niewidoczna. Decyzja: sygnalizuj zawsze, egzekwowanie (twarda blokada)
  // pozostaje osobną, opcjonalną bramką po stronie wołającego.
  if (qualityWarnings.length > 0) {
    result.qualityWarnings = qualityWarnings;
  }
  return result;
}

export default { createInitiative };
