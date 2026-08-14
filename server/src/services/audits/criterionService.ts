/**
 * criterionService — jądro obronności audytu.
 *
 * Odpowiedź audytowanego, wykonana procedura, próba, wynik testu, notatka
 * audytora, wniosek i decyzja o zgodności są ZAPISYWANE OSOBNO
 * (`submitAuditeeResponse`, `recordTest`, `concludeCriterion` piszą do
 * rozłącznych kolumn `audit_program_criteria` — zobacz migrację §4). Żadna
 * funkcja w tym pliku nie łączy tych pól w jedno "answer".
 *
 * DWIE TWARDE REGUŁY w `concludeCriterion` (patrz komentarz przy funkcji) są
 * literalnym odczytaniem zadania: rygor dotyczy WYŁĄCZNIE
 * `conforming`/`nonconforming` — `observation` i
 * `opportunity_for_improvement` nie są tam wymienione, więc nie są nim objęte.
 *
 * `updateApplicability` nie ma własnej capability w `permissions.ts`
 * (macierz zna tylko `criterion.assign`, `.respond_as_auditee`,
 * `.perform_test`, `.conclude`). Używam `criterion.assign` jako najbliższej —
 * to rola, która ustala zakres/przypisania kryterium podczas przygotowania,
 * więc decyzja "nie dotyczy" logicznie należy do tego samego uprawnienia.
 * Jeśli to nietrafiona interpretacja, jest to jedno miejsce do zmiany.
 */

import {
  AuditDomainError,
  AuditNotFoundError,
  AuditStateError,
  auditAll,
  auditGet,
  auditRun,
  parseJson,
  recordAuditEvent,
  toBool,
  toIso,
  toNum,
} from './auditsDb.js';
import { requireCapability, assertNotConcludingOwnResponse } from './permissions.js';
import {
  CONFORMITY_STATUSES,
  type AuditActor,
  type AuditProgramCriterion,
  type ConformityStatus,
  type CriterionNodeKind,
  type CriterionWorkStatus,
  type ExpectedEvidenceSpec,
  type TestResult,
} from './types.js';

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function mapCriterionRow(row: Record<string, unknown>): AuditProgramCriterion {
  return {
    id: String(row.id),
    programId: String(row.program_id),
    organizationId: String(row.organization_id),
    packCriterionId: (row.pack_criterion_id as string) ?? null,
    parentId: (row.parent_id as string) ?? null,
    ordinal: Number(row.ordinal ?? 0),
    refCode: (row.ref_code as string) ?? null,
    nodeKind: (row.node_kind as CriterionNodeKind) ?? 'criterion',
    title: String(row.title ?? ''),

    requirementText: (row.requirement_text as string) ?? null,
    sourceReference: (row.source_reference as string) ?? null,
    auditQuestion: (row.audit_question as string) ?? null,
    expectedEvidence: parseJson<ExpectedEvidenceSpec[]>(row.expected_evidence, []),
    auditProcedure: (row.audit_procedure as string) ?? null,
    samplingGuidance: (row.sampling_guidance as string) ?? null,
    mandatory: toBool(row.mandatory),
    weight: toNum(row.weight),

    applicable: toBool(row.applicable),
    notApplicableReason: (row.not_applicable_reason as string) ?? null,

    assignedAuditorId: (row.assigned_auditor_id as string) ?? null,
    assignedAuditeeId: (row.assigned_auditee_id as string) ?? null,

    auditeeResponse: (row.auditee_response as string) ?? null,
    auditeeRespondedBy: (row.auditee_responded_by as string) ?? null,
    auditeeRespondedAt: toIso(row.auditee_responded_at),

    procedurePerformed: (row.procedure_performed as string) ?? null,
    sampleDescription: (row.sample_description as string) ?? null,
    testPerformed: (row.test_performed as string) ?? null,
    testResult: (row.test_result as TestResult) ?? null,
    auditorNote: (row.auditor_note as string) ?? null,
    auditorConclusion: (row.auditor_conclusion as string) ?? null,
    conformityStatus: (row.conformity_status as ConformityStatus) ?? 'not_tested',
    concludedBy: (row.concluded_by as string) ?? null,
    concludedAt: toIso(row.concluded_at),

    workStatus: (row.work_status as CriterionWorkStatus) ?? 'open',
    createdAt: toIso(row.created_at) ?? '',
    updatedAt: toIso(row.updated_at) ?? '',
  };
}

