/**
 * findingService — U4 — ustalenia audytowe i odpowiedzi właściciela obszaru.
 *
 * Tabele: `audit_program_findings`, `audit_management_responses`.
 *
 * DWIE TWARDE REGUŁY (MOD-AGR-04): ustalenie oznaczające niezgodność musi
 * wskazywać KONKRETNE kryterium i KONKRETNY dowód obiektywny — inaczej to
 * opinia, nie ustalenie audytowe. I odwrotnie: sam brak dowodu nie może
 * automatycznie „stać się" niezgodnością — brak dowodu to `evidence_insufficient`
 * (albo najwyżej `observation`), nigdy `nonconforming` z automatu.
 *
 * Zamknięcie ustalenia jest bramkowane obecnością WERYFIKACJI SKUTECZNOŚCI
 * (nie deklaracją wykonawcy, nie samym statusem zadania) — patrz `closeFinding`.
 */

import {
  listActions as listCorrectiveActions,
  type AuditCorrectiveActionListResult,
} from './correctiveActionService.js';
import {
  AuditNotFoundError,
  AuditStateError,
  auditAll,
  auditGet,
  auditRun,
  newId,
  parseJson,
  recordAuditEvent,
  toBool,
  toIso,
  toNum,
} from './auditsDb.js';
import {
  assertCanAcceptResidualRisk,
  assertNotClosingOwnFinding,
  assertNotReviewingOwnFinding,
  requireCapability,
  resolveProgramAccess,
} from './permissions.js';
import type {
  AuditActor,
  AuditCorrectiveAction,
  AuditFinding,
  AuditManagementResponse,
  AuditVerification,
  FindingSeverity,
  FindingStatus,
  FindingTaxonomyEntry,
  PackDecisionRules,
  ResponsePosition,
} from './types.js';
import { RESPONSE_POSITIONS } from './types.js';
import { listVerifications } from './verificationService.js';

// ---------------------------------------------------------------------------
// Odwzorowanie wierszy
// ---------------------------------------------------------------------------

interface FindingRow {
  id: string;
  program_id: string;
  organization_id: string;
  criterion_id: string | null;
  reference_code: string | null;
  statement: string;
  requirement_text: string | null;
  condition_text: string | null;
  source_reference: string | null;
  gap_text: string | null;
  objective_evidence: unknown;
  contradicting_evidence: unknown;
  classification: string;
  severity: string | null;
  risk_text: string | null;
  impact_text: string | null;
  recommendation: string | null;
  root_cause: string | null;
  root_cause_method: string | null;
  root_cause_confirmed: unknown;
  status: string;
  owner_user_id: string | null;
  author_id: string | null;
  reviewed_by: string | null;
  reviewed_at: unknown;
  review_note: string | null;
  sent_back_at: unknown;
  sent_back_by: string | null;
  send_back_reason: string | null;
  ai_proposed: unknown;
  ai_rationale: string | null;
  ai_confidence: unknown;
  residual_risk: string | null;
  residual_risk_accepted_by: string | null;
  residual_risk_accepted_at: unknown;
  residual_risk_note: string | null;
  recurring_from_finding_id: string | null;
  closed_at: unknown;
  closed_by: string | null;
  closure_decision: string | null;
  closure_note: string | null;
  created_at: unknown;
  updated_at: unknown;
}

function rowToFinding(row: FindingRow): AuditFinding {
  return {
    id: row.id,
    programId: row.program_id,
    organizationId: row.organization_id,
    criterionId: row.criterion_id,
    referenceCode: row.reference_code,
    statement: row.statement,
    requirementText: row.requirement_text,
    conditionText: row.condition_text,
    sourceReference: row.source_reference,
    gapText: row.gap_text,
    objectiveEvidence: parseJson<string[]>(row.objective_evidence, []),
    contradictingEvidence: parseJson<string[]>(row.contradicting_evidence, []),
    classification: row.classification,
    severity: (row.severity as FindingSeverity) ?? null,
    riskText: row.risk_text,
    impactText: row.impact_text,
    recommendation: row.recommendation,
    rootCause: row.root_cause,
    rootCauseMethod: row.root_cause_method,
    rootCauseConfirmed: toBool(row.root_cause_confirmed),
    status: row.status as FindingStatus,
    ownerUserId: row.owner_user_id,
    authorId: row.author_id,
    reviewedBy: row.reviewed_by,
    reviewedAt: toIso(row.reviewed_at),
    reviewNote: row.review_note,
    sentBackAt: toIso(row.sent_back_at),
    sentBackBy: row.sent_back_by,
    sendBackReason: row.send_back_reason,
    aiProposed: toBool(row.ai_proposed),
    aiRationale: row.ai_rationale,
    aiConfidence: toNum(row.ai_confidence),
    residualRisk: row.residual_risk,
    residualRiskAcceptedBy: row.residual_risk_accepted_by,
    residualRiskAcceptedAt: toIso(row.residual_risk_accepted_at),
    residualRiskNote: row.residual_risk_note,
    recurringFromFindingId: row.recurring_from_finding_id,
    closedAt: toIso(row.closed_at),
    closedBy: row.closed_by,
    closureDecision: row.closure_decision as AuditFinding['closureDecision'],
    closureNote: row.closure_note,
    createdAt: toIso(row.created_at) as string,
    updatedAt: toIso(row.updated_at) as string,
  };
}

