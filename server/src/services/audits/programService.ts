/**
 * programService — powierzchnia „Processes": program audytowy jako kontener
 * cyklu życia audytu, jego skład (snapshot kryteriów z pakietu) i jego zespół.
 *
 * DECYZJE, KTÓRE WARTO ZNAĆ ZANIM ZMIENISZ TEN PLIK:
 *
 * 1. `createProgramFromPack` wymaga capability `program.create`. W macierzy
 *    `permissions.ts` ta capability jest nadawana WYŁĄCZNIE roli
 *    `program_owner`/`administrator` W KONKRETNYM programie (chicken-and-egg
 *    dla programu, który jeszcze nie istnieje) albo administratorowi
 *    platformy. W praktyce: utworzenie NOWEGO programu z biblioteki pakietów
 *    wymaga bycia administratorem organizacji — to świadoma bramka wejścia do
 *    Processes, nie błąd. `requireCreateCapability()` odpytuje
 *    `resolveProgramAccess(actor, '__new_program__')` (nieistniejący
 *    program_id), więc jedyne, co może dać capability, to rola platformowa.
 *
 * 2. `startNextCycle` NIE przechodzi przez tę samą bramkę — wymaga
 *    `program.advance_lifecycle` na programie ŹRÓDŁOWYM (program_owner/
 *    lead_auditor mogą to zrobić bez bycia administratorem platformy). To
 *    świadome rozdzielenie: „kto może otworzyć bibliotekę i zainicjować
 *    pierwszy program" różni się od „kto może kontynuować cykl już
 *    prowadzonego audytu". Logika tworzenia wiersza (`createProgramCore`) jest
 *    wspólna i NIE zawiera własnej bramki uprawnień — obie funkcje publiczne
 *    sprawdzają uprawnienia PRZED jej wywołaniem.
 *
 * 3. Legacy kolumna `status` (draft/active/completed/archived) jest
 *    utrzymywana obok `lifecycle_state`, bo stary orchestrator
 *    (`auditProgramService.ts`, NIE ruszany) czyta tylko `status`. Mapujemy:
 *    `closed` → `completed`, każdy inny etap cyklu → `active`, świeżo
 *    utworzony program → `draft`.
 *
 * 4. `updateProgram`/`deleteProgram` działają WYŁĄCZNIE w `lifecycle_state
 *    = 'planning'` — to dosłowne odczytanie specyfikacji zadania
 *    ("tylko w 'planning'"), żeby program nie zmieniał tożsamości/zakresu
 *    w trakcie prowadzonego audytu poza kontrolowanym przejściem stanu.
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
import { assertCapability, requireCapability, resolveProgramAccess } from './permissions.js';
import { assertGate, assertTransitionAllowed, evaluateGate, nextStates } from './lifecycle.js';
import type { LifecycleGateFacts } from './lifecycle.js';
import type {
  AuditActor,
  AuditLifecycleState,
  AuditProgramMember,
  AuditRole,
  ExpectedEvidenceSpec,
} from './types.js';

// ---------------------------------------------------------------------------
// Typy lokalne — `audit_programs` nie ma własnego interfejsu w types.ts
// ---------------------------------------------------------------------------

export interface AuditProgram {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  objective: string | null;
  status: string;
  preset: string | null;
  packId: string | null;
  packKey: string | null;
  packVersion: number | null;
  lifecycleState: AuditLifecycleState | null;
  scopeText: string | null;
  scopeJson: Record<string, unknown> | null;
  criteriaSnapshotAt: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  programOwnerId: string | null;
  leadAuditorId: string | null;
  projectId: string | null;
  recurrence: string | null;
  previousProgramId: string | null;
  closedAt: string | null;
  closedBy: string | null;
  closureNote: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function mapProgramRow(row: Record<string, unknown>): AuditProgram {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name ?? ''),
    description: (row.description as string) ?? null,
    objective: (row.objective as string) ?? null,
    status: String(row.status ?? 'draft'),
    preset: (row.preset as string) ?? null,
    packId: (row.pack_id as string) ?? null,
    packKey: (row.pack_key as string) ?? null,
    packVersion: toNum(row.pack_version),
    lifecycleState: (row.lifecycle_state as AuditLifecycleState) ?? null,
    scopeText: (row.scope_text as string) ?? null,
    scopeJson: row.scope_json ? parseJson<Record<string, unknown>>(row.scope_json, {}) : null,
    criteriaSnapshotAt: toIso(row.criteria_snapshot_at),
    plannedStart: row.planned_start ? String(row.planned_start) : null,
    plannedEnd: row.planned_end ? String(row.planned_end) : null,
    programOwnerId: (row.program_owner_id as string) ?? null,
    leadAuditorId: (row.lead_auditor_id as string) ?? null,
    projectId: (row.project_id as string) ?? null,
    recurrence: (row.recurrence as string) ?? null,
    previousProgramId: (row.previous_program_id as string) ?? null,
    closedAt: toIso(row.closed_at),
    closedBy: (row.closed_by as string) ?? null,
    closureNote: (row.closure_note as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    createdAt: toIso(row.created_at) ?? '',
    updatedAt: toIso(row.updated_at) ?? '',
  };
}

function mapMemberRow(row: Record<string, unknown>): AuditProgramMember {
  return {
    id: String(row.id),
    programId: String(row.program_id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    memberRole: row.member_role as AuditRole,
    scopeNote: (row.scope_note as string) ?? null,
    independenceDeclared: toBool(row.independence_declared),
    conflictNote: (row.conflict_note as string) ?? null,
    competenceNote: (row.competence_note as string) ?? null,
    assignedBy: (row.assigned_by as string) ?? null,
    assignedAt: toIso(row.assigned_at) ?? '',
    removedAt: toIso(row.removed_at),
  };
}

function clampLimit(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(Math.floor(n), 200);
}

function clampOffset(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** Legacy `status` mirror — zobacz decyzję #3 w nagłówku pliku. */
function legacyStatusFor(lifecycleState: AuditLifecycleState): string {
  return lifecycleState === 'closed' ? 'completed' : 'active';
}

