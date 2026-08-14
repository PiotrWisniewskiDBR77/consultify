/**
 * outputService — niezmienny Output audytu (audit_outputs).
 *
 * Output jest zamrożonym, samowystarczalnym snapshotem programu w chwili
 * finalizacji: zakres, wersja pakietu, zespół, rejestr dowodów (z
 * provenance), wykonane procedury/testy, wnioski o zgodności, ustalenia,
 * wnioski systemowe, odpowiedzi właścicieli, plan działań korygujących,
 * ryzyko rezydualne, plan weryfikacji i ślad zatwierdzeń. Po finalizacji
 * NIE WOLNO go edytować — korekta oznacza `supersede` przez nowy Output, nie
 * mutację istniejącego wiersza. Dlatego ten plik świadomie nie eksportuje
 * żadnej funkcji `updateOutput`.
 */

import { createHash } from 'crypto';

import {
  AuditDomainError,
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
import { requireCapability } from './permissions.js';
import type {
  AuditOutputPayload,
  OutputApprovalTrailEntry,
  OutputCorrectiveAction,
  OutputCriterionWork,
  OutputEvidenceEntry,
  OutputFinding,
  OutputManagementResponse,
  OutputResidualRisk,
  OutputSystemicConclusion,
  OutputTeamMember,
  OutputVerificationPlanEntry,
} from './reportRenderer.js';
import type { AuditActor, AuditOutput } from './types.js';

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Hash deterministyczny
// ---------------------------------------------------------------------------

/**
 * Sortuje rekurencyjnie klucze obiektów i elementy list, żeby dwa wywołania z
 * tym samym stanem logicznym zawsze wyprodukowały identyczny JSON. Kolejność
 * wierszy z bazy NIE jest gwarantowana bez ORDER BY na kluczu, a ORDER BY w
 * SQL i tak nie chroni przed niedeterminizmem typów (np. NUMERIC jako string)
 * — dlatego sortowanie odbywa się tutaj, w pamięci, na już zbudowanym obiekcie.
 */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep).sort((a, b) => {
      const ka = stableKeyFor(a);
      const kb = stableKeyFor(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  }
  if (value && typeof value === 'object') {
    const obj = value as Row;
    const out: Row = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortDeep(obj[key]);
    }
    return out;
  }
  return value;
}

/** Preferuje `id` jako klucz sortowania list; w braku — treść już posortowanego obiektu. */
function stableKeyFor(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'id' in (value as Row)) {
    return `id:${String((value as Row).id)}`;
  }
  return JSON.stringify(value);
}

/**
 * Deterministyczny hash dowolnego payloadu JSON-serializowalnego. Czysta
 * funkcja: to samo wejście → ten sam wynik przy dowolnej liczbie wywołań.
 */
export function computeOutputHash(payload: unknown): string {
  const canonical = JSON.stringify(sortDeep(payload));
  return createHash('sha256').update(canonical).digest('hex');
}

// ---------------------------------------------------------------------------
// Budowa payloadu (snapshot programu)
// ---------------------------------------------------------------------------