interface ManagementResponseRow {
  id: string;
  finding_id: string;
  program_id: string;
  organization_id: string;
  position: string;
  statement: string;
  responded_by: string | null;
  responded_at: unknown;
  status: string;
  reviewed_by: string | null;
  reviewed_at: unknown;
  review_note: string | null;
  created_at: unknown;
  updated_at: unknown;
}

function rowToManagementResponse(row: ManagementResponseRow): AuditManagementResponse {
  return {
    id: row.id,
    findingId: row.finding_id,
    programId: row.program_id,
    organizationId: row.organization_id,
    position: row.position as ResponsePosition,
    statement: row.statement,
    respondedBy: row.responded_by,
    respondedAt: toIso(row.responded_at) as string,
    status: row.status as AuditManagementResponse['status'],
    reviewedBy: row.reviewed_by,
    reviewedAt: toIso(row.reviewed_at),
    reviewNote: row.review_note,
    createdAt: toIso(row.created_at) as string,
    updatedAt: toIso(row.updated_at) as string,
  };
}

async function loadFindingRow(organizationId: string, id: string): Promise<FindingRow> {
  const row = await auditGet<FindingRow>(
    `SELECT * FROM audit_program_findings WHERE organization_id = $1 AND id = $2`,
    [organizationId, id],
  );
  if (!row) throw new AuditNotFoundError('Ustalenie');
  return row;
}

async function fetchFinding(organizationId: string, id: string): Promise<AuditFinding> {
  return rowToFinding(await loadFindingRow(organizationId, id));
}

function scoped(actor: AuditActor, organizationId: string): AuditActor {
  return { ...actor, organizationId };
}

// ---------------------------------------------------------------------------
// Pakiet programu — taksonomia i reguły decyzyjne
// ---------------------------------------------------------------------------

interface ProgramPackInfo {
  decisionRules: PackDecisionRules;
  findingTaxonomy: FindingTaxonomyEntry[];
}

async function loadProgramPack(organizationId: string, programId: string): Promise<ProgramPackInfo> {
  const row = await auditGet<{ decision_rules: unknown; finding_taxonomy: unknown }>(
    `SELECT pk.decision_rules AS decision_rules, pk.finding_taxonomy AS finding_taxonomy
       FROM audit_programs prog
       JOIN audit_packs pk ON pk.id = prog.pack_id
      WHERE prog.organization_id = $1 AND prog.id = $2`,
    [organizationId, programId],
  );
  if (!row) return { decisionRules: {}, findingTaxonomy: [] };
  return {
    decisionRules: parseJson<PackDecisionRules>(row.decision_rules, {}),
    findingTaxonomy: parseJson<FindingTaxonomyEntry[]>(row.finding_taxonomy, []),
  };
}

/**
 * Klasyfikacje, które z definicji NIE oznaczają niezgodności — niezależnie od
 * tego, czy pakiet zdefiniował dla nich wpis w taksonomii.
 */
const NEVER_NONCONFORMING = new Set([
  'observation',
  'opportunity_for_improvement',
  'evidence_insufficient',
  'conforming',
  'not_applicable',
]);

/**
 * Czy klasyfikacja oznacza niezgodność. Kernel nie narzuca jednej listy
 * (`AuditFinding.classification` jest kluczem z taksonomii pakietu), więc
 * najpierw sprawdzamy wpis pakietu; przy jego braku domyślnie tylko dosłowne
 * `nonconforming` (wartość domyślna kolumny) jest traktowane jako niezgodność.
 */
export async function isNonconformingClassification(
  organizationId: string,
  programId: string,
  classification: string,
): Promise<boolean> {
  if (NEVER_NONCONFORMING.has(classification)) return false;
  const { findingTaxonomy } = await loadProgramPack(organizationId, programId);
  const entry = findingTaxonomy.find((t) => t.key === classification);
  if (entry) return entry.nonConforming === true;
  return classification === 'nonconforming';
}