async function requireCreateCapability(actor: AuditActor): Promise<void> {
  const access = await resolveProgramAccess(actor, '__new_program__');
  assertCapability(
    access,
    'program.create',
    'Utworzenie nowego programu audytowego wymaga roli administratora organizacji (nowy program nie ma jeszcze przypisanego właściciela)'
  );
}

// ---------------------------------------------------------------------------
// Odczyt
// ---------------------------------------------------------------------------

export interface ListProgramsOptions {
  search?: string;
  lifecycleState?: AuditLifecycleState | 'all';
  status?: string | 'all';
  limit?: number;
  offset?: number;
}

export interface ProgramListItem extends AuditProgram {
  criteriaTotal: number;
  criteriaConcluded: number;
  findingsOpen: number;
}

export interface ListProgramsResult {
  programs: ProgramListItem[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Listing z licznikiem postępu w JEDNYM zapytaniu agregującym (LEFT JOIN na
 * podzapytaniach GROUP BY program_id) — nie N+1 zapytanie per wiersz.
 */
export async function listPrograms(
  organizationId: string,
  options: ListProgramsOptions = {}
): Promise<ListProgramsResult> {
  const limit = clampLimit(options.limit);
  const offset = clampOffset(options.offset);

  const where: string[] = ['p.organization_id = $1'];
  const params: unknown[] = [organizationId];

  const search = isNonEmpty(options.search) ? options.search.trim() : '';
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    where.push(`(p.name ILIKE $${idx} OR p.objective ILIKE $${idx} OR p.scope_text ILIKE $${idx})`);
  }
  if (options.lifecycleState && options.lifecycleState !== 'all') {
    params.push(options.lifecycleState);
    where.push(`p.lifecycle_state = $${params.length}`);
  }
  if (options.status && options.status !== 'all') {
    params.push(options.status);
    where.push(`p.status = $${params.length}`);
  }
  const whereSql = where.join(' AND ');

  const countRow = await auditGet<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM audit_programs p WHERE ${whereSql}`,
    params
  );
  const total = Number(countRow?.total ?? 0);

  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const rows = await auditAll<Record<string, unknown>>(
    `SELECT p.*,
            COALESCE(cs.criteria_total, 0)::int AS criteria_total,
            COALESCE(cs.criteria_concluded, 0)::int AS criteria_concluded,
            COALESCE(fs.findings_open, 0)::int AS findings_open
       FROM audit_programs p
       LEFT JOIN (
         SELECT program_id,
                COUNT(*) AS criteria_total,
                COUNT(*) FILTER (WHERE work_status = 'concluded') AS criteria_concluded
           FROM audit_program_criteria
          WHERE organization_id = $1
          GROUP BY program_id
       ) cs ON cs.program_id = p.id
       LEFT JOIN (
         SELECT program_id, COUNT(*) AS findings_open
           FROM audit_program_findings
          WHERE organization_id = $1
            AND status NOT IN ('closed', 'risk_accepted', 'rejected')
          GROUP BY program_id
       ) fs ON fs.program_id = p.id
      WHERE ${whereSql}
      ORDER BY p.updated_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, limit, offset]
  );

  const programs: ProgramListItem[] = rows.map((row) => ({
    ...mapProgramRow(row),
    criteriaTotal: Number(row.criteria_total ?? 0),
    criteriaConcluded: Number(row.criteria_concluded ?? 0),
    findingsOpen: Number(row.findings_open ?? 0),
  }));

  return { programs, total, limit, offset };
}