async function loadCriterionRow(
  organizationId: string,
  id: string
): Promise<Record<string, unknown> | null> {
  return auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_program_criteria WHERE id = $1 AND organization_id = $2`,
    [id, organizationId]
  );
}

async function loadCriterionOrThrow(
  organizationId: string,
  id: string
): Promise<AuditProgramCriterion> {
  const row = await loadCriterionRow(organizationId, id);
  if (!row) throw new AuditNotFoundError('Kryterium audytu');
  return mapCriterionRow(row);
}

// ---------------------------------------------------------------------------
// Odczyt — drzewo + liczniki dowodów/ustaleń w zapytaniach agregujących
// ---------------------------------------------------------------------------

export interface CriterionWithCounts extends AuditProgramCriterion {
  evidenceCount: number;
  findingCount: number;
  children: CriterionWithCounts[];
}

export interface ListCriteriaOptions {
  conformityStatus?: ConformityStatus | 'all';
  assignedTo?: string;
  search?: string;
}

function buildCriterionTree(
  nodes: AuditProgramCriterion[],
  countsByCriterion: Map<string, { evidence: number; finding: number }>
): CriterionWithCounts[] {
  const withCounts = new Map<string, CriterionWithCounts>();
  for (const node of nodes) {
    const counts = countsByCriterion.get(node.id) ?? { evidence: 0, finding: 0 };
    withCounts.set(node.id, {
      ...node,
      evidenceCount: counts.evidence,
      findingCount: counts.finding,
      children: [],
    });
  }

  const roots: CriterionWithCounts[] = [];
  for (const node of withCounts.values()) {
    if (node.parentId && withCounts.has(node.parentId)) {
      withCounts.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRec = (list: CriterionWithCounts[]): void => {
    list.sort((a, b) => a.ordinal - b.ordinal);
    for (const item of list) sortRec(item.children);
  };
  sortRec(roots);
  return roots;
}

/**
 * Drzewo kryteriów programu z licznikiem dowodów i ustaleń, policzonym przez
 * DWA zapytania agregujące (GROUP BY criterion_id) — nie N+1 per kryterium.
 * Filtry (`conformityStatus`, `assignedTo`, `search`) działają na SQL-owym
 * WHERE; kryterium spełniające filtr, którego rodzic nie spełnia, staje się
 * korzeniem drzewa wyniku (parentId oryginalny jest zachowany na obiekcie).
 */
export async function listCriteria(
  organizationId: string,
  programId: string,
  options: ListCriteriaOptions = {}
): Promise<CriterionWithCounts[]> {
  const where: string[] = ['organization_id = $1', 'program_id = $2'];
  const params: unknown[] = [organizationId, programId];

  if (options.conformityStatus && options.conformityStatus !== 'all') {
    params.push(options.conformityStatus);
    where.push(`conformity_status = $${params.length}`);
  }
  if (isNonEmpty(options.assignedTo)) {
    params.push(options.assignedTo);
    const idx = params.length;
    where.push(`(assigned_auditor_id = $${idx} OR assigned_auditee_id = $${idx})`);
  }
  if (isNonEmpty(options.search)) {
    params.push(`%${options.search.trim()}%`);
    const idx = params.length;
    where.push(`(title ILIKE $${idx} OR ref_code ILIKE $${idx} OR requirement_text ILIKE $${idx})`);
  }

  const rows = await auditAll<Record<string, unknown>>(
    `SELECT * FROM audit_program_criteria WHERE ${where.join(' AND ')} ORDER BY ordinal ASC`,
    params
  );
  const criteria = rows.map(mapCriterionRow);
  if (criteria.length === 0) return [];

  const evidenceRows = await auditAll<{ criterion_id: string; cnt: string }>(
    `SELECT criterion_id, COUNT(*)::text AS cnt FROM audit_evidence
      WHERE organization_id = $1 AND program_id = $2 AND criterion_id IS NOT NULL
      GROUP BY criterion_id`,
    [organizationId, programId]
  );
  const findingRows = await auditAll<{ criterion_id: string; cnt: string }>(
    `SELECT criterion_id, COUNT(*)::text AS cnt FROM audit_program_findings
      WHERE organization_id = $1 AND program_id = $2 AND criterion_id IS NOT NULL
      GROUP BY criterion_id`,
    [organizationId, programId]
  );

  const countsByCriterion = new Map<string, { evidence: number; finding: number }>();
  for (const r of evidenceRows) {
    countsByCriterion.set(r.criterion_id, {
      evidence: Number(r.cnt),
      finding: countsByCriterion.get(r.criterion_id)?.finding ?? 0,
    });
  }
  for (const r of findingRows) {
    countsByCriterion.set(r.criterion_id, {
      evidence: countsByCriterion.get(r.criterion_id)?.evidence ?? 0,
      finding: Number(r.cnt),
    });
  }

  return buildCriterionTree(criteria, countsByCriterion);
}

export interface CriterionEvidenceLite {
  id: string;
  evidenceKind: string;
  title: string;
  accepted: boolean | null;
  supportsConformity: boolean | null;
  createdAt: string;
}

export interface CriterionEvidenceRequestLite {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
}

export interface CriterionFindingLite {
  id: string;
  statement: string;
  classification: string;
  severity: string | null;
  status: string;
}

export interface CriterionDetail {
  criterion: AuditProgramCriterion;
  evidence: CriterionEvidenceLite[];
  evidenceRequests: CriterionEvidenceRequestLite[];
  findings: CriterionFindingLite[];
}

export async function getCriterion(
  organizationId: string,
  id: string
): Promise<CriterionDetail | null> {
  const row = await loadCriterionRow(organizationId, id);
  if (!row) return null;
  const criterion = mapCriterionRow(row);

  const evidenceRows = await auditAll<Record<string, unknown>>(
    `SELECT id, evidence_kind, title, accepted, supports_conformity, created_at
       FROM audit_evidence
      WHERE organization_id = $1 AND criterion_id = $2
      ORDER BY created_at DESC`,
    [organizationId, id]
  );
  const requestRows = await auditAll<Record<string, unknown>>(
    `SELECT id, title, status, due_date FROM audit_evidence_requests
      WHERE organization_id = $1 AND criterion_id = $2
      ORDER BY requested_at DESC`,
    [organizationId, id]
  );
  const findingRows = await auditAll<Record<string, unknown>>(
    `SELECT id, statement, classification, severity, status FROM audit_program_findings
      WHERE organization_id = $1 AND criterion_id = $2
      ORDER BY created_at DESC`,
    [organizationId, id]
  );

  return {
    criterion,
    evidence: evidenceRows.map((r) => ({
      id: String(r.id),
      evidenceKind: String(r.evidence_kind),
      title: String(r.title ?? ''),
      accepted: r.accepted === null || r.accepted === undefined ? null : toBool(r.accepted),
      supportsConformity:
        r.supports_conformity === null || r.supports_conformity === undefined
          ? null
          : toBool(r.supports_conformity),
      createdAt: toIso(r.created_at) ?? '',
    })),
    evidenceRequests: requestRows.map((r) => ({
      id: String(r.id),
      title: String(r.title ?? ''),
      status: String(r.status ?? 'open'),
      dueDate: r.due_date ? String(r.due_date) : null,
    })),
    findings: findingRows.map((r) => ({
      id: String(r.id),
      statement: String(r.statement ?? ''),
      classification: String(r.classification ?? ''),
      severity: (r.severity as string) ?? null,
      status: String(r.status ?? 'draft'),
    })),
  };
}

// ---------------------------------------------------------------------------
// Praca merytoryczna — pola ROZDZIELNE, patrz nagłówek pliku
// ---------------------------------------------------------------------------

export async function updateApplicability(
  organizationId: string,
  actor: AuditActor,
  id: string,
  input: { applicable: boolean; reason?: string | null }
): Promise<AuditProgramCriterion> {
  const criterion = await loadCriterionOrThrow(organizationId, id);
  await requireCapability(
    actor,
    criterion.programId,
    'criterion.assign',
    'Zmiana stosowalności kryterium wymaga uprawnień przypisywania w programie'
  );

  if (!input.applicable && !isNonEmpty(input.reason)) {
    throw new AuditDomainError(
      'Oznaczenie kryterium jako „nie dotyczy" wymaga podania powodu',
      400,
      'AUDIT_APPLICABILITY_REASON_REQUIRED'
    );
  }

  await auditRun(
    `UPDATE audit_program_criteria
        SET applicable = $1, not_applicable_reason = $2, updated_at = NOW()
      WHERE id = $3 AND organization_id = $4`,
    [input.applicable, input.applicable ? null : (input.reason ?? null), id, organizationId]
  );

  await recordAuditEvent({
    organizationId,
    programId: criterion.programId,
    entityType: 'criterion',
    entityId: id,
    eventType: 'criterion.applicability_updated',
    actorId: actor.userId,
    summary: input.applicable
      ? `Kryterium „${criterion.title}" przywrócone jako stosowalne`
      : `Kryterium „${criterion.title}" oznaczone jako nie dotyczy — ${input.reason}`,
    payload: { applicable: input.applicable, reason: input.reason ?? null },
  });

  return loadCriterionOrThrow(organizationId, id);
}

