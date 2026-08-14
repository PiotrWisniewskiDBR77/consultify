/**
 * evidenceService — żądania dowodów i dowody (`audit_evidence_requests`,
 * `audit_evidence`).
 *
 * `reviewEvidence` zapisuje CAŁY komplet oceny audytora za jednym wywołaniem
 * (sufficiency/reliability/currencyStatus/supportsConformity/accepted/notatki)
 * — pola nieprzekazane w wejściu są traktowane jako `null` (nadpisują
 * poprzednią ocenę), a nie "zostaw bez zmian". To świadomy wybór: ocena
 * dowodu jest jednym aktem recenzji, nie serią niezależnych patchy, więc nie
 * ma ryzyka "częściowej" aktualizacji zostawiającej stan niespójny. Kluczowe:
 * `supportsConformity: false` (dowód PRZECZĄCY) jest zapisywane tak samo jak
 * `true` — nigdy nie jest cicho odrzucane ani zamieniane na `null`.
 *
 * `updateRequestStatus`/`cancelRequest` nie mają własnej capability w
 * `permissions.ts` (macierz zna tylko `evidence_request.create`) — używam
 * tej samej, bo zarządzanie cyklem życia żądania logicznie należy do tego,
 * kto może je tworzyć.
 */

import { createHash } from 'crypto';

import {
  AuditDomainError,
  AuditNotFoundError,
  auditAll,
  auditGet,
  auditRun,
  newId,
  parseJson,
  recordAuditEvent,
  toBool,
  toIso,
} from './auditsDb.js';
import { requireCapability } from './permissions.js';
import type {
  AuditActor,
  AuditEvidence,
  AuditEvidenceRequest,
  EvidenceKind,
  EvidenceRequestStatus,
  ExpectedEvidenceSpec,
} from './types.js';

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function mapRequestRow(row: Record<string, unknown>): AuditEvidenceRequest {
  return {
    id: String(row.id),
    programId: String(row.program_id),
    organizationId: String(row.organization_id),
    criterionId: (row.criterion_id as string) ?? null,
    title: String(row.title ?? ''),
    description: (row.description as string) ?? null,
    expectedEvidenceKind: (row.expected_evidence_kind as EvidenceKind) ?? null,
    requestedFromUserId: (row.requested_from_user_id as string) ?? null,
    requestedBy: (row.requested_by as string) ?? null,
    requestedAt: toIso(row.requested_at) ?? '',
    dueDate: row.due_date ? String(row.due_date) : null,
    status: (row.status as EvidenceRequestStatus) ?? 'open',
    taskId: (row.task_id as string) ?? null,
    fulfilledAt: toIso(row.fulfilled_at),
    cancelledAt: toIso(row.cancelled_at),
    createdAt: toIso(row.created_at) ?? '',
    updatedAt: toIso(row.updated_at) ?? '',
  };
}

function mapEvidenceRow(row: Record<string, unknown>): AuditEvidence {
  return {
    id: String(row.id),
    programId: String(row.program_id),
    organizationId: String(row.organization_id),
    criterionId: (row.criterion_id as string) ?? null,
    requestId: (row.request_id as string) ?? null,
    evidenceKind: (row.evidence_kind as EvidenceKind) ?? 'document',
    title: String(row.title ?? ''),
    description: (row.description as string) ?? null,

    materialId: (row.material_id as string) ?? null,
    materialVersion: (row.material_version as string) ?? null,
    interviewAssignmentId: (row.interview_assignment_id as string) ?? null,
    externalReference: (row.external_reference as string) ?? null,
    contentSnapshot: (row.content_snapshot as string) ?? null,
    contentHash: (row.content_hash as string) ?? null,
    sourceSystem: (row.source_system as string) ?? null,

    providedBy: (row.provided_by as string) ?? null,
    providedAt: toIso(row.provided_at),
    capturedBy: (row.captured_by as string) ?? null,
    capturedAt: toIso(row.captured_at) ?? '',
    periodFrom: row.period_from ? String(row.period_from) : null,
    periodTo: row.period_to ? String(row.period_to) : null,

    sufficiency: (row.sufficiency as AuditEvidence['sufficiency']) ?? null,
    reliability: (row.reliability as AuditEvidence['reliability']) ?? null,
    currencyStatus: (row.currency_status as AuditEvidence['currencyStatus']) ?? null,
    supportsConformity:
      row.supports_conformity === null || row.supports_conformity === undefined
        ? null
        : toBool(row.supports_conformity),
    reviewNote: (row.review_note as string) ?? null,
    accepted: row.accepted === null || row.accepted === undefined ? null : toBool(row.accepted),
    acceptedBy: (row.accepted_by as string) ?? null,
    acceptedAt: toIso(row.accepted_at),
    rejectionReason: (row.rejection_reason as string) ?? null,

    createdAt: toIso(row.created_at) ?? '',
    updatedAt: toIso(row.updated_at) ?? '',
  };
}