export interface ProgramStats {
  criteriaTotal: number;
  criteriaApplicable: number;
  criteriaConcluded: number;
  criteriaInsufficientEvidence: number;
  findingsOpen: number;
  findingsClosed: number;
  evidenceTotal: number;
  evidenceAccepted: number;
}

export interface ProgramDetail {
  program: AuditProgram;
  members: AuditProgramMember[];
  stats: ProgramStats;
}

export async function listMembers(
  organizationId: string,
  programId: string
): Promise<AuditProgramMember[]> {
  const rows = await auditAll<Record<string, unknown>>(
    `SELECT * FROM audit_program_members
      WHERE organization_id = $1 AND program_id = $2 AND removed_at IS NULL
      ORDER BY assigned_at ASC`,
    [organizationId, programId]
  );
  return rows.map(mapMemberRow);
}

export async function getProgram(
  organizationId: string,
  id: string
): Promise<ProgramDetail | null> {
  const row = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_programs WHERE id = $1 AND organization_id = $2`,
    [id, organizationId]
  );
  if (!row) return null;
  const program = mapProgramRow(row);
  const members = await listMembers(organizationId, id);

  const statsRow = await auditGet<Record<string, unknown>>(
    `SELECT
        (SELECT COUNT(*) FROM audit_program_criteria WHERE organization_id = $1 AND program_id = $2) AS criteria_total,
        (SELECT COUNT(*) FROM audit_program_criteria WHERE organization_id = $1 AND program_id = $2 AND applicable = true) AS criteria_applicable,
        (SELECT COUNT(*) FROM audit_program_criteria WHERE organization_id = $1 AND program_id = $2 AND work_status = 'concluded') AS criteria_concluded,
        (SELECT COUNT(*) FROM audit_program_criteria WHERE organization_id = $1 AND program_id = $2 AND conformity_status = 'evidence_insufficient') AS criteria_insufficient_evidence,
        (SELECT COUNT(*) FROM audit_program_findings WHERE organization_id = $1 AND program_id = $2 AND status NOT IN ('closed','risk_accepted','rejected')) AS findings_open,
        (SELECT COUNT(*) FROM audit_program_findings WHERE organization_id = $1 AND program_id = $2 AND status IN ('closed','risk_accepted','rejected')) AS findings_closed,
        (SELECT COUNT(*) FROM audit_evidence WHERE organization_id = $1 AND program_id = $2) AS evidence_total,
        (SELECT COUNT(*) FROM audit_evidence WHERE organization_id = $1 AND program_id = $2 AND accepted = true) AS evidence_accepted
      `,
    [organizationId, id]
  );

  const stats: ProgramStats = {
    criteriaTotal: Number(statsRow?.criteria_total ?? 0),
    criteriaApplicable: Number(statsRow?.criteria_applicable ?? 0),
    criteriaConcluded: Number(statsRow?.criteria_concluded ?? 0),
    criteriaInsufficientEvidence: Number(statsRow?.criteria_insufficient_evidence ?? 0),
    findingsOpen: Number(statsRow?.findings_open ?? 0),
    findingsClosed: Number(statsRow?.findings_closed ?? 0),
    evidenceTotal: Number(statsRow?.evidence_total ?? 0),
    evidenceAccepted: Number(statsRow?.evidence_accepted ?? 0),
  };

  return { program, members, stats };
}

// ---------------------------------------------------------------------------
// Tworzenie z pakietu (snapshot kryteriów) — jądro Processes
// ---------------------------------------------------------------------------

export interface CreateProgramFromPackInput {
  packId: string;
  name: string;
  objective?: string | null;
  scopeText?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  projectId?: string | null;
}

interface CreateProgramCoreExtra {
  previousProgramId?: string | null;
  recurrence?: string | null;
}

async function createProgramCore(
  organizationId: string,
  actor: AuditActor,
  input: CreateProgramFromPackInput,
  extra: CreateProgramCoreExtra = {}
): Promise<ProgramDetail> {
  if (!isNonEmpty(input.packId)) {
    throw new AuditDomainError('packId jest wymagany', 400, 'AUDIT_PACK_ID_REQUIRED');
  }
  if (!isNonEmpty(input.name)) {
    throw new AuditDomainError('Nazwa programu jest wymagana', 400, 'AUDIT_PROGRAM_NAME_REQUIRED');
  }

  const pack = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_packs WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)`,
    [input.packId, organizationId]
  );
  if (!pack) throw new AuditNotFoundError('Pakiet audytowy');
  if (String(pack.publication_status) !== 'published') {
    throw new AuditStateError(
      'Nie można utworzyć programu z pakietu, który nie jest opublikowany (publication_status musi być "published")'
    );
  }

  const packCriteria = await auditAll<Record<string, unknown>>(
    `SELECT * FROM audit_pack_criteria WHERE pack_id = $1 ORDER BY ordinal ASC`,
    [input.packId]
  );

  const programId = newId('aprog');
  const now = new Date().toISOString();

  await auditRun(
    `INSERT INTO audit_programs
       (id, organization_id, name, description, objective, status, preset, config,
        pack_id, pack_key, pack_version, lifecycle_state, scope_text, scope_json,
        criteria_snapshot_at, planned_start, planned_end, program_owner_id,
        project_id, recurrence, previous_program_id, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
    [
      programId,
      organizationId,
      input.name.trim(),
      null,
      input.objective ?? null,
      'draft',
      null,
      JSON.stringify({}),
      pack.id,
      pack.pack_key,
      pack.version,
      'planning',
      input.scopeText ?? null,
      null,
      now,
      input.plannedStart ?? null,
      input.plannedEnd ?? null,
      actor.userId,
      input.projectId ?? null,
      extra.recurrence ?? null,
      extra.previousProgramId ?? null,
      actor.userId,
      now,
      now,
    ]
  );

  // Snapshot kryteriów, zachowując hierarchię parent → child przez mapowanie
  // starych id pakietu na nowe id programu. Insert nie zależy od kolejności,
  // bo `audit_program_criteria.parent_id` nie ma FK (świadomie — snapshot).
  const idMap = new Map<string, string>();
  for (const c of packCriteria) idMap.set(String(c.id), newId('apcrit'));

  for (const c of packCriteria) {
    const newCriterionId = idMap.get(String(c.id));
    if (!newCriterionId) continue;
    const mappedParent = c.parent_id ? (idMap.get(String(c.parent_id)) ?? null) : null;
    const expectedEvidence = parseJson<ExpectedEvidenceSpec[]>(c.expected_evidence, []);

    await auditRun(
      `INSERT INTO audit_program_criteria
         (id, program_id, organization_id, pack_criterion_id, parent_id, ordinal, ref_code,
          node_kind, title, requirement_text, source_reference, audit_question,
          expected_evidence, audit_procedure, sampling_guidance, mandatory, weight,
          applicable, conformity_status, work_status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        newCriterionId,
        programId,
        organizationId,
        c.id,
        mappedParent,
        Number(c.ordinal ?? 0),
        c.ref_code ?? null,
        c.node_kind ?? 'criterion',
        c.title,
        c.requirement_text ?? null,
        c.source_reference ?? null,
        c.audit_question ?? null,
        JSON.stringify(expectedEvidence),
        c.audit_procedure ?? null,
        c.sampling_guidance ?? null,
        toBool(c.mandatory ?? true),
        c.weight ?? null,
        true,
        'not_tested',
        'open',
        now,
        now,
      ]
    );
  }

  await insertMemberRow(organizationId, programId, {
    userId: actor.userId,
    memberRole: 'program_owner',
    independenceDeclared: false,
    assignedBy: actor.userId,
  });

  await recordAuditEvent({
    organizationId,
    programId,
    entityType: 'program',
    entityId: programId,
    eventType: 'program.created_from_pack',
    actorId: actor.userId,
    summary: `Utworzono program „${input.name.trim()}" z pakietu ${pack.pack_key} v${pack.version}`,
    payload: {
      packId: pack.id,
      packKey: pack.pack_key,
      packVersion: pack.version,
      criteriaCount: packCriteria.length,
      previousProgramId: extra.previousProgramId ?? null,
    },
  });

  const detail = await getProgram(organizationId, programId);
  if (!detail) {
    throw new AuditDomainError(
      'Nie udało się utworzyć programu audytowego',
      500,
      'AUDIT_PROGRAM_CREATE_FAILED'
    );
  }
  return detail;
}