export async function assignCriterion(
  organizationId: string,
  actor: AuditActor,
  id: string,
  input: { auditorId?: string | null; auditeeId?: string | null }
): Promise<AuditProgramCriterion> {
  const criterion = await loadCriterionOrThrow(organizationId, id);
  await requireCapability(actor, criterion.programId, 'criterion.assign');

  const nextAuditor = input.auditorId !== undefined ? input.auditorId : criterion.assignedAuditorId;
  const nextAuditee = input.auditeeId !== undefined ? input.auditeeId : criterion.assignedAuditeeId;

  await auditRun(
    `UPDATE audit_program_criteria
        SET assigned_auditor_id = $1, assigned_auditee_id = $2, updated_at = NOW()
      WHERE id = $3 AND organization_id = $4`,
    [nextAuditor, nextAuditee, id, organizationId]
  );

  await recordAuditEvent({
    organizationId,
    programId: criterion.programId,
    entityType: 'criterion',
    entityId: id,
    eventType: 'criterion.assigned',
    actorId: actor.userId,
    summary: `Przypisano kryterium „${criterion.title}" — auditor=${nextAuditor ?? '—'}, auditee=${nextAuditee ?? '—'}`,
    payload: { auditorId: nextAuditor, auditeeId: nextAuditee },
  });

  return loadCriterionOrThrow(organizationId, id);
}