async function buildOutputPayload(
  orgId: string,
  programId: string,
  program: Row,
  actor: AuditActor,
  generatedAt: string
): Promise<AuditOutputPayload> {
  const [
    packRow,
    teamRows,
    evidenceRows,
    criteriaRows,
    findingRows,
    responseRows,
    actionRows,
    verificationRows,
  ] = await Promise.all([
    program.pack_id
      ? auditGet<Row>(
          `SELECT ap.*, ans.title AS source_title
               FROM audit_packs ap
               LEFT JOIN audit_norm_sources ans ON ans.id = ap.source_id
              WHERE ap.id = $1`,
          [program.pack_id]
        )
      : Promise.resolve(null),
    auditAll<Row>(
      `SELECT * FROM audit_program_members WHERE organization_id=$1 AND program_id=$2 AND removed_at IS NULL`,
      [orgId, programId]
    ),
    auditAll<Row>(`SELECT * FROM audit_evidence WHERE organization_id=$1 AND program_id=$2`, [
      orgId,
      programId,
    ]),
    auditAll<Row>(
      `SELECT * FROM audit_program_criteria WHERE organization_id=$1 AND program_id=$2`,
      [orgId, programId]
    ),
    auditAll<Row>(
      `SELECT * FROM audit_program_findings WHERE organization_id=$1 AND program_id=$2`,
      [orgId, programId]
    ),
    auditAll<Row>(
      `SELECT * FROM audit_management_responses WHERE organization_id=$1 AND program_id=$2`,
      [orgId, programId]
    ),
    auditAll<Row>(
      `SELECT * FROM audit_corrective_actions WHERE organization_id=$1 AND program_id=$2`,
      [orgId, programId]
    ),
    auditAll<Row>(`SELECT * FROM audit_verifications WHERE organization_id=$1 AND program_id=$2`, [
      orgId,
      programId,
    ]),
  ]);

  const team: OutputTeamMember[] = teamRows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    role: String(r.member_role),
    independenceDeclared: toBool(r.independence_declared),
    assignedAt: toIso(r.assigned_at),
  }));

  const evidence: OutputEvidenceEntry[] = evidenceRows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    evidenceKind: String(r.evidence_kind),
    criterionId: (r.criterion_id as string) ?? null,
    materialId: (r.material_id as string) ?? null,
    materialVersion: (r.material_version as string) ?? null,
    contentHash: (r.content_hash as string) ?? null,
    sourceSystem: (r.source_system as string) ?? null,
    sufficiency: (r.sufficiency as string) ?? null,
    reliability: (r.reliability as string) ?? null,
    supportsConformity:
      r.supports_conformity === null || r.supports_conformity === undefined
        ? null
        : toBool(r.supports_conformity),
  }));

  const criteriaWork: OutputCriterionWork[] = criteriaRows.map((r) => ({
    id: String(r.id),
    refCode: (r.ref_code as string) ?? null,
    title: String(r.title),
    requirementText: (r.requirement_text as string) ?? null,
    procedurePerformed: (r.procedure_performed as string) ?? null,
    sampleDescription: (r.sample_description as string) ?? null,
    testPerformed: (r.test_performed as string) ?? null,
    testResult: (r.test_result as string) ?? null,
    auditorNote: (r.auditor_note as string) ?? null,
    auditorConclusion: (r.auditor_conclusion as string) ?? null,
    conformityStatus: String(r.conformity_status) as OutputCriterionWork['conformityStatus'],
    concludedBy: (r.concluded_by as string) ?? null,
    concludedAt: toIso(r.concluded_at),
  }));

  const findings: OutputFinding[] = findingRows.map((r) => ({
    id: String(r.id),
    referenceCode: (r.reference_code as string) ?? null,
    statement: String(r.statement),
    criterionId: (r.criterion_id as string) ?? null,
    classification: String(r.classification),
    severity: (r.severity as OutputFinding['severity']) ?? null,
    objectiveEvidence: parseJson<string[]>(r.objective_evidence, []),
    contradictingEvidence: parseJson<string[]>(r.contradicting_evidence, []),
    status: String(r.status),
    rootCause: (r.root_cause as string) ?? null,
    rootCauseConfirmed: toBool(r.root_cause_confirmed),
    residualRisk: (r.residual_risk as string) ?? null,
    ownerUserId: (r.owner_user_id as string) ?? null,
  }));

  const managementResponses: OutputManagementResponse[] = responseRows.map((r) => ({
    id: String(r.id),
    findingId: String(r.finding_id),
    position: String(r.position) as OutputManagementResponse['position'],
    statement: String(r.statement),
    respondedBy: (r.responded_by as string) ?? null,
    respondedAt: toIso(r.responded_at),
    status: String(r.status),
  }));

  const correctiveActionPlan: OutputCorrectiveAction[] = actionRows.map((r) => ({
    id: String(r.id),
    findingId: String(r.finding_id),
    actionKind: String(r.action_kind) as OutputCorrectiveAction['actionKind'],
    title: String(r.title),
    ownerUserId: (r.owner_user_id as string) ?? null,
    dueDate: r.due_date ? toIso(r.due_date) : null,
    status: String(r.status) as OutputCorrectiveAction['status'],
  }));

  const verificationPlan: OutputVerificationPlanEntry[] = verificationRows.map((r) => ({
    id: String(r.id),
    correctiveActionId: (r.corrective_action_id as string) ?? null,
    findingId: String(r.finding_id),
    verificationKind: String(
      r.verification_kind
    ) as OutputVerificationPlanEntry['verificationKind'],
    method: (r.method as string) ?? null,
    plannedDate: r.planned_date ? toIso(r.planned_date) : null,
    performedAt: toIso(r.performed_at),
    result: (r.result as OutputVerificationPlanEntry['result']) ?? null,
  }));

  const residualRiskByFindingRow = new Map(findingRows.map((r) => [String(r.id), r]));
  const residualRisk: OutputResidualRisk[] = findings
    .filter((f) => f.residualRisk)
    .map((f) => {
      const row = residualRiskByFindingRow.get(f.id) ?? {};
      return {
        findingId: f.id,
        residualRisk: f.residualRisk,
        acceptedBy: (row.residual_risk_accepted_by as string) ?? null,
        acceptedAt: toIso(row.residual_risk_accepted_at),
        note: (row.residual_risk_note as string) ?? null,
      };
    });

  const systemicConclusions = buildSystemicConclusions(findings);
  const approvalTrail = buildApprovalTrail(findingRows, actionRows, verificationRows);

  return {
    meta: {
      programId,
      programName: String(program.name ?? ''),
      organizationId: orgId,
      generatedAt,
      generatedBy: actor.userId ?? null,
      packId: (program.pack_id as string) ?? null,
      packVersion: program.pack_version != null ? toNum(program.pack_version) : null,
      packClassification: packRow ? String(packRow.classification ?? '') || null : null,
      packSourceId: packRow ? ((packRow.source_id as string) ?? null) : null,
      packSourceTitle: packRow ? ((packRow.source_title as string) ?? null) : null,
    },
    scope: {
      scopeText: (program.scope_text as string) ?? null,
      scopeJson: parseJson<Record<string, unknown> | null>(program.scope_json, null),
      objectives: (program.objective as string) ?? null,
    },
    team,
    evidence,
    criteriaWork,
    findings,
    systemicConclusions,
    managementResponses,
    correctiveActionPlan,
    residualRisk,
    verificationPlan,
    approvalTrail,
    provenance: {
      builtAt: generatedAt,
      builtBy: actor.userId ?? null,
      sourceTables: {
        auditProgramCriteria: criteriaRows.length,
        auditEvidence: evidenceRows.length,
        auditProgramFindings: findingRows.length,
        auditCorrectiveActions: actionRows.length,
        auditVerifications: verificationRows.length,
        auditManagementResponses: responseRows.length,
        auditProgramMembers: teamRows.length,
      },
    },
  };
}