export async function createProgramFromPack(
  organizationId: string,
  actor: AuditActor,
  input: CreateProgramFromPackInput
): Promise<ProgramDetail> {
  await requireCreateCapability(actor);
  return createProgramCore(organizationId, actor, input);
}

// ---------------------------------------------------------------------------
// Update / delete — tylko w fazie 'planning'
// ---------------------------------------------------------------------------

export interface UpdateProgramInput {
  name?: string;
  objective?: string | null;
  description?: string | null;
  scopeText?: string | null;
  scopeJson?: Record<string, unknown> | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  programOwnerId?: string | null;
  leadAuditorId?: string | null;
  projectId?: string | null;
  recurrence?: string | null;
}

function assertPlanningState(program: AuditProgram, action: string): void {
  if (program.lifecycleState && program.lifecycleState !== 'planning') {
    throw new AuditStateError(
      `Program można ${action} tylko w fazie "planning" (bieżący stan: ${program.lifecycleState})`
    );
  }
}

export async function updateProgram(
  organizationId: string,
  actor: AuditActor,
  id: string,
  input: UpdateProgramInput
): Promise<AuditProgram> {
  await requireCapability(actor, id, 'program.update');

  const row = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_programs WHERE id = $1 AND organization_id = $2`,
    [id, organizationId]
  );
  if (!row) throw new AuditNotFoundError('Program audytowy');
  const existing = mapProgramRow(row);
  assertPlanningState(existing, 'edytować');

  const next = {
    name: input.name !== undefined ? String(input.name).trim() : existing.name,
    objective: input.objective !== undefined ? input.objective : existing.objective,
    description: input.description !== undefined ? input.description : existing.description,
    scopeText: input.scopeText !== undefined ? input.scopeText : existing.scopeText,
    scopeJson: input.scopeJson !== undefined ? input.scopeJson : existing.scopeJson,
    plannedStart: input.plannedStart !== undefined ? input.plannedStart : existing.plannedStart,
    plannedEnd: input.plannedEnd !== undefined ? input.plannedEnd : existing.plannedEnd,
    programOwnerId:
      input.programOwnerId !== undefined ? input.programOwnerId : existing.programOwnerId,
    leadAuditorId: input.leadAuditorId !== undefined ? input.leadAuditorId : existing.leadAuditorId,
    projectId: input.projectId !== undefined ? input.projectId : existing.projectId,
    recurrence: input.recurrence !== undefined ? input.recurrence : existing.recurrence,
  };

  await auditRun(
    `UPDATE audit_programs
        SET name = $1, objective = $2, description = $3, scope_text = $4, scope_json = $5,
            planned_start = $6, planned_end = $7, program_owner_id = $8, lead_auditor_id = $9,
            project_id = $10, recurrence = $11, updated_at = NOW()
      WHERE id = $12 AND organization_id = $13`,
    [
      next.name,
      next.objective,
      next.description,
      next.scopeText,
      next.scopeJson ? JSON.stringify(next.scopeJson) : null,
      next.plannedStart,
      next.plannedEnd,
      next.programOwnerId,
      next.leadAuditorId,
      next.projectId,
      next.recurrence,
      id,
      organizationId,
    ]
  );

  await recordAuditEvent({
    organizationId,
    programId: id,
    entityType: 'program',
    entityId: id,
    eventType: 'program.updated',
    actorId: actor.userId,
    summary: `Zaktualizowano program „${next.name}"`,
  });

  const updated = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_programs WHERE id = $1 AND organization_id = $2`,
    [id, organizationId]
  );
  return mapProgramRow(updated!);
}

export async function deleteProgram(
  organizationId: string,
  actor: AuditActor,
  id: string
): Promise<void> {
  await requireCapability(actor, id, 'program.delete');

  const row = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_programs WHERE id = $1 AND organization_id = $2`,
    [id, organizationId]
  );
  if (!row) throw new AuditNotFoundError('Program audytowy');
  const existing = mapProgramRow(row);
  assertPlanningState(existing, 'usunąć');

  await auditRun(
    `DELETE FROM audit_program_criteria WHERE program_id = $1 AND organization_id = $2`,
    [id, organizationId]
  );
  await auditRun(
    `DELETE FROM audit_program_members WHERE program_id = $1 AND organization_id = $2`,
    [id, organizationId]
  );
  await auditRun(`DELETE FROM audit_programs WHERE id = $1 AND organization_id = $2`, [
    id,
    organizationId,
  ]);

  await recordAuditEvent({
    organizationId,
    programId: id,
    entityType: 'program',
    entityId: id,
    eventType: 'program.deleted',
    actorId: actor.userId,
    summary: `Usunięto program „${existing.name}" (planning)`,
  });
}

