/**
 * correctiveActionService — U4 — działania korygujące (tabela `audit_corrective_actions`).
 *
 * TWARDA REGUŁA (MOD-AGR-04 §17): korekcja (`correction`) i działanie doraźne
 * (`containment`) usuwają SKUTEK, nie PRZYCZYNĘ. Dla ustalenia oznaczającego
 * niezgodność nie wolno zatwierdzić planu złożonego WYŁĄCZNIE z takich działań
 * — musi istnieć co najmniej jedno `corrective_action`, inaczej „naprawa" jest
 * tylko zamieceniem problemu pod dywan.
 *
 * Ten plik świadomie NIE importuje `findingService.ts` (żeby nie tworzyć cyklu
 * — to `findingService` czyta stąd `listActions` przy budowaniu szczegółu
 * ustalenia). Sprawdzenie klasyfikacji ustalenia robimy tu lokalnie, wprost
 * po tabelach `audit_program_findings` / `audit_programs` / `audit_packs`.
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
import { requireCapability } from './permissions.js';
import type {
  ActionKind,
  ActionStatus,
  AuditActor,
  AuditCorrectiveAction,
  FindingTaxonomyEntry,
} from './types.js';
import { ACTION_KINDS } from './types.js';

// ---------------------------------------------------------------------------
// Odwzorowanie wierszy
// ---------------------------------------------------------------------------

interface ActionRow {
  id: string;
  finding_id: string;
  program_id: string;
  organization_id: string;
  action_kind: string;
  title: string;
  description: string | null;
  owner_user_id: string | null;
  due_date: unknown;
  priority: string | null;
  status: string;
  approved_by: string | null;
  approved_at: unknown;
  rejected_reason: string | null;
  task_id: string | null;
  initiative_id: string | null;
  proposal_id: string | null;
  implementation_evidence_id: string | null;
  implemented_at: unknown;
  implemented_by: string | null;
  implementation_note: string | null;
  created_by: string | null;
  created_at: unknown;
  updated_at: unknown;
}

function rowToAction(row: ActionRow): AuditCorrectiveAction {
  return {
    id: row.id,
    findingId: row.finding_id,
    programId: row.program_id,
    organizationId: row.organization_id,
    actionKind: row.action_kind as ActionKind,
    title: row.title,
    description: row.description,
    ownerUserId: row.owner_user_id,
    dueDate: toIso(row.due_date),
    priority: row.priority,
    status: row.status as ActionStatus,
    approvedBy: row.approved_by,
    approvedAt: toIso(row.approved_at),
    rejectedReason: row.rejected_reason,
    taskId: row.task_id,
    initiativeId: row.initiative_id,
    proposalId: row.proposal_id,
    implementationEvidenceId: row.implementation_evidence_id,
    implementedAt: toIso(row.implemented_at),
    implementedBy: row.implemented_by,
    implementationNote: row.implementation_note,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at) as string,
    updatedAt: toIso(row.updated_at) as string,
  };
}

async function loadActionRow(organizationId: string, id: string): Promise<ActionRow> {
  const row = await auditGet<ActionRow>(
    `SELECT * FROM audit_corrective_actions WHERE organization_id = $1 AND id = $2`,
    [organizationId, id]
  );
  if (!row) throw new AuditNotFoundError('Działanie korygujące');
  return row;
}

async function fetchAction(organizationId: string, id: string): Promise<AuditCorrectiveAction> {
  return rowToAction(await loadActionRow(organizationId, id));
}

function scoped(actor: AuditActor, organizationId: string): AuditActor {
  return { ...actor, organizationId };
}

// ---------------------------------------------------------------------------
// Klasyfikacja ustalenia — sprawdzenie lokalne (bez importu findingService)
// ---------------------------------------------------------------------------

const NEVER_NONCONFORMING = new Set([
  'observation',
  'opportunity_for_improvement',
  'evidence_insufficient',
  'conforming',
  'not_applicable',
]);

async function isFindingNonconforming(
  organizationId: string,
  programId: string,
  classification: string
): Promise<boolean> {
  if (NEVER_NONCONFORMING.has(classification)) return false;
  const row = await auditGet<{ finding_taxonomy: unknown }>(
    `SELECT pk.finding_taxonomy AS finding_taxonomy
       FROM audit_programs prog
       JOIN audit_packs pk ON pk.id = prog.pack_id
      WHERE prog.organization_id = $1 AND prog.id = $2`,
    [organizationId, programId]
  );
  const taxonomy = parseJson<FindingTaxonomyEntry[]>(row?.finding_taxonomy, []);
  const entry = taxonomy.find((t) => t.key === classification);
  if (entry) return entry.nonConforming === true;
  return classification === 'nonconforming';
}

// ---------------------------------------------------------------------------
// proposeAction
// ---------------------------------------------------------------------------

export interface ProposeActionInput {
  actionKind: ActionKind;
  title: string;
  description?: string | null;
  ownerUserId?: string | null;
  dueDate?: string | null;
  priority?: string | null;
}

export async function proposeAction(
  organizationId: string,
  actor: AuditActor,
  findingId: string,
  input: ProposeActionInput
): Promise<AuditCorrectiveAction> {
  const act = scoped(actor, organizationId);
  const findingRow = await auditGet<{ program_id: string }>(
    `SELECT program_id FROM audit_program_findings WHERE organization_id = $1 AND id = $2`,
    [organizationId, findingId]
  );
  if (!findingRow) throw new AuditNotFoundError('Ustalenie');
  await requireCapability(act, findingRow.program_id, 'action.propose');

  const title = String(input.title || '').trim();
  if (!title) throw new AuditStateError('Działanie korygujące wymaga tytułu');
  if (!ACTION_KINDS.includes(input.actionKind)) {
    throw new AuditStateError(`Nieznany rodzaj działania: ${String(input.actionKind)}`);
  }

  const id = newId('aca');
  await auditRun(
    `INSERT INTO audit_corrective_actions
       (id, finding_id, program_id, organization_id, action_kind, title, description,
        owner_user_id, due_date, priority, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'proposed',$11)`,
    [
      id,
      findingId,
      findingRow.program_id,
      organizationId,
      input.actionKind,
      title,
      input.description ?? null,
      input.ownerUserId ?? null,
      input.dueDate ?? null,
      input.priority ?? null,
      actor.userId,
    ]
  );

  await recordAuditEvent({
    organizationId,
    programId: findingRow.program_id,
    entityType: 'corrective_action',
    entityId: id,
    eventType: 'action.proposed',
    actorId: actor.userId,
    summary: `Zaproponowano działanie (${input.actionKind}): ${title}`,
    payload: { findingId, actionKind: input.actionKind },
  });

  return fetchAction(organizationId, id);
}

// ---------------------------------------------------------------------------
// approveAction / rejectAction
// ---------------------------------------------------------------------------

export async function approveAction(
  organizationId: string,
  actor: AuditActor,
  id: string
): Promise<AuditCorrectiveAction> {
  const act = scoped(actor, organizationId);
  const row = await loadActionRow(organizationId, id);
  await requireCapability(act, row.program_id, 'action.approve');

  if (row.status !== 'proposed') {
    throw new AuditStateError(
      `Zatwierdzić można wyłącznie działanie w statusie „proposed" (obecny status: „${row.status}")`
    );
  }

  const findingRow = await auditGet<{ classification: string }>(
    `SELECT classification FROM audit_program_findings WHERE organization_id = $1 AND id = $2`,
    [organizationId, row.finding_id]
  );

  if (findingRow) {
    const nonconforming = await isFindingNonconforming(
      organizationId,
      row.program_id,
      findingRow.classification
    );
    if (nonconforming) {
      const siblings = await auditAll<{ action_kind: string }>(
        `SELECT action_kind FROM audit_corrective_actions
          WHERE organization_id = $1 AND finding_id = $2 AND status NOT IN ('rejected', 'cancelled')`,
        [organizationId, row.finding_id]
      );
      const kinds = new Set(siblings.map((s) => s.action_kind));
      kinds.add(row.action_kind); // działanie właśnie zatwierdzane liczy się do planu
      if (!kinds.has('corrective_action')) {
        throw new AuditStateError(
          'Nie można zatwierdzić planu złożonego wyłącznie z korekcji/działań doraźnych ' +
            '(correction/containment) — korekcja usuwa SKUTEK, a niezgodność wymaga co najmniej ' +
            'jednego działania korygującego (corrective_action), które usuwa PRZYCZYNĘ'
        );
      }
    }
  }

  await auditRun(
    `UPDATE audit_corrective_actions
        SET status = 'approved', approved_by = $3, approved_at = NOW(), updated_at = NOW()
      WHERE organization_id = $1 AND id = $2`,
    [organizationId, id, actor.userId]
  );

  await recordAuditEvent({
    organizationId,
    programId: row.program_id,
    entityType: 'corrective_action',
    entityId: id,
    eventType: 'action.approved',
    actorId: actor.userId,
    summary: `Zatwierdzono działanie: ${row.title}`,
  });

  return fetchAction(organizationId, id);
}

export async function rejectAction(
  organizationId: string,
  actor: AuditActor,
  id: string,
  reason: string
): Promise<AuditCorrectiveAction> {
  const act = scoped(actor, organizationId);
  const row = await loadActionRow(organizationId, id);
  await requireCapability(act, row.program_id, 'action.approve');

  const reasonText = String(reason || '').trim();
  if (!reasonText) throw new AuditStateError('Odrzucenie działania wymaga podania powodu');

  await auditRun(
    `UPDATE audit_corrective_actions
        SET status = 'rejected', rejected_reason = $3, updated_at = NOW()
      WHERE organization_id = $1 AND id = $2`,
    [organizationId, id, reasonText]
  );

  await recordAuditEvent({
    organizationId,
    programId: row.program_id,
    entityType: 'corrective_action',
    entityId: id,
    eventType: 'action.rejected',
    actorId: actor.userId,
    summary: `Odrzucono działanie: ${row.title} — ${reasonText}`,
  });

  return fetchAction(organizationId, id);
}

// ---------------------------------------------------------------------------
// updateAction
// ---------------------------------------------------------------------------

export interface UpdateActionInput {
  actionKind?: ActionKind;
  title?: string;
  description?: string | null;
  ownerUserId?: string | null;
  dueDate?: string | null;
  priority?: string | null;
}

export async function updateAction(
  organizationId: string,
  actor: AuditActor,
  id: string,
  patch: UpdateActionInput
): Promise<AuditCorrectiveAction> {
  const act = scoped(actor, organizationId);
  const row = await loadActionRow(organizationId, id);
  await requireCapability(act, row.program_id, 'action.propose');

  const updates: Array<[string, unknown]> = [];
  if (patch.actionKind !== undefined) {
    if (!ACTION_KINDS.includes(patch.actionKind)) {
      throw new AuditStateError(`Nieznany rodzaj działania: ${String(patch.actionKind)}`);
    }
    updates.push(['action_kind', patch.actionKind]);
  }
  if (patch.title !== undefined) updates.push(['title', String(patch.title)]);
  if (patch.description !== undefined) updates.push(['description', patch.description]);
  if (patch.ownerUserId !== undefined) updates.push(['owner_user_id', patch.ownerUserId]);
  if (patch.dueDate !== undefined) updates.push(['due_date', patch.dueDate]);
  if (patch.priority !== undefined) updates.push(['priority', patch.priority]);

  if (updates.length === 0) return fetchAction(organizationId, id);

  const setSql = updates.map(([col], i) => `${col} = $${i + 3}`).join(', ');
  const params = [organizationId, id, ...updates.map(([, v]) => v)];
  await auditRun(
    `UPDATE audit_corrective_actions SET ${setSql}, updated_at = NOW() WHERE organization_id = $1 AND id = $2`,
    params
  );

  await recordAuditEvent({
    organizationId,
    programId: row.program_id,
    entityType: 'corrective_action',
    entityId: id,
    eventType: 'action.updated',
    actorId: actor.userId,
    summary: `Zaktualizowano działanie: ${row.title}`,
    payload: { fields: updates.map(([col]) => col) },
  });

  return fetchAction(organizationId, id);
}

// ---------------------------------------------------------------------------
// listActions / getAction
// ---------------------------------------------------------------------------

export interface ListActionsFilter {
  programId?: string;
  findingId?: string;
  ownerUserId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface AuditCorrectiveActionListResult {
  items: AuditCorrectiveAction[];
  total: number;
}

export async function listActions(
  organizationId: string,
  filter: ListActionsFilter
): Promise<AuditCorrectiveActionListResult> {
  const clauses = ['organization_id = $1'];
  const params: unknown[] = [organizationId];
  const pushEq = (column: string, value: unknown) => {
    params.push(value);
    clauses.push(`${column} = $${params.length}`);
  };

  if (filter.programId) pushEq('program_id', filter.programId);
  if (filter.findingId) pushEq('finding_id', filter.findingId);
  if (filter.ownerUserId) pushEq('owner_user_id', filter.ownerUserId);
  if (filter.status) pushEq('status', filter.status);

  const where = clauses.join(' AND ');
  const limit = Math.min(Math.max(Number(filter.limit) || 50, 1), 200);
  const offset = Math.max(Number(filter.offset) || 0, 0);

  const rows = await auditAll<ActionRow>(
    `SELECT * FROM audit_corrective_actions WHERE ${where} ORDER BY created_at ASC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const countRow = await auditGet<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM audit_corrective_actions WHERE ${where}`,
    params
  );

  return { items: rows.map(rowToAction), total: countRow ? Number(countRow.c) : rows.length };
}

export async function getAction(
  organizationId: string,
  id: string
): Promise<AuditCorrectiveAction> {
  return fetchAction(organizationId, id);
}

// ---------------------------------------------------------------------------
// reportImplementation
// ---------------------------------------------------------------------------

export interface ReportImplementationInput {
  evidenceId?: string | null;
  note?: string | null;
}

export async function reportImplementation(
  organizationId: string,
  actor: AuditActor,
  id: string,
  input: ReportImplementationInput
): Promise<AuditCorrectiveAction> {
  const act = scoped(actor, organizationId);
  const row = await loadActionRow(organizationId, id);
  await requireCapability(act, row.program_id, 'action.report_implementation');

  if (!['approved', 'in_progress', 'overdue'].includes(row.status)) {
    throw new AuditStateError(
      `Wdrożenie można zgłosić tylko dla działania zatwierdzonego lub w toku (obecny status: „${row.status}")`
    );
  }

  await auditRun(
    `UPDATE audit_corrective_actions
        SET status = 'implemented', implemented_by = $3, implemented_at = NOW(),
            implementation_evidence_id = $4, implementation_note = $5, updated_at = NOW()
      WHERE organization_id = $1 AND id = $2`,
    [organizationId, id, actor.userId, input.evidenceId ?? null, input.note ?? null]
  );

  await recordAuditEvent({
    organizationId,
    programId: row.program_id,
    entityType: 'corrective_action',
    entityId: id,
    eventType: 'action.implemented',
    actorId: actor.userId,
    summary: `Zgłoszono wdrożenie działania: ${row.title}`,
    payload: { evidenceId: input.evidenceId ?? null },
  });

  return fetchAction(organizationId, id);
}

// ---------------------------------------------------------------------------
// markOverdueActions — zadanie porządkowe, bez aktora
// ---------------------------------------------------------------------------

export async function markOverdueActions(
  organizationId: string
): Promise<{ updatedIds: string[] }> {
  const rows = await auditAll<{ id: string; program_id: string; title: string }>(
    `SELECT id, program_id, title FROM audit_corrective_actions
      WHERE organization_id = $1 AND status IN ('approved', 'in_progress')
        AND due_date IS NOT NULL AND due_date < CURRENT_DATE`,
    [organizationId]
  );
  if (rows.length === 0) return { updatedIds: [] };

  await auditRun(
    `UPDATE audit_corrective_actions
        SET status = 'overdue', updated_at = NOW()
      WHERE organization_id = $1 AND status IN ('approved', 'in_progress')
        AND due_date IS NOT NULL AND due_date < CURRENT_DATE`,
    [organizationId]
  );

  for (const r of rows) {
    await recordAuditEvent({
      organizationId,
      programId: r.program_id,
      entityType: 'corrective_action',
      entityId: r.id,
      eventType: 'action.overdue',
      summary: `Działanie przeterminowane: ${r.title}`,
    });
  }

  return { updatedIds: rows.map((r) => r.id) };
}

// ---------------------------------------------------------------------------
// linkToTask / linkToInitiative — read-back, bez tworzenia obiektów docelowych
// ---------------------------------------------------------------------------

export async function linkToTask(
  organizationId: string,
  actor: AuditActor,
  id: string,
  taskId: string
): Promise<AuditCorrectiveAction> {
  const act = scoped(actor, organizationId);
  const row = await loadActionRow(organizationId, id);
  await requireCapability(act, row.program_id, 'action.propose');

  const value = String(taskId || '').trim();
  if (!value) throw new AuditStateError('Wymagany identyfikator zadania (taskId)');

  await auditRun(
    `UPDATE audit_corrective_actions SET task_id = $3, updated_at = NOW() WHERE organization_id = $1 AND id = $2`,
    [organizationId, id, value]
  );

  await recordAuditEvent({
    organizationId,
    programId: row.program_id,
    entityType: 'corrective_action',
    entityId: id,
    eventType: 'action.linked_task',
    actorId: actor.userId,
    summary: `Powiązano działanie z zadaniem ${value}`,
  });

  return fetchAction(organizationId, id);
}

export async function linkToInitiative(
  organizationId: string,
  actor: AuditActor,
  id: string,
  initiativeId: string
): Promise<AuditCorrectiveAction> {
  const act = scoped(actor, organizationId);
  const row = await loadActionRow(organizationId, id);
  await requireCapability(act, row.program_id, 'action.propose');

  const value = String(initiativeId || '').trim();
  if (!value) throw new AuditStateError('Wymagany identyfikator inicjatywy (initiativeId)');

  await auditRun(
    `UPDATE audit_corrective_actions SET initiative_id = $3, updated_at = NOW() WHERE organization_id = $1 AND id = $2`,
    [organizationId, id, value]
  );

  await recordAuditEvent({
    organizationId,
    programId: row.program_id,
    entityType: 'corrective_action',
    entityId: id,
    eventType: 'action.linked_initiative',
    actorId: actor.userId,
    summary: `Powiązano działanie z inicjatywą ${value}`,
  });

  return fetchAction(organizationId, id);
}