// ---------------------------------------------------------------------------
// Numeracja
// ---------------------------------------------------------------------------

async function nextReferenceCode(organizationId: string, programId: string): Promise<string> {
  const row = await auditGet<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM audit_program_findings WHERE organization_id = $1 AND program_id = $2`,
    [organizationId, programId],
  );
  const n = row ? Number(row.c) || 0 : 0;
  return `F-${n + 1}`;
}

// ---------------------------------------------------------------------------
// A. createFinding
// ---------------------------------------------------------------------------

export interface CreateFindingInput {
  programId: string;
  criterionId?: string | null;
  statement: string;
  requirementText?: string | null;
  conditionText?: string | null;
  sourceReference?: string | null;
  gapText?: string | null;
  classification?: string;
  severity?: FindingSeverity | null;
  riskText?: string | null;
  impactText?: string | null;
  recommendation?: string | null;
  objectiveEvidence?: string[];
  contradictingEvidence?: string[];
  ownerUserId?: string | null;
  aiProposed?: boolean;
  aiRationale?: string | null;
  aiConfidence?: number | null;
}

export async function createFinding(
  organizationId: string,
  actor: AuditActor,
  input: CreateFindingInput,
): Promise<AuditFinding> {
  const act = scoped(actor, organizationId);
  const programId = String(input.programId || '');
  if (!programId) throw new AuditStateError('Ustalenie wymaga wskazania programu (programId)');
  await requireCapability(act, programId, 'finding.draft');

  const statement = String(input.statement || '').trim();
  if (!statement) throw new AuditStateError('Ustalenie wymaga treści (statement)');

  const classification = String(input.classification || 'nonconforming').trim();
  const objectiveEvidence = Array.isArray(input.objectiveEvidence)
    ? input.objectiveEvidence.filter((v) => typeof v === 'string' && v.trim())
    : [];
  const contradictingEvidence = Array.isArray(input.contradictingEvidence)
    ? input.contradictingEvidence.filter((v) => typeof v === 'string' && v.trim())
    : [];
  const criterionId = input.criterionId || null;
  const hasEvidence = objectiveEvidence.length > 0;

  // DRUGA TWARDA REGUŁA: brak dowodu → wyłącznie evidence_insufficient/observation.
  if (!hasEvidence && classification !== 'evidence_insufficient' && classification !== 'observation') {
    throw new AuditStateError(
      'Brak dowodu obiektywnego dopuszcza wyłącznie klasyfikację "evidence_insufficient" lub "observation" ' +
        '— sam brak dowodu nie może automatycznie dawać klasyfikacji niezgodności',
    );
  }

  const isNonconforming = await isNonconformingClassification(organizationId, programId, classification);

  // PIERWSZA TWARDA REGUŁA: niezgodność (i evidence_insufficient) wymaga kryterium.
  if ((isNonconforming || classification === 'evidence_insufficient') && !criterionId) {
    throw new AuditStateError(
      'Ustalenie musi wskazywać wymaganie i dowód — brak wskazanego kryterium (criterionId)',
    );
  }
  if (isNonconforming && classification !== 'evidence_insufficient' && !hasEvidence) {
    throw new AuditStateError(
      'Ustalenie musi wskazywać wymaganie i dowód — brak dowodu obiektywnego (objectiveEvidence)',
    );
  }

  const id = newId('apf');
  const referenceCode = await nextReferenceCode(organizationId, programId);

  await auditRun(
    `INSERT INTO audit_program_findings
       (id, program_id, organization_id, criterion_id, reference_code, statement,
        requirement_text, condition_text, source_reference, gap_text,
        objective_evidence, contradicting_evidence, classification, severity,
        risk_text, impact_text, recommendation, status, owner_user_id, author_id,
        ai_proposed, ai_rationale, ai_confidence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'draft',$18,$19,$20,$21,$22)`,
    [
      id,
      programId,
      organizationId,
      criterionId,
      referenceCode,
      statement,
      input.requirementText ?? null,
      input.conditionText ?? null,
      input.sourceReference ?? null,
      input.gapText ?? null,
      JSON.stringify(objectiveEvidence),
      JSON.stringify(contradictingEvidence),
      classification,
      input.severity ?? null,
      input.riskText ?? null,
      input.impactText ?? null,
      input.recommendation ?? null,
      input.ownerUserId ?? null,
      actor.userId,
      input.aiProposed ? true : false,
      input.aiRationale ?? null,
      input.aiConfidence ?? null,
    ],
  );

  await recordAuditEvent({
    organizationId,
    programId,
    entityType: 'finding',
    entityId: id,
    eventType: 'finding.created',
    actorId: actor.userId,
    summary: `Utworzono ustalenie ${referenceCode} (${classification})`,
    payload: { classification, criterionId, hasEvidence },
  });

  return fetchFinding(organizationId, id);
}

// ---------------------------------------------------------------------------
// listFindings / getFinding
// ---------------------------------------------------------------------------

export interface ListFindingsFilter {
  programId: string;
  status?: string;
  classification?: string;
  severity?: string;
  ownerUserId?: string;
  criterionId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListFindingsResult {
  items: AuditFinding[];
  total: number;
}

export async function listFindings(
  organizationId: string,
  filter: ListFindingsFilter,
): Promise<ListFindingsResult> {
  const clauses = ['organization_id = $1', 'program_id = $2'];
  const params: unknown[] = [organizationId, filter.programId];

  const pushEq = (column: string, value: unknown) => {
    params.push(value);
    clauses.push(`${column} = $${params.length}`);
  };

  if (filter.status) pushEq('status', filter.status);
  if (filter.classification) pushEq('classification', filter.classification);
  if (filter.severity) pushEq('severity', filter.severity);
  if (filter.ownerUserId) pushEq('owner_user_id', filter.ownerUserId);
  if (filter.criterionId) pushEq('criterion_id', filter.criterionId);
  if (filter.search) {
    params.push(`%${filter.search.trim().toLowerCase()}%`);
    clauses.push(`LOWER(statement) LIKE $${params.length}`);
  }

  const where = clauses.join(' AND ');
  const limit = Math.min(Math.max(Number(filter.limit) || 50, 1), 200);
  const offset = Math.max(Number(filter.offset) || 0, 0);

  const rows = await auditAll<FindingRow>(
    `SELECT * FROM audit_program_findings WHERE ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  const countRow = await auditGet<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM audit_program_findings WHERE ${where}`,
    params,
  );

  return { items: rows.map(rowToFinding), total: countRow ? Number(countRow.c) : rows.length };
}

export interface FindingDetail extends AuditFinding {
  managementResponses: AuditManagementResponse[];
  correctiveActions: AuditCorrectiveAction[];
  verifications: AuditVerification[];
}

export async function getFinding(organizationId: string, id: string): Promise<FindingDetail> {
  const finding = await fetchFinding(organizationId, id);
  const [responses, actionsResult, verifications] = await Promise.all([
    auditAll<ManagementResponseRow>(
      `SELECT * FROM audit_management_responses
        WHERE organization_id = $1 AND finding_id = $2
        ORDER BY responded_at ASC`,
      [organizationId, id],
    ),
    listCorrectiveActions(organizationId, { findingId: id }) as Promise<AuditCorrectiveActionListResult>,
    listVerifications(organizationId, { findingId: id }),
  ]);

  return {
    ...finding,
    managementResponses: responses.map(rowToManagementResponse),
    correctiveActions: actionsResult.items,
    verifications,
  };
}

// ---------------------------------------------------------------------------
// updateFinding
// ---------------------------------------------------------------------------

export interface UpdateFindingInput {
  statement?: string;
  requirementText?: string | null;
  conditionText?: string | null;
  sourceReference?: string | null;
  gapText?: string | null;
  classification?: string;
  severity?: FindingSeverity | null;
  riskText?: string | null;
  impactText?: string | null;
  recommendation?: string | null;
  objectiveEvidence?: string[];
  contradictingEvidence?: string[];
  ownerUserId?: string | null;
  rootCause?: string | null;
  rootCauseMethod?: string | null;
  rootCauseConfirmed?: boolean;
}

export async function updateFinding(
  organizationId: string,
  actor: AuditActor,
  id: string,
  patch: UpdateFindingInput,
): Promise<AuditFinding> {
  const act = scoped(actor, organizationId);
  const row = await loadFindingRow(organizationId, id);
  await requireCapability(act, row.program_id, 'finding.update');

  const lockedForClassification = row.status === 'closed' || row.status === 'risk_accepted';
  if (lockedForClassification && (patch.classification !== undefined || patch.severity !== undefined)) {
    throw new AuditStateError(
      `Nie można zmienić klasyfikacji ani istotności ustalenia w statusie „${row.status}"`,
    );
  }

  const updates: Array<[string, unknown]> = [];
  if (patch.statement !== undefined) updates.push(['statement', String(patch.statement)]);
  if (patch.requirementText !== undefined) updates.push(['requirement_text', patch.requirementText]);
  if (patch.conditionText !== undefined) updates.push(['condition_text', patch.conditionText]);
  if (patch.sourceReference !== undefined) updates.push(['source_reference', patch.sourceReference]);
  if (patch.gapText !== undefined) updates.push(['gap_text', patch.gapText]);
  if (patch.classification !== undefined) updates.push(['classification', patch.classification]);
  if (patch.severity !== undefined) updates.push(['severity', patch.severity]);
  if (patch.riskText !== undefined) updates.push(['risk_text', patch.riskText]);
  if (patch.impactText !== undefined) updates.push(['impact_text', patch.impactText]);
  if (patch.recommendation !== undefined) updates.push(['recommendation', patch.recommendation]);
  if (patch.objectiveEvidence !== undefined) {
    updates.push(['objective_evidence', JSON.stringify(patch.objectiveEvidence)]);
  }
  if (patch.contradictingEvidence !== undefined) {
    updates.push(['contradicting_evidence', JSON.stringify(patch.contradictingEvidence)]);
  }
  if (patch.ownerUserId !== undefined) updates.push(['owner_user_id', patch.ownerUserId]);
  if (patch.rootCause !== undefined) updates.push(['root_cause', patch.rootCause]);
  if (patch.rootCauseMethod !== undefined) updates.push(['root_cause_method', patch.rootCauseMethod]);
  if (patch.rootCauseConfirmed !== undefined) {
    updates.push(['root_cause_confirmed', !!patch.rootCauseConfirmed]);
  }

  if (updates.length === 0) return fetchFinding(organizationId, id);

  const setSql = updates.map(([col], i) => `${col} = $${i + 3}`).join(', ');
  const params = [organizationId, id, ...updates.map(([, v]) => v)];
  await auditRun(
    `UPDATE audit_program_findings SET ${setSql}, updated_at = NOW() WHERE organization_id = $1 AND id = $2`,
    params,
  );

  await recordAuditEvent({
    organizationId,
    programId: row.program_id,
    entityType: 'finding',
    entityId: id,
    eventType: 'finding.updated',
    actorId: actor.userId,
    summary: `Zaktualizowano ustalenie ${row.reference_code ?? id}`,
    payload: { fields: updates.map(([col]) => col) },
  });

  return fetchFinding(organizationId, id);
}