// ---------------------------------------------------------------------------
// Członkowie programu
// ---------------------------------------------------------------------------

interface InsertMemberInput {
  userId: string;
  memberRole: AuditRole;
  scopeNote?: string | null;
  independenceDeclared?: boolean;
  conflictNote?: string | null;
  competenceNote?: string | null;
  assignedBy: string | null;
}

async function insertMemberRow(
  organizationId: string,
  programId: string,
  input: InsertMemberInput
): Promise<AuditProgramMember> {
  const id = newId('apmem');
  await auditRun(
    `INSERT INTO audit_program_members
       (id, program_id, organization_id, user_id, member_role, scope_note,
        independence_declared, conflict_note, competence_note, assigned_by, assigned_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW())
     ON CONFLICT (program_id, user_id, member_role)
     DO UPDATE SET
       removed_at = NULL,
       scope_note = EXCLUDED.scope_note,
       independence_declared = EXCLUDED.independence_declared,
       conflict_note = EXCLUDED.conflict_note,
       competence_note = EXCLUDED.competence_note,
       assigned_by = EXCLUDED.assigned_by,
       assigned_at = NOW()`,
    [
      id,
      programId,
      organizationId,
      input.userId,
      input.memberRole,
      input.scopeNote ?? null,
      input.independenceDeclared ?? false,
      input.conflictNote ?? null,
      input.competenceNote ?? null,
      input.assignedBy,
    ]
  );
  const row = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_program_members
      WHERE program_id = $1 AND organization_id = $2 AND user_id = $3 AND member_role = $4`,
    [programId, organizationId, input.userId, input.memberRole]
  );
  return mapMemberRow(row!);
}

export interface AddMemberInput {
  userId: string;
  memberRole: AuditRole;
  scopeNote?: string | null;
  independenceDeclared?: boolean;
  conflictNote?: string | null;
  competenceNote?: string | null;
}

export async function addMember(
  organizationId: string,
  actor: AuditActor,
  programId: string,
  input: AddMemberInput
): Promise<AuditProgramMember> {
  await requireCapability(actor, programId, 'program.manage_members');
  if (!isNonEmpty(input.userId) || !isNonEmpty(input.memberRole)) {
    throw new AuditDomainError(
      'Dodanie członka programu wymaga userId i memberRole',
      400,
      'AUDIT_MEMBER_INPUT_INVALID'
    );
  }
  const member = await insertMemberRow(organizationId, programId, {
    ...input,
    assignedBy: actor.userId,
  });
  await recordAuditEvent({
    organizationId,
    programId,
    entityType: 'program_member',
    entityId: member.id,
    eventType: 'program.member_added',
    actorId: actor.userId,
    summary: `Dodano ${input.userId} do programu jako ${input.memberRole}`,
  });
  return member;
}

export interface UpdateMemberInput {
  scopeNote?: string | null;
  independenceDeclared?: boolean;
  conflictNote?: string | null;
  competenceNote?: string | null;
}

export async function updateMember(
  organizationId: string,
  actor: AuditActor,
  programId: string,
  memberId: string,
  input: UpdateMemberInput
): Promise<AuditProgramMember> {
  await requireCapability(actor, programId, 'program.manage_members');
  const existingRow = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_program_members
      WHERE id = $1 AND organization_id = $2 AND program_id = $3 AND removed_at IS NULL`,
    [memberId, organizationId, programId]
  );
  if (!existingRow) throw new AuditNotFoundError('Członek programu');

  await auditRun(
    `UPDATE audit_program_members
        SET scope_note = $1, independence_declared = $2, conflict_note = $3, competence_note = $4
      WHERE id = $5`,
    [
      input.scopeNote !== undefined ? input.scopeNote : existingRow.scope_note,
      input.independenceDeclared !== undefined
        ? input.independenceDeclared
        : toBool(existingRow.independence_declared),
      input.conflictNote !== undefined ? input.conflictNote : existingRow.conflict_note,
      input.competenceNote !== undefined ? input.competenceNote : existingRow.competence_note,
      memberId,
    ]
  );

  await recordAuditEvent({
    organizationId,
    programId,
    entityType: 'program_member',
    entityId: memberId,
    eventType: 'program.member_updated',
    actorId: actor.userId,
  });

  const row = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_program_members WHERE id = $1`,
    [memberId]
  );
  return mapMemberRow(row!);
}

export async function removeMember(
  organizationId: string,
  actor: AuditActor,
  programId: string,
  memberId: string
): Promise<void> {
  await requireCapability(actor, programId, 'program.manage_members');
  const existingRow = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_program_members
      WHERE id = $1 AND organization_id = $2 AND program_id = $3 AND removed_at IS NULL`,
    [memberId, organizationId, programId]
  );
  if (!existingRow) throw new AuditNotFoundError('Członek programu');

  if (existingRow.member_role === 'program_owner') {
    const ownersRow = await auditGet<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM audit_program_members
        WHERE organization_id = $1 AND program_id = $2 AND member_role = 'program_owner'
          AND removed_at IS NULL`,
      [organizationId, programId]
    );
    if (Number(ownersRow?.cnt ?? 0) <= 1) {
      throw new AuditStateError('Nie można usunąć ostatniego właściciela programu (program_owner)');
    }
  }

  await auditRun(`UPDATE audit_program_members SET removed_at = NOW() WHERE id = $1`, [memberId]);

  await recordAuditEvent({
    organizationId,
    programId,
    entityType: 'program_member',
    entityId: memberId,
    eventType: 'program.member_removed',
    actorId: actor.userId,
  });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function computeLifecycleFacts(
  organizationId: string,
  programId: string
): Promise<LifecycleGateFacts> {
  const critRow = await auditGet<Record<string, unknown>>(
    `SELECT
        COUNT(*) FILTER (WHERE applicable = true) AS applicable_criteria,
        COUNT(*) FILTER (WHERE applicable = true AND work_status = 'concluded') AS concluded_criteria,
        COUNT(*) FILTER (WHERE conformity_status = 'evidence_insufficient') AS insufficient_evidence_criteria
       FROM audit_program_criteria
      WHERE organization_id = $1 AND program_id = $2`,
    [organizationId, programId]
  );

  const findingRow = await auditGet<Record<string, unknown>>(
    `SELECT
        COUNT(*) FILTER (WHERE f.status IN ('draft','in_review')) AS unreviewed_findings,
        COUNT(*) FILTER (
          WHERE f.status IN ('confirmed','response_pending')
            AND NOT EXISTS (
              SELECT 1 FROM audit_management_responses m
               WHERE m.finding_id = f.id AND m.status IN ('submitted','accepted')
            )
        ) AS findings_without_response,
        COUNT(*) FILTER (
          WHERE f.status IN ('confirmed','response_pending','remediation_in_progress')
            AND NOT EXISTS (
              SELECT 1 FROM audit_corrective_actions a
               WHERE a.finding_id = f.id AND a.status IN ('approved','in_progress','implemented','verified')
            )
        ) AS findings_without_approved_action,
        COUNT(*) FILTER (WHERE f.status NOT IN ('closed','risk_accepted','rejected')) AS unresolved_findings
       FROM audit_program_findings f
      WHERE f.organization_id = $1 AND f.program_id = $2`,
    [organizationId, programId]
  );

  const actionRow = await auditGet<Record<string, unknown>>(
    // Skuteczność mierzy się WYŁĄCZNIE dla działań usuwających przyczynę.
    // Korekcja i containment naprawiają konkretny skutek — dla nich dowodem
    // jest wdrożenie, a nie skuteczność systemowa. Liczenie ich tutaj
    // blokowałoby zamknięcie audytu za to, że ktoś rzetelnie odnotował doraźną
    // korektę obok działania systemowego.
    `SELECT COUNT(*) FILTER (
        WHERE a.status = 'implemented'
          AND a.action_kind IN ('corrective_action', 'preventive_action')
          AND NOT EXISTS (
            SELECT 1 FROM audit_verifications v
             WHERE v.corrective_action_id = a.id AND v.verification_kind = 'effectiveness'
               AND v.result IS NOT NULL
          )
      ) AS actions_without_effectiveness_verification
      FROM audit_corrective_actions a
     WHERE a.organization_id = $1 AND a.program_id = $2`,
    [organizationId, programId]
  );

  const leadRow = await auditGet<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM audit_program_members
      WHERE organization_id = $1 AND program_id = $2 AND member_role = 'lead_auditor'
        AND removed_at IS NULL`,
    [organizationId, programId]
  );

  const programRow = await auditGet<{ criteria_snapshot_at: unknown }>(
    `SELECT criteria_snapshot_at FROM audit_programs WHERE organization_id = $1 AND id = $2`,
    [organizationId, programId]
  );

  return {
    applicableCriteria: Number(critRow?.applicable_criteria ?? 0),
    concludedCriteria: Number(critRow?.concluded_criteria ?? 0),
    insufficientEvidenceCriteria: Number(critRow?.insufficient_evidence_criteria ?? 0),
    unreviewedFindings: Number(findingRow?.unreviewed_findings ?? 0),
    findingsWithoutResponse: Number(findingRow?.findings_without_response ?? 0),
    findingsWithoutApprovedAction: Number(findingRow?.findings_without_approved_action ?? 0),
    actionsWithoutEffectivenessVerification: Number(
      actionRow?.actions_without_effectiveness_verification ?? 0
    ),
    unresolvedFindings: Number(findingRow?.unresolved_findings ?? 0),
    hasLeadAuditor: Number(leadRow?.cnt ?? 0) > 0,
    hasCriteriaSnapshot: Boolean(programRow?.criteria_snapshot_at),
  };
}