/**
 * Grupuje ustalenia z POTWIERDZONĄ przyczyną źródłową (rootCauseConfirmed)
 * po treści przyczyny — powtarzająca się przyczyna źródłowa jest tu operacyjną
 * definicją „wniosku systemowego". Bez potwierdzenia przyczyny nie zgadujemy.
 */
function buildSystemicConclusions(findings: OutputFinding[]): OutputSystemicConclusion[] {
  const groups = new Map<string, string[]>();
  const labelByKey = new Map<string, string>();
  for (const f of findings) {
    if (!f.rootCauseConfirmed) continue;
    const cause = (f.rootCause || '').trim();
    if (!cause) continue;
    const key = cause.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, []);
      labelByKey.set(key, cause);
    }
    groups.get(key)!.push(f.id);
  }
  return Array.from(groups.entries()).map(([key, findingIds]) => {
    const theme = labelByKey.get(key) ?? key;
    return {
      theme,
      findingIds,
      description: `Potwierdzona przyczyna źródłowa „${theme}" powtarza się w ${findingIds.length} ustaleniach.`,
    };
  });
}

function buildApprovalTrail(
  findingRows: Row[],
  actionRows: Row[],
  verificationRows: Row[]
): OutputApprovalTrailEntry[] {
  const trail: OutputApprovalTrailEntry[] = [];
  for (const r of findingRows) {
    if (r.reviewed_by && r.reviewed_at) {
      trail.push({
        who: String(r.reviewed_by),
        when: toIso(r.reviewed_at),
        what: `Przegląd ustalenia ${r.id}`,
      });
    }
    if (r.closed_by && r.closed_at) {
      trail.push({
        who: String(r.closed_by),
        when: toIso(r.closed_at),
        what: `Zamknięcie ustalenia ${r.id} (${r.closure_decision ?? 'brak decyzji'})`,
      });
    }
    if (r.residual_risk_accepted_by && r.residual_risk_accepted_at) {
      trail.push({
        who: String(r.residual_risk_accepted_by),
        when: toIso(r.residual_risk_accepted_at),
        what: `Akceptacja ryzyka rezydualnego dla ustalenia ${r.id}`,
      });
    }
  }
  for (const r of actionRows) {
    if (r.approved_by && r.approved_at) {
      trail.push({
        who: String(r.approved_by),
        when: toIso(r.approved_at),
        what: `Zatwierdzenie działania ${r.id}`,
      });
    }
    if (r.implemented_by && r.implemented_at) {
      trail.push({
        who: String(r.implemented_by),
        when: toIso(r.implemented_at),
        what: `Wdrożenie działania ${r.id}`,
      });
    }
  }
  for (const r of verificationRows) {
    if (r.performed_by && r.performed_at) {
      trail.push({
        who: String(r.performed_by),
        when: toIso(r.performed_at),
        what: `Weryfikacja skuteczności ${r.id} — wynik: ${r.result ?? 'brak'}`,
      });
    }
  }
  return trail;
}