// ---------------------------------------------------------------------------
// reviewFinding
// ---------------------------------------------------------------------------

export interface ReviewFindingInput {
  decision: 'confirm' | 'send_back' | 'reject';
  note?: string | null;
}

export async function reviewFinding(
  organizationId: string,
  actor: AuditActor,
  id: string,
  input: ReviewFindingInput,
): Promise<AuditFinding> {
  const act = scoped(actor, organizationId);
  const row = await loadFindingRow(organizationId, id);
  await requireCapability(act, row.program_id, 'finding.review');
  await assertNotReviewingOwnFinding(organizationId, id, actor.userId);

  const note = String(input?.note || '').trim();

  if (input.decision === 'confirm') {
    await auditRun(
      `UPDATE audit_program_findings
          SET status = 'confirmed', reviewed_by = $3, reviewed_at = NOW(), review_note = $4, updated_at = NOW()
        WHERE organization_id = $1 AND id = $2`,
      [organizationId, id, actor.userId, note || null],
    );
    await recordAuditEvent({
      organizationId,
      programId: row.program_id,
      entityType: 'finding',
      entityId: id,
      eventType: 'finding.confirmed',
      actorId: actor.userId,
      summary: `Potwierdzono ustalenie ${row.reference_code ?? id}`,
    });
  } else if (input.decision === 'send_back') {
    if (!note) throw new AuditStateError('Odesłanie ustalenia do audytora wymaga podania powodu');
    await auditRun(
      `UPDATE audit_program_findings
          SET status = 'draft', sent_back_at = NOW(), sent_back_by = $3, send_back_reason = $4, updated_at = NOW()
        WHERE organization_id = $1 AND id = $2`,
      [organizationId, id, actor.userId, note],
    );
    await recordAuditEvent({
      organizationId,
      programId: row.program_id,
      entityType: 'finding',
      entityId: id,
      eventType: 'finding.sent_back',
      actorId: actor.userId,
      summary: `Odesłano ustalenie ${row.reference_code ?? id}: ${note}`,
    });
  } else if (input.decision === 'reject') {
    if (!note) throw new AuditStateError('Odrzucenie ustalenia wymaga podania powodu');
    await auditRun(
      `UPDATE audit_program_findings
          SET status = 'rejected', reviewed_by = $3, reviewed_at = NOW(), review_note = $4, updated_at = NOW()
        WHERE organization_id = $1 AND id = $2`,
      [organizationId, id, actor.userId, note],
    );
    await recordAuditEvent({
      organizationId,
      programId: row.program_id,
      entityType: 'finding',
      entityId: id,
      eventType: 'finding.rejected',
      actorId: actor.userId,
      summary: `Odrzucono ustalenie ${row.reference_code ?? id}: ${note}`,
    });
  } else {
    throw new AuditStateError(`Nieznana decyzja przeglądu ustalenia: ${String(input.decision)}`);
  }

  return fetchFinding(organizationId, id);
}