export async function transitionLifecycle(
  organizationId: string,
  actor: AuditActor,
  programId: string,
  targetState: AuditLifecycleState,
  reason?: string | null
): Promise<AuditProgram> {
  await requireCapability(actor, programId, 'program.advance_lifecycle');

  const row = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_programs WHERE id = $1 AND organization_id = $2`,
    [programId, organizationId]
  );
  if (!row) throw new AuditNotFoundError('Program audytowy');
  const program = mapProgramRow(row);
  const current = program.lifecycleState;
  if (!current) {
    throw new AuditStateError('Program nie ma zainicjowanego cyklu życia (legacy, bez pakietu)');
  }

  assertTransitionAllowed(current, targetState, reason);
  const facts = await computeLifecycleFacts(organizationId, programId);
  assertGate(targetState, facts);

  const now = new Date().toISOString();
  const legacyStatus = legacyStatusFor(targetState);
  const isClosing = targetState === 'closed';

  await auditRun(
    `UPDATE audit_programs
        SET lifecycle_state = $1, status = $2, closed_at = $3, closed_by = $4, closure_note = $5,
            updated_at = $6
      WHERE id = $7 AND organization_id = $8`,
    [
      targetState,
      legacyStatus,
      isClosing ? now : null,
      isClosing ? actor.userId : null,
      isClosing ? (reason ?? null) : null,
      now,
      programId,
      organizationId,
    ]
  );

  await recordAuditEvent({
    organizationId,
    programId,
    entityType: 'program',
    entityId: programId,
    eventType: 'program.lifecycle_transitioned',
    actorId: actor.userId,
    summary: `Program przeszedł z „${current}" do „${targetState}"${reason ? ` — ${reason}` : ''}`,
    payload: { from: current, to: targetState, reason: reason ?? null },
  });

  const updated = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_programs WHERE id = $1 AND organization_id = $2`,
    [programId, organizationId]
  );
  return mapProgramRow(updated!);
}

