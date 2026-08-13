/**
 * verificationService — U4 — weryfikacja skuteczności (tabela `audit_verifications`).
 *
 * Weryfikacja skuteczności to nie ta sama czynność co wdrożenie: wykonawca
 * mówi „zrobiłem", weryfikacja mówi „i to faktycznie zadziałało — sprawdziła
 * to osoba NIEZALEŻNA, na podstawie DOWODU". Stąd dwie bramki w
 * `performVerification`: `assertIndependentVerifier` (segregacja obowiązków,
 * z `permissions.ts`) i twardy wymóg dowodu dla wyniku `effective`.
 *
 * Ten plik świadomie NIE importuje `findingService.ts` ani
 * `correctiveActionService.ts` — to `findingService` czyta stąd
 * `listVerifications` przy budowaniu szczegółu ustalenia. Odczyt reguł
 * decyzyjnych pakietu (niezależność weryfikacji) robimy tu lokalnie.
 */

import {
  AuditNotFoundError,
  AuditStateError,
  auditAll,
  auditGet,
  auditRun,
  newId,
  parseJson,
  recordAuditEvent,
  toIso,
} from './auditsDb.js';
import { assertIndependentVerifier, requireCapability } from './permissions.js';
import type { AuditActor, AuditVerification, PackDecisionRules, VerificationKind, VerificationResult } from './types.js';
import { VERIFICATION_KINDS, VERIFICATION_RESULTS } from './types.js';

// ---------------------------------------------------------------------------
// Odwzorowanie wierszy
// ---------------------------------------------------------------------------

interface VerificationRow {
  id: string;
  corrective_action_id: string | null;
  finding_id: string;
  program_id: string;
  organization_id: string;
  verification_kind: string;
  method: string | null;
  planned_date: unknown;
  performed_at: unknown;
  performed_by: string | null;
  evidence_id: string | null;
  result: string | null;
  note: string | null;
  independence_ok: unknown;
  independence_note: string | null;
  created_by: string | null;
  created_at: unknown;
  updated_at: unknown;
}

function rowToVerification(row: VerificationRow): AuditVerification {
  return {
    id: row.id,
    correctiveActionId: row.corrective_action_id,
    findingId: row.finding_id,
    programId: row.program_id,
    organizationId: row.organization_id,
    verificationKind: row.verification_kind as VerificationKind,
    method: row.method,
    plannedDate: toIso(row.planned_date),
    performedAt: toIso(row.performed_at),
    performedBy: row.performed_by,
    evidenceId: row.evidence_id,
    result: row.result as VerificationResult | null,
    note: row.note,
    independenceOk: row.independence_ok === null || row.independence_ok === undefined ? null : Boolean(row.independence_ok),
    independenceNote: row.independence_note,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at) as string,
    updatedAt: toIso(row.updated_at) as string,
  };
}

async function loadVerificationRow(organizationId: string, id: string): Promise<VerificationRow> {
  const row = await auditGet<VerificationRow>(
    `SELECT * FROM audit_verifications WHERE organization_id = $1 AND id = $2`,
    [organizationId, id],
  );
  if (!row) throw new AuditNotFoundError('Weryfikacja');
  return row;
}

async function fetchVerification(organizationId: string, id: string): Promise<AuditVerification> {
  return rowToVerification(await loadVerificationRow(organizationId, id));
}

function scoped(actor: AuditActor, organizationId: string): AuditActor {
  return { ...actor, organizationId };
}

async function loadDecisionRules(organizationId: string, programId: string): Promise<PackDecisionRules> {
  const row = await auditGet<{ decision_rules: unknown }>(
    `SELECT pk.decision_rules AS decision_rules
       FROM audit_programs prog
       JOIN audit_packs pk ON pk.id = prog.pack_id
      WHERE prog.organization_id = $1 AND prog.id = $2`,
    [organizationId, programId],
  );
  return parseJson<PackDecisionRules>(row?.decision_rules, {});
}

// ---------------------------------------------------------------------------
// planVerification
// ---------------------------------------------------------------------------