// ---------------------------------------------------------------------------
// submitManagementResponse / reviewManagementResponse
// ---------------------------------------------------------------------------

export interface SubmitManagementResponseInput {
  position: ResponsePosition;
  statement: string;
}

export async function submitManagementResponse(
  organizationId: string,
  actor: AuditActor,
  findingId: string,
  input: SubmitManagementResponseInput,
): Promise<AuditManagementResponse> {
  const act = scoped(actor, organizationId);
  const row = await loadFindingRow(organizationId, findingId);
  await requireCapability(act, row.program_id, 'finding.respond_as_management');

  if (row.status !== 'confirmed' && row.status !== 'response_pending') {
    throw new AuditStateError(
      `Odpowiedź właściciela obszaru jest możliwa tylko dla ustaleń w statusie „confirmed" lub ` +
        `„response_pending" (obecny status: „${row.status}")`,
    );
  }

  const statement = String(input.statement || '').trim();
  if (!statement) throw new AuditStateError('Odpowiedź właściciela obszaru wymaga treści (statement)');

  const position = input.position;
  if (!RESPONSE_POSITIONS.includes(position)) {
    throw new AuditStateError(`Nieznana pozycja odpowiedzi: ${String(position)}`);
  }

  const id = newId('amr');
  await auditRun(
    `INSERT INTO audit_management_responses
       (id, finding_id, program_id, organization_id, position, statement, responded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, findingId, row.program_id, organizationId, position, statement, actor.userId],
  );

  const nextStatus = position === 'accept' ? 'remediation_in_progress' : 'response_pending';
  await auditRun(
    `UPDATE audit_program_findings SET status = $3, updated_at = NOW() WHERE organization_id = $1 AND id = $2`,
    [organizationId, findingId, nextStatus],
  );

  await recordAuditEvent({
    organizationId,
    programId: row.program_id,
    entityType: 'finding',
    entityId: findingId,
    eventType: 'finding.management_response_submitted',
    actorId: actor.userId,
    summary: `Odpowiedź właściciela obszaru (${position}) dla ustalenia ${row.reference_code ?? findingId}`,
    payload: { responseId: id, position },
  });

  const created = await auditGet<ManagementResponseRow>(
    `SELECT * FROM audit_management_responses WHERE organization_id = $1 AND id = $2`,
    [organizationId, id],
  );
  return rowToManagementResponse(created as ManagementResponseRow);
}

export interface ReviewManagementResponseInput {
  accepted: boolean;
  note?: string | null;
}

export async function reviewManagementResponse(
  organizationId: string,
  actor: AuditActor,
  responseId: string,
  input: ReviewManagementResponseInput,
): Promise<AuditManagementResponse> {
  const act = scoped(actor, organizationId);
  const respRow = await auditGet<ManagementResponseRow>(
    `SELECT * FROM audit_management_responses WHERE organization_id = $1 AND id = $2`,
    [organizationId, responseId],
  );
  if (!respRow) throw new AuditNotFoundError('Odpowiedź właściciela obszaru');
  await requireCapability(act, respRow.program_id, 'finding.review');

  const status = input.accepted ? 'accepted' : 'returned';
  await auditRun(
    `UPDATE audit_management_responses
        SET status = $3, reviewed_by = $4, reviewed_at = NOW(), review_note = $5, updated_at = NOW()
      WHERE organization_id = $1 AND id = $2`,
    [organizationId, responseId, status, actor.userId, input.note ?? null],
  );

  await recordAuditEvent({
    organizationId,
    programId: respRow.program_id,
    entityType: 'finding',
    entityId: respRow.finding_id,
    eventType: 'finding.management_response_reviewed',
    actorId: actor.userId,
    summary: `Przegląd odpowiedzi właściciela obszaru: ${status}`,
    payload: { responseId, status },
  });

  const updated = await auditGet<ManagementResponseRow>(
    `SELECT * FROM audit_management_responses WHERE organization_id = $1 AND id = $2`,
    [organizationId, responseId],
  );
  return rowToManagementResponse(updated as ManagementResponseRow);
}

// ---------------------------------------------------------------------------
// acceptResidualRisk
// ---------------------------------------------------------------------------

export interface AcceptResidualRiskInput {
  note: string;
}

export async function acceptResidualRisk(
  organizationId: string,
  actor: AuditActor,
  id: string,
  input: AcceptResidualRiskInput,
): Promise<AuditFinding> {
  const act = scoped(actor, organizationId);
  const row = await loadFindingRow(organizationId, id);
  // Świadomie NIE bramkujemy przez requireCapability('finding.accept_residual_risk'):
  // ta czynność jest w całości rządzona przez `assertCanAcceptResidualRisk` i
  // `decisionRules.riskAcceptanceRoles` pakietu (domyślnie ['program_owner']).
  // Statyczna macierz ról w permissions.ts przyznaje capability WYŁĄCZNIE
  // program_owner — gdyby to ona bramkowała pierwsza, pakiet nigdy nie mógłby
  // rozszerzyć akceptacji ryzyka o inną rolę, co unieważniałoby sens
  // `decisionRules` jako reguły "ponad macierzą ról".
  const access = await resolveProgramAccess(act, row.program_id);
  const { decisionRules } = await loadProgramPack(organizationId, row.program_id);
  assertCanAcceptResidualRisk(access, decisionRules);

  const note = String(input?.note || '').trim();
  if (!note) throw new AuditStateError('Akceptacja ryzyka rezydualnego wymaga notatki uzasadniającej decyzję');

  await auditRun(
    `UPDATE audit_program_findings
        SET status = 'risk_accepted', residual_risk_accepted_by = $3, residual_risk_accepted_at = NOW(),
            residual_risk_note = $4, closure_decision = 'risk_accepted', updated_at = NOW()
      WHERE organization_id = $1 AND id = $2`,
    [organizationId, id, actor.userId, note],
  );

  await recordAuditEvent({
    organizationId,
    programId: row.program_id,
    entityType: 'finding',
    entityId: id,
    eventType: 'finding.residual_risk_accepted',
    actorId: actor.userId,
    summary: `Zaakceptowano ryzyko rezydualne dla ustalenia ${row.reference_code ?? id}`,
    payload: { note },
  });

  return fetchFinding(organizationId, id);
}

// ---------------------------------------------------------------------------
// closeFinding
// ---------------------------------------------------------------------------

export interface CloseFindingInput {
  note: string;
}

export async function closeFinding(
  organizationId: string,
  actor: AuditActor,
  id: string,
  input: CloseFindingInput,
): Promise<AuditFinding> {
  const act = scoped(actor, organizationId);
  const row = await loadFindingRow(organizationId, id);
  await requireCapability(act, row.program_id, 'finding.close');
  await assertNotClosingOwnFinding(organizationId, id, actor.userId);

  const note = String(input?.note || '').trim();
  if (!note) throw new AuditStateError('Zamknięcie ustalenia wymaga notatki');

  // TWARDA REGUŁA ZAMKNIĘCIA: każde nierozjęte działanie korygujące (nie
  // odrzucone/anulowane) musi mieć weryfikację skuteczności z result='effective'.
  // Deklaracja wykonawcy ani sam status zadania NIE wystarczają.
  const missing = await auditAll<{ id: string; title: string; action_kind: string; status: string }>(
    `SELECT a.id, a.title, a.action_kind, a.status
       FROM audit_corrective_actions a
      WHERE a.organization_id = $1 AND a.finding_id = $2
        AND a.status NOT IN ('rejected', 'cancelled')
        AND NOT EXISTS (
          SELECT 1 FROM audit_verifications v
           WHERE v.organization_id = $1 AND v.corrective_action_id = a.id
             AND v.verification_kind = 'effectiveness' AND v.result = 'effective'
        )
      ORDER BY a.created_at ASC`,
    [organizationId, id],
  );

  if (missing.length > 0) {
    const names = missing.map((m) => `„${m.title}" (${m.action_kind})`).join('; ');
    throw new AuditStateError(
      `Nie można zamknąć ustalenia — brakuje weryfikacji skuteczności dla działań: ${names}`,
    );
  }

  await auditRun(
    `UPDATE audit_program_findings
        SET status = 'closed', closed_by = $3, closed_at = NOW(), closure_decision = 'closed_verified',
            closure_note = $4, updated_at = NOW()
      WHERE organization_id = $1 AND id = $2`,
    [organizationId, id, actor.userId, note],
  );

  await recordAuditEvent({
    organizationId,
    programId: row.program_id,
    entityType: 'finding',
    entityId: id,
    eventType: 'finding.closed',
    actorId: actor.userId,
    summary: `Zamknięto ustalenie ${row.reference_code ?? id}`,
    payload: { note },
  });

  return fetchFinding(organizationId, id);
}