export async function submitAuditeeResponse(
  organizationId: string,
  actor: AuditActor,
  id: string,
  text: string
): Promise<AuditProgramCriterion> {
  if (!isNonEmpty(text)) {
    throw new AuditDomainError(
      'Odpowiedź audytowanego nie może być pusta',
      400,
      'AUDIT_RESPONSE_EMPTY'
    );
  }
  const criterion = await loadCriterionOrThrow(organizationId, id);
  await requireCapability(actor, criterion.programId, 'criterion.respond_as_auditee');

  // Odpowiedź audytowanego przesuwa pracę do "evidence_received" tylko z
  // wcześniejszych stanów (open/evidence_requested) — nie cofa "tested"/"concluded".
  const nextWorkStatus =
    criterion.workStatus === 'open' || criterion.workStatus === 'evidence_requested'
      ? 'evidence_received'
      : criterion.workStatus;

  await auditRun(
    `UPDATE audit_program_criteria
        SET auditee_response = $1, auditee_responded_by = $2, auditee_responded_at = NOW(),
            work_status = $3, updated_at = NOW()
      WHERE id = $4 AND organization_id = $5`,
    [text.trim(), actor.userId, nextWorkStatus, id, organizationId]
  );

  await recordAuditEvent({
    organizationId,
    programId: criterion.programId,
    entityType: 'criterion',
    entityId: id,
    eventType: 'criterion.auditee_response_submitted',
    actorId: actor.userId,
    summary: `Audytowany odpowiedział na kryterium „${criterion.title}"`,
  });

  return loadCriterionOrThrow(organizationId, id);
}