export interface PlanVerificationInput {
  findingId: string;
  correctiveActionId?: string | null;
  verificationKind: VerificationKind;
  method?: string | null;
  plannedDate?: string | null;
}

export async function planVerification(
  organizationId: string,
  actor: AuditActor,
  input: PlanVerificationInput,
): Promise<AuditVerification> {
  const act = scoped(actor, organizationId);
  const findingRow = await auditGet<{ program_id: string }>(
    `SELECT program_id FROM audit_program_findings WHERE organization_id = $1 AND id = $2`,
    [organizationId, input.findingId],
  );
  if (!findingRow) throw new AuditNotFoundError('Ustalenie');
  await requireCapability(act, findingRow.program_id, 'verification.perform');

  if (!VERIFICATION_KINDS.includes(input.verificationKind)) {
    throw new AuditStateError(`Nieznany rodzaj weryfikacji: ${String(input.verificationKind)}`);
  }

  const id = newId('av');
  await auditRun(
    `INSERT INTO audit_verifications
       (id, corrective_action_id, finding_id, program_id, organization_id, verification_kind,
        method, planned_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      input.correctiveActionId ?? null,
      input.findingId,
      findingRow.program_id,
      organizationId,
      input.verificationKind,
      input.method ?? null,
      input.plannedDate ?? null,
      actor.userId,
    ],
  );

  await recordAuditEvent({
    organizationId,
    programId: findingRow.program_id,
    entityType: 'verification',
    entityId: id,
    eventType: 'verification.planned',
    actorId: actor.userId,
    summary: `Zaplanowano weryfikację (${input.verificationKind}) dla ustalenia ${input.findingId}`,
    payload: { correctiveActionId: input.correctiveActionId ?? null },
  });

  return fetchVerification(organizationId, id);
}

// ---------------------------------------------------------------------------
// performVerification
// ---------------------------------------------------------------------------

export interface PerformVerificationInput {
  result: VerificationResult;
  note?: string | null;
  evidenceId?: string | null;
}

export async function performVerification(
  organizationId: string,
  actor: AuditActor,
  id: string,
  input: PerformVerificationInput,
): Promise<AuditVerification> {
  const act = scoped(actor, organizationId);
  const row = await loadVerificationRow(organizationId, id);
  await requireCapability(act, row.program_id, 'verification.perform');

  if (row.corrective_action_id) {
    const decisionRules = await loadDecisionRules(organizationId, row.program_id);
    await assertIndependentVerifier(organizationId, row.corrective_action_id, actor.userId, decisionRules);
  }

  if (!VERIFICATION_RESULTS.includes(input.result)) {
    throw new AuditStateError(`Nieznany wynik weryfikacji: ${String(input.result)}`);
  }

  if (row.verification_kind === 'effectiveness' && input.result === 'effective' && !input.evidenceId) {
    throw new AuditStateError('Skuteczność musi opierać się na dowodzie — wskaż evidenceId');
  }

  await auditRun(
    `UPDATE audit_verifications
        SET result = $3, note = $4, evidence_id = $5, performed_by = $6, performed_at = NOW(),
            independence_ok = TRUE, updated_at = NOW()
      WHERE organization_id = $1 AND id = $2`,
    [organizationId, id, input.result, input.note ?? null, input.evidenceId ?? null, actor.userId],
  );

  await recordAuditEvent({
    organizationId,
    programId: row.program_id,
    entityType: 'verification',
    entityId: id,
    eventType: 'verification.performed',
    actorId: actor.userId,
    summary: `Wykonano weryfikację (${row.verification_kind}): wynik ${input.result}`,
    payload: { evidenceId: input.evidenceId ?? null },
  });

  return fetchVerification(organizationId, id);
}

// ---------------------------------------------------------------------------
// listVerifications
// ---------------------------------------------------------------------------

export interface ListVerificationsFilter {
  programId?: string;
  findingId?: string;
  correctiveActionId?: string;
  kind?: VerificationKind;
}

export async function listVerifications(
  organizationId: string,
  filter: ListVerificationsFilter,
): Promise<AuditVerification[]> {
  const clauses = ['organization_id = $1'];
  const params: unknown[] = [organizationId];
  const pushEq = (column: string, value: unknown) => {
    params.push(value);
    clauses.push(`${column} = $${params.length}`);
  };

  if (filter.programId) pushEq('program_id', filter.programId);
  if (filter.findingId) pushEq('finding_id', filter.findingId);
  if (filter.correctiveActionId) pushEq('corrective_action_id', filter.correctiveActionId);
  if (filter.kind) pushEq('verification_kind', filter.kind);

  const where = clauses.join(' AND ');
  const rows = await auditAll<VerificationRow>(
    `SELECT * FROM audit_verifications WHERE ${where} ORDER BY created_at ASC`,
    params,
  );
  return rows.map(rowToVerification);
}

// ---------------------------------------------------------------------------
// getVerificationReadiness
// ---------------------------------------------------------------------------

export interface VerificationReadiness {
  implementedWithoutVerification: Array<{
    actionId: string;
    findingId: string;
    title: string;
    implementedAt: string | null;
  }>;
  overduePlannedVerifications: Array<{
    verificationId: string;
    findingId: string;
    plannedDate: string | null;
  }>;
  findingsReadyToClose: Array<{ findingId: string; referenceCode: string | null }>;
}

export async function getVerificationReadiness(
  organizationId: string,
  programId: string,
): Promise<VerificationReadiness> {
  const implementedRows = await auditAll<{
    action_id: string;
    finding_id: string;
    title: string;
    implemented_at: unknown;
  }>(
    `SELECT a.id AS action_id, a.finding_id, a.title, a.implemented_at
       FROM audit_corrective_actions a
      WHERE a.organization_id = $1 AND a.program_id = $2 AND a.status = 'implemented'
        AND NOT EXISTS (
          SELECT 1 FROM audit_verifications v
           WHERE v.organization_id = $1 AND v.corrective_action_id = a.id
             AND v.verification_kind = 'effectiveness' AND v.result = 'effective'
        )`,
    [organizationId, programId],
  );

  const overdueRows = await auditAll<{ verification_id: string; finding_id: string; planned_date: unknown }>(
    `SELECT id AS verification_id, finding_id, planned_date
       FROM audit_verifications
      WHERE organization_id = $1 AND program_id = $2 AND performed_at IS NULL
        AND planned_date IS NOT NULL AND planned_date < CURRENT_DATE`,
    [organizationId, programId],
  );

  const readyRows = await auditAll<{ finding_id: string; reference_code: string | null }>(
    `SELECT f.id AS finding_id, f.reference_code
       FROM audit_program_findings f
      WHERE f.organization_id = $1 AND f.program_id = $2
        AND f.status NOT IN ('closed', 'risk_accepted', 'rejected', 'draft')
        AND NOT EXISTS (
          SELECT 1 FROM audit_corrective_actions a
           WHERE a.organization_id = $1 AND a.finding_id = f.id
             AND a.status NOT IN ('rejected', 'cancelled')
             AND NOT EXISTS (
               SELECT 1 FROM audit_verifications v
                WHERE v.organization_id = $1 AND v.corrective_action_id = a.id
                  AND v.verification_kind = 'effectiveness' AND v.result = 'effective'
             )
        )`,
    [organizationId, programId],
  );

  return {
    implementedWithoutVerification: implementedRows.map((r) => ({
      actionId: r.action_id,
      findingId: r.finding_id,
      title: r.title,
      implementedAt: toIso(r.implemented_at),
    })),
    overduePlannedVerifications: overdueRows.map((r) => ({
      verificationId: r.verification_id,
      findingId: r.finding_id,
      plannedDate: toIso(r.planned_date),
    })),
    findingsReadyToClose: readyRows.map((r) => ({ findingId: r.finding_id, referenceCode: r.reference_code })),
  };
}