// ---------------------------------------------------------------------------
// getFindingStatistics
// ---------------------------------------------------------------------------

export interface FindingStatistics {
  total: number;
  byClassification: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
}

export async function getFindingStatistics(
  organizationId: string,
  programId: string,
): Promise<FindingStatistics> {
  const rows = await auditAll<{ classification: string; severity: string | null; status: string; c: number }>(
    `SELECT classification, severity, status, COUNT(*)::int AS c
       FROM audit_program_findings
      WHERE organization_id = $1 AND program_id = $2
      GROUP BY classification, severity, status`,
    [organizationId, programId],
  );

  const byClassification: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let total = 0;

  for (const r of rows) {
    const c = Number(r.c) || 0;
    total += c;
    byClassification[r.classification] = (byClassification[r.classification] ?? 0) + c;
    const sevKey = r.severity ?? 'unspecified';
    bySeverity[sevKey] = (bySeverity[sevKey] ?? 0) + c;
    byStatus[r.status] = (byStatus[r.status] ?? 0) + c;
  }

  return { total, byClassification, bySeverity, byStatus };
}

// ---------------------------------------------------------------------------
// detectSystemicFindings — CZYSTA analiza, żadnego zapisu
// ---------------------------------------------------------------------------

export interface SystemicFindingGroup {
  groupKind: 'root_cause' | 'criterion_area';
  key: string;
  label: string;
  findingIds: string[];
  count: number;
}