export interface LifecycleStatusEntry {
  state: AuditLifecycleState;
  allowed: boolean;
  blockers: string[];
}

export interface LifecycleStatusResult {
  current: AuditLifecycleState | null;
  allowedNext: LifecycleStatusEntry[];
}

export async function getLifecycleStatus(
  organizationId: string,
  programId: string
): Promise<LifecycleStatusResult | null> {
  const row = await auditGet<Record<string, unknown>>(
    `SELECT lifecycle_state FROM audit_programs WHERE id = $1 AND organization_id = $2`,
    [programId, organizationId]
  );
  if (!row) return null;
  const current = (row.lifecycle_state as AuditLifecycleState | null) ?? null;
  if (!current) return { current: null, allowedNext: [] };

  const facts = await computeLifecycleFacts(organizationId, programId);
  const allowedNext = nextStates(current).map((state) => {
    const result = evaluateGate(state, facts);
    return { state, allowed: result.ok, blockers: result.blockers };
  });
  return { current, allowedNext };
}

export async function startNextCycle(
  organizationId: string,
  actor: AuditActor,
  programId: string
): Promise<ProgramDetail> {
  await requireCapability(actor, programId, 'program.advance_lifecycle');

  const row = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_programs WHERE id = $1 AND organization_id = $2`,
    [programId, organizationId]
  );
  if (!row) throw new AuditNotFoundError('Program audytowy');
  const prev = mapProgramRow(row);
  if (!prev.packId) {
    throw new AuditStateError(
      'Program nie ma powiązanego pakietu — nie można rozpocząć kolejnego cyklu'
    );
  }

  // Kryteria kopiujemy od nowa (BEZ ocen/wniosków) — poprzedni cykl nie może
  // udawać aktualnego. Ustalenia powracające NIE są kopiowane tutaj; pole
  // `recurring_from_finding_id` wypełnia się dopiero przy tworzeniu nowego
  // ustalenia (poza zakresem tego serwisu — właściciel: findingService).
  const detail = await createProgramCore(
    organizationId,
    actor,
    {
      packId: prev.packId,
      name: prev.name,
      objective: prev.objective,
      scopeText: prev.scopeText,
      plannedStart: null,
      plannedEnd: null,
      projectId: prev.projectId,
    },
    { previousProgramId: prev.id, recurrence: prev.recurrence }
  );

  await recordAuditEvent({
    organizationId,
    programId: detail.program.id,
    entityType: 'program',
    entityId: detail.program.id,
    eventType: 'program.next_cycle_started',
    actorId: actor.userId,
    summary: `Nowy cykl programu na bazie ${prev.id}`,
    payload: { previousProgramId: prev.id },
  });

  return detail;
}