async function loadRequestOrThrow(
  organizationId: string,
  id: string
): Promise<AuditEvidenceRequest> {
  const row = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_evidence_requests WHERE id = $1 AND organization_id = $2`,
    [id, organizationId]
  );
  if (!row) throw new AuditNotFoundError('Żądanie dowodu');
  return mapRequestRow(row);
}

async function loadEvidenceOrThrow(organizationId: string, id: string): Promise<AuditEvidence> {
  const row = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_evidence WHERE id = $1 AND organization_id = $2`,
    [id, organizationId]
  );
  if (!row) throw new AuditNotFoundError('Dowód audytowy');
  return mapEvidenceRow(row);
}

// ---------------------------------------------------------------------------
// Evidence requests
// ---------------------------------------------------------------------------

export interface CreateRequestInput {
  programId: string;
  criterionId?: string | null;
  title: string;
  description?: string | null;
  expectedEvidenceKind?: EvidenceKind | null;
  requestedFromUserId?: string | null;
  dueDate?: string | null;
}

export async function createRequest(
  organizationId: string,
  actor: AuditActor,
  input: CreateRequestInput
): Promise<AuditEvidenceRequest> {
  await requireCapability(actor, input.programId, 'evidence_request.create');
  if (!isNonEmpty(input.title)) {
    throw new AuditDomainError(
      'Tytuł żądania dowodu jest wymagany',
      400,
      'AUDIT_EVIDENCE_REQUEST_TITLE_REQUIRED'
    );
  }

  const id = newId('aereq');
  await auditRun(
    `INSERT INTO audit_evidence_requests
       (id, program_id, organization_id, criterion_id, title, description, expected_evidence_kind,
        requested_from_user_id, requested_by, requested_at, due_date, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,'open',NOW(),NOW())`,
    [
      id,
      input.programId,
      organizationId,
      input.criterionId ?? null,
      input.title.trim(),
      input.description ?? null,
      input.expectedEvidenceKind ?? null,
      input.requestedFromUserId ?? null,
      actor.userId,
      input.dueDate ?? null,
    ]
  );

  await recordAuditEvent({
    organizationId,
    programId: input.programId,
    entityType: 'evidence_request',
    entityId: id,
    eventType: 'evidence_request.created',
    actorId: actor.userId,
    summary: `Utworzono żądanie dowodu „${input.title.trim()}"`,
  });

  return loadRequestOrThrow(organizationId, id);
}

export interface ListRequestsOptions {
  programId?: string;
  criterionId?: string;
  status?: EvidenceRequestStatus | 'all';
  requestedFromUserId?: string;
}

export async function listRequests(
  organizationId: string,
  options: ListRequestsOptions = {}
): Promise<AuditEvidenceRequest[]> {
  const where: string[] = ['organization_id = $1'];
  const params: unknown[] = [organizationId];

  if (isNonEmpty(options.programId)) {
    params.push(options.programId);
    where.push(`program_id = $${params.length}`);
  }
  if (isNonEmpty(options.criterionId)) {
    params.push(options.criterionId);
    where.push(`criterion_id = $${params.length}`);
  }
  if (options.status && options.status !== 'all') {
    params.push(options.status);
    where.push(`status = $${params.length}`);
  }
  if (isNonEmpty(options.requestedFromUserId)) {
    params.push(options.requestedFromUserId);
    where.push(`requested_from_user_id = $${params.length}`);
  }

  const rows = await auditAll<Record<string, unknown>>(
    `SELECT * FROM audit_evidence_requests WHERE ${where.join(' AND ')} ORDER BY requested_at DESC`,
    params
  );
  return rows.map(mapRequestRow);
}