export interface RecordTestInput {
  procedurePerformed?: string | null;
  sampleDescription?: string | null;
  testPerformed?: string | null;
  testResult?: TestResult | null;
  auditorNote?: string | null;
}

export async function recordTest(
  organizationId: string,
  actor: AuditActor,
  id: string,
  input: RecordTestInput
): Promise<AuditProgramCriterion> {
  const criterion = await loadCriterionOrThrow(organizationId, id);
  await requireCapability(actor, criterion.programId, 'criterion.perform_test');

  await auditRun(
    `UPDATE audit_program_criteria
        SET procedure_performed = $1, sample_description = $2, test_performed = $3,
            test_result = $4, auditor_note = $5, work_status = 'tested', updated_at = NOW()
      WHERE id = $6 AND organization_id = $7`,
    [
      input.procedurePerformed ?? null,
      input.sampleDescription ?? null,
      input.testPerformed ?? null,
      input.testResult ?? null,
      input.auditorNote ?? null,
      id,
      organizationId,
    ]
  );

  await recordAuditEvent({
    organizationId,
    programId: criterion.programId,
    entityType: 'criterion',
    entityId: id,
    eventType: 'criterion.test_recorded',
    actorId: actor.userId,
    summary: `Wykonano procedurę testową dla „${criterion.title}" — wynik: ${input.testResult ?? 'brak'}`,
    payload: { testResult: input.testResult ?? null },
  });

  return loadCriterionOrThrow(organizationId, id);
}

export interface ConcludeCriterionInput {
  auditorConclusion?: string | null;
  conformityStatus: ConformityStatus;
}

/**
 * TWARDA REGUŁA 1: `conforming`/`nonconforming` wymagają wcześniej
 * zarejestrowanego wyniku testu (`recordTest`, `test_result` niepuste).
 * Wyjątek: `not_applicable`, `evidence_insufficient` (i wszystko poza
 * `conforming`/`nonconforming` — zadanie nie rozszerza rygoru na
 * `observation`/`opportunity_for_improvement`).
 *
 * TWARDA REGUŁA 2: `conforming` wymaga co najmniej jednego ZAAKCEPTOWANEGO
 * dowodu (`audit_evidence.accepted = true`) powiązanego z tym kryterium. Brak
 * dowodu nie jest automatycznie niezgodnością — to `evidence_insufficient`.
 */