// ---------------------------------------------------------------------------
// Mapowanie wiersza
// ---------------------------------------------------------------------------

function mapOutputRow(row: Row): AuditOutput {
  return {
    id: String(row.id),
    programId: String(row.program_id),
    organizationId: String(row.organization_id),
    version: toNum(row.version) ?? Number(row.version),
    title: String(row.title),
    payload: parseJson(row.payload, {}),
    contentHash: (row.content_hash as string) ?? null,
    packId: (row.pack_id as string) ?? null,
    packVersion: row.pack_version != null ? toNum(row.pack_version) : null,
    finalizedBy: (row.finalized_by as string) ?? null,
    finalizedAt: toIso(row.finalized_at) ?? String(row.finalized_at),
    supersededBy: (row.superseded_by as string) ?? null,
    supersededAt: toIso(row.superseded_at),
    provenance: parseJson(row.provenance, {}),
    createdAt: toIso(row.created_at) ?? String(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export interface FinalizeOutputInput {
  title?: string;
}

/**
 * Finalizuje Output — buduje pełny snapshot programu i zapisuje go jako
 * NOWY, niezmienny wiersz. Nie istnieje ścieżka aktualizacji: korekta to
 * finalizacja kolejnej wersji (lub `supersedeOutput` na starszej).
 */
export async function finalizeOutput(
  orgId: string,
  actor: AuditActor,
  programId: string,
  input: FinalizeOutputInput = {}
): Promise<AuditOutput> {
  await requireCapability(actor, programId, 'output.finalize');

  const program = await auditGet<Row>(
    `SELECT * FROM audit_programs WHERE organization_id=$1 AND id=$2`,
    [orgId, programId]
  );
  if (!program) throw new AuditNotFoundError('Program audytowy');

  // TWARDA REGUŁA 1: żadne ustalenie nie może być w draft/in_review.
  const blocking = await auditAll<{ id: string }>(
    `SELECT id FROM audit_program_findings
      WHERE organization_id=$1 AND program_id=$2 AND status IN ('draft','in_review')`,
    [orgId, programId]
  );
  if (blocking.length > 0) {
    throw new AuditStateError(
      `Nie można sfinalizować Outputu — ${blocking.length} ustaleń jest w statusie draft/in_review ` +
        `(m.in. ${blocking[0].id}); dokończ przegląd ustaleń przed finalizacją`
    );
  }

  const generatedAt = new Date().toISOString();
  const payload = await buildOutputPayload(orgId, programId, program, actor, generatedAt);
  const contentHash = computeOutputHash(payload);

  const id = newId('aout');
  const title = (input.title || '').trim() || `Output — ${String(program.name ?? programId)}`;

  // TWARDA REGUŁA 2: wersja = MAX+1 w JEDNEJ instrukcji INSERT...SELECT, żeby
  // uniknąć wyścigu dwóch równoległych finalizacji czytających ten sam MAX
  // osobnym SELECT-em. UNIQUE (program_id, version) jest backstopem: jeśli
  // mimo to dojdzie do kolizji, baza odrzuci drugi zapis głośnym błędem
  // zamiast po cichu nadpisać wersję.
  try {
    await auditRun(
      `INSERT INTO audit_outputs
         (id, program_id, organization_id, version, title, payload, content_hash,
          pack_id, pack_version, finalized_by, provenance)
       SELECT $1, $2, $3, COALESCE(MAX(version), 0) + 1, $4, $5, $6, $7, $8, $9, $10
         FROM audit_outputs WHERE program_id = $2`,
      [
        id,
        programId,
        orgId,
        title,
        JSON.stringify(payload),
        contentHash,
        (program.pack_id as string) ?? null,
        program.pack_version != null ? toNum(program.pack_version) : null,
        actor.userId,
        JSON.stringify({ builtAt: generatedAt, builtBy: actor.userId }),
      ]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/uq_audit_outputs_program_version|duplicate key/i.test(message)) {
      throw new AuditStateError(
        'Wykryto równoległą finalizację Outputu dla tego programu (kolizja wersji) — spróbuj ponownie'
      );
    }
    throw error;
  }

  await recordAuditEvent({
    organizationId: orgId,
    programId,
    entityType: 'audit_output',
    entityId: id,
    eventType: 'output.finalized',
    actorId: actor.userId,
    summary: `Sfinalizowano Output „${title}"`,
    payload: { contentHash },
  });

  const created = await getOutput(orgId, id);
  if (!created) {
    throw new AuditDomainError(
      'Output nie został poprawnie zapisany',
      500,
      'AUDIT_OUTPUT_WRITE_FAILED'
    );
  }
  return created;
}

export async function listOutputs(
  orgId: string,
  filters: { programId?: string } = {}
): Promise<AuditOutput[]> {
  const params: unknown[] = [orgId];
  let sql = `SELECT * FROM audit_outputs WHERE organization_id = $1`;
  if (filters.programId) {
    params.push(filters.programId);
    sql += ` AND program_id = $${params.length}`;
  }
  const rows = await auditAll<Row>(sql, params);
  return rows.map(mapOutputRow).sort((a, b) => a.version - b.version);
}

export async function getOutput(orgId: string, id: string): Promise<AuditOutput | null> {
  const row = await auditGet<Row>(
    `SELECT * FROM audit_outputs WHERE organization_id=$1 AND id=$2`,
    [orgId, id]
  );
  return row ? mapOutputRow(row) : null;
}

/**
 * Oznacza stary Output jako zastąpiony przez nowszy — NIE kasuje wiersza ani
 * nie modyfikuje jego payloadu/wersji/hasha.
 */
export async function supersedeOutput(
  orgId: string,
  actor: AuditActor,
  id: string,
  newOutputId: string
): Promise<AuditOutput> {
  const output = await getOutput(orgId, id);
  if (!output) throw new AuditNotFoundError('Output');
  await requireCapability(actor, output.programId, 'output.finalize');

  if (newOutputId === id) {
    throw new AuditStateError('Output nie może zastąpić samego siebie');
  }
  const replacement = await getOutput(orgId, newOutputId);
  if (!replacement) throw new AuditNotFoundError('Output zastępujący');
  if (replacement.programId !== output.programId) {
    throw new AuditStateError('Output zastępujący musi należeć do tego samego programu audytowego');
  }

  await auditRun(
    `UPDATE audit_outputs SET superseded_by=$1, superseded_at=NOW() WHERE organization_id=$2 AND id=$3`,
    [newOutputId, orgId, id]
  );

  await recordAuditEvent({
    organizationId: orgId,
    programId: output.programId,
    entityType: 'audit_output',
    entityId: id,
    eventType: 'output.superseded',
    actorId: actor.userId,
    summary: `Output ${id} zastąpiony przez ${newOutputId}`,
  });

  const updated = await getOutput(orgId, id);
  if (!updated) throw new AuditNotFoundError('Output');
  return updated;
}

export interface OutputDiffResult {
  outputA: string;
  outputB: string;
  addedFindings: OutputFinding[];
  removedFindings: OutputFinding[];
  changedFindings: Array<{ id: string; before: OutputFinding; after: OutputFinding }>;
  conformityChanges: Array<{ criterionId: string; before: string | null; after: string | null }>;
}

/** Porównuje dwie wersje Outputu — do zestawiania cykli audytowych. */
export async function diffOutputs(
  orgId: string,
  aId: string,
  bId: string
): Promise<OutputDiffResult> {
  const [a, b] = await Promise.all([getOutput(orgId, aId), getOutput(orgId, bId)]);
  if (!a) throw new AuditNotFoundError('Output A');
  if (!b) throw new AuditNotFoundError('Output B');

  const aPayload = a.payload as unknown as AuditOutputPayload;
  const bPayload = b.payload as unknown as AuditOutputPayload;
  const aFindings = Array.isArray(aPayload?.findings) ? aPayload.findings : [];
  const bFindings = Array.isArray(bPayload?.findings) ? bPayload.findings : [];
  const aMap = new Map(aFindings.map((f) => [f.id, f]));
  const bMap = new Map(bFindings.map((f) => [f.id, f]));

  const addedFindings = bFindings.filter((f) => !aMap.has(f.id));
  const removedFindings = aFindings.filter((f) => !bMap.has(f.id));
  const changedFindings: OutputDiffResult['changedFindings'] = [];
  for (const [id, before] of aMap) {
    const after = bMap.get(id);
    if (after && JSON.stringify(sortDeep(before)) !== JSON.stringify(sortDeep(after))) {
      changedFindings.push({ id, before, after });
    }
  }

  const aCriteria = Array.isArray(aPayload?.criteriaWork) ? aPayload.criteriaWork : [];
  const bCriteria = Array.isArray(bPayload?.criteriaWork) ? bPayload.criteriaWork : [];
  const aCMap = new Map(aCriteria.map((c) => [c.id, c]));
  const bCMap = new Map(bCriteria.map((c) => [c.id, c]));
  const conformityChanges: OutputDiffResult['conformityChanges'] = [];
  for (const [id, before] of aCMap) {
    const after = bCMap.get(id);
    if (after && before.conformityStatus !== after.conformityStatus) {
      conformityChanges.push({
        criterionId: id,
        before: before.conformityStatus,
        after: after.conformityStatus,
      });
    }
  }
  for (const [id, after] of bCMap) {
    if (!aCMap.has(id)) {
      conformityChanges.push({ criterionId: id, before: null, after: after.conformityStatus });
    }
  }

  return {
    outputA: aId,
    outputB: bId,
    addedFindings,
    removedFindings,
    changedFindings,
    conformityChanges,
  };
}