export async function updateRequestStatus(
  organizationId: string,
  actor: AuditActor,
  id: string,
  status: EvidenceRequestStatus
): Promise<AuditEvidenceRequest> {
  const request = await loadRequestOrThrow(organizationId, id);
  await requireCapability(actor, request.programId, 'evidence_request.create');

  await auditRun(
    `UPDATE audit_evidence_requests
        SET status = $1, fulfilled_at = ${status === 'fulfilled' ? 'NOW()' : 'fulfilled_at'}, updated_at = NOW()
      WHERE id = $2 AND organization_id = $3`,
    [status, id, organizationId]
  );

  await recordAuditEvent({
    organizationId,
    programId: request.programId,
    entityType: 'evidence_request',
    entityId: id,
    eventType: 'evidence_request.status_changed',
    actorId: actor.userId,
    summary: `Żądanie dowodu „${request.title}" → ${status}`,
    payload: { status },
  });

  return loadRequestOrThrow(organizationId, id);
}

export async function cancelRequest(
  organizationId: string,
  actor: AuditActor,
  id: string
): Promise<AuditEvidenceRequest> {
  const request = await loadRequestOrThrow(organizationId, id);
  await requireCapability(actor, request.programId, 'evidence_request.create');

  await auditRun(
    `UPDATE audit_evidence_requests
        SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND organization_id = $2`,
    [id, organizationId]
  );

  await recordAuditEvent({
    organizationId,
    programId: request.programId,
    entityType: 'evidence_request',
    entityId: id,
    eventType: 'evidence_request.cancelled',
    actorId: actor.userId,
    summary: `Anulowano żądanie dowodu „${request.title}"`,
  });

  return loadRequestOrThrow(organizationId, id);
}