export async function concludeCriterion(
  organizationId: string,
  actor: AuditActor,
  id: string,
  input: ConcludeCriterionInput
): Promise<AuditProgramCriterion> {
  if (!CONFORMITY_STATUSES.includes(input.conformityStatus)) {
    throw new AuditDomainError(
      `Nieznany status zgodności: ${input.conformityStatus}`,
      400,
      'AUDIT_CONFORMITY_STATUS_INVALID'
    );
  }

  const criterion = await loadCriterionOrThrow(organizationId, id);
  await requireCapability(actor, criterion.programId, 'criterion.conclude');
  await assertNotConcludingOwnResponse(organizationId, id, actor.userId);

  if (
    (input.conformityStatus === 'conforming' || input.conformityStatus === 'nonconforming') &&
    !isNonEmpty(criterion.testResult)
  ) {
    throw new AuditStateError(
      'Wniosek o zgodności ("conforming"/"nonconforming") wymaga wcześniej wykonanej procedury testowej — brak zarejestrowanego wyniku testu (recordTest)'
    );
  }

  if (input.conformityStatus === 'conforming') {
    const acceptedRow = await auditGet<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM audit_evidence
        WHERE organization_id = $1 AND criterion_id = $2 AND accepted = true`,
      [organizationId, id]
    );
    if (Number(acceptedRow?.cnt ?? 0) === 0) {
      throw new AuditStateError(
        'Wniosek "conforming" wymaga co najmniej jednego zaakceptowanego dowodu — brak dowodu to "evidence_insufficient", nie zgodność'
      );
    }
  }

  await auditRun(
    `UPDATE audit_program_criteria
        SET auditor_conclusion = $1, conformity_status = $2, concluded_by = $3, concluded_at = NOW(),
            work_status = 'concluded', updated_at = NOW()
      WHERE id = $4 AND organization_id = $5`,
    [input.auditorConclusion ?? null, input.conformityStatus, actor.userId, id, organizationId]
  );

  await recordAuditEvent({
    organizationId,
    programId: criterion.programId,
    entityType: 'criterion',
    entityId: id,
    eventType: 'criterion.concluded',
    actorId: actor.userId,
    summary: `Wniosek dla „${criterion.title}": ${input.conformityStatus}`,
    payload: { conformityStatus: input.conformityStatus },
  });

  return loadCriterionOrThrow(organizationId, id);
}

// ---------------------------------------------------------------------------
// Pokrycie programu
// ---------------------------------------------------------------------------

export interface CriterionCoverage {
  applicableTotal: number;
  testedTotal: number;
  concludedTotal: number;
  evidenceInsufficientTotal: number;
  conformingTotal: number;
  nonconformingTotal: number;
  notApplicableTotal: number;
}

export async function getCoverage(
  organizationId: string,
  programId: string
): Promise<CriterionCoverage> {
  const row = await auditGet<Record<string, unknown>>(
    `SELECT
        COUNT(*) FILTER (WHERE applicable = true) AS applicable_total,
        COUNT(*) FILTER (WHERE applicable = true AND work_status IN ('tested','concluded')) AS tested_total,
        COUNT(*) FILTER (WHERE applicable = true AND work_status = 'concluded') AS concluded_total,
        COUNT(*) FILTER (WHERE conformity_status = 'evidence_insufficient') AS evidence_insufficient_total,
        COUNT(*) FILTER (WHERE conformity_status = 'conforming') AS conforming_total,
        COUNT(*) FILTER (WHERE conformity_status = 'nonconforming') AS nonconforming_total,
        COUNT(*) FILTER (WHERE conformity_status = 'not_applicable') AS not_applicable_total
       FROM audit_program_criteria
      WHERE organization_id = $1 AND program_id = $2`,
    [organizationId, programId]
  );

  return {
    applicableTotal: Number(row?.applicable_total ?? 0),
    testedTotal: Number(row?.tested_total ?? 0),
    concludedTotal: Number(row?.concluded_total ?? 0),
    evidenceInsufficientTotal: Number(row?.evidence_insufficient_total ?? 0),
    conformingTotal: Number(row?.conforming_total ?? 0),
    nonconformingTotal: Number(row?.nonconforming_total ?? 0),
    notApplicableTotal: Number(row?.not_applicable_total ?? 0),
  };
}