function normalizeRootCause(value: string | null): string | null {
  if (!value) return null;
  const norm = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return norm || null;
}

function criterionArea(refCode: string | null, title: string, fallbackId: string): string {
  const ref = (refCode || title || fallbackId).trim();
  const parts = ref.split('.');
  return parts.length > 1 ? parts.slice(0, parts.length - 1).join('.') : ref;
}

/**
 * Grupuje ustalenia POTWIERDZONE po znormalizowanej przyczynie źródłowej oraz
 * po obszarze kryterium (segment nadrzędny `ref_code`). Zwraca kandydatów na
 * inicjatywę systemową (≥2 ustalenia w grupie) — nie tworzy żadnej inicjatywy.
 */
export async function detectSystemicFindings(
  organizationId: string,
  programId: string,
): Promise<SystemicFindingGroup[]> {
  const rows = await auditAll<{
    id: string;
    root_cause: string | null;
    criterion_id: string | null;
  }>(
    `SELECT id, root_cause, criterion_id
       FROM audit_program_findings
      WHERE organization_id = $1 AND program_id = $2 AND status = 'confirmed'`,
    [organizationId, programId],
  );

  const byRootCause = new Map<string, string[]>();
  for (const r of rows) {
    const key = normalizeRootCause(r.root_cause);
    if (!key) continue;
    const list = byRootCause.get(key) ?? [];
    list.push(r.id);
    byRootCause.set(key, list);
  }

  const criterionIds = Array.from(new Set(rows.map((r) => r.criterion_id).filter((v): v is string => !!v)));
  const byArea = new Map<string, string[]>();
  if (criterionIds.length > 0) {
    const placeholders = criterionIds.map((_, i) => `$${i + 3}`).join(', ');
    const criteriaRows = await auditAll<{ id: string; ref_code: string | null; title: string }>(
      `SELECT id, ref_code, title FROM audit_program_criteria
        WHERE organization_id = $1 AND program_id = $2 AND id IN (${placeholders})`,
      [organizationId, programId, ...criterionIds],
    );
    const areaByCriterionId = new Map<string, string>();
    for (const c of criteriaRows) {
      areaByCriterionId.set(c.id, criterionArea(c.ref_code, c.title, c.id));
    }
    for (const r of rows) {
      if (!r.criterion_id) continue;
      const area = areaByCriterionId.get(r.criterion_id);
      if (!area) continue;
      const list = byArea.get(area) ?? [];
      list.push(r.id);
      byArea.set(area, list);
    }
  }

  const groups: SystemicFindingGroup[] = [];
  for (const [key, findingIds] of byRootCause.entries()) {
    if (findingIds.length >= 2) {
      groups.push({
        groupKind: 'root_cause',
        key,
        label: `Wspólna przyczyna źródłowa: ${key}`,
        findingIds,
        count: findingIds.length,
      });
    }
  }
  for (const [key, findingIds] of byArea.entries()) {
    if (findingIds.length >= 2) {
      groups.push({
        groupKind: 'criterion_area',
        key,
        label: `Klaster w obszarze kryterium: ${key}`,
        findingIds,
        count: findingIds.length,
      });
    }
  }

  return groups;
}