/** Zamiata przeterminowane żądania (due_date w przeszłości, wciąż open/responded). */
export async function markOverdueRequests(organizationId: string): Promise<number> {
  const rows = await auditAll<{ id: string; title: string; program_id: string }>(
    `SELECT id, title, program_id FROM audit_evidence_requests
      WHERE organization_id = $1 AND status IN ('open','responded')
        AND due_date IS NOT NULL AND due_date < CURRENT_DATE`,
    [organizationId]
  );
  if (rows.length === 0) return 0;

  await auditRun(
    `UPDATE audit_evidence_requests
        SET status = 'overdue', updated_at = NOW()
      WHERE organization_id = $1 AND status IN ('open','responded')
        AND due_date IS NOT NULL AND due_date < CURRENT_DATE`,
    [organizationId]
  );

  for (const r of rows) {
    await recordAuditEvent({
      organizationId,
      programId: r.program_id,
      entityType: 'evidence_request',
      entityId: r.id,
      eventType: 'evidence_request.marked_overdue',
      summary: `Żądanie dowodu „${r.title}" przeterminowane`,
    });
  }

  return rows.length;
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

function computeContentHash(input: {
  contentSnapshot?: string | null;
  materialId?: string | null;
  materialVersion?: string | null;
  title: string;
  externalReference?: string | null;
}): string {
  const basis = isNonEmpty(input.contentSnapshot)
    ? input.contentSnapshot
    : isNonEmpty(input.materialId)
      ? `${input.materialId}:${input.materialVersion ?? ''}`
      : `${input.title}:${input.externalReference ?? ''}`;
  return createHash('sha256').update(basis).digest('hex');
}

export interface SubmitEvidenceInput {
  programId: string;
  criterionId?: string | null;
  requestId?: string | null;
  kind: EvidenceKind;
  title: string;
  description?: string | null;
  materialId?: string | null;
  materialVersion?: string | null;
  interviewAssignmentId?: string | null;
  externalReference?: string | null;
  contentSnapshot?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
}

export async function submitEvidence(
  organizationId: string,
  actor: AuditActor,
  input: SubmitEvidenceInput
): Promise<AuditEvidence> {
  await requireCapability(actor, input.programId, 'evidence.submit');
  if (!isNonEmpty(input.title)) {
    throw new AuditDomainError('Tytuł dowodu jest wymagany', 400, 'AUDIT_EVIDENCE_TITLE_REQUIRED');
  }

  const contentHash = computeContentHash(input);
  const id = newId('aevid');

  await auditRun(
    `INSERT INTO audit_evidence
       (id, program_id, organization_id, criterion_id, request_id, evidence_kind, title, description,
        material_id, material_version, interview_assignment_id, external_reference, content_snapshot,
        content_hash, provided_by, provided_at, captured_by, captured_at, period_from, period_to,
        created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),$16,NOW(),$17,$18,NOW(),NOW())`,
    [
      id,
      input.programId,
      organizationId,
      input.criterionId ?? null,
      input.requestId ?? null,
      input.kind,
      input.title.trim(),
      input.description ?? null,
      input.materialId ?? null,
      input.materialVersion ?? null,
      input.interviewAssignmentId ?? null,
      input.externalReference ?? null,
      input.contentSnapshot ?? null,
      contentHash,
      actor.userId,
      actor.userId,
      input.periodFrom ?? null,
      input.periodTo ?? null,
    ]
  );

  if (isNonEmpty(input.requestId)) {
    await auditRun(
      `UPDATE audit_evidence_requests
          SET status = 'responded', updated_at = NOW()
        WHERE id = $1 AND organization_id = $2 AND status IN ('open', 'overdue')`,
      [input.requestId, organizationId]
    );
  }

  await recordAuditEvent({
    organizationId,
    programId: input.programId,
    entityType: 'evidence',
    entityId: id,
    eventType: 'evidence.submitted',
    actorId: actor.userId,
    summary: `Przesłano dowód „${input.title.trim()}" (${input.kind})`,
    payload: { criterionId: input.criterionId ?? null, requestId: input.requestId ?? null },
  });

  return loadEvidenceOrThrow(organizationId, id);
}

export interface ReviewEvidenceInput {
  sufficiency?: 'sufficient' | 'insufficient' | 'unknown' | null;
  reliability?: 'reliable' | 'questionable' | 'unknown' | null;
  currencyStatus?: 'current' | 'outdated' | 'unknown' | null;
  /** NULL = nieoceniony. FALSE = dowód PRZECZĄCY — musi dać się zapisać. */
  supportsConformity?: boolean | null;
  accepted?: boolean | null;
  reviewNote?: string | null;
  rejectionReason?: string | null;
}

export async function reviewEvidence(
  organizationId: string,
  actor: AuditActor,
  id: string,
  input: ReviewEvidenceInput
): Promise<AuditEvidence> {
  const evidence = await loadEvidenceOrThrow(organizationId, id);
  await requireCapability(actor, evidence.programId, 'evidence.review');

  await auditRun(
    `UPDATE audit_evidence
        SET sufficiency = $1, reliability = $2, currency_status = $3, supports_conformity = $4,
            accepted = $5, review_note = $6, rejection_reason = $7,
            accepted_by = $8, accepted_at = NOW(), updated_at = NOW()
      WHERE id = $9 AND organization_id = $10`,
    [
      input.sufficiency ?? null,
      input.reliability ?? null,
      input.currencyStatus ?? null,
      input.supportsConformity === undefined ? null : input.supportsConformity,
      input.accepted === undefined ? null : input.accepted,
      input.reviewNote ?? null,
      input.rejectionReason ?? null,
      actor.userId,
      id,
      organizationId,
    ]
  );

  await recordAuditEvent({
    organizationId,
    programId: evidence.programId,
    entityType: 'evidence',
    entityId: id,
    eventType: 'evidence.reviewed',
    actorId: actor.userId,
    summary: `Zrecenzowano dowód „${evidence.title}" — accepted=${input.accepted ?? 'null'}, supportsConformity=${input.supportsConformity ?? 'null'}`,
    payload: {
      accepted: input.accepted ?? null,
      supportsConformity: input.supportsConformity ?? null,
    },
  });

  return loadEvidenceOrThrow(organizationId, id);
}

export interface ListEvidenceOptions {
  programId?: string;
  criterionId?: string;
  kind?: EvidenceKind;
  accepted?: boolean;
}

export async function listEvidence(
  organizationId: string,
  options: ListEvidenceOptions = {}
): Promise<AuditEvidence[]> {
  const where: string[] = ['organization_id = $1'];
  const params: unknown[] = [organizationId];

  if (isNonEmpty(options.programId)) {
    params.push(options.programId);
    where.push(`program_id = $${params.length}`);
  }
  if (isNonEmpty(options.criterionId)) {
    params.push(options.criterionId);
    where.push(`criterion_id = $${params.length}`);
  }
  if (isNonEmpty(options.kind)) {
    params.push(options.kind);
    where.push(`evidence_kind = $${params.length}`);
  }
  if (options.accepted !== undefined) {
    params.push(options.accepted);
    where.push(`accepted = $${params.length}`);
  }

  const rows = await auditAll<Record<string, unknown>>(
    `SELECT * FROM audit_evidence WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
    params
  );
  return rows.map(mapEvidenceRow);
}

// ---------------------------------------------------------------------------
// Luki dowodowe
// ---------------------------------------------------------------------------

export interface EvidenceGap {
  criterionId: string;
  refCode: string | null;
  title: string;
  /** Puste = kryterium bez ŻADNEGO dowodu i bez zdefiniowanej listy oczekiwanych rodzajów. */
  missingKinds: string[];
}

/**
 * Kryteria stosowalne, których `expected_evidence` (obowiązkowe pozycje) nie
 * mają pokrycia w dostarczonych dowodach (dopasowanie po `evidence_kind`,
 * niezależnie od statusu akceptacji — luka dotyczy BRAKU złożenia, nie oceny).
 * Kryteria bez zdefiniowanego `expected_evidence` są luką, gdy nie mają
 * żadnego dowodu w ogóle.
 */
export async function getEvidenceGaps(
  organizationId: string,
  programId: string
): Promise<EvidenceGap[]> {
  const criteria = await auditAll<Record<string, unknown>>(
    `SELECT id, ref_code, title, expected_evidence FROM audit_program_criteria
      WHERE organization_id = $1 AND program_id = $2 AND applicable = true
      ORDER BY ordinal ASC`,
    [organizationId, programId]
  );
  if (criteria.length === 0) return [];

  const evidenceRows = await auditAll<{ criterion_id: string; evidence_kind: string }>(
    `SELECT criterion_id, evidence_kind FROM audit_evidence
      WHERE organization_id = $1 AND program_id = $2 AND criterion_id IS NOT NULL`,
    [organizationId, programId]
  );

  const providedByCriterion = new Map<string, Set<string>>();
  for (const row of evidenceRows) {
    const set = providedByCriterion.get(row.criterion_id) ?? new Set<string>();
    set.add(row.evidence_kind);
    providedByCriterion.set(row.criterion_id, set);
  }

  const gaps: EvidenceGap[] = [];
  for (const c of criteria) {
    const criterionId = String(c.id);
    const expected = parseJson<ExpectedEvidenceSpec[]>(c.expected_evidence, []);
    const provided = providedByCriterion.get(criterionId) ?? new Set<string>();

    if (expected.length === 0) {
      if (provided.size === 0) {
        gaps.push({
          criterionId,
          refCode: (c.ref_code as string) ?? null,
          title: String(c.title ?? ''),
          missingKinds: [],
        });
      }
      continue;
    }

    const missing = Array.from(
      new Set(
        expected
          .filter((e) => e.mandatory !== false)
          .map((e) => e.kind)
          .filter((kind) => !provided.has(kind))
      )
    );
    if (missing.length > 0) {
      gaps.push({
        criterionId,
        refCode: (c.ref_code as string) ?? null,
        title: String(c.title ?? ''),
        missingKinds: missing,
      });
    }
  }

  return gaps;
}
